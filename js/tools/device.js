import { h, defineTool, btn, card, copy, toast, subtabs, kv, out, bytes, tbl } from "../core.js";

defineTool({
  id: "device", name: "Device Scope", icon: "◉", cat: "web",
  desc: "Everything your browser knows about this device: screen, GPU, network, battery, features, permissions.",
  tags: ["browser", "system", "screen", "resolution", "gpu", "webgl", "battery", "network", "user agent", "features", "support", "fingerprint", "location"],
  mount(root) {
    const timers = [];
    const row = (k, v) => kv(k, v === undefined || v === null || v === "" ? "—" : String(v));
    const n = navigator, s = screen;

    const basics = () => h("div.kv-list",
      row("user agent", n.userAgent), row("platform", n.userAgentData?.platform || n.platform), row("vendor", n.vendor), row("language", n.language), row("languages", n.languages?.join(", ")),
      row("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone), row("locale", Intl.DateTimeFormat().resolvedOptions().locale), row("cookies enabled", n.cookieEnabled), row("do not track", n.doNotTrack ?? "unset"),
      row("online", n.onLine), row("cpu cores", n.hardwareConcurrency), row("device memory", n.deviceMemory ? n.deviceMemory + " GB (approx)" : "—"), row("touch points", n.maxTouchPoints), row("pdf viewer", n.pdfViewerEnabled),
      row("webdriver", n.webdriver), row("brands", n.userAgentData?.brands?.map((b) => `${b.brand} ${b.version}`).join(" · ")), row("mobile (hint)", n.userAgentData?.mobile), row("page url", location.href), row("referrer", document.referrer || "—"), row("secure context", window.isSecureContext), row("standalone / PWA", matchMedia("(display-mode: standalone)").matches));

    const screenBox = h("div.kv-list");
    const renderScreen = () => screenBox.replaceChildren(
      row("screen", `${s.width} × ${s.height}`), row("available", `${s.availWidth} × ${s.availHeight}`), row("viewport", `${innerWidth} × ${innerHeight}`), row("outer window", `${outerWidth} × ${outerHeight}`),
      row("device pixel ratio", devicePixelRatio), row("physical px", `${Math.round(s.width * devicePixelRatio)} × ${Math.round(s.height * devicePixelRatio)}`), row("colour depth", s.colorDepth + " bit"), row("orientation", s.orientation?.type),
      row("hdr", matchMedia("(dynamic-range: high)").matches), row("colour gamut", ["rec2020", "p3", "srgb"].find((g) => matchMedia(`(color-gamut: ${g})`).matches)), row("prefers dark", matchMedia("(prefers-color-scheme: dark)").matches), row("reduced motion", matchMedia("(prefers-reduced-motion: reduce)").matches),
      row("pointer", matchMedia("(pointer: fine)").matches ? "fine (mouse)" : "coarse (touch)"), row("hover", matchMedia("(hover: hover)").matches), row("fullscreen", !!document.fullscreenElement), row("visibility", document.visibilityState), row("scroll", `${scrollX}, ${scrollY}`));
    const onResize = () => renderScreen();
    window.addEventListener("resize", onResize);

    const gpuBox = h("div.kv-list");
    const renderGpu = () => {
      try {
        const c = document.createElement("canvas"); const gl = c.getContext("webgl2") || c.getContext("webgl");
        const dbg = gl.getExtension("WEBGL_debug_renderer_info");
        gpuBox.replaceChildren(row("renderer", dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)), row("vendor", dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)), row("webgl version", gl.getParameter(gl.VERSION)), row("glsl", gl.getParameter(gl.SHADING_LANGUAGE_VERSION)), row("max texture", gl.getParameter(gl.MAX_TEXTURE_SIZE) + " px"), row("max viewport", gl.getParameter(gl.MAX_VIEWPORT_DIMS).join(" × ")), row("extensions", gl.getSupportedExtensions().length), row("webgpu", "gpu" in n));
      } catch { gpuBox.replaceChildren(out("WebGL unavailable")); }
    };

    const netBox = h("div.kv-list");
    const renderNet = () => { const c = n.connection || n.mozConnection || n.webkitConnection; netBox.replaceChildren(row("online", n.onLine), row("effective type", c?.effectiveType), row("downlink", c?.downlink ? c.downlink + " Mb/s" : "—"), row("rtt", c?.rtt ? c.rtt + " ms" : "—"), row("save data", c?.saveData), row("type", c?.type)); };
    const batBox = h("div.kv-list");
    const renderBat = async () => { if (!n.getBattery) return batBox.replaceChildren(out("Battery API unavailable")); const b = await n.getBattery(); const f = () => batBox.replaceChildren(row("level", Math.round(b.level * 100) + "%"), row("charging", b.charging), row("time to full", b.chargingTime === Infinity ? "—" : Math.round(b.chargingTime / 60) + " min"), row("time to empty", b.dischargingTime === Infinity ? "—" : Math.round(b.dischargingTime / 60) + " min")); f(); ["levelchange", "chargingchange"].forEach((e) => b.addEventListener(e, f)); };

    const FEATURES = { "Service Worker": "serviceWorker" in n, "WebAssembly": typeof WebAssembly === "object", "WebGPU": "gpu" in n, "WebRTC": !!window.RTCPeerConnection, "WebSockets": !!window.WebSocket, "Web Share": !!n.share, "Clipboard API": !!n.clipboard, "Notifications": "Notification" in window, "Push": "PushManager" in window, "Geolocation": "geolocation" in n, "Bluetooth": "bluetooth" in n, "USB": "usb" in n, "Serial": "serial" in n, "HID": "hid" in n, "MIDI": !!n.requestMIDIAccess, "Gamepad": !!n.getGamepads, "Web Audio": !!(window.AudioContext || window.webkitAudioContext), "Speech recognition": !!(window.SpeechRecognition || window.webkitSpeechRecognition), "Speech synthesis": "speechSynthesis" in window, "File System Access": !!window.showOpenFilePicker, "IndexedDB": !!window.indexedDB, "Storage estimate": !!n.storage?.estimate, "Wake Lock": "wakeLock" in n, "Screen capture": !!n.mediaDevices?.getDisplayMedia, "Camera / mic": !!n.mediaDevices?.getUserMedia, "Payment Request": !!window.PaymentRequest, "Credential mgmt": !!n.credentials, "Vibration": !!n.vibrate, "Picture-in-Picture": !!document.pictureInPictureEnabled, "Offscreen canvas": !!window.OffscreenCanvas, "Shared workers": !!window.SharedWorker, "BroadcastChannel": !!window.BroadcastChannel, "View transitions": !!document.startViewTransition, "CSS :has()": CSS.supports("selector(:has(a))"), "CSS container queries": CSS.supports("container-type: inline-size"), "CSS nesting": CSS.supports("selector(&)"), "color-mix()": CSS.supports("color: color-mix(in srgb, red, blue)"), "Popover": HTMLElement.prototype.hasOwnProperty("popover"), "Dialog": !!window.HTMLDialogElement, "Intl.Segmenter": !!Intl.Segmenter, "Temporal": !!window.Temporal, "Array.groupBy": !!Object.groupBy, "structuredClone": !!window.structuredClone, "AVIF": false, "WebP": false };
    const featBox = h("div.kv-list");
    const renderFeat = async () => {
      const test = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i.width > 0); i.onerror = () => r(false); i.src = src; });
      FEATURES.WebP = await test("data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==");
      FEATURES.AVIF = await test("data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=");
      featBox.replaceChildren(...Object.entries(FEATURES).map(([k, v]) => h("div.kv", h("b", { text: k }), h("span", { class: "chip " + (v ? "ok" : "bad"), text: v ? "yes" : "no" }))));
    };

    const permBox = h("div.kv-list");
    const renderPerm = async () => { const names = ["geolocation", "notifications", "camera", "microphone", "clipboard-read", "clipboard-write", "persistent-storage", "midi", "accelerometer", "gyroscope", "screen-wake-lock"]; const rows = []; for (const name of names) { try { const st = await n.permissions.query({ name }); rows.push([name, st.state]); } catch { rows.push([name, "unsupported"]); } } permBox.replaceChildren(...rows.map(([k, v]) => h("div.kv", h("b", { text: k }), h("span", { class: "chip " + (v === "granted" ? "ok" : v === "denied" ? "bad" : ""), text: v })))); };

    const storeBox = h("div.kv-list");
    const renderStore = async () => { let ls = 0; try { for (const k in localStorage) if (localStorage.hasOwnProperty(k)) ls += (localStorage.getItem(k) || "").length * 2; } catch {} const est = n.storage?.estimate ? await n.storage.estimate() : null; storeBox.replaceChildren(row("localStorage used", bytes(ls)), row("storage quota", est ? bytes(est.quota) : "—"), row("storage used", est ? bytes(est.usage) : "—"), row("persisted", n.storage?.persisted ? await n.storage.persisted() : "—"), row("cookies", document.cookie ? document.cookie.split(";").length : 0)); };

    const geoBox = h("div.kv-list");
    const getGeo = () => { if (!n.geolocation) return; geoBox.replaceChildren(out("requesting…")); n.geolocation.getCurrentPosition((p) => { const c = p.coords; geoBox.replaceChildren(row("latitude", c.latitude.toFixed(6)), row("longitude", c.longitude.toFixed(6)), row("accuracy", "±" + Math.round(c.accuracy) + " m"), row("altitude", c.altitude != null ? Math.round(c.altitude) + " m" : "—"), row("speed", c.speed != null ? c.speed.toFixed(1) + " m/s" : "—"), row("heading", c.heading != null ? Math.round(c.heading) + "°" : "—"), h("div.kv", h("b", { text: "map" }), h("a", { href: `https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=15/${c.latitude}/${c.longitude}`, target: "_blank", rel: "noopener", text: "open in OpenStreetMap", style: { color: "var(--a1)" } }))); }, (e) => geoBox.replaceChildren(out("denied: " + e.message, "err")), { enableHighAccuracy: true }); };

    const perfBox = h("div.kv-list");
    const renderPerf = () => { const nav = performance.getEntriesByType("navigation")[0]; const mem = performance.memory; perfBox.replaceChildren(row("page load", nav ? Math.round(nav.loadEventEnd - nav.startTime) + " ms" : "—"), row("dom interactive", nav ? Math.round(nav.domInteractive - nav.startTime) + " ms" : "—"), row("transfer type", nav?.type), row("js heap used", mem ? bytes(mem.usedJSHeapSize) : "—"), row("js heap limit", mem ? bytes(mem.jsHeapSizeLimit) : "—"), row("uptime (tab)", Math.round(performance.now() / 1000) + " s"), row("timer resolution", "~" + (() => { const a = performance.now(); let b = a, n = 0; while (b === a && n++ < 200000) b = performance.now(); return b === a ? "≥ coarse" : (b - a).toFixed(3); })() + " ms")); };
    timers.push(setInterval(renderPerf, 2000));

    const dump = () => { const o = {}; root.querySelectorAll(".kv").forEach((k) => { o[k.querySelector("b").textContent] = k.querySelector("span").textContent; }); copy(JSON.stringify(o, null, 2), "report copied"); };

    root.append(
      h("div.row", { style: { marginBottom: "12px" } }, btn("Copy visible as JSON", dump, "ghost sm"), h("span.hint", { text: "read-only · nothing is sent anywhere · some values are deliberately coarse in modern browsers" })),
      subtabs([
        { id: "basics", label: "Browser", render: basics },
        { id: "screen", label: "Screen", render: () => { renderScreen(); return screenBox; } },
        { id: "gpu", label: "GPU", render: () => { renderGpu(); return gpuBox; } },
        { id: "net", label: "Network & battery", render: () => { renderNet(); renderBat(); return h("div.grid.g2", card("Connection", netBox), card("Battery", batBox)); } },
        { id: "feat", label: "Feature support", render: () => { renderFeat(); return featBox; } },
        { id: "perm", label: "Permissions", render: () => { renderPerm(); return permBox; } },
        { id: "storage", label: "Storage", render: () => { renderStore(); return storeBox; } },
        { id: "geo", label: "Location", render: () => h("div.col", btn("Request location", getGeo, "sm"), geoBox) },
        { id: "perf", label: "Performance", render: () => { renderPerf(); return perfBox; } },
      ], { remember: "device.tab" }));
    return () => { timers.forEach(clearInterval); window.removeEventListener("resize", onResize); };
  },
});
