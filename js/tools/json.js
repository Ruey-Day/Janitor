import { h, defineTool, store, textarea, input, btn, card, copy, download, toast, subtabs, seg, field, select, tbl, out, esc, pickFile, readAs, bytes, num, debounce } from "../core.js";

/* ── helpers ────────────────────────────────────────────── */
export function parseCSV(text, delim = ",") {
  const rows = [];
  let row = [], cell = "", q = false;
  const s = String(text).replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}
export function toCSV(rows, delim = ",") {
  const q = (v) => { const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); return /[",\n\r]/.test(s) || s.includes(delim) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return rows.map((r) => r.map(q).join(delim)).join("\n");
}
export function toYAML(v, indent = 0) {
  const pad = "  ".repeat(indent);
  const scalar = (x) => x === null ? "null" : typeof x === "string" ? (/^[\w .-]*$/.test(x) && x.trim() === x && x !== "" && !/^(true|false|null|\d+)$/.test(x) ? x : JSON.stringify(x)) : String(x);
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    return v.map((x) => (typeof x === "object" && x !== null ? pad + "-\n" + toYAML(x, indent + 1).replace(/^/gm, "") : pad + "- " + scalar(x))).join("\n");
  }
  if (v && typeof v === "object") {
    const keys = Object.keys(v);
    if (!keys.length) return "{}";
    return keys.map((k) => {
      const val = v[k];
      const key = /^[\w-]+$/.test(k) ? k : JSON.stringify(k);
      if (val && typeof val === "object" && Object.keys(val).length) return `${pad}${key}:\n${toYAML(val, indent + 1)}`;
      if (val && typeof val === "object") return `${pad}${key}: ${Array.isArray(val) ? "[]" : "{}"}`;
      return `${pad}${key}: ${scalar(val)}`;
    }).join("\n");
  }
  return pad + scalar(v);
}
function toTS(v, name = "Root") {
  const seen = [];
  const typeOf = (x, hint) => {
    if (x === null) return "null";
    if (Array.isArray(x)) return x.length ? `${typeOf(x[0], hint)}[]` : "unknown[]";
    if (typeof x === "object") { const n = hint[0].toUpperCase() + hint.slice(1).replace(/[^\w]/g, ""); seen.push([n, x]); return n; }
    return typeof x;
  };
  const iface = (n, obj) => `interface ${n} {\n` + Object.entries(obj).map(([k, val]) => `  ${/^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${typeOf(val, k)};`).join("\n") + "\n}";
  const rootType = typeOf(v, name);
  const outParts = [];
  while (seen.length) { const [n, o] = seen.shift(); outParts.push(iface(n, o)); }
  return (rootType !== name ? `type ${name} = ${rootType};\n\n` : "") + outParts.join("\n\n");
}
const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v;
const flatten = (v, prefix = "", res = {}) => {
  if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) flatten(x, prefix ? `${prefix}${Array.isArray(v) ? `[${k}]` : "." + k}` : Array.isArray(v) ? `[${k}]` : k, res);
    if (!Object.keys(v).length) res[prefix] = Array.isArray(v) ? [] : {};
  } else res[prefix] = v;
  return res;
};
function query(v, path) {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cur = v;
  for (const p of parts) {
    if (p === "*" && Array.isArray(cur)) return cur;
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}
function tree(v, key) {
  const label = key !== undefined ? h("span.jk", { text: JSON.stringify(key) + ": " }) : null;
  if (v && typeof v === "object") {
    const entries = Object.entries(v);
    const d = h("details", { open: entries.length <= 20 },
      h("summary", label, h("span.jnull", { text: (Array.isArray(v) ? `Array(${entries.length})` : `Object{${entries.length}}`) })));
    entries.forEach(([k, x]) => d.append(tree(x, Array.isArray(v) ? +k : k)));
    return d;
  }
  const cls = v === null ? "jnull" : typeof v === "string" ? "js" : typeof v === "number" ? "jn" : "jb";
  return h("div", label, h("span", { class: cls, text: JSON.stringify(v) }));
}
function stats(v) {
  let keys = 0, depth = 0, arrays = 0, objects = 0, strings = 0, numbers = 0, bools = 0, nulls = 0;
  const walk = (x, d) => {
    depth = Math.max(depth, d);
    if (Array.isArray(x)) { arrays++; x.forEach((y) => walk(y, d + 1)); }
    else if (x && typeof x === "object") { objects++; for (const k in x) { keys++; walk(x[k], d + 1); } }
    else if (typeof x === "string") strings++; else if (typeof x === "number") numbers++; else if (typeof x === "boolean") bools++; else nulls++;
  };
  walk(v, 0);
  return { keys, depth, arrays, objects, strings, numbers, bools, nulls };
}
function errorPos(msg, text) {
  const m = /position (\d+)/.exec(msg);
  if (!m) return "";
  const pos = +m[1];
  const before = text.slice(0, pos);
  return ` (line ${before.split("\n").length}, col ${pos - before.lastIndexOf("\n")})`;
}

defineTool({
  id: "json", name: "JSON Studio", icon: "{}", cat: "data",
  desc: "Format, validate, query and explore JSON; convert to CSV, YAML, TypeScript.",
  tags: ["json", "format", "prettify", "minify", "validate", "csv", "yaml", "typescript", "tree", "jsonpath"],
  mount(root) {
    const src = textarea({ placeholder: '{"paste": "json here"}', style: { minHeight: "50vh", border: 0, background: "transparent", borderRadius: 0 } });
    src.value = store.get("json.src", '{\n  "name": "TRINKET LAB",\n  "tools": 30,\n  "offline": true,\n  "tags": ["json", "tools"],\n  "author": {"handle": "rueyday"}\n}');
    const status = h("span.chip");
    const indent = select([["2", "2 spaces"], ["4", "4 spaces"], ["\t", "tabs"]], { value: store.get("json.indent", "2"), style: { width: "auto" } });
    const resultBody = h("div");
    const pathIn = input({ placeholder: "query path: tools  ·  tags[0]  ·  author.handle", value: store.get("json.path", "") });
    let parsed, valid = false;

    const parse = () => {
      store.set("json.src", src.value);
      try { parsed = JSON.parse(src.value); valid = true; status.className = "chip ok"; const s = stats(parsed); status.textContent = `valid · ${num(s.keys)} keys · depth ${s.depth} · ${bytes(new TextEncoder().encode(src.value).length)}`; }
      catch (e) { valid = false; status.className = "chip bad"; status.textContent = e.message.replace(/^JSON\.parse: /, "") + errorPos(e.message, src.value); parsed = undefined; }
    };
    const set = (v) => { src.value = v; parse(); refresh(); };
    const ind = () => (indent.value === "\t" ? "\t" : +indent.value);
    const guard = (fn) => () => { parse(); if (!valid) return toast("fix the JSON first", "bad"); fn(); };

    const tabs = subtabs([
      { id: "tree", label: "Tree", render: () => (valid ? h("div.jtree", tree(parsed)) : out("invalid JSON", "err")) },
      { id: "query", label: "Query", render: () => {
          const res = out();
          const run = () => { store.set("json.path", pathIn.value); if (!valid) return (res.textContent = "invalid JSON"); const r = query(parsed, pathIn.value.trim()); res.textContent = r === undefined ? "undefined" : JSON.stringify(r, null, 2); };
          pathIn.oninput = debounce(run, 80);
          run();
          return h("div.col", pathIn, res, h("p.hint", { text: "Dot / bracket paths. Use * on an array to return it whole." }));
        } },
      { id: "flat", label: "Flat", render: () => (valid ? tbl(["path", "value"], Object.entries(flatten(parsed)).map(([k, v]) => [k, JSON.stringify(v)])) : out("invalid JSON", "err")) },
      { id: "yaml", label: "YAML", render: () => { const o = out(valid ? toYAML(parsed) : "invalid JSON"); return h("div.col", o, btn("Copy YAML", () => copy(o.textContent), "ghost sm")); } },
      { id: "ts", label: "TypeScript", render: () => { const o = out(valid ? toTS(parsed) : "invalid JSON"); return h("div.col", o, btn("Copy types", () => copy(o.textContent), "ghost sm")); } },
      { id: "csv", label: "CSV", render: () => {
          const rowsOf = (v) => Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v).find(Array.isArray) || [v] : [];
          const rows = rowsOf(parsed).map((r) => (r && typeof r === "object" ? flatten(r) : { value: r }));
          const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
          const csv = valid ? toCSV([cols, ...rows.map((r) => cols.map((c) => r[c]))]) : "invalid JSON";
          const o = out(csv);
          return h("div.col", h("p.hint", { text: "Arrays of objects become rows; nested keys are flattened." }), o,
            h("div.row", btn("Copy CSV", () => copy(csv), "ghost sm"), btn("Save .csv", () => download(csv, "data.csv", "text/csv"), "ghost sm")));
        } },
      { id: "fromcsv", label: "CSV → JSON", render: () => {
          const csvIn = textarea({ placeholder: "name,age\nAda,36\nLinus,54", style: { minHeight: "140px" } });
          const delim = select([[",", "comma"], [";", "semicolon"], ["\t", "tab"], ["|", "pipe"]], { style: { width: "auto" } });
          const header = h("input", { type: "checkbox", checked: true });
          const numbers = h("input", { type: "checkbox", checked: true });
          const preview = h("div");
          const convert = () => {
            const rows = parseCSV(csvIn.value, delim.value);
            if (!rows.length) return;
            const cast = (x) => (numbers.checked && x !== "" && !isNaN(x) ? +x : x);
            const data = header.checked ? rows.slice(1).map((r) => Object.fromEntries(rows[0].map((k, i) => [k, cast(r[i] ?? "")]))) : rows.map((r) => r.map(cast));
            set(JSON.stringify(data, null, ind()));
            preview.replaceChildren(tbl(rows[0], rows.slice(1, 30)));
            tabs.show("tree");
          };
          return h("div.col", csvIn, h("div.row", field("delimiter", delim), h("label.check", header, "first row is header"), h("label.check", numbers, "cast numbers"),
            btn("Convert → JSON", convert, "primary sm"), btn("Load .csv", async () => { const f = await pickFile({ accept: ".csv,.tsv,text/csv" }); if (f) csvIn.value = await readAs.text(f); }, "ghost sm")), preview);
        } },
      { id: "string", label: "Escape", render: () => {
          const o = out(JSON.stringify(src.value));
          const o2 = out();
          try { o2.textContent = JSON.parse(src.value.trim().startsWith('"') ? src.value : JSON.stringify(src.value)); } catch { o2.textContent = "not a JSON string"; }
          return h("div.col", h("span.label", { text: "input as JSON string literal" }), o, btn("Copy", () => copy(o.textContent), "ghost sm"),
            h("span.label", { text: "input unescaped (if it is a string literal)" }), o2);
        } },
    ], { remember: "json.tab" });
    const refresh = () => tabs.show(tabs.value);

    src.addEventListener("input", debounce(() => { parse(); refresh(); }, 200));
    src.addEventListener("keydown", (e) => { if (e.key === "Tab") { e.preventDefault(); src.setRangeText("  ", src.selectionStart, src.selectionEnd, "end"); } });
    indent.addEventListener("change", () => store.set("json.indent", indent.value));

    root.append(
      h("div.split",
        card("Source", src, [
          status,
          field("indent", indent),
          btn("Format", guard(() => set(JSON.stringify(parsed, null, ind()))), "sm"),
          btn("Minify", guard(() => set(JSON.stringify(parsed))), "sm"),
          btn("Sort keys", guard(() => set(JSON.stringify(sortKeys(parsed), null, ind()))), "sm"),
          btn("Copy", () => copy(src.value), "ghost sm"),
          btn("Open", async () => { const f = await pickFile({ accept: ".json,application/json" }); if (f) set(await readAs.text(f)); }, "ghost sm"),
          btn("Save", () => download(src.value, "data.json", "application/json"), "ghost sm"),
          btn("Clear", () => set(""), "ghost sm danger"),
        ]),
        card("Explore", tabs)));
    parse();
    refresh();
  },
});
