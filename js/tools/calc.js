import { h, defineTool, store, input, textarea, btn, card, copy, subtabs, field, select, out, tbl, num, round, debounce } from "../core.js";
import { evaluate, FUNCTIONS, CONSTANTS } from "../lib/expr.js";

defineTool({
  id: "calc", name: "Calculator", icon: "∑", cat: "numbers",
  desc: "Expression calculator with history & variables, graphing, matrices, number facts, money maths and statistics.",
  tags: ["calculator", "math", "expression", "graph", "plot", "function", "matrix", "determinant", "inverse", "prime", "factors", "percentage", "tip", "loan", "mortgage", "interest", "compound", "bmi", "vat", "tax", "discount"],
  mount(root) {
    /* expression calc */
    const expr = input({ placeholder: "2^10 + sqrt(144) * pi  ·  50% of 80 → 80*50%  ·  x = 42", class: "mono", style: { fontSize: "16px" } });
    const result = h("div.out.big");
    const history = h("div.col", { style: { gap: "4px" } });
    let vars = store.get("calc.vars", {});
    let hist = store.get("calc.hist", []);
    const fmt = (v) => (Number.isInteger(v) ? num(v) : Math.abs(v) < 1e-6 || Math.abs(v) > 1e15 ? v.toExponential(6) : String(+v.toPrecision(12)));
    const renderHist = () => { history.replaceChildren(...hist.slice(-12).reverse().map((x) => h("div.list-item", { style: { cursor: "pointer" }, onclick: () => { expr.value = x.e; live(); } }, h("span.li-text.mono", { text: x.e }), h("span.mono", { text: "= " + x.r, style: { color: "var(--a1)" } })))); };
    const live = () => {
      const s = expr.value.trim();
      result.classList.remove("err");
      if (!s) { result.textContent = "0"; return; }
      try {
        const m = /^([a-zA-Z_]\w*)\s*=\s*(.+)$/.exec(s);
        const v = evaluate(m ? m[2] : s, { ...vars, ans: hist.at(-1)?.v ?? 0 });
        result.textContent = (m ? m[1] + " = " : "") + fmt(v);
        result.dataset.v = v;
      } catch (e) { result.classList.add("err"); result.textContent = e.message; }
    };
    const commit = () => {
      const s = expr.value.trim(); if (!s || result.classList.contains("err")) return;
      const m = /^([a-zA-Z_]\w*)\s*=\s*(.+)$/.exec(s);
      const v = +result.dataset.v;
      if (m) { vars[m[1].toLowerCase()] = v; store.set("calc.vars", vars); renderVars(); }
      hist.push({ e: s, r: fmt(v), v }); hist = hist.slice(-50); store.set("calc.hist", hist); renderHist();
      expr.value = ""; live();
    };
    expr.addEventListener("input", live);
    expr.addEventListener("keydown", (e) => { if (e.key === "Enter") commit(); });
    const varsBox = h("div.row.tight");
    const renderVars = () => varsBox.replaceChildren(...Object.entries(vars).map(([k, v]) => h("span.chip", { text: `${k} = ${fmt(v)}`, style: { cursor: "pointer" }, onclick: () => { expr.value += k; expr.focus(); live(); } })), Object.keys(vars).length ? btn("clear vars", () => { vars = {}; store.set("calc.vars", vars); renderVars(); }, "ghost sm") : null);
    const keys = ["7", "8", "9", "/", "(", "4", "5", "6", "*", ")", "1", "2", "3", "-", "^", "0", ".", "%", "+", "ans"];
    const pad = h("div", { style: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" } }, keys.map((k) => btn(k, () => { expr.value += k; live(); expr.focus(); }, "sm")));
    const fnRow = h("div.row.tight", Object.keys(FUNCTIONS).map((f) => btn(f, () => { expr.value += f + "("; live(); expr.focus(); }, "ghost sm")), Object.keys(CONSTANTS).map((c) => btn(c, () => { expr.value += c; live(); expr.focus(); }, "ghost sm")));

    /* money maths */
    const money = () => {
      const pct = { a: input({ type: "number", value: 25, class: "mono" }), b: input({ type: "number", value: 200, class: "mono" }) };
      const pctOut = h("div.kv-list");
      const runPct = () => { const a = +pct.a.value, b = +pct.b.value; pctOut.replaceChildren(
        h("div.kv", h("b", { text: `${a}% of ${b}` }), h("span", { text: fmt(a / 100 * b) })), h("div.kv", h("b", { text: `${a} is what % of ${b}` }), h("span", { text: fmt(a / b * 100) + "%" })),
        h("div.kv", h("b", { text: `${b} + ${a}%` }), h("span", { text: fmt(b * (1 + a / 100)) })), h("div.kv", h("b", { text: `${b} − ${a}%` }), h("span", { text: fmt(b * (1 - a / 100)) })),
        h("div.kv", h("b", { text: `change ${a} → ${b}` }), h("span", { text: fmt((b - a) / Math.abs(a) * 100) + "%" })), h("div.kv", h("b", { text: `${b} is ${a}% of` }), h("span", { text: fmt(b / (a / 100)) }))); };
      [pct.a, pct.b].forEach((x) => x.addEventListener("input", runPct)); runPct();

      const bill = input({ type: "number", value: 86.4, class: "mono" }), tipP = input({ type: "number", value: 18, class: "mono" }), people = input({ type: "number", value: 2, min: 1, class: "mono" });
      const tipOut = h("div.kv-list");
      const runTip = () => { const b = +bill.value, t = b * tipP.value / 100, n = Math.max(1, +people.value); tipOut.replaceChildren(h("div.kv", h("b", { text: "tip" }), h("span", { text: fmt(round(t)) })), h("div.kv", h("b", { text: "total" }), h("span", { text: fmt(round(b + t)) })), h("div.kv", h("b", { text: "per person" }), h("span", { text: fmt(round((b + t) / n)) })), h("div.kv", h("b", { text: "tip per person" }), h("span", { text: fmt(round(t / n)) }))); };
      [bill, tipP, people].forEach((x) => x.addEventListener("input", runTip)); runTip();

      const principal = input({ type: "number", value: 250000, class: "mono" }), rate = input({ type: "number", value: 6.5, step: 0.01, class: "mono" }), years = input({ type: "number", value: 30, class: "mono" });
      const loanOut = h("div.kv-list"); const sched = h("div");
      const runLoan = () => { const P = +principal.value, r = +rate.value / 100 / 12, n = +years.value * 12; const m = r ? P * r / (1 - (1 + r) ** -n) : P / n; loanOut.replaceChildren(h("div.kv", h("b", { text: "monthly payment" }), h("span", { text: fmt(round(m)) })), h("div.kv", h("b", { text: "total paid" }), h("span", { text: fmt(round(m * n)) })), h("div.kv", h("b", { text: "total interest" }), h("span", { text: fmt(round(m * n - P)) })), h("div.kv", h("b", { text: "interest share" }), h("span", { text: fmt(round((m * n - P) / (m * n) * 100)) + "%" })));
        let bal = P; const rows = []; for (let y = 1; y <= +years.value; y++) { let int = 0, pr = 0; for (let k = 0; k < 12; k++) { const i = bal * r; int += i; pr += m - i; bal -= m - i; } rows.push([y, fmt(round(pr)), fmt(round(int)), fmt(round(Math.max(0, bal)))]); } sched.replaceChildren(tbl(["year", "principal", "interest", "balance"], rows)); };
      [principal, rate, years].forEach((x) => x.addEventListener("input", runLoan)); runLoan();

      const cp = input({ type: "number", value: 10000, class: "mono" }), cr = input({ type: "number", value: 7, step: 0.1, class: "mono" }), cy = input({ type: "number", value: 20, class: "mono" }), cm = input({ type: "number", value: 200, class: "mono" }), cn = select([["12", "monthly"], ["4", "quarterly"], ["1", "yearly"], ["365", "daily"]]);
      const cOut = h("div.kv-list");
      const runC = () => { const n = +cn.value, r = +cr.value / 100, t = +cy.value; let bal = +cp.value; const perPeriodContrib = +cm.value * 12 / n; for (let i = 0; i < n * t; i++) bal = bal * (1 + r / n) + perPeriodContrib; const contributed = +cp.value + +cm.value * 12 * t; cOut.replaceChildren(h("div.kv", h("b", { text: "final balance" }), h("span", { text: fmt(round(bal)) })), h("div.kv", h("b", { text: "contributed" }), h("span", { text: fmt(contributed) })), h("div.kv", h("b", { text: "growth" }), h("span", { text: fmt(round(bal - contributed)) })), h("div.kv", h("b", { text: "rule of 72 doubling" }), h("span", { text: (72 / +cr.value).toFixed(1) + " years" }))); };
      [cp, cr, cy, cm, cn].forEach((x) => x.addEventListener("input", runC)); runC();

      const hgt = input({ type: "number", value: 175, class: "mono" }), wgt = input({ type: "number", value: 70, class: "mono" }); const bmiOut = h("div.kv-list");
      const runBmi = () => { const v = +wgt.value / ((+hgt.value / 100) ** 2); bmiOut.replaceChildren(h("div.kv", h("b", { text: "BMI" }), h("span", { text: v.toFixed(1) + " · " + (v < 18.5 ? "underweight" : v < 25 ? "normal" : v < 30 ? "overweight" : "obese") })), h("div.kv", h("b", { text: "normal range weight" }), h("span", { text: `${(18.5 * (hgt.value / 100) ** 2).toFixed(1)} – ${(24.9 * (hgt.value / 100) ** 2).toFixed(1)} kg` }))); };
      [hgt, wgt].forEach((x) => x.addEventListener("input", runBmi)); runBmi();

      const price = input({ type: "number", value: 79.99, class: "mono" }), disc = input({ type: "number", value: 20, class: "mono" }), tax = input({ type: "number", value: 6, class: "mono" });
      const dOut = h("div.kv-list");
      const runD = () => { const p = +price.value, d = p * (1 - +disc.value / 100), t = d * (1 + +tax.value / 100); dOut.replaceChildren(h("div.kv", h("b", { text: "after discount" }), h("span", { text: fmt(round(d)) })), h("div.kv", h("b", { text: "you save" }), h("span", { text: fmt(round(p - d)) })), h("div.kv", h("b", { text: "with tax" }), h("span", { text: fmt(round(t)) })), h("div.kv", h("b", { text: "tax amount" }), h("span", { text: fmt(round(t - d)) })), h("div.kv", h("b", { text: "price before tax (reverse)" }), h("span", { text: fmt(round(p / (1 + +tax.value / 100))) }))); };
      [price, disc, tax].forEach((x) => x.addEventListener("input", runD)); runD();
      return h("div.grid.g2",
        card("Discount & tax", h("div.col", h("div.row", field("price", price), field("discount %", disc), field("tax / VAT %", tax)), dOut)),
        card("Percentages", h("div.col", h("div.row", field("a", pct.a), field("b", pct.b)), pctOut)),
        card("Tip & split", h("div.col", h("div.row", field("bill", bill), field("tip %", tipP), field("people", people)), tipOut)),
        card("Loan / mortgage", h("div.col", h("div.row", field("principal", principal), field("rate % / yr", rate), field("years", years)), loanOut, h("details", h("summary.hint", { text: "amortisation schedule" }), sched))),
        card("Compound interest", h("div.col", h("div.row", field("principal", cp), field("rate %", cr), field("years", cy), field("monthly add", cm), field("compounding", cn)), cOut)),
        card("BMI", h("div.col", h("div.row", field("height cm", hgt), field("weight kg", wgt)), bmiOut)));
    };

    /* stats */
    const statsTa = textarea({ placeholder: "numbers separated by spaces, commas or newlines", style: { minHeight: "120px" } });
    const statsOut = h("div.kv-list");
    const runStats = () => { const xs = (statsTa.value.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi) || []).map(Number); if (!xs.length) return statsOut.replaceChildren(); const n = xs.length, s = [...xs].sort((a, b) => a - b), sum = xs.reduce((a, b) => a + b, 0), mean = sum / n, med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; const varc = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / n; const counts = new Map(); xs.forEach((x) => counts.set(x, (counts.get(x) || 0) + 1)); const mode = [...counts].sort((a, b) => b[1] - a[1])[0]; const q = (p) => { const i = (n - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
      statsOut.replaceChildren(...[["count", n], ["sum", fmt(sum)], ["mean", fmt(mean)], ["median", fmt(med)], ["mode", mode[1] > 1 ? `${mode[0]} (×${mode[1]})` : "none"], ["min", fmt(s[0])], ["max", fmt(s[n - 1])], ["range", fmt(s[n - 1] - s[0])], ["std dev (pop)", fmt(Math.sqrt(varc))], ["std dev (sample)", fmt(Math.sqrt(varc * n / Math.max(1, n - 1)))], ["variance", fmt(varc)], ["Q1 / Q3", `${fmt(q(0.25))} / ${fmt(q(0.75))}`], ["geometric mean", fmt(Math.exp(xs.reduce((a, x) => a + Math.log(Math.abs(x) || 1), 0) / n))], ["product", fmt(xs.reduce((a, b) => a * b, 1))]].map(([k, v]) => h("div.kv", h("b", { text: k }), h("span", { text: String(v) })))); };
    statsTa.addEventListener("input", debounce(runStats, 100));

    /* graph */
    const gExpr = input({ placeholder: "y = f(x), e.g. sin(x) * x  ·  separate several with ;", class: "mono", value: store.get("calc.graph", "sin(x) * x; x^2 / 10") });
    const gMin = input({ type: "number", value: -10, class: "mono", style: { width: "80px" } }), gMax = input({ type: "number", value: 10, class: "mono", style: { width: "80px" } });
    const gCanvas = h("canvas", { width: 900, height: 480, style: { width: "100%", borderRadius: "12px", background: "var(--bg-2)", border: "1px solid var(--line)" } });
    const gInfo = h("span.hint");
    const drawGraph = () => {
      store.set("calc.graph", gExpr.value);
      const ctx = gCanvas.getContext("2d"), W = gCanvas.width, H = gCanvas.height; ctx.clearRect(0, 0, W, H);
      const x0 = +gMin.value, x1 = +gMax.value; if (!(x1 > x0)) return;
      const fns = gExpr.value.split(";").map((e) => e.replace(/^\s*y\s*=/, "").trim()).filter(Boolean);
      const colors = ["#00e5ff", "#ff2fd0", "#9dff4f", "#ffc861", "#8b6bff"];
      const N = W; const ys = fns.map((f) => Array.from({ length: N }, (_, i) => { const x = x0 + ((x1 - x0) * i) / (N - 1); try { const v = evaluate(f, { ...vars, x }); return Number.isFinite(v) ? v : NaN; } catch { return NaN; } }));
      const all = ys.flat().filter(Number.isFinite); if (!all.length) { gInfo.textContent = "no plottable values — check the expression"; return; }
      let yMin = Math.min(...all), yMax = Math.max(...all); if (yMin === yMax) { yMin -= 1; yMax += 1; } const pad = (yMax - yMin) * 0.08; yMin -= pad; yMax += pad;
      const sx = (x) => ((x - x0) / (x1 - x0)) * W, sy = (y) => H - ((y - yMin) / (yMax - yMin)) * H;
      ctx.strokeStyle = "rgba(120,180,255,.12)"; ctx.lineWidth = 1; ctx.font = "11px monospace"; ctx.fillStyle = "#7d8bad";
      const step = (r) => { const p = 10 ** Math.floor(Math.log10(r / 8)); return [1, 2, 5, 10].map((k) => k * p).find((v) => r / v <= 12); };
      const xs = step(x1 - x0), yst = step(yMax - yMin);
      for (let x = Math.ceil(x0 / xs) * xs; x <= x1; x += xs) { ctx.beginPath(); ctx.moveTo(sx(x), 0); ctx.lineTo(sx(x), H); ctx.stroke(); ctx.fillText(+x.toFixed(6), sx(x) + 3, H - 4); }
      for (let y = Math.ceil(yMin / yst) * yst; y <= yMax; y += yst) { ctx.beginPath(); ctx.moveTo(0, sy(y)); ctx.lineTo(W, sy(y)); ctx.stroke(); ctx.fillText(+y.toFixed(6), 4, sy(y) - 3); }
      ctx.strokeStyle = "rgba(120,180,255,.5)"; ctx.beginPath(); ctx.moveTo(sx(0), 0); ctx.lineTo(sx(0), H); ctx.moveTo(0, sy(0)); ctx.lineTo(W, sy(0)); ctx.stroke();
      ys.forEach((arr, k) => { ctx.strokeStyle = colors[k % colors.length]; ctx.lineWidth = 2; ctx.beginPath(); let pen = false; arr.forEach((y, i) => { if (!Number.isFinite(y)) { pen = false; return; } const X = sx(x0 + ((x1 - x0) * i) / (N - 1)), Y = sy(y); if (!pen) { ctx.moveTo(X, Y); pen = true; } else ctx.lineTo(X, Y); }); ctx.stroke(); ctx.fillStyle = colors[k % colors.length]; ctx.fillText(fns[k], 10, 16 + k * 14); });
      gInfo.textContent = `x ∈ [${x0}, ${x1}] · y ∈ [${yMin.toFixed(2)}, ${yMax.toFixed(2)}]`;
    };
    [gExpr, gMin, gMax].forEach((e) => e.addEventListener("input", debounce(drawGraph, 120)));
    gCanvas.addEventListener("mousemove", (e) => { const r = gCanvas.getBoundingClientRect(); const x = +gMin.value + ((e.clientX - r.left) / r.width) * (+gMax.value - +gMin.value); const f = gExpr.value.split(";")[0]?.replace(/^\s*y\s*=/, "").trim(); try { gInfo.textContent = `x = ${x.toFixed(3)} → y = ${evaluate(f, { ...vars, x }).toFixed(4)}`; } catch {} });

    /* matrix */
    const mA = textarea({ value: "1 2\n3 4", style: { minHeight: "90px" }, class: "mono" }), mB = textarea({ value: "5 6\n7 8", style: { minHeight: "90px" }, class: "mono" });
    const mOut = out();
    const parseM = (t) => t.trim().split(/\n/).map((r) => r.trim().split(/[\s,]+/).map(Number));
    const showM = (m) => (Array.isArray(m[0]) ? m.map((r) => r.map((v) => +(+v).toFixed(6)).join("  ")).join("\n") : String(m));
    const det = (m) => { const n = m.length; if (n === 1) return m[0][0]; if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0]; let d = 0; for (let c = 0; c < n; c++) d += (c % 2 ? -1 : 1) * m[0][c] * det(m.slice(1).map((r) => r.filter((_, j) => j !== c))); return d; };
    const mul = (a, b) => { if (a[0].length !== b.length) throw new Error("A columns must equal B rows"); return a.map((r) => b[0].map((_, j) => r.reduce((sum, v, k) => sum + v * b[k][j], 0))); };
    const inv = (m) => { const n = m.length; const a = m.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]); for (let i = 0; i < n; i++) { let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(a[r][i]) > Math.abs(a[p][i])) p = r; [a[i], a[p]] = [a[p], a[i]]; if (Math.abs(a[i][i]) < 1e-12) throw new Error("singular matrix"); const d = a[i][i]; for (let j = 0; j < 2 * n; j++) a[i][j] /= d; for (let r = 0; r < n; r++) if (r !== i) { const f = a[r][i]; for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[i][j]; } } return a.map((r) => r.slice(n)); };
    const transpose = (m) => m[0].map((_, j) => m.map((r) => r[j]));
    const mOp = (fn) => () => { try { mOut.textContent = showM(fn(parseM(mA.value), parseM(mB.value))); } catch (e) { mOut.textContent = "error: " + e.message; } };
    const matrixTab = () => h("div.col", h("div.grid.g2", card("A", mA), card("B", mB)),
      h("div.row", btn("A + B", mOp((a, b) => a.map((r, i) => r.map((v, j) => v + b[i][j]))), "sm"), btn("A − B", mOp((a, b) => a.map((r, i) => r.map((v, j) => v - b[i][j]))), "sm"), btn("A × B", mOp(mul), "sm"), btn("A ⊙ B", mOp((a, b) => a.map((r, i) => r.map((v, j) => v * b[i][j]))), "sm"), btn("det A", mOp((a) => det(a)), "sm"), btn("A⁻¹", mOp((a) => inv(a)), "sm"), btn("Aᵀ", mOp((a) => transpose(a)), "sm"), btn("A²", mOp((a) => mul(a, a)), "sm"), btn("trace A", mOp((a) => a.reduce((t, r, i) => t + r[i], 0)), "sm"), btn("solve Ax = B", mOp((a, b) => mul(inv(a), b)), "sm")),
      mOut, h("p.hint", { text: "rows on new lines, values separated by spaces or commas" }));

    /* number facts */
    const nfIn = input({ type: "number", value: 2026, class: "mono" });
    const nfOut = h("div.kv-list");
    const isPrime = (n) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
    const factors = (n) => { const f = []; let d = 2; while (n > 1 && d * d <= n) { while (n % d === 0) { f.push(d); n /= d; } d++; } if (n > 1) f.push(n); return f; };
    const runNf = () => { const n = Math.floor(+nfIn.value); if (!Number.isFinite(n) || Math.abs(n) > 1e15) return nfOut.replaceChildren(out("enter an integer up to 1e15")); const a = Math.abs(n); const divs = []; for (let i = 1; i * i <= a && i <= 1e6; i++) if (a % i === 0) { divs.push(i); if (i !== a / i) divs.push(a / i); } divs.sort((x, y) => x - y); let nextP = a + 1; while (!isPrime(nextP)) nextP++; let prevP = a - 1; while (prevP > 1 && !isPrime(prevP)) prevP--; const fib = (() => { let x = 0, y = 1; while (y < a) [x, y] = [y, x + y]; return y === a || a === 0; })();
      nfOut.replaceChildren(...[["prime?", isPrime(a) ? "yes" : "no"], ["prime factors", factors(a).join(" × ") || "—"], ["divisors", divs.length > 40 ? divs.slice(0, 40).join(", ") + " …" : divs.join(", ")], ["divisor count", divs.length], ["sum of divisors", divs.reduce((x, y) => x + y, 0)], ["perfect?", divs.reduce((x, y) => x + y, 0) - a === a ? "yes" : "no"], ["parity", a % 2 ? "odd" : "even"], ["square?", Number.isInteger(Math.sqrt(a)) ? `yes (${Math.sqrt(a)}²)` : "no"], ["cube?", Number.isInteger(Math.cbrt(a)) ? `yes (${Math.round(Math.cbrt(a))}³)` : "no"], ["fibonacci?", fib ? "yes" : "no"], ["nearest primes", `${prevP > 1 ? prevP : "—"} ← → ${nextP}`], ["binary / hex / octal", `${a.toString(2)} · 0x${a.toString(16)} · 0o${a.toString(8)}`], ["digit sum", String(a).split("").reduce((x, y) => x + +y, 0)], ["reversed", +String(a).split("").reverse().join("")], ["factorial (n ≤ 170)", a <= 170 ? FUNCTIONS.fact(a).toExponential(4) : "—"], ["√ / ∛ / log10 / ln", `${Math.sqrt(a).toFixed(4)} · ${Math.cbrt(a).toFixed(4)} · ${Math.log10(a).toFixed(4)} · ${Math.log(a).toFixed(4)}`]].map(([k, v]) => h("div.kv", h("b", { text: k }), h("span", { text: String(v) })))); };
    nfIn.addEventListener("input", debounce(runNf, 100));

    const graphTab = { id: "graph", label: "Graph", render: () => { setTimeout(drawGraph, 0); return h("div.col", h("div.row", h("div", { style: { flex: 1 } }, gExpr), field("x min", gMin), field("x max", gMax), btn("plot", drawGraph, "sm")), gCanvas, gInfo, h("div.row.tight", ...["sin(x)", "cos(x); sin(x)", "x^2; x^3 / 10", "exp(-x^2)", "1/x", "abs(x) - 3", "floor(x)", "sqrt(x); ln(x)", "tan(x)"].map((e) => btn(e, () => { gExpr.value = e; drawGraph(); }, "ghost sm")))); } };
    const matrixEntry = { id: "matrix", label: "Matrix", render: matrixTab };
    const factsEntry = { id: "facts", label: "Number facts", render: () => { runNf(); return h("div.col", nfIn, nfOut); } };

    root.append(subtabs([
      { id: "expr", label: "Expression", render: () => { renderVars(); renderHist(); live(); return h("div.split", h("div.col", card("Calculator", h("div.col", expr, result, varsBox, pad, h("details", h("summary.hint", { text: "functions & constants" }), fnRow), h("p.hint", { text: "Enter to commit · name = expr stores a variable · ans is the last result · supports 0x, 0b, %, !, //, bit ops" })), [btn("Copy", () => copy(result.textContent), "ghost sm"), btn("Clear history", () => { hist = []; store.set("calc.hist", hist); renderHist(); }, "ghost sm danger")])), card("History", history)); } },
      graphTab,
      matrixEntry,
      factsEntry,
      { id: "money", label: "Money & life", render: money },
      { id: "stats", label: "Statistics", render: () => h("div.split", card("Numbers", statsTa), card("Stats", statsOut)) },
    ], { remember: "calc.tab" }));
  },
});
