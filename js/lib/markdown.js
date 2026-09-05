/* Small dependency-free Markdown -> HTML renderer.
   Supports: ATX headings, setext h1/h2, fenced + indented code, inline code,
   bold/italic/strike, links, images, autolinks, blockquotes, nested lists,
   task lists, tables, hr. Output is escaped -- no raw HTML pass-through. */
"use strict";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SENT = String.fromCharCode(1); // marker around already-rendered inline spans

function inline(src) {
  let s = esc(src);
  const stash = [];
  const keep = (html) => SENT + (stash.push(html) - 1) + SENT;
  // inline code first so nothing inside it is transformed
  s = s.replace(/(`+)([\s\S]+?)\1/g, (_, __, code) => keep("<code>" + code.trim() + "</code>"));
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_, alt, url, title) => keep(`<img src="${url}" alt="${alt}"${title ? ` title="${title}"` : ""}>`));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_, text, url, title) => keep(`<a href="${url}" target="_blank" rel="noopener"${title ? ` title="${title}"` : ""}>${text}</a>`));
  s = s.replace(/&lt;(https?:\/\/[^\s>]+)&gt;/g, (_, url) => keep(`<a href="${url}" target="_blank" rel="noopener">${url}</a>`));
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, pre, url) => pre + keep(`<a href="${url}" target="_blank" rel="noopener">${url}</a>`));
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^_\w])_([^_\n]+)_/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  s = s.replace(/ {2,}$/gm, "<br>");
  return s.replace(new RegExp(SENT + "(\\d+)" + SENT, "g"), (_, i) => stash[+i]);
}

const listMarker = (line) => {
  const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
  if (!m) return null;
  return { indent: m[1].replace(/\t/g, "  ").length, ordered: /\d/.test(m[2]), text: m[3] };
};

export function render(src) {
  const lines = String(src).replace(/\r\n?/g, "\n").split("\n");
  let html = "";
  let i = 0;

  const renderList = (depth) => {
    const first = listMarker(lines[i]);
    const tag = first.ordered ? "ol" : "ul";
    let block = "<" + tag + ">";
    while (i < lines.length) {
      const item = listMarker(lines[i]);
      if (!item || item.indent < depth) break;
      if (item.indent > depth) { block += renderList(item.indent); continue; }
      let text = item.text;
      let li = "";
      const task = /^\[([ xX])\]\s+(.*)$/.exec(text);
      if (task) {
        li += `<input type="checkbox" disabled${/[xX]/.test(task[1]) ? " checked" : ""}> `;
        text = task[2];
      }
      i++;
      while (i < lines.length && lines[i].trim() && !listMarker(lines[i]) && !/^(#{1,6}\s|>|```|\s*$)/.test(lines[i])) {
        text += " " + lines[i].trim();
        i++;
      }
      li += inline(text);
      if (i < lines.length) {
        const next = listMarker(lines[i]);
        if (next && next.indent > depth) li += renderList(next.indent);
      }
      block += "<li>" + li + "</li>";
    }
    return block + "</" + tag + ">";
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const fence = /^\s*(```+|~~~+)\s*([\w+-]*)\s*$/.exec(line);
    if (fence) {
      const close = fence[1][0];
      i++;
      const buf = [];
      while (i < lines.length && !new RegExp("^\\s*" + close + "{3,}\\s*$").test(lines[i])) buf.push(lines[i++]);
      i++;
      html += `<pre><code${fence[2] ? ` class="lang-${fence[2]}"` : ""}>${esc(buf.join("\n"))}</code></pre>`;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      html += `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`;
      i++;
      continue;
    }

    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) { html += "<hr>"; i++; continue; }

    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const cells = (row) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const aligns = cells(lines[i + 1]).map((c) =>
        c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : "left");
      const head = cells(line);
      i += 2;
      let body = "";
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        body += "<tr>" + cells(lines[i]).map((c, k) => `<td style="text-align:${aligns[k] || "left"}">${inline(c)}</td>`).join("") + "</tr>";
        i++;
      }
      html += `<table><thead><tr>${head.map((c, k) => `<th style="text-align:${aligns[k] || "left"}">${inline(c)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
      html += "<blockquote>" + render(buf.join("\n")) + "</blockquote>";
      continue;
    }

    if (listMarker(line)) { html += renderList(listMarker(line).indent); continue; }

    if (/^ {4,}\S/.test(line)) {
      const buf = [];
      while (i < lines.length && (/^ {4,}/.test(lines[i]) || !lines[i].trim())) buf.push(lines[i++].replace(/^ {4}/, ""));
      html += "<pre><code>" + esc(buf.join("\n").replace(/\n+$/, "")) + "</code></pre>";
      continue;
    }

    const buf = [];
    const startedAt = i;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*>|```|~~~)/.test(lines[i]) && !listMarker(lines[i])) {
      if (/^\s*(=+|-{2,})\s*$/.test(lines[i]) && buf.length) {
        const level = lines[i].trim().startsWith("=") ? 1 : 2;
        html += `<h${level}>${inline(buf.join(" "))}</h${level}>`;
        buf.length = 0;
        i++;
        break;
      }
      buf.push(lines[i++]);
    }
    if (buf.length) html += "<p>" + inline(buf.join("\n")) + "</p>";
    if (i === startedAt) i++; // never stall
  }
  return html;
}

/** Strip markdown to plain text (for word counts / previews). */
export function toText(src) {
  return String(src)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[>#\s*+-]+/gm, "")
    .replace(/[*_~]/g, "");
}

/** Extract headings for a table of contents. */
export function outline(src) {
  const out = [];
  let fenced = false;
  for (const line of String(src).split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2] });
  }
  return out;
}
