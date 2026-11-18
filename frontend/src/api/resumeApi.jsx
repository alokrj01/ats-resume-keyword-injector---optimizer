const BASE_URL = (
  import.meta.env.VITE_API_URL || ""
).replace(/\/+$/, "");

const API_BASE = `${BASE_URL}/api/v1/resume`;

async function extractErrorMessage(response, fallbackMessage) {
  try {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const err = await response.json();

      if (typeof err?.detail === "string") {
        return err.detail;
      }

      if (Array.isArray(err?.detail)) {
        return err.detail
          .map((item) => item?.msg || JSON.stringify(item))
          .join("; ");
      }
    } else {
      const text = (await response.text()).trim();

      if (text && !text.startsWith("<")) {
        return text.slice(0, 200);
      }
    }
  } catch {
    // Fall back to the default message below.
  }

  return `${fallbackMessage} (HTTP ${response.status})`;
}

export async function analyzeResumeApi(file, jdText, provider = "auto") {
  const formData = new FormData();

  formData.append("resume_file", file);
  formData.append("jd_text", jdText);
  formData.append("provider", provider);

  const response = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(
      await extractErrorMessage(response, "Failed to analyze resume")
    );
  }

  return response.json();
}

async function requestTailoredDocument(
  endpointPath,
  { resumeFile, sessionId, approvedMap, signal },
  fallbackError
) {
  const formData = new FormData();

  formData.append("replacements_json", JSON.stringify(approvedMap || {}));

  if (resumeFile instanceof Blob) {
    const rawName =
      typeof resumeFile.name === "string" && resumeFile.name.trim()
        ? resumeFile.name.trim()
        : "resume.docx";

    const fileName = rawName.toLowerCase().endsWith(".docx")
      ? rawName
      : `${rawName}.docx`;

    formData.append("resume_file", resumeFile, fileName);
  }

  if (sessionId) {
    formData.append("session_id", sessionId);
  }

  const response = await fetch(`${API_BASE}/${endpointPath}`, {
    method: "POST",
    body: formData,
    signal,
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, fallbackError));
  }

  return response.blob();
}

export async function generatePdfApi({
  resumeFile,
  sessionId,
  approvedMap,
  signal,
}) {
  return requestTailoredDocument(
    "generate-pdf",
    { resumeFile, sessionId, approvedMap, signal },
    "Failed to generate PDF"
  );
}

export async function generateDocxApi({
  resumeFile,
  sessionId,
  approvedMap,
  signal,
}) {
  return requestTailoredDocument(
    "generate-docx",
    { resumeFile, sessionId, approvedMap, signal },
    "Failed to generate DOCX"
  );
}

export async function scoreResumeApi({
  baseResumeText,
  jdSkills,
  approvedMap,
  fallbackBefore = 0,
  fallbackEstimated = 0,
  signal,
}) {
  const response = await fetch(`${API_BASE}/score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      base_resume_text: baseResumeText,
      jd_skills: jdSkills || [],
      replacements: approvedMap || {},
      fallback_score_before: fallbackBefore,
      fallback_score_estimated: fallbackEstimated,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await extractErrorMessage(response, "Failed to refresh ATS score")
    );
  }

  return response.json();
}