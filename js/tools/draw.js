import { h, defineTool, store, input, btn, card, copy, toast, field, select, seg, download, pickFile, readAs, navigate } from "../core.js";

defineTool({
  id: "draw", name: "Sketchpad", icon: "✎", cat: "media",
  desc: "Quick drawings, annotations and diagrams. Pen, shapes, text, undo — export PNG.",
  tags: ["draw", "sketch", "whiteboard", "annotate", "paint", "canvas", "doodle", "signature", "sign"],
  mount(root) {
    const W = 1200, H = 720;
    const canvas = h("canvas.draw-canvas", { width: W, height: H, style: { width: "100%", background: "#fff", borderRadius: "12px", cursor: "crosshair", touchAction: "none" } });
    const ctx = canvas.getContext("2d");
    const color = input({ type: "color", value: store.get("draw.color", "#111111"), style: { width: "48px" } });
    const size = h("input", { type: "range", min: 1, max: 60, value: store.get("draw.size", 4) });
    const alpha = h("input", { type: "range", min: 0.1, max: 1, step: 0.05, value: 1 });
    const bgColor = input({ type: "color", value: store.get("draw.bg", "#ffffff"), style: { width: "48px" } });
    const textIn = input({ placeholder: "text to stamp (text tool)", value: "hello" });
    let tool = store.get("draw.tool", "pen");
    let history = [], future = [];
    let start = null, snap = null, drawing = false;

    const save = () => { try { store.set("draw.data", canvas.toDataURL("image/png")); } catch {} };
    const pushUndo = () => { history.push(ctx.getImageData(0, 0, W, H)); if (history.length > 40) history.shift(); future = []; };
    const undo = () => { if (!history.length) return; future.push(ctx.getImageData(0, 0, W, H)); ctx.putImageData(history.pop(), 0, 0); save(); };
    const redo = () => { if (!future.length) return; history.push(ctx.getImageData(0, 0, W, H)); ctx.putImageData(future.pop(), 0, 0); save(); };
    const transparent = h("input", { type: "checkbox", checked: store.get("draw.transparent", false), onchange: (e) => { store.set("draw.transparent", e.target.checked); } });
    const fill = () => { ctx.clearRect(0, 0, W, H); if (!transparent.checked) { ctx.fillStyle = bgColor.value; ctx.fillRect(0, 0, W, H); } };
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };

    const style = () => { ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = +size.value; ctx.globalAlpha = +alpha.value; ctx.strokeStyle = tool === "eraser" ? bgColor.value : color.value; ctx.fillStyle = color.value; ctx.globalCompositeOperation = "source-over"; };
    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId);
      pushUndo(); drawing = true; start = pos(e); style();
      if (tool === "pen" || tool === "eraser" || tool === "highlighter") { if (tool === "highlighter") { ctx.globalAlpha = 0.3; ctx.lineWidth = +size.value * 3; } ctx.beginPath(); ctx.moveTo(start.x, start.y); }
      else if (tool === "text") { ctx.font = `${+size.value * 6 + 10}px ${getComputedStyle(document.body).fontFamily}`; ctx.fillText(textIn.value, start.x, start.y); drawing = false; save(); }
      else if (tool === "fill") { ctx.globalAlpha = 1; ctx.fillStyle = color.value; ctx.fillRect(0, 0, W, H); drawing = false; save(); }
      else snap = ctx.getImageData(0, 0, W, H);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!drawing) return;
      const p = pos(e);
      if (tool === "pen" || tool === "eraser" || tool === "highlighter") { ctx.lineTo(p.x, p.y); ctx.stroke(); return; }
      ctx.putImageData(snap, 0, 0); style();
      const w = p.x - start.x, hh = p.y - start.y;
      ctx.beginPath();
      if (tool === "line") { ctx.moveTo(start.x, start.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }
      else if (tool === "arrow") { const a = Math.atan2(hh, w), L = Math.max(12, +size.value * 4); ctx.moveTo(start.x, start.y); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x - L * Math.cos(a - 0.5), p.y - L * Math.sin(a - 0.5)); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - L * Math.cos(a + 0.5), p.y - L * Math.sin(a + 0.5)); ctx.stroke(); }
      else if (tool === "rect") { e.shiftKey ? ctx.strokeRect(start.x, start.y, w, hh) : ctx.strokeRect(start.x, start.y, w, hh); }
      else if (tool === "rect-fill") ctx.fillRect(start.x, start.y, w, hh);
      else if (tool === "ellipse") { ctx.ellipse(start.x + w / 2, start.y + hh / 2, Math.abs(w / 2), Math.abs(hh / 2), 0, 0, Math.PI * 2); ctx.stroke(); }
      else if (tool === "ellipse-fill") { ctx.ellipse(start.x + w / 2, start.y + hh / 2, Math.abs(w / 2), Math.abs(hh / 2), 0, 0, Math.PI * 2); ctx.fill(); }
    });
    const end = () => { if (!drawing) return; drawing = false; snap = null; ctx.globalAlpha = 1; save(); };
    canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) { e.preventDefault(); e.shiftKey ? redo() : undo(); } };
    document.addEventListener("keydown", onKey);

    const toolSeg = seg([["pen", "✎ pen"], ["highlighter", "▮ marker"], ["eraser", "◻ eraser"], ["line", "╱ line"], ["arrow", "➔ arrow"], ["rect", "▭ rect"], ["rect-fill", "▬ filled"], ["ellipse", "◯ ellipse"], ["ellipse-fill", "⬤ filled"], ["text", "T text"], ["fill", "▩ fill all"]], (v) => { tool = v; store.set("draw.tool", v); }, tool);
    [color, size, bgColor].forEach((el) => el.addEventListener("input", () => { store.set("draw.color", color.value); store.set("draw.size", +size.value); store.set("draw.bg", bgColor.value); }));

    const loadImg = (src, fit = true) => { const img = new Image(); img.onload = () => { pushUndo(); fill(); const k = fit ? Math.min(W / img.width, H / img.height, 1) : 1; ctx.drawImage(img, (W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k); save(); }; img.src = src; };

    // restore
    const saved = store.get("draw.import", null) || store.get("draw.data", null);
    fill();
    if (saved) loadImg(saved);
    store.del("draw.import");

    root.append(
      card("Canvas", h("div.col",
        h("div.row", toolSeg),
        h("div.row", field("colour", color), field("size", h("div", { style: { width: "140px" } }, size)), field("opacity", h("div", { style: { width: "110px" } }, alpha)), field("background", bgColor), field("text", textIn),
          h("label.check", transparent, "transparent bg"), btn("↶", undo, "ghost sm"), btn("↷", redo, "ghost sm"),
          btn("✍ signature mode", () => { transparent.checked = true; store.set("draw.transparent", true); pushUndo(); fill(); color.value = "#111111"; size.value = 3; tool = "pen"; toolSeg.select("pen"); canvas.style.background = "repeating-conic-gradient(#e8e8e8 0 25%, #fff 0 50%) 0 0 / 20px 20px"; save(); toast("draw your signature, then ↓ PNG for a transparent file"); }, "ghost sm")),
        canvas), [
        btn("Import image", async () => { const f = await pickFile({ accept: "image/*" }); if (f) loadImg(await readAs.dataURL(f)); }, "ghost sm"),
        btn("Send to Image Forge", () => { canvas.toBlob((b) => { window.__pendingFile = new File([b], "sketch.png", { type: "image/png" }); navigate("image"); }); }, "ghost sm"),
        btn("Copy PNG", async () => { try { canvas.toBlob(async (b) => { await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]); toast("copied", "ok"); }); } catch { toast("clipboard unsupported", "bad"); } }, "ghost sm"),
        btn("Clear", () => { pushUndo(); fill(); save(); }, "ghost sm danger"),
        btn("↓ PNG", () => canvas.toBlob((b) => download(b, "sketch.png")), "primary sm")]),
      h("p.hint", { style: { marginTop: "10px" }, text: "Autosaves to this browser. ⌘Z / ⌘⇧Z undo & redo. Canvas is 1200 × 720." }));
    return () => document.removeEventListener("keydown", onKey);
  },
});
