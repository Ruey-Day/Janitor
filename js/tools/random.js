import { h, defineTool, store, input, textarea, btn, card, copy, toast, subtabs, field, select, out, tbl, num } from "../core.js";
import { lorem, LINE_OPS } from "../lib/textkit.js";
import { uuidv4 } from "./secrets.js";

const rnd = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
const pick = (arr) => arr[rnd(arr.length)];
const FIRST = "Ada Alan Amara Arjun Beatriz Chen Dmitri Elena Fatima Grace Hiro Ines Jamal Kaia Leo Maya Nikolai Olivia Priya Quinn Ravi Sofia Tariq Uma Viktor Wren Xiu Yara Zane Noor Elias Mateo Aisha Kenji Freya Rafael Zara Luca Hana Omar".split(" ");
const LAST = "Okafor Nakamura Silva Petrov Haddad Lindqvist Rossi Mensah Ivanova Tanaka Moreau Novak Osei Fischer Costa Yilmaz Nguyen Kowalski Bello Sato Jensen Reyes Khan Dubois Mwangi Larsen Park Adeyemi Romano Sharma".split(" ");
const STREET = "Maple Oak Cedar Harbor Ridge Willow Summit Lake River Meadow Sunset Birch Hill Park Elm".split(" ");
const CITY = "Ann Arbor;Lisbon;Kyoto;Nairobi;Oslo;Montréal;Valparaíso;Ljubljana;Austin;Tallinn;Porto;Wellington;Cape Town;Reykjavík;Denver".split(";");
const DOMAINS = "example.com mail.test dev.local sample.org demo.net".split(" ");
const fakeRow = () => { const f = pick(FIRST), l = pick(LAST); return { name: `${f} ${l}`, email: `${f}.${l}@${pick(DOMAINS)}`.toLowerCase(), phone: `+1 ${rnd(900) + 100}-${rnd(900) + 100}-${String(rnd(10000)).padStart(4, "0")}`, address: `${rnd(9000) + 100} ${pick(STREET)} St, ${pick(CITY)}`, age: 18 + rnd(60), company: `${pick(LAST)} ${pick(["Labs", "Systems", "Studio", "Works", "& Co", "Digital"])}`, id: uuidv4(), date: new Date(Date.now() - rnd(3e10)).toISOString().slice(0, 10), amount: (rnd(100000) / 100).toFixed(2), bool: rnd(2) === 1, color: "#" + rnd(0xffffff).toString(16).padStart(6, "0") }; };

defineTool({
  id: "random", name: "Randomizer", icon: "⚄", cat: "misc",
  desc: "Dice, coins, numbers, list picker & shuffler, lorem ipsum, fake test data, decision maker.",
  tags: ["random", "dice", "coin", "number", "pick", "shuffle", "spin the wheel", "wheel of names", "lorem ipsum", "placeholder", "fake data", "mock", "generator", "decision", "wheel"],
  mount(root) {
    /* numbers */
    const lo = input({ type: "number", value: 1, class: "mono", style: { width: "100px" } }), hi = input({ type: "number", value: 100, class: "mono", style: { width: "100px" } }), cnt = input({ type: "number", value: 1, min: 1, max: 1000, class: "mono", style: { width: "80px" } });
    const uniq = h("input", { type: "checkbox" });
    const numOut = h("div.out.big", { text: "—", style: { textAlign: "center" } });
    const genNum = () => { const a = Math.min(+lo.value, +hi.value), b = Math.max(+lo.value, +hi.value), n = +cnt.value; if (uniq.checked && n > b - a + 1) return toast("range too small for unique picks", "bad"); const res = []; const used = new Set(); while (res.length < n) { const v = a + rnd(b - a + 1); if (uniq.checked && used.has(v)) continue; used.add(v); res.push(v); } numOut.textContent = res.join(", "); };
    const dice = h("div.row.tight");
    const roll = (sides, times = 1) => { const rs = Array.from({ length: times }, () => 1 + rnd(sides)); numOut.textContent = (times > 1 ? rs.join(" + ") + " = " : "") + rs.reduce((a, b) => a + b, 0) + (sides === 6 && times === 1 ? "  " + "⚀⚁⚂⚃⚄⚅"[rs[0] - 1] : ""); };
    dice.append(...[4, 6, 8, 10, 12, 20, 100].map((s) => btn("d" + s, () => roll(s), "sm")), btn("2d6", () => roll(6, 2), "sm"), btn("3d6", () => roll(6, 3), "sm"), btn("coin", () => { numOut.textContent = pick(["HEADS", "TAILS"]); }, "sm"), btn("magic 8-ball", () => { numOut.textContent = pick(["It is certain", "Without a doubt", "Yes, definitely", "Most likely", "Signs point to yes", "Reply hazy, try again", "Ask again later", "Cannot predict now", "Don't count on it", "My reply is no", "Outlook not so good", "Very doubtful"]); }, "sm"), btn("rock·paper·scissors", () => { numOut.textContent = pick(["✊ rock", "✋ paper", "✌ scissors"]); }, "sm"));

    /* list */
    const listTa = textarea({ placeholder: "one item per line…", style: { minHeight: "160px" } }); listTa.value = store.get("random.list", "Alice\nBob\nCarol\nDave\nEve");
    listTa.addEventListener("input", () => store.set("random.list", listTa.value));
    const listOut = h("div.out.big", { text: "—", style: { textAlign: "center" } });
    const items = () => listTa.value.split("\n").map((s) => s.trim()).filter(Boolean);
    const teams = input({ type: "number", value: 2, min: 2, class: "mono", style: { width: "80px" } });
    const wheel = h("canvas", { width: 360, height: 360, style: { maxWidth: "100%", borderRadius: "50%", cursor: "pointer" } });
    let angle = 0, spinning = false;
    const drawWheel = () => { const it = items(); const ctx = wheel.getContext("2d"); const n = it.length || 1, r = 175, cx = 180, cy = 180; ctx.clearRect(0, 0, 360, 360); const colors = ["#00e5ff", "#ff2fd0", "#8b6bff", "#9dff4f", "#ffc861", "#ff5b6e"]; for (let i = 0; i < n; i++) { const a0 = angle + (i / n) * Math.PI * 2, a1 = angle + ((i + 1) / n) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath(); ctx.fillStyle = colors[i % colors.length]; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1; ctx.save(); ctx.translate(cx, cy); ctx.rotate((a0 + a1) / 2); ctx.fillStyle = "#04060d"; ctx.font = "bold 13px monospace"; ctx.textAlign = "right"; ctx.fillText((it[i] || "—").slice(0, 18), r - 10, 5); ctx.restore(); } ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(cx + r + 4, cy - 12); ctx.lineTo(cx + r - 18, cy); ctx.lineTo(cx + r + 4, cy + 12); ctx.fill(); };
    const spin = () => { if (spinning) return; const it = items(); if (!it.length) return; spinning = true; const total = Math.PI * 2 * (4 + Math.random() * 4) + Math.random() * Math.PI * 2; const start = angle, t0 = performance.now(), dur = 3500; const step = (t) => { const k = Math.min(1, (t - t0) / dur); angle = start + total * (1 - (1 - k) ** 3); drawWheel(); if (k < 1) requestAnimationFrame(step); else { spinning = false; const n = it.length; const pointerAngle = (Math.PI * 2 - (angle % (Math.PI * 2))) % (Math.PI * 2); listOut.textContent = it[Math.floor(pointerAngle / (Math.PI * 2 / n)) % n]; listOut.style.fontSize = ""; } }; requestAnimationFrame(step); };
    wheel.addEventListener("click", spin);
    listTa.addEventListener("input", drawWheel);
    const listTab = h("div.split", card("Items", h("div.col", listTa, h("div.col", { style: { alignItems: "center" } }, wheel, h("span.hint", { text: "click the wheel to spin" }))), [btn("dedupe", () => { listTa.value = LINE_OPS.dedupe(items()).join("\n"); drawWheel(); }, "ghost sm")]),
      card("Actions", h("div.col", listOut, h("div.row", btn("Pick one", () => { const it = items(); listOut.textContent = it.length ? pick(it) : "—"; }, "primary sm"), btn("Pick one & remove", () => { const it = items(); if (!it.length) return; const i = rnd(it.length); listOut.textContent = it[i]; it.splice(i, 1); listTa.value = it.join("\n"); }, "sm"), btn("Shuffle", () => { listTa.value = LINE_OPS.shuffle(items()).join("\n"); listOut.textContent = "shuffled"; }, "sm"), btn("Reverse", () => { listTa.value = items().reverse().join("\n"); }, "sm")),
        h("div.row", field("teams", teams), btn("Split into teams", () => { const it = LINE_OPS.shuffle(items()); const n = Math.max(2, +teams.value); const g = Array.from({ length: n }, () => []); it.forEach((x, i) => g[i % n].push(x)); listOut.textContent = g.map((t, i) => `Team ${i + 1}: ${t.join(", ")}`).join("\n"); listOut.style.fontSize = "13px"; }, "sm"), btn("Random order with numbers", () => { listOut.textContent = LINE_OPS.shuffle(items()).map((x, i) => `${i + 1}. ${x}`).join("\n"); listOut.style.fontSize = "13px"; }, "sm")),
        h("p.hint", { text: `${items().length} items` }))));

    /* lorem */
    const paras = input({ type: "number", value: 3, min: 1, max: 50, class: "mono", style: { width: "80px" } }), sents = input({ type: "number", value: 5, min: 1, max: 20, class: "mono", style: { width: "80px" } });
    const classic = h("input", { type: "checkbox", checked: true });
    const loremOut = textarea({ readonly: true, style: { minHeight: "220px" } });
    const genLorem = () => { loremOut.value = lorem({ paragraphs: +paras.value, sentencesPer: +sents.value, startClassic: classic.checked }); };
    const words = input({ type: "number", value: 50, class: "mono", style: { width: "80px" } });
    const loremTab = h("div.col", h("div.row", field("paragraphs", paras), field("sentences each", sents), h("label.check", classic, "start with 'Lorem ipsum'"), btn("Generate", genLorem, "primary sm"), field("or words", words), btn("N words", () => { loremOut.value = lorem({ paragraphs: 30, sentencesPer: 8 }).replace(/\n\n/g, " ").split(" ").slice(0, +words.value).join(" ") + "."; }, "sm"), btn("HTML <p>", () => { loremOut.value = loremOut.value.split("\n\n").map((p) => `<p>${p}</p>`).join("\n"); }, "ghost sm")), loremOut, h("div.row", btn("Copy", () => copy(loremOut.value), "ghost sm"), h("span.hint", { text: () => "" })));

    /* fake data */
    const rows = input({ type: "number", value: 10, min: 1, max: 500, class: "mono", style: { width: "80px" } });
    const fields = ["name", "email", "phone", "address", "age", "company", "id", "date", "amount", "bool", "color"];
    const checks = Object.fromEntries(fields.map((f) => [f, h("input", { type: "checkbox", checked: ["name", "email", "phone", "age", "id"].includes(f) })]));
    const fakeOut = h("div");
    let lastData = [];
    const genFake = () => { const sel = fields.filter((f) => checks[f].checked); lastData = Array.from({ length: +rows.value }, () => { const r = fakeRow(); return Object.fromEntries(sel.map((f) => [f, r[f]])); }); fakeOut.replaceChildren(tbl(sel, lastData.map((r) => sel.map((f) => String(r[f]))))); };
    const toCSV = () => { const sel = Object.keys(lastData[0] || {}); return [sel.join(","), ...lastData.map((r) => sel.map((f) => JSON.stringify(String(r[f]))).join(","))].join("\n"); };
    const fakeTab = h("div.col", h("div.row", field("rows", rows), ...fields.map((f) => h("label.check", checks[f], f)), btn("Generate", genFake, "primary sm")), fakeOut,
      h("div.row", btn("Copy JSON", () => copy(JSON.stringify(lastData, null, 2)), "ghost sm"), btn("Copy CSV", () => copy(toCSV()), "ghost sm"), btn("Copy SQL inserts", () => { const sel = Object.keys(lastData[0] || {}); copy(lastData.map((r) => `INSERT INTO people (${sel.join(", ")}) VALUES (${sel.map((f) => typeof r[f] === "number" || typeof r[f] === "boolean" ? r[f] : `'${String(r[f]).replace(/'/g, "''")}'`).join(", ")});`).join("\n")); }, "ghost sm")),
      h("p.hint", { text: "Names, emails and addresses are synthetic — safe for fixtures and demos." }));

    /* decision */
    const q = input({ placeholder: "Should I…?" });
    const decOut = h("div.out.big", { text: "—", style: { textAlign: "center" } });
    const decTab = h("div.col", q, h("div.row", btn("Decide", () => { decOut.textContent = pick(["Yes.", "No.", "Absolutely.", "Not today.", "Do it.", "Sleep on it.", "Go for it.", "Hard pass."]); }, "primary sm"), btn("Pick a number 1–10", () => { decOut.textContent = String(1 + rnd(10)); }, "sm"), btn("Random letter", () => { decOut.textContent = String.fromCharCode(65 + rnd(26)); }, "sm"), btn("Random colour", () => { const c = "#" + rnd(0xffffff).toString(16).padStart(6, "0"); decOut.textContent = c; decOut.style.background = c; decOut.style.color = "#fff"; }, "sm"), btn("Random emoji", () => { decOut.textContent = String.fromCodePoint(0x1f600 + rnd(80)); }, "sm"), btn("Random date this year", () => { const y = new Date().getFullYear(); decOut.textContent = new Date(y, 0, 1 + rnd(365)).toDateString(); }, "sm"), btn("Random time", () => { decOut.textContent = `${String(rnd(24)).padStart(2, "0")}:${String(rnd(60)).padStart(2, "0")}`; }, "sm")), decOut);

    root.append(subtabs([
      { id: "num", label: "Numbers & dice", render: () => h("div.col", numOut, h("div.row", field("min", lo), field("max", hi), field("count", cnt), h("label.check", uniq, "unique"), btn("Generate", genNum, "primary sm")), dice) },
      { id: "list", label: "List picker & wheel", render: () => { setTimeout(drawWheel, 0); return listTab; } },
      { id: "lorem", label: "Lorem ipsum", render: () => { if (!loremOut.value) genLorem(); return loremTab; } },
      { id: "fake", label: "Fake data", render: () => { if (!lastData.length) genFake(); return fakeTab; } },
      { id: "dec", label: "Decide", render: () => decTab },
    ], { remember: "random.tab" }));
  },
});
