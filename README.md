# TRINKET LAB

**One tab, every small web tool.** A static site hosted on GitHub Pages — no build
step, no server, no accounts, no ads, no uploads. Everything runs in your browser and
keeps working offline once loaded (it's an installable PWA). The only tools that talk
to the network are the ones that must (weather, DNS, my-IP, speed test, HTTP client),
and PDF / OCR libraries load lazily from a CDN the first time you use them.

**Live:** https://rueyday.github.io/WebLab/

## Tools

| category | tools |
| --- | --- |
| Text & writing | Text Metrics (counts, readability, frequency, platform limits) · Text Transform (case, lines, slugs, find/replace) · Regex Lab · Text Compare (diff) · Markdown Studio (HTML → MD, print) · Glyphs & Fancy Text (emoji, symbols, unicode styles, inspector) |
| Data & code | JSON Studio (format, validate, query, tree, → CSV/YAML/TypeScript) · Table Lab (CSV/TSV/JSON/MD/HTML grid → any format) · Code Tools (beautify/minify, escapes, HTML → MD, SVG → PNG) · Code Sandbox (live HTML/CSS/JS + console) · PDF Workshop (merge, split, rotate, watermark, images ⇄ PDF, text) · Zip & Unzip (+ gzip) · URL Inspector |
| Crypto & security | Hash & Checksum (MD5/SHA/CRC32/HMAC, files) · Encoder Ring (Base64/32, hex, binary, entities, unicode, ROT, Morse, JWT) · Passwords & IDs (generator, strength, UUID/ULID/nanoid, RSA/EC keypairs) · Encrypt/Decrypt (AES-256-GCM text & files) |
| Design & media | Image Forge (crop, resize, rotate, filters, adjust, redact, text overlay, EXIF, OCR, ASCII, favicons, camera) · Color Lab · CSS Studio (shadows, radius, filters, easing, glass, fluid type, type scale, fonts) · QR Studio (+ EAN/UPC barcodes, scanner) · Media Tools (video → GIF/frames/audio, audio trim → WAV, screen/mic/camera recorder) · Sketchpad |
| Numbers & units | Unit Converter (15 categories + live currency) · Number Base & Bits (+ number to words) · Calculator (expressions, graphing, matrices, number facts, money maths, statistics) |
| Time | Time Machine (unix, world clock, date maths, countdown, timers & alarms, stopwatch, Pomodoro, sleep calculator, cron) · Weather (Open-Meteo forecast) |
| Web & system | Net Console (HTTP client, WebSocket, DNS, my IP, speed test, is-it-up) · Network Kit (subnets, UA parser, chmod, MAC, HTTP codes, ports, MIME) · Device Scope · Hardware Test (display, camera, mic, speakers, sensors) · Input Tester |
| Workspace | Notes & Tasks · Launchpad (bookmarks) · Cheat Sheets (git, bash, vim, docker, npm, markdown, python, JS, HTTP, OS keys) |
| Misc | Audio Bench (tone, metronome, noise, tuner, TTS, dictation) · Randomizer (dice, wheel, picker, lorem, fake data) |

Global: command palette (`⌘K`), sidebar filter (`/`), pinned favourites (`Alt 1–9`),
5 themes, settings, backup export/import, drag-and-drop / paste routing, offline PWA.

## Files

```
index.html          shell (header, sidebar, view, overlays)
styles.css          design system + themes
js/main.js          boot: settings, rail, shortcuts, palette commands, SW
js/core.js          registry, router, storage, ui kit, palette, modal
js/lib/*.js         pure logic (qrcode, barcode, markdown, diff, expr, units, colorkit, hashes, textkit, zip, gif, exif)
js/tools/*.js       one module per tool, self-registers via defineTool()
sw.js               service worker (offline cache)
manifest.webmanifest, icon.svg, privacy.html
```

### Adding a tool

Create `js/tools/mytool.js`:

```js
import { defineTool, h, card } from "../core.js";
defineTool({
  id: "mytool", name: "My Tool", icon: "✦", cat: "misc",
  desc: "What it does.", tags: ["search", "words"],
  mount(root) { root.append(card("Hello", h("p", "world"))); return () => {/* cleanup */}; },
});
```

then add `import "./mytool.js";` to `js/tools/index.js` and the path to `SHELL` in `sw.js`.

## Deploying

GitHub Pages serves straight from `main` / root. Every push republishes.
Bump `VERSION` in `sw.js` when shipping changes so clients refresh their cache.

Locally: `python3 -m http.server 8777` then open http://localhost:8777
(ES modules need http://, not file://).
