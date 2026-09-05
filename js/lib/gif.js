/* Minimal animated GIF89a encoder: global 256-colour palette (popularity of 15-bit buckets) + LZW. */
"use strict";

function buildPalette(frames) {
  const counts = new Map();
  for (const f of frames) { const d = f.data; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3); counts.set(k, (counts.get(k) || 0) + 1); } }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 255).map(([k]) => [((k >> 10) & 31) << 3 | 4, ((k >> 5) & 31) << 3 | 4, (k & 31) << 3 | 4]);
  while (top.length < 256) top.push([0, 0, 0]);
  return top;
}
function indexFrame(img, palette, cache) {
  const d = img.data, out = new Uint8Array(img.width * img.height);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
    let idx = cache[k];
    if (idx === undefined || idx === 255) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < palette.length; c++) { const dr = palette[c][0] - d[i], dg = palette[c][1] - d[i + 1], db = palette[c][2] - d[i + 2]; const dist = dr * dr + dg * dg + db * db; if (dist < bd) { bd = dist; best = c; } }
      idx = best; cache[k] = idx;
    }
    out[p] = idx;
  }
  return out;
}
function lzw(indices, minCodeSize = 8) {
  const out = []; let cur = 0, curBits = 0;
  const emit = (code, size) => { cur |= code << curBits; curBits += size; while (curBits >= 8) { out.push(cur & 255); cur >>>= 8; curBits -= 8; } };
  const CLEAR = 1 << minCodeSize, EOI = CLEAR + 1;
  let dict = new Map(), next = EOI + 1, codeSize = minCodeSize + 1;
  const reset = () => { dict = new Map(); next = EOI + 1; codeSize = minCodeSize + 1; };
  emit(CLEAR, codeSize);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key = (prefix << 8) | k;
    if (dict.has(key)) prefix = dict.get(key);
    else {
      emit(prefix, codeSize);
      if (next < 4096) { dict.set(key, next++); if (next - 1 === 1 << codeSize && codeSize < 12) codeSize++; }
      else { emit(CLEAR, codeSize); reset(); }
      prefix = k;
    }
  }
  emit(prefix, codeSize); emit(EOI, codeSize);
  if (curBits > 0) out.push(cur & 255);
  return out;
}

/** frames: ImageData[] (same size); delays in ms → Uint8Array gif */
export function encodeGIF(frames, { delay = 100, loop = 0 } = {}) {
  const w = frames[0].width, hgt = frames[0].height;
  const palette = buildPalette(frames), cache = new Uint8Array(32768).fill(255);
  const bytes = [];
  const push = (...b) => bytes.push(...b);
  const u16 = (v) => push(v & 255, (v >> 8) & 255);
  push(...[71, 73, 70, 56, 57, 97]); u16(w); u16(hgt); push(0xf7, 0, 0);
  for (const [r, g, b] of palette) push(r, g, b);
  push(0x21, 0xff, 11, ...[78, 69, 84, 83, 67, 65, 80, 69, 50, 46, 48], 3, 1); u16(loop); push(0);
  for (const f of frames) {
    push(0x21, 0xf9, 4, 0x04); u16(Math.round(delay / 10)); push(0, 0);
    push(0x2c); u16(0); u16(0); u16(w); u16(hgt); push(0);
    push(8);
    const data = lzw(indexFrame(f, palette, cache));
    for (let i = 0; i < data.length; i += 255) { const chunk = data.slice(i, i + 255); push(chunk.length, ...chunk); }
    push(0);
  }
  push(0x3b);
  return new Uint8Array(bytes);
}
