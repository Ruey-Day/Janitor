import { h, defineTool, store, input, textarea, btn, card, copy, toast, subtabs, field, select, seg, out, kv, tbl, debounce, round } from "../core.js";

const slider = (label, min, max, val, step = 1, onchange) => { const r = h("input", { type: "range", min, max, step, value: val }); const v = h("span.mono", { text: String(val), style: { width: "48px", textAlign: "right", fontSize: "11px" } }); r.addEventListener("input", () => { v.textContent = r.value; onchange(); }); const row = h("div.row", { style: { flexWrap: "nowrap" } }, h("span.label", { text: label, style: { width: "110px", flex: "none" } }), r, v); row.value = () => +r.value; return row; };
const colorIn = (val, onchange) => { const i = input({ type: "color", value: val, style: { width: "44px" } }); i.addEventListener("input", onchange); return i; };
const preview = (extra = {}) => h("div", { style: { minHeight: "170px", display: "grid", placeItems: "center", padding: "24px", borderRadius: "12px", background: "var(--bg-2)", border: "1px solid var(--line)", ...extra } });

defineTool({
  id: "css", name: "CSS Studio", icon: "{;}", cat: "media",
  desc: "Generators for shadows, radius, filters, transforms, easing curves, glass cards, fluid type, type scales.",
  tags: ["css", "box shadow", "border radius", "text shadow", "filter", "transform", "cubic bezier", "easing", "glassmorphism", "clamp", "fluid typography", "type scale", "rem", "aspect ratio", "triangle", "font"],
  mount(root) {
    const cssBox = out("", "mono");
    const emit = (css) => { cssBox.textContent = css; };

    /* box shadow */
    const boxShadow = () => {
      let layers = store.get("css.shadows", [{ x: 0, y: 12, blur: 30, spread: -6, color: "#000000", alpha: 0.45, inset: false }]);
      const box = h("div", { style: { width: "160px", height: "110px", borderRadius: "14px", background: "var(--panel-solid)" } });
      const pv = preview(); pv.append(box);
      const list = h("div.col");
      const hex2rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; };
      const render = () => {
        store.set("css.shadows", layers);
        const css = layers.map((l) => `${l.inset ? "inset " : ""}${l.x}px ${l.y}px ${l.blur}px ${l.spread}px ${hex2rgba(l.color, l.alpha)}`).join(",\n  ");
        box.style.boxShadow = css.replace(/\n\s*/g, " "); emit(`box-shadow: ${css};`);
        list.replaceChildren(...layers.map((l, i) => { const upd = () => { l.x = sx.value(); l.y = sy.value(); l.blur = sb.value(); l.spread = ss.value(); l.alpha = sa.value(); render(); };
          const sx = slider("x", -60, 60, l.x, 1, upd), sy = slider("y", -60, 60, l.y, 1, upd), sb = slider("blur", 0, 120, l.blur, 1, upd), ss = slider("spread", -40, 40, l.spread, 1, upd), sa = slider("opacity", 0, 1, l.alpha, 0.01, upd);
          return h("div.col", { style: { padding: "10px", border: "1px solid var(--line)", borderRadius: "10px" } }, h("div.row", h("span.label", { text: `layer ${i + 1}` }), colorIn(l.color, (e) => { l.color = e.target.value; render(); }), h("label.check", h("input", { type: "checkbox", checked: l.inset, onchange: (e) => { l.inset = e.target.checked; render(); } }), "inset"), h("span.spacer"), layers.length > 1 ? btn("✕", () => { layers.splice(i, 1); render(); }, "ghost sm danger") : null), sx, sy, sb, ss, sa); }));
      };
      render();
      const presets = { soft: [{ x: 0, y: 4, blur: 14, spread: 0, color: "#000000", alpha: 0.18, inset: false }], layered: [{ x: 0, y: 1, blur: 2, spread: 0, color: "#000000", alpha: 0.12, inset: false }, { x: 0, y: 4, blur: 8, spread: 0, color: "#000000", alpha: 0.12, inset: false }, { x: 0, y: 16, blur: 32, spread: 0, color: "#000000", alpha: 0.14, inset: false }], neon: [{ x: 0, y: 0, blur: 18, spread: 0, color: "#00e5ff", alpha: 0.7, inset: false }, { x: 0, y: 0, blur: 48, spread: 0, color: "#ff2fd0", alpha: 0.45, inset: false }], hard: [{ x: 8, y: 8, blur: 0, spread: 0, color: "#000000", alpha: 1, inset: false }], inner: [{ x: 0, y: 2, blur: 10, spread: 0, color: "#000000", alpha: 0.5, inset: true }] };
      return h("div.col", pv, h("div.row", ...Object.entries(presets).map(([k, v]) => btn(k, () => { layers = structuredClone(v); render(); }, "ghost sm")), btn("+ layer", () => { layers.push({ x: 0, y: 8, blur: 24, spread: 0, color: "#000000", alpha: 0.3, inset: false }); render(); }, "sm")), list);
    };

    /* border radius */
    const radius = () => {
      const box = h("div", { style: { width: "200px", height: "140px", background: "linear-gradient(120deg, var(--a1), var(--a2))" } });
      const pv = preview(); pv.append(box);
      const vals = { tl: 24, tr: 24, br: 24, bl: 24 }; const ell = { tl: 24, tr: 24, br: 24, bl: 24 };
      const link = h("input", { type: "checkbox", checked: true });
      const elliptical = h("input", { type: "checkbox" });
      const sl = {};
      const render = () => { if (link.checked) { const v = sl.tl.value(); for (const k in vals) vals[k] = v; } else for (const k in vals) vals[k] = sl[k].value(); const css = elliptical.checked ? `${vals.tl}px ${vals.tr}px ${vals.br}px ${vals.bl}px / ${ell.tl}px ${ell.tr}px ${ell.br}px ${ell.bl}px` : `${vals.tl}px ${vals.tr}px ${vals.br}px ${vals.bl}px`; box.style.borderRadius = css; emit(`border-radius: ${css};`); };
      for (const k of ["tl", "tr", "br", "bl"]) sl[k] = slider({ tl: "top-left", tr: "top-right", br: "bottom-right", bl: "bottom-left" }[k], 0, 120, 24, 1, render);
      const esl = ["tl", "tr", "br", "bl"].map((k) => slider("ellipse " + k, 0, 120, 24, 1, () => { ell[k] = esl[["tl", "tr", "br", "bl"].indexOf(k)].value(); render(); }));
      link.addEventListener("change", render); elliptical.addEventListener("change", render); render();
      return h("div.col", pv, h("div.row", h("label.check", link, "link all corners"), h("label.check", elliptical, "elliptical (blob)"), btn("pill", () => { for (const k in sl) { sl[k].querySelector("input").value = 120; } render(); }, "ghost sm"), btn("random blob", () => { elliptical.checked = true; link.checked = false; for (const k of ["tl", "tr", "br", "bl"]) sl[k].querySelector("input").value = 30 + Math.random() * 70; esl.forEach((s) => (s.querySelector("input").value = 30 + Math.random() * 70)); esl.forEach((s, i) => (ell[["tl", "tr", "br", "bl"][i]] = s.value())); render(); }, "ghost sm")), ...Object.values(sl), h("details", h("summary.hint", { text: "elliptical radii" }), ...esl));
    };

    /* text shadow */
    const textShadow = () => {
      const t = h("div", { text: "Trinket", style: { fontSize: "56px", fontWeight: 800, fontFamily: "var(--mono)", color: "var(--text-hi)" } });
      const pv = preview(); pv.append(t);
      let color = "#00e5ff";
      const render = () => { const css = `${sx.value()}px ${sy.value()}px ${sb.value()}px ${color}`; t.style.textShadow = css; emit(`text-shadow: ${css};`); };
      const sx = slider("x", -30, 30, 0, 1, render), sy = slider("y", -30, 30, 0, 1, render), sb = slider("blur", 0, 60, 18, 1, render);
      render();
      return h("div.col", pv, h("div.row", field("colour", colorIn(color, (e) => { color = e.target.value; render(); })), btn("glow", () => { sx.querySelector("input").value = 0; sy.querySelector("input").value = 0; sb.querySelector("input").value = 24; render(); }, "ghost sm"), btn("long shadow", () => { const css = Array.from({ length: 24 }, (_, i) => `${i + 1}px ${i + 1}px 0 rgba(0,0,0,${0.3 - i * 0.01})`).join(", "); t.style.textShadow = css; emit(`text-shadow: ${css};`); }, "ghost sm"), btn("3d", () => { const css = Array.from({ length: 6 }, (_, i) => `0 ${i + 1}px 0 ${color}`).join(", ") + ", 0 8px 14px rgba(0,0,0,.5)"; t.style.textShadow = css; emit(`text-shadow: ${css};`); }, "ghost sm")), sx, sy, sb);
    };

    /* filter */
    const filter = () => {
      const img = h("div", { style: { width: "220px", height: "140px", borderRadius: "12px", background: "linear-gradient(135deg, #ff2fd0, #00e5ff 50%, #9dff4f)" } });
      const pv = preview(); pv.append(img);
      const parts = [["blur", 0, 20, 0, "px"], ["brightness", 0, 200, 100, "%"], ["contrast", 0, 200, 100, "%"], ["grayscale", 0, 100, 0, "%"], ["hue-rotate", 0, 360, 0, "deg"], ["invert", 0, 100, 0, "%"], ["opacity", 0, 100, 100, "%"], ["saturate", 0, 300, 100, "%"], ["sepia", 0, 100, 0, "%"]];
      const sls = parts.map(([n, lo, hi, d, u]) => { const s = slider(n, lo, hi, d, 1, () => render()); s.unit = u; s.def = d; s.name = n; return s; });
      const render = () => { const css = sls.filter((s) => s.value() !== s.def).map((s) => `${s.name}(${s.value()}${s.unit})`).join(" ") || "none"; img.style.filter = css; emit(`filter: ${css};`); };
      render();
      return h("div.col", pv, btn("reset", () => { sls.forEach((s) => { s.querySelector("input").value = s.def; s.querySelector("span.mono").textContent = s.def; }); render(); }, "ghost sm"), ...sls);
    };

    /* transform */
    const transform = () => {
      const box = h("div", { text: "box", style: { width: "120px", height: "90px", display: "grid", placeItems: "center", borderRadius: "10px", background: "var(--a1)", color: "#000", fontFamily: "var(--mono)", fontWeight: 700 } });
      const pv = preview(); pv.append(box);
      const render = () => { const css = `rotate(${r.value()}deg) scale(${sc.value()}) skew(${skx.value()}deg, ${sky.value()}deg) translate(${tx.value()}px, ${ty.value()}px)`; box.style.transform = css; emit(`transform: ${css};`); };
      const r = slider("rotate", -180, 180, 0, 1, render), sc = slider("scale", 0.1, 3, 1, 0.05, render), skx = slider("skew x", -60, 60, 0, 1, render), sky = slider("skew y", -60, 60, 0, 1, render), tx = slider("translate x", -100, 100, 0, 1, render), ty = slider("translate y", -100, 100, 0, 1, render);
      render();
      return h("div.col", pv, r, sc, skx, sky, tx, ty);
    };

    /* easing */
    const easing = () => {
      let p = store.get("css.bezier", [0.25, 0.1, 0.25, 1]);
      const size = 260;
      const c = h("canvas", { width: size, height: size, style: { borderRadius: "12px", border: "1px solid var(--line)", background: "var(--bg-2)", cursor: "grab", touchAction: "none" } });
      const ball = h("div", { style: { width: "26px", height: "26px", borderRadius: "50%", background: "var(--a1)", position: "relative", left: "0" } });
      const track = h("div", { style: { flex: 1, height: "26px", position: "relative" } }, ball);
      const pv = preview({ minHeight: "60px", display: "block" }); pv.append(track);
      const ctx = c.getContext("2d");
      const pad = 30;
      const toPx = (x, y) => [pad + x * (size - 2 * pad), size - pad - y * (size - 2 * pad)];
      const draw = () => { ctx.clearRect(0, 0, size, size); ctx.strokeStyle = "rgba(120,180,255,.2)"; ctx.strokeRect(pad, pad, size - 2 * pad, size - 2 * pad); const [x0, y0] = toPx(0, 0), [x3, y3] = toPx(1, 1), [x1, y1] = toPx(p[0], p[1]), [x2, y2] = toPx(p[2], p[3]); ctx.strokeStyle = "#7d8bad"; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.moveTo(x3, y3); ctx.lineTo(x2, y2); ctx.stroke(); ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--a1"); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo(x1, y1, x2, y2, x3, y3); ctx.stroke(); ctx.lineWidth = 1; for (const [x, y, col] of [[x1, y1, "#ff2fd0"], [x2, y2, "#9dff4f"]]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); } emit(`transition-timing-function: cubic-bezier(${p.map((v) => round(v, 3)).join(", ")});`); ball.style.transition = `left 1.2s cubic-bezier(${p.join(",")})`; store.set("css.bezier", p); };
      let dragIdx = -1;
      c.addEventListener("pointerdown", (e) => { const r = c.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; const d = (i) => { const [px, py] = toPx(p[i * 2], p[i * 2 + 1]); return Math.hypot(px - x, py - y); }; dragIdx = d(0) < d(1) ? 0 : 1; c.setPointerCapture(e.pointerId); });
      c.addEventListener("pointermove", (e) => { if (dragIdx < 0) return; const r = c.getBoundingClientRect(); p[dragIdx * 2] = Math.min(1, Math.max(0, (e.clientX - r.left - pad) / (size - 2 * pad))); p[dragIdx * 2 + 1] = Math.min(1.5, Math.max(-0.5, (size - pad - (e.clientY - r.top)) / (size - 2 * pad))); draw(); });
      c.addEventListener("pointerup", () => (dragIdx = -1));
      const presets = { linear: [0, 0, 1, 1], ease: [0.25, 0.1, 0.25, 1], "ease-in": [0.42, 0, 1, 1], "ease-out": [0, 0, 0.58, 1], "ease-in-out": [0.42, 0, 0.58, 1], "snappy": [0.2, 0.8, 0.2, 1], "back": [0.34, 1.56, 0.64, 1], "expo-out": [0.16, 1, 0.3, 1], "circ-in-out": [0.85, 0, 0.15, 1] };
      draw();
      let side = false;
      return h("div.col", h("div.row", { style: { alignItems: "flex-start" } }, c, h("div.col", { style: { flex: 1 } }, h("div.row.tight", ...Object.entries(presets).map(([k, v]) => btn(k, () => { p = [...v]; draw(); }, "ghost sm"))), pv, btn("▶ play", () => { side = !side; ball.style.left = side ? "calc(100% - 26px)" : "0"; }, "sm"), h("p.hint", { text: "drag the pink / green handles" }))));
    };

    /* glass */
    const glass = () => {
      const cardEl = h("div", { style: { width: "260px", padding: "22px", color: "#fff", fontFamily: "var(--sans)" } }, h("div", { text: "Glass card", style: { fontWeight: 700, fontSize: "18px" } }), h("div", { text: "backdrop-filter blur + translucent fill + hairline border", style: { fontSize: "12px", opacity: 0.8, marginTop: "6px" } }));
      const pv = preview({ background: "linear-gradient(135deg, #ff2fd0, #00e5ff 55%, #9dff4f)" }); pv.append(cardEl);
      let tint = "#ffffff";
      const render = () => { const a = op.value() / 100; const css = `background: rgba(${parseInt(tint.slice(1, 3), 16)}, ${parseInt(tint.slice(3, 5), 16)}, ${parseInt(tint.slice(5, 7), 16)}, ${a});\nbackdrop-filter: blur(${bl.value()}px) saturate(${sat.value()}%);\n-webkit-backdrop-filter: blur(${bl.value()}px) saturate(${sat.value()}%);\nborder: 1px solid rgba(255, 255, 255, ${bo.value() / 100});\nborder-radius: ${rad.value()}px;\nbox-shadow: 0 8px 32px rgba(0, 0, 0, ${sh.value() / 100});`; cardEl.style.cssText += css.replace(/\n/g, ""); emit(css); };
      const bl = slider("blur", 0, 40, 14, 1, render), op = slider("fill opacity", 0, 100, 18, 1, render), sat = slider("saturate", 50, 250, 140, 1, render), bo = slider("border alpha", 0, 100, 35, 1, render), rad = slider("radius", 0, 40, 16, 1, render), sh = slider("shadow", 0, 100, 30, 1, render);
      render();
      return h("div.col", pv, field("tint", colorIn(tint, (e) => { tint = e.target.value; render(); })), bl, op, sat, bo, rad, sh);
    };

    /* fluid type / clamp */
    const fluid = () => {
      const minPx = input({ type: "number", value: 16, class: "mono" }), maxPx = input({ type: "number", value: 28, class: "mono" }), minVw = input({ type: "number", value: 360, class: "mono" }), maxVw = input({ type: "number", value: 1280, class: "mono" });
      const res = out();
      const calc = () => { const a = +minPx.value, b = +maxPx.value, va = +minVw.value, vb = +maxVw.value; const slope = (b - a) / (vb - va); const y = a - slope * va; const css = `font-size: clamp(${a / 16}rem, ${round(y / 16, 3)}rem + ${round(slope * 100, 3)}vw, ${b / 16}rem);`; res.textContent = css; emit(css); };
      [minPx, maxPx, minVw, maxVw].forEach((i) => i.addEventListener("input", calc)); calc();
      return h("div.col", h("div.row", field("min px", minPx), field("max px", maxPx), field("at viewport ≥", minVw), field("up to viewport", maxVw)), res, h("p.hint", { text: "Linear interpolation between the two sizes across the viewport range — works for spacing too." }));
    };

    /* type scale */
    const scale = () => {
      const base = input({ type: "number", value: 16, class: "mono" }), ratio = select([["1.067", "minor second 1.067"], ["1.125", "major second 1.125"], ["1.2", "minor third 1.2"], ["1.25", "major third 1.25"], ["1.333", "perfect fourth 1.333"], ["1.414", "augmented fourth 1.414"], ["1.5", "perfect fifth 1.5"], ["1.618", "golden ratio 1.618"]], { value: "1.25" });
      const list = h("div.col");
      const render = () => { const b = +base.value, r = +ratio.value; const steps = [-2, -1, 0, 1, 2, 3, 4, 5, 6]; const rows = steps.map((s) => ({ s, px: b * r ** s })); list.replaceChildren(...rows.reverse().map(({ s, px }) => h("div.list-item", h("span.hint", { text: `step ${s}`, style: { width: "60px" } }), h("span.mono", { text: `${round(px, 2)}px · ${round(px / 16, 3)}rem`, style: { width: "170px" } }), h("span", { text: "The quick brown fox", style: { fontSize: px + "px", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } })))); emit(`:root {\n${rows.reverse().map(({ s, px }) => `  --step-${s}: ${round(px / 16, 3)}rem;`).join("\n")}\n}`); };
      base.addEventListener("input", render); ratio.addEventListener("change", render); render();
      return h("div.col", h("div.row", field("base px", base), field("ratio", ratio)), list);
    };

    /* units & aspect */
    const units = () => {
      const px = input({ type: "number", value: 24, class: "mono" }), rootPx = input({ type: "number", value: 16, class: "mono" }), parentPx = input({ type: "number", value: 16, class: "mono" }), vw = input({ type: "number", value: 1440, class: "mono" });
      const uo = h("div.kv-list");
      const ru = () => { const p = +px.value; uo.replaceChildren(kv("rem", round(p / +rootPx.value, 4) + "rem"), kv("em", round(p / +parentPx.value, 4) + "em"), kv("vw", round((p / +vw.value) * 100, 4) + "vw"), kv("pt", round(p * 0.75, 3) + "pt"), kv("%", round((p / +parentPx.value) * 100, 3) + "%")); };
      [px, rootPx, parentPx, vw].forEach((i) => i.addEventListener("input", ru)); ru();
      const w = input({ type: "number", value: 1920, class: "mono" }), hgt = input({ type: "number", value: 1080, class: "mono" }), targetW = input({ type: "number", value: 800, class: "mono" });
      const ao = h("div.kv-list");
      const ra = () => { const a = +w.value, b = +hgt.value; const g = (x, y) => (y ? g(y, x % y) : x); const d = g(a, b); ao.replaceChildren(kv("ratio", `${a / d}:${b / d}`), kv("decimal", round(a / b, 4)), kv("css", `aspect-ratio: ${a / d} / ${b / d};`), kv("padding hack", `padding-top: ${round((b / a) * 100, 3)}%;`), kv(`height at ${targetW.value}px wide`, round((+targetW.value * b) / a, 1) + "px"), kv("diagonal", round(Math.hypot(a, b), 1))); };
      [w, hgt, targetW].forEach((i) => i.addEventListener("input", ra)); ra();
      const diag = input({ type: "number", value: 27, step: 0.1, class: "mono" }), rw = input({ type: "number", value: 2560, class: "mono" }), rh = input({ type: "number", value: 1440, class: "mono" });
      const po = h("div.kv-list");
      const rp = () => { const ppi = Math.hypot(+rw.value, +rh.value) / +diag.value; po.replaceChildren(kv("PPI", round(ppi, 1)), kv("dot pitch", round(25.4 / ppi, 3) + " mm"), kv("physical width", round((+rw.value / ppi) * 2.54, 1) + " cm"), kv("physical height", round((+rh.value / ppi) * 2.54, 1) + " cm"), kv("total pixels", (+rw.value * +rh.value / 1e6).toFixed(2) + " MP")); };
      [diag, rw, rh].forEach((i) => i.addEventListener("input", rp)); rp();
      return h("div.grid.g2", card("px → rem / em / vw", h("div.col", h("div.row", field("px", px), field("root font px", rootPx), field("parent px", parentPx), field("viewport px", vw)), uo)), card("Aspect ratio", h("div.col", h("div.row", field("width", w), field("height", hgt), field("target width", targetW)), ao)), card("Screen PPI", h("div.col", h("div.row", field("diagonal in", diag), field("res width", rw), field("res height", rh)), po)));
    };

    /* triangle */
    const triangle = () => {
      const tri = h("div"); const pv = preview(); pv.append(tri);
      let color = "#00e5ff";
      const dir = seg([["up", "▲ up"], ["down", "▼ down"], ["left", "◀ left"], ["right", "▶ right"], ["top-left", "◤"], ["top-right", "◥"]], () => render(), "up");
      const render = () => { const w = sw.value(), hh = sh.value(); let css; if (dir.value === "up") css = `width: 0; height: 0;\nborder-left: ${w / 2}px solid transparent;\nborder-right: ${w / 2}px solid transparent;\nborder-bottom: ${hh}px solid ${color};`; else if (dir.value === "down") css = `width: 0; height: 0;\nborder-left: ${w / 2}px solid transparent;\nborder-right: ${w / 2}px solid transparent;\nborder-top: ${hh}px solid ${color};`; else if (dir.value === "left") css = `width: 0; height: 0;\nborder-top: ${hh / 2}px solid transparent;\nborder-bottom: ${hh / 2}px solid transparent;\nborder-right: ${w}px solid ${color};`; else if (dir.value === "right") css = `width: 0; height: 0;\nborder-top: ${hh / 2}px solid transparent;\nborder-bottom: ${hh / 2}px solid transparent;\nborder-left: ${w}px solid ${color};`; else if (dir.value === "top-left") css = `width: 0; height: 0;\nborder-top: ${hh}px solid ${color};\nborder-right: ${w}px solid transparent;`; else css = `width: 0; height: 0;\nborder-top: ${hh}px solid ${color};\nborder-left: ${w}px solid transparent;`; tri.style.cssText = css.replace(/\n/g, ""); emit(css + `\n/* or */ clip-path: polygon(50% 0, 100% 100%, 0 100%); width: ${w}px; height: ${hh}px; background: ${color};`); };
      const sw = slider("width", 10, 300, 120, 1, render), sh = slider("height", 10, 300, 90, 1, render);
      render();
      return h("div.col", pv, h("div.row", dir, field("colour", colorIn(color, (e) => { color = e.target.value; render(); }))), sw, sh);
    };

    /* font tester */
    const fonts = () => {
      const sample = input({ value: "The quick brown fox jumps over the lazy dog 0123456789" });
      const fam = select([["system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", "system stack"], ["Inter, system-ui, sans-serif", "Inter"], ["'Helvetica Neue', Helvetica, Arial, sans-serif", "Helvetica / Arial"], ["Georgia, 'Times New Roman', serif", "Georgia / Times"], ["'Iowan Old Style', 'Palatino Linotype', Palatino, serif", "Palatino"], ["ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", "monospace"], ["'JetBrains Mono', monospace", "JetBrains Mono"], ["'Space Grotesk', sans-serif", "Space Grotesk"], ["'Comic Sans MS', cursive", "Comic Sans"], ["Impact, 'Arial Black', sans-serif", "Impact"], ["'Courier New', Courier, monospace", "Courier"], ["Verdana, Geneva, sans-serif", "Verdana"], ["'Trebuchet MS', sans-serif", "Trebuchet"], ["Garamond, serif", "Garamond"]]);
      const custom = input({ placeholder: "or type any installed font name" });
      const pv = h("div", { style: { padding: "24px", borderRadius: "12px", border: "1px solid var(--line)", background: "var(--bg-2)", color: "var(--text-hi)", wordBreak: "break-word" } });
      const render = () => { const f = custom.value.trim() ? `'${custom.value.trim()}', ${fam.value}` : fam.value; pv.textContent = sample.value; Object.assign(pv.style, { fontFamily: f, fontSize: fs.value() + "px", fontWeight: fw.value(), letterSpacing: ls.value() / 100 + "em", lineHeight: lh.value(), fontStyle: it.checked ? "italic" : "normal" }); emit(`font-family: ${f};\nfont-size: ${fs.value()}px;\nfont-weight: ${fw.value()};\nfont-style: ${it.checked ? "italic" : "normal"};\nletter-spacing: ${ls.value() / 100}em;\nline-height: ${lh.value()};`); };
      const fs = slider("size", 8, 120, 32, 1, render), fw = slider("weight", 100, 900, 400, 100, render), ls = slider("tracking", -10, 40, 0, 1, render), lh = slider("line height", 0.8, 2.4, 1.3, 0.05, render);
      const it = h("input", { type: "checkbox", onchange: render });
      [sample, fam, custom].forEach((i) => i.addEventListener("input", render)); render();
      const localBtn = btn("list installed fonts", async () => { if (!window.queryLocalFonts) return toast("Local Font Access API not available here", "bad"); try { const fs2 = await window.queryLocalFonts(); const names = [...new Set(fs2.map((f) => f.family))].sort(); fam.replaceChildren(...names.map((n) => h("option", { value: `'${n}'`, text: n }))); toast(`${names.length} families`, "ok"); } catch (e) { toast(e.message, "bad"); } }, "ghost sm");
      return h("div.col", sample, h("div.row", field("family", fam), field("custom", custom), h("label.check", it, "italic"), localBtn), pv, fs, fw, ls, lh);
    };

    root.append(
      h("div.split",
        subtabs([
          { id: "shadow", label: "Box shadow", render: boxShadow }, { id: "radius", label: "Radius", render: radius }, { id: "text", label: "Text shadow", render: textShadow },
          { id: "filter", label: "Filter", render: filter }, { id: "transform", label: "Transform", render: transform }, { id: "easing", label: "Easing", render: easing },
          { id: "glass", label: "Glass", render: glass }, { id: "fluid", label: "Fluid type", render: fluid }, { id: "scale", label: "Type scale", render: scale },
          { id: "units", label: "Units & ratios", render: units }, { id: "tri", label: "Triangle", render: triangle }, { id: "fonts", label: "Font tester", render: fonts },
        ], { remember: "css.tab" }),
        card("CSS", cssBox, [btn("Copy", () => copy(cssBox.textContent), "ghost sm")])));
  },
});
