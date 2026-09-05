import { h, defineTool, btn, card, toast, subtabs, field, input, select, out, kv, tbl, download, bytes, dropzone, loadScript, textarea, copy, seg } from "../core.js";
import { createZip } from "../lib/zip.js";

const LIB = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const lib = () => loadScript(LIB, "PDFLib");
const pdfjs = async () => { const p = await loadScript(PDFJS, "pdfjsLib"); p.GlobalWorkerOptions.workerSrc = WORKER; return p; };
const parseRanges = (s, max) => { const set = []; for (const part of String(s).split(",")) { const m = /^\s*(\d+)?\s*(?:-\s*(\d+)?)?\s*$/.exec(part); if (!m || !part.trim()) continue; const a = m[1] ? +m[1] : 1, b = part.includes("-") ? (m[2] ? +m[2] : max) : a; for (let i = Math.max(1, a); i <= Math.min(max, b); i++) if (!set.includes(i)) set.push(i); } return set; };

defineTool({
  id: "pdf", name: "PDF Workshop", icon: "⎘", cat: "data",
  desc: "Merge, split, rotate, reorder, watermark, page-number; images → PDF; PDF → PNG / text. All in-browser.",
  tags: ["pdf", "merge", "split", "combine", "rotate", "extract", "pages", "images to pdf", "pdf to image", "pdf to text", "watermark", "page numbers", "compress"],
  mount(root) {
    let files = []; // {file, bytes, pages}
    const list = h("div.col", { style: { gap: "6px" } });
    const status = h("span.chip", { text: "libraries load on first use (~1 MB, cached for offline)" });
    const preview = h("div.filmstrip", { style: { flexWrap: "wrap", gap: "10px" } });

    const refresh = () => {
      list.replaceChildren(...files.map((f, i) => h("div.list-item",
        h("span.chip", { text: `${f.pages} p` }), h("span.li-text", { text: f.file.name }), h("span.hint", { text: bytes(f.file.size) }),
        btn("↑", () => { if (i > 0) { [files[i - 1], files[i]] = [files[i], files[i - 1]]; refresh(); } }, "ghost sm"),
        btn("↓", () => { if (i < files.length - 1) { [files[i + 1], files[i]] = [files[i], files[i + 1]]; refresh(); } }, "ghost sm"),
        btn("preview", () => renderThumbs(f), "ghost sm"),
        btn("✕", () => { files.splice(i, 1); refresh(); }, "ghost sm danger"))));
      status.textContent = files.length ? `${files.length} file${files.length > 1 ? "s" : ""} · ${files.reduce((n, f) => n + f.pages, 0)} pages` : "add PDFs to begin";
    };
    const add = async (fl) => {
      try {
        const { PDFDocument } = await lib();
        for (const file of fl) {
          if (!/pdf$/i.test(file.name) && file.type !== "application/pdf") { toast(`${file.name} is not a PDF`, "bad"); continue; }
          const data = new Uint8Array(await file.arrayBuffer());
          const doc = await PDFDocument.load(data, { ignoreEncryption: true });
          files.push({ file, bytes: data, pages: doc.getPageCount() });
        }
        refresh();
      } catch (e) { toast(e.message, "bad"); }
    };
    const save = async (doc, name) => download(new Blob([await doc.save()], { type: "application/pdf" }), name);
    const need = () => { if (!files.length) { toast("add a PDF first", "bad"); return false; } return true; };

    async function renderThumbs(f, scale = 0.25) {
      preview.replaceChildren(h("span.hint", { text: "rendering…" }));
      try {
        const pj = await pdfjs();
        const doc = await pj.getDocument({ data: f.bytes.slice() }).promise;
        preview.replaceChildren();
        for (let i = 1; i <= Math.min(doc.numPages, 40); i++) {
          const page = await doc.getPage(i); const vp = page.getViewport({ scale });
          const c = h("canvas", { width: vp.width, height: vp.height, title: `page ${i}`, style: { height: "120px", width: "auto", borderRadius: "6px", border: "1px solid var(--line)", background: "#fff" } });
          await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
          preview.append(h("div.col", { style: { gap: "2px", alignItems: "center" } }, c, h("span.hint", { text: String(i) })));
        }
        if (doc.numPages > 40) preview.append(h("span.hint", { text: `… ${doc.numPages - 40} more` }));
      } catch (e) { preview.replaceChildren(out("preview failed: " + e.message, "err")); }
    }

    /* actions */
    const merge = async () => { if (!need()) return; const { PDFDocument } = await lib(); const outDoc = await PDFDocument.create(); for (const f of files) { const src = await PDFDocument.load(f.bytes, { ignoreEncryption: true }); const pages = await outDoc.copyPages(src, src.getPageIndices()); pages.forEach((p) => outDoc.addPage(p)); } await save(outDoc, "merged.pdf"); };
    const rangeIn = input({ placeholder: "pages e.g. 1-3, 7, 10-", value: "1-" });
    const extract = async () => { if (!need()) return; const { PDFDocument } = await lib(); const f = files[0]; const src = await PDFDocument.load(f.bytes, { ignoreEncryption: true }); const idx = parseRanges(rangeIn.value, f.pages).map((n) => n - 1); if (!idx.length) return toast("no pages match", "bad"); const outDoc = await PDFDocument.create(); (await outDoc.copyPages(src, idx)).forEach((p) => outDoc.addPage(p)); await save(outDoc, f.file.name.replace(/\.pdf$/i, "") + "-pages.pdf"); };
    const splitEach = async () => { if (!need()) return; const { PDFDocument } = await lib(); const f = files[0]; const src = await PDFDocument.load(f.bytes, { ignoreEncryption: true }); const entries = []; for (let i = 0; i < f.pages; i++) { const d = await PDFDocument.create(); const [p] = await d.copyPages(src, [i]); d.addPage(p); entries.push({ name: `page-${String(i + 1).padStart(3, "0")}.pdf`, data: await d.save() }); } download(new Blob([await createZip(entries, { compress: false })], { type: "application/zip" }), f.file.name.replace(/\.pdf$/i, "") + "-pages.zip"); };
    const deletePages = async () => { if (!need()) return; const { PDFDocument } = await lib(); const f = files[0]; const doc = await PDFDocument.load(f.bytes, { ignoreEncryption: true }); const del = parseRanges(rangeIn.value, f.pages).sort((a, b) => b - a); if (del.length >= f.pages) return toast("cannot delete every page", "bad"); del.forEach((n) => doc.removePage(n - 1)); await save(doc, f.file.name.replace(/\.pdf$/i, "") + "-trimmed.pdf"); };
    const rotSel = select([["90", "90° CW"], ["180", "180°"], ["270", "90° CCW"]], { style: { width: "auto" } });
    const rotate = async () => { if (!need()) return; const { PDFDocument, degrees } = await lib(); const f = files[0]; const doc = await PDFDocument.load(f.bytes, { ignoreEncryption: true }); const pages = parseRanges(rangeIn.value, f.pages); pages.forEach((n) => { const p = doc.getPage(n - 1); p.setRotation(degrees((p.getRotation().angle + +rotSel.value) % 360)); }); await save(doc, f.file.name.replace(/\.pdf$/i, "") + "-rotated.pdf"); };
    const reverse = async () => { if (!need()) return; const { PDFDocument } = await lib(); const f = files[0]; const src = await PDFDocument.load(f.bytes, { ignoreEncryption: true }); const outDoc = await PDFDocument.create(); (await outDoc.copyPages(src, src.getPageIndices().reverse())).forEach((p) => outDoc.addPage(p)); await save(outDoc, f.file.name.replace(/\.pdf$/i, "") + "-reversed.pdf"); };
    const orderIn = input({ placeholder: "new order e.g. 3,1,2,4-6" });
    const reorder = async () => { if (!need()) return; const { PDFDocument } = await lib(); const f = files[0]; const src = await PDFDocument.load(f.bytes, { ignoreEncryption: true }); const idx = parseRanges(orderIn.value, f.pages).map((n) => n - 1); if (!idx.length) return toast("enter an order", "bad"); const outDoc = await PDFDocument.create(); (await outDoc.copyPages(src, idx)).forEach((p) => outDoc.addPage(p)); await save(outDoc, f.file.name.replace(/\.pdf$/i, "") + "-reordered.pdf"); };

    const wmText = input({ placeholder: "CONFIDENTIAL", value: "DRAFT" }), wmSize = input({ type: "number", value: 60, style: { width: "80px" } }), wmOpacity = input({ type: "number", value: 0.25, step: 0.05, min: 0, max: 1, style: { width: "80px" } });
    const watermark = async () => { if (!need()) return; const { PDFDocument, StandardFonts, degrees, rgb } = await lib(); const f = files[0]; const doc = await PDFDocument.load(f.bytes, { ignoreEncryption: true }); const font = await doc.embedFont(StandardFonts.HelveticaBold); for (const p of doc.getPages()) { const { width, height } = p.getSize(); const size = +wmSize.value; const tw = font.widthOfTextAtSize(wmText.value, size); p.drawText(wmText.value, { x: width / 2 - tw / 2 * Math.cos(Math.PI / 4), y: height / 2 - tw / 2 * Math.sin(Math.PI / 4), size, font, color: rgb(0.5, 0.5, 0.5), opacity: +wmOpacity.value, rotate: degrees(45) }); } await save(doc, f.file.name.replace(/\.pdf$/i, "") + "-watermarked.pdf"); };
    const pnPos = select([["bottom-center", "bottom centre"], ["bottom-right", "bottom right"], ["top-right", "top right"]], { style: { width: "auto" } });
    const pnFmt = input({ value: "{n} / {total}", placeholder: "{n} / {total}" });
    const pageNumbers = async () => { if (!need()) return; const { PDFDocument, StandardFonts, rgb } = await lib(); const f = files[0]; const doc = await PDFDocument.load(f.bytes, { ignoreEncryption: true }); const font = await doc.embedFont(StandardFonts.Helvetica); const pages = doc.getPages(); pages.forEach((p, i) => { const { width, height } = p.getSize(); const t = pnFmt.value.replace("{n}", i + 1).replace("{total}", pages.length); const tw = font.widthOfTextAtSize(t, 10); const x = pnPos.value === "bottom-center" ? width / 2 - tw / 2 : width - tw - 36; const y = pnPos.value.startsWith("top") ? height - 30 : 24; p.drawText(t, { x, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) }); }); await save(doc, f.file.name.replace(/\.pdf$/i, "") + "-numbered.pdf"); };

    const metaOut = h("div.kv-list");
    const info = async () => { if (!need()) return; const { PDFDocument } = await lib(); const f = files[0]; const doc = await PDFDocument.load(f.bytes, { ignoreEncryption: true }); const p0 = doc.getPage(0).getSize(); metaOut.replaceChildren(kv("file", f.file.name), kv("size", bytes(f.file.size)), kv("pages", String(f.pages)), kv("first page", `${Math.round(p0.width)} × ${Math.round(p0.height)} pt (${(p0.width / 72).toFixed(1)} × ${(p0.height / 72).toFixed(1)} in)`), kv("title", doc.getTitle() || "—"), kv("author", doc.getAuthor() || "—"), kv("subject", doc.getSubject() || "—"), kv("creator", doc.getCreator() || "—"), kv("producer", doc.getProducer() || "—"), kv("created", doc.getCreationDate()?.toLocaleString() || "—"), kv("modified", doc.getModificationDate()?.toLocaleString() || "—")); };
    const mTitle = input({ placeholder: "title" }), mAuthor = input({ placeholder: "author" });
    const setMeta = async () => { if (!need()) return; const { PDFDocument } = await lib(); const f = files[0]; const doc = await PDFDocument.load(f.bytes, { ignoreEncryption: true }); if (mTitle.value) doc.setTitle(mTitle.value); if (mAuthor.value) doc.setAuthor(mAuthor.value); doc.setProducer("TRINKET LAB"); await save(doc, f.file.name); };

    /* images → pdf */
    let imgs = [];
    const imgList = h("div.col", { style: { gap: "6px" } });
    const fit = select([["fit", "fit to A4 portrait"], ["fitl", "fit to A4 landscape"], ["letter", "fit to US Letter"], ["native", "page = image size"]], { style: { width: "auto" } });
    const margin = input({ type: "number", value: 24, min: 0, style: { width: "80px" } });
    const renderImgs = () => imgList.replaceChildren(...imgs.map((f, i) => h("div.list-item", h("span.li-text", { text: f.name }), h("span.hint", { text: bytes(f.size) }), btn("↑", () => { if (i > 0) { [imgs[i - 1], imgs[i]] = [imgs[i], imgs[i - 1]]; renderImgs(); } }, "ghost sm"), btn("✕", () => { imgs.splice(i, 1); renderImgs(); }, "ghost sm danger"))));
    const imagesToPdf = async () => {
      if (!imgs.length) return toast("add images first", "bad");
      const { PDFDocument } = await lib(); const doc = await PDFDocument.create();
      for (const f of imgs) {
        let data = new Uint8Array(await f.arrayBuffer()); let img;
        if (/png$/i.test(f.name) || f.type === "image/png") img = await doc.embedPng(data);
        else if (/jpe?g$/i.test(f.name) || f.type === "image/jpeg") img = await doc.embedJpg(data);
        else { const bmp = await createImageBitmap(f); const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height; c.getContext("2d").drawImage(bmp, 0, 0); const blob = await new Promise((r) => c.toBlob(r, "image/png")); img = await doc.embedPng(new Uint8Array(await blob.arrayBuffer())); }
        const m = +margin.value;
        if (fit.value === "native") { const p = doc.addPage([img.width + 2 * m, img.height + 2 * m]); p.drawImage(img, { x: m, y: m, width: img.width, height: img.height }); }
        else { const [pw, ph] = fit.value === "fit" ? [595.28, 841.89] : fit.value === "fitl" ? [841.89, 595.28] : [612, 792]; const p = doc.addPage([pw, ph]); const k = Math.min((pw - 2 * m) / img.width, (ph - 2 * m) / img.height); const w = img.width * k, hh = img.height * k; p.drawImage(img, { x: (pw - w) / 2, y: (ph - hh) / 2, width: w, height: hh }); }
      }
      await save(doc, "images.pdf");
    };

    /* pdf → png / text */
    const scaleSel = select([["1", "72 dpi"], ["2", "144 dpi"], ["3", "216 dpi"], ["4", "288 dpi"]], { value: "2", style: { width: "auto" } });
    const toPng = async () => { if (!need()) return; const pj = await pdfjs(); const f = files[0]; const doc = await pj.getDocument({ data: f.bytes.slice() }).promise; const pages = parseRanges(rangeIn.value, doc.numPages); const entries = []; for (const n of pages) { const page = await doc.getPage(n); const vp = page.getViewport({ scale: +scaleSel.value }); const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height; await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise; const blob = await new Promise((r) => c.toBlob(r, "image/png")); entries.push({ name: `page-${String(n).padStart(3, "0")}.png`, data: await blob.arrayBuffer() }); toast(`rendered page ${n}/${pages.length}`); } if (entries.length === 1) download(new Blob([entries[0].data], { type: "image/png" }), entries[0].name); else download(new Blob([await createZip(entries, { compress: false })], { type: "application/zip" }), f.file.name.replace(/\.pdf$/i, "") + "-png.zip"); };
    const textOut = textarea({ readonly: true, style: { minHeight: "240px" } });
    const toText = async () => { if (!need()) return; const pj = await pdfjs(); const f = files[0]; const doc = await pj.getDocument({ data: f.bytes.slice() }).promise; let text = ""; for (let i = 1; i <= doc.numPages; i++) { const page = await doc.getPage(i); const tc = await page.getTextContent(); let line = "", lastY = null; for (const it of tc.items) { if (lastY !== null && Math.abs(it.transform[5] - lastY) > 2) { line += "\n"; } line += it.str + (it.hasEOL ? "\n" : " "); lastY = it.transform[5]; } text += `--- page ${i} ---\n${line.trim()}\n\n`; } textOut.value = text; if (!text.replace(/--- page \d+ ---/g, "").trim()) toast("no text layer — this PDF is probably scanned; use OCR in Image Forge on a PNG export", "bad"); };

    root.append(
      card("Files", h("div.col", dropzone("Drop PDFs here", add, { accept: "application/pdf,.pdf" }), h("div.row", status, h("span.hint", { text: "operations other than merge use the first file in the list" })), list, preview)),
      h("div", { style: { marginTop: "14px" } }, subtabs([
        { id: "pages", label: "Merge & pages", render: () => h("div.col",
            h("div.row", btn("Merge all →", merge, "primary sm"), btn("Reverse", reverse, "sm"), btn("Split into single pages (zip)", splitEach, "sm")),
            h("div.row", field("page range", rangeIn), btn("Extract", extract, "sm"), btn("Delete", deletePages, "sm danger"), field("rotate", rotSel), btn("Rotate range", rotate, "sm")),
            h("div.row", field("reorder", orderIn), btn("Apply order", reorder, "sm"))) },
        { id: "stamp", label: "Watermark & numbers", render: () => h("div.col", h("div.row", field("watermark text", wmText), field("size", wmSize), field("opacity", wmOpacity), btn("Add watermark", watermark, "sm")), h("div.row", field("format", pnFmt), field("position", pnPos), btn("Add page numbers", pageNumbers, "sm"))) },
        { id: "img", label: "Images → PDF", render: () => h("div.col", dropzone("Drop images (jpg / png / webp…)", (fl) => { imgs.push(...fl); renderImgs(); }, { accept: "image/*" }), imgList, h("div.row", field("layout", fit), field("margin pt", margin), btn("Build PDF", imagesToPdf, "primary sm"))) },
        { id: "export", label: "PDF → PNG / text", render: () => h("div.col", h("div.row", field("pages", rangeIn), field("resolution", scaleSel), btn("Render PNG", toPng, "sm"), btn("Extract text", toText, "sm"), btn("Copy text", () => copy(textOut.value), "ghost sm")), textOut) },
        { id: "info", label: "Info", render: () => { info(); return h("div.col", metaOut, h("div.row", field("set title", mTitle), field("set author", mAuthor), btn("Save with metadata", setMeta, "sm"))); } },
      ], { remember: "pdf.tab" })));
  },
});
