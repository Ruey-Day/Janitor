/* Hashes not covered by WebCrypto (MD5, CRC32, FNV, Adler) + WebCrypto wrappers. */
"use strict";

const enc = new TextEncoder();
export const toBytes = (input) =>
  input instanceof Uint8Array ? input : input instanceof ArrayBuffer ? new Uint8Array(input) : enc.encode(String(input));
export const toHexStr = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

/* ── MD5 (RFC 1321) ─────────────────────────────────────── */
export function md5(input) {
  const bytes = toBytes(input);
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;
  const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const bitLen = bytes.length * 8;
  const padLen = ((bytes.length + 8) >> 6 << 6) + 64;
  const buf = new Uint8Array(padLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(padLen - 8, bitLen >>> 0, true);
  dv.setUint32(padLen - 4, Math.floor(bitLen / 2 ** 32), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const rotl = (x, c) => (x << c) | (x >>> (32 - c));
  for (let off = 0; off < padLen; off += 64) {
    const M = new Uint32Array(16);
    for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + rotl(F, S[i])) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const out = new Uint8Array(16);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, a0, true); ov.setUint32(4, b0, true); ov.setUint32(8, c0, true); ov.setUint32(12, d0, true);
  return toHexStr(out);
}

/* ── CRC32 ──────────────────────────────────────────────── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(input) {
  const bytes = toBytes(input);
  let crc = 0xffffffff;
  for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}
export function adler32(input) {
  let a = 1, b = 0;
  for (const x of toBytes(input)) { a = (a + x) % 65521; b = (b + a) % 65521; }
  return (((b << 16) | a) >>> 0).toString(16).padStart(8, "0");
}
export function fnv1a32(input) {
  let h = 0x811c9dc5;
  for (const x of toBytes(input)) { h ^= x; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

/* ── WebCrypto ──────────────────────────────────────────── */
export async function sha(algo, input) {
  const buf = await crypto.subtle.digest(algo, toBytes(input));
  return toHexStr(buf);
}
export async function hmac(algo, key, message) {
  const k = await crypto.subtle.importKey("raw", toBytes(key), { name: "HMAC", hash: algo }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, toBytes(message));
  return toHexStr(sig);
}

/* ── AES-GCM with PBKDF2 passphrase ─────────────────────── */
async function deriveKey(passphrase, salt, iterations = 250000) {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, base,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** → "tl1.<salt>.<iv>.<ciphertext>" all base64 */
export async function encryptText(plain, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
  return `tl1.${b64(salt)}.${b64(iv)}.${b64(ct)}`;
}
export async function decryptText(token, passphrase) {
  const parts = String(token).trim().split(".");
  if (parts.length !== 4 || parts[0] !== "tl1") throw new Error("not a TRINKET LAB cipher token");
  const key = await deriveKey(passphrase, unb64(parts[1]));
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(parts[2]) }, key, unb64(parts[3]));
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error("wrong passphrase or corrupted token");
  }
}
