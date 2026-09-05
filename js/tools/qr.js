import { h, defineTool, store, input, textarea, btn, card, copy, toast, subtabs, field, select, seg, out, kv, download, debounce, dropzone } from "../core.js";
import { encode, toSVG, toCanvas } from "../lib/qrcode.js";
import * as BAR from "../lib/barcode.js";

defineTool({
  id: "qr", name: "QR Studio", icon: "▦", cat: "media",
  desc: "QR codes for links, Wi-Fi, contacts, email, SMS, geo, events; EAN/UPC barcodes; camera & image scanner.",
  tags: ["qr", "qr code", "barcode", "ean", "upc", "scanner", "scan qr", "wifi", "vcard", "contact", "link", "svg"],
  mount(root) {
    const canvas = h("canvas", { style: { maxWidth: "100%", borderRadius: "12px", border: "1px solid var(--line)" } });
    const info = h("div.kv-list");
    const level = seg([["L", "L 7%"], ["M", "M 15%"], ["Q", "Q 25%"], ["H", "H 30%"]], () => render(), store.get("qr.level", "M"));
    const scale = h("input", { type: "range", min: 2, max: 20, value: store.get("qr.scale", 8) });
    const margin = h("input", { type: "range", min: 0, max: 8, value: 4 });
    const dark = input({ type: "color", value: store.get("qr.dark", "#000000"), style: { width: "56px" } });
    const light = input({ type: "color", value: store.get("qr.light", "#ffffff"), style: { width: "56px" } });
    let payload = "", qr = null;

    const escWifi = (s) => s.replace(/([\;,:"])/g, "\\$1");
    const forms = {
      text: () => { const t = textarea({ placeholder: "Any text or URL…", style: { minHeight: "110px" } }); t.value = store.get("qr.text", "https://rueyday.github.io/WebLab/"); t.oninput = () => { store.set("qr.text", t.value); set(t.value); }; set(t.value); return t; },
      wifi: () => { const ssid = input({ placeholder: "network name" }), pw = input({ placeholder: "password" }), type = select([["WPA", "WPA/WPA2/WPA3"], ["WEP", "WEP"], ["nopass", "open"]]), hidden = h("input", { type: "checkbox" });
        const upd = () => set(`WIFI:T:${type.value};S:${escWifi(ssid.value)};${type.value === "nopass" ? "" : "P:" + escWifi(pw.value) + ";"}${hidden.checked ? "H:true;" : ""};`);
        [ssid, pw, type, hidden].forEach((e) => e.addEventListener("input", upd)); upd();
        return h("div.col", field("SSID", ssid), field("password", pw), h("div.row", field("security", type), h("label.check", hidden, "hidden network"))); },
      vcard: () => { const f = Object.fromEntries(["first", "last", "org", "title", "phone", "email", "url", "address"].map((k) => [k, input({ placeholder: k })]));
        const upd = () => set(`BEGIN:VCARD\nVERSION:3.0\nN:${f.last.value};${f.first.value}\nFN:${f.first.value} ${f.last.value}\n${f.org.value ? "ORG:" + f.org.value + "\n" : ""}${f.title.value ? "TITLE:" + f.title.value + "\n" : ""}${f.phone.value ? "TEL:" + f.phone.value + "\n" : ""}${f.email.value ? "EMAIL:" + f.email.value + "\n" : ""}${f.url.value ? "URL:" + f.url.value + "\n" : ""}${f.address.value ? "ADR:;;" + f.address.value + "\n" : ""}END:VCARD`);
        Object.values(f).forEach((e) => e.addEventListener("input", upd)); upd();
        return h("div.grid.g2", ...Object.entries(f).map(([k, e]) => field(k, e))); },
      email: () => { const to = input({ placeholder: "to@example.com" }), subj = input({ placeholder: "subject" }), body = textarea({ placeholder: "body", style: { minHeight: "70px" } });
        const upd = () => set(`mailto:${to.value}?subject=${encodeURIComponent(subj.value)}&body=${encodeURIComponent(body.value)}`); [to, subj, body].forEach((e) => e.addEventListener("input", upd)); upd();
        return h("div.col", field("to", to), field("subject", subj), field("body", body)); },
      sms: () => { const num = input({ placeholder: "+1 555 000 0000" }), msg = textarea({ placeholder: "message", style: { minHeight: "70px" } }); const upd = () => set(`SMSTO:${num.value}:${msg.value}`); [num, msg].forEach((e) => e.addEventListener("input", upd)); upd(); return h("div.col", field("number", num), field("message", msg)); },
      phone: () => { const num = input({ placeholder: "+1 555 000 0000" }); num.oninput = () => set("tel:" + num.value); set("tel:"); return field("number", num); },
      geo: () => { const lat = input({ placeholder: "latitude", value: "42.2808" }), lon = input({ placeholder: "longitude", value: "-83.7430" }); const upd = () => set(`geo:${lat.value},${lon.value}`); [lat, lon].forEach((e) => e.addEventListener("input", upd)); upd();
        return h("div.col", h("div.row", field("lat", lat), field("lon", lon)), btn("use my location", () => navigator.geolocation?.getCurrentPosition((p) => { lat.value = p.coords.latitude.toFixed(5); lon.value = p.coords.longitude.toFixed(5); upd(); }, () => toast("location blocked", "bad")), "ghost sm")); },
      event: () => { const t = input({ placeholder: "title" }), loc = input({ placeholder: "location" }), s = input({ type: "datetime-local" }), e = input({ type: "datetime-local" });
        const ics = (d) => d ? new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "") : "";
        const upd = () => set(`BEGIN:VEVENT\nSUMMARY:${t.value}\nLOCATION:${loc.value}\nDTSTART:${ics(s.value)}\nDTEND:${ics(e.value)}\nEND:VEVENT`); [t, loc, s, e].forEach((x) => x.addEventListener("input", upd)); upd();
        return h("div.col", field("title", t), field("location", loc), h("div.row", field("start", s), field("end", e))); },
    };
    const payloadBox = out("");
    const set = (p) => { payload = p; payloadBox.textContent = p; render(); };
    const render = debounce(() => {
      store.set("qr.level", level.value); store.set("qr.scale", +scale.value); store.set("qr.dark", dark.value); store.set("qr.light", light.value);
      info.replaceChildren();
      if (!payload) { canvas.width = canvas.height = 0; return; }
      try {
        qr = encode(payload, { level: level.value });
        toCanvas(qr, canvas, { scale: +scale.value, margin: +margin.value, dark: dark.value, light: light.value });
        info.append(kv("version", `${qr.version} (${qr.size}×${qr.size} modules)`), kv("error correction", qr.level), kv("mask", String(qr.mask)), kv("payload", `${qr.bytes} bytes`), kv("image", `${canvas.width}×${canvas.height} px`));
      } catch (e) { qr = null; canvas.width = canvas.height = 0; info.append(out(e.message, "err")); }
    }, 60);
    [scale, margin, dark, light].forEach((e) => e.addEventListener("input", render));
    const svg = () => qr && toSVG(qr, { scale: +scale.value, margin: +margin.value, dark: dark.value, light: light.value });

    /* barcode */
    const bcIn = input({ placeholder: "4006381333931  ·  036000291452  ·  9638507", class: "mono", value: store.get("qr.barcode", "4006381333931") });
    const bcType = select([["auto", "auto"], ["ean13", "EAN-13"], ["upca", "UPC-A"], ["ean8", "EAN-8"]], { style: { width: "auto" } });
    const bcBox = h("div", { style: { display: "grid", placeItems: "center", padding: "12px", background: "#fff", borderRadius: "12px" } });
    const bcInfo = h("div.kv-list");
    let bcSvg = "";
    const renderBar = () => {
      store.set("qr.barcode", bcIn.value);
      try { const r = BAR.encode(bcIn.value, bcType.value); bcSvg = BAR.toSVG(r, { moduleWidth: 3, height: 90 }); bcBox.innerHTML = bcSvg; bcInfo.replaceChildren(kv("type", r.type.toUpperCase()), kv("digits", r.digits), kv("check digit", r.digits.at(-1)), kv("modules", String(r.bits.length))); }
      catch (e) { bcBox.replaceChildren(out(e.message, "err")); bcSvg = ""; bcInfo.replaceChildren(); }
    };
    bcIn.addEventListener("input", renderBar); bcType.addEventListener("change", renderBar);
    const barTab = () => { renderBar(); return h("div.col", h("div.row", h("div", { style: { flex: 1 } }, bcIn), field("type", bcType)), bcBox, bcInfo,
      h("div.row", btn("↓ SVG", () => bcSvg && download(bcSvg, "barcode.svg", "image/svg+xml"), "primary sm"), btn("↓ PNG", () => { if (!bcSvg) return; const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); c.width = img.width * 2; c.height = img.height * 2; const cx = c.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(img, 0, 0, c.width, c.height); c.toBlob((b) => download(b, "barcode.png")); }; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(bcSvg); }, "sm"), btn("Copy SVG", () => copy(bcSvg), "ghost sm"), btn("random EAN-13", () => { let d = ""; for (let i = 0; i < 12; i++) d += Math.floor(Math.random() * 10); bcIn.value = d + BAR.checkDigit(d); renderBar(); }, "ghost sm")),
      h("p.hint", { text: "Retail barcodes (EAN-13 / UPC-A / EAN-8). Enter 12 / 11 / 7 digits and the check digit is added for you. Print at 100% for scanners." })); };

    /* scanner */
    let scanStream = null, scanRaf = 0;
    const scanVideo = h("video", { autoplay: true, playsinline: true, muted: true, style: { width: "100%", maxHeight: "320px", borderRadius: "12px", background: "#000" } });
    const scanOut = h("div.col");
    const scanStatus = h("span.chip", { text: "idle" });
    const stopScan = () => { scanStream?.getTracks().forEach((t) => t.stop()); scanStream = null; cancelAnimationFrame(scanRaf); };
    const showResult = (codes) => { scanOut.replaceChildren(...codes.map((c) => h("div.list-item", h("span.chip", { text: c.format }), h("span.li-text.mono", { text: c.rawValue, style: { userSelect: "all" } }), /^https?:/i.test(c.rawValue) ? h("a.btn.ghost.sm", { href: c.rawValue, target: "_blank", rel: "noopener", text: "open ↗" }) : null, btn("copy", () => copy(c.rawValue), "ghost sm")))); };
    const startScan = async () => {
      if (!("BarcodeDetector" in window)) return toast("BarcodeDetector API unavailable in this browser — try Chrome/Edge, or scan an image below", "bad");
      try { scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); } catch { return toast("camera blocked", "bad"); }
      scanVideo.srcObject = scanStream; scanStatus.textContent = "scanning…";
      const det = new BarcodeDetector();
      const loop = async () => { if (!scanStream) return; try { const codes = await det.detect(scanVideo); if (codes.length) { showResult(codes); scanStatus.textContent = "found " + codes.length; } } catch {} scanRaf = requestAnimationFrame(loop); };
      loop();
    };
    const scanImage = async (fl) => { if (!("BarcodeDetector" in window)) return toast("BarcodeDetector API unavailable in this browser", "bad"); try { const bmp = await createImageBitmap(fl[0]); const codes = await new BarcodeDetector().detect(bmp); codes.length ? showResult(codes) : toast("no code found", "bad"); } catch (e) { toast(e.message, "bad"); } };
    const scanTab = () => h("div.col", h("div.row", btn("▶ Scan with camera", startScan, "primary sm"), btn("■ Stop", () => { stopScan(); scanStatus.textContent = "stopped"; }, "ghost sm"), scanStatus), scanVideo, dropzone("or drop / choose an image with a QR or barcode", scanImage, { accept: "image/*", multiple: false }), scanOut);
    const contentTabs = subtabs(Object.keys(forms).map((k) => ({ id: k, label: k, render: forms[k] })), { remember: "qr.type" });
    const qrLayout = h("div.split",
      h("div.col",
        card("Content", contentTabs),
        card("Payload", payloadBox, [btn("Copy", () => copy(payload), "ghost sm")])),
      h("div.col",
        card("QR code", h("div.col", { style: { alignItems: "center" } }, canvas, info), [
          btn("↓ PNG", () => canvas.toBlob((b) => download(b, "qr.png")), "primary sm"),
          btn("↓ SVG", () => svg() && download(svg(), "qr.svg", "image/svg+xml"), "sm"),
          btn("Copy SVG", () => svg() && copy(svg()), "ghost sm"),
          btn("Copy PNG", async () => { try { canvas.toBlob(async (b) => { await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]); toast("copied", "ok"); }); } catch { toast("clipboard unsupported", "bad"); } }, "ghost sm")]),
        card("Options", h("div.col", field("error correction", level), h("div.row", field("scale", h("div", { style: { width: "160px" } }, scale)), field("margin", h("div", { style: { width: "120px" } }, margin)), field("dark", dark), field("light", light)),
          h("p.hint", { text: "Higher error correction survives damage / logos but needs more modules. Keep strong contrast for reliable scanning." })))));
    const mainTabs = subtabs([{ id: "qr", label: "QR code", render: () => qrLayout }, { id: "bar", label: "Barcode", render: barTab }, { id: "scan", label: "Scan", render: scanTab }], { remember: "qr.mode" });
    root.append(mainTabs);
    return () => stopScan();
  },
});
