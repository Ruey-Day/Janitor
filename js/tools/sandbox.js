import { h, defineTool, store, textarea, btn, card, copy, toast, seg, download, pickFile, readAs, debounce, field, select } from "../core.js";

const STARTER = {
  html: `<main>\n  <h1>Hello, sandbox</h1>\n  <p>Edit HTML, CSS and JS — the preview updates live.</p>\n  <button id="go">Click me</button>\n</main>`,
  css: `body { font-family: system-ui, sans-serif; padding: 2rem; background: #0b1120; color: #dbe6ff; }\nbutton { padding: .6rem 1rem; border: 0; border-radius: 8px; background: #00e5ff; font-weight: 700; cursor: pointer; }`,
  js: `document.getElementById("go").addEventListener("click", () => {\n  console.log("clicked at", new Date().toLocaleTimeString());\n});\nconsole.info("ready");`,
};
const BRIDGE = `<script>(function(){const send=(level,args)=>parent.postMessage({__sandbox:true,level,args:args.map(a=>{try{return typeof a==="string"?a:JSON.stringify(a,null,1)}catch(e){return String(a)}})},"*");["log","info","warn","error","debug"].forEach(l=>{const o=console[l];console[l]=(...a)=>{send(l,a);o.apply(console,a)}});window.addEventListener("error",e=>send("error",[e.message+" ("+e.lineno+":"+e.colno+")"]));window.addEventListener("unhandledrejection",e=>send("error",["unhandled: "+(e.reason&&e.reason.message||e.reason)]));})();</script>`;

defineTool({
  id: "sandbox", name: "Code Sandbox", icon: "▶", cat: "data",
  desc: "Live HTML / CSS / JS playground with a captured console — like a mini CodePen that runs locally.",
  tags: ["html", "css", "javascript", "playground", "codepen", "jsfiddle", "live preview", "console", "run code", "snippet"],
  mount(root) {
    const saved = store.get("sandbox.code", STARTER);
    const ed = { html: textarea({ value: saved.html, spellcheck: "false" }), css: textarea({ value: saved.css, spellcheck: "false" }), js: textarea({ value: saved.js, spellcheck: "false" }) };
    Object.values(ed).forEach((t) => { t.style.minHeight = "200px"; t.style.fontSize = "12.5px"; t.style.border = "0"; t.style.background = "transparent"; t.style.borderRadius = "0"; t.style.tabSize = "2"; t.addEventListener("keydown", (e) => { if (e.key === "Tab") { e.preventDefault(); t.setRangeText("  ", t.selectionStart, t.selectionEnd, "end"); } }); });
    const frame = h("iframe", { sandbox: "allow-scripts allow-modals allow-forms allow-popups", title: "preview", style: { width: "100%", height: "420px", border: "1px solid var(--line)", borderRadius: "12px", background: "#fff" } });
    const consoleBox = h("div.out", { style: { maxHeight: "200px", overflow: "auto", fontSize: "12px", padding: "8px 12px" } });
    const auto = h("input", { type: "checkbox", checked: store.get("sandbox.auto", true) });
    const build = () => `<!doctype html><html><head><meta charset="utf-8">${BRIDGE}<style>${ed.css.value}</style></head><body>${ed.html.value}<script>try{${ed.js.value}\n}catch(e){console.error(e.message)}</script></body></html>`;
    const run = () => { consoleBox.replaceChildren(); frame.srcdoc = build(); store.set("sandbox.code", { html: ed.html.value, css: ed.css.value, js: ed.js.value }); };
    const onMsg = (e) => { if (!e.data?.__sandbox) return; const color = { error: "var(--danger)", warn: "var(--amber)", info: "var(--a1)" }[e.data.level] || "var(--text)"; consoleBox.append(h("div", { style: { color, whiteSpace: "pre-wrap" }, text: `${e.data.level === "log" ? "›" : e.data.level} ${e.data.args.join(" ")}` })); consoleBox.scrollTop = consoleBox.scrollHeight; };
    window.addEventListener("message", onMsg);
    const debounced = debounce(() => auto.checked && run(), 500);
    Object.values(ed).forEach((t) => t.addEventListener("input", debounced));
    auto.addEventListener("change", () => store.set("sandbox.auto", auto.checked));
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); } };
    document.addEventListener("keydown", onKey);

    const layout = seg([["split", "split"], ["stack", "stacked"], ["preview", "preview only"]], (v) => apply(v), store.get("sandbox.layout", "split"));
    const editors = h("div.grid.g3", { style: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } }, card("HTML", ed.html), card("CSS", ed.css), card("JS", ed.js));
    const wrap = h("div.col");
    const apply = (v) => { store.set("sandbox.layout", v); wrap.replaceChildren(); if (v === "split") { wrap.style.display = "grid"; wrap.style.gridTemplateColumns = "minmax(0, 1fr) minmax(0, 1fr)"; editors.style.gridTemplateColumns = "1fr"; wrap.append(editors, h("div.col", frame, consoleBox)); } else if (v === "stack") { wrap.style.display = "flex"; editors.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))"; wrap.append(editors, frame, consoleBox); } else { wrap.style.display = "flex"; frame.style.height = "70vh"; wrap.append(frame, consoleBox); } if (v !== "preview") frame.style.height = "420px"; };

    root.append(
      h("div.row", { style: { marginBottom: "12px" } }, btn("▶ Run  (⌘⏎)", run, "primary sm"), h("label.check", auto, "auto-run"), layout, h("span.spacer"),
        btn("Reset starter", () => { ed.html.value = STARTER.html; ed.css.value = STARTER.css; ed.js.value = STARTER.js; run(); }, "ghost sm"),
        btn("Blank", () => { ed.html.value = ""; ed.css.value = ""; ed.js.value = ""; run(); }, "ghost sm"),
        btn("Open .html", async () => { const f = await pickFile({ accept: ".html,.htm" }); if (!f) return; const t = await readAs.text(f); const doc = new DOMParser().parseFromString(t, "text/html"); ed.css.value = [...doc.querySelectorAll("style")].map((s) => s.textContent).join("\n"); ed.js.value = [...doc.querySelectorAll("script:not([src])")].map((s) => s.textContent).join("\n"); doc.querySelectorAll("style, script").forEach((n) => n.remove()); ed.html.value = doc.body.innerHTML.trim(); run(); }, "ghost sm"),
        btn("Export .html", () => download(`<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>sandbox</title>\n<style>\n${ed.css.value}\n</style>\n</head>\n<body>\n${ed.html.value}\n<script>\n${ed.js.value}\n</script>\n</body>\n</html>`, "sandbox.html", "text/html"), "ghost sm"),
        btn("Copy all", () => copy(build()), "ghost sm"),
        btn("Open in tab", () => { const b = new Blob([build().replace(BRIDGE, "")], { type: "text/html" }); window.open(URL.createObjectURL(b), "_blank"); }, "ghost sm")),
      wrap);
    apply(layout.value);
    run();
    return () => { window.removeEventListener("message", onMsg); document.removeEventListener("keydown", onKey); };
  },
});
