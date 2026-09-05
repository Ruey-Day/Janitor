import { h, defineTool, store, input, textarea, btn, card, copy, toast, subtabs, field, select, seg, out, kv, tbl, debounce } from "../core.js";
import * as C from "../lib/colorkit.js";

defineTool({
  id: "color", name: "Color Lab", icon: "◈", cat: "media",
  desc: "Convert between formats, build palettes & gradients, check WCAG contrast, simulate colour blindness.",
  tags: ["color", "colour", "hex", "rgb", "hsl", "palette", "contrast", "wcag", "gradient", "css", "accessibility", "shades", "tints"],
  mount(root) {
    let cur = C.parse(store.get("color.current", "#00e5ff"));
    const picker = input({ type: "color", value: C.toHex(cur), style: { width: "64px", height: "44px" } });
    const text = input({ value: C.toHex(cur), placeholder: "#hex, rgb(), hsl(), or a name", class: "mono" });
    const big = h("div", { style: { height: "90px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", display: "grid", placeItems: "center", fontFamily: "var(--mono)", fontSize: "18px", fontWeight: 800 } });
    const formats = h("div.kv-list");
    const harmonies = h("div.col");
    const shadesBox = h("div.swatch-grid");
    const cvd = h("div.swatch-grid");

    const swatch = (c, label) => h("div.swatch", { onclick: () => { setColor(c); toast("selected " + C.toHex(c)); } }, h("div.sw-color", { style: { background: C.toHex(c) } }), h("div.sw-label", { text: label || C.toHex(c) }));

    function setColor(c, fromText) {
      cur = c;
      const hex = C.toHex(c);
      store.set("color.current", hex);
      picker.value = hex;
      if (!fromText) text.value = hex;
      big.style.background = C.toRgbString(c); big.style.color = C.readableOn(c); big.textContent = hex.toUpperCase();
      const hsl = C.rgbToHsl(c.r, c.g, c.b), hsv = C.rgbToHsv(c.r, c.g, c.b), cmyk = C.rgbToCmyk(c.r, c.g, c.b), lab = C.rgbToLab(c.r, c.g, c.b);
      const rows = [
        ["HEX", hex], ["HEX + alpha", C.toHex(c, true) + (c.a < 1 ? "" : "ff")], ["RGB", C.toRgbString(c)],
        ["RGB %", `rgb(${(c.r / 2.55).toFixed(1)}% ${(c.g / 2.55).toFixed(1)}% ${(c.b / 2.55).toFixed(1)}%)`],
        ["HSL", `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`], ["HSV / HSB", `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`],
        ["CMYK", `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`], ["CIE Lab", `lab(${lab.l} ${lab.a} ${lab.b})`],
        ["Luminance", C.luminance(c).toFixed(4)], ["Decimal", String((Math.round(c.r) << 16) | (Math.round(c.g) << 8) | Math.round(c.b))],
        ["Swift", `Color(red: ${(c.r / 255).toFixed(3)}, green: ${(c.g / 255).toFixed(3)}, blue: ${(c.b / 255).toFixed(3)})`],
        ["Android", `0xFF${hex.slice(1).toUpperCase()}`], ["Contrast vs white", C.contrast(c, C.parse("#fff")) + ":1"], ["Contrast vs black", C.contrast(c, C.parse("#000")) + ":1"],
      ];
      formats.replaceChildren(...rows.map(([k, v]) => h("div.kv.copyable", { onclick: () => copy(v), title: "click to copy" }, h("b", { text: k }), h("span", { text: v }))));
      const hm = C.harmonies(c);
      harmonies.replaceChildren(...Object.entries(hm).map(([name, cols]) => h("div.col", { style: { gap: "6px" } }, h("span.label", { text: name.replace(/([A-Z])/g, " $1") }), h("div.swatch-grid", cols.map((x) => swatch(x))))));
      shadesBox.replaceChildren(...C.shades(c, 11).map((x, i) => swatch(x, `${(10 - i) * 10 || 5}`)));
      cvd.replaceChildren(swatch(c, "normal"), ...Object.keys(C.CVD).map((k) => swatch(C.simulate(c, k), k)));
    }
    picker.addEventListener("input", () => setColor(C.parse(picker.value)));
    text.addEventListener("input", debounce(() => { try { setColor(C.parse(text.value), true); text.classList.remove("err"); } catch { text.classList.add("err"); } }, 120));

    /* contrast checker */
    const fg = input({ type: "color", value: store.get("color.fg", "#dbe6ff"), style: { width: "64px" } });
    const bg = input({ type: "color", value: store.get("color.bg", "#04060d"), style: { width: "64px" } });
    const sample = h("div", { style: { padding: "18px", borderRadius: "var(--r-md)", border: "1px solid var(--line)" } },
      h("div", { style: { fontSize: "24px", fontWeight: 700 } }, "Large heading text"), h("div", { style: { fontSize: "14px", marginTop: "6px" } }, "Normal body text — the quick brown fox jumps over the lazy dog."), h("div", { style: { fontSize: "11px", marginTop: "6px" } }, "Small caption text"));
    const ratioOut = h("div.row");
    const runContrast = () => {
      store.set("color.fg", fg.value); store.set("color.bg", bg.value);
      const a = C.parse(fg.value), b = C.parse(bg.value), r = C.contrast(a, b);
      sample.style.color = fg.value; sample.style.background = bg.value;
      const chip = (label, ok) => h("span.chip", { class: ok ? "ok" : "bad", text: `${label} ${ok ? "✓" : "✗"}` });
      ratioOut.replaceChildren(h("span.chip", { text: `${r}:1` }), chip("AA normal", r >= 4.5), chip("AA large", r >= 3), chip("AAA normal", r >= 7), chip("AAA large", r >= 4.5), chip("UI components", r >= 3));
    };
    fg.addEventListener("input", runContrast); bg.addEventListener("input", runContrast);
    const suggest = () => { let c = C.parse(fg.value), b = C.parse(bg.value); const dark = C.luminance(b) < 0.5; for (let i = 0; i < 40 && C.contrast(c, b) < 4.5; i++) c = C.lighten(c, dark ? 3 : -3); fg.value = C.toHex(c); runContrast(); toast("adjusted foreground to " + fg.value); };

    /* gradient */
    let stops = store.get("color.stops", ["#00e5ff", "#ff2fd0"]);
    const angle = h("input", { type: "range", min: 0, max: 360, value: store.get("color.angle", 100) });
    const gType = seg([["linear", "linear"], ["radial", "radial"], ["conic", "conic"]], () => renderGrad(), "linear");
    const gPrev = h("div.gradient-preview");
    const gCss = out();
    const stopRow = h("div.row");
    const renderGrad = () => {
      store.set("color.stops", stops); store.set("color.angle", +angle.value);
      const list = stops.map((s, i) => `${s} ${Math.round((i / Math.max(1, stops.length - 1)) * 100)}%`).join(", ");
      const css = gType.value === "linear" ? `linear-gradient(${angle.value}deg, ${list})` : gType.value === "radial" ? `radial-gradient(circle, ${list})` : `conic-gradient(from ${angle.value}deg, ${list})`;
      gPrev.style.background = css; gCss.textContent = `background: ${css};`;
      stopRow.replaceChildren(...stops.map((s, i) => { const inp = input({ type: "color", value: s, style: { width: "48px" } }); inp.oninput = () => { stops[i] = inp.value; renderGrad(); }; return h("div.row.tight", inp, stops.length > 2 ? btn("✕", () => { stops.splice(i, 1); renderGrad(); }, "ghost sm") : null); }),
        stops.length < 6 ? btn("+ stop", () => { stops.push(C.toHex(C.randomColor())); renderGrad(); }, "ghost sm") : null,
        btn("reverse", () => { stops.reverse(); renderGrad(); }, "ghost sm"), btn("random", () => { stops = stops.map(() => C.toHex(C.randomColor())); renderGrad(); }, "ghost sm"));
    };
    angle.addEventListener("input", renderGrad);

    /* palette generator */
    let pal = store.get("color.palette", null) || Array.from({ length: 5 }, () => C.toHex(C.randomColor()));
    let locks = pal.map(() => false);
    const palBox = h("div.swatch-grid");
    const palOut = out();
    const renderPal = () => {
      store.set("color.palette", pal);
      palBox.replaceChildren(...pal.map((c, i) => h("div.swatch", h("div.sw-color", { style: { background: c, height: "90px" }, onclick: () => setColor(C.parse(c)) }),
        h("div.sw-label.row.tight", { style: { justifyContent: "center" } }, h("span", { text: c }), h("span", { text: locks[i] ? "🔒" : "🔓", style: { cursor: "pointer" }, title: "lock", onclick: () => { locks[i] = !locks[i]; renderPal(); } })))));
      palOut.textContent = `:root {\n${pal.map((c, i) => `  --color-${i + 1}: ${c};`).join("\n")}\n}`;
    };
    const shuffle = (mode) => {
      const base = C.parse(pal[locks.indexOf(true)] ?? pal[0]);
      const hm = C.harmonies(mode === "random" ? C.randomColor() : base);
      const src = mode === "random" ? Array.from({ length: pal.length }, C.randomColor) : mode === "mono" ? hm.monochromatic : mode === "analog" ? [...hm.analogous, ...hm.monochromatic] : [...hm.triadic, ...hm.splitComplementary];
      pal = pal.map((c, i) => (locks[i] ? c : C.toHex(src[i % src.length])));
      renderPal();
    };

    /* mixer */
    const mixA = input({ type: "color", value: "#00e5ff", style: { width: "56px" } }), mixB = input({ type: "color", value: "#ff2fd0", style: { width: "56px" } });
    const mixSteps = input({ type: "number", value: 7, min: 2, max: 20, style: { width: "80px" } });
    const mixBox = h("div.swatch-grid");
    const renderMix = () => { const a = C.parse(mixA.value), b = C.parse(mixB.value), n = +mixSteps.value; mixBox.replaceChildren(...Array.from({ length: n }, (_, i) => swatch(C.mix(a, b, i / (n - 1))))); };
    [mixA, mixB, mixSteps].forEach((el) => el.addEventListener("input", renderMix));

    root.append(
      h("div.split",
        h("div.col",
          card("Pick", h("div.col", h("div.row", picker, h("div", { style: { flex: 1 } }, text), btn("random", () => setColor(C.randomColor()), "ghost sm"), btn("lighter", () => setColor(C.lighten(cur, 8)), "ghost sm"), btn("darker", () => setColor(C.lighten(cur, -8)), "ghost sm"), btn("desaturate", () => setColor(C.saturate(cur, -15)), "ghost sm"), btn("rotate 30°", () => setColor(C.rotate(cur, 30)), "ghost sm"), btn("invert", () => setColor({ r: 255 - cur.r, g: 255 - cur.g, b: 255 - cur.b, a: 1 }), "ghost sm")), big, formats)),
          card("Explore", subtabs([
            { id: "harm", label: "Harmonies", render: () => harmonies },
            { id: "shades", label: "Shades", render: () => h("div.col", shadesBox, btn("Copy as CSS scale", () => copy(C.shades(cur, 11).map((x, i) => `--shade-${(10 - i) * 10 || 5}: ${C.toHex(x)};`).join("\n")), "ghost sm")) },
            { id: "cvd", label: "Colour blindness", render: () => cvd },
            { id: "mix", label: "Mixer", render: () => { renderMix(); return h("div.col", h("div.row", mixA, h("span.mono", { text: "→" }), mixB, field("steps", mixSteps)), mixBox); } },
          ], { remember: "color.tab" }))),
        h("div.col",
          card("Contrast checker", h("div.col", h("div.row", field("text", fg), field("background", bg), btn("swap", () => { [fg.value, bg.value] = [bg.value, fg.value]; runContrast(); }, "ghost sm"), btn("fix to AA", suggest, "ghost sm"), btn("use picked as text", () => { fg.value = C.toHex(cur); runContrast(); }, "ghost sm")), sample, ratioOut)),
          card("Gradient", h("div.col", gPrev, h("div.row", gType, h("div", { style: { flex: 1, minWidth: "140px" } }, angle)), stopRow, gCss), [btn("Copy CSS", () => copy(gCss.textContent), "ghost sm")]),
          card("Palette", h("div.col", palBox, h("div.row", btn("random", () => shuffle("random"), "sm"), btn("monochrome", () => shuffle("mono"), "sm"), btn("analogous", () => shuffle("analog"), "sm"), btn("triadic", () => shuffle("tri"), "sm"), btn("+", () => { pal.push(C.toHex(C.randomColor())); locks.push(false); renderPal(); }, "ghost sm"), btn("−", () => { if (pal.length > 2) { pal.pop(); locks.pop(); renderPal(); } }, "ghost sm")), palOut),
            [btn("Copy CSS vars", () => copy(palOut.textContent), "ghost sm"), btn("Copy JSON", () => copy(JSON.stringify(pal)), "ghost sm")]))));
    setColor(cur); runContrast(); renderGrad(); renderPal();
  },
});
