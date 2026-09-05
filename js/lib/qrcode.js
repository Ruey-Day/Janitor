/* Minimal dependency-free QR Code encoder (byte mode, versions 1–40, ECC L/M/Q/H).
   Implements ISO/IEC 18004: RS error correction over GF(256), block interleaving,
   all 8 data masks with the standard penalty scoring. */
"use strict";

const ECC = { L: 0, M: 1, Q: 2, H: 3 };
const FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 }; // format-info encoding order

const ECC_CODEWORDS_PER_BLOCK = [
  // version 0 slot is unused padding
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const NUM_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

/* ── GF(256) arithmetic, primitive polynomial 0x11D ─────── */
const EXP = new Uint8Array(256);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
})();
const gmul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[(LOG[a] + LOG[b]) % 255]);

function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gmul(poly[j], EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}
function rsRemainder(data, degree) {
  const gen = rsGenerator(degree);
  const res = new Array(degree).fill(0);
  for (const b of data) {
    const factor = b ^ res.shift();
    res.push(0);
    for (let i = 0; i < degree; i++) res[i] ^= gmul(gen[i + 1], factor);
  }
  return res;
}

/* ── capacity math ──────────────────────────────────────── */
export function alignmentPositions(ver) {
  if (ver === 1) return [];
  const size = ver * 4 + 17;
  const count = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
}
function rawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const count = Math.floor(ver / 7) + 2;
    result -= (25 * count - 10) * count - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}
export function dataCodewords(ver, level) {
  const e = ECC[level];
  return Math.floor(rawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[e][ver] * NUM_BLOCKS[e][ver];
}
/** Max UTF-8 bytes storable in byte mode at this version/level. */
export function byteCapacity(ver, level) {
  const countBits = ver <= 9 ? 8 : 16;
  return Math.floor((dataCodewords(ver, level) * 8 - 4 - countBits) / 8);
}

/* ── bitstream → codewords ──────────────────────────────── */
function buildCodewords(bytes, ver, level) {
  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(0b0100, 4);                              // byte mode
  push(bytes.length, ver <= 9 ? 8 : 16);        // character count
  for (const b of bytes) push(b, 8);

  const capacity = dataCodewords(ver, level) * 8;
  push(0, Math.min(4, capacity - bits.length)); // terminator
  while (bits.length % 8 !== 0) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    data.push(byte);
  }
  for (let pad = 0xec; data.length < capacity / 8; pad ^= 0xec ^ 0x11) data.push(pad);

  // split into blocks, add ECC, interleave
  const e = ECC[level];
  const numBlocks = NUM_BLOCKS[e][ver];
  const eccLen = ECC_CODEWORDS_PER_BLOCK[e][ver];
  const rawCw = Math.floor(rawDataModules(ver) / 8);
  const shortBlocks = numBlocks - (rawCw % numBlocks);
  const shortLen = Math.floor(rawCw / numBlocks) - eccLen;

  const blocks = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const len = shortLen + (i < shortBlocks ? 0 : 1);
    const dat = data.slice(k, k + len);
    k += len;
    blocks.push({ dat, ecc: rsRemainder(dat, eccLen) });
  }
  const result = [];
  for (let i = 0; i < shortLen + 1; i++)
    for (const b of blocks) if (i < b.dat.length) result.push(b.dat[i]);
  for (let i = 0; i < eccLen; i++) for (const b of blocks) result.push(b.ecc[i]);
  return result;
}

