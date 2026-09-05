import { h, defineTool, store, textarea, btn, card, copy, download, seg, tbl, esc, toast } from "../core.js";
import { diffLines, diffWords, diffChars, diffStats, toUnified, similarity } from "../lib/diff.js";

defineTool({
  id: "diff", name: "Text Compare", icon: "⇄", cat: "text",
  desc: "Line, word or character diff between two texts, with unified output.",
  tags: ["diff", "compare", "changes", "patch", "similarity"],
  mount(root) {
    const a = textarea({ placeholder: "Original…", style: { minHeight: "220px" } });
    const b = textarea({ placeholder: "Changed…", style: { minHeight: "220px" } });
    a.value = store.get("diff.a", ""); b.value = store.get("diff.b", "");
    const view = h("div.out", { style: { padding: "6px 0", maxHeight: "60vh", overflow: "auto" } });
    const chips = h("div.row.tight");
    const ignoreCase = h("input", { type: "checkbox" });
    const ignoreWs = h("input", { type: "checkbox" });
    let mode = store.get("diff.mode", "lines");
    let parts = [];

    function run() {
      store.set("diff.a", a.value); store.set("diff.b", b.value); store.set("diff.mode", mode);
      const opts = { ignoreCase: ignoreCase.checked, ignoreWhitespace: ignoreWs.checked };
      parts = mode === "lines" ? diffLines(a.value, b.value, opts) : mode === "words" ? diffWords(a.value, b.value) : diffChars(a.value, b.value);
      const s = diffStats(parts);
      chips.replaceChildren(
        h("span.chip.ok", { text: `+${s.add}` }), h("span.chip.bad", { text: `−${s.del}` }),
        h("span.chip", { text: `${s.same} unchanged` }), h("span.chip", { text: `${similarity(parts)}% similar` }));
      view.replaceChildren();
      if (mode === "lines") {
        let la = 0, lb = 0;
        for (const p of parts) {
          if (p.type !== "add") la++;
          if (p.type !== "del") lb++;
          view.append(h("div.diff-line", { class: p.type === "same" ? "" : p.type },
            h("span.dn", { text: p.type === "add" ? "" : la }),
            h("span.dn", { text: p.type === "del" ? "" : lb }),
            h("span.dm", { text: p.type === "add" ? "+" : p.type === "del" ? "−" : " " }),
            h("span", { text: p.value })));
        }
      } else {
        const inline = h("div", { style: { padding: "8px 12px", whiteSpace: "pre-wrap", fontFamily: "var(--mono)", fontSize: "12.5px" } });
        for (const p of parts)
          inline.append(p.type === "same" ? document.createTextNode(p.value)
            : h(p.type === "add" ? "ins" : "del", { style: { background: p.type === "add" ? "color-mix(in srgb, var(--lime) 25%, transparent)" : "color-mix(in srgb, var(--danger) 25%, transparent)", textDecoration: p.type === "del" ? "line-through" : "none", borderRadius: "3px" }, text: p.value }));
        view.append(inline);
      }
    }
    [a, b].forEach((t) => t.addEventListener("input", run));
    [ignoreCase, ignoreWs].forEach((c) => c.addEventListener("change", run));

    root.append(
      h("div.grid.g2",
        card("Original", a, [btn("Clear", () => { a.value = ""; run(); }, "ghost sm danger")]),
        card("Changed", b, [btn("Swap ⇄", () => { [a.value, b.value] = [b.value, a.value]; run(); }, "ghost sm"), btn("Format JSON both", () => { try { a.value = JSON.stringify(JSON.parse(a.value), null, 2); b.value = JSON.stringify(JSON.parse(b.value), null, 2); run(); } catch { toast("one side is not valid JSON", "bad"); } }, "ghost sm"), btn("Sort lines both", () => { a.value = a.value.split("\n").sort().join("\n"); b.value = b.value.split("\n").sort().join("\n"); run(); }, "ghost sm"), btn("Clear", () => { b.value = ""; run(); }, "ghost sm danger")])),
      h("div", { style: { marginTop: "14px" } },
        card("Diff",
          h("div.col",
            h("div.row",
              seg([["lines", "lines"], ["words", "words"], ["chars", "chars"]], (v) => { mode = v; run(); }, mode),
              h("label.check", ignoreCase, "ignore case"), h("label.check", ignoreWs, "ignore whitespace"), chips),
            view),
          [btn("Copy unified", () => copy(toUnified(parts)), "ghost sm"), btn("Save .diff", () => download(toUnified(parts), "changes.diff"), "ghost sm")])));
    run();
  },
});
