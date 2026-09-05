import { h, defineTool, store, textarea, input, btn, card, copy, toast, tbl, field, select, out, bytes, pickFile, readAs, seg, debounce } from "../core.js";
import { md5, crc32, adler32, fnv1a32, sha, hmac, toHexStr } from "../lib/hashes.js";

defineTool({
  id: "hash", name: "Hash & Checksum", icon: "#", cat: "crypto",
  desc: "MD5, SHA-1/256/384/512, CRC32, HMAC for text or files. Verify against an expected hash.",
  tags: ["hash", "sha256", "md5", "checksum", "hmac", "digest", "verify", "integrity", "file"],
  mount(root) {
    const src = textarea({ placeholder: "Text to hash…", style: { minHeight: "140px" } });
    src.value = store.get("hash.src", "");
    const fileInfo = h("span.chip", { text: "no file" });
    const expected = input({ placeholder: "paste an expected hash to verify…", class: "mono" });
    const verdict = h("span.chip");
    const results = h("div");
    const hmacKey = input({ placeholder: "secret key" });
    const hmacAlgo = select(["SHA-256", "SHA-1", "SHA-384", "SHA-512"], { style: { width: "auto" } });
    const hmacOut = out();
    const encoding = seg([["hex", "hex"], ["base64", "base64"]], () => run(), "hex");
    let mode = "text";
    let fileBytes = null;
    let lastValues = {};

    const fmt = (hex) => encoding.value === "hex" ? hex : btoa(hex.match(/../g).map((b) => String.fromCharCode(parseInt(b, 16))).join(""));

    async function run() {
      store.set("hash.src", src.value);
      const data = mode === "file" ? fileBytes : new TextEncoder().encode(src.value);
      if (!data) { results.replaceChildren(out("load a file first")); return; }
      const rows = [];
      const algos = [["MD5", () => md5(data)], ["SHA-1", () => sha("SHA-1", data)], ["SHA-256", () => sha("SHA-256", data)],
        ["SHA-384", () => sha("SHA-384", data)], ["SHA-512", () => sha("SHA-512", data)], ["CRC32", () => crc32(data)],
        ["Adler-32", () => adler32(data)], ["FNV-1a 32", () => fnv1a32(data)]];
      lastValues = {};
      for (const [name, fn] of algos) {
        const v = await fn();
        lastValues[name] = v;
        rows.push([name, h("span.copyable.mono", { text: fmt(v), title: "click to copy", onclick: () => copy(fmt(v)) }), String(v.length * 4) + " bit"]);
      }
      results.replaceChildren(tbl(["algorithm", "digest", "size"], rows));
      verify();
      runHmac();
    }
    function verify() {
      const e = expected.value.trim().toLowerCase();
      if (!e) { verdict.className = "chip"; verdict.textContent = "verify: paste a hash"; return; }
      const hit = Object.entries(lastValues).find(([, v]) => v.toLowerCase() === e);
      verdict.className = "chip " + (hit ? "ok" : "bad");
      verdict.textContent = hit ? `✓ matches ${hit[0]}` : "✗ no algorithm matches";
    }
    async function runHmac() {
      if (!hmacKey.value) { hmacOut.textContent = "enter a key"; return; }
      const data = mode === "file" ? fileBytes : new TextEncoder().encode(src.value);
      if (!data) return;
      hmacOut.textContent = fmt(await hmac(hmacAlgo.value, hmacKey.value, data));
    }
    async function loadFile(f) {
      if (!f) return;
      mode = "file";
      modeSeg.select("file");
      fileInfo.textContent = `${f.name} · ${bytes(f.size)}`;
      fileBytes = new Uint8Array(await readAs.buffer(f));
      run();
    }
    const modeSeg = seg([["text", "text"], ["file", "file"]], (v) => { mode = v; run(); }, "text");
    src.addEventListener("input", debounce(run, 150));
    expected.addEventListener("input", verify);
    hmacKey.addEventListener("input", debounce(runHmac, 150));
    hmacAlgo.addEventListener("change", runHmac);

    const onFile = (e) => loadFile(e.detail);
    document.addEventListener("trinket:file", onFile);
    if (window.__pendingFile) { const f = window.__pendingFile; window.__pendingFile = null; loadFile(f); }

    root.append(
      h("div.split",
        h("div.col",
          card("Input", h("div.col", h("div.row", modeSeg, fileInfo, btn("Choose file", async () => loadFile(await pickFile()), "sm"), h("span.hint", { text: "or drop a file anywhere" })), src)),
          card("Digests", h("div.col", h("div.row", field("output", encoding)), results))),
        h("div.col",
          card("Verify", h("div.col", expected, verdict)),
          card("HMAC", h("div.col", field("key", hmacKey), field("algorithm", hmacAlgo), hmacOut), [btn("Copy", () => copy(hmacOut.textContent), "ghost sm")]))));
    run();
    return () => document.removeEventListener("trinket:file", onFile);
  },
});
