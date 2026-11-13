function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findPhraseSpan(context, phrase) {
  if (!context || !phrase) return null;

  try {
    const escaped = escapeRegExp(phrase);
    const startsWord = /^[A-Za-z0-9_]/.test(phrase);
    const endsWord = /[A-Za-z0-9_]$/.test(phrase);
    const pattern = new RegExp(
      `${startsWord ? "(?<!\\w)" : ""}${escaped}${endsWord ? "(?!\\w)" : ""}`
    );
    const match = pattern.exec(context);
    if (match) {
      return { start: match.index, end: match.index + match[0].length };
    }
  } catch {
    // Fall back to indexOf if lookbehind is unsupported in an older browser
  }

  const idx = context.indexOf(phrase);
  if (idx !== -1) {
    return { start: idx, end: idx + phrase.length };
  }
  return null;
}

function renderReplacementTokens(text, allowBold) {
  const starCount = (text.match(/\*\*/g) || []).length;
  const canRenderBold =
    allowBold && starCount === 2 && /\*\*[^*]+\*\*/.test(text);

  if (!canRenderBold) {
    return text.replace(/\*\*/g, "");
  }

  return text.split(/(\*\*[^*]+\*\*)/g).map((part, idx) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-emerald-950">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{part.replace(/\*\*/g, "")}</span>;
  });
}

export default function SwapPreviewList({
  swaps,
  atsStats,
  onToggle,
  onEdit,
  onDownload,
  downloadFormat,
}) {
  const activeCount = swaps.filter(
    (s) => s.approved && s.replacement.trim() !== ""
  ).length;
  const isBusy = Boolean(downloadFormat);
  const scoreDelta = atsStats ? atsStats.after - atsStats.before : 0;

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

  const renderBulletPreview = (item) => {
    if (!item.context) return null;

    const span = findPhraseSpan(item.context, item.original);
    if (!span) {
      return (
        <div className="text-xs text-slate-600 bg-white px-3 py-2 rounded border border-slate-200 leading-relaxed">
          {item.context}
        </div>
      );
    }

    const before = item.context.slice(0, span.start);
    const matched = item.context.slice(span.start, span.end);
    const after = item.context.slice(span.end);
    const cleanRepl = item.replacement.replace(/\*\*/g, "").trim();
    const allowBold = item.allow_bold !== false;

    const hasListAndEcho =
      item.approved &&
      /\band\b/i.test(cleanRepl) &&
      /^,\s*and\b/i.test(after);

    return (
      <div className="bg-white px-3 py-2 rounded border border-slate-200 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Live Bullet Preview
          </span>
          <span className="text-[11px] text-slate-400">
            {allowBold
              ? "Tip: wrap 1 keyword in **bold**"
              : "Bold locked in this section"}
          </span>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">
          <span>{before}</span>
          {item.approved && cleanRepl ? (
            <span className="bg-emerald-100/90 text-emerald-900 px-1 py-0.5 rounded border border-emerald-300">
              {renderReplacementTokens(item.replacement, allowBold)}
            </span>
          ) : (
            <span className="underline decoration-slate-400 font-medium text-slate-800">
              {matched}
            </span>
          )}
          <span>{after}</span>
        </p>
        {hasListAndEcho && (
          <p className="text-[11px] text-amber-700">
            Note: Sentence continues with &ldquo;, and ...&rdquo; — consider comma phrasing instead of &ldquo;and&rdquo;.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
      <div>
        {/* Live Deterministic ATS Score Banner */}
        {atsStats && (
          <div className="mb-6 p-4 rounded-lg bg-slate-900 text-white space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-5">
                <div>
                  <span className="text-xs text-slate-400 block">
                    Initial ATS Match
                  </span>
                  <span className="text-xl font-bold text-amber-400">
                    {atsStats.before}%
                  </span>
                </div>
                <span className="text-slate-500 text-lg">→</span>
                <div>
                  <span className="text-xs text-slate-400 block">
                    Live Optimized Match
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xl font-bold ${
                        scoreDelta < 0 ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {atsStats.after}%
                    </span>
                    {scoreDelta !== 0 && (
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                          scoreDelta > 0
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-rose-500/20 text-rose-300"
                        }`}
                      >
                        {scoreDelta > 0 ? `+${scoreDelta}%` : `${scoreDelta}%`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {atsStats.matched?.length > 0 && (
                <span className="text-xs font-mono text-slate-400">
                  {atsStats.matched.length} /{" "}
                  {atsStats.matched.length + (atsStats.missing?.length || 0)}{" "}
                  JD skills matched
                </span>
              )}
            </div>

            {atsStats.gained?.length > 0 && (
              <div className="text-xs text-slate-200 pt-2 border-t border-slate-800">
                <span className="font-semibold text-emerald-400">
                  + Unlocked by Active Swaps:{" "}
                </span>
                {atsStats.gained.join(", ")}
              </div>
            )}

            {atsStats.missing?.length > 0 && (
              <div className="text-xs text-slate-300 pt-2 border-t border-slate-800">
                <span className="font-semibold text-rose-300">
                  Unmapped JD Skills:{" "}
                </span>
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
              Review full bullet context, edit phrasing, or uncheck swaps — ATS score updates live.
            </p>
          </div>
          {swaps.length > 0 && (
            <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md">
              {activeCount} / {swaps.length} active
            </span>
          )}
        </div>

        {swaps.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            Upload your .docx resume and paste a JD to preview exact phrase swaps.
          </div>
        ) : (
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {swaps.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-lg border transition ${
                  item.approved
                    ? "border-slate-200 bg-slate-50/70"
                    : "border-slate-100 bg-slate-100/40 opacity-65"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={item.approved}
                    onChange={() => onToggle(item.id)}
                    aria-label={`Approve replacement for ${item.original}`}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.section && item.section !== "OTHER" && (
                          <span className="text-[11px] font-semibold uppercase tracking-wider bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                            {item.section}
                          </span>
                        )}
                        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                          {item.category}
                        </span>
                      </div>
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
                      className="w-full text-sm bg-emerald-50 text-emerald-900 font-medium px-3 py-1.5 rounded border border-emerald-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:cursor-not-allowed"
                    />

                    {renderBulletPreview(item)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {swaps.length > 0 && (
        <div className="pt-5 mt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            Stateless export — preserves fonts, links & XML runs
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onDownload("docx")}
              disabled={isBusy || activeCount === 0}
              className="py-2.5 px-4 bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 text-slate-800 font-semibold rounded-lg text-sm border border-slate-300 transition cursor-pointer disabled:cursor-not-allowed"
            >
              {downloadFormat === "docx"
                ? "Building .DOCX..."
                : "Download .DOCX"}
            </button>
            <button
              type="button"
              onClick={() => onDownload("pdf")}
              disabled={isBusy || activeCount === 0}
              className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold rounded-lg text-sm transition cursor-pointer disabled:cursor-not-allowed"
            >
              {downloadFormat === "pdf"
                ? "Rendering .PDF..."
                : "Apply & Download .PDF"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}