/* ═══════════════════════════════════════════════════════════
   TRINKET LAB — core runtime
   registry · router · storage · ui kit · shortcuts · palette
   ═══════════════════════════════════════════════════════════ */
"use strict";

/* ── tiny dom ───────────────────────────────────────────── */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const isPlain = (v) =>
  v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Node);

/** h("div.card", {onclick, style:{}, html, text, ...attrs}, ...children) */
export function h(spec, props, ...kids) {
  const [tagRaw, ...classes] = String(spec).split(".");
  const node = document.createElement(tagRaw || "div");
  if (classes.length) node.className = classes.join(" ");
  if (props !== undefined && !isPlain(props)) {
    kids.unshift(props);
    props = null;
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = [node.className, v].filter(Boolean).join(" ");
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "style" && isPlain(v)) Object.assign(node.style, v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function")
      node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in node && (k === "value" || k === "checked" || k === "disabled" || k === "hidden"))
      node[k] = v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  const add = (c) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) return c.forEach(add);
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return node;
}

export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };

/* ── formatting ─────────────────────────────────────────── */
const nf = new Intl.NumberFormat();
export const num = (n) => (Number.isFinite(n) ? nf.format(n) : "—");
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const round = (v, p = 2) => {
  const m = 10 ** p;
  return Math.round((v + Number.EPSILON) * m) / m;
};
export function bytes(n) {
  if (!Number.isFinite(n)) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${i === 0 ? n : n.toFixed(n < 10 ? 2 : 1)} ${u[i]}`;
}
export function debounce(fn, ms = 160) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ── storage ────────────────────────────────────────────── */
const NS = "trinket:";
export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(NS + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(NS + key, JSON.stringify(value)); return true; }
    catch { toast("local storage is full or blocked", "bad"); return false; }
  },
  del(key) { try { localStorage.removeItem(NS + key); } catch {} },
  keys() {
    try { return Object.keys(localStorage).filter((k) => k.startsWith(NS)).map((k) => k.slice(NS.length)); }
    catch { return []; }
  },
  dump() {
    const out = {};
    for (const k of store.keys()) out[k] = store.get(k);
    return out;
  },
  load(obj) { for (const [k, v] of Object.entries(obj || {})) store.set(k, v); },
  wipe() { for (const k of store.keys()) store.del(k); },
};

/* ── toast ──────────────────────────────────────────────── */
let toastStack;
export function toast(msg, kind = "") {
  toastStack ||= $("#toast-stack");
  if (!toastStack) return;
  const el = h("div.toast" + (kind ? "." + kind : ""), { text: msg });
  toastStack.append(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 2400);
}

/* ── clipboard / files ──────────────────────────────────── */
export async function copy(text, label = "copied to clipboard") {
  const s = String(text ?? "");
  if (!s) return toast("nothing to copy");
  try {
    await navigator.clipboard.writeText(s);
    toast(label, "ok");
  } catch {
    const ta = h("textarea", { style: { position: "fixed", opacity: "0" } }, s);
    document.body.append(ta);
    ta.select();
    try { document.execCommand("copy"); toast(label, "ok"); }
    catch { toast("clipboard blocked — copy manually", "bad"); }
    ta.remove();
  }
}
export async function readClipboard() {
  try { return await navigator.clipboard.readText(); }
  catch { toast("clipboard read blocked — use ⌘V / Ctrl+V", "bad"); return null; }
}
export function download(data, filename, mime = "text/plain") {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(`saved ${filename}`, "ok");
}
export function pickFile({ accept = "", multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = h("input", { type: "file", accept, multiple, hidden: true });
    input.addEventListener("change", () => {
      resolve(multiple ? [...input.files] : input.files[0] || null);
      input.remove();
    });
    document.body.append(input);
    input.click();
  });
}
export const readAs = {
  text: (f) => f.text(),
  buffer: (f) => f.arrayBuffer(),
  dataURL: (f) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  }),
};

/* ── ui kit ─────────────────────────────────────────────── */
export function card(title, body, actions) {
  return h("section.card",
    (title || actions) &&
      h("div.card-head",
        h("h3", { text: title || "" }),
        actions ? h("div.card-actions", actions) : null),
    h("div.card-body", body));
}
export function field(labelText, control, hintText) {
  return h("label.field",
    h("span.label", { text: labelText }),
    control,
    hintText ? h("span.hint", { text: hintText }) : null);
}
export function input(props = {}) { return h("input", { type: "text", ...props }); }
export function textarea(props = {}) { return h("textarea", { spellcheck: "false", ...props }); }
export function select(options, props = {}) {
  const sel = h("select", props);
  for (const o of options) {
    const [val, label] = Array.isArray(o) ? o : [o, o];
    sel.append(h("option", { value: val, text: label }));
  }
  if (props.value !== undefined) sel.value = props.value;
  return sel;
}
export function btn(label, onclick, cls = "") {
  return h("button.btn" + (cls ? "." + cls.split(" ").join(".") : ""), { type: "button", onclick, text: label });
}
export function copyBtn(getter, label = "Copy") {
  return btn(label, () => copy(typeof getter === "function" ? getter() : getter), "ghost sm");
}
export function stat(label, value, sub, accent = "cyan") {
  const v = h("div.stat-value", { text: value });
  const node = h("div.stat", { dataset: { accent } },
    h("div.stat-label", { text: label }), v, sub ? h("div.stat-sub", { text: sub }) : null);
  node.set = (next) => {
    const s = String(next);
    if (v.textContent === s) return;
    v.textContent = s;
    v.classList.remove("bump");
    void v.offsetWidth;
    v.classList.add("bump");
  };
  return node;
}
export function seg(options, onchange, initial) {
  const wrap = h("div.seg");
  let value = initial ?? (Array.isArray(options[0]) ? options[0][0] : options[0]);
  const buttons = options.map((o) => {
    const [val, label] = Array.isArray(o) ? o : [o, o];
    const b = h("button", { type: "button", text: label, dataset: { val } });
    b.addEventListener("click", () => { wrap.select(val); onchange?.(val); });
    return b;
  });
  wrap.append(...buttons);
  wrap.select = (val) => {
    value = val;
    buttons.forEach((b) => b.classList.toggle("on", b.dataset.val === String(val)));
  };
  Object.defineProperty(wrap, "value", { get: () => value });
  wrap.select(value);
  return wrap;
}
/** Sub-tab strip: sections = [{id,label,render(el)}] */
export function subtabs(sections, opts = {}) {
  const body = h("div.col");
  const strip = h("div.seg");
  const buttons = [];
  let activeId = null;
  const show = (id) => {
    const sec = sections.find((s) => s.id === id) || sections[0];
    activeId = sec.id;
    buttons.forEach((b) => b.classList.toggle("on", b.dataset.val === sec.id));
    clear(body);
    body.append(sec.render());
    if (opts.remember) store.set(opts.remember, sec.id);
  };
  for (const s of sections) {
    const b = h("button", { type: "button", text: s.label, dataset: { val: s.id } });
    b.addEventListener("click", () => show(s.id));
    buttons.push(b);
    strip.append(b);
  }
  const root = h("div.col", strip, body);
  root.show = show;
  Object.defineProperty(root, "value", { get: () => activeId });
  show(opts.remember ? store.get(opts.remember, sections[0].id) : sections[0].id);
  return root;
}
export function kv(label, value) {
  return h("div.kv", h("b", { text: label }), h("span", { text: value }));
}
export function tbl(headers, rows) {
  return h("div.tbl-wrap",
    h("div.tbl-scroll",
      h("table.tbl",
        h("thead", h("tr", headers.map((x) => h("th", { text: x })))),
        h("tbody", rows.map((r) => h("tr", r.map((c) => h("td", c instanceof Node ? c : { text: String(c) }))))))));
}
export function out(text = "", cls = "") {
  return h("div.out" + (cls ? "." + cls.split(" ").join(".") : ""), { text });
}

/* ── tool registry ──────────────────────────────────────── */
export const tools = [];
const byId = new Map();
export function defineTool(tool) {
  const t = { cat: "misc", icon: "▣", tags: [], desc: "", ...tool };
  t.search = [t.name, t.desc, t.cat, ...(t.tags || [])].join(" ").toLowerCase();
  tools.push(t);
  byId.set(t.id, t);
  return t;
}
export const getTool = (id) => byId.get(id);

/* commands (palette-invokable actions beyond tools) */
export const commands = [];
export function defineCommand(cmd) { commands.push({ icon: "⌁", ...cmd }); }

/* ── favorites ──────────────────────────────────────────── */
export function favorites() { return store.get("favorites", []); }
export function isFav(id) { return favorites().includes(id); }
export function toggleFav(id) {
  const f = favorites();
  const i = f.indexOf(id);
  if (i >= 0) f.splice(i, 1); else f.push(id);
  store.set("favorites", f);
  emit("favorites");
  return i < 0;
}

/* ── recents ────────────────────────────────────────────── */
export function pushRecent(id) {
  if (id === "home") return;
  const r = store.get("recents", []).filter((x) => x !== id);
  r.unshift(id);
  store.set("recents", r.slice(0, 8));
}
export const recents = () => store.get("recents", []);

/* ── event bus ──────────────────────────────────────────── */
const bus = new EventTarget();
export const on = (name, fn) => bus.addEventListener(name, fn);
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));

/* ── router ─────────────────────────────────────────────── */
let currentTool = null;
let teardown = null;

export function navigate(id, opts = {}) {
  const tool = byId.get(id) || byId.get("home");
  if (!tool) return;
  const hash = "#/" + tool.id;
  if (location.hash !== hash && !opts.fromHash) location.hash = hash;
  if (currentTool === tool.id && !opts.force) return;
  currentTool = tool.id;

  try { teardown?.(); } catch (err) { console.warn("teardown failed", err); }
  teardown = null;

  const view = $("#view");
  clear(view);
  const head = h("div.tool-head",
    h("div.tool-title",
      h("span.t-icon", { text: tool.icon }),
      h("div",
        h("h2", { text: tool.name }),
        tool.desc ? h("p", { text: tool.desc }) : null)),
    h("div.card-actions",
      h("button.icon-btn", {
        title: "Pin to favorites",
        text: isFav(tool.id) ? "★" : "☆",
        class: isFav(tool.id) ? "on" : "",
        onclick(e) {
          const nowFav = toggleFav(tool.id);
          e.currentTarget.textContent = nowFav ? "★" : "☆";
          e.currentTarget.classList.toggle("on", nowFav);
          toast(nowFav ? "pinned" : "unpinned");
        },
      })));
  const body = h("div.panel-anim");
  view.append(head, body);
  window.scrollTo({ top: 0, behavior: "instant" in document.body.style ? "instant" : "auto" });

  try {
    const result = tool.mount(body);
    if (typeof result === "function") teardown = result;
  } catch (err) {
    console.error(err);
    body.append(out("This tool failed to start:\n" + (err?.stack || err), "err"));
  }

  pushRecent(tool.id);
  emit("navigate", tool.id);
  document.title = tool.id === "home" ? "TRINKET LAB" : `${tool.name} // TRINKET LAB`;
}
export const current = () => currentTool;

