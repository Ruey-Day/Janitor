/* Dependency-free ZIP read/write. Deflate via CompressionStream("deflate-raw") when available, else stored. */
"use strict";

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32num(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

const enc = new TextEncoder(), dec = new TextDecoder();
const canDeflate = typeof CompressionStream !== "undefined";

async function pipe(bytes, stream) {
  const rs = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(rs).arrayBuffer());
}
export const deflateRaw = (b) => pipe(b, new CompressionStream("deflate-raw"));
export const inflateRaw = (b) => pipe(b, new DecompressionStream("deflate-raw"));
export const gzip = (b) => pipe(b, new CompressionStream("gzip"));
export const gunzip = (b) => pipe(b, new DecompressionStream("gzip"));

function dosTime(d) {
  return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
}
function concat(chunks) { const n = chunks.reduce((a, c) => a + c.length, 0); const out = new Uint8Array(n); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } return out; }

/** entries: [{name, data: Uint8Array|string, date?: Date}] → Uint8Array zip */
export async function createZip(entries, { compress = true, onProgress } = {}) {
  const parts = [], central = [];
  let offset = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const data = typeof e.data === "string" ? enc.encode(e.data) : new Uint8Array(e.data);
    const name = enc.encode(e.name.replace(/\\/g, "/"));
    const crc = crc32num(data);
    let method = 0, payload = data;
    if (compress && canDeflate && data.length > 0) { const d = await deflateRaw(data); if (d.length < data.length) { method = 8; payload = d; } }
    const { time, date } = dosTime(e.date || new Date());
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, method, true);
    lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true); lh.setUint32(18, payload.length, true); lh.setUint32(22, data.length, true);
    lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, payload);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true);
    ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true); ch.setUint32(20, payload.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + payload.length;
    onProgress?.(i + 1, entries.length);
  }
  const cd = concat(central);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true); eocd.setUint16(4, 0, true); eocd.setUint16(6, 0, true); eocd.setUint16(8, entries.length, true); eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, cd.length, true); eocd.setUint32(16, offset, true); eocd.setUint16(20, 0, true);
  return concat([...parts, cd, new Uint8Array(eocd.buffer)]);
}

/** → [{name, size, csize, method, date, dir, read(): Promise<Uint8Array>}] */
export function readZip(buf) {
  const b = new Uint8Array(buf);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip file (no end-of-central-directory)");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("corrupt central directory");
    const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true);
    const time = dv.getUint16(p + 12, true), date = dv.getUint16(p + 14, true);
    const crc = dv.getUint32(p + 16, true), csize = dv.getUint32(p + 20, true), size = dv.getUint32(p + 24, true);
    const nLen = dv.getUint16(p + 28, true), xLen = dv.getUint16(p + 30, true), cLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = (flags & 0x800 ? dec : new TextDecoder("latin1")).decode(b.subarray(p + 46, p + 46 + nLen));
    const d = new Date(1980 + (date >> 9), ((date >> 5) & 15) - 1, date & 31, time >> 11, (time >> 5) & 63, (time & 31) * 2);
    entries.push({
      name, size, csize, method, crc, date: d, dir: name.endsWith("/"),
      async read() {
        if (dv.getUint32(local, true) !== 0x04034b50) throw new Error("corrupt local header for " + name);
        const ln = dv.getUint16(local + 26, true), lx = dv.getUint16(local + 28, true);
        const start = local + 30 + ln + lx;
        const raw = b.subarray(start, start + csize);
        if (method === 0) return raw;
        if (method === 8) { if (typeof DecompressionStream === "undefined") throw new Error("this browser cannot inflate"); return inflateRaw(raw); }
        throw new Error("unsupported compression method " + method);
      },
    });
    p += 46 + nLen + xLen + cLen;
  }
  return entries;
}
