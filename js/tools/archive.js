import { h, defineTool, btn, card, toast, subtabs, field, input, out, tbl, download, bytes, dropzone, textarea, copy, num } from "../core.js";
import { createZip, readZip, gzip, gunzip } from "../lib/zip.js";

defineTool({
  id: "archive", name: "Zip & Unzip", icon: "▤", cat: "data",
  desc: "Create zip archives, browse and extract zips, gzip / gunzip single files — no upload.",
  tags: ["zip", "unzip", "archive", "compress", "extract", "gzip", "gz", "rar", "7z", "files"],
  mount(root) {
    /* create */
    let queue = [];
    const qList = h("div.col", { style: { gap: "6px" } });
    const zipName = input({ value: "archive.zip" });
    const compressCb = h("input", { type: "checkbox", checked: true });
    const qStatus = h("span.chip", { text: "no files" });
    const renderQ = () => { qList.replaceChildren(...queue.map((f, i) => h("div.list-item", h("span.li-text", { text: f.path }), h("span.hint", { text: bytes(f.file.size) }), btn("✕", () => { queue.splice(i, 1); renderQ(); }, "ghost sm danger")))); qStatus.textContent = `${queue.length} files · ${bytes(queue.reduce((n, f) => n + f.file.size, 0))}`; };
    const addFiles = (fl) => { for (const f of fl) queue.push({ file: f, path: f.webkitRelativePath || f.name }); renderQ(); };
    const textName = input({ placeholder: "notes.txt" }), textBody = textarea({ placeholder: "add a text file from the clipboard…", style: { minHeight: "80px" } });
    const build = async () => {
      if (!queue.length) return toast("add files first", "bad");
      qStatus.textContent = "compressing…";
      const entries = []; for (const q of queue) entries.push({ name: q.path, data: await q.file.arrayBuffer(), date: new Date(q.file.lastModified) });
      const zip = await createZip(entries, { compress: compressCb.checked, onProgress: (i, n) => (qStatus.textContent = `compressing ${i}/${n}`) });
      download(new Blob([zip], { type: "application/zip" }), zipName.value.endsWith(".zip") ? zipName.value : zipName.value + ".zip");
      qStatus.textContent = `zip: ${bytes(zip.length)} (${Math.round((1 - zip.length / Math.max(1, entries.reduce((n, e) => n + e.data.byteLength, 0))) * 100)}% smaller)`;
    };

    /* read */
    let entries = [], zipFile = null;
    const eTable = h("div");
    const previewBox = h("div");
    const eStatus = h("span.chip", { text: "no archive" });
    const filter = input({ type: "search", placeholder: "filter entries…" });
    const renderE = () => {
      const q = filter.value.toLowerCase();
      const shown = entries.filter((e) => !e.dir && e.name.toLowerCase().includes(q));
      eTable.replaceChildren(tbl(["name", "size", "packed", "method", "modified", ""], shown.slice(0, 500).map((e) => [e.name, bytes(e.size), bytes(e.csize), e.method === 8 ? "deflate" : e.method === 0 ? "store" : e.method, e.date.toLocaleString(),
        h("div.row.tight", btn("preview", () => preview(e), "ghost sm"), btn("↓", async () => { try { download(new Blob([await e.read()]), e.name.split("/").pop()); } catch (err) { toast(err.message, "bad"); } }, "ghost sm"))])));
      eStatus.textContent = `${entries.filter((e) => !e.dir).length} files · ${bytes(entries.reduce((n, e) => n + e.size, 0))} unpacked`;
    };
    const preview = async (e) => {
      try {
        const data = await e.read();
        const ext = e.name.split(".").pop().toLowerCase();
        if (/^(png|jpe?g|gif|webp|svg|bmp|avif)$/.test(ext)) { const url = URL.createObjectURL(new Blob([data], { type: ext === "svg" ? "image/svg+xml" : "image/" + ext.replace("jpg", "jpeg") })); previewBox.replaceChildren(h("img", { src: url, style: { maxHeight: "320px", borderRadius: "8px" } })); }
        else if (data.length < 2e6 && !data.slice(0, 512).some((b) => b === 0)) previewBox.replaceChildren(h("div.row", btn("Copy", () => copy(new TextDecoder().decode(data)), "ghost sm")), out(new TextDecoder().decode(data).slice(0, 20000)));
        else previewBox.replaceChildren(out(`binary · ${bytes(data.length)} · first bytes: ${[...data.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join(" ")}`));
      } catch (err) { previewBox.replaceChildren(out(err.message, "err")); }
    };
    const open = async (fl) => { const f = fl[0]; try { entries = readZip(await f.arrayBuffer()); zipFile = f; renderE(); previewBox.replaceChildren(); toast(`opened ${f.name}`); } catch (e) { toast(e.message, "bad"); } };
    const extractAll = async () => { if (!entries.length) return; let n = 0; for (const e of entries.filter((x) => !x.dir)) { try { download(new Blob([await e.read()]), e.name.split("/").pop()); n++; await new Promise((r) => setTimeout(r, 250)); } catch {} } toast(`${n} files downloaded`, "ok"); };
    filter.addEventListener("input", renderE);

    /* gzip */
    const gzStatus = h("span.chip", { text: "pick a file" });
    const gzOps = h("div.col", dropzone("Drop a file to gzip / gunzip", async (fl) => {
      const f = fl[0]; const data = new Uint8Array(await f.arrayBuffer());
      try {
        if (f.name.endsWith(".gz") || (data[0] === 0x1f && data[1] === 0x8b)) { const outB = await gunzip(data); download(new Blob([outB]), f.name.replace(/\.gz$/, "") || "decompressed"); gzStatus.textContent = `gunzip: ${bytes(data.length)} → ${bytes(outB.length)}`; }
        else { const outB = await gzip(data); download(new Blob([outB], { type: "application/gzip" }), f.name + ".gz"); gzStatus.textContent = `gzip: ${bytes(data.length)} → ${bytes(outB.length)}`; }
      } catch (e) { toast(e.message, "bad"); }
    }, { multiple: false }), gzStatus, h("p.hint", { text: "Detects .gz automatically. Uses the browser's native DEFLATE (CompressionStream)." }));

    root.append(subtabs([
      { id: "create", label: "Create zip", render: () => h("div.col", dropzone("Drop files to add", addFiles), h("div.row", qStatus, btn("Add folder…", async () => { const inp = h("input", { type: "file", webkitdirectory: true, multiple: true, hidden: true }); inp.onchange = () => addFiles([...inp.files]); document.body.append(inp); inp.click(); setTimeout(() => inp.remove(), 60000); }, "ghost sm"), btn("Clear", () => { queue = []; renderQ(); }, "ghost sm danger")), qList,
          h("details", h("summary.hint", { text: "add a text file from text" }), h("div.col", { style: { marginTop: "8px" } }, textName, textBody, btn("Add to zip", () => { if (!textName.value) return; queue.push({ file: new File([textBody.value], textName.value, { type: "text/plain" }), path: textName.value }); renderQ(); }, "sm"))),
          h("div.row", field("archive name", zipName), h("label.check", compressCb, "compress (deflate)"), btn("↓ Build zip", build, "primary sm"))) },
      { id: "open", label: "Open zip", render: () => h("div.col", dropzone("Drop a .zip to browse", open, { accept: ".zip,application/zip", multiple: false }), h("div.row", eStatus, filter, btn("Extract all", extractAll, "sm")), eTable, previewBox) },
      { id: "gzip", label: "gzip", render: () => gzOps },
    ], { remember: "archive.tab" }));
  },
});
