import { h, defineTool, textarea, input, btn, card, copy, toast, subtabs, field, out, pickFile, readAs, download, bytes } from "../core.js";
import { encryptText, decryptText } from "../lib/hashes.js";

defineTool({
  id: "cipher", name: "Encrypt / Decrypt", icon: "🔒", cat: "crypto",
  desc: "AES-256-GCM with a passphrase (PBKDF2, 250k rounds) for text and files — all local.",
  tags: ["encrypt", "decrypt", "aes", "gcm", "passphrase", "secret", "secure", "file encryption"],
  mount(root) {
    const pass = input({ type: "password", placeholder: "passphrase", autocomplete: "off" });
    const showPass = h("input", { type: "checkbox", onchange: (e) => (pass.type = e.target.checked ? "text" : "password") });
    const plain = textarea({ placeholder: "plain text…", style: { minHeight: "160px" } });
    const cipherTa = textarea({ placeholder: "tl1.…  (ciphertext)", style: { minHeight: "160px" } });
    const status = h("span.chip");
    const need = () => { if (!pass.value) { toast("enter a passphrase", "bad"); return false; } return true; };

    const doEnc = async () => { if (!need()) return; try { cipherTa.value = await encryptText(plain.value, pass.value); status.className = "chip ok"; status.textContent = "encrypted"; } catch (e) { toast(e.message, "bad"); } };
    const doDec = async () => { if (!need()) return; try { plain.value = await decryptText(cipherTa.value, pass.value); status.className = "chip ok"; status.textContent = "decrypted"; } catch (e) { status.className = "chip bad"; status.textContent = e.message; } };

    /* files */
    const fInfo = h("span.chip", { text: "no file" });
    let file = null;
    const pick = async () => { file = await pickFile(); if (file) fInfo.textContent = `${file.name} · ${bytes(file.size)}`; };
    const encFile = async () => {
      if (!file || !need()) return toast("choose a file and passphrase", "bad");
      const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
      const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass.value), "PBKDF2", false, ["deriveKey"]);
      const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
      const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, await readAs.buffer(file));
      const header = new TextEncoder().encode("TL1F");
      download(new Blob([header, salt, iv, ct]), file.name + ".tl1");
    };
    const decFile = async () => {
      if (!file || !need()) return toast("choose a .tl1 file and passphrase", "bad");
      const buf = new Uint8Array(await readAs.buffer(file));
      if (new TextDecoder().decode(buf.slice(0, 4)) !== "TL1F") return toast("not a TRINKET LAB encrypted file", "bad");
      const salt = buf.slice(4, 20), iv = buf.slice(20, 32), ct = buf.slice(32);
      const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass.value), "PBKDF2", false, ["deriveKey"]);
      const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      try { const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct); download(new Blob([pt]), file.name.replace(/\.tl1$/, "") || "decrypted.bin"); }
      catch { toast("wrong passphrase or corrupted file", "bad"); }
    };

    root.append(
      card("Passphrase", h("div.row", h("div", { style: { flex: 1 } }, pass), h("label.check", showPass, "show"), status)),
      h("div", { style: { marginTop: "14px" } }, subtabs([
        { id: "text", label: "Text", render: () => h("div.grid.g2",
            card("Plain text", plain, [btn("Encrypt →", doEnc, "primary sm"), btn("Clear", () => (plain.value = ""), "ghost sm danger")]),
            card("Cipher text", cipherTa, [btn("← Decrypt", doDec, "sm"), btn("Copy", () => copy(cipherTa.value), "ghost sm"), btn("Clear", () => (cipherTa.value = ""), "ghost sm danger")])) },
        { id: "file", label: "File", render: () => h("div.col",
            h("div.row", btn("Choose file", pick, "sm"), fInfo),
            h("div.row", btn("Encrypt → .tl1", encFile, "primary sm"), btn("Decrypt .tl1 →", decFile, "sm")),
            h("p.hint", { text: "Format: 4-byte magic, 16-byte salt, 12-byte IV, AES-GCM ciphertext. Keys derive from your passphrase with PBKDF2-SHA256 (250,000 rounds). Lose the passphrase and the data is gone." })) },
      ], { remember: "cipher.tab" })));
  },
});
