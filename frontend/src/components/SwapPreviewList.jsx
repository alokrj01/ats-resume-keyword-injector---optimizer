import React from "react";

export default function SwapPreviewList({
  swaps,
  atsStats,
  onToggle,
  onEdit,
  onDownload,
  downloading,
}) {
  const getLengthBadge = (orig, repl) => {
    const cleanRepl = repl.replace(/\*\*/g, "");
    const diff = cleanRepl.length - orig.length;
    const pct = orig.length > 0 ? Math.abs(diff / orig.length) * 100 : 0;
    const isSafe = pct <= 12;

    return (
      <span
        className={`text-xs font-mono px-2 py-0.5 rounded-full ${
          isSafe
            ? "bg-emerald-100 text-emerald-800"
            : "bg-amber-100 text-amber-800"
        }`}
      >
        {diff > 0 ? `+${diff}` : diff} chars{" "}
        {isSafe ? "(Layout Safe)" : "(May Wrap Line)"}
      </span>
    );
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
      <div>
        {/* ATS Score Banner */}
        {atsStats && (
          <div className="mb-6 p-4 rounded-lg bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-xs text-slate-400 block">Initial ATS Match</span>
                <span className="text-xl font-bold text-amber-400">
                  {atsStats.before}%
                </span>
              </div>
              <span className="text-slate-500 text-lg">→</span>
              <div>
                <span className="text-xs text-slate-400 block">Optimized Match</span>
                <span className="text-xl font-bold text-emerald-400">
                  {atsStats.after}%
                </span>
              </div>
            </div>

            {atsStats.missing?.length > 0 && (
              <div className="text-xs text-slate-300">
                <span className="font-semibold text-rose-300">Unmapped JD Skills: </span>
                {atsStats.missing.join(", ")}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Keyword Replacement Queue
            </h2>
            <p className="text-xs text-slate-500">
              Review, edit, or uncheck replacements before rendering your PDF.
            </p>
          </div>
          {swaps.length > 0 && (
            <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md">
              {swaps.filter((s) => s.approved).length} / {swaps.length} active
            </span>
          )}
        </div>

        {swaps.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            Upload your .docx resume and paste a JD to preview exact phrase swaps.
          </div>
        ) : (
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {swaps.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-lg border transition ${
                  item.approved
                    ? "border-slate-200 bg-slate-50/70"
                    : "border-slate-100 bg-slate-100/40 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={item.approved}
                    onChange={() => onToggle(item.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                        {item.category}
                      </span>
                      {getLengthBadge(item.original, item.replacement)}
                    </div>

                    <div className="text-sm bg-rose-50 text-rose-800 px-3 py-1.5 rounded border border-rose-200 line-through">
                      {item.original}
                    </div>

                    <input
                      type="text"
                      value={item.replacement}
                      onChange={(e) => onEdit(item.id, e.target.value)}
                      disabled={!item.approved}
                      className="w-full text-sm bg-emerald-50 text-emerald-900 font-medium px-3 py-1.5 rounded border border-emerald-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {swaps.length > 0 && (
        <div className="pt-5 mt-6 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Formatting & fonts locked via XML run preservation
          </span>
          <button
            onClick={onDownload}
            disabled={downloading || swaps.filter((s) => s.approved).length === 0}
            className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold rounded-lg text-sm transition"
          >
            {downloading ? "Rendering PDF..." : "Apply & Download PDF"}
          </button>
        </div>
      )}
    </div>
  );
}