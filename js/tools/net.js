import { h, defineTool, store, input, textarea, btn, card, copy, toast, subtabs, field, select, out, kv, tbl, num } from "../core.js";

const HTTP = { 100: "Continue", 101: "Switching Protocols", 200: "OK", 201: "Created", 202: "Accepted", 204: "No Content", 206: "Partial Content", 301: "Moved Permanently", 302: "Found", 303: "See Other", 304: "Not Modified", 307: "Temporary Redirect", 308: "Permanent Redirect", 400: "Bad Request", 401: "Unauthorized", 402: "Payment Required", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed", 406: "Not Acceptable", 408: "Request Timeout", 409: "Conflict", 410: "Gone", 411: "Length Required", 412: "Precondition Failed", 413: "Payload Too Large", 414: "URI Too Long", 415: "Unsupported Media Type", 416: "Range Not Satisfiable", 418: "I'm a teapot", 422: "Unprocessable Entity", 425: "Too Early", 426: "Upgrade Required", 428: "Precondition Required", 429: "Too Many Requests", 431: "Request Header Fields Too Large", 451: "Unavailable For Legal Reasons", 500: "Internal Server Error", 501: "Not Implemented", 502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout", 505: "HTTP Version Not Supported", 507: "Insufficient Storage", 511: "Network Authentication Required" };
const PORTS = [[20, "FTP data"], [21, "FTP"], [22, "SSH / SFTP"], [23, "Telnet"], [25, "SMTP"], [53, "DNS"], [67, "DHCP server"], [68, "DHCP client"], [80, "HTTP"], [110, "POP3"], [123, "NTP"], [143, "IMAP"], [161, "SNMP"], [389, "LDAP"], [443, "HTTPS"], [445, "SMB"], [465, "SMTPS"], [514, "Syslog"], [587, "SMTP submission"], [636, "LDAPS"], [853, "DNS over TLS"], [993, "IMAPS"], [995, "POP3S"], [1080, "SOCKS"], [1433, "MS SQL"], [1521, "Oracle"], [1883, "MQTT"], [2049, "NFS"], [2375, "Docker"], [3000, "dev servers"], [3306, "MySQL"], [3389, "RDP"], [4200, "Angular dev"], [5000, "Flask / .NET"], [5173, "Vite"], [5432, "PostgreSQL"], [5672, "AMQP / RabbitMQ"], [5900, "VNC"], [6379, "Redis"], [6443, "Kubernetes API"], [8000, "dev http"], [8080, "HTTP alt"], [8443, "HTTPS alt"], [8888, "Jupyter"], [9000, "PHP-FPM / SonarQube"], [9090, "Prometheus"], [9200, "Elasticsearch"], [11211, "Memcached"], [27017, "MongoDB"]];
const MIME = [["html", "text/html"], ["css", "text/css"], ["js", "text/javascript"], ["mjs", "text/javascript"], ["json", "application/json"], ["xml", "application/xml"], ["txt", "text/plain"], ["csv", "text/csv"], ["md", "text/markdown"], ["pdf", "application/pdf"], ["zip", "application/zip"], ["gz", "application/gzip"], ["tar", "application/x-tar"], ["png", "image/png"], ["jpg", "image/jpeg"], ["gif", "image/gif"], ["webp", "image/webp"], ["avif", "image/avif"], ["svg", "image/svg+xml"], ["ico", "image/x-icon"], ["bmp", "image/bmp"], ["mp3", "audio/mpeg"], ["wav", "audio/wav"], ["ogg", "audio/ogg"], ["m4a", "audio/mp4"], ["mp4", "video/mp4"], ["webm", "video/webm"], ["mov", "video/quicktime"], ["woff", "font/woff"], ["woff2", "font/woff2"], ["ttf", "font/ttf"], ["otf", "font/otf"], ["wasm", "application/wasm"], ["doc", "application/msword"], ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], ["xls", "application/vnd.ms-excel"], ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], ["ppt", "application/vnd.ms-powerpoint"], ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"], ["apk", "application/vnd.android.package-archive"], ["bin", "application/octet-stream"], ["form", "application/x-www-form-urlencoded"], ["multipart", "multipart/form-data"], ["ics", "text/calendar"], ["webmanifest", "application/manifest+json"]];

const ip2n = (ip) => ip.split(".").reduce((a, o) => (a << 8) + (+o), 0) >>> 0;
const n2ip = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");
const validIp = (ip) => /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip.split(".").every((o) => +o <= 255);

