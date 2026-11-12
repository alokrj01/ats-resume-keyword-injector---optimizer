const BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
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
    // Fall back to default message below
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

export async function generatePdfApi(sessionId, approvedMap) {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("replacements_json", JSON.stringify(approvedMap));

  const response = await fetch(`${API_BASE}/generate-pdf`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(
      await extractErrorMessage(response, "Failed to generate PDF")
    );
  }
  return response.blob();
}