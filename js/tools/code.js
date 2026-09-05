import { h, defineTool, store, textarea, input, btn, card, copy, toast, subtabs, field, select, out, kv, tbl, download, debounce, num } from "../core.js";

/* ── formatters (pragmatic, regex-based) ────────────────── */
const VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr|!doctype|!--)/i;
const INLINE = /^(a|abbr|b|bdi|bdo|cite|code|data|dfn|em|i|kbd|mark|q|s|samp|small|span|strong|sub|sup|time|u|var|label|button)$/i;
export function formatHTML(src) {
  const tokens = src.replace(/>\s+</g, "><").match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) || [];
  let depth = 0, outS = "";
  for (const t of tokens) {
    const isTag = t.startsWith("<"), name = isTag ? (t.match(/^<\/?([\w!-]+)/) || [])[1] || "" : "";
    if (isTag && t.startsWith("</")) depth = Math.max(0, depth - 1);
    const text = isTag ? t : t.trim();
    if (!text) continue;
    if (isTag && INLINE.test(name) && outS.endsWith("\n") === false && !/^<\//.test(t)) { outS += text; }
    else outS += (outS && !outS.endsWith("\n") ? "\n" : "") + "  ".repeat(depth) + text + "\n";
    if (isTag && !t.startsWith("</") && !t.endsWith("/>") && !VOID.test(name) && !INLINE.test(name)) depth++;
  }
  return outS.replace(/\n{2,}/g, "\n").trim();
}
export const minifyHTML = (s) => s.replace(/<!--(?!\[if)[\s\S]*?-->/g, "").replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
export function formatCSS(src) {
  let s = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m).replace(/\s+/g, " ").replace(/\s*([{}:;,>])\s*/g, "$1");
  let depth = 0, outS = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "{") { depth++; outS += " {\n" + "  ".repeat(depth); }
    else if (c === "}") { depth = Math.max(0, depth - 1); outS = outS.replace(/\s+$/, "") + "\n" + "  ".repeat(depth) + "}\n" + "  ".repeat(depth); }
    else if (c === ";") outS += ";\n" + "  ".repeat(depth);
    else if (c === ":" && depth > 0 && !/^\s*[^{]*:[^;{]*\(/.test(s.slice(i - 20, i))) outS += ": ";
    else if (c === ",") outS += depth === 0 ? ",\n" : ", ";
    else outS += c;
  }
  return outS.replace(/\n\s*\n/g, "\n").replace(/^\s+$/gm, "").trim();
}
export const minifyCSS = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{}:;,>])\s*/g, "$1").replace(/;}/g, "}").trim();
export function minifyJS(s) { // conservative: strips comments + indentation, keeps strings safe
  let outS = "", i = 0, q = null;
  while (i < s.length) {
    const c = s[i], n = s[i + 1];
    if (q) { outS += c; if (c === "\\") { outS += n; i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; outS += c; i++; continue; }
    if (c === "/" && n === "/") { while (i < s.length && s[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { i = s.indexOf("*/", i + 2); i = i < 0 ? s.length : i + 2; continue; }
    outS += c; i++;
  }
  return outS.split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
}
export function formatSQL(src) {
  const KW = ["SELECT", "FROM", "WHERE", "AND", "OR", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "OUTER JOIN", "JOIN", "ON", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET", "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM", "CREATE TABLE", "ALTER TABLE", "DROP TABLE", "UNION ALL", "UNION", "WITH", "AS", "CASE", "WHEN", "THEN", "ELSE", "END", "DISTINCT", "IN", "NOT", "NULL", "IS", "LIKE", "BETWEEN", "EXISTS", "ASC", "DESC", "COUNT", "SUM", "AVG", "MIN", "MAX"];
  let s = src.replace(/\s+/g, " ").trim();
  for (const k of KW) s = s.replace(new RegExp(`\\b${k.replace(" ", "\\s+")}\\b`, "gi"), k);
  const NL = ["SELECT", "FROM", "WHERE", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "OUTER JOIN", "JOIN", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET", "VALUES", "SET", "UNION ALL", "UNION", "INSERT INTO", "UPDATE", "DELETE FROM"];
  for (const k of NL) s = s.replace(new RegExp(`\\s*\\b${k}\\b`, "g"), "\n" + k);
  s = s.replace(/\s+(AND|OR)\s+/g, "\n  $1 ").replace(/,\s*/g, ",\n  ").replace(/\n{2,}/g, "\n");
  return s.trim() + (s.trim().endsWith(";") ? "" : ";");
}
export function formatXML(src) {
  const s = src.replace(/>\s+</g, "><").trim();
  let depth = 0, outS = "";
  for (const t of s.match(/<[^>]+>|[^<]+/g) || []) {
    if (/^<\//.test(t)) depth = Math.max(0, depth - 1);
    outS += "  ".repeat(depth) + t.trim() + "\n";
    if (/^<[^!?/][^>]*[^/]>$/.test(t)) depth++;
  }
  return outS.trim();
}
const ESCAPES = {
  "JSON / JS string": (s) => JSON.stringify(s),
  "JS template literal": (s) => "`" + s.replace(/[`\\$]/g, "\\$&") + "`",
  "HTML text": (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])),
  "HTML attribute": (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  "shell (single-quoted)": (s) => "'" + s.replace(/'/g, "'\\''") + "'",
  "shell (double-quoted)": (s) => '"' + s.replace(/[$`"\\!]/g, "\\$&") + '"',
  "regex literal": (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"),
  "CSV cell": (s) => '"' + s.replace(/"/g, '""') + '"',
  "SQL string": (s) => "'" + s.replace(/'/g, "''") + "'",
  "URL component": (s) => encodeURIComponent(s),
  "C / Java string": (s) => '"' + s.replace(/[\\"]/g, "\\$&").replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"',
  "Python string": (s) => "'" + s.replace(/[\\']/g, "\\$&").replace(/\n/g, "\\n") + "'",
  "Markdown (escape)": (s) => s.replace(/[\\`*_{}[\]()#+\-.!|>]/g, "\\$&"),
  "XML CDATA": (s) => "<![CDATA[" + s.replace(/]]>/g, "]]]]><![CDATA[>") + "]]>",
};
export function htmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walk = (node, depth = 0) => {
    if (node.nodeType === 3) return node.textContent.replace(/\s+/g, " ");
    if (node.nodeType !== 1) return "";
    const tag = node.tagName.toLowerCase();
    const inner = () => [...node.childNodes].map((n) => walk(n, depth)).join("");
    switch (tag) {
      case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": return `\n${"#".repeat(+tag[1])} ${inner().trim()}\n\n`;
      case "p": return `\n${inner().trim()}\n\n`;
      case "br": return "  \n";
      case "hr": return "\n---\n\n";
      case "strong": case "b": return `**${inner()}**`;
      case "em": case "i": return `*${inner()}*`;
      case "del": case "s": case "strike": return `~~${inner()}~~`;
      case "code": return node.parentElement?.tagName === "PRE" ? inner() : "`" + inner() + "`";
      case "pre": return "\n```\n" + node.textContent.replace(/\n$/, "") + "\n```\n\n";
      case "a": return `[${inner()}](${node.getAttribute("href") || ""})`;
      case "img": return `![${node.getAttribute("alt") || ""}](${node.getAttribute("src") || ""})`;
      case "blockquote": return "\n" + inner().trim().split("\n").map((l) => "> " + l).join("\n") + "\n\n";
      case "ul": case "ol": return "\n" + [...node.children].map((li, i) => "  ".repeat(depth) + (tag === "ol" ? `${i + 1}. ` : "- ") + [...li.childNodes].map((n) => walk(n, depth + 1)).join("").trim()).join("\n") + "\n\n";
      case "table": { const rows = [...node.querySelectorAll("tr")].map((tr) => [...tr.children].map((td) => walk(td).trim().replace(/\|/g, "\\|"))); if (!rows.length) return ""; return "\n| " + rows[0].join(" | ") + " |\n| " + rows[0].map(() => "---").join(" | ") + " |\n" + rows.slice(1).map((r) => "| " + r.join(" | ") + " |").join("\n") + "\n\n"; }
      case "script": case "style": case "nav": case "head": return "";
      default: return inner();
    }
  };
  return walk(doc.body).replace(/\n{3,}/g, "\n\n").trim();
}

defineTool({
  id: "code", name: "Code Tools", icon: "</>", cat: "data",
  desc: "Beautify & minify HTML/CSS/JS/SQL/XML, escape strings for any language, HTML → Markdown, SVG → PNG, code stats.",
  tags: ["beautify", "minify", "format", "prettier", "html", "css", "javascript", "sql", "xml", "escape", "html to markdown", "svg to png", "svg optimizer", "line count", "loc"],
  mount(root) {
    const src = textarea({ placeholder: "paste code…", style: { minHeight: "260px" } });
    src.value = store.get("code.src", "");
    const dst = textarea({ readonly: true, style: { minHeight: "260px" } });
    src.addEventListener("input", debounce(() => store.set("code.src", src.value), 300));
    const lang = select(["html", "css", "js", "sql", "xml", "json"], { value: store.get("code.lang", "html"), style: { width: "auto" } });
    lang.addEventListener("change", () => store.set("code.lang", lang.value));
    const stats = h("div.row.tight");
    const run = (fn) => () => { try { dst.value = fn(src.value); stats.replaceChildren(h("span.chip", { text: `${num(src.value.length)} → ${num(dst.value.length)} chars` }), h("span.chip", { text: `${Math.round((1 - dst.value.length / Math.max(1, src.value.length)) * 100)}% change` })); } catch (e) { dst.value = "error: " + e.message; } };
    const beautify = () => ({ html: formatHTML, css: formatCSS, js: (s) => s, sql: formatSQL, xml: formatXML, json: (s) => JSON.stringify(JSON.parse(s), null, 2) }[lang.value]);
    const minify = () => ({ html: minifyHTML, css: minifyCSS, js: minifyJS, sql: (s) => s.replace(/\s+/g, " ").trim(), xml: (s) => s.replace(/>\s+</g, "><").trim(), json: (s) => JSON.stringify(JSON.parse(s)) }[lang.value]);
    const stripComments = (s) => lang.value === "html" || lang.value === "xml" ? s.replace(/<!--[\s\S]*?-->/g, "") : lang.value === "css" ? s.replace(/\/\*[\s\S]*?\*\//g, "") : lang.value === "sql" ? s.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "") : minifyJS(s);

    const codeStats = () => { const lines = src.value.split(/\r?\n/); const blank = lines.filter((l) => !l.trim()).length; const comments = lines.filter((l) => /^\s*(\/\/|#|\/\*|\*|<!--|--)/.test(l)).length; const indentTabs = lines.filter((l) => /^\t/.test(l)).length, indentSp = lines.filter((l) => /^ {2,}/.test(l)).length; const trailing = lines.filter((l) => /[ \t]+$/.test(l)).length; const longest = Math.max(0, ...lines.map((l) => l.length)); const crlf = (src.value.match(/\r\n/g) || []).length; return h("div.kv-list", kv("lines", num(lines.length)), kv("code lines", num(lines.length - blank - comments)), kv("blank", num(blank)), kv("comment-ish", num(comments)), kv("indentation", indentTabs > indentSp ? "tabs" : indentSp ? "spaces" : "none"), kv("line endings", crlf ? `CRLF (${crlf})` : "LF"), kv("trailing whitespace", num(trailing) + " lines"), kv("longest line", longest + " chars"), kv("bytes", num(new TextEncoder().encode(src.value).length)), kv("words", num((src.value.match(/\w+/g) || []).length))); };
    const escOut = h("div.col", { style: { gap: "6px" } });
    const renderEsc = () => escOut.replaceChildren(...Object.entries(ESCAPES).map(([k, f]) => { let v; try { v = f(src.value); } catch (e) { v = "error"; } return h("div.list-item", h("span.hint", { text: k, style: { width: "170px", flex: "none" } }), h("span.li-text.mono", { text: v, style: { fontSize: "12px", whiteSpace: "pre-wrap" } }), btn("copy", () => copy(v), "ghost sm")); }));

    /* svg */
    const svgIn = textarea({ placeholder: "<svg …>…</svg>", style: { minHeight: "160px" } });
    const svgPrev = h("div", { style: { minHeight: "120px", display: "grid", placeItems: "center", background: "var(--bg-2)", borderRadius: "12px", border: "1px solid var(--line)", padding: "12px" } });
    const svgScale = input({ type: "number", value: 2, min: 0.1, step: 0.5, style: { width: "80px" } });
    const svgInfo = h("span.chip");
    const svgRender = () => { const s = svgIn.value.trim(); svgPrev.replaceChildren(); if (!s.startsWith("<svg")) return; const img = new Image(); img.style.maxWidth = "100%"; img.style.maxHeight = "260px"; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s); svgPrev.append(img); svgInfo.textContent = `${num(s.length)} chars`; };
    svgIn.addEventListener("input", debounce(svgRender, 200));
    const svgMinify = () => { svgIn.value = svgIn.value.replace(/<!--[\s\S]*?-->/g, "").replace(/<\?xml[^>]*>/g, "").replace(/<metadata>[\s\S]*?<\/metadata>/g, "").replace(/\s+/g, " ").replace(/>\s+</g, "><").replace(/(\d+\.\d{3})\d+/g, "$1").trim(); svgRender(); };
    const svgToPng = () => { const s = svgIn.value.trim(); if (!s.startsWith("<svg")) return toast("paste an <svg> first", "bad"); const img = new Image(); img.onload = () => { const k = +svgScale.value || 1; const c = document.createElement("canvas"); c.width = (img.naturalWidth || 300) * k; c.height = (img.naturalHeight || 150) * k; c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); c.toBlob((b) => download(b, "image.png")); }; img.onerror = () => toast("could not render SVG (needs width/height or viewBox)", "bad"); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s); };

    root.append(subtabs([
      { id: "fmt", label: "Beautify / minify", render: () => h("div.col", h("div.row", field("language", lang), btn("Beautify", run(beautify()), "primary sm"), btn("Minify", run(minify()), "sm"), btn("Strip comments", run(stripComments), "sm"), btn("Tabs → 2 spaces", run((s) => s.replace(/\t/g, "  ")), "ghost sm"), btn("2 → 4 spaces", run((s) => s.replace(/^( +)/gm, (m) => " ".repeat(m.length * 2))), "ghost sm"), btn("Trim trailing ws", run((s) => s.replace(/[ \t]+$/gm, "")), "ghost sm"), btn("CRLF → LF", run((s) => s.replace(/\r\n/g, "\n")), "ghost sm"), stats), h("div.grid.g2", card("Input", src, [btn("Clear", () => { src.value = ""; }, "ghost sm danger")]), card("Output", dst, [btn("Copy", () => copy(dst.value), "ghost sm"), btn("↑ Use as input", () => { src.value = dst.value; }, "ghost sm"), btn("Save", () => download(dst.value, "code." + lang.value), "ghost sm")]))) },
      { id: "esc", label: "Escape for…", render: () => { renderEsc(); src.addEventListener("input", debounce(renderEsc, 150)); return h("div.col", card("Input", src), escOut); } },
      { id: "md", label: "HTML → Markdown", render: () => h("div.col", h("div.row", btn("Convert HTML → Markdown", run(htmlToMarkdown), "primary sm"), h("span.hint", { text: "paste HTML (or a copied web page) on the left" })), h("div.grid.g2", card("HTML", src), card("Markdown", dst, [btn("Copy", () => copy(dst.value), "ghost sm"), btn("Save .md", () => download(dst.value, "converted.md", "text/markdown"), "ghost sm")]))) },
      { id: "svg", label: "SVG", render: () => { svgRender(); return h("div.grid.g2", card("SVG source", h("div.col", svgIn, h("div.row", btn("Minify", svgMinify, "sm"), btn("Copy data URL", () => copy("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgIn.value.trim())), "ghost sm"), btn("Copy base64 data URL", () => copy("data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgIn.value.trim())))), "ghost sm"), btn("Copy CSS url()", () => copy(`background-image: url("data:image/svg+xml,${encodeURIComponent(svgIn.value.trim()).replace(/%20/g, " ")}");`), "ghost sm"), svgInfo)), card("Preview", h("div.col", svgPrev, h("div.row", field("scale", svgScale), btn("↓ PNG", svgToPng, "primary sm"), btn("Save .svg", () => download(svgIn.value, "image.svg", "image/svg+xml"), "ghost sm")))))); } },
      { id: "stats", label: "Stats", render: () => h("div.col", card("Input", src), codeStats()) },
    ], { remember: "code.tab" }));
  },
});