function subnet(cidr) {
  const [ip, bitsS] = cidr.trim().split("/");
  const bits = bitsS === undefined ? 24 : +bitsS;
  if (!validIp(ip) || bits < 0 || bits > 32) throw new Error("use a.b.c.d/nn");
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  const net = (ip2n(ip) & mask) >>> 0, bc = (net | (~mask >>> 0)) >>> 0;
  const hosts = bits >= 31 ? (bits === 31 ? 2 : 1) : bc - net - 1;
  const first = bits >= 31 ? net : net + 1, last = bits >= 31 ? bc : bc - 1;
  const cls = ip2n(ip) >>> 24;
  const priv = /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? "private (RFC 1918)" : /^127\./.test(ip) ? "loopback" : /^169\.254\./.test(ip) ? "link-local" : /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip) ? "CGNAT" : cls >= 224 ? "multicast / reserved" : "public";
  return { network: n2ip(net), broadcast: n2ip(bc), mask: n2ip(mask), wildcard: n2ip(~mask >>> 0), first: n2ip(first), last: n2ip(last), hosts, bits, cls: cls < 128 ? "A" : cls < 192 ? "B" : cls < 224 ? "C" : cls < 240 ? "D" : "E", type: priv, binary: ip2n(ip).toString(2).padStart(32, "0").replace(/(.{8})(?=.)/g, "$1."), hex: "0x" + ip2n(ip).toString(16).padStart(8, "0"), int: ip2n(ip), nextNet: n2ip((bc + 1) >>> 0), ipv6mapped: "::ffff:" + ip };
}
function parseUA(ua) {
  const b = (re, name) => { const m = re.exec(ua); return m && { name, version: m[1] }; };
  const browser = b(/Edg(?:e|A|iOS)?\/([\d.]+)/, "Edge") || b(/OPR\/([\d.]+)/, "Opera") || b(/SamsungBrowser\/([\d.]+)/, "Samsung Internet") || b(/Firefox\/([\d.]+)/, "Firefox") || b(/Chrome\/([\d.]+)/, "Chrome") || b(/Version\/([\d.]+).*Safari/, "Safari") || b(/MSIE ([\d.]+)|rv:([\d.]+).*Trident/, "Internet Explorer") || { name: "unknown", version: "" };
  const os = /Windows NT 10/.test(ua) ? "Windows 10/11" : /Windows/.test(ua) ? "Windows" : /Android ([\d.]+)/.test(ua) ? "Android " + RegExp.$1 : /iPhone OS ([\d_]+)/.test(ua) ? "iOS " + RegExp.$1.replace(/_/g, ".") : /iPad/.test(ua) ? "iPadOS" : /Mac OS X ([\d_]+)/.test(ua) ? "macOS " + RegExp.$1.replace(/_/g, ".") : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "unknown";
  const device = /Mobile|iPhone|Android.*Mobile/.test(ua) ? "mobile" : /iPad|Tablet|Android/.test(ua) ? "tablet" : "desktop";
  const engine = /Gecko\/\d/.test(ua) ? "Gecko" : /AppleWebKit/.test(ua) && !/Chrome/.test(ua) ? "WebKit" : /Chrome|Chromium/.test(ua) ? "Blink" : /Trident/.test(ua) ? "Trident" : "unknown";
  const bot = /bot|crawl|spider|slurp|facebookexternalhit|preview/i.test(ua);
  return { browser: `${browser.name} ${browser.version}`.trim(), os, device, engine, bot: bot ? "yes" : "no" };
}
function chmod(bits) {
  const s = bits.toString(8).padStart(3, "0");
  const r = (n) => (n & 4 ? "r" : "-") + (n & 2 ? "w" : "-") + (n & 1 ? "x" : "-");
  return { octal: s, symbolic: [...s].map((d) => r(+d)).join(""), cmd: `chmod ${s} file` };
}

defineTool({
  id: "net", name: "Network Kit", icon: "⌘", cat: "web",
  desc: "Subnet calculator, IP maths, user-agent parser, chmod, HTTP status codes, ports & MIME lookups.",
  tags: ["ip", "subnet", "cidr", "network", "user agent", "http", "status code", "ports", "mime", "chmod", "permissions", "dns", "mac address"],
  mount(root) {
    const cidr = input({ placeholder: "192.168.1.42/24", class: "mono", value: store.get("net.cidr", "192.168.1.42/24") });
    const subOut = h("div.kv-list");
    const runSub = () => { store.set("net.cidr", cidr.value); try { const r = subnet(cidr.value); subOut.replaceChildren(...Object.entries({ "network": r.network + "/" + r.bits, "broadcast": r.broadcast, "netmask": r.mask, "wildcard": r.wildcard, "host range": `${r.first} – ${r.last}`, "usable hosts": num(r.hosts), "class": r.cls, "type": r.type, "binary": r.binary, "hex": r.hex, "integer": r.int, "next network": r.nextNet + "/" + r.bits, "ipv6-mapped": r.ipv6mapped }).map(([k, v]) => h("div.kv.copyable", { onclick: () => copy(String(v)) }, h("b", { text: k }), h("span", { text: String(v) })))); } catch (e) { subOut.replaceChildren(out(e.message, "err")); } };
    cidr.addEventListener("input", runSub); runSub();
    const cidrTable = tbl(["/", "mask", "hosts"], Array.from({ length: 25 }, (_, i) => { const b = 8 + i; return [b, n2ip(b === 0 ? 0 : (0xffffffff << (32 - b)) >>> 0), num(b >= 31 ? (b === 31 ? 2 : 1) : 2 ** (32 - b) - 2)]; }));

    const ua = textarea({ style: { minHeight: "80px" }, placeholder: "paste a user-agent string…" }); ua.value = navigator.userAgent;
    const uaOut = h("div.kv-list");
    const runUa = () => { const r = parseUA(ua.value); uaOut.replaceChildren(...Object.entries(r).map(([k, v]) => kv(k, v))); };
    ua.addEventListener("input", runUa); runUa();

    const bitsState = { u: 7, g: 5, o: 5 };
    const chOut = h("div.kv-list");
    const octIn = input({ class: "mono", value: "755", style: { width: "90px" } });
    const boxes = h("div.grid.g3");
    const renderCh = () => { const v = bitsState.u * 64 + bitsState.g * 8 + bitsState.o; const c = chmod(v); octIn.value = c.octal; chOut.replaceChildren(kv("symbolic", c.symbolic), kv("octal", c.octal), kv("command", c.cmd), kv("umask equivalent", (0o777 - v).toString(8).padStart(3, "0")));
      boxes.replaceChildren(...["u", "g", "o"].map((who) => h("div.col", h("span.label", { text: { u: "owner", g: "group", o: "others" }[who] }), ...[["read", 4], ["write", 2], ["execute", 1]].map(([n, b]) => h("label.check", h("input", { type: "checkbox", checked: !!(bitsState[who] & b), onchange: (e) => { bitsState[who] = e.target.checked ? bitsState[who] | b : bitsState[who] & ~b; renderCh(); } }), n))))); };
    octIn.addEventListener("input", () => { if (/^[0-7]{3}$/.test(octIn.value)) { bitsState.u = +octIn.value[0]; bitsState.g = +octIn.value[1]; bitsState.o = +octIn.value[2]; renderCh(); } });
    renderCh();

    const search = input({ placeholder: "filter…", type: "search" });
    const refTable = h("div");
    const renderRef = (which) => { const q = search.value.toLowerCase(); const rows = which === "http" ? Object.entries(HTTP).map(([c, t]) => [c, t, c < 200 ? "informational" : c < 300 ? "success" : c < 400 ? "redirect" : c < 500 ? "client error" : "server error"]) : which === "ports" ? PORTS.map(([p, s]) => [p, s, p < 1024 ? "well-known" : "registered"]) : MIME.map(([e, m]) => ["." + e, m, m.split("/")[0]]); refTable.replaceChildren(tbl(which === "http" ? ["code", "reason", "class"] : which === "ports" ? ["port", "service", "range"] : ["ext", "mime type", "kind"], rows.filter((r) => r.join(" ").toLowerCase().includes(q)))); };

    const mac = input({ placeholder: "00:1A:2B:3C:4D:5E", class: "mono" }); const macOut = h("div.kv-list");
    mac.addEventListener("input", () => { const hex = mac.value.replace(/[^0-9a-f]/gi, "").toLowerCase(); if (hex.length !== 12) return macOut.replaceChildren(out("need 12 hex digits", "err")); const pairs = hex.match(/../g); const first = parseInt(pairs[0], 16); macOut.replaceChildren(kv("colon", pairs.join(":")), kv("hyphen", pairs.join("-")), kv("cisco", hex.match(/.{4}/g).join(".")), kv("plain", hex), kv("OUI", pairs.slice(0, 3).join(":").toUpperCase()), kv("unicast / multicast", first & 1 ? "multicast" : "unicast"), kv("universal / local", first & 2 ? "locally administered (randomised)" : "universally administered"), kv("EUI-64", pairs.slice(0, 3).join("") + "fffe" + pairs.slice(3).join(""))); });

    root.append(subtabs([
      { id: "subnet", label: "Subnet", render: () => h("div.split", card("IPv4 / CIDR", h("div.col", cidr, subOut)), card("Mask table", cidrTable)) },
      { id: "ua", label: "User agent", render: () => h("div.col", ua, uaOut) },
      { id: "chmod", label: "chmod", render: () => h("div.col", h("div.row", field("octal", octIn)), boxes, chOut) },
      { id: "mac", label: "MAC address", render: () => h("div.col", mac, macOut) },
      { id: "http", label: "HTTP codes", render: () => { search.oninput = () => renderRef("http"); renderRef("http"); return h("div.col", search, refTable); } },
      { id: "ports", label: "Ports", render: () => { search.oninput = () => renderRef("ports"); renderRef("ports"); return h("div.col", search, refTable); } },
      { id: "mime", label: "MIME types", render: () => { search.oninput = () => renderRef("mime"); renderRef("mime"); return h("div.col", search, refTable); } },
    ], { remember: "net.tab" }));
  },
});
