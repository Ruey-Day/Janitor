/* EAN-13 / EAN-8 / UPC-A barcode encoder → bit pattern + SVG. Also Code 128? no — retail codes only, verified by check digit. */
"use strict";

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = L.map((s) => [...s].reverse().map((c) => (c === "1" ? "0" : "1")).join("")); // G = mirrored R; R = complement of L
const R = L.map((s) => [...s].map((c) => (c === "1" ? "0" : "1")).join(""));
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export function checkDigit(digits) { // EAN/UPC modulo-10, digits without the check
  const arr = [...digits].map(Number).reverse();
  const sum = arr.reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10;
}

export function encode(input, type = "auto") {
  let d = String(input).replace(/\D/g, "");
  if (type === "auto") {
    // 12 digits is ambiguous: a complete UPC-A, or an EAN-13 payload awaiting its check digit
    if (d.length <= 8) type = "ean8";
    else if (d.length === 11) type = "upca";
    else if (d.length === 12) type = checkDigit(d.slice(0, -1)) === +d.at(-1) ? "upca" : "ean13";
    else type = "ean13";
  }
  const need = { ean13: 13, ean8: 8, upca: 12 }[type];
  if (!need) throw new Error("unknown type");
  if (d.length === need - 1) d += checkDigit(d);
  if (d.length !== need) throw new Error(`${type.toUpperCase()} needs ${need - 1} or ${need} digits`);
  if (checkDigit(d.slice(0, -1)) !== +d.at(-1)) throw new Error("check digit mismatch — expected " + checkDigit(d.slice(0, -1)));
  let bits = "101";
  if (type === "ean8") {
    for (let i = 0; i < 4; i++) bits += L[+d[i]];
    bits += "01010";
    for (let i = 4; i < 8; i++) bits += R[+d[i]];
  } else {
    const e13 = type === "upca" ? "0" + d : d;
    const par = PARITY[+e13[0]];
    for (let i = 1; i <= 6; i++) bits += (par[i - 1] === "L" ? L : G)[+e13[i]];
    bits += "01010";
    for (let i = 7; i <= 12; i++) bits += R[+e13[i]];
  }
  bits += "101";
  return { bits, digits: d, type };
}

export function toSVG({ bits, digits, type }, { moduleWidth = 2, height = 70, text = true, dark = "#000", light = "#fff" } = {}) {
  const quiet = 9 * moduleWidth;
  const w = bits.length * moduleWidth + quiet * 2, hh = height + (text ? 18 : 0);
  let rects = "";
  // guard bars extend lower
  const guards = type === "ean8" ? [[0, 3], [31, 36], [64, 67]] : [[0, 3], [45, 50], [92, 95]];
  const isGuard = (i) => guards.some(([a, b]) => i >= a && i < b);
  for (let i = 0; i < bits.length; i++) if (bits[i] === "1") rects += `<rect x="${quiet + i * moduleWidth}" y="0" width="${moduleWidth}" height="${isGuard(i) || !text ? height : height - 8}" fill="${dark}"/>`;
  let label = "";
  if (text) {
    const fs = 11 * (moduleWidth / 2);
    const t = (x, s, anchor = "middle") => `<text x="${x}" y="${hh - 3}" font-family="monospace" font-size="${fs}" text-anchor="${anchor}" fill="${dark}">${s}</text>`;
    if (type === "ean8") label = t(quiet + 17 * moduleWidth, digits.slice(0, 4)) + t(quiet + 50 * moduleWidth, digits.slice(4));
    else if (type === "upca") label = t(quiet - 4, digits[0], "end") + t(quiet + 24 * moduleWidth, digits.slice(1, 6)) + t(quiet + 71 * moduleWidth, digits.slice(6, 11)) + t(w - quiet + 4, digits[11], "start");
    else label = t(quiet - 4, digits[0], "end") + t(quiet + 24 * moduleWidth, digits.slice(1, 7)) + t(quiet + 71 * moduleWidth, digits.slice(7));
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}" shape-rendering="crispEdges"><rect width="${w}" height="${hh}" fill="${light}"/>${rects}${label}</svg>`;
}
