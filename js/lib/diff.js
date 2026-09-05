/* Line / word diff via LCS, with common prefix-suffix trimming. */
"use strict";

function lcsMatrix(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  return dp;
}

/** -> [{type:'same'|'add'|'del', value, aIndex, bIndex}] */
export function diff(a, b) {
  const out = [];
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length, endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  for (let i = 0; i < start; i++) out.push({ type: "same", value: a[i], aIndex: i, bIndex: i });

  const midA = a.slice(start, endA), midB = b.slice(start, endB);
  if (midA.length * midB.length > 4000000) {
    // too large for the DP table -- fall back to a blunt replace block
    midA.forEach((v, i) => out.push({ type: "del", value: v, aIndex: start + i }));
    midB.forEach((v, i) => out.push({ type: "add", value: v, bIndex: start + i }));
  } else {
    const dp = lcsMatrix(midA, midB);
    let i = 0, j = 0;
    while (i < midA.length && j < midB.length) {
      if (midA[i] === midB[j]) { out.push({ type: "same", value: midA[i], aIndex: start + i, bIndex: start + j }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: "del", value: midA[i], aIndex: start + i }); i++; }
      else { out.push({ type: "add", value: midB[j], bIndex: start + j }); j++; }
    }
    while (i < midA.length) { out.push({ type: "del", value: midA[i], aIndex: start + i }); i++; }
    while (j < midB.length) { out.push({ type: "add", value: midB[j], bIndex: start + j }); j++; }
  }
  for (let k = 0; k < a.length - endA; k++)
    out.push({ type: "same", value: a[endA + k], aIndex: endA + k, bIndex: endB + k });
  return out;
}

export function diffLines(a, b, { ignoreCase = false, ignoreWhitespace = false } = {}) {
  const split = (s) => String(s).replace(/\r\n?/g, "\n").split("\n");
  const norm = (s) => {
    let v = s;
    if (ignoreWhitespace) v = v.replace(/\s+/g, " ").trim();
    if (ignoreCase) v = v.toLowerCase();
    return v;
  };
  const A = split(a), B = split(b);
  return diff(A.map(norm), B.map(norm)).map((d) => ({
    ...d,
    value: d.type === "add" ? B[d.bIndex] : A[d.aIndex],
  }));
}

export const diffWords = (a, b) =>
  diff(String(a).split(/(\s+)/).filter(Boolean), String(b).split(/(\s+)/).filter(Boolean));

export const diffChars = (a, b) => diff([...String(a)], [...String(b)]);

export function diffStats(parts) {
  return parts.reduce((acc, p) => { acc[p.type]++; return acc; }, { same: 0, add: 0, del: 0 });
}

/** Unified-diff text with context. */
export function toUnified(parts, aName = "original", bName = "changed") {
  let out = "--- " + aName + "\n+++ " + bName + "\n";
  for (const p of parts) out += (p.type === "add" ? "+" : p.type === "del" ? "-" : " ") + p.value + "\n";
  return out;
}

/** Percent similarity 0-100 based on matched tokens. */
export function similarity(parts) {
  const s = diffStats(parts);
  const total = s.same + s.add + s.del;
  return total ? Math.round((s.same * 100) / total) : 100;
}
