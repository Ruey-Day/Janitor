import { h, defineTool, store, input, btn, card, copy, toast, subtabs, field, select, seg, out, kv, tbl, num } from "../core.js";

const ZONES = ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Moscow", "Asia/Dubai", "Asia/Kolkata", "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Asia/Singapore", "Australia/Sydney", "Pacific/Auckland"];
const pad = (n) => String(n).padStart(2, "0");
const fmtDur = (ms) => { const s = Math.floor(Math.abs(ms) / 1000); const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return (ms < 0 ? "-" : "") + (d ? d + "d " : "") + `${pad(hh)}:${pad(m)}:${pad(sec)}`; };
const isoWeek = (d) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 86400000 + 1) / 7); };

/* tiny cron parser: next N runs */
function cronNext(expr, count = 5, from = new Date()) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error("need 5 fields: min hour day month weekday");
  const range = (spec, lo, hi) => { const set = new Set(); for (const piece of spec.split(",")) { const [r, stepS] = piece.split("/"); const step = stepS ? +stepS : 1; let a = lo, b = hi; if (r !== "*") { const [x, y] = r.split("-").map(Number); a = x; b = y ?? x; } for (let i = a; i <= b; i += step) set.add(i); } return set; };
  const mins = range(parts[0], 0, 59), hours = range(parts[1], 0, 23), days = range(parts[2], 1, 31), months = range(parts[3], 1, 12), dows = range(parts[4].replace("7", "0"), 0, 6);
  const out = []; const d = new Date(from); d.setSeconds(0, 0); d.setMinutes(d.getMinutes() + 1);
  for (let i = 0; i < 366 * 24 * 60 && out.length < count; i++) {
    if (months.has(d.getMonth() + 1) && (days.has(d.getDate()) || parts[2] === "*") && (dows.has(d.getDay()) || parts[4] === "*") && hours.has(d.getHours()) && mins.has(d.getMinutes())) out.push(new Date(d));
    d.setMinutes(d.getMinutes() + 1);
  }
  return out;
}