export function startRouter() {
  const fromHash = () => {
    const id = location.hash.replace(/^#\/?/, "") || "home";
    navigate(id, { fromHash: true });
  };
  window.addEventListener("hashchange", fromHash);
  fromHash();
}

/* ── modal ──────────────────────────────────────────────── */
export function modal(title, bodyNode, footNode) {
  const host = $("#modal-host");
  clear(host);
  const close = () => { host.hidden = true; clear(host); };
  const overlay = h("div.overlay", {
    onclick(e) { if (e.target === overlay) close(); },
  },
    h("div.modal-box",
      h("div.modal-head",
        h("h3", { text: title }),
        h("button.icon-btn", { text: "✕", title: "Close", onclick: close })),
      h("div.modal-body", bodyNode),
      footNode ? h("div.modal-head", footNode) : null));
  host.append(overlay);
  host.hidden = false;
  host.close = close;
  return close;
}
export function closeOverlays() {
  const m = $("#modal-host");
  if (m && !m.hidden) { m.hidden = true; clear(m); return true; }
  const p = $("#palette-host");
  if (p && !p.hidden) { p.hidden = true; clear(p); return true; }
  return false;
}

/* ── command palette ────────────────────────────────────── */
function fuzzy(needle, haystack) {
  if (!needle) return 1;
  const n = needle.toLowerCase(), s = haystack.toLowerCase();
  const direct = s.indexOf(n);
  if (direct >= 0) return 1000 - direct;
  let i = 0, score = 0;
  for (const ch of n) {
    const at = s.indexOf(ch, i);
    if (at < 0) return 0;
    score += at === i ? 3 : 1;
    i = at + 1;
  }
  return score;
}

export function openPalette(prefill = "") {
  const host = $("#palette-host");
  clear(host);
  const close = () => { host.hidden = true; clear(host); };
  const list = h("div.palette-list");
  const box = h("input", {
    type: "text", placeholder: "Search tools and actions…", value: prefill,
    spellcheck: "false", autocomplete: "off",
  });
  let items = [], cursor = 0;

  const entries = () => [
    ...tools.filter((t) => t.id !== "home").map((t) => ({
      icon: t.icon, label: t.name, sub: t.cat, search: t.search, run: () => navigate(t.id),
    })),
    ...commands.map((c) => ({
      icon: c.icon, label: c.label, sub: c.sub || "action",
      search: (c.label + " " + (c.keywords || "")).toLowerCase(), run: c.run,
    })),
  ];

  function render() {
    const q = box.value.trim();
    items = entries()
      .map((e) => ({ e, score: fuzzy(q, e.search) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((x) => x.e);
    cursor = 0;
    clear(list);
    if (!items.length) { list.append(h("div.palette-empty", { text: "no matches" })); return; }
    items.forEach((e, i) => {
      list.append(h("button.palette-item", {
        type: "button", class: i === 0 ? "on" : "",
        onclick() { close(); e.run(); },
        onmouseenter() { cursor = i; paintCursor(); },
      },
        h("span.pi-icon", { text: e.icon }),
        h("span", { text: e.label }),
        h("span.pi-sub", { text: e.sub })));
    });
  }
  function paintCursor() {
    $$(".palette-item", list).forEach((n, i) => n.classList.toggle("on", i === cursor));
    $$(".palette-item", list)[cursor]?.scrollIntoView({ block: "nearest" });
  }
  box.addEventListener("input", render);
  box.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); cursor = (cursor + 1) % items.length; paintCursor(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); cursor = (cursor - 1 + items.length) % items.length; paintCursor(); }
    else if (e.key === "Enter") { e.preventDefault(); const it = items[cursor]; if (it) { close(); it.run(); } }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  });

  const overlay = h("div.overlay", { onclick(e) { if (e.target === overlay) close(); } },
    h("div.palette-box", box, list));
  host.append(overlay);
  host.hidden = false;
  render();
  box.focus();
  box.select();
}

