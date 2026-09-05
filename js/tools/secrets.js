import { h, defineTool, store, textarea, input, btn, card, copy, toast, subtabs, field, select, out, tbl, kv, download, num } from "../core.js";

const WORDS = "able acid aged also area army away baby back ball band bank base bath bear beat been beer bell belt best bird blow blue boat body bomb bond bone book boom born boss both bowl bulk burn bush busy call calm camp card care case cash cast cell chat chip city club coal coat code cold come cook cool cope copy core cost crew crop dark data date dawn days dead deal dean dear debt deep deny desk dial diet disc disk does done door dose down draw drew drop drug dual duke dust duty each earn ease east easy edge else even ever evil exit face fact fail fair fall farm fast fate fear feed feel feet fell felt file fill film find fine fire firm fish five flat flow food foot ford form fort four free from fuel full fund gain game gate gave gear gene gift girl give glad goal goes gold golf gone good gray grew grey grow gulf hair half hall hand hang hard harm hate have head hear heat held hell help here hero high hill hire hold hole holy home hope host hour huge hung hunt hurt idea inch into iron item jack jane jean john join jump jury just keen keep kent kept kick kill kind king knee knew know lack lady laid lake land lane last late lead left less life lift like line link list live load loan lock logo long look lord lose loss lost love luck made mail main make male many mark mass matt meal mean meet menu mere mike mile milk mill mind mine miss mode mood moon more most move much must name navy near neck need news next nice nick nine none nose note okay once only onto open oral over pace pack page paid pain pair palm park part pass past path peak pick pink pipe plan play plot plug plus poll pool poor port post pull pure push race rail rain rank rare rate read real rear rely rent rest rice rich ride ring rise risk road rock role roll roof room root rose rule rush ruth safe sail sale salt same sand save seat seed seek seem seen self sell send sent sept ship shop shot show shut sick side sign site size skin slip slow snow soft soil sold sole some song soon sort soul spot star stay step stop such suit sure take tale talk tall tank tape task team tech tell tend term test text than that them then they thin this thus till time tiny told toll tone tony took tool tour town tree trip true tune turn twin type unit upon used user vary vast very vice view vote wage wait wake walk wall want ward warm wash wave ways weak wear week well went were west what when whom wide wife wild will wind wine wing wire wise wish with wood word wore work yard yeah year your zero zone amber apple beach brick candy cloud coral delta eagle ember flame frost giant globe grape happy heart honey ivory jelly juice koala lemon light lucky maple metal mango night noble ocean olive onion opera paper pearl piano pixel plaza quart queen radio river robot rocky salad scale shark smile solar spark spice stone storm sugar sunny swift table tiger topaz torch tower trail ultra umbra unity vapor velvet vivid wagon whale wheat willow zebra".split(" ");

