import { useState, useRef, useMemo } from "react";
import UploadForm from "./components/UploadForm";
import SwapPreviewList from "./components/SwapPreviewList";
import {
  analyzeResumeApi,
  generateDocxApi,
  generatePdfApi,
} from "./api/resumeApi";
import { computeLiveAtsStats } from "./utils/atsScorer";

const STORAGE_FILE_DATA = "ats_saved_resume_base64";
const STORAGE_FILE_NAME = "ats_saved_resume_name";

function sanitizeFilenameSegment(value, fallback) {
  const printable = Array.from(String(value || ""))
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join("");
  const cleaned = printable
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return cleaned || fallback;
}

function safeClearResumeStorage() {
  try {
    localStorage.removeItem(STORAGE_FILE_DATA);
    localStorage.removeItem(STORAGE_FILE_NAME);
  } catch {
    // Ignore SecurityError when browser blocks site storage
  }
}

function loadSavedResumeFromStorage() {
  if (typeof window === "undefined") return null;
  let savedBase64;
  let savedName;
  try {
    savedBase64 = localStorage.getItem(STORAGE_FILE_DATA);
    savedName = localStorage.getItem(STORAGE_FILE_NAME);
  } catch {
    return null;
  }
  if (!savedBase64 || !savedName) return null;

  try {
    const parts = savedBase64.split(",");
    const payload = parts.length > 1 ? parts[1] : parts[0];
    const byteString = atob(payload);
    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      bytes[i] = byteString.charCodeAt(i);
    }
    return new File([bytes], savedName, {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  } catch (err) {
    console.error("Failed to restore saved resume:", err);
    safeClearResumeStorage();
    return null;
  }
}

export default function App() {
  const [resumeFile, setResumeFile] = useState(loadSavedResumeFromStorage);
  const [analyzedFile, setAnalyzedFile] = useState(null);
  const [keepResume, setKeepResume] = useState(true);
  const [jobMeta, setJobMeta] = useState({
    baseName: "Tailored_Resume",
    title: "Role",
    company: "Company",
  });
  const [jdText, setJdText] = useState("");
  const [provider, setProvider] = useState("auto");
  const [sessionId, setSessionId] = useState(null);
  const [analysisBase, setAnalysisBase] = useState(null);
  const [swaps, setSwaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const fileInputRef = useRef(null);

  const liveAtsStats = useMemo(() => {
    if (!analysisBase) return null;
    const activeCount = swaps.filter(
      (s) => s.approved && s.replacement.trim() !== ""
    ).length;
    const fallback = {
      before: analysisBase.fallbackBefore,
      after:
        activeCount === 0
          ? analysisBase.fallbackBefore
          : analysisBase.fallbackAfter,
      matched: analysisBase.initialMatched,
      gained: [],
      missing: analysisBase.initialMissing,
    };
    return computeLiveAtsStats(
      analysisBase.baseResumeText,
      analysisBase.jdSkills,
      swaps,
      fallback
    );
  }, [analysisBase, swaps]);

  const saveFileToLocal = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (typeof reader.result === "string") {
          localStorage.setItem(STORAGE_FILE_DATA, reader.result);
          localStorage.setItem(STORAGE_FILE_NAME, file.name);
        }
      } catch (e) {
        console.warn("Unable to persist resume in localStorage:", e);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (file) => {
    setErrorMsg("");
    setResumeFile(file);
    if (file && keepResume) {
      saveFileToLocal(file);
    }
  };

  const handleKeepResumeToggle = (checked) => {
    setKeepResume(checked);
    if (checked && resumeFile) {
      saveFileToLocal(resumeFile);
    } else if (!checked) {
      safeClearResumeStorage();
    }
  };

  const handleClearSavedResume = () => {
    setResumeFile(null);
    safeClearResumeStorage();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!resumeFile || !jdText.trim()) return;

    const sourceFile = resumeFile;
    const currentBaseName = sanitizeFilenameSegment(
      sourceFile.name.replace(/\.docx$/i, ""),
      "Tailored_Resume"
    );

    setErrorMsg("");
    setLoading(true);

    try {
      const data = await analyzeResumeApi(sourceFile, jdText, provider);

      setAnalyzedFile(sourceFile);
      setSessionId(data.session_id);
      setJobMeta({
        baseName: currentBaseName,
        title: sanitizeFilenameSegment(data.job_title, "Role"),
        company: sanitizeFilenameSegment(data.company_name, "Company"),
      });
      setAnalysisBase({
        baseResumeText: data.base_resume_text || "",
        jdSkills: data.jd_skills || [],
        fallbackBefore: data.ats_score_before,
        fallbackAfter: data.ats_score_estimated,
        initialMatched: data.matched_skills || [],
        initialMissing: data.missing_skills || [],
      });
      setSwaps(
        (data.swaps || []).map((item, idx) => ({
          id: idx,
          ...item,
          approved: true,
        }))
      );

      if (!keepResume) {
        handleClearSavedResume();
      }
    } catch (error) {
      setErrorMsg(error.message || "Failed to analyze resume.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (id) => {
    setSwaps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, approved: !s.approved } : s))
    );
  };

  const handleEdit = (id, newText) => {
    setSwaps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, replacement: newText } : s))
    );
  };

  const handleDownload = async (format = "pdf") => {
    const targetFormat = format === "docx" ? "docx" : "pdf";
    const fileToExport = analyzedFile || resumeFile;
    if (!fileToExport && !sessionId) return;

    setErrorMsg("");
    setDownloadFormat(targetFormat);

    const approvedMap = {};
    swaps
      .filter((s) => s.approved && s.replacement.trim() !== "")
      .forEach((s) => {
        approvedMap[s.original] = s.replacement;
      });

    const fallbackBase = fileToExport?.name
      ? sanitizeFilenameSegment(
          fileToExport.name.replace(/\.docx$/i, ""),
          "Tailored_Resume"
        )
      : "Tailored_Resume";
    const safeBase = jobMeta.baseName || fallbackBase;
    const downloadName = `${safeBase}_${jobMeta.title}_${jobMeta.company}.${targetFormat}`;

    try {
      const exportFn =
        targetFormat === "docx" ? generateDocxApi : generatePdfApi;
      const blob = await exportFn({
        resumeFile: fileToExport,
        sessionId,
        approvedMap,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setErrorMsg(
        error.message || `Failed to generate ${targetFormat.toUpperCase()}.`
      );
    } finally {
      setDownloadFormat(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 text-slate-900">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            ATS Resume Keyword Injector & Optimizer
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Modular architecture — preserves 100% of your original .docx layout.
          </p>
        </header>

        {errorMsg && (
          <div
            role="alert"
            className="mb-6 px-4 py-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-4"
          >
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg("")}
              className="text-xs font-semibold text-rose-700 hover:text-rose-900 shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5">
            <UploadForm
              resumeFile={resumeFile}
              onFileChange={handleFileChange}
              onClearSavedResume={handleClearSavedResume}
              keepResume={keepResume}
              setKeepResume={handleKeepResumeToggle}
              fileInputRef={fileInputRef}
              provider={provider}
              setProvider={setProvider}
              jdText={jdText}
              setJdText={setJdText}
              onAnalyze={handleAnalyze}
              loading={loading}
            />
          </div>
          <div className="lg:col-span-7">
            <SwapPreviewList
              swaps={swaps}
              atsStats={liveAtsStats}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDownload={handleDownload}
              downloadFormat={downloadFormat}
            />
          </div>
        </div>
      </div>
    </div>
  );
}