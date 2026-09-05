import { h, defineTool, store, textarea, input, btn, card, copy, toast, subtabs, field, select, out, kv, download, pickFile, readAs, num, debounce } from "../core.js";
import { parseCSV, toCSV } from "./json.js";

const TAB = String.fromCharCode(9);

function detect(text) {
  const t = text.trim();
  if (!t) return { rows: [] };
  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      let j = JSON.parse(t);
      if (!Array.isArray(j)) j = Object.values(j).find(Array.isArray) || [j];
      const cols = [...new Set(j.flatMap((r) => (r && typeof r === "object" ? Object.keys(r) : ["value"])))];
      return { rows: [cols, ...j.map((r) => cols.map((c) => (r && typeof r === "object" ? (typeof r[c] === "object" && r[c] !== null ? JSON.stringify(r[c]) : r[c] ?? "") : r)))] };
    } catch {}
  }
  if (t.startsWith("<")) {
    const doc = new DOMParser().parseFromString(t, "text/html");
    const trs = [...doc.querySelectorAll("tr")];
    if (trs.length) return { rows: trs.map((tr) => [...tr.children].map((td) => td.textContent.trim())) };
  }
  if (/^\s*\|.*\|\s*$/m.test(t) && /\|\s*:?-{2,}/.test(t)) {
    const lines = t.split("\n").filter((l) => l.includes("|") && !/^\s*\|?\s*:?-{2,}/.test(l));
    return { rows: lines.map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())) };
  }
  const count = (ch) => t.split(ch).length - 1;
  const delim = count(TAB) > count(",") ? TAB : count(";") > count(",") ? ";" : ",";
  return { rows: parseCSV(t, delim), delim };
}

defineTool({
  id: "table", name: "Table Lab", icon: "▦", cat: "data",
  desc: "Paste CSV / TSV / JSON / Markdown / HTML tables → edit, sort, filter, transpose → export CSV, JSON, Markdown, HTML, SQL, Excel.",
  tags: ["csv", "tsv", "table", "spreadsheet", "excel", "sheets", "json to csv", "csv to json", "markdown table", "html table", "sql insert", "transpose", "sort"],
  mount(root) {
    let rows = store.get("table.rows", [["name", "qty", "price"], ["Widget", "4", "2.50"], ["Gadget", "10", "7.00"], ["Doohickey", "1", "19.99"]]);
    let header = store.get("table.header", true);
    let sortCol = -1, sortDir = 1, filterQ = "";
    const grid = h("div.tbl-wrap");
    const status = h("span.chip");
    const statsBox = h("div.row.tight");
    const pasteTa = textarea({ placeholder: "paste CSV, TSV, JSON, a Markdown table or an HTML table…", style: { minHeight: "110px" } });
    const save = () => { store.set("table.rows", rows); store.set("table.header", header); };
    const body = () => (header ? rows.slice(1) : rows);
    const head = () => (header ? rows[0] : rows[0]?.map((_, i) => `col${i + 1}`)) || [];
    const isNum = (v) => v !== "" && v !== null && v !== undefined && !isNaN(v);
    const view = () => {
      let b = body().map((r, i) => ({ r, i }));
      if (filterQ) b = b.filter(({ r }) => r.join(" ").toLowerCase().includes(filterQ));
      if (sortCol >= 0) b.sort((a, c) => { const x = a.r[sortCol] ?? "", y = c.r[sortCol] ?? ""; return (isNum(x) && isNum(y) ? x - y : String(x).localeCompare(String(y))) * sortDir; });
      return b;
    };

    const render = () => {
      save();
      const cols = head();
      const shown = view();
      const table = h("table.tbl");
      table.append(h("thead", h("tr", ...cols.map((c, ci) => h("th", { style: { cursor: "pointer" }, onclick: () => { if (sortCol === ci) sortDir *= -1; else { sortCol = ci; sortDir = 1; } render(); } },
        h("span", { contenteditable: header ? "true" : "false", spellcheck: "false", text: c, onblur: (e) => { if (header) { rows[0][ci] = e.target.textContent.trim(); save(); } }, onclick: (e) => e.stopPropagation() }),
        h("span.hint", { text: sortCol === ci ? (sortDir > 0 ? " ▲" : " ▼") : "" }),
        btn("✕", (e) => { e.stopPropagation(); rows.forEach((r) => r.splice(ci, 1)); sortCol = -1; render(); }, "ghost sm"))), h("th", { text: "" }))));
      table.append(h("tbody", ...shown.slice(0, 1000).map(({ r, i }) => {
        const realIdx = header ? i + 1 : i;
        return h("tr", ...cols.map((_, ci) => h("td", { contenteditable: "true", spellcheck: "false", text: r[ci] ?? "", style: isNum(r[ci]) ? { textAlign: "right", color: "var(--amber)" } : {}, onblur: (e) => { rows[realIdx][ci] = e.target.textContent; save(); } })),
          h("td", btn("✕", () => { rows.splice(realIdx, 1); render(); }, "ghost sm danger")));
      })));
      grid.replaceChildren(h("div.tbl-scroll", { style: { maxHeight: "60vh" } }, table));
      const numeric = cols.map((_, ci) => body().map((r) => r[ci]).filter(isNum).map(Number))
        .map((xs, ci) => (xs.length && xs.length >= body().length / 2 ? `${cols[ci]}: Σ ${num(+xs.reduce((a, b) => a + b, 0).toFixed(2))} · avg ${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)} · min ${Math.min(...xs)} · max ${Math.max(...xs)}` : null)).filter(Boolean);
      status.textContent = `${body().length} rows × ${cols.length} cols${filterQ ? ` · ${shown.length} shown` : ""}`;
      statsBox.replaceChildren(...numeric.map((s) => h("span.chip", { text: s })));
    };
    const headerCb = h("input", { type: "checkbox", checked: header, onchange: (e) => { header = e.target.checked; render(); } });
    const load = () => { const d = detect(pasteTa.value); if (!d.rows.length) return toast("nothing recognised", "bad"); rows = d.rows; sortCol = -1; header = true; headerCb.checked = true; render(); tabs.show("grid"); toast(`loaded ${rows.length} rows`, "ok"); };
    const filterIn = input({ type: "search", placeholder: "filter rows…" });
    filterIn.addEventListener("input", debounce(() => { filterQ = filterIn.value.toLowerCase(); render(); }, 120));

    /* exports */
    const exportRows = () => [head(), ...view().map((x) => x.r)];
    const q = (s) => String(s ?? "").replace(/\|/g, "\\|");
    const escHtml = (s) => String(s ?? "").replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
    const EXPORT = {
      CSV: () => toCSV(exportRows()),
      TSV: () => exportRows().map((r) => r.join(TAB)).join("\n"),
      JSON: () => JSON.stringify(view().map((x) => Object.fromEntries(head().map((c, i) => [c, isNum(x.r[i]) ? +x.r[i] : x.r[i] ?? ""]))), null, 2),
      Markdown: () => `| ${head().map(q).join(" | ")} |\n| ${head().map((_, i) => (body().every((r) => isNum(r[i]) || r[i] === "") ? "---:" : "---")).join(" | ")} |\n` + view().map((x) => `| ${x.r.map(q).join(" | ")} |`).join("\n"),
      HTML: () => `<table>\n  <thead><tr>${head().map((c) => `<th>${escHtml(c)}</th>`).join("")}</tr></thead>\n  <tbody>\n${view().map((x) => `    <tr>${x.r.map((c) => `<td>${escHtml(c)}</td>`).join("")}</tr>`).join("\n")}\n  </tbody>\n</table>`,
      SQL: () => { const t = tableName.value || "data"; const col = (c) => c.replace(/\W+/g, "_"); return `CREATE TABLE ${t} (${head().map((c, i) => `${col(c)} ${body().every((r) => isNum(r[i]) || r[i] === "") ? "NUMERIC" : "TEXT"}`).join(", ")});\n` + view().map((x) => `INSERT INTO ${t} (${head().map(col).join(", ")}) VALUES (${x.r.map((c) => (isNum(c) ? c : `'${String(c ?? "").replace(/'/g, "''")}'`)).join(", ")});`).join("\n"); },
      LaTeX: () => `\\begin{tabular}{${head().map(() => "l").join("")}}\n\\hline\n${head().join(" & ")} \\\\\n\\hline\n${view().map((x) => x.r.join(" & ") + " \\\\").join("\n")}\n\\hline\n\\end{tabular}`,
      "JS array": () => `const rows = ${JSON.stringify(exportRows())};`,
    };
    const EXT = { CSV: "csv", TSV: "tsv", JSON: "json", Markdown: "md", HTML: "html", SQL: "sql", LaTeX: "tex", "JS array": "js" };
    const tableName = input({ value: "data", placeholder: "table name", style: { width: "120px" } });
    const expSel = select(Object.keys(EXPORT), { value: store.get("table.export", "CSV"), style: { width: "auto" } });
    const expOut = textarea({ readonly: true, style: { minHeight: "220px" } });
    const renderExport = () => { store.set("table.export", expSel.value); try { expOut.value = EXPORT[expSel.value](); } catch (e) { expOut.value = e.message; } };
    expSel.addEventListener("change", renderExport);
    tableName.addEventListener("input", renderExport);

    const ops = h("div.row",
      btn("+ row", () => { rows.push(head().map(() => "")); render(); }, "sm"),
      btn("+ column", () => { const name = prompt("column name", `col${head().length + 1}`); if (name === null) return; rows.forEach((r, i) => r.push(i === 0 && header ? name : "")); render(); }, "sm"),
      btn("transpose", () => { rows = rows[0].map((_, ci) => rows.map((r) => r[ci] ?? "")); sortCol = -1; render(); }, "sm"),
      btn("dedupe rows", () => { const seen = new Set(); rows = rows.filter((r, i) => { if (i === 0 && header) return true; const k = r.join(""); if (seen.has(k)) return false; seen.add(k); return true; }); render(); }, "sm"),
      btn("drop empty rows", () => { rows = rows.filter((r, i) => (i === 0 && header) || r.some((c) => String(c).trim())); render(); }, "sm"),
      btn("trim cells", () => { rows = rows.map((r) => r.map((c) => String(c).trim())); render(); }, "sm"),
      btn("apply sort permanently", () => { const b = view().map((x) => x.r); rows = header ? [rows[0], ...b] : b; sortCol = -1; filterQ = ""; filterIn.value = ""; render(); }, "ghost sm"),
      btn("clear", () => { rows = [["col1"]]; render(); }, "ghost sm danger"));

    const tabs = subtabs([
      { id: "grid", label: "Table", render: () => { render(); return h("div.col", h("div.row", status, h("label.check", headerCb, "first row is header"), filterIn, h("span.hint", { text: "click headers to sort · cells are editable" })), grid, statsBox, ops); } },
      { id: "in", label: "Import", render: () => h("div.col", pasteTa, h("div.row", btn("Load", load, "primary sm"), btn("Open file", async () => { const f = await pickFile({ accept: ".csv,.tsv,.txt,.json,.md,.html" }); if (f) { pasteTa.value = await readAs.text(f); load(); } }, "sm"), h("span.hint", { text: "auto-detects CSV / TSV / ; / JSON / markdown / HTML" }))) },
      { id: "out", label: "Export", render: () => { renderExport(); return h("div.col", h("div.row", field("format", expSel), field("sql table", tableName), btn("Copy", () => copy(expOut.value), "ghost sm"), btn("Download", () => download(expOut.value, "table." + EXT[expSel.value]), "ghost sm"), btn("Copy for Excel / Sheets", () => copy(EXPORT.TSV(), "copied as TSV — paste into a spreadsheet"), "sm")), expOut, h("p.hint", { text: "exports respect the current filter and sort" })); } },
    ], { remember: "table.tab" });
    root.append(tabs);
  },
});