const SETS = { lower: "abcdefghijklmnopqrstuvwxyz", upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", digits: "0123456789", symbols: "!@#$%^&*()-_=+[]{};:,.<>?/~", ambiguous: "Il1O0|`'\"" };
const rand = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
const pickChar = (pool) => pool[rand(pool.length)];

export function uuidv4() { return crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = rand(16); return (c === "x" ? r : (r & 3) | 8).toString(16); }); }
export function uuidv7() {
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  const ts = BigInt(Date.now());
  for (let i = 0; i < 6; i++) b[i] = Number((ts >> BigInt(8 * (5 - i))) & 0xffn);
  b[6] = (b[6] & 0x0f) | 0x70; b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function ulid() {
  const C = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let t = Date.now(), s = "";
  for (let i = 0; i < 10; i++) { s = C[t % 32] + s; t = Math.floor(t / 32); }
  for (let i = 0; i < 16; i++) s += C[rand(32)];
  return s;
}
export const nanoid = (n = 21) => Array.from({ length: n }, () => pickChar("useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict")).join("");
const hexToken = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
const b64Token = (n) => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(n)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function entropyBits(pw) {
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26; if (/[A-Z]/.test(pw)) pool += 26; if (/\d/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33; if (/[^\x00-\x7f]/.test(pw)) pool += 100;
  return pool ? +(pw.length * Math.log2(pool)).toFixed(1) : 0;
}
function crackTime(bits, guessesPerSec = 1e10) {
  const secs = 2 ** bits / guessesPerSec / 2;
  const units = [["centuries", 3.154e9], ["years", 3.154e7], ["days", 86400], ["hours", 3600], ["minutes", 60], ["seconds", 1]];
  if (secs < 1) return "instant";
  for (const [u, s] of units) if (secs >= s) { const v = secs / s; return (v > 1e15 ? "≈ forever" : num(Math.round(v)) + " " + u); }
  return "instant";
}
function analyze(pw) {
  const issues = [];
  if (pw.length < 8) issues.push("shorter than 8 characters");
  if (pw.length < 12) issues.push("under 12 characters — aim for 14+");
  if (!/[a-z]/.test(pw)) issues.push("no lowercase letters");
  if (!/[A-Z]/.test(pw)) issues.push("no uppercase letters");
  if (!/\d/.test(pw)) issues.push("no digits");
  if (!/[^a-zA-Z0-9]/.test(pw)) issues.push("no symbols");
  if (/(.)\1{2,}/.test(pw)) issues.push("repeated characters");
  if (/(?:abc|bcd|cde|123|234|345|456|567|678|789|qwe|wer|ert|asd|sdf|zxc)/i.test(pw)) issues.push("keyboard / sequential pattern");
  if (/^(password|letmein|welcome|admin|qwerty|iloveyou|monkey|dragon|football|baseball|master|sunshine|princess)/i.test(pw)) issues.push("starts with a very common password");
  if (/(19|20)\d{2}/.test(pw)) issues.push("contains a year");
  const bits = entropyBits(pw);
  const score = bits < 28 ? 0 : bits < 36 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  return { bits, score, issues, label: ["very weak", "weak", "fair", "strong", "excellent"][score] };
}

async function pem(key, type) {
  const buf = await crypto.subtle.exportKey(type, key);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf))).match(/.{1,64}/g).join("\n");
  const label = type === "spki" ? "PUBLIC KEY" : "PRIVATE KEY";
  return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----`;
}

defineTool({
  id: "secrets", name: "Passwords & IDs", icon: "⚿", cat: "crypto",
  desc: "Password & passphrase generator, strength analyser, UUID/ULID/nanoid, tokens, RSA/EC keypairs.",
  tags: ["password", "generator", "passphrase", "strength", "entropy", "uuid", "ulid", "nanoid", "token", "random", "rsa", "keypair", "pem"],
  mount(root) {
    /* password */
    const len = input({ type: "number", value: store.get("pw.len", 20), min: 4, max: 128, style: { width: "80px" } });
    const count = input({ type: "number", value: 5, min: 1, max: 50, style: { width: "80px" } });
    const opts = Object.fromEntries(["lower", "upper", "digits", "symbols"].map((k) => [k, h("input", { type: "checkbox", checked: store.get("pw." + k, true) })]));
    const noAmb = h("input", { type: "checkbox", checked: store.get("pw.noamb", true) });
    const pwOut = h("div.col", { style: { gap: "6px" } });
    const genPw = () => {
      store.set("pw.len", +len.value);
      let pool = ""; const required = [];
      for (const k in opts) if (opts[k].checked) { store.set("pw." + k, true); let s = SETS[k]; if (noAmb.checked) s = [...s].filter((c) => !SETS.ambiguous.includes(c)).join(""); pool += s; required.push(s); } else store.set("pw." + k, false);
      store.set("pw.noamb", noAmb.checked);
      if (!pool) return toast("pick at least one character set", "bad");
      pwOut.replaceChildren();
      for (let i = 0; i < +count.value; i++) {
        const L = Math.max(+len.value, required.length);
        let chars = required.map(pickChar);
        while (chars.length < L) chars.push(pickChar(pool));
        for (let j = chars.length - 1; j > 0; j--) { const k = rand(j + 1); [chars[j], chars[k]] = [chars[k], chars[j]]; }
        const pw = chars.join("");
        const a = analyze(pw);
        pwOut.append(h("div.list-item", h("span.li-text.mono", { text: pw, style: { userSelect: "all" } }), h("span.chip", { text: `${a.bits} bits` }), btn("copy", () => copy(pw), "ghost sm")));
      }
    };
    /* passphrase */
    const pCount = input({ type: "number", value: 5, min: 2, max: 12, style: { width: "80px" } });
    const sep = select([["-", "hyphen"], [" ", "space"], [".", "dot"], ["_", "underscore"], ["", "none"]], { style: { width: "auto" } });
    const capital = h("input", { type: "checkbox", checked: true });
    const addNum = h("input", { type: "checkbox", checked: true });
    const ppOut = h("div.col", { style: { gap: "6px" } });
    const genPp = () => {
      ppOut.replaceChildren();
      for (let i = 0; i < 5; i++) {
        let ws = Array.from({ length: +pCount.value }, () => WORDS[rand(WORDS.length)]);
        if (capital.checked) ws = ws.map((w) => w[0].toUpperCase() + w.slice(1));
        let pp = ws.join(sep.value);
        if (addNum.checked) pp += rand(100);
        ppOut.append(h("div.list-item", h("span.li-text.mono", { text: pp, style: { userSelect: "all" } }), h("span.chip", { text: `~${Math.round(+pCount.value * Math.log2(WORDS.length))} bits` }), btn("copy", () => copy(pp), "ghost sm")));
      }
    };
    /* analyzer */
    const testIn = input({ type: "text", placeholder: "type a password to analyse (never stored)", class: "mono" });
    const bar = h("div.bar", h("i"));
    const verdict = h("div.col");
    testIn.addEventListener("input", () => {
      const pw = testIn.value;
      if (!pw) { verdict.replaceChildren(); bar.firstChild.style.width = "0"; return; }
      const a = analyze(pw);
      bar.firstChild.style.width = (a.score + 1) * 20 + "%";
      bar.firstChild.style.background = ["var(--danger)", "var(--amber)", "var(--amber)", "var(--lime)", "var(--cyan)"][a.score];
      verdict.replaceChildren(
        h("div.row", h("span.chip", { class: a.score >= 3 ? "ok" : a.score >= 2 ? "warn" : "bad", text: a.label }), h("span.chip", { text: `${a.bits} bits entropy` }), h("span.chip", { text: `${pw.length} chars` })),
        h("div.kv-list", kv("offline crack (10 G/s)", crackTime(a.bits, 1e10)), kv("online throttled (100/s)", crackTime(a.bits, 100)), kv("GPU cluster (1 T/s)", crackTime(a.bits, 1e12))),
        a.issues.length ? h("ul", { style: { margin: 0, paddingLeft: "18px", color: "var(--muted)", fontSize: "12px" } }, a.issues.map((i) => h("li", { text: i }))) : h("p.hint", { text: "no obvious weaknesses" }));
    });
    /* ids */
    const idCount = input({ type: "number", value: 5, min: 1, max: 100, style: { width: "80px" } });
    const idOut = textarea({ readonly: true, style: { minHeight: "160px" } });
    const gen = (fn) => () => { idOut.value = Array.from({ length: +idCount.value }, fn).join("\n"); };
    const idTab = h("div.col",
      h("div.row", field("count", idCount),
        btn("UUID v4", gen(uuidv4), "sm"), btn("UUID v7", gen(uuidv7), "sm"), btn("ULID", gen(ulid), "sm"), btn("nanoid", gen(() => nanoid()), "sm"),
        btn("hex 16B", gen(() => hexToken(16)), "sm"), btn("hex 32B", gen(() => hexToken(32)), "sm"), btn("base64url 32B", gen(() => b64Token(32)), "sm"),
        btn("PIN 6", gen(() => String(rand(1e6)).padStart(6, "0")), "sm"), btn("API key", gen(() => "tk_" + b64Token(24)), "sm")),
      idOut, h("div.row", btn("Copy all", () => copy(idOut.value), "ghost sm"), btn("Copy first", () => copy(idOut.value.split("\n")[0]), "ghost sm")));
    /* keypairs */
    const algo = select([["rsa2048", "RSA-OAEP 2048"], ["rsa4096", "RSA-OAEP 4096"], ["rsapss", "RSA-PSS 2048 (signing)"], ["p256", "ECDSA P-256"], ["p384", "ECDSA P-384"], ["ed25519", "Ed25519"], ["x25519", "X25519 (ECDH)"]], { style: { width: "auto" } });
    const pubOut = textarea({ readonly: true, style: { minHeight: "150px", fontSize: "11px" } });
    const privOut = textarea({ readonly: true, style: { minHeight: "150px", fontSize: "11px" } });
    const genKeys = async () => {
      const a = algo.value;
      const params = a.startsWith("rsa") ? { name: a === "rsapss" ? "RSA-PSS" : "RSA-OAEP", modulusLength: a === "rsa4096" ? 4096 : 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }
        : a === "p256" || a === "p384" ? { name: "ECDSA", namedCurve: a === "p256" ? "P-256" : "P-384" } : { name: a === "ed25519" ? "Ed25519" : "X25519" };
      const usages = a.startsWith("rsa") && a !== "rsapss" ? ["encrypt", "decrypt"] : a === "x25519" ? ["deriveKey"] : ["sign", "verify"];
      pubOut.value = privOut.value = "generating…";
      try {
        const kp = await crypto.subtle.generateKey(params, true, usages);
        pubOut.value = await pem(kp.publicKey, "spki");
        privOut.value = await pem(kp.privateKey, "pkcs8");
        toast("keypair generated", "ok");
      } catch (e) { pubOut.value = privOut.value = "not supported in this browser: " + e.message; }
    };
    const keyTab = h("div.col",
      h("div.row", field("algorithm", algo), btn("Generate", genKeys, "primary sm"), h("span.hint", { text: "generated locally with WebCrypto, never transmitted" })),
      h("div.grid.g2", card("Public key (SPKI PEM)", pubOut, [btn("Copy", () => copy(pubOut.value), "ghost sm"), btn("Save", () => download(pubOut.value, "public.pem"), "ghost sm")]),
        card("Private key (PKCS#8 PEM)", privOut, [btn("Copy", () => copy(privOut.value), "ghost sm"), btn("Save", () => download(privOut.value, "private.pem"), "ghost sm")])));

    root.append(subtabs([
      { id: "pw", label: "Password", render: () => { genPw(); return h("div.col", h("div.row", field("length", len), field("how many", count), ...Object.entries(opts).map(([k, c]) => h("label.check", c, k)), h("label.check", noAmb, "no ambiguous (Il1O0)"), btn("Regenerate", genPw, "primary sm")), pwOut); } },
      { id: "pp", label: "Passphrase", render: () => { genPp(); return h("div.col", h("div.row", field("words", pCount), field("separator", sep), h("label.check", capital, "capitalise"), h("label.check", addNum, "append number"), btn("Regenerate", genPp, "primary sm")), ppOut, h("p.hint", { text: `${WORDS.length}-word list · ${Math.log2(WORDS.length).toFixed(1)} bits per word` })); } },
      { id: "test", label: "Strength test", render: () => h("div.col", testIn, bar, verdict) },
      { id: "ids", label: "IDs & tokens", render: () => idTab },
      { id: "keys", label: "Keypairs", render: () => keyTab },
    ], { remember: "secrets.tab" }));
  },
});