/* ── shortcuts ──────────────────────────────────────────── */
export const shortcuts = [];
export function defineShortcut(keys, description, run, opts = {}) {
  shortcuts.push({ keys, description, run, ...opts });
}
export function startShortcuts() {
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); return openPalette(); }
    if (e.key === "Escape") { if (closeOverlays()) e.preventDefault(); return; }
    if (typing || e.altKey) {
      if (e.altKey && !typing) { /* fall through for alt combos */ } else return;
    }
    for (const s of shortcuts) {
      if (s.match?.(e)) { e.preventDefault(); s.run(); return; }
    }
  });
}

/* ── lazy external library loader (cached by the service worker) ── */
const scriptCache = new Map();
export function loadScript(url, globalName) {
  if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
  if (scriptCache.has(url)) return scriptCache.get(url);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = () => resolve(globalName ? window[globalName] : true);
    s.onerror = () => { scriptCache.delete(url); reject(new Error("could not load " + url + (navigator.onLine ? "" : " — you are offline"))); };
    document.head.append(s);
  });
  scriptCache.set(url, p);
  return p;
}

/** Drop zone element that accepts files (multiple) and calls onFiles(files). */
export function dropzone(label, onFiles, { accept = "", multiple = true } = {}) {
  const dz = h("div.dropzone", { tabindex: 0 },
    h("div.dz-icon", { text: "⇩" }), h("p.dz-title", { text: label }),
    h("p.dz-sub", "drop files here · or ", h("span.link", { text: "browse" })));
  dz.addEventListener("click", async () => { const f = await pickFile({ accept, multiple }); const list = multiple ? f : f ? [f] : []; if (list.length) onFiles(list); });
  dz.addEventListener("keydown", (e) => { if (e.key === "Enter") dz.click(); });
  dz.addEventListener("dragover", (e) => { e.preventDefault(); e.stopPropagation(); dz.classList.add("hot"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("hot"));
  dz.addEventListener("drop", (e) => { e.preventDefault(); e.stopPropagation(); dz.classList.remove("hot"); const files = [...(e.dataTransfer?.files || [])]; if (files.length) onFiles(multiple ? files : files.slice(0, 1)); });
  return dz;
}
