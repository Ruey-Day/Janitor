import { h, defineTool, store, textarea, input, btn, card, copy, toast, tbl, field, esc, debounce, out, modal } from "../core.js";

const CHEATSHEET = [
  [".", "any char except newline"], ["\\d \\w \\s", "digit · word char · whitespace"], ["\\D \\W \\S", "negations"],
  ["[abc] [^abc]", "set · negated set"], ["a-z", "range inside a set"], ["^ $", "start · end (multiline with m)"],
  ["\\b", "word boundary"], ["* + ?", "0+ · 1+ · 0-1"], ["{n} {n,} {n,m}", "exact / at least / range"],
  ["*? +?", "lazy quantifiers"], ["(abc)", "capture group"], ["(?:abc)", "non-capturing group"],
  ["(?<name>x)", "named group"], ["a|b", "alternation"], ["(?=x) (?!x)", "lookahead · negative"],
  ["(?<=x) (?<!x)", "lookbehind · negative"], ["\\1 $1", "backreference · replacement ref"],
  ["\\p{L}", "unicode property (flag u)"], ["flags g i m s u y", "global · ignorecase · multiline · dotall · unicode · sticky"],
];
const PRESETS = {
  email: "[\\w.+-]+@[\\w-]+\\.[\\w.-]+", url: "https?:\\/\\/[^\\s<>\"']+", ipv4: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b",
  phone: "\\+?\\d[\\d\\s().-]{7,}\\d", hex: "#(?:[0-9a-fA-F]{3}){1,2}\\b", date: "\\d{4}-\\d{2}-\\d{2}",
  time: "\\b\\d{1,2}:\\d{2}(?::\\d{2})?\\b", uuid: "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
  hashtag: "#\\w+", number: "-?\\d+(?:\\.\\d+)?", word: "\\b\\w+\\b", whitespace: "\\s+", "html tag": "<[^>]+>",
};

defineTool({
  id: "regex", name: "Regex Lab", icon: "/·/", cat: "text",
  desc: "Test patterns live with highlighted matches, groups, and replace preview.",
  tags: ["regular expression", "pattern", "match", "replace", "test"],
  mount(root) {
    const pattern = input({ placeholder: "pattern", value: store.get("regex.pattern", "\\b(\\w+)@(\\w+)\\.com\\b"), class: "mono" });
    const flags = input({ placeholder: "flags", value: store.get("regex.flags", "gi"), style: { width: "90px" } });
    const repl = input({ placeholder: "replacement ($1, $<name>)", value: store.get("regex.repl", "") });
    const sample = textarea({ placeholder: "Test string…", style: { minHeight: "160px" } });
    sample.value = store.get("regex.sample", "Contact alice@example.com or bob@test.com — but not carol@site.org.");
    const hl = h("div.out.hl-box");
    const groups = h("div");
    const replOut = h("div.out");
    const summary = h("span.chip");

    function run() {
      store.set("regex.pattern", pattern.value); store.set("regex.flags", flags.value);
      store.set("regex.sample", sample.value); store.set("regex.repl", repl.value);
      hl.classList.remove("err");
      let re;
      try { re = new RegExp(pattern.value, flags.value.includes("g") ? flags.value : flags.value + "g"); }
      catch (e) { hl.classList.add("err"); hl.textContent = e.message; summary.textContent = "invalid"; groups.replaceChildren(); return; }
      const text = sample.value;
      const matches = pattern.value ? [...text.matchAll(re)] : [];
      let html = "", last = 0;
      matches.forEach((m, i) => {
        if (m[0] === "") return;
        html += esc(text.slice(last, m.index)) + `<mark class="hit${i % 2 ? " alt" : ""}">${esc(m[0])}</mark>`;
        last = m.index + m[0].length;
      });
      html += esc(text.slice(last));
      hl.innerHTML = html || "&nbsp;";
      summary.textContent = `${matches.length} match${matches.length === 1 ? "" : "es"}`;
      groups.replaceChildren(tbl(["#", "match", "index", "groups", "named"], matches.slice(0, 200).map((m, i) => [
        i + 1, m[0], m.index, m.slice(1).map((g, k) => `$${k + 1}=${g ?? "∅"}`).join("  ") || "—",
        m.groups ? Object.entries(m.groups).map(([k, v]) => `${k}=${v ?? "∅"}`).join("  ") : "—",
      ])));
      try {
        const re2 = new RegExp(pattern.value, flags.value);
        replOut.textContent = pattern.value ? text.replace(re2, repl.value) : text;
      } catch { replOut.textContent = ""; }
    }
    const upd = debounce(run, 80);
    [pattern, flags, sample, repl].forEach((el) => el.addEventListener("input", upd));

    const presetRow = h("div.row.tight", Object.entries(PRESETS).map(([k, v]) => btn(k, () => { pattern.value = v; run(); }, "ghost sm")));

    root.append(
      h("div.split",
        h("div.col",
          card("Pattern",
            h("div.col",
              h("div.row", h("span.mono", { text: "/" }), h("div", { style: { flex: 1 } }, pattern), h("span.mono", { text: "/" }), flags, summary),
              presetRow),
            [btn("Copy as JS", () => copy(`/${pattern.value}/${flags.value}`), "ghost sm"),
             btn("Cheatsheet", () => modal("Regex cheatsheet", tbl(["token", "meaning"], CHEATSHEET)), "ghost sm")]),
          card("Test string", sample),
          card("Matches", h("div.col", hl, groups))),
        h("div.col",
          card("Replace", h("div.col", field("replacement", repl), replOut), [btn("Copy result", () => copy(replOut.textContent), "ghost sm")]))));
    run();
  },
});
