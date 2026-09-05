import { h, defineTool, store, debounce, textarea, btn, stat, card, copy, readClipboard, toast, download, num, bytes, tbl, subtabs, field, input, select, pickFile, readAs, out } from "../core.js";
import { words, sentences, paragraphs, readability, fleschLabel, frequency, charFrequency } from "../lib/textkit.js";

defineTool({
  id: "text", name: "Text Metrics", icon: "≡", cat: "text",
  desc: "Live counts, readability scores, reading time and word frequency.",
  tags: ["count", "words", "characters", "readability", "flesch", "frequency", "reading time"],
  mount(root) {
    const ta = textarea({ id: "text-input", placeholder: "Paste or type anything…\n\nMetrics update live. Nothing leaves this tab.", style: { minHeight: "46vh", border: 0, background: "transparent", borderRadius: 0 } });
    ta.value = store.get("text.buffer", "");

    const stats = {
      chars: stat("Characters", 0, "including whitespace", "cyan"),
      nws: stat("Characters", 0, "without whitespace", "magenta"),
      words: stat("Words", 0, "whitespace separated", "violet"),
      unique: stat("Unique words", 0, "case-insensitive", "lime"),
      lines: stat("Lines", 0, "newline separated", "amber"),
      sentences: stat("Sentences", 0, "by . ! ?", "cyan"),
      paragraphs: stat("Paragraphs", 0, "blank-line separated", "magenta"),
      bytes: stat("Size", "0 B", "UTF-8 encoded", "violet"),
      read: stat("Reading time", "0s", "at 230 wpm", "lime"),
      speak: stat("Speaking time", "0s", "at 150 wpm", "amber"),
      avgw: stat("Avg word length", 0, "characters", "cyan"),
      longest: stat("Longest word", "—", "", "magenta"),
    };
    const readOut = h("div.kv-list");
    const limits = h("div.row.tight");
    const LIMITS = [["tweet / X", 280], ["SMS", 160], ["Instagram caption", 2200], ["meta description", 155], ["title tag", 60], ["LinkedIn post", 3000], ["YouTube title", 100], ["Discord message", 2000], ["git subject", 50], ["Bluesky", 300]];
    const renderLimits = (n) => limits.replaceChildren(...LIMITS.map(([k, max]) => h("span.chip", { class: n > max ? "bad" : n > max * 0.9 ? "warn" : "", text: `${k} ${n}/${max}` })));
    const freqBody = h("div");
    const charBody = h("div");
    const minLen = input({ type: "number", value: store.get("text.minlen", 1), min: 1, style: { width: "80px" } });
    const stopWords = h("input", { type: "checkbox", checked: store.get("text.stop", true) });

    const fmtTime = (mins) => {
      const s = Math.round(mins * 60);
      if (s < 60) return s + "s";
      const m = Math.floor(s / 60), r = s % 60;
      return m < 60 ? `${m}m ${r}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
    };

    function update() {
      const text = ta.value;
      store.set("text.buffer", text);
      const w = words(text);
      const chars = [...text].length;
      stats.chars.set(num(chars));
      stats.nws.set(num([...text.replace(/\s/g, "")].length));
      stats.words.set(num(w.length));
      stats.unique.set(num(new Set(w.map((x) => x.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""))).size));
      stats.lines.set(num(text === "" ? 0 : text.split(/\r\n|\r|\n/).length));
      stats.sentences.set(num(sentences(text).length));
      stats.paragraphs.set(num(paragraphs(text).length));
      stats.bytes.set(bytes(new TextEncoder().encode(text).length));
      stats.read.set(fmtTime(w.length / 230));
      stats.speak.set(fmtTime(w.length / 150));
      stats.avgw.set(w.length ? (w.reduce((n, x) => n + x.length, 0) / w.length).toFixed(1) : 0);
      stats.longest.set(w.length ? w.reduce((a, b) => (b.length > a.length ? b : a)).slice(0, 24) : "—");
      renderLimits(chars);
      renderReadability(text);
      renderFreq(text);
    }
    function renderReadability(text) {
      readOut.replaceChildren();
      if (!text.trim()) return;
      const r = readability(text);
      const rows = [
        ["Flesch reading ease", `${r.flesch} · ${fleschLabel(r.flesch)}`],
        ["Flesch–Kincaid grade", r.fleschKincaid],
        ["Gunning fog", r.fog],
        ["SMOG", r.smog ?? "needs 3+ sentences"],
        ["Coleman–Liau", r.coleman],
        ["ARI", r.ari],
        ["Syllables", num(r.syllables)],
        ["Complex words (3+ syl)", num(r.complexWords)],
        ["Avg sentence length", r.avgSentenceLen + " words"],
      ];
      readOut.append(...rows.map(([k, v]) => h("div.kv", h("b", { text: k }), h("span", { text: String(v) }))));
    }
    function renderFreq(text) {
      freqBody.replaceChildren();
      charBody.replaceChildren();
      if (!text.trim()) return;
      const f = frequency(text, { minLen: +minLen.value || 1, stop: stopWords.checked }).slice(0, 60);
      const total = f.reduce((n, [, c]) => n + c, 0) || 1;
      freqBody.append(tbl(["word", "count", "share"], f.map(([w, c]) => [w, num(c), ((c / total) * 100).toFixed(1) + "%"])));
      const cf = charFrequency(text).filter(([c]) => c.trim()).slice(0, 40);
      charBody.append(tbl(["char", "code", "count"], cf.map(([c, n]) => [c, "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0"), num(n)])));
    }
    const upd = debounce(update, 90);
    ta.addEventListener("input", upd);
    minLen.addEventListener("input", () => { store.set("text.minlen", +minLen.value); upd(); });
    stopWords.addEventListener("change", () => { store.set("text.stop", stopWords.checked); upd(); });

    const actions = [
      btn("Paste", async () => { const t = await readClipboard(); if (t != null) { ta.value += t; update(); } }, "ghost sm"),
      btn("Copy", () => copy(ta.value), "ghost sm"),
      btn("Open file", async () => { const f = await pickFile({ accept: "text/*,.md,.json,.csv,.log,.js,.ts,.html,.css" }); if (f) { ta.value = await readAs.text(f); update(); toast(`loaded ${f.name}`); } }, "ghost sm"),
      btn("Save .txt", () => download(ta.value, "trinketlab.txt"), "ghost sm"),
      btn("Clear", () => { ta.value = ""; update(); ta.focus(); }, "ghost sm danger"),
    ];

    const onFile = async (e) => { ta.value = await readAs.text(e.detail); update(); toast(`loaded ${e.detail.name}`); };
    document.addEventListener("trinket:file", onFile);
    if (window.__pendingFile && !window.__pendingFile.type.startsWith("image/")) {
      const f = window.__pendingFile; window.__pendingFile = null; onFile({ detail: f });
    }

    root.append(
      h("div.split",
        h("div.col",
          card("Input buffer", h("div.col", { style: { gap: 0 } }, ta, h("div", { style: { padding: "8px 14px", borderTop: "1px solid var(--line)" } }, limits)), actions),
          card("Analysis", subtabs([
            { id: "read", label: "Readability", render: () => readOut },
            { id: "freq", label: "Word frequency", render: () => h("div.col", h("div.row", field("min length", minLen), h("label.check", stopWords, "hide stop words")), freqBody) },
            { id: "chars", label: "Characters", render: () => charBody },
          ], { remember: "text.tab" }))),
        h("div.stat-grid", { style: { gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" } }, Object.values(stats))));
    update();
    return () => document.removeEventListener("trinket:file", onFile);
  },
});
