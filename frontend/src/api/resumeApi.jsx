const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1/resume`;

export async function analyzeResumeApi(file, jdText) {
  const formData = new FormData();
  formData.append("resume_file", file);
  formData.append("jd_text", jdText);

  const response = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Failed to analyze resume");
  }
  return response.json();
}

export async function generatePdfApi(sessionId, approvedMap) {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("replacements_json", JSON.stringify(approvedMap));

  const response = await fetch(`${API_BASE}/generate-pdf`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to generate PDF");
  }
  return response.blob();
}