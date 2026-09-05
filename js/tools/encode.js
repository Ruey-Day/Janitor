import { h, defineTool, store, textarea, input, btn, card, copy, toast, subtabs, field, select, out, tbl, kv, pickFile, readAs, bytes, download, debounce } from "../core.js";
import { MORSE } from "../lib/units.js";

const enc = new TextEncoder(), dec = new TextDecoder();
const b64encode = (s) => btoa(String.fromCharCode(...enc.encode(s)));
const b64decode = (s) => dec.decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "").padEnd(Math.ceil(s.replace(/\s/g, "").length / 4) * 4, "=")), (c) => c.charCodeAt(0)));
const b64url = (s) => b64encode(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function b32encode(s) {
  const bytes = enc.encode(s); let bits = "", outStr = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  for (let i = 0; i < bits.length; i += 5) outStr += B32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  while (outStr.length % 8) outStr += "=";
  return outStr;
}
function b32decode(s) {
  const clean = s.toUpperCase().replace(/=+$/, "").replace(/\s/g, ""); let bits = "";
  for (const c of clean) { const i = B32.indexOf(c); if (i < 0) throw new Error("invalid base32"); bits += i.toString(2).padStart(5, "0"); }
  const bytes = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return dec.decode(new Uint8Array(bytes));
}
const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "©": "&copy;", "®": "&reg;", "™": "&trade;", "€": "&euro;", "£": "&pound;", "¥": "&yen;", "§": "&sect;", "°": "&deg;", "±": "&plusmn;", "×": "&times;", "÷": "&divide;", "—": "&mdash;", "–": "&ndash;", "…": "&hellip;", "«": "&laquo;", "»": "&raquo;", " ": "&nbsp;" };
const caesar = (s, k) => s.replace(/[a-z]/gi, (c) => { const b = c <= "Z" ? 65 : 97; return String.fromCharCode(((c.charCodeAt(0) - b + k) % 26 + 26) % 26 + b); });
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