/* ── matrix construction ────────────────────────────────── */
function makeMatrix(codewords, ver, level, forcedMask) {
  const size = ver * 4 + 17;
  const grid = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, v) => { grid[y][x] = v; fixed[y][x] = true; };

  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d <= 3);
      }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

  for (let i = 8; i < size - 8; i++) { // timing patterns
    set(i, 6, i % 2 === 0);
    set(6, i, i % 2 === 0);
  }
  const aligns = alignmentPositions(ver);
  for (const cy of aligns)
    for (const cx of aligns) {
      const corner = (cx === 6 && cy === 6) || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6);
      if (corner) continue;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++)
          set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }

  // reserve format + version areas
  const reserve = (x, y) => { fixed[y][x] = true; };
  for (let i = 0; i <= 8; i++) { reserve(i, 8); reserve(8, i); }
  for (let i = 0; i < 8; i++) { reserve(size - 1 - i, 8); reserve(8, size - 1 - i); }
  set(8, size - 8, true); // dark module
  if (ver >= 7)
    for (let i = 0; i < 18; i++) {
      reserve(Math.floor(i / 3), size - 11 + (i % 3));
      reserve(size - 11 + (i % 3), Math.floor(i / 3));
    }

  // zig-zag data placement
  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (fixed[y][x]) continue;
        grid[y][x] = bitIdx < totalBits ? ((codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) === 1 : false;
        bitIdx++;
      }
    }
  }

  const maskFns = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];

  const applyMask = (m) => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++)
        if (!fixed[y][x] && maskFns[m](x, y)) grid[y][x] = !grid[y][x];
  };
  const drawFormat = (m) => {
    let data = (FORMAT_BITS[level] << 3) | m;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bitsVal = ((data << 10) | rem) ^ 0x5412;
    const bit = (i) => ((bitsVal >>> i) & 1) === 1;
    // first copy: bits 0-5 down column 8, then the corner, then bits 9-14 along row 8
    for (let i = 0; i <= 5; i++) grid[i][8] = bit(i);
    grid[7][8] = bit(6); grid[8][8] = bit(7); grid[8][7] = bit(8);
    for (let i = 9; i < 15; i++) grid[8][14 - i] = bit(i);
    // second copy: bits 0-7 along row 8 from the right edge, bits 8-14 up column 8 from the bottom
    for (let i = 0; i < 8; i++) grid[8][size - 1 - i] = bit(i);
    for (let i = 8; i < 15; i++) grid[size - 15 + i][8] = bit(i);
    grid[size - 8][8] = true; // dark module
  };
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const vbits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const b = ((vbits >>> i) & 1) === 1;
      const a = Math.floor(i / 3), c = size - 11 + (i % 3);
      grid[c][a] = b;
      grid[a][c] = b;
    }
  }

  const penalty = () => {
    let score = 0;
    const runScore = (run) => (run >= 5 ? run - 2 : 0);
    for (let y = 0; y < size; y++) {
      let run = 1;
      for (let x = 1; x < size; x++) {
        if (grid[y][x] === grid[y][x - 1]) run++;
        else { score += runScore(run); run = 1; }
      }
      score += runScore(run);
    }
    for (let x = 0; x < size; x++) {
      let run = 1;
      for (let y = 1; y < size; y++) {
        if (grid[y][x] === grid[y - 1][x]) run++;
        else { score += runScore(run); run = 1; }
      }
      score += runScore(run);
    }
    for (let y = 0; y < size - 1; y++)
      for (let x = 0; x < size - 1; x++) {
        const c = grid[y][x];
        if (c === grid[y][x + 1] && c === grid[y + 1][x] && c === grid[y + 1][x + 1]) score += 3;
      }
    const pat = [true, false, true, true, true, false, true];
    const matches = (get, i, len) => {
      if (i + 11 > len) return 0;
      let hits = 0;
      let fwd = true, bwd = true;
      for (let k = 0; k < 7; k++) { // pattern then four light modules
        if (get(i + k) !== pat[k]) fwd = false;
        if (get(i + 4 + k) !== pat[k]) bwd = false;
      }
      for (let k = 7; k < 11; k++) if (get(i + k) !== false) fwd = false;
      for (let k = 0; k < 4; k++) if (get(i + k) !== false) bwd = false;
      if (fwd) hits += 40;
      if (bwd) hits += 40;
      return hits;
    };
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        score += matches((i) => grid[y][i], x, size);
        score += matches((i) => grid[i][x], y, size);
      }
    let dark = 0;
    for (const row of grid) for (const c of row) if (c) dark++;
    const pct = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return score;
  };

  let best = forcedMask ?? 0, bestScore = Infinity;
  if (forcedMask === undefined || forcedMask === null) {
    for (let m = 0; m < 8; m++) {
      applyMask(m); drawFormat(m);
      const s = penalty();
      if (s < bestScore) { bestScore = s; best = m; }
      applyMask(m); // undo
    }
  }
  applyMask(best);
  drawFormat(best);
  return { grid, size, mask: best };
}

/** Encode text → { grid (bool[][]), size, version, level, mask } */
export function encode(text, { level = "M", minVersion = 1 } = {}) {
  const bytes = [...new TextEncoder().encode(String(text))];
  if (!bytes.length) throw new Error("nothing to encode");
  let ver = -1;
  for (let v = Math.max(1, minVersion); v <= 40; v++) {
    if (bytes.length <= byteCapacity(v, level)) { ver = v; break; }
  }
  if (ver < 0) throw new Error(`too much data — max ${byteCapacity(40, level)} bytes at level ${level}`);
  const cw = buildCodewords(bytes, ver, level);
  const { grid, size, mask } = makeMatrix(cw, ver, level);
  return { grid, size, version: ver, level, mask, bytes: bytes.length };
}

/** Render a QR result as an SVG string. */
export function toSVG(qr, { scale = 8, margin = 4, dark = "#000", light = "#fff", radius = 0 } = {}) {
  const dim = (qr.size + margin * 2) * scale;
  let path = "";
  for (let y = 0; y < qr.size; y++)
    for (let x = 0; x < qr.size; x++)
      if (qr.grid[y][x]) path += `M${(x + margin) * scale},${(y + margin) * scale}h${scale}v${scale}h-${scale}z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">` +
    `<rect width="${dim}" height="${dim}" fill="${light}" rx="${radius}"/>` +
    `<path d="${path}" fill="${dark}"/></svg>`;
}

/** Draw a QR result onto a canvas element. */
export function toCanvas(qr, canvas, { scale = 8, margin = 4, dark = "#000", light = "#fff" } = {}) {
  const dim = (qr.size + margin * 2) * scale;
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, dim, dim);
  ctx.fillStyle = dark;
  for (let y = 0; y < qr.size; y++)
    for (let x = 0; x < qr.size; x++)
      if (qr.grid[y][x]) ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
  return canvas;
}
