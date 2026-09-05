/* TRINKET LAB service worker — cache-first for the app shell so it works offline. */
const VERSION = "trinket-v3.0.0";
const SHELL = [
  "./", "./index.html", "./styles.css", "./manifest.webmanifest", "./icon.svg", "./privacy.html",
  "./js/main.js", "./js/core.js",
  "./js/lib/qrcode.js", "./js/lib/markdown.js", "./js/lib/diff.js", "./js/lib/expr.js", "./js/lib/units.js",
  "./js/lib/colorkit.js", "./js/lib/hashes.js", "./js/lib/textkit.js",
  "./js/tools/index.js", "./js/tools/home.js", "./js/tools/text.js", "./js/tools/transform.js", "./js/tools/regex.js",
  "./js/tools/diff.js", "./js/tools/markdown.js", "./js/tools/json.js", "./js/tools/url.js", "./js/tools/hash.js",
  "./js/tools/encode.js", "./js/tools/secrets.js", "./js/tools/cipher.js", "./js/tools/image.js", "./js/tools/color.js",
  "./js/tools/qr.js", "./js/tools/draw.js", "./js/tools/units.js", "./js/tools/calc.js", "./js/tools/time.js",
  "./js/tools/net.js", "./js/tools/device.js", "./js/tools/input.js", "./js/tools/notes.js", "./js/tools/links.js",
  "./js/tools/audio.js", "./js/tools/random.js",
  "./js/tools/pdf.js", "./js/tools/archive.js", "./js/tools/glyphs.js", "./js/tools/css.js", "./js/tools/sandbox.js", "./js/tools/code.js",
  "./js/tools/table.js", "./js/tools/media.js", "./js/tools/hardware.js", "./js/tools/api.js", "./js/tools/weather.js", "./js/tools/cheats.js",
  "./js/lib/zip.js", "./js/lib/gif.js", "./js/lib/barcode.js", "./js/lib/exif.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // fonts and other cross-origin: network first, fall back to cache
  if (url.origin !== location.origin) {
    e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
    return;
  }
  // same-origin app shell: stale-while-revalidate
  e.respondWith(caches.match(e.request).then((cached) => {
    const network = fetch(e.request).then((r) => { if (r.ok) caches.open(VERSION).then((c) => c.put(e.request, r.clone())); return r; }).catch(() => cached);
    return cached || network;
  }));
});