const MODES = {
  base64: { enc: b64encode, dec: b64decode },
  base64url: { enc: b64url, dec: b64decode },
  base32: { enc: b32encode, dec: b32decode },
  hex: { enc: (s) => [...enc.encode(s)].map((b) => b.toString(16).padStart(2, "0")).join(" "), dec: (s) => dec.decode(new Uint8Array(s.replace(/0x|[^0-9a-f]/gi, "").match(/../g).map((x) => parseInt(x, 16)))) },
  binary: { enc: (s) => [...enc.encode(s)].map((b) => b.toString(2).padStart(8, "0")).join(" "), dec: (s) => dec.decode(new Uint8Array(s.replace(/[^01]/g, "").match(/.{8}/g).map((x) => parseInt(x, 2)))) },
  octal: { enc: (s) => [...enc.encode(s)].map((b) => b.toString(8).padStart(3, "0")).join(" "), dec: (s) => dec.decode(new Uint8Array(s.trim().split(/\s+/).map((x) => parseInt(x, 8)))) },
  decimal: { enc: (s) => [...enc.encode(s)].join(" "), dec: (s) => dec.decode(new Uint8Array(s.trim().split(/[\s,]+/).map(Number))) },
  codepoints: { enc: (s) => [...s].map((c) => "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")).join(" "), dec: (s) => String.fromCodePoint(...(s.match(/[0-9a-f]{4,6}/gi) || []).map((x) => parseInt(x, 16))) },
  "unicode escape": { enc: (s) => [...s].map((c) => (c.codePointAt(0) < 128 ? c : c.codePointAt(0) > 0xffff ? `\\u{${c.codePointAt(0).toString(16)}}` : "\\u" + c.codePointAt(0).toString(16).padStart(4, "0"))).join(""), dec: (s) => s.replace(/\\u\{([0-9a-f]+)\}/gi, (_, x) => String.fromCodePoint(parseInt(x, 16))).replace(/\\u([0-9a-f]{4})/gi, (_, x) => String.fromCharCode(parseInt(x, 16))) },
  "html entities": { enc: (s) => s.replace(/[&<>"'©®™€£¥§°±×÷—–…«» ]/g, (c) => ENTITIES[c] || c), dec: (s) => { const t = document.createElement("textarea"); t.innerHTML = s; return t.value; } },
  "html entities (all non-ascii)": { enc: (s) => [...s].map((c) => (c.codePointAt(0) < 128 && !ENTITIES[c] ? c : `&#${c.codePointAt(0)};`)).join(""), dec: (s) => { const t = document.createElement("textarea"); t.innerHTML = s; return t.value; } },
  "url component": { enc: encodeURIComponent, dec: (s) => decodeURIComponent(s.replace(/\+/g, " ")) },
  rot13: { enc: (s) => caesar(s, 13), dec: (s) => caesar(s, 13) },
  rot47: { enc: (s) => s.replace(/[!-~]/g, (c) => String.fromCharCode(33 + ((c.charCodeAt(0) - 33 + 47) % 94))), dec: (s) => s.replace(/[!-~]/g, (c) => String.fromCharCode(33 + ((c.charCodeAt(0) - 33 + 47) % 94))) },
  morse: { enc: (s) => s.toLowerCase().split(/\s+/).map((w) => [...w].map((c) => MORSE[c] || "?").join(" ")).join(" / "), dec: (s) => s.trim().split(/\s*\/\s*|\s{3,}/).map((w) => w.trim().split(/\s+/).map((c) => MORSE_REV[c] || "?").join("")).join(" ") },
  reverse: { enc: (s) => [...s].reverse().join(""), dec: (s) => [...s].reverse().join("") },
  "json string": { enc: (s) => JSON.stringify(s), dec: (s) => JSON.parse(s) },
  "quoted-printable": { enc: (s) => [...enc.encode(s)].map((b) => (b >= 33 && b <= 126 && b !== 61) || b === 32 ? String.fromCharCode(b) : "=" + b.toString(16).toUpperCase().padStart(2, "0")).join(""), dec: (s) => dec.decode(new Uint8Array([...s.replace(/=\r?\n/g, "").matchAll(/=([0-9A-F]{2})|(.)/gs)].map((m) => (m[1] ? parseInt(m[1], 16) : m[2].charCodeAt(0))))) },
  "punycode (idna)": { enc: (s) => { try { return new URL("http://" + s).hostname; } catch { return "invalid hostname"; } }, dec: (s) => { try { return decodeURIComponent(new URL("http://" + s).hostname); } catch { return s; } } },
};

function decodeJwt(token) {
  const parts = token.trim().split(".");
  if (parts.length < 2) throw new Error("a JWT has 3 dot-separated parts");
  const header = JSON.parse(b64decode(parts[0]));
  const payload = JSON.parse(b64decode(parts[1]));
  return { header, payload, signature: parts[2] || "" };
}

defineTool({
  id: "encode", name: "Encoder Ring", icon: "⧉", cat: "crypto",
  desc: "Base64, Base32, hex, binary, HTML entities, unicode, ROT, Morse, JWT decode.",
  tags: ["base64", "hex", "binary", "encode", "decode", "html entities", "unicode", "rot13", "morse", "jwt", "token", "base32", "file to base64"],
  mount(root) {
    const modeSel = select(Object.keys(MODES), { value: store.get("encode.mode", "base64"), style: { width: "auto" } });
    const shift = input({ type: "number", value: 3, min: -25, max: 25, style: { width: "80px" } });
    const src = textarea({ placeholder: "input…", style: { minHeight: "160px" } });
    src.value = store.get("encode.src", "");
    const dst = textarea({ placeholder: "output…", style: { minHeight: "160px" }, readonly: true });
    const info = h("span.chip");
    const apply = (dir) => {
      store.set("encode.src", src.value); store.set("encode.mode", modeSel.value);
      const m = MODES[modeSel.value];
      try { dst.value = m[dir](src.value); dst.classList.remove("err"); info.textContent = `${bytes(enc.encode(src.value).length)} → ${bytes(enc.encode(dst.value).length)}`; }
      catch (e) { dst.value = "error: " + e.message; }
    };
    const caesarRow = h("div.row", field("caesar shift", shift), btn("shift →", () => { dst.value = caesar(src.value, +shift.value); }, "sm"), btn("← unshift", () => { dst.value = caesar(src.value, -shift.value); }, "sm"),
      btn("brute force all 26", () => { dst.value = Array.from({ length: 26 }, (_, k) => `${String(k).padStart(2)}: ${caesar(src.value, k)}`).join("\n"); }, "sm"));

    /* file → base64 */
    const fileOut = textarea({ readonly: true, style: { minHeight: "120px" } });
    const fileMeta = h("span.chip", { text: "no file" });
    let dataUrl = "";
    const fileTab = h("div.col",
      h("div.row", btn("Choose file", async () => {
        const f = await pickFile(); if (!f) return;
        dataUrl = await readAs.dataURL(f);
        fileMeta.textContent = `${f.name} · ${bytes(f.size)} · ${f.type || "unknown type"}`;
        fileOut.value = dataUrl;
      }, "sm"), fileMeta),
      fileOut,
      h("div.row",
        btn("Copy data URL", () => copy(fileOut.value), "ghost sm"),
        btn("Copy raw base64", () => copy(fileOut.value.split(",")[1] || ""), "ghost sm"),
        btn("Copy as <img>", () => copy(`<img src="${fileOut.value}" alt="">`), "ghost sm"),
        btn("Copy as CSS url()", () => copy(`url("${fileOut.value}")`), "ghost sm")),
      h("span.label", { text: "preview a data: URL" }),
      (() => { const d = textarea({ placeholder: "data:image/png;base64,…", style: { minHeight: "60px" } }); const pv = h("div"); d.addEventListener("input", debounce(() => { const v = d.value.trim(); pv.replaceChildren(); if (!v.startsWith("data:")) return; const mime = /^data:([^;,]+)/.exec(v)?.[1] || ""; if (mime.startsWith("image/")) pv.append(h("img", { src: v, style: { maxHeight: "200px", borderRadius: "8px" } })); else if (mime.startsWith("audio/")) pv.append(h("audio", { controls: true, src: v })); else if (mime.startsWith("video/")) pv.append(h("video", { controls: true, src: v, style: { maxHeight: "200px" } })); else pv.append(h("span.chip", { text: mime || "unknown type" }), h("a.btn.ghost.sm", { href: v, download: "decoded", text: "download" })); }, 200)); return h("div.col", d, pv); })(),
      h("span.label", { text: "base64 → file" }),
      (() => {
        const b = textarea({ placeholder: "paste base64 or a data: URL…", style: { minHeight: "90px" } });
        const name = input({ placeholder: "filename.bin", value: "decoded.bin" });
        return h("div.col", b, h("div.row", name, btn("Download file", () => {
          try {
            const raw = b.value.includes(",") ? b.value.split(",")[1] : b.value;
            const mime = /^data:([^;]+)/.exec(b.value)?.[1] || "application/octet-stream";
            const bin = Uint8Array.from(atob(raw.replace(/\s/g, "")), (c) => c.charCodeAt(0));
            download(new Blob([bin], { type: mime }), name.value || "decoded.bin");
          } catch { toast("invalid base64", "bad"); }
        }, "sm")));
      })());

    /* JWT */
    const jwtIn = textarea({ placeholder: "eyJhbGciOi…", style: { minHeight: "90px" } });
    jwtIn.value = store.get("encode.jwt", "");
    const jwtOut = h("div.col");
    const jwtRun = () => {
      store.set("encode.jwt", jwtIn.value);
      jwtOut.replaceChildren();
      if (!jwtIn.value.trim()) return;
      try {
        const { header, payload, signature } = decodeJwt(jwtIn.value);
        const now = Date.now() / 1000;
        const chips = [];
        if (payload.exp) chips.push(h("span.chip", { class: payload.exp < now ? "bad" : "ok", text: payload.exp < now ? `expired ${new Date(payload.exp * 1000).toLocaleString()}` : `expires ${new Date(payload.exp * 1000).toLocaleString()}` }));
        if (payload.iat) chips.push(h("span.chip", { text: `issued ${new Date(payload.iat * 1000).toLocaleString()}` }));
        if (payload.nbf) chips.push(h("span.chip", { text: `not before ${new Date(payload.nbf * 1000).toLocaleString()}` }));
        chips.push(h("span.chip", { text: `alg ${header.alg || "?"}` }));
        jwtOut.append(h("div.row.tight", chips), h("span.label", { text: "header" }), out(JSON.stringify(header, null, 2)),
          h("span.label", { text: "payload" }), out(JSON.stringify(payload, null, 2)),
          h("span.label", { text: "signature (base64url)" }), out(signature || "—"),
          h("p.hint", { text: "Decoding only — the signature is not verified here. Never paste production tokens into sites you don't control (this one never sends them anywhere)." }));
      } catch (e) { jwtOut.append(out("cannot decode: " + e.message, "err")); }
    };
    jwtIn.addEventListener("input", debounce(jwtRun, 120));

    /* ASCII table */
    const ascii = () => tbl(["dec", "hex", "oct", "bin", "char", "name"], Array.from({ length: 128 }, (_, i) => {
      const names = { 0: "NUL", 7: "BEL", 8: "BS", 9: "TAB", 10: "LF", 13: "CR", 27: "ESC", 32: "SPACE", 127: "DEL" };
      return [i, i.toString(16).padStart(2, "0"), i.toString(8).padStart(3, "0"), i.toString(2).padStart(8, "0"), i >= 33 && i < 127 ? String.fromCharCode(i) : "", names[i] || (i < 32 ? "control" : "")];
    }));

    root.append(subtabs([
      { id: "text", label: "Text codecs", render: () => h("div.col",
          h("div.row", field("scheme", modeSel), btn("Encode →", () => apply("enc"), "primary sm"), btn("← Decode", () => apply("dec"), "sm"), info),
          h("div.grid.g2", card("Input", src, [btn("Clear", () => { src.value = ""; }, "ghost sm danger")]), card("Output", dst, [btn("Copy", () => copy(dst.value), "ghost sm"), btn("↑ Use as input", () => { src.value = dst.value; }, "ghost sm")])),
          card("Caesar cipher", caesarRow)) },
      { id: "file", label: "File ⇄ Base64", render: () => fileTab },
      { id: "jwt", label: "JWT decoder", render: () => { jwtRun(); return h("div.col", jwtIn, jwtOut); } },
      { id: "ascii", label: "ASCII table", render: ascii },
    ], { remember: "encode.tab" }));
    src.addEventListener("input", debounce(() => apply("enc"), 200));
    modeSel.addEventListener("change", () => apply("enc"));
    if (src.value) apply("enc");
  },
});
