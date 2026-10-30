import React from "react";

export default function UploadForm({
  resumeFile,
  onFileChange,
  onClearSavedResume,
  keepResume,
  setKeepResume,
  fileInputRef,
  jdText,
  setJdText,
  onAnalyze,
  loading,
}) {



  return (
    <form
      onSubmit={onAnalyze}
      className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-5 h-fit"
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-semibold text-slate-700">
            1. Base Resume (.docx)
          </label>
          {resumeFile && (
            <button
              type="button"
              onClick={onClearSavedResume}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
            >
              Remove File
            </button>
          )}
        </div>

        {resumeFile && (
          <div className="mb-2.5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800">
            <span className="truncate font-medium">
              Active Resume: <strong>{resumeFile.name}</strong>
            </span>
            {keepResume && (
              <span className="ml-2 px-1.5 py-0.5 bg-emerald-200/70 text-emerald-900 rounded text-[10px] font-semibold shrink-0">
                Saved
              </span>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".docx"
          onChange={(e) => onFileChange(e.target.files[0] || null)}
          className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
          required={!resumeFile}
        />

        <label className="flex items-center gap-2 mt-2.5 text-xs text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={keepResume}
            onChange={(e) => setKeepResume(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          Keep Base Resume saved for next Job Descriptions
        </label>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          2. AI Provider
        </label>
        <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Google Gemini
          <p className="mt-1 text-xs text-slate-500">
            API key and model are configured securely in the backend environment.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          3. Target Job Description
        </label>
        <textarea
          rows={10}
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="Paste the job requirements, tech stack, and responsibilities..."
          className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading || !resumeFile || !jdText.trim()}
        className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded-lg text-sm transition"
      >
        {loading ? `Analyzing with Gemini...` : "Analyze & Map Keywords"}
      </button>
    </form>
  );
}