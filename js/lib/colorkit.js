/* Colour parsing, conversion, contrast and palette maths. */
"use strict";

export const NAMED = {
  black: "#000000", white: "#ffffff", red: "#ff0000", lime: "#00ff00", blue: "#0000ff",
  yellow: "#ffff00", cyan: "#00ffff", magenta: "#ff00ff", silver: "#c0c0c0", gray: "#808080",
  maroon: "#800000", olive: "#808000", green: "#008000", purple: "#800080", teal: "#008080",
  navy: "#000080", orange: "#ffa500", pink: "#ffc0cb", brown: "#a52a2a", gold: "#ffd700",
  indigo: "#4b0082", violet: "#ee82ee", coral: "#ff7f50", salmon: "#fa8072", khaki: "#f0e68c",
  crimson: "#dc143c", tomato: "#ff6347", orchid: "#da70d6", plum: "#dda0dd", turquoise: "#40e0d0",
  slategray: "#708090", steelblue: "#4682b4", skyblue: "#87ceeb", seagreen: "#2e8b57",
  forestgreen: "#228b22", chocolate: "#d2691e", tan: "#d2b48c", beige: "#f5f5dc", ivory: "#fffff0",
  lavender: "#e6e6fa", mint: "#98ff98", peach: "#ffe5b4", rebeccapurple: "#663399",
};

const hex2 = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Parse hex / rgb() / hsl() / named → {r,g,b,a} 0-255 (a 0-1). */
export function parse(str) {
  let s = String(str).trim().toLowerCase();
  if (NAMED[s]) s = NAMED[s];
  let m;
  if ((m = /^#?([0-9a-f]{3,8})$/i.exec(s))) {
    let hex = m[1];
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join("");
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      };
    }
  }
  if ((m = /^rgba?\(([^)]+)\)$/.exec(s))) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] > 1 ? p[3] / 100 : p[3] };
  }
  if ((m = /^hsla?\(([^)]+)\)$/.exec(s))) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    const hsl = { h: parseFloat(p[0]), s: parseFloat(p[1]), l: parseFloat(p[2]) };
    const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    rgb.a = p[3] === undefined ? 1 : parseFloat(p[3]) > 1 ? parseFloat(p[3]) / 100 : parseFloat(p[3]);
    return rgb;
  }
  throw new Error("cannot parse colour: " + str);
}

export const toHex = ({ r, g, b, a = 1 }, withAlpha = false) =>
  "#" + hex2(r) + hex2(g) + hex2(b) + (withAlpha && a < 1 ? hex2(a * 255) : "");
export const toRgbString = ({ r, g, b, a = 1 }) =>
  a < 1 ? `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${+a.toFixed(3)})`
        : `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h: +h.toFixed(1), s: +(s * 100).toFixed(1), l: +(l * 100).toFixed(1) };
}
export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60) % 6];
  return { r: Math.round((seg[0] + m) * 255), g: Math.round((seg[1] + m) * 255), b: Math.round((seg[2] + m) * 255), a: 1 };
}
export function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h: +h.toFixed(1), s: +((max ? d / max : 0) * 100).toFixed(1), v: +(max * 100).toFixed(1) };
}
export function rgbToCmyk(r, g, b) {
  const R = r / 255, G = g / 255, B = b / 255;
  const k = 1 - Math.max(R, G, B);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: +(((1 - R - k) / (1 - k)) * 100).toFixed(1),
    m: +(((1 - G - k) / (1 - k)) * 100).toFixed(1),
    y: +(((1 - B - k) / (1 - k)) * 100).toFixed(1),
    k: +(k * 100).toFixed(1),
  };
}
/** CIE Lab (D65). */
export function rgbToLab(r, g, b) {
  const f = (v) => { v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; };
  const R = f(r), G = f(g), B = f(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return { l: +(116 * t(y) - 16).toFixed(1), a: +(500 * (t(x) - t(y))).toFixed(1), b: +(200 * (t(y) - t(z))).toFixed(1) };
}

/** Relative luminance per WCAG. */
export function luminance({ r, g, b }) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(c1, c2) {
  const l1 = luminance(c1), l2 = luminance(c2);
  return +(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05))).toFixed(2);
}
export const readableOn = (c) => (luminance(c) > 0.45 ? "#000000" : "#ffffff");

export const mix = (c1, c2, t = 0.5) => ({
  r: c1.r + (c2.r - c1.r) * t, g: c1.g + (c2.g - c1.g) * t, b: c1.b + (c2.b - c1.b) * t, a: 1,
});
export const lighten = (c, amt) => { const h = rgbToHsl(c.r, c.g, c.b); return hslToRgb(h.h, h.s, clamp(h.l + amt, 0, 100)); };
export const saturate = (c, amt) => { const h = rgbToHsl(c.r, c.g, c.b); return hslToRgb(h.h, clamp(h.s + amt, 0, 100), h.l); };
export const rotate = (c, deg) => { const h = rgbToHsl(c.r, c.g, c.b); return hslToRgb(h.h + deg, h.s, h.l); };
export const grayscale = (c) => { const v = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; return { r: v, g: v, b: v, a: 1 }; };

export function harmonies(c) {
  const h = rgbToHsl(c.r, c.g, c.b);
  const at = (deg, s = h.s, l = h.l) => hslToRgb(h.h + deg, s, l);
  return {
    complementary: [c, at(180)],
    analogous: [at(-30), c, at(30)],
    triadic: [c, at(120), at(240)],
    tetradic: [c, at(90), at(180), at(270)],
    splitComplementary: [c, at(150), at(210)],
    monochromatic: [-30, -15, 0, 15, 30].map((d) => hslToRgb(h.h, h.s, clamp(h.l + d, 4, 96))),
  };
}
export const shades = (c, steps = 9) =>
  Array.from({ length: steps }, (_, i) => {
    const h = rgbToHsl(c.r, c.g, c.b);
    return hslToRgb(h.h, h.s, 95 - (90 / (steps - 1)) * i);
  });

/** Colour-blindness simulation (Brettel-style approximations). */
export const CVD = {
  protanopia: [[0.567, 0.433, 0], [0.558, 0.442, 0], [0, 0.242, 0.758]],
  deuteranopia: [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]],
  tritanopia: [[0.95, 0.05, 0], [0, 0.433, 0.567], [0, 0.475, 0.525]],
  achromatopsia: [[0.299, 0.587, 0.114], [0.299, 0.587, 0.114], [0.299, 0.587, 0.114]],
};
export function simulate(c, type) {
  const m = CVD[type];
  if (!m) return c;
  return {
    r: clamp(c.r * m[0][0] + c.g * m[0][1] + c.b * m[0][2], 0, 255),
    g: clamp(c.r * m[1][0] + c.g * m[1][1] + c.b * m[1][2], 0, 255),
    b: clamp(c.r * m[2][0] + c.g * m[2][1] + c.b * m[2][2], 0, 255),
    a: 1,
  };
}
export const randomColor = () => ({
  r: Math.floor(Math.random() * 256), g: Math.floor(Math.random() * 256), b: Math.floor(Math.random() * 256), a: 1,
});
export const wcagLevel = (ratio, large = false) =>
  ratio >= (large ? 4.5 : 7) ? "AAA" : ratio >= (large ? 3 : 4.5) ? "AA" : "fail";
