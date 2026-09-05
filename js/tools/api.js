import { h, defineTool, store, textarea, input, btn, card, copy, toast, subtabs, field, select, seg, out, kv, tbl, download, bytes, num, debounce } from "../core.js";

defineTool({
  id: "api", name: "Net Console", icon: "⇌", cat: "web",
  desc: "HTTP request client, WebSocket tester, DNS lookup, what's-my-IP, speed & latency test, site reachability.",
  tags: ["http", "api", "rest", "postman", "curl", "fetch", "request", "websocket", "dns", "lookup", "my ip", "ip address", "speed test", "ping", "latency", "is it down"],
  mount(root) {
    /* http client */
    const method = select(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"], { value: store.get("api.method", "GET"), style: { width: "auto" } });
    const url = input({ placeholder: "https://api.example.com/users?limit=5", value: store.get("api.url", "https://jsonplaceholder.typicode.com/todos/1"), class: "mono" });
    const headersTa = textarea({ placeholder: "Header-Name: value\nAuthorization: Bearer …", style: { minHeight: "80px" } }); headersTa.value = store.get("api.headers", "Accept: application/json");
    const bodyTa = textarea({ placeholder: '{"json": "body"}', style: { minHeight: "120px" } }); bodyTa.value = store.get("api.body", "");
    const resMeta = h("div.row.tight");
    const resHeaders = h("div");
    const resBody = out("", "mono"); resBody.style.maxHeight = "50vh"; resBody.style.overflow = "auto";
    const histBox = h("div.col", { style: { gap: "4px" } });
    let hist = store.get("api.hist", []);
    const parseHeaders = () => Object.fromEntries(headersTa.value.split("\n").map((l) => l.split(/:\s*/)).filter(([k, v]) => k && v !== undefined).map(([k, ...v]) => [k.trim(), v.join(": ").trim()]));
    const send = async () => {
      store.set("api.method", method.value); store.set("api.url", url.value); store.set("api.headers", headersTa.value); store.set("api.body", bodyTa.value);
      resMeta.replaceChildren(h("span.chip", { text: "sending…" })); resBody.textContent = ""; resHeaders.replaceChildren();
      const t0 = performance.now();
      try {
        const opts = { method: method.value, headers: parseHeaders() };
        if (!/^(GET|HEAD)$/.test(method.value) && bodyTa.value) { opts.body = bodyTa.value; if (!opts.headers["Content-Type"] && /^\s*[{[]/.test(bodyTa.value)) opts.headers["Content-Type"] = "application/json"; }
        const r = await fetch(url.value.trim(), opts);
        const ms = Math.round(performance.now() - t0);
        const text = await r.text();
        const ct = r.headers.get("content-type") || "";
        let pretty = text; if (/json/.test(ct) || /^\s*[{[]/.test(text)) { try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch {} }
        resMeta.replaceChildren(h("span.chip", { class: r.ok ? "ok" : "bad", text: `${r.status} ${r.statusText}` }), h("span.chip", { text: ms + " ms" }), h("span.chip", { text: bytes(new TextEncoder().encode(text).length) }), h("span.chip", { text: ct.split(";")[0] || "no content-type" }), r.redirected ? h("span.chip.warn", { text: "redirected → " + r.url }) : null);
        resHeaders.replaceChildren(tbl(["header", "value"], [...r.headers.entries()]));
        resBody.textContent = pretty.slice(0, 200000);
        hist = [{ m: method.value, u: url.value, s: r.status, t: Date.now() }, ...hist.filter((x) => x.u !== url.value || x.m !== method.value)].slice(0, 20); store.set("api.hist", hist); renderHist();
      } catch (e) { resMeta.replaceChildren(h("span.chip.bad", { text: "failed" }), h("span.chip", { text: Math.round(performance.now() - t0) + " ms" })); resBody.textContent = e.message + (e.message.includes("Failed to fetch") ? "\n\nUsually CORS: the server must send Access-Control-Allow-Origin for browser requests. The request may still have succeeded server-side. Test CORS-enabled APIs, your own services, or use curl from a terminal (copy button above)." : ""); }
    };
    const asCurl = () => { const hs = Object.entries(parseHeaders()).map(([k, v]) => ` -H '${k}: ${v}'`).join(""); const b = !/^(GET|HEAD)$/.test(method.value) && bodyTa.value ? ` --data '${bodyTa.value.replace(/'/g, "'\\''")}'` : ""; return `curl -X ${method.value}${hs}${b} '${url.value}'`; };
    const asFetch = () => `fetch(${JSON.stringify(url.value)}, {\n  method: "${method.value}",\n  headers: ${JSON.stringify(parseHeaders(), null, 2).replace(/\n/g, "\n  ")},${!/^(GET|HEAD)$/.test(method.value) && bodyTa.value ? `\n  body: ${JSON.stringify(bodyTa.value)},` : ""}\n}).then(r => r.json()).then(console.log);`;
    const renderHist = () => histBox.replaceChildren(...hist.map((x) => h("div.list-item", { style: { cursor: "pointer" }, onclick: () => { method.value = x.m; url.value = x.u; } }, h("span.chip", { class: x.s < 400 ? "ok" : "bad", text: `${x.m} ${x.s}` }), h("span.li-text.mono", { text: x.u, style: { fontSize: "11.5px" } }), btn("✕", (e) => { e.stopPropagation(); hist = hist.filter((y) => y !== x); store.set("api.hist", hist); renderHist(); }, "ghost sm"))));
    url.addEventListener("keydown", (e) => e.key === "Enter" && send());
    const presets = h("div.row.tight", [["JSON placeholder", "GET", "https://jsonplaceholder.typicode.com/posts/1"], ["httpbin echo", "POST", "https://httpbin.org/post"], ["httpbin headers", "GET", "https://httpbin.org/headers"], ["GitHub API", "GET", "https://api.github.com/repos/rueyday/WebLab"], ["Open-Meteo", "GET", "https://api.open-meteo.com/v1/forecast?latitude=42.28&longitude=-83.74&current=temperature_2m"]].map(([l, m, u]) => btn(l, () => { method.value = m; url.value = u; if (m === "POST") bodyTa.value = '{"hello": "world"}'; }, "ghost sm")));

    /* websocket */
    let ws = null;
    const wsUrl = input({ placeholder: "wss://echo.websocket.org", value: store.get("api.ws", "wss://echo.websocket.org"), class: "mono" });
    const wsMsg = input({ placeholder: "message to send", class: "mono" });
    const wsLog = h("div.out", { style: { maxHeight: "300px", overflow: "auto", fontSize: "12px" } });
    const wsStatus = h("span.chip", { text: "disconnected" });
    const log = (kind, text) => { wsLog.append(h("div", { style: { color: { in: "var(--lime)", out: "var(--a1)", sys: "var(--muted)", err: "var(--danger)" }[kind] }, text: `${new Date().toLocaleTimeString()} ${{ in: "◀", out: "▶", sys: "·", err: "✕" }[kind]} ${text}` })); wsLog.scrollTop = wsLog.scrollHeight; };
    const wsConnect = () => { store.set("api.ws", wsUrl.value); try { ws?.close(); ws = new WebSocket(wsUrl.value.trim()); wsStatus.textContent = "connecting…"; ws.onopen = () => { wsStatus.className = "chip ok"; wsStatus.textContent = "open"; log("sys", "connected"); }; ws.onmessage = (e) => log("in", typeof e.data === "string" ? e.data : `[binary ${e.data.size} B]`); ws.onerror = () => log("err", "error (see devtools)"); ws.onclose = (e) => { wsStatus.className = "chip"; wsStatus.textContent = "closed"; log("sys", `closed ${e.code} ${e.reason}`); }; } catch (e) { log("err", e.message); } };
    const wsSend = () => { if (ws?.readyState !== 1) return toast("not connected", "bad"); ws.send(wsMsg.value); log("out", wsMsg.value); };
    wsMsg.addEventListener("keydown", (e) => e.key === "Enter" && wsSend());

    /* dns */
    const dnsName = input({ placeholder: "example.com", value: store.get("api.dns", "github.com"), class: "mono" });
    const dnsType = select(["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "SRV", "CAA", "PTR"], { style: { width: "auto" } });
    const dnsOut = h("div");
    const dnsLookup = async (type = dnsType.value) => { store.set("api.dns", dnsName.value); dnsOut.replaceChildren(out("querying Cloudflare DNS over HTTPS…")); try { const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dnsName.value.trim())}&type=${type}`, { headers: { Accept: "application/dns-json" } }); const j = await r.json(); const RC = ["NOERROR", "FORMERR", "SERVFAIL", "NXDOMAIN", "NOTIMP", "REFUSED"]; const rows = (j.Answer || []).map((a) => [a.name, { 1: "A", 28: "AAAA", 5: "CNAME", 15: "MX", 16: "TXT", 2: "NS", 6: "SOA", 33: "SRV", 257: "CAA", 12: "PTR" }[a.type] || a.type, a.TTL + "s", a.data]); dnsOut.replaceChildren(h("div.row.tight", h("span.chip", { class: j.Status ? "bad" : "ok", text: RC[j.Status] || "status " + j.Status }), h("span.chip", { text: `${rows.length} records` }), j.AD ? h("span.chip.ok", { text: "DNSSEC validated" }) : null), rows.length ? tbl(["name", "type", "ttl", "data"], rows) : out("no records of this type")); } catch (e) { dnsOut.replaceChildren(out("lookup failed: " + e.message, "err")); } };
    dnsName.addEventListener("keydown", (e) => e.key === "Enter" && dnsLookup());
    const dnsAll = async () => { dnsOut.replaceChildren(out("querying…")); const results = []; for (const t of ["A", "AAAA", "CNAME", "MX", "TXT", "NS"]) { try { const j = await (await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dnsName.value.trim())}&type=${t}`, { headers: { Accept: "application/dns-json" } })).json(); (j.Answer || []).forEach((a) => results.push([a.name, t, a.TTL + "s", a.data])); } catch {} } dnsOut.replaceChildren(results.length ? tbl(["name", "type", "ttl", "data"], results) : out("no records")); };

    /* my ip */
    const ipOut = h("div.kv-list");
    const myIp = async () => { ipOut.replaceChildren(out("asking ipify (this is the one request that intentionally leaves your device)…")); const rows = []; try { const v4 = await (await fetch("https://api.ipify.org?format=json")).json(); rows.push(["IPv4", v4.ip]); } catch { rows.push(["IPv4", "unavailable"]); } try { const v6 = await (await fetch("https://api64.ipify.org?format=json")).json(); if (!rows.some((r) => r[1] === v6.ip)) rows.push(["IPv6 / preferred", v6.ip]); } catch {} ipOut.replaceChildren(...rows.map(([k, v]) => h("div.kv.copyable", { onclick: () => copy(v) }, h("b", { text: k }), h("span", { text: v })))); if (rows[0][1] !== "unavailable") ipOut.append(btn("Lookup location / ISP (ipwho.is)", async () => { try { const g = await (await fetch(`https://ipwho.is/${rows[0][1]}`)).json(); ipOut.append(...[["city", `${g.city}, ${g.region}, ${g.country}`], ["ISP / org", g.connection?.isp || g.connection?.org], ["ASN", "AS" + g.connection?.asn], ["timezone", g.timezone?.id], ["coords", `${g.latitude}, ${g.longitude}`], ["type", g.type]].map(([k, v]) => kv(k, String(v ?? "—")))); } catch { toast("geo lookup failed", "bad"); } }, "ghost sm")); };
    const localIp = async () => { try { const pc = new RTCPeerConnection({ iceServers: [] }); pc.createDataChannel(""); const offer = await pc.createOffer(); await pc.setLocalDescription(offer); const found = new Set(); pc.onicecandidate = (e) => { const m = /(\d+\.\d+\.\d+\.\d+|[0-9a-f:]{10,})/i.exec(e.candidate?.candidate || ""); if (m) found.add(m[1]); if (!e.candidate) { ipOut.append(kv("local (WebRTC)", found.size ? [...found].join(", ") : "hidden by browser (mDNS)")); pc.close(); } }; } catch { ipOut.append(kv("local", "unavailable")); } };

    /* speed */
    const spOut = h("div.kv-list");
    const spBar = h("div.bar", h("i"));
    const speedTest = async () => {
      spOut.replaceChildren(); spBar.firstChild.style.width = "0";
      const lat = []; for (let i = 0; i < 5; i++) { const t = performance.now(); try { await fetch("https://speed.cloudflare.com/__down?bytes=0", { cache: "no-store" }); lat.push(performance.now() - t); } catch {} spBar.firstChild.style.width = 10 + i * 4 + "%"; }
      if (!lat.length) return spOut.append(out("could not reach speed.cloudflare.com", "err"));
      lat.sort((a, b) => a - b); spOut.append(kv("latency (min / median)", `${lat[0].toFixed(0)} / ${lat[2].toFixed(0)} ms`), kv("jitter", (lat[lat.length - 1] - lat[0]).toFixed(0) + " ms"));
      let total = 0, t0 = performance.now(), mbps = 0;
      for (const size of [1e6, 5e6, 10e6, 25e6]) { const t = performance.now(); try { const r = await fetch(`https://speed.cloudflare.com/__down?bytes=${size}`, { cache: "no-store" }); const b = await r.arrayBuffer(); total += b.byteLength; mbps = (b.byteLength * 8) / ((performance.now() - t) / 1000) / 1e6; spOut.append(kv(`download ${bytes(size)}`, mbps.toFixed(1) + " Mb/s")); spBar.firstChild.style.width = 30 + (total / 41e6) * 50 + "%"; if (performance.now() - t0 > 12000) break; } catch { break; } }
      const up = new Uint8Array(2e6); crypto.getRandomValues(up.subarray(0, 65536)); const tu = performance.now();
      try { await fetch("https://speed.cloudflare.com/__up", { method: "POST", body: up, cache: "no-store" }); spOut.append(kv("upload 2 MB", ((2e6 * 8) / ((performance.now() - tu) / 1000) / 1e6).toFixed(1) + " Mb/s")); } catch { spOut.append(kv("upload", "blocked")); }
      spBar.firstChild.style.width = "100%"; spOut.append(kv("verdict", mbps > 100 ? "fast — 4K streaming, big downloads fine" : mbps > 25 ? "good — HD streaming, video calls fine" : mbps > 5 ? "ok — SD streaming, calls may stutter" : "slow"));
    };

    /* reachability */
    const upUrl = input({ placeholder: "https://example.com", class: "mono" });
    const upOut = h("div.kv-list");
    const checkUp = async () => { let u = upUrl.value.trim(); if (!/^https?:/.test(u)) u = "https://" + u; upOut.replaceChildren(out("checking…")); const t = performance.now(); try { await fetch(u, { mode: "no-cors", cache: "no-store" }); upOut.replaceChildren(kv("reachable", "yes (opaque response — DNS + TLS + server answered)"), kv("time", Math.round(performance.now() - t) + " ms")); } catch (e) { upOut.replaceChildren(kv("reachable", "no — DNS, TLS or network failure"), kv("error", e.message)); } };
    upUrl.addEventListener("keydown", (e) => e.key === "Enter" && checkUp());

    root.append(subtabs([
      { id: "http", label: "HTTP client", render: () => { renderHist(); return h("div.col", h("div.row", { style: { flexWrap: "nowrap" } }, method, h("div", { style: { flex: 1 } }, url), btn("Send ⏎", send, "primary sm")), presets,
          h("div.grid.g2", card("Headers", headersTa), card("Body", bodyTa)),
          h("div.row", btn("Copy as curl", () => copy(asCurl()), "ghost sm"), btn("Copy as fetch()", () => copy(asFetch()), "ghost sm"), btn("Copy response", () => copy(resBody.textContent), "ghost sm"), btn("Save response", () => download(resBody.textContent, "response.txt"), "ghost sm")),
          card("Response", h("div.col", resMeta, resBody, h("details", h("summary.hint", { text: "response headers" }), resHeaders))), card("History", histBox)); } },
      { id: "ws", label: "WebSocket", render: () => h("div.col", h("div.row", { style: { flexWrap: "nowrap" } }, h("div", { style: { flex: 1 } }, wsUrl), btn("Connect", wsConnect, "primary sm"), btn("Close", () => ws?.close(), "ghost sm"), wsStatus), h("div.row", { style: { flexWrap: "nowrap" } }, h("div", { style: { flex: 1 } }, wsMsg), btn("Send", wsSend, "sm"), btn("Send JSON ping", () => { wsMsg.value = JSON.stringify({ type: "ping", t: Date.now() }); wsSend(); }, "ghost sm"), btn("Clear log", () => wsLog.replaceChildren(), "ghost sm")), wsLog) },
      { id: "dns", label: "DNS", render: () => h("div.col", h("div.row", { style: { flexWrap: "nowrap" } }, h("div", { style: { flex: 1 } }, dnsName), dnsType, btn("Lookup", () => dnsLookup(), "primary sm"), btn("All common", dnsAll, "sm")), dnsOut, h("p.hint", { text: "Resolved via Cloudflare 1.1.1.1 DNS-over-HTTPS (JSON API). Shows what the public internet sees, not your local resolver." })) },
      { id: "ip", label: "My IP", render: () => h("div.col", h("div.row", btn("Show my public IP", myIp, "primary sm"), btn("Local IP (WebRTC)", localIp, "ghost sm")), ipOut, h("p.hint", { text: "Public IP requires asking an external service (api.ipify.org). Nothing else in TRINKET LAB contacts a server." })) },
      { id: "speed", label: "Speed test", render: () => h("div.col", btn("Run speed test", speedTest, "primary sm"), spBar, spOut, h("p.hint", { text: "Downloads up to ~40 MB from Cloudflare's speed test endpoint. Results depend on your device and the tab being active." })) },
      { id: "up", label: "Is it up?", render: () => h("div.col", h("div.row", { style: { flexWrap: "nowrap" } }, h("div", { style: { flex: 1 } }, upUrl), btn("Check", checkUp, "primary sm")), upOut, h("p.hint", { text: "Opaque no-cors probe from your machine — proves DNS + TLS + a response, not the HTTP status." })) },
    ], { remember: "api.tab" }));
    return () => ws?.close();
  },
});
