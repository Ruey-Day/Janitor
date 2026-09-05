import { h, defineTool, store, input, btn, card, copy, toast, subtabs, field, select, seg, out, kv, pickFile, readAs, download, bytes, round, navigate, modal, textarea, loadScript, tbl } from "../core.js";
import { readExif, describe } from "../lib/exif.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

defineTool({
  id: "image", name: "Image Forge", icon: "▣", cat: "media",
  desc: "Crop, resize, rotate, redact, text/watermark, filters, adjustments, EXIF, OCR, convert & compress. Paste, drop or browse.",
  tags: ["image", "photo", "crop", "resize", "rotate", "flip", "filter", "grayscale", "invert", "compress", "convert", "png", "jpeg", "webp", "favicon", "palette", "exif", "metadata", "camera", "redact", "blur face", "pixelate", "watermark", "meme", "text on image", "ocr", "image to text", "ascii art", "eyedropper", "color picker", "straighten", "instagram size"],
  mount(root) {
    const stage = h("canvas", { id: "stage" });
    const ctx = stage.getContext("2d", { willReadFrequently: true });
    const holder = h("div.canvas-holder", stage);
    const selBox = h("div.sel", { hidden: true }, h("span.sel-size"));
    holder.append(selBox);
    const meta = h("div.stage-meta");
    const dropzone = h("div.dropzone", { tabindex: 0 },
      h("div.dz-icon", { text: "⌘V" }), h("p.dz-title", { text: "Paste an image anywhere" }),
      h("p.dz-sub", "or drop a file · or ", h("span.link", { text: "browse your disk" }), " · or ", h("span.link", { id: "cam-link", text: "use camera" })));
    const stageWrap = h("div", { hidden: true }, holder, meta);
    const historyStrip = h("div.filmstrip");

    let original = null;       // pristine canvas
    let originalFile = null;
    let exifData = null;
    let eyedropper = false;
    let history = [], future = [];
    let selection = null, drag = null;
    let preview = null;        // snapshot before live adjustments

    const snapshot = () => { const c = document.createElement("canvas"); c.width = stage.width; c.height = stage.height; c.getContext("2d").drawImage(stage, 0, 0); return c; };
    const restore = (c) => { stage.width = c.width; stage.height = c.height; ctx.drawImage(c, 0, 0); refreshMeta(); clearSelection(); };
    const commit = (label) => { history.push({ c: snapshot(), label }); if (history.length > 30) history.shift(); future = []; renderHistory(); };
    const pushUndo = () => { history.push({ c: snapshot(), label: "state" }); if (history.length > 30) history.shift(); future = []; };
    const undo = () => { if (!history.length) return toast("nothing to undo"); future.push(snapshot()); restore(history.pop().c); renderHistory(); };
    const redo = () => { if (!future.length) return toast("nothing to redo"); history.push({ c: snapshot(), label: "redo" }); restore(future.pop()); renderHistory(); };
    const renderHistory = () => { historyStrip.replaceChildren(...history.slice(-8).map((hst, i) => { const img = h("img", { src: hst.c.toDataURL("image/png"), title: hst.label }); img.onclick = () => { const idx = history.length - Math.min(8, history.length) + i; future = []; restore(history[idx].c); history = history.slice(0, idx); renderHistory(); }; return img; })); };

    const hasImage = () => original !== null;
    const refreshMeta = () => {
      const mp = (stage.width * stage.height / 1e6).toFixed(2);
      const g = (a, b) => (b ? g(b, a % b) : a);
      const d = g(stage.width, stage.height);
      meta.replaceChildren(
        h("span.hot", { text: `${stage.width} × ${stage.height} px` }), h("span", { text: `${mp} MP` }),
        h("span", { text: `${stage.width / d}:${stage.height / d}` }),
        originalFile ? h("span", { text: `${originalFile.name} · ${bytes(originalFile.size)}` }) : null,
        h("span.hint", { text: "drag to select · Esc clears · ⌘Z undo" }));
    };
    const showEditor = (on) => { dropzone.hidden = on; stageWrap.hidden = !on; actionBar.hidden = !on; toolsCard.hidden = !on; };
    const clearSelection = () => { selection = null; selBox.hidden = true; cropBtn.disabled = true; };

    function loadImage(src, file) {
      const img = new Image();
      img.onload = () => {
        stage.width = img.naturalWidth; stage.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        original = snapshot(); originalFile = file || null; history = []; future = []; renderHistory();
        clearSelection(); showEditor(true); refreshMeta(); updateExportEstimate();
        toast(`loaded ${stage.width} × ${stage.height}`);
      };
      img.onerror = () => toast("could not read that image", "bad");
      img.src = src;
    }
    async function loadFile(file) {
      if (!file) return;
      if (!file.type.startsWith("image/") && !/\.(svg|heic)$/i.test(file.name)) return toast("that is not an image", "bad");
      exifData = null;
      if (file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name)) { try { exifData = readExif(await file.arrayBuffer()); } catch {} }
      loadImage(await readAs.dataURL(file), file);
    }
    const onFile = (e) => loadFile(e.detail);
    document.addEventListener("trinket:file", onFile);
    if (window.__pendingFile?.type.startsWith("image/")) { const f = window.__pendingFile; window.__pendingFile = null; loadFile(f); }
    dropzone.addEventListener("click", async (e) => { if (e.target.id === "cam-link") return openCamera(); loadFile(await pickFile({ accept: "image/*,.svg" })); });
    dropzone.addEventListener("keydown", async (e) => { if (e.key === "Enter") loadFile(await pickFile({ accept: "image/*" })); });

    /* camera */
    async function openCamera() {
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 } } }); }
      catch { return toast("camera unavailable or blocked", "bad"); }
      const video = h("video", { autoplay: true, playsinline: true, style: { width: "100%", borderRadius: "10px", background: "#000" } });
      video.srcObject = stream;
      const stop = () => stream.getTracks().forEach((t) => t.stop());
      const close = modal("Camera", h("div.col", video, h("div.row", btn("📸 Capture", () => {
        stage.width = video.videoWidth; stage.height = video.videoHeight; ctx.drawImage(video, 0, 0);
        original = snapshot(); originalFile = null; history = []; future = []; renderHistory(); clearSelection(); showEditor(true); refreshMeta(); stop(); close();
      }, "primary"), btn("Cancel", () => { stop(); close(); }, "ghost"))));
    }

    /* selection */
    const toImg = (e) => { const r = stage.getBoundingClientRect(); return { x: clamp((e.clientX - r.left) * stage.width / r.width, 0, stage.width), y: clamp((e.clientY - r.top) * stage.height / r.height, 0, stage.height) }; };
    const drawSel = () => {
      if (!selection) return;
      const r = stage.getBoundingClientRect(), hr = holder.getBoundingClientRect();
      const sx = r.width / stage.width, sy = r.height / stage.height;
      selBox.hidden = false;
      Object.assign(selBox.style, { left: r.left - hr.left + selection.x * sx + "px", top: r.top - hr.top + selection.y * sy + "px", width: selection.w * sx + "px", height: selection.h * sy + "px" });
      selBox.firstChild.textContent = `${Math.round(selection.w)} × ${Math.round(selection.h)}`;
    };
    stage.addEventListener("pointerdown", (e) => {
      if (!hasImage()) return;
      if (eyedropper) { const p = toImg(e); const d = ctx.getImageData(Math.min(stage.width - 1, p.x | 0), Math.min(stage.height - 1, p.y | 0), 1, 1).data; const hex = "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join(""); copy(hex, `${hex} copied`); store.set("color.current", hex); pickedOut.textContent = `${hex} · rgb(${d[0]}, ${d[1]}, ${d[2]}) · alpha ${d[3]}`; pickedOut.style.borderColor = hex; return; }
      stage.setPointerCapture(e.pointerId); drag = toImg(e); selection = { ...drag, w: 0, h: 0 }; drawSel();
    });
    const pickedOut = out("click the image to pick a colour");
    stage.addEventListener("pointermove", (e) => {
      if (!drag) return; const p = toImg(e);
      let w = Math.abs(p.x - drag.x), hh = Math.abs(p.y - drag.y);
      if (aspectLock.value !== "free") { const [aw, ah] = aspectLock.value.split(":").map(Number); hh = w * ah / aw; }
      selection = { x: Math.min(drag.x, p.x >= drag.x ? drag.x : drag.x - w), y: Math.min(drag.y, p.y >= drag.y ? drag.y : drag.y - hh), w, h: hh };
      selection.w = Math.min(selection.w, stage.width - selection.x); selection.h = Math.min(selection.h, stage.height - selection.y);
      drawSel();
    });
    const endDrag = () => { if (!drag) return; drag = null; if (!selection || selection.w < 2 || selection.h < 2) clearSelection(); else cropBtn.disabled = false; };
    stage.addEventListener("pointerup", endDrag); stage.addEventListener("pointercancel", endDrag);
    const onResize = () => selection && drawSel();
    window.addEventListener("resize", onResize);
    const onKey = (e) => {
      if (e.key === "Escape" && selection) clearSelection();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && hasImage() && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    };
    document.addEventListener("keydown", onKey);

    /* pixel ops */
    const px = (fn) => { const d = ctx.getImageData(0, 0, stage.width, stage.height); fn(d.data, d.width, d.height); ctx.putImageData(d, 0, 0); };
    const op = (label, fn) => () => { if (!hasImage()) return; pushUndo(); fn(); commitLabel(label); };
    const commitLabel = (label) => { if (history.length) history[history.length - 1].label = label; renderHistory(); updateExportEstimate(); };
    const FILTERS = {
      invert: (p) => { for (let i = 0; i < p.length; i += 4) { p[i] = 255 - p[i]; p[i + 1] = 255 - p[i + 1]; p[i + 2] = 255 - p[i + 2]; } },
      grayscale: (p) => { for (let i = 0; i < p.length; i += 4) { const v = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; p[i] = p[i + 1] = p[i + 2] = v; } },
      sepia: (p) => { for (let i = 0; i < p.length; i += 4) { const r = p[i], g = p[i + 1], b = p[i + 2]; p[i] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b); p[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b); p[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b); } },
      threshold: (p) => { for (let i = 0; i < p.length; i += 4) { const v = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2] >= 128 ? 255 : 0; p[i] = p[i + 1] = p[i + 2] = v; } },
      posterize: (p) => { for (let i = 0; i < p.length; i += 4) { p[i] = Math.round(p[i] / 64) * 64; p[i + 1] = Math.round(p[i + 1] / 64) * 64; p[i + 2] = Math.round(p[i + 2] / 64) * 64; } },
      solarize: (p) => { for (let i = 0; i < p.length; i += 4) for (let k = 0; k < 3; k++) if (p[i + k] > 128) p[i + k] = 255 - p[i + k]; },
      "red only": (p) => { for (let i = 0; i < p.length; i += 4) { p[i + 1] = 0; p[i + 2] = 0; } },
      "swap r/b": (p) => { for (let i = 0; i < p.length; i += 4) { const r = p[i]; p[i] = p[i + 2]; p[i + 2] = r; } },
      "remove alpha": (p) => { for (let i = 3; i < p.length; i += 4) p[i] = 255; },
      "white → transparent": (p) => { for (let i = 0; i < p.length; i += 4) if (p[i] > 240 && p[i + 1] > 240 && p[i + 2] > 240) p[i + 3] = 0; },
      "black → transparent": (p) => { for (let i = 0; i < p.length; i += 4) if (p[i] < 15 && p[i + 1] < 15 && p[i + 2] < 15) p[i + 3] = 0; },
    };
    const convolve = (kernel, div = 1, bias = 0) => (p, w, hh) => {
      const src = new Uint8ClampedArray(p);
      for (let y = 1; y < hh - 1; y++) for (let x = 1; x < w - 1; x++) for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let ky = -1; ky <= 1; ky++) for (let kx = -1; kx <= 1; kx++) s += src[((y + ky) * w + (x + kx)) * 4 + c] * kernel[(ky + 1) * 3 + kx + 1];
        p[(y * w + x) * 4 + c] = clamp(s / div + bias, 0, 255);
      }
    };
    Object.assign(FILTERS, {
      sharpen: convolve([0, -1, 0, -1, 5, -1, 0, -1, 0]),
      blur: convolve([1, 1, 1, 1, 1, 1, 1, 1, 1], 9),
      "edge detect": convolve([-1, -1, -1, -1, 8, -1, -1, -1, -1]),
      emboss: convolve([-2, -1, 0, -1, 1, 1, 0, 1, 2], 1, 0),
    });
    const pixelate = (size) => (p, w, hh) => {
      for (let y = 0; y < hh; y += size) for (let x = 0; x < w; x += size) {
        let r = 0, g = 0, b = 0, n = 0;
        for (let yy = y; yy < Math.min(y + size, hh); yy++) for (let xx = x; xx < Math.min(x + size, w); xx++) { const i = (yy * w + xx) * 4; r += p[i]; g += p[i + 1]; b += p[i + 2]; n++; }
        r /= n; g /= n; b /= n;
        for (let yy = y; yy < Math.min(y + size, hh); yy++) for (let xx = x; xx < Math.min(x + size, w); xx++) { const i = (yy * w + xx) * 4; p[i] = r; p[i + 1] = g; p[i + 2] = b; }
      }
    };

    /* geometry */
    const redraw = (w, hh, draw) => { const tmp = snapshot(); stage.width = w; stage.height = hh; ctx.save(); draw(tmp); ctx.restore(); refreshMeta(); clearSelection(); };
    const rotate = (deg) => redraw(deg % 180 ? stage.height : stage.width, deg % 180 ? stage.width : stage.height, (tmp) => { ctx.translate(stage.width / 2, stage.height / 2); ctx.rotate(deg * Math.PI / 180); ctx.drawImage(tmp, -tmp.width / 2, -tmp.height / 2); });
    const flip = (hz) => redraw(stage.width, stage.height, (tmp) => { ctx.translate(hz ? stage.width : 0, hz ? 0 : stage.height); ctx.scale(hz ? -1 : 1, hz ? 1 : -1); ctx.drawImage(tmp, 0, 0); });
    const resizeTo = (w, hh) => redraw(Math.max(1, Math.round(w)), Math.max(1, Math.round(hh)), (tmp) => { ctx.imageSmoothingQuality = "high"; ctx.drawImage(tmp, 0, 0, stage.width, stage.height); });
    const crop = () => { if (!selection) return; const { x, y, w, hh } = { x: Math.round(selection.x), y: Math.round(selection.y), w: Math.max(1, Math.round(selection.w)), hh: Math.max(1, Math.round(selection.h)) }; redraw(w, hh, (tmp) => ctx.drawImage(tmp, x, y, w, hh, 0, 0, w, hh)); };

    /* adjustments (live preview) */
    const adj = { brightness: 0, contrast: 0, saturation: 0, hue: 0, gamma: 1, temperature: 0 };
    const sliders = {};
    const applyAdj = () => {
      if (!preview) preview = snapshot();
      ctx.drawImage(preview, 0, 0);
      const { brightness, contrast, saturation, hue, gamma, temperature } = adj;
      if (!brightness && !contrast && !saturation && !hue && gamma === 1 && !temperature) return;
      const cf = (259 * (contrast + 255)) / (255 * (259 - contrast));
      const gLut = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) gLut[i] = 255 * (i / 255) ** (1 / gamma);
      const hr = hue * Math.PI / 180, cosH = Math.cos(hr), sinH = Math.sin(hr);
      const m = [0.213 + cosH * 0.787 - sinH * 0.213, 0.715 - cosH * 0.715 - sinH * 0.715, 0.072 - cosH * 0.072 + sinH * 0.928,
        0.213 - cosH * 0.213 + sinH * 0.143, 0.715 + cosH * 0.285 + sinH * 0.140, 0.072 - cosH * 0.072 - sinH * 0.283,
        0.213 - cosH * 0.213 - sinH * 0.787, 0.715 - cosH * 0.715 + sinH * 0.715, 0.072 + cosH * 0.928 + sinH * 0.072];
      px((p) => {
        for (let i = 0; i < p.length; i += 4) {
          let r = p[i], g = p[i + 1], b = p[i + 2];
          if (hue) { const nr = r * m[0] + g * m[1] + b * m[2], ng = r * m[3] + g * m[4] + b * m[5], nb = r * m[6] + g * m[7] + b * m[8]; r = nr; g = ng; b = nb; }
          if (brightness) { r += brightness; g += brightness; b += brightness; }
          if (contrast) { r = cf * (r - 128) + 128; g = cf * (g - 128) + 128; b = cf * (b - 128) + 128; }
          if (saturation) { const l = 0.299 * r + 0.587 * g + 0.114 * b, s = 1 + saturation / 100; r = l + (r - l) * s; g = l + (g - l) * s; b = l + (b - l) * s; }
          if (temperature) { r += temperature; b -= temperature; }
          if (gamma !== 1) { r = gLut[clamp(r, 0, 255) | 0]; g = gLut[clamp(g, 0, 255) | 0]; b = gLut[clamp(b, 0, 255) | 0]; }
          p[i] = r; p[i + 1] = g; p[i + 2] = b;
        }
      });
    };
    const slider = (key, min, max, step = 1) => {
      const r = h("input", { type: "range", min, max, step, value: adj[key] });
      const v = h("span.mono", { text: String(adj[key]), style: { width: "42px", textAlign: "right", fontSize: "11px" } });
      r.addEventListener("input", () => { adj[key] = +r.value; v.textContent = r.value; applyAdj(); });
      sliders[key] = { r, v };
      return h("div.row", { style: { flexWrap: "nowrap" } }, h("span.label", { text: key, style: { width: "92px" } }), r, v);
    };
    const resetAdj = () => { Object.assign(adj, { brightness: 0, contrast: 0, saturation: 0, hue: 0, gamma: 1, temperature: 0 }); for (const k in sliders) { sliders[k].r.value = adj[k]; sliders[k].v.textContent = adj[k]; } if (preview) { ctx.drawImage(preview, 0, 0); preview = null; } };
    const commitAdj = () => { if (!preview) return toast("no adjustments to apply"); const cur = snapshot(); ctx.drawImage(preview, 0, 0); pushUndo(); ctx.drawImage(cur, 0, 0); preview = null; Object.assign(adj, { brightness: 0, contrast: 0, saturation: 0, hue: 0, gamma: 1, temperature: 0 }); for (const k in sliders) { sliders[k].r.value = adj[k]; sliders[k].v.textContent = adj[k]; } commitLabel("adjust"); toast("adjustments applied", "ok"); };

    /* resize form */
    const wIn = input({ type: "number", min: 1, style: { width: "100px" } }), hIn = input({ type: "number", min: 1, style: { width: "100px" } });
    const lock = h("input", { type: "checkbox", checked: true });
    const pct = input({ type: "number", value: 50, min: 1, max: 400, style: { width: "80px" } });
    wIn.addEventListener("input", () => { if (lock.checked && hasImage()) hIn.value = Math.round(+wIn.value * stage.height / stage.width); });
    hIn.addEventListener("input", () => { if (lock.checked && hasImage()) wIn.value = Math.round(+hIn.value * stage.width / stage.height); });
    const syncSize = () => { wIn.value = stage.width; hIn.value = stage.height; };
    const aspectLock = seg([["free", "free"], ["1:1", "1:1"], ["4:3", "4:3"], ["3:2", "3:2"], ["16:9", "16:9"], ["9:16", "9:16"]], null, "free");
    const pixSize = input({ type: "number", value: 12, min: 2, max: 200, style: { width: "80px" } });
    const padColor = input({ type: "color", value: "#ffffff", style: { width: "56px" } });
    const padPx = input({ type: "number", value: 32, min: 1, style: { width: "80px" } });

    /* export */
    const fmt = select([["image/png", "PNG"], ["image/jpeg", "JPEG"], ["image/webp", "WebP"]], { value: store.get("image.fmt", "image/png"), style: { width: "auto" } });
    const quality = h("input", { type: "range", min: 0.1, max: 1, step: 0.05, value: store.get("image.q", 0.9) });
    const qLabel = h("span.mono", { text: Math.round(quality.value * 100) + "%" });
    const estimate = h("span.chip", { text: "—" });
    const fileName = input({ value: "trinketlab", placeholder: "filename" });
    const toBlob = (type = fmt.value, q = +quality.value) => new Promise((res) => stage.toBlob(res, type, q));
    let estTimer;
    const updateExportEstimate = () => { clearTimeout(estTimer); estTimer = setTimeout(async () => { if (!hasImage()) return; const b = await toBlob(); estimate.textContent = b ? `≈ ${bytes(b.size)}` : "unsupported"; }, 200); };
    quality.addEventListener("input", () => { qLabel.textContent = Math.round(quality.value * 100) + "%"; store.set("image.q", +quality.value); updateExportEstimate(); });
    fmt.addEventListener("change", () => { store.set("image.fmt", fmt.value); updateExportEstimate(); });
    const doDownload = async () => { const b = await toBlob(); if (!b) return toast("format unsupported here", "bad"); download(b, `${fileName.value || "image"}.${fmt.value.split("/")[1].replace("jpeg", "jpg")}`); };
    const copyImage = async () => { try { const b = await toBlob("image/png"); await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]); toast("image copied", "ok"); } catch { toast("clipboard image write not supported here", "bad"); } };
    const favicons = async () => { for (const s of [16, 32, 48, 64, 128, 180, 192, 512]) { const c = document.createElement("canvas"); c.width = c.height = s; const cx = c.getContext("2d"); cx.imageSmoothingQuality = "high"; const side = Math.min(stage.width, stage.height); cx.drawImage(stage, (stage.width - side) / 2, (stage.height - side) / 2, side, side, 0, 0, s, s); await new Promise((r) => c.toBlob((b) => { download(b, `icon-${s}.png`); setTimeout(r, 150); }, "image/png")); } };
    const palette = () => {
      const d = ctx.getImageData(0, 0, stage.width, stage.height).data, buckets = new Map();
      for (let i = 0; i < d.length; i += 16) { if (d[i + 3] < 128) continue; const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4); const b = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 }; b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; buckets.set(k, b); }
      const top = [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, 12).map((b) => "#" + [b.r / b.n, b.g / b.n, b.b / b.n].map((v) => Math.round(v).toString(16).padStart(2, "0")).join(""));
      modal("Dominant colours", h("div.col", h("div.swatch-grid", top.map((c) => h("div.swatch", { onclick: () => copy(c) }, h("div.sw-color", { style: { background: c } }), h("div.sw-label", { text: c })))),
        h("div.row", btn("Copy all", () => copy(top.join("\n")), "ghost sm"), btn("Open in Color Lab", () => { store.set("color.palette", top); navigate("color"); }, "sm"))));
    };

    const withSelection = (fn) => () => { if (!selection) return toast("drag a region on the image first", "bad"); const x = Math.round(selection.x), y = Math.round(selection.y), w = Math.max(1, Math.round(selection.w)), hh = Math.max(1, Math.round(selection.h)); pushUndo(); fn(x, y, w, hh); clearSelection(); commitLabel("region"); };
    const redact = withSelection((x, y, w, hh) => { ctx.fillStyle = "#000"; ctx.fillRect(x, y, w, hh); });
    const pixelateSel = withSelection((x, y, w, hh) => { const size = Math.max(4, Math.round(Math.max(w, hh) / 12)); const d = ctx.getImageData(x, y, w, hh); pixelate(size)(d.data, w, hh); ctx.putImageData(d, x, y); });
    const blurSel = withSelection((x, y, w, hh) => { const tmp = document.createElement("canvas"); tmp.width = Math.max(1, w / 8); tmp.height = Math.max(1, hh / 8); const tc = tmp.getContext("2d"); tc.drawImage(stage, x, y, w, hh, 0, 0, tmp.width, tmp.height); ctx.imageSmoothingEnabled = true; ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, x, y, w, hh); });
    const cropOutside = withSelection((x, y, w, hh) => { const tmp = snapshot(); ctx.clearRect(0, 0, stage.width, stage.height); ctx.drawImage(tmp, x, y, w, hh, x, y, w, hh); });
    /* text overlay */
    const ovText = input({ placeholder: "text", value: "TOP TEXT" }), ovSize = input({ type: "number", value: 48, min: 6, style: { width: "80px" } }), ovColor = input({ type: "color", value: "#ffffff", style: { width: "48px" } }), ovStroke = input({ type: "color", value: "#000000", style: { width: "48px" } });
    const ovPos = select([["top", "top"], ["center", "center"], ["bottom", "bottom"], ["tl", "top-left"], ["tr", "top-right"], ["bl", "bottom-left"], ["br", "bottom-right"], ["tile", "tiled watermark"]], { style: { width: "auto" } });
    const ovFont = select([["Impact, 'Arial Black', sans-serif", "Impact (meme)"], ["system-ui, sans-serif", "system"], ["Georgia, serif", "serif"], ["'JetBrains Mono', monospace", "mono"], ["'Comic Sans MS', cursive", "comic"]], { style: { width: "auto" } });
    const ovOpacity = h("input", { type: "range", min: 0.05, max: 1, step: 0.05, value: 1 });
    const drawText = op("text", () => {
      const size = +ovSize.value * (stage.width / 800), text = ovText.value; if (!text) return;
      ctx.save(); ctx.globalAlpha = +ovOpacity.value; ctx.font = `bold ${size}px ${ovFont.value}`; ctx.fillStyle = ovColor.value; ctx.strokeStyle = ovStroke.value; ctx.lineWidth = Math.max(1, size / 12); ctx.lineJoin = "round"; ctx.textBaseline = "middle";
      const pad = size * 0.6; const put = (x, y, align) => { ctx.textAlign = align; ctx.strokeText(text, x, y); ctx.fillText(text, x, y); };
      const pos = ovPos.value;
      if (pos === "tile") { ctx.globalAlpha = Math.min(+ovOpacity.value, 0.35); ctx.textAlign = "center"; ctx.translate(stage.width / 2, stage.height / 2); ctx.rotate(-Math.PI / 6); const step = ctx.measureText(text).width + size * 2; for (let y = -stage.height; y < stage.height; y += size * 3) for (let x = -stage.width; x < stage.width; x += step) { ctx.strokeText(text, x, y); ctx.fillText(text, x, y); } }
      else if (pos === "top") put(stage.width / 2, pad, "center"); else if (pos === "center") put(stage.width / 2, stage.height / 2, "center"); else if (pos === "bottom") put(stage.width / 2, stage.height - pad, "center");
      else if (pos === "tl") put(pad, pad, "left"); else if (pos === "tr") put(stage.width - pad, pad, "right"); else if (pos === "bl") put(pad, stage.height - pad, "left"); else put(stage.width - pad, stage.height - pad, "right");
      ctx.restore();
    });
    /* arbitrary rotate / straighten */
    const angleIn = input({ type: "number", value: 0, step: 0.5, min: -180, max: 180, style: { width: "90px" } });
    const rotateFree = op("rotate", () => { const a = (+angleIn.value * Math.PI) / 180; const tmp = snapshot(); const cos = Math.abs(Math.cos(a)), sin = Math.abs(Math.sin(a)); const w = Math.round(tmp.width * cos + tmp.height * sin), hh = Math.round(tmp.width * sin + tmp.height * cos); stage.width = w; stage.height = hh; ctx.save(); ctx.translate(w / 2, hh / 2); ctx.rotate(a); ctx.drawImage(tmp, -tmp.width / 2, -tmp.height / 2); ctx.restore(); refreshMeta(); clearSelection(); });
    /* social presets */
    const PRESETS = [["Instagram square", 1080, 1080], ["Instagram portrait", 1080, 1350], ["Story / Reel", 1080, 1920], ["YouTube thumb", 1280, 720], ["Twitter / X post", 1600, 900], ["Twitter header", 1500, 500], ["Facebook cover", 820, 312], ["LinkedIn banner", 1584, 396], ["OG image", 1200, 630], ["Pinterest", 1000, 1500], ["A4 @150dpi", 1240, 1754], ["4K", 3840, 2160], ["1080p", 1920, 1080]];
    const coverTo = (w, hh) => op("preset", () => { const tmp = snapshot(); const k = Math.max(w / tmp.width, hh / tmp.height); stage.width = w; stage.height = hh; ctx.imageSmoothingQuality = "high"; ctx.drawImage(tmp, (w - tmp.width * k) / 2, (hh - tmp.height * k) / 2, tmp.width * k, tmp.height * k); refreshMeta(); clearSelection(); })();
    /* combine */
    const combine = async (dirn) => { if (!hasImage()) return; const f = await pickFile({ accept: "image/*" }); if (!f) return; const bmp = await createImageBitmap(f); pushUndo(); const tmp = snapshot(); if (dirn === "h") { const k = tmp.height / bmp.height; redraw(tmp.width + bmp.width * k, tmp.height, () => { ctx.drawImage(tmp, 0, 0); ctx.drawImage(bmp, tmp.width, 0, bmp.width * k, tmp.height); }); } else { const k = tmp.width / bmp.width; redraw(tmp.width, tmp.height + bmp.height * k, () => { ctx.drawImage(tmp, 0, 0); ctx.drawImage(bmp, 0, tmp.height, tmp.width, bmp.height * k); }); } commitLabel("combine"); };
    /* ascii */
    const asciiOut = textarea({ readonly: true, style: { minHeight: "300px", fontSize: "7px", lineHeight: "1", letterSpacing: "0", whiteSpace: "pre", fontFamily: "monospace" } });
    const asciiCols = input({ type: "number", value: 120, min: 20, max: 400, style: { width: "80px" } });
    const asciiInv = h("input", { type: "checkbox" });
    const makeAscii = () => { if (!hasImage()) return; const cols = +asciiCols.value; const rowsN = Math.round((stage.height / stage.width) * cols * 0.5); const c = document.createElement("canvas"); c.width = cols; c.height = rowsN; const cx = c.getContext("2d"); cx.drawImage(stage, 0, 0, cols, rowsN); const d = cx.getImageData(0, 0, cols, rowsN).data; let ramp = "@%#*+=-:. "; if (asciiInv.checked) ramp = [...ramp].reverse().join(""); let s2 = ""; for (let y = 0; y < rowsN; y++) { for (let x = 0; x < cols; x++) { const i = (y * cols + x) * 4; const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) * (d[i + 3] / 255); s2 += ramp[Math.min(ramp.length - 1, Math.floor((l / 255) * ramp.length))]; } s2 += "\n"; } asciiOut.value = s2; };
    /* ocr */
    const ocrOut = textarea({ readonly: true, style: { minHeight: "220px" } });
    const ocrLang = select([["eng", "English"], ["spa", "Spanish"], ["fra", "French"], ["deu", "German"], ["ita", "Italian"], ["por", "Portuguese"], ["chi_sim", "Chinese (simplified)"], ["jpn", "Japanese"], ["kor", "Korean"], ["rus", "Russian"], ["ara", "Arabic"], ["hin", "Hindi"]], { style: { width: "auto" } });
    const ocrStatus = h("span.chip", { text: "loads tesseract.js (~3 MB + language data) on first run" });
    const runOcr = async () => { if (!hasImage()) return; try { ocrStatus.textContent = "loading OCR engine…"; const T = await loadScript("https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js", "Tesseract"); const worker = await T.createWorker(ocrLang.value, 1, { logger: (m) => { if (m.status) ocrStatus.textContent = `${m.status} ${m.progress ? Math.round(m.progress * 100) + "%" : ""}`; } }); const { data } = await worker.recognize(stage); await worker.terminate(); ocrOut.value = data.text; ocrStatus.textContent = `done · confidence ${Math.round(data.confidence)}%`; } catch (e) { ocrStatus.textContent = "failed: " + e.message; } };

    const cropBtn = btn("⛶ Crop", op("crop", crop), "sm"); cropBtn.disabled = true;
    const actionBar = h("div.row", { hidden: true, style: { marginBottom: "12px" } },
      btn("↶ Undo", undo, "ghost sm"), btn("↷ Redo", redo, "ghost sm"), cropBtn,
      btn("↺ Reset", () => { if (!hasImage()) return; pushUndo(); restore(original); commitLabel("reset"); }, "ghost sm"),
      btn("Compare", null, "ghost sm"),
      btn("✕ Close", () => { original = null; history = []; future = []; clearSelection(); showEditor(false); }, "ghost sm danger"),
      h("span.spacer"), btn("⧉ Copy", copyImage, "sm"), btn("↓ Download", doDownload, "primary sm"));
    const compareBtn = actionBar.querySelector("button:nth-child(5)");
    let compareSnap = null;
    compareBtn.addEventListener("pointerdown", () => { if (!hasImage()) return; compareSnap = snapshot(); ctx.drawImage(original, 0, 0); });
    const endCompare = () => { if (compareSnap) { ctx.drawImage(compareSnap, 0, 0); compareSnap = null; } };
    compareBtn.addEventListener("pointerup", endCompare); compareBtn.addEventListener("pointerleave", endCompare);

    const toolsCard = card("Tools", subtabs([
      { id: "transform", label: "Transform", render: () => { syncSize(); return h("div.col",
          h("div.row", btn("⟲ 90°", op("rotate", () => rotate(-90)), "sm"), btn("⟳ 90°", op("rotate", () => rotate(90)), "sm"), btn("180°", op("rotate", () => rotate(180)), "sm"), btn("⇋ Flip H", op("flip", () => flip(true)), "sm"), btn("⇅ Flip V", op("flip", () => flip(false)), "sm"),
            h("span.hint", { text: "crop aspect:" }), aspectLock),
          h("div.row", field("width", wIn), field("height", hIn), h("label.check", lock, "lock ratio"), btn("Resize", op("resize", () => resizeTo(+wIn.value, +hIn.value)), "sm"),
            field("scale %", pct), btn("Scale", op("scale", () => resizeTo(stage.width * pct.value / 100, stage.height * pct.value / 100)), "sm")),
          h("div.row", h("span.hint", { text: "fit within:" }), ...[256, 512, 1024, 1920, 2560].map((s) => btn(String(s), op("fit", () => { const k = Math.min(1, s / Math.max(stage.width, stage.height)); resizeTo(stage.width * k, stage.height * k); }), "ghost sm")),
            h("span.hint", { text: "square crop:" }), btn("center", op("square", () => { const side = Math.min(stage.width, stage.height); selection = { x: (stage.width - side) / 2, y: (stage.height - side) / 2, w: side, h: side }; crop(); }), "ghost sm")),
          h("div.row", field("pad px", padPx), field("pad colour", padColor), btn("Add border", op("pad", () => { const p = +padPx.value; redraw(stage.width + 2 * p, stage.height + 2 * p, (tmp) => { ctx.fillStyle = padColor.value; ctx.fillRect(0, 0, stage.width, stage.height); ctx.drawImage(tmp, p, p); }); }), "sm"),
            btn("Trim transparent edges", op("trim", () => { const d = ctx.getImageData(0, 0, stage.width, stage.height).data; let x0 = stage.width, y0 = stage.height, x1 = 0, y1 = 0; for (let y = 0; y < stage.height; y++) for (let x = 0; x < stage.width; x++) if (d[(y * stage.width + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } if (x1 >= x0) { selection = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; crop(); } }), "sm"))); } },
      { id: "filters", label: "Filters", render: () => h("div.col",
          h("div.row", ...Object.keys(FILTERS).map((k) => btn(k, op(k, () => px(FILTERS[k])), "sm"))),
          h("div.row", field("pixel size", pixSize), btn("pixelate", op("pixelate", () => px(pixelate(+pixSize.value))), "sm"),
            btn("vignette", op("vignette", () => { const g = ctx.createRadialGradient(stage.width / 2, stage.height / 2, Math.min(stage.width, stage.height) * 0.35, stage.width / 2, stage.height / 2, Math.max(stage.width, stage.height) * 0.75); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.75)"); ctx.fillStyle = g; ctx.fillRect(0, 0, stage.width, stage.height); }), "sm"),
            btn("noise", op("noise", () => px((p) => { for (let i = 0; i < p.length; i += 4) { const n = (Math.random() - 0.5) * 50; p[i] += n; p[i + 1] += n; p[i + 2] += n; } })), "sm"),
            btn("scanlines", op("scanlines", () => px((p, w) => { for (let i = 0; i < p.length; i += 4) if (Math.floor(i / 4 / w) % 3 === 0) { p[i] *= 0.7; p[i + 1] *= 0.7; p[i + 2] *= 0.7; } })), "sm"),
            btn("rounded corners", op("round", () => { const r = Math.min(stage.width, stage.height) * 0.08; const tmp = snapshot(); ctx.clearRect(0, 0, stage.width, stage.height); ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, stage.width, stage.height, r); ctx.clip(); ctx.drawImage(tmp, 0, 0); ctx.restore(); }), "sm"),
            btn("circle mask", op("circle", () => { const side = Math.min(stage.width, stage.height); const tmp = snapshot(); redraw(side, side, () => { ctx.beginPath(); ctx.arc(side / 2, side / 2, side / 2, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(tmp, (side - tmp.width) / 2, (side - tmp.height) / 2); }); }), "sm"))) },
      { id: "adjust", label: "Adjust", render: () => h("div.col",
          slider("brightness", -100, 100), slider("contrast", -100, 100), slider("saturation", -100, 100), slider("hue", -180, 180), slider("temperature", -60, 60), slider("gamma", 0.2, 3, 0.05),
          h("div.row", btn("Apply", commitAdj, "primary sm"), btn("Reset sliders", resetAdj, "ghost sm"), h("span.hint", { text: "sliders preview live; Apply commits to history" }))) },
      { id: "region", label: "Region & redact", render: () => h("div.col",
          h("p.hint", { text: "drag a rectangle on the image, then:" }),
          h("div.row", btn("⬛ Redact (black)", redact, "sm"), btn("▩ Pixelate region", pixelateSel, "sm"), btn("◌ Blur region", blurSel, "sm"), btn("Keep only region (clear outside)", cropOutside, "sm"), btn("⛶ Crop to region", op("crop", crop), "sm")),
          h("div.row", btn(eyedropper ? "◉ eyedropper on" : "◉ eyedropper", (e) => { eyedropper = !eyedropper; e.currentTarget.textContent = eyedropper ? "◉ eyedropper on" : "◉ eyedropper"; e.currentTarget.classList.toggle("on", eyedropper); stage.style.cursor = eyedropper ? "cell" : "crosshair"; }, "sm"), pickedOut)) },
      { id: "text", label: "Text & watermark", render: () => h("div.col",
          h("div.row", h("div", { style: { flex: 1, minWidth: "200px" } }, field("text", ovText)), field("size", ovSize), field("fill", ovColor), field("outline", ovStroke)),
          h("div.row", field("position", ovPos), field("font", ovFont), field("opacity", h("div", { style: { width: "120px" } }, ovOpacity)), btn("Add text", drawText, "primary sm")),
          h("p.hint", { text: "Impact + white/black outline = classic meme. 'Tiled watermark' repeats the text diagonally at low opacity." })) },
      { id: "more", label: "More", render: () => h("div.col",
          h("div.row", field("angle °", angleIn), btn("Rotate / straighten", rotateFree, "sm"), h("span.hint", { text: "small angles fix tilted scans; canvas grows to fit" })),
          h("div.row", h("span.label", { text: "resize & crop to preset" }), ...PRESETS.map(([n, w, hh]) => btn(`${n} ${w}×${hh}`, () => coverTo(w, hh), "ghost sm"))),
          h("div.row", btn("Append image → right", () => combine("h"), "sm"), btn("Append image ↓ below", () => combine("v"), "sm")),
          card("ASCII art", h("div.col", h("div.row", field("columns", asciiCols), h("label.check", asciiInv, "invert (for dark backgrounds)"), btn("Generate", makeAscii, "sm"), btn("Copy", () => copy(asciiOut.value), "ghost sm")), asciiOut)),
          card("OCR — image to text", h("div.col", h("div.row", field("language", ocrLang), btn("Extract text", runOcr, "primary sm"), btn("Copy", () => copy(ocrOut.value), "ghost sm"), ocrStatus), ocrOut, h("p.hint", { text: "Runs tesseract.js locally in a worker; the library and language pack are fetched from a CDN once, then cached. Crop to the text region first for better accuracy." })))) },
      { id: "exif", label: "EXIF", render: () => { const rows = describe(exifData); return h("div.col", rows.length ? tbl(["tag", "value"], rows) : out(originalFile ? "no EXIF metadata found (PNG/WebP rarely carry it; many apps strip it)" : "load a JPEG to read its metadata"), exifData?.latitude ? h("a.btn.sm", { href: `https://www.openstreetmap.org/?mlat=${exifData.latitude}&mlon=${exifData.longitude}#map=15/${exifData.latitude}/${exifData.longitude}`, target: "_blank", rel: "noopener", text: "📍 open GPS location on a map" }) : null, h("p.hint", { text: "Anything you export from here is re-encoded by the canvas and contains no EXIF — that's the easy way to strip location data before sharing." })); } },
      { id: "export", label: "Export", render: () => { updateExportEstimate(); return h("div.col",
          h("div.row", field("format", fmt), field("quality", h("div.row", { style: { flexWrap: "nowrap", width: "220px" } }, quality, qLabel)), field("filename", fileName), estimate),
          h("div.row", btn("↓ Download", doDownload, "primary sm"), btn("⧉ Copy PNG", copyImage, "sm"), btn("Copy as data URL", async () => copy(stage.toDataURL(fmt.value, +quality.value)), "sm"),
            btn("Favicon set (16→512)", favicons, "sm"), btn("Dominant colours", palette, "sm"),
            btn("Send to Sketchpad", () => { store.set("draw.import", stage.toDataURL("image/png")); navigate("draw"); }, "sm")),
          h("p.hint", { text: "Re-encoding through the canvas strips EXIF / GPS metadata automatically. JPEG and WebP quality affect the size estimate above." })); } },
      { id: "info", label: "Info", render: () => h("div.kv-list", kv("dimensions", `${stage.width} × ${stage.height}`), kv("megapixels", (stage.width * stage.height / 1e6).toFixed(2)), kv("original file", originalFile ? `${originalFile.name}` : "pasted / captured"),
          kv("original size", originalFile ? bytes(originalFile.size) : "—"), kv("type", originalFile?.type || "—"), kv("last modified", originalFile ? new Date(originalFile.lastModified).toLocaleString() : "—"),
          kv("uncompressed", bytes(stage.width * stage.height * 4)), kv("history steps", String(history.length))) },
    ], { remember: "image.tab" }));
    toolsCard.hidden = true;

    root.append(card("Image", h("div.col", actionBar, dropzone, stageWrap, historyStrip)), h("div", { style: { marginTop: "14px" } }, toolsCard));
    return () => { document.removeEventListener("trinket:file", onFile); document.removeEventListener("keydown", onKey); window.removeEventListener("resize", onResize); };
  },
});
