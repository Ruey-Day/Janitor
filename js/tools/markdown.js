import { h, defineTool, store, textarea, btn, card, copy, download, toast, seg, debounce, pickFile, readAs } from "../core.js";
import { render, toText, outline } from "../lib/markdown.js";
import { htmlToMarkdown } from "./code.js";
import { words } from "../lib/textkit.js";

const SAMPLE = `# Markdown Studio

Write on the left, preview on the right. **Bold**, *italic*, ~~strike~~, \`code\`.

## Lists
- one
- two
  - nested
- [x] task done
- [ ] task open

1. first
2. second

> Blockquotes work too.

\`\`\`js
const answer = 6 * 7;
\`\`\`

| column | value |
|--------|------:|
| alpha  |     1 |
| beta   |    22 |

[a link](https://example.com) · https://autolinks.work

---
`;

defineTool({
  id: "markdown", name: "Markdown Studio", icon: "M↓", cat: "text",
  desc: "Live Markdown preview with outline, export to HTML, and stats.",
  tags: ["markdown", "md", "preview", "html", "readme"],
  mount(root) {
    const src = textarea({ placeholder: "# Start writing…", style: { minHeight: "62vh", border: 0, background: "transparent", borderRadius: 0 } });
    src.value = store.get("md.src", SAMPLE);
    const preview = h("div.md-body", { style: { padding: "4px 18px 18px" } });
    const toc = h("div.col", { style: { gap: "4px" } });
    const meta = h("span.chip");
    let view = "split";
    const wrap = h("div.grid.g2");

    function run() {
      store.set("md.src", src.value);
      preview.innerHTML = render(src.value);
      const o = outline(src.value);
      toc.replaceChildren(...o.map((x) => h("div", { style: { paddingLeft: (x.level - 1) * 12 + "px", fontSize: "12px", color: x.level === 1 ? "var(--text-hi)" : "var(--muted)" }, text: x.text })));
      const w = words(toText(src.value)).length;
      meta.textContent = `${w} words · ${Math.max(1, Math.round(w / 230))} min read · ${o.length} headings`;
    }
    src.addEventListener("input", debounce(run, 90));
    src.addEventListener("keydown", (e) => {
      if (e.key === "Tab") { e.preventDefault(); const s = src.selectionStart; src.setRangeText("  ", s, src.selectionEnd, "end"); run(); }
    });

    const exportHtml = () => download(`<!doctype html><meta charset="utf-8"><title>export</title><style>body{font-family:system-ui;max-width:760px;margin:40px auto;line-height:1.6;padding:0 20px}pre{background:#f4f4f6;padding:12px;border-radius:8px;overflow:auto}code{font-family:ui-monospace,monospace}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px 10px}blockquote{border-left:3px solid #999;margin:0;padding-left:14px;color:#555}</style>\n${render(src.value)}`, "document.html", "text/html");

    const editor = card("Editor", src, [
      btn("Open .md", async () => { const f = await pickFile({ accept: ".md,.markdown,text/markdown,text/plain" }); if (f) { src.value = await readAs.text(f); run(); } }, "ghost sm"),
      btn("Save .md", () => download(src.value, "document.md", "text/markdown"), "ghost sm"),
      btn("Paste HTML → MD", async () => { try { const items = await navigator.clipboard.read(); for (const it of items) if (it.types.includes("text/html")) { const html = await (await it.getType("text/html")).text(); src.value = htmlToMarkdown(html); run(); return toast("converted rich text to markdown", "ok"); } toast("clipboard has no HTML — use Code Tools for pasted source", "bad"); } catch { toast("clipboard read blocked", "bad"); } }, "ghost sm"),
      btn("Clear", () => { src.value = ""; run(); }, "ghost sm danger"),
    ]);
    const previewCard = card("Preview", preview, [
      meta,
      btn("Copy HTML", () => copy(render(src.value)), "ghost sm"),
      btn("Copy plain text", () => copy(toText(src.value)), "ghost sm"),
      btn("Export .html", exportHtml, "ghost sm"),
      btn("Print / PDF", () => { const w = window.open("", "_blank"); w.document.write(`<!doctype html><meta charset="utf-8"><title>print</title><style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;line-height:1.6;padding:0 20px}pre{background:#f4f4f6;padding:12px;border-radius:8px;overflow:auto;font-size:12px}code{font-family:ui-monospace,monospace}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:6px 10px}blockquote{border-left:3px solid #999;margin:0;padding-left:14px;color:#555}img{max-width:100%}</style>${render(src.value)}`); w.document.close(); setTimeout(() => w.print(), 300); }, "ghost sm"),
    ]);
    const tocCard = card("Outline", toc);

    const layout = () => {
      wrap.replaceChildren();
      wrap.style.gridTemplateColumns = view === "split" ? "" : "1fr";
      if (view !== "preview") wrap.append(editor);
      if (view !== "editor") wrap.append(previewCard);
    };
    root.append(
      h("div.row", { style: { marginBottom: "12px" } }, seg([["split", "split"], ["editor", "editor"], ["preview", "preview"]], (v) => { view = v; layout(); }, view)),
      wrap,
      h("div", { style: { marginTop: "14px" } }, tocCard));
    layout();
    run();
  },
});
