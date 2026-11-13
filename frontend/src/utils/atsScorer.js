function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAsciiWordChar(ch) {
  if (!ch) return false;
  const c = ch.charCodeAt(0);
  return (
    (c >= 97 && c <= 122) ||
    (c >= 65 && c <= 90) ||
    (c >= 48 && c <= 57) ||
    c === 95
  );
}

export function matchesSkillSpec(text, spec) {
  const normText = String(text || "").replace(/\s+/g, " ");
  if (!normText || !spec || !Array.isArray(spec.aliases)) return false;

  const flags = spec.case_sensitive ? "" : "i";

  for (const rawAlias of spec.aliases) {
    const cleaned = String(rawAlias || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) continue;

    const escaped = escapeRegExp(cleaned).replace(/\\ /g, "\\s+");
    const left = isAsciiWordChar(cleaned[0])
      ? "(?:^|[^A-Za-z0-9_])"
      : "(?:^|[^A-Za-z0-9_.])";
    const right = "(?![A-Za-z0-9_+#])";

    let excl = "";
    if (
      Array.isArray(spec.exclude_followers) &&
      spec.exclude_followers.length > 0
    ) {
      const joined = spec.exclude_followers
        .filter(Boolean)
        .map((w) => escapeRegExp(String(w)))
        .join("|");
      if (joined) {
        excl = `(?!\\s+(?:${joined})(?![A-Za-z0-9_]))`;
      }
    }

    try {
      const pattern = new RegExp(`${left}(?:${escaped})${right}${excl}`, flags);
      if (pattern.test(normText)) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

function findWordBoundedSpans(line, phrase) {
  const spans = [];
  if (!line || !phrase) return spans;

  const checkLeft = isAsciiWordChar(phrase[0]);
  const checkRight = isAsciiWordChar(phrase[phrase.length - 1]);

  let searchFrom = 0;
  while (searchFrom <= line.length - phrase.length) {
    const idx = line.indexOf(phrase, searchFrom);
    if (idx === -1) break;

    const end = idx + phrase.length;
    const leftOk = !checkLeft || idx === 0 || !isAsciiWordChar(line[idx - 1]);
    const rightOk =
      !checkRight || end === line.length || !isAsciiWordChar(line[end]);

    if (leftOk && rightOk) {
      spans.push([idx, end]);
      searchFrom = end;
    } else {
      searchFrom = idx + 1;
    }
  }
  return spans;
}

export function applySwapsToText(baseText, swaps) {
  if (!baseText || !Array.isArray(swaps) || swaps.length === 0) {
    return baseText || "";
  }

  const approvedMap = new Map();
  for (const s of swaps) {
    if (!s?.approved) continue;
    const orig = String(s.original || "").trim();
    const repl = String(s.replacement || "")
      .replace(/\*\*/g, "")
      .trim();
    if (orig && repl) {
      approvedMap.set(orig, repl);
    }
  }

  if (approvedMap.size === 0) {
    return baseText;
  }

  const sortedPairs = Array.from(approvedMap.entries()).sort(
    (a, b) => b[0].length - a[0].length
  );

  return baseText
    .split(/\r?\n/)
    .map((line) => {
      if (!line) return line;

      const planned = [];
      for (const [oldText, newText] of sortedPairs) {
        if (!line.includes(oldText)) continue;
        for (const [s, e] of findWordBoundedSpans(line, oldText)) {
          const overlaps = planned.some(([ps, pe]) => !(e <= ps || s >= pe));
          if (!overlaps) {
            planned.push([s, e, newText]);
          }
        }
      }

      if (planned.length === 0) return line;

      planned.sort((a, b) => b[0] - a[0]);
      let updated = line;
      for (const [s, e, newText] of planned) {
        updated = updated.slice(0, s) + newText + updated.slice(e);
      }
      return updated;
    })
    .join("\n");
}

export function computeLiveAtsStats(
  baseResumeText,
  jdSkills,
  swaps,
  fallbackStats = null
) {
  if (!Array.isArray(jdSkills) || jdSkills.length === 0 || !baseResumeText) {
    return fallbackStats;
  }

  const optimizedText = applySwapsToText(baseResumeText, swaps);
  const total = jdSkills.length;

  const beforeSet = new Set();
  for (const spec of jdSkills) {
    if (matchesSkillSpec(baseResumeText, spec)) {
      beforeSet.add(spec.skill);
    }
  }

  const matched = [];
  const gained = [];
  const missing = [];

  for (const spec of jdSkills) {
    if (matchesSkillSpec(optimizedText, spec)) {
      matched.push(spec.skill);
      if (!beforeSet.has(spec.skill)) {
        gained.push(spec.skill);
      }
    } else {
      missing.push(spec.skill);
    }
  }

  const before = Math.round((beforeSet.size * 100) / total);
  const after = Math.round((matched.length * 100) / total);

  return {
    before,
    after,
    matched,
    gained,
    missing,
  };
}