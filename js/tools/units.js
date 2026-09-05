import { h, defineTool, store, input, btn, card, copy, field, select, out, tbl, num, debounce, subtabs } from "../core.js";
import { CATEGORIES, convert, unitList } from "../lib/units.js";

defineTool({
  id: "units", name: "Unit Converter", icon: "⇆", cat: "numbers",
  desc: "Length, mass, temperature, area, volume, speed, time, data, pressure, energy, power, fuel, CSS units — and live currency.",
  tags: ["convert", "units", "metric", "imperial", "temperature", "celsius", "fahrenheit", "miles", "km", "kg", "lbs", "bytes", "currency", "exchange rate", "usd", "eur"],
  mount(root) {
    const cat = select(Object.entries(CATEGORIES).map(([k, v]) => [k, v.label]), { value: store.get("units.cat", "length"), style: { width: "auto" } });
    const from = select([], { style: { width: "auto" } }), to = select([], { style: { width: "auto" } });
    const val = input({ type: "number", value: store.get("units.val", 1), step: "any", class: "mono" });
    const result = h("div.out.big");
    const table = h("div");
    const fmt = (n) => (Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-6 && n !== 0) ? n.toExponential(6) : num(+n.toPrecision(10)));

    const fillUnits = () => {
      const list = unitList(cat.value);
      [from, to].forEach((s) => { s.replaceChildren(...list.map(([id, label]) => h("option", { value: id, text: label }))); });
      const saved = store.get("units." + cat.value, null);
      from.value = saved?.[0] || list[0][0];
      to.value = saved?.[1] || list[Math.min(1, list.length - 1)][0];
    };
    const run = () => {
      store.set("units.cat", cat.value); store.set("units.val", +val.value); store.set("units." + cat.value, [from.value, to.value]);
      const v = parseFloat(val.value);
      if (!Number.isFinite(v)) { result.textContent = "—"; return; }
      try {
        const r = convert(cat.value, from.value, to.value, v);
        result.textContent = `${fmt(v)} ${from.value} = ${fmt(r)} ${to.value}`;
        const rows = unitList(cat.value).map(([id, label]) => [label, fmt(convert(cat.value, from.value, id, v))]).filter(([, x]) => x !== "NaN");
        table.replaceChildren(tbl(["unit", "value"], rows));
      } catch (e) { result.textContent = e.message; }
    };
    cat.addEventListener("change", () => { fillUnits(); run(); });
    [from, to].forEach((s) => s.addEventListener("change", run));
    val.addEventListener("input", debounce(run, 60));
    fillUnits(); run();

    /* currency (frankfurter.app — ECB reference rates, no key) */
    const cAmt = input({ type: "number", value: store.get("units.camt", 100), step: "any", class: "mono" });
    const cFrom = select([], { style: { width: "auto" } }), cTo = select([], { style: { width: "auto" } });
    const cOut = h("div.out.big"); const cTable = h("div"); const cStatus = h("span.chip", { text: "rates load on first use" });
    let rates = store.get("units.rates", null);
    const CURS = "USD EUR GBP JPY CAD AUD CHF CNY INR KRW MXN BRL SEK NOK DKK PLN CZK HUF TRY ZAR SGD HKD NZD THB IDR MYR PHP ILS RON BGN ISK".split(" ");
    const fillCur = () => { [cFrom, cTo].forEach((sel) => sel.replaceChildren(...CURS.map((c) => h("option", { value: c, text: c })))); cFrom.value = store.get("units.cfrom", "USD"); cTo.value = store.get("units.cto", "EUR"); };
    const fetchRates = async () => { cStatus.textContent = "fetching ECB rates…"; try { const j = await (await fetch("https://api.frankfurter.app/latest?from=USD")).json(); rates = { base: "USD", date: j.date, rates: { USD: 1, ...j.rates } }; store.set("units.rates", rates); cStatus.textContent = `ECB rates for ${j.date}`; runCur(); } catch { cStatus.textContent = rates ? `offline — using rates from ${rates.date}` : "could not fetch rates (offline?)"; } };
    const runCur = () => { store.set("units.camt", +cAmt.value); store.set("units.cfrom", cFrom.value); store.set("units.cto", cTo.value); if (!rates) return; const r = (c) => rates.rates[c]; if (!r(cFrom.value) || !r(cTo.value)) return (cOut.textContent = "currency not in ECB set"); const v = (+cAmt.value / r(cFrom.value)) * r(cTo.value); cOut.textContent = `${num(+cAmt.value)} ${cFrom.value} = ${num(+v.toFixed(2))} ${cTo.value}`; cTable.replaceChildren(tbl(["currency", "value", "rate"], CURS.filter((c) => r(c)).map((c) => [c, num(+((+cAmt.value / r(cFrom.value)) * r(c)).toFixed(2)), (r(c) / r(cFrom.value)).toFixed(4)]))); };
    [cAmt, cFrom, cTo].forEach((e) => e.addEventListener("input", runCur));
    fillCur();
    const currencyTab = () => { if (!rates) fetchRates(); else { cStatus.textContent = `ECB rates for ${rates.date} (cached)`; runCur(); } return h("div.split", card("Currency", h("div.col", h("div.row", field("amount", cAmt), field("from", cFrom), btn("⇄", () => { [cFrom.value, cTo.value] = [cTo.value, cFrom.value]; runCur(); }, "ghost sm"), field("to", cTo), btn("refresh", fetchRates, "ghost sm")), cOut, cStatus, h("p.hint", { text: "Daily European Central Bank reference rates via frankfurter.app — fine for estimates, not for trading." })), [btn("Copy", () => copy(cOut.textContent), "ghost sm")]), card("All currencies", cTable)); };

    const unitsTab = h("div.split",
      card("Convert", h("div.col",
        h("div.row", field("category", cat)),
        h("div.row", field("value", val), field("from", from), btn("⇄", () => { [from.value, to.value] = [to.value, from.value]; run(); }, "ghost sm"), field("to", to)),
        result), [btn("Copy result", () => copy(result.textContent), "ghost sm")]),
      card("All units", table));
    root.append(subtabs([{ id: "units", label: "Units", render: () => unitsTab }, { id: "currency", label: "Currency", render: currencyTab }], { remember: "units.tab" }));
  },
});

defineTool({
  id: "base", name: "Number Base & Bits", icon: "0x", cat: "numbers",
  desc: "Binary, octal, decimal, hex and any base 2–36; bitwise ops; roman numerals; number to words; two's complement.",
  tags: ["binary", "hex", "hexadecimal", "octal", "base", "bitwise", "roman", "twos complement", "bits", "radix", "number to words", "spell number"],
  mount(root) {
    const fields = { 2: input({ placeholder: "binary", class: "mono" }), 8: input({ placeholder: "octal", class: "mono" }), 10: input({ placeholder: "decimal", class: "mono" }), 16: input({ placeholder: "hex", class: "mono" }), 36: input({ placeholder: "base36", class: "mono" }) };
    const customBase = input({ type: "number", value: 12, min: 2, max: 36, style: { width: "80px" } });
    const customVal = input({ placeholder: "custom base", class: "mono" });
    const extra = h("div.kv-list");
    let value = 0n;
    const parse = (s, b) => { const clean = s.trim().replace(/^0[xXbBoO]/, "").replace(/[\s_]/g, ""); if (!clean) return null; const neg = clean.startsWith("-"); const digits = neg ? clean.slice(1) : clean; let n = 0n; for (const ch of digits.toLowerCase()) { const d = parseInt(ch, 36); if (isNaN(d) || d >= b) throw new Error("bad digit " + ch); n = n * BigInt(b) + BigInt(d); } return neg ? -n : n; };
    const render = (skip) => {
      for (const [b, f] of Object.entries(fields)) if (f !== skip) f.value = value.toString(+b);
      if (customVal !== skip) customVal.value = value.toString(+customBase.value || 10);
      const n = Number(value);
      const bits = value < 0n ? 64 : Math.max(8, 2 ** Math.ceil(Math.log2(value.toString(2).length || 1)));
      const twos = value < 0n ? (BigInt.asUintN(64, value)).toString(2).padStart(64, "0") : value.toString(2).padStart(bits, "0");
      extra.replaceChildren(
        h("div.kv", h("b", { text: "bit length" }), h("span", { text: String(value < 0n ? 64 : value.toString(2).length) })),
        h("div.kv", h("b", { text: "two's complement" }), h("span.mono", { text: twos.replace(/(.{8})/g, "$1 ").trim() })),
        h("div.kv", h("b", { text: "grouped hex" }), h("span.mono", { text: (value < 0n ? BigInt.asUintN(64, value) : value).toString(16).toUpperCase().padStart(2, "0").replace(/(..)(?=.)/g, "$1 ") })),
        h("div.kv", h("b", { text: "float32 (IEEE 754)" }), h("span.mono", { text: (() => { const b = new ArrayBuffer(4); new DataView(b).setFloat32(0, n); return new DataView(b).getUint32(0).toString(2).padStart(32, "0").replace(/^(.)(.{8})(.+)$/, "$1 $2 $3"); })() })),
        h("div.kv", h("b", { text: "bytes (LE)" }), h("span.mono", { text: (() => { let v = value < 0n ? BigInt.asUintN(64, value) : value; const out = []; do { out.push(Number(v & 0xffn).toString(16).padStart(2, "0")); v >>= 8n; } while (v > 0n); return out.join(" "); })() })),
        h("div.kv", h("b", { text: "popcount" }), h("span", { text: String([...twos].filter((c) => c === "1").length) })),
        h("div.kv", h("b", { text: "as unicode" }), h("span", { text: value >= 0n && value < 0x110000n ? String.fromCodePoint(Number(value)) : "—" })),
        h("div.kv", h("b", { text: "roman" }), h("span", { text: value > 0n && value < 4000n ? toRoman(Number(value)) : "1–3999 only" })),
        h("div.kv", h("b", { text: "in words" }), h("span", { text: toWords(value) })),
        h("div.kv", h("b", { text: "scientific" }), h("span", { text: Number(value).toExponential(4) })),
        h("div.kv", h("b", { text: "grouped" }), h("span", { text: value.toLocaleString() })));
    };
    const bind = (f, baseFn) => f.addEventListener("input", () => { try { const v = parse(f.value, baseFn()); if (v === null) return; value = v; f.classList.remove("err"); render(f); } catch { f.classList.add("err"); } });
    for (const [b, f] of Object.entries(fields)) bind(f, () => +b);
    bind(customVal, () => +customBase.value);
    customBase.addEventListener("input", () => render());
    const toWords = (nBig) => {
      const neg = nBig < 0n; let n = neg ? -nBig : nBig;
      if (n === 0n) return "zero";
      if (n > 10n ** 36n) return "too large";
      const ones = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
      const tens = "zero ten twenty thirty forty fifty sixty seventy eighty ninety".split(" ");
      const scales = ["", "thousand", "million", "billion", "trillion", "quadrillion", "quintillion", "sextillion", "septillion", "octillion", "nonillion", "decillion"];
      const chunk = (x) => { let s = ""; if (x >= 100) { s += ones[Math.floor(x / 100)] + " hundred"; x %= 100; if (x) s += " "; } if (x >= 20) { s += tens[Math.floor(x / 10)]; if (x % 10) s += "-" + ones[x % 10]; } else if (x > 0) s += ones[x]; return s; };
      const parts = []; let i = 0;
      while (n > 0n) { const c = Number(n % 1000n); if (c) parts.unshift(chunk(c) + (scales[i] ? " " + scales[i] : "")); n /= 1000n; i++; }
      return (neg ? "minus " : "") + parts.join(" ");
    };
    const toRoman = (n) => { const R = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]; let s = ""; for (const [v, r] of R) while (n >= v) { s += r; n -= v; } return s; };
    const romanIn = input({ placeholder: "MMXXVI", class: "mono" });
    romanIn.addEventListener("input", () => { const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; const s = romanIn.value.toUpperCase(); let t = 0; for (let i = 0; i < s.length; i++) { const c = map[s[i]] || 0, nx = map[s[i + 1]] || 0; t += c < nx ? -c : c; } if (t > 0) { value = BigInt(t); render(); } });

    /* bitwise */
    const a = input({ placeholder: "a (dec/0x/0b)", class: "mono", value: "0b1100" }), b = input({ placeholder: "b", class: "mono", value: "0b1010" });
    const bw = h("div.kv-list");
    const P = (s) => { const t = s.trim(); return t.startsWith("0x") ? BigInt(t) : t.startsWith("0b") ? BigInt(t) : BigInt(parseInt(t, 10) || 0); };
    const runBw = () => { try { const x = P(a.value), y = P(b.value); const show = (v) => `${v}  ·  0x${(v < 0n ? BigInt.asUintN(64, v) : v).toString(16)}  ·  0b${(v < 0n ? BigInt.asUintN(32, v) : v).toString(2)}`;
      bw.replaceChildren(...[["a & b", x & y], ["a | b", x | y], ["a ^ b", x ^ y], ["~a", ~x], ["a << 1", x << 1n], ["a >> 1", x >> 1n], ["a << b", x << (y & 63n)], ["a >> b", x >> (y & 63n)]].map(([k, v]) => h("div.kv", h("b", { text: k }), h("span.mono", { text: show(v) })))); } catch { bw.replaceChildren(out("invalid input", "err")); } };
    [a, b].forEach((f) => f.addEventListener("input", runBw));
    value = 2026n; render(); runBw();

    root.append(h("div.split",
      h("div.col",
        card("Bases", h("div.col", ...Object.entries(fields).map(([b, f]) => field(`base ${b}`, f)), h("div.row", field("base", customBase), h("div", { style: { flex: 1 } }, field("custom", customVal))), field("roman → number", romanIn)), [btn("Clear", () => { value = 0n; render(); }, "ghost sm")]),
        card("Bitwise", h("div.col", h("div.row", field("a", a), field("b", b)), bw))),
      card("Representations", extra)));
  },
});