defineTool({
  id: "time", name: "Time Machine", icon: "◷", cat: "time",
  desc: "Unix timestamps, world clocks, date maths, timers & alarms, countdowns, stopwatch, Pomodoro, sleep cycles, cron.",
  tags: ["time", "date", "unix", "timestamp", "epoch", "timezone", "world clock", "countdown", "timer", "alarm", "stopwatch", "pomodoro", "sleep calculator", "cron", "duration", "week number", "age"],
  mount(root) {
    const timers = [];
    const every = (fn, ms) => { fn(); timers.push(setInterval(fn, ms)); };

    /* now / unix */
    const nowBox = h("div.kv-list");
    const tsIn = input({ placeholder: "unix seconds, ms, or ISO date", class: "mono", value: store.get("time.ts", "") });
    const tsOut = h("div.kv-list");
    const parseTs = () => {
      store.set("time.ts", tsIn.value);
      const s = tsIn.value.trim(); if (!s) return tsOut.replaceChildren();
      let d;
      if (/^-?\d+(\.\d+)?$/.test(s)) { const n = +s; d = new Date(Math.abs(n) > 1e12 ? n : Math.abs(n) > 1e10 ? n : n * 1000); }
      else d = new Date(s);
      if (isNaN(d)) return tsOut.replaceChildren(out("unrecognised date", "err"));
      const rel = d - Date.now();
      const relStr = Math.abs(rel) < 60000 ? "just now" : (rel < 0 ? "" : "in ") + fmtDur(rel).replace(/^-/, "") + (rel < 0 ? " ago" : "");
      tsOut.replaceChildren(...[["unix seconds", Math.floor(d / 1000)], ["unix ms", +d], ["ISO 8601", d.toISOString()], ["local", d.toLocaleString()], ["UTC", d.toUTCString()], ["relative", relStr], ["day of year", Math.ceil((d - new Date(d.getFullYear(), 0, 1)) / 864e5)], ["ISO week", `W${isoWeek(d)}`], ["weekday", d.toLocaleDateString([], { weekday: "long" })], ["RFC 2822", d.toString()], ["excel serial", ((d - new Date(Date.UTC(1899, 11, 30))) / 864e5).toFixed(5)]].map(([k, v]) => h("div.kv.copyable", { onclick: () => copy(String(v)) }, h("b", { text: k }), h("span", { text: String(v) }))));
    };
    tsIn.addEventListener("input", parseTs);
    every(() => { const d = new Date(); nowBox.replaceChildren(...[["local", d.toLocaleString()], ["ISO", d.toISOString()], ["unix", Math.floor(d / 1000)], ["ms", +d], ["timezone", Intl.DateTimeFormat().resolvedOptions().timeZone + " (UTC" + (d.getTimezoneOffset() <= 0 ? "+" : "-") + pad(Math.abs(d.getTimezoneOffset()) / 60 | 0) + ":" + pad(Math.abs(d.getTimezoneOffset()) % 60) + ")"], ["ISO week", `W${isoWeek(d)}`], ["day of year", Math.ceil((d - new Date(d.getFullYear(), 0, 1)) / 864e5)], ["year progress", ((d - new Date(d.getFullYear(), 0, 1)) / (new Date(d.getFullYear() + 1, 0, 1) - new Date(d.getFullYear(), 0, 1)) * 100).toFixed(2) + "%"]].map(([k, v]) => h("div.kv.copyable", { onclick: () => copy(String(v)) }, h("b", { text: k }), h("span", { text: String(v) })))); }, 1000);

    /* world clock */
    let zones = store.get("time.zones", ["UTC", "America/New_York", "Europe/London", "Asia/Tokyo"]);
    const zoneSel = select(ZONES, { style: { width: "auto" } });
    const zoneBox = h("div.kv-list");
    const custom = input({ placeholder: "any IANA zone, e.g. Africa/Nairobi" });
    const addZone = (z) => { try { new Intl.DateTimeFormat([], { timeZone: z }); if (!zones.includes(z)) zones.push(z); store.set("time.zones", zones); renderZones(); } catch { toast("unknown timezone", "bad"); } };
    const renderZones = () => { const d = new Date(); zoneBox.replaceChildren(...zones.map((z) => h("div.kv", h("b", { text: z.replace(/_/g, " ") }), h("span.row.tight", h("span", { text: d.toLocaleString([], { timeZone: z, hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short", month: "short", day: "numeric" }) }), h("span.chip", { text: new Intl.DateTimeFormat("en", { timeZone: z, timeZoneName: "shortOffset" }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value || "" }), btn("✕", () => { zones = zones.filter((x) => x !== z); store.set("time.zones", zones); renderZones(); }, "ghost sm"))))); };
    every(renderZones, 1000);

    /* date diff */
    const d1 = input({ type: "datetime-local", value: new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) }), d2 = input({ type: "datetime-local", value: new Date(Date.now() - new Date().getTimezoneOffset() * 6e4 + 7 * 864e5).toISOString().slice(0, 16) });
    const diffOut = h("div.kv-list");
    const runDiff = () => { const a = new Date(d1.value), b = new Date(d2.value); if (isNaN(a) || isNaN(b)) return; const ms = b - a; let y = b.getFullYear() - a.getFullYear(), mo = b.getMonth() - a.getMonth(), dd = b.getDate() - a.getDate(); if (dd < 0) { mo--; dd += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); } if (mo < 0) { y--; mo += 12; }
      let bd = 0; for (let t = new Date(a); t < b; t.setDate(t.getDate() + 1)) if (t.getDay() % 6) bd++;
      diffOut.replaceChildren(...[["calendar", `${y}y ${mo}m ${dd}d`], ["total days", (ms / 864e5).toFixed(2)], ["weeks", (ms / 6048e5).toFixed(2)], ["hours", num(Math.round(ms / 36e5))], ["minutes", num(Math.round(ms / 6e4))], ["seconds", num(Math.round(ms / 1000))], ["business days", num(bd)], ["duration", fmtDur(ms)]].map(([k, v]) => h("div.kv", h("b", { text: k }), h("span", { text: String(v) })))); };
    [d1, d2].forEach((x) => x.addEventListener("input", runDiff)); runDiff();
    const addN = input({ type: "number", value: 30, class: "mono", style: { width: "90px" } }), addU = select(["days", "hours", "weeks", "months", "years", "business days"], { style: { width: "auto" } });
    const addOut = out();
    const runAdd = () => { const a = new Date(d1.value); if (isNaN(a)) return; const n = +addN.value; const r = new Date(a); const u = addU.value; if (u === "days") r.setDate(r.getDate() + n); else if (u === "hours") r.setHours(r.getHours() + n); else if (u === "weeks") r.setDate(r.getDate() + 7 * n); else if (u === "months") r.setMonth(r.getMonth() + n); else if (u === "years") r.setFullYear(r.getFullYear() + n); else { let k = 0; while (k < Math.abs(n)) { r.setDate(r.getDate() + Math.sign(n)); if (r.getDay() % 6) k++; } } addOut.textContent = `${r.toLocaleString()}  (${r.toLocaleDateString([], { weekday: "long" })})`; };
    [d1, addN, addU].forEach((x) => x.addEventListener("input", runAdd)); runAdd();

    /* countdown */
    const target = input({ type: "datetime-local", value: store.get("time.target", "") });
    const cdOut = h("div.out.big", { style: { textAlign: "center", fontSize: "30px" } });
    const cdLabel = input({ placeholder: "label (optional)", value: store.get("time.targetLabel", "") });
    every(() => { store.set("time.target", target.value); store.set("time.targetLabel", cdLabel.value); if (!target.value) return (cdOut.textContent = "set a target"); const ms = new Date(target.value) - Date.now(); cdOut.textContent = (ms < 0 ? "elapsed " : "") + fmtDur(ms).replace(/^-/, "") + (cdLabel.value ? "  ·  " + cdLabel.value : ""); }, 1000);

    /* stopwatch */
    let swStart = 0, swAcc = store.get("time.swAcc", 0), swRunning = false, laps = [];
    const swOut = h("div.out.big", { style: { textAlign: "center", fontSize: "34px" } });
    const lapBox = h("div");
    const swTick = () => { const t = swAcc + (swRunning ? Date.now() - swStart : 0); swOut.textContent = fmtDur(t) + "." + pad(Math.floor((t % 1000) / 10)); };
    timers.push(setInterval(swTick, 47)); swTick();
    const swToggle = btn("Start", () => { if (swRunning) { swAcc += Date.now() - swStart; swRunning = false; swToggle.textContent = "Start"; store.set("time.swAcc", swAcc); } else { swStart = Date.now(); swRunning = true; swToggle.textContent = "Pause"; } }, "primary sm");
    const lap = () => { const t = swAcc + (swRunning ? Date.now() - swStart : 0); laps.push(t); lapBox.replaceChildren(tbl(["lap", "split", "total"], laps.map((x, i) => [i + 1, fmtDur(x - (laps[i - 1] || 0)), fmtDur(x)]).reverse())); };

    /* pomodoro */
    let pomo = { phase: "focus", left: 25 * 60, running: false, done: 0 };
    const pFocus = input({ type: "number", value: store.get("time.pf", 25), min: 1, style: { width: "70px" } }), pBreak = input({ type: "number", value: store.get("time.pb", 5), min: 1, style: { width: "70px" } });
    const pOut = h("div.out.big", { style: { textAlign: "center", fontSize: "40px" } });
    const pPhase = h("span.chip");
    const beep = () => { try { const ac = new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(); const g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.frequency.value = 880; g.gain.setValueAtTime(0.2, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.6); o.start(); o.stop(ac.currentTime + 0.6); } catch {} };
    const pRender = () => { pOut.textContent = `${pad(Math.floor(pomo.left / 60))}:${pad(pomo.left % 60)}`; pPhase.className = "chip " + (pomo.phase === "focus" ? "warn" : "ok"); pPhase.textContent = `${pomo.phase} · ${pomo.done} done`; document.title = pomo.running ? `${pOut.textContent} ${pomo.phase} // TRINKET LAB` : "Time Machine // TRINKET LAB"; };
    timers.push(setInterval(() => { if (!pomo.running) return; pomo.left--; if (pomo.left <= 0) { beep(); if (pomo.phase === "focus") { pomo.done++; pomo.phase = "break"; pomo.left = +pBreak.value * 60; } else { pomo.phase = "focus"; pomo.left = +pFocus.value * 60; } if (Notification?.permission === "granted") new Notification("TRINKET LAB", { body: `${pomo.phase} time!` }); } pRender(); }, 1000));
    const pToggle = btn("Start", () => { pomo.running = !pomo.running; pToggle.textContent = pomo.running ? "Pause" : "Start"; if (pomo.running && "Notification" in window && Notification.permission === "default") Notification.requestPermission(); pRender(); }, "primary sm");
    const pReset = () => { pomo = { phase: "focus", left: +pFocus.value * 60, running: false, done: pomo.done }; pToggle.textContent = "Start"; pRender(); };
    [pFocus, pBreak].forEach((x) => x.addEventListener("input", () => { store.set("time.pf", +pFocus.value); store.set("time.pb", +pBreak.value); if (!pomo.running) pReset(); }));
    pRender();

    /* cron */
    const cronIn = input({ placeholder: "*/15 9-17 * * 1-5", class: "mono", value: store.get("time.cron", "0 9 * * 1-5") });
    const cronOut = h("div");
    const runCron = () => { store.set("time.cron", cronIn.value); try { const runs = cronNext(cronIn.value, 8); cronOut.replaceChildren(tbl(["#", "next run", "in"], runs.map((d, i) => [i + 1, d.toLocaleString(), fmtDur(d - Date.now())]))); } catch (e) { cronOut.replaceChildren(out(e.message, "err")); } };
    cronIn.addEventListener("input", runCron); runCron();
    const cronPresets = h("div.row.tight", [["every minute", "* * * * *"], ["hourly", "0 * * * *"], ["daily 9am", "0 9 * * *"], ["weekdays 9am", "0 9 * * 1-5"], ["every 15 min", "*/15 * * * *"], ["1st of month", "0 0 1 * *"], ["sunday midnight", "0 0 * * 0"]].map(([l, v]) => btn(l, () => { cronIn.value = v; runCron(); }, "ghost sm")));

    /* quick timers + alarms */
    const beep3 = () => { beep(); setTimeout(beep, 350); setTimeout(beep, 700); };
    const notify = (body) => { try { if (Notification?.permission === "granted") new Notification("TRINKET LAB", { body }); else if (Notification?.permission === "default") Notification.requestPermission(); } catch {} };
    let timerEnd = 0, timerLabel = "";
    const tOut = h("div.out.big", { style: { textAlign: "center", fontSize: "40px" }, text: "00:00" });
    const tMin = input({ type: "number", value: 5, min: 0, class: "mono", style: { width: "80px" } }), tSec = input({ type: "number", value: 0, min: 0, max: 59, class: "mono", style: { width: "80px" } });
    const tLabel = input({ placeholder: "label (optional)" });
    let timerFired = false;
    every(() => { if (!timerEnd) return; const ms = timerEnd - Date.now(); if (ms <= 0) { tOut.textContent = "00:00 · done" + (timerLabel ? " · " + timerLabel : ""); if (!timerFired) { timerFired = true; beep3(); notify((timerLabel || "timer") + " finished"); } return; } tOut.textContent = fmtDur(ms).replace(/^00:/, "") + (timerLabel ? " · " + timerLabel : ""); document.title = `${fmtDur(ms).replace(/^00:/, "")} // TRINKET LAB`; }, 250);
    const startTimer = (mins) => { timerEnd = Date.now() + (mins ?? (+tMin.value * 60 + +tSec.value)) * 1000; timerLabel = tLabel.value; timerFired = false; if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); };
    let alarms = store.get("time.alarms", []);
    const alarmList = h("div.col", { style: { gap: "6px" } });
    const alarmTime = input({ type: "time", value: "07:30" }), alarmLabel = input({ placeholder: "label" });
    const renderAlarms = () => { store.set("time.alarms", alarms); alarmList.replaceChildren(...alarms.map((a) => h("div.list-item", h("input", { type: "checkbox", checked: a.on, onchange: (e) => { a.on = e.target.checked; renderAlarms(); } }), h("span.li-text.mono", { text: `${a.time}  ${a.label || ""}` }), h("span.hint", { text: a.fired ? "rang " + a.fired : "" }), btn("✕", () => { alarms = alarms.filter((x) => x !== a); renderAlarms(); }, "ghost sm danger")))); };
    every(() => { const now = new Date(); const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`; for (const a of alarms) if (a.on && a.time === hm && a.fired !== hm + now.toDateString()) { a.fired = hm + now.toDateString(); beep3(); notify("⏰ " + (a.label || a.time)); toast("⏰ " + (a.label || a.time), "ok"); renderAlarms(); } }, 1000);
    /* sleep calculator */
    const sleepOut = h("div.col");
    const sleepAt = input({ type: "time", value: "23:00" });
    const calcSleep = (mode) => { const [hh, mm] = sleepAt.value.split(":").map(Number); const base = new Date(); base.setHours(hh, mm, 0, 0); const rows = []; for (let c = 6; c >= 3; c--) { const d = new Date(base.getTime() + (mode === "wake" ? 1 : -1) * (c * 90 + 14) * 60000); rows.push([`${c} cycles (${(c * 1.5).toFixed(1)} h)`, d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), c >= 5 ? "ideal" : c === 4 ? "ok" : "short"]); } sleepOut.replaceChildren(tbl([mode === "wake" ? "if you fall asleep at " + sleepAt.value + ", wake at" : "to wake at " + sleepAt.value + ", fall asleep at", "time", ""], rows), h("p.hint", { text: "assumes 90-minute sleep cycles and ~14 minutes to fall asleep" })); };

    root.append(subtabs([
      { id: "timer", label: "Timer & alarms", render: () => { renderAlarms(); return h("div.grid.g2", card("Timer", h("div.col", tOut, h("div.row", field("min", tMin), field("sec", tSec), field("label", tLabel), btn("Start", () => startTimer(), "primary sm"), btn("Stop", () => { timerEnd = 0; tOut.textContent = "00:00"; document.title = "Time Machine // TRINKET LAB"; }, "ghost sm")), h("div.row.tight", ...[1, 3, 5, 10, 15, 20, 25, 30, 45, 60].map((m) => btn(m + "m", () => startTimer(m), "ghost sm"))))), card("Alarms", h("div.col", h("div.row", field("time", alarmTime), field("label", alarmLabel), btn("Add", () => { alarms.push({ time: alarmTime.value, label: alarmLabel.value, on: true }); renderAlarms(); }, "sm")), alarmList, h("p.hint", { text: "alarms ring while this tab is open (sound + notification)" })))); } },
      { id: "sleep", label: "Sleep", render: () => { calcSleep("wake"); return h("div.col", h("div.row", field("time", sleepAt), btn("I'm going to sleep at…", () => calcSleep("wake"), "sm"), btn("I need to wake at…", () => calcSleep("bed"), "sm")), sleepOut); } },
      { id: "now", label: "Now & Unix", render: () => h("div.split", card("Convert", h("div.col", tsIn, h("div.row", btn("now", () => { tsIn.value = String(Math.floor(Date.now() / 1000)); parseTs(); }, "ghost sm"), btn("now (ms)", () => { tsIn.value = String(Date.now()); parseTs(); }, "ghost sm"), btn("today 00:00", () => { const d = new Date(); d.setHours(0, 0, 0, 0); tsIn.value = d.toISOString(); parseTs(); }, "ghost sm")), tsOut)), card("Right now", nowBox)) },
      { id: "zones", label: "World clock", render: () => h("div.col", h("div.row", field("add zone", zoneSel), btn("add", () => addZone(zoneSel.value), "sm"), h("div", { style: { flex: 1, minWidth: "200px" } }, custom), btn("add custom", () => addZone(custom.value.trim()), "sm")), zoneBox) },
      { id: "diff", label: "Date maths", render: () => h("div.grid.g2", card("Difference", h("div.col", h("div.row", field("from", d1), field("to", d2)), diffOut)), card("Add / subtract", h("div.col", h("div.row", field("amount", addN), field("unit", addU)), addOut, h("p.hint", { text: "uses the 'from' date on the left" })))) },
      { id: "count", label: "Countdown", render: () => h("div.col", h("div.row", field("target", target), field("label", cdLabel)), cdOut) },
      { id: "sw", label: "Stopwatch", render: () => h("div.col", swOut, h("div.row", { style: { justifyContent: "center" } }, swToggle, btn("Lap", lap, "sm"), btn("Reset", () => { swAcc = 0; swRunning = false; laps = []; swToggle.textContent = "Start"; lapBox.replaceChildren(); store.set("time.swAcc", 0); }, "ghost sm danger")), lapBox) },
      { id: "pomo", label: "Pomodoro", render: () => h("div.col", { style: { alignItems: "center" } }, pPhase, pOut, h("div.row", pToggle, btn("Skip", () => { pomo.left = 1; }, "sm"), btn("Reset", pReset, "ghost sm"), field("focus min", pFocus), field("break min", pBreak))) },
      { id: "cron", label: "Cron", render: () => h("div.col", cronIn, cronPresets, cronOut, h("p.hint", { text: "min hour day month weekday · supports * , - / · next runs in your local time" })) },
    ], { remember: "time.tab" }));
    return () => { timers.forEach(clearInterval); document.title = "TRINKET LAB"; };
  },
});
