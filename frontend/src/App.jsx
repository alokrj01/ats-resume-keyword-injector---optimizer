import React, { useState, useRef, useEffect } from "react";
import UploadForm from "./components/UploadForm";
import SwapPreviewList from "./components/SwapPreviewList";
import { analyzeResumeApi, generatePdfApi } from "./api/resumeApi";

const STORAGE_FILE_DATA = "ats_saved_resume_base64";
const STORAGE_FILE_NAME = "ats_saved_resume_name";

export default function App() {
  const [resumeFile, setResumeFile] = useState(null);
  const [keepResume, setKeepResume] = useState(true);
  const [activeFileName, setActiveFileName] = useState("Tailored_Resume.docx");
  const [jobMeta, setJobMeta] = useState({ title: "Role", company: "Company" });
  const [jdText, setJdText] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [atsStats, setAtsStats] = useState(null);
  const [swaps, setSwaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const savedBase64 = localStorage.getItem(STORAGE_FILE_DATA);
    const savedName = localStorage.getItem(STORAGE_FILE_NAME);
    if (savedBase64 && savedName) {
      try {
        const byteString = atob(savedBase64.split(",")[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const restoredFile = new File([ab], savedName, {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
        setResumeFile(restoredFile);
        setActiveFileName(savedName);
      } catch (err) {
        console.error("Failed to restore saved resume:", err);
      }
    }
  }, []);

  const saveFileToLocal = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        localStorage.setItem(STORAGE_FILE_DATA, reader.result);
        localStorage.setItem(STORAGE_FILE_NAME, file.name);
      } catch (e) {
        console.warn("File too large for localStorage:", e);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (file) => {
    setResumeFile(file);
    if (file) {
      setActiveFileName(file.name);
      if (keepResume) {
        saveFileToLocal(file);
      }
    }
  };

  const handleKeepResumeToggle = (checked) => {
    setKeepResume(checked);
    if (checked && resumeFile) {
      saveFileToLocal(resumeFile);
    } else if (!checked) {
      localStorage.removeItem(STORAGE_FILE_DATA);
      localStorage.removeItem(STORAGE_FILE_NAME);
    }
  };

  const handleClearSavedResume = () => {
    setResumeFile(null);
    localStorage.removeItem(STORAGE_FILE_DATA);
    localStorage.removeItem(STORAGE_FILE_NAME);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!resumeFile) return;
    setLoading(true);

    try {
      const data = await analyzeResumeApi(resumeFile, jdText);

      setSessionId(data.session_id);
      setJobMeta({
        title: (data.job_title || "Role").replace(/\s+/g, "_"),
        company: (data.company_name || "Company").replace(/\s+/g, "_"),
      });
      setAtsStats({
        before: data.ats_score_before,
        after: data.ats_score_estimated,
        missing: data.missing_skills,
      });
      setSwaps(
        data.swaps.map((item, idx) => ({
          id: idx,
          ...item,
          approved: true,
        }))
      );

      setJdText("");
      if (!keepResume) {
        handleClearSavedResume();
      }
    } catch (error) {
      alert(error.message);
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

  const handleDownload = async () => {
    if (!sessionId) return;
    setDownloading(true);

    const approvedMap = {};
    swaps
      .filter((s) => s.approved && s.replacement.trim() !== "")
      .forEach((s) => {
        approvedMap[s.original] = s.replacement;
      });

    try {
      const blob = await generatePdfApi(sessionId, approvedMap);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Alok_Ranjan_${jobMeta.title}_${jobMeta.company}_Resume.pdf`;
      a.click();
    } catch (error) {
      alert(error.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 text-slate-900">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            ATS Resume Keyword Injector & Optimizer
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Modular architecture — preserves 100% of your original .docx layout.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5">
            <UploadForm
              resumeFile={resumeFile}
              onFileChange={handleFileChange}
              onClearSavedResume={handleClearSavedResume}
              keepResume={keepResume}
              setKeepResume={handleKeepResumeToggle}
              fileInputRef={fileInputRef}
              jdText={jdText}
              setJdText={setJdText}
              onAnalyze={handleAnalyze}
              loading={loading}
            />
          </div>
          <div className="lg:col-span-7">
            <SwapPreviewList
              swaps={swaps}
              atsStats={atsStats}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDownload={handleDownload}
              downloading={downloading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}