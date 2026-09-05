/* Text analysis + transformation helpers. */
"use strict";

export const words = (t) => (t.trim() ? t.trim().split(/\s+/) : []);
export const sentences = (t) => t.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim());
export const paragraphs = (t) => t.split(/\n\s*\n/).filter((p) => p.trim());

export function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const stripped = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = stripped.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function readability(text) {
  const w = words(text), s = sentences(text);
  const W = w.length || 1, S = s.length || 1;
  const syl = w.reduce((n, x) => n + syllables(x), 0);
  const complex = w.filter((x) => syllables(x) >= 3).length;
  const chars = text.replace(/\s/g, "").length;
  const flesch = 206.835 - 1.015 * (W / S) - 84.6 * (syl / W);
  const fk = 0.39 * (W / S) + 11.8 * (syl / W) - 15.59;
  const fog = 0.4 * (W / S + 100 * (complex / W));
  const ari = 4.71 * (chars / W) + 0.5 * (W / S) - 21.43;
  const cli = 0.0588 * ((chars / W) * 100) - 0.296 * ((S / W) * 100) - 15.8;
  const smog = S >= 3 ? 1.043 * Math.sqrt(complex * (30 / S)) + 3.1291 : NaN;
  return {
    syllables: syl, complexWords: complex,
    flesch: +flesch.toFixed(1), fleschKincaid: +fk.toFixed(1), fog: +fog.toFixed(1),
    ari: +ari.toFixed(1), coleman: +cli.toFixed(1), smog: Number.isFinite(smog) ? +smog.toFixed(1) : null,
    avgWordLen: +(chars / W).toFixed(2), avgSentenceLen: +(W / S).toFixed(2),
  };
}
export const fleschLabel = (f) =>
  f >= 90 ? "very easy (5th grade)" : f >= 80 ? "easy (6th)" : f >= 70 ? "fairly easy (7th)" : f >= 60 ? "plain (8-9th)"
  : f >= 50 ? "fairly hard (10-12th)" : f >= 30 ? "hard (college)" : "very hard (graduate)";

export function frequency(text, { minLen = 1, stop = false } = {}) {
  const STOP = new Set("the a an and or but of to in on at for with by from as is are was were be been it its this that these those i you he she we they them his her their our your not no so if then than too very can will just do does did has have had".split(" "));
  const map = new Map();
  for (const raw of text.toLowerCase().match(/[\p{L}\p{N}'’-]+/gu) || []) {
    const w = raw.replace(/^['’-]+|['’-]+$/g, "");
    if (w.length < minLen || (stop && STOP.has(w))) continue;
    map.set(w, (map.get(w) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
export function charFrequency(text) {
  const map = new Map();
  for (const c of text) map.set(c, (map.get(c) || 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

/* ── case conversions ───────────────────────────────────── */
const splitWords = (s) =>
  s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9À-ɏ]+/).filter(Boolean);
export const CASES = {
  upper: (s) => s.toUpperCase(),
  lower: (s) => s.toLowerCase(),
  title: (s) => s.toLowerCase().replace(/(^|\s|[-("'])(\p{L})/gu, (m, p, c) => p + c.toUpperCase()),
  sentence: (s) => s.toLowerCase().replace(/(^\s*\p{L}|[.!?]\s+\p{L})/gu, (c) => c.toUpperCase()),
  camel: (s) => splitWords(s).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join(""),
  pascal: (s) => splitWords(s).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(""),
  snake: (s) => splitWords(s).map((w) => w.toLowerCase()).join("_"),
  screaming: (s) => splitWords(s).map((w) => w.toUpperCase()).join("_"),
  kebab: (s) => splitWords(s).map((w) => w.toLowerCase()).join("-"),
  train: (s) => splitWords(s).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("-"),
  dot: (s) => splitWords(s).map((w) => w.toLowerCase()).join("."),
  path: (s) => splitWords(s).map((w) => w.toLowerCase()).join("/"),
  toggle: (s) => [...s].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join(""),
  alternating: (s) => [...s].map((c, i) => (i % 2 ? c.toUpperCase() : c.toLowerCase())).join(""),
  random: (s) => [...s].map((c) => (Math.random() < 0.5 ? c.toUpperCase() : c.toLowerCase())).join(""),
};

export const slugify = (s) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/* ── line operations ────────────────────────────────────── */
export const LINE_OPS = {
  sortAZ: (ls) => [...ls].sort((a, b) => a.localeCompare(b)),
  sortZA: (ls) => [...ls].sort((a, b) => b.localeCompare(a)),
  sortNum: (ls) => [...ls].sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)),
  sortLen: (ls) => [...ls].sort((a, b) => a.length - b.length),
  reverse: (ls) => [...ls].reverse(),
  shuffle: (ls) => { const a = [...ls]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  dedupe: (ls) => [...new Set(ls)],
  dedupeCI: (ls) => { const seen = new Set(); return ls.filter((l) => { const k = l.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }); },
  trim: (ls) => ls.map((l) => l.trim()),
  removeEmpty: (ls) => ls.filter((l) => l.trim()),
  number: (ls) => ls.map((l, i) => `${String(i + 1).padStart(String(ls.length).length, " ")}  ${l}`),
  unnumber: (ls) => ls.map((l) => l.replace(/^\s*\d+[.)]?\s+/, "")),
  reverseEach: (ls) => ls.map((l) => [...l].reverse().join("")),
  join: (ls) => [ls.join(", ")],
  quote: (ls) => ls.map((l) => JSON.stringify(l)),
  bullets: (ls) => ls.map((l) => (l.trim() ? "- " + l.trim() : l)),
  collapseSpaces: (ls) => ls.map((l) => l.replace(/[ \t]+/g, " ")),
  stripHtml: (ls) => ls.map((l) => l.replace(/<[^>]*>/g, "")),
  onlyDupes: (ls) => { const c = new Map(); ls.forEach((l) => c.set(l, (c.get(l) || 0) + 1)); return [...c].filter(([, n]) => n > 1).map(([l]) => l); },
};

export function wrapText(text, width = 80) {
  return text.split("\n").map((para) => {
    const out = [];
    let line = "";
    for (const w of para.split(/\s+/)) {
      if (!w) continue;
      if ((line + " " + w).trim().length > width && line) { out.push(line); line = w; }
      else line = (line + " " + w).trim();
    }
    if (line) out.push(line);
    return out.join("\n");
  }).join("\n");
}

const LOREM = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum".split(" ");
export function lorem({ paragraphs: n = 3, sentencesPer = 5, startClassic = true } = {}) {
  const pick = () => LOREM[Math.floor(Math.random() * LOREM.length)];
  const sentence = () => {
    const len = 6 + Math.floor(Math.random() * 10);
    const ws = Array.from({ length: len }, pick);
    return ws[0][0].toUpperCase() + ws[0].slice(1) + " " + ws.slice(1).join(" ") + ".";
  };
  const paras = Array.from({ length: n }, (_, i) => {
    const ss = Array.from({ length: sentencesPer }, sentence);
    if (i === 0 && startClassic) ss[0] = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
    return ss.join(" ");
  });
  return paras.join("\n\n");
}

export const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const unescapeHtml = (s) => { const t = document.createElement("textarea"); t.innerHTML = s; return t.value; };
