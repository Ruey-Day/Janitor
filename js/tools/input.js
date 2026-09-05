import { h, defineTool, btn, card, copy, subtabs, kv, out, tbl } from "../core.js";

defineTool({
  id: "input", name: "Input Tester", icon: "⌨", cat: "web",
  desc: "Keyboard key codes, mouse buttons & position, gamepad state, touch points, and typing speed.",
  tags: ["keyboard", "keycode", "key", "mouse", "gamepad", "controller", "touch", "typing test", "wpm", "click test"],
  mount(root) {
    const timers = [];
    /* keyboard */
    const keyBox = h("div.kv-list");
    const keyLog = h("div.row.tight");
    const held = new Set();
    const heldBox = h("div.row.tight");
    const onKey = (e) => {
      if (tabs.value !== "keys") return;
      if (!/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault();
      if (e.type === "keydown") held.add(e.code); else held.delete(e.code);
      heldBox.replaceChildren(...[...held].map((c) => h("span.keycap.hit", { text: c })));
      if (e.type !== "keydown") return;
      keyBox.replaceChildren(kv("key", e.key === " " ? "Space" : e.key), kv("code", e.code), kv("keyCode (legacy)", e.keyCode), kv("which", e.which), kv("location", ["standard", "left", "right", "numpad"][e.location]), kv("repeat", e.repeat), kv("modifiers", [e.ctrlKey && "Ctrl", e.shiftKey && "Shift", e.altKey && "Alt", e.metaKey && "Meta"].filter(Boolean).join(" + ") || "none"), kv("char code", e.key.length === 1 ? "U+" + e.key.codePointAt(0).toString(16).toUpperCase().padStart(4, "0") : "—"));
      keyLog.prepend(h("span.keycap", { text: e.key === " " ? "␣" : e.key }));
      while (keyLog.children.length > 24) keyLog.lastChild.remove();
    };
    document.addEventListener("keydown", onKey); document.addEventListener("keyup", onKey);

    /* mouse */
    const mouseBox = h("div.kv-list");
    const pad = h("div", { style: { height: "220px", border: "1px dashed var(--line-2)", borderRadius: "12px", display: "grid", placeItems: "center", color: "var(--muted)", fontFamily: "var(--mono)", fontSize: "12px", userSelect: "none" }, text: "move · click · scroll · double-click here" });
    let clicks = 0, cps = [], dbl = 0;
    const paint = (e, extra = {}) => { const r = pad.getBoundingClientRect(); mouseBox.replaceChildren(kv("page", `${e.pageX}, ${e.pageY}`), kv("client", `${e.clientX}, ${e.clientY}`), kv("in pad", `${Math.round(e.clientX - r.left)}, ${Math.round(e.clientY - r.top)}`), kv("buttons mask", e.buttons), kv("button", ["left", "middle", "right", "back", "forward"][e.button] ?? e.button), kv("movement", `${e.movementX}, ${e.movementY}`), kv("pointer type", e.pointerType || "mouse"), kv("pressure", e.pressure?.toFixed(2) ?? "—"), kv("clicks", clicks), kv("double clicks", dbl), kv("clicks / sec (last 1s)", cps.filter((t) => Date.now() - t < 1000).length), ...Object.entries(extra).map(([k, v]) => kv(k, v))); };
    pad.addEventListener("pointermove", (e) => paint(e)); pad.addEventListener("pointerdown", (e) => { clicks++; cps.push(Date.now()); cps = cps.slice(-30); paint(e); }); pad.addEventListener("dblclick", (e) => { dbl++; paint(e); });
    pad.addEventListener("wheel", (e) => { e.preventDefault(); paint(e, { "wheel Δ": `${e.deltaX}, ${e.deltaY}`, "delta mode": ["pixel", "line", "page"][e.deltaMode] }); }, { passive: false });
    pad.addEventListener("contextmenu", (e) => e.preventDefault());

    /* touch */
    const touchBox = h("div.kv-list");
    const touchPad = h("div", { style: { height: "220px", border: "1px dashed var(--line-2)", borderRadius: "12px", display: "grid", placeItems: "center", color: "var(--muted)", fontFamily: "var(--mono)", fontSize: "12px", touchAction: "none" }, text: "touch here (multi-touch supported)" });
    const touchHandler = (e) => { e.preventDefault(); const ts = [...e.touches]; touchBox.replaceChildren(kv("touches", ts.length), kv("max touch points", navigator.maxTouchPoints), ...ts.map((t, i) => kv(`#${i} x,y`, `${Math.round(t.clientX)}, ${Math.round(t.clientY)} · r ${Math.round(t.radiusX || 0)} · f ${t.force?.toFixed(2) ?? "—"}`))); };
    ["touchstart", "touchmove", "touchend"].forEach((ev) => touchPad.addEventListener(ev, touchHandler, { passive: false }));

    /* gamepad */
    const gpBox = h("div");
    const pollGp = () => { const gps = [...(navigator.getGamepads?.() || [])].filter(Boolean); if (!gps.length) return gpBox.replaceChildren(out("connect a gamepad and press any button")); gpBox.replaceChildren(...gps.map((g) => card(`${g.id} (index ${g.index})`, h("div.col", h("div.row.tight", ...g.buttons.map((b, i) => h("span.keycap", { class: b.pressed ? "hit" : "", text: `B${i}${b.value && b.value < 1 ? " " + b.value.toFixed(2) : ""}` }))), h("div.kv-list", ...g.axes.map((a, i) => h("div.kv", h("b", { text: "axis " + i }), h("span", h("div.bar", { style: { width: "160px", display: "inline-block", verticalAlign: "middle", marginRight: "8px" } }, h("i", { style: { width: (a + 1) / 2 * 100 + "%" } })), a.toFixed(3))))))))); };
    timers.push(setInterval(() => { if (tabs.value === "gamepad") pollGp(); }, 100));

    /* typing test */
    const SENT = ["The quick brown fox jumps over the lazy dog while the band plays on.", "Simplicity is the ultimate sophistication, or so the old designer said.", "Every tool in this lab runs inside your browser and never phones home.", "Programs must be written for people to read, and only incidentally for machines to execute.", "A journey of a thousand miles begins with a single keystroke on a Tuesday."];
    let sentence = SENT[Math.floor(Math.random() * SENT.length)], tStart = 0;
    const target = h("div.out", { text: sentence, style: { fontSize: "15px" } });
    const typed = h("textarea", { placeholder: "start typing the sentence above…", style: { minHeight: "80px" }, spellcheck: "false" });
    const typeStats = h("div.row.tight");
    typed.addEventListener("input", () => { if (!tStart) tStart = Date.now(); const v = typed.value; const mins = (Date.now() - tStart) / 60000; const correct = [...v].filter((c, i) => c === sentence[i]).length; const wpm = mins > 0 ? Math.round((v.length / 5) / mins) : 0; const acc = v.length ? Math.round(correct / v.length * 100) : 100; typeStats.replaceChildren(h("span.chip", { text: wpm + " wpm" }), h("span.chip", { class: acc > 95 ? "ok" : acc > 85 ? "warn" : "bad", text: acc + "% accuracy" }), h("span.chip", { text: `${v.length}/${sentence.length}` })); if (v === sentence) { typeStats.append(h("span.chip.ok", { text: "done ✓" })); } });
    const resetType = () => { sentence = SENT[Math.floor(Math.random() * SENT.length)]; target.textContent = sentence; typed.value = ""; tStart = 0; typeStats.replaceChildren(); typed.focus(); };

    const tabs = subtabs([
      { id: "keys", label: "Keyboard", render: () => h("div.col", h("p.hint", { text: "press any key — default actions are suppressed while this tab is open" }), heldBox, keyBox, keyLog) },
      { id: "mouse", label: "Mouse", render: () => h("div.col", pad, mouseBox) },
      { id: "touch", label: "Touch", render: () => h("div.col", touchPad, touchBox) },
      { id: "gamepad", label: "Gamepad", render: () => { pollGp(); return gpBox; } },
      { id: "typing", label: "Typing speed", render: () => h("div.col", target, typed, h("div.row", typeStats, btn("new sentence", resetType, "ghost sm"))) },
    ], { remember: "input.tab" });
    root.append(tabs);
    return () => { timers.forEach(clearInterval); document.removeEventListener("keydown", onKey); document.removeEventListener("keyup", onKey); };
  },
});
