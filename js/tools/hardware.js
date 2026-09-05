import { h, defineTool, btn, card, toast, subtabs, field, select, seg, out, kv, input, navigate, download } from "../core.js";

defineTool({
  id: "hardware", name: "Hardware Test", icon: "🖥", cat: "web",
  desc: "Test your display (dead pixels, banding, refresh rate), camera, microphone, speakers and motion sensors.",
  tags: ["monitor test", "dead pixel", "screen test", "refresh rate", "hz", "webcam test", "camera test", "mic test", "microphone", "speaker test", "left right", "sensor", "gyroscope"],
  mount(root) {
    const cleanups = [];
    /* display */
    const COLORS = ["#ffffff", "#000000", "#ff0000", "#00ff00", "#0000ff", "#808080", "#ffff00", "#00ffff", "#ff00ff"];
    const fsTest = (mode) => {
      const el = h("div", { style: { position: "fixed", inset: 0, zIndex: 999, cursor: "pointer", background: "#fff" } });
      let i = 0;
      const paint = () => { if (mode === "colors") el.style.background = COLORS[i % COLORS.length]; else if (mode === "gradient") el.style.background = ["linear-gradient(90deg,#000,#fff)", "linear-gradient(90deg,#000,#f00)", "linear-gradient(90deg,#000,#0f0)", "linear-gradient(90deg,#000,#00f)", "radial-gradient(circle,#fff,#000)"][i % 5]; else if (mode === "checker") { const s = [2, 4, 8, 16, 32][i % 5]; el.style.background = `repeating-conic-gradient(#000 0 25%, #fff 0 50%) 0 0 / ${s * 2}px ${s * 2}px`; } else if (mode === "lines") { el.style.background = i % 2 ? "repeating-linear-gradient(90deg,#000 0 1px,#fff 1px 2px)" : "repeating-linear-gradient(0deg,#000 0 1px,#fff 1px 2px)"; } else if (mode === "sharp") el.style.background = `repeating-linear-gradient(45deg,#000 0 ${1 + (i % 4)}px,#fff 0 ${2 + (i % 4) * 2}px)`; };
      paint();
      const hint = h("div", { text: "click / tap to cycle · Esc to exit", style: { position: "absolute", bottom: "18px", left: "50%", transform: "translateX(-50%)", padding: "6px 12px", background: "rgba(0,0,0,.6)", color: "#fff", borderRadius: "8px", fontFamily: "monospace", fontSize: "12px", opacity: 0.8 } });
      el.append(hint); setTimeout(() => (hint.style.display = "none"), 3000);
      const close = () => { el.remove(); document.removeEventListener("keydown", onKey); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
      const onKey = (e) => { if (e.key === "Escape") close(); else { i++; paint(); } };
      el.addEventListener("click", () => { i++; paint(); });
      document.addEventListener("keydown", onKey);
      document.body.append(el);
      el.requestFullscreen?.().catch(() => {});
      cleanups.push(close);
    };
    const hzOut = h("div.out.big", { text: "—", style: { textAlign: "center" } });
    let hzRaf = 0;
    const measureHz = () => { cancelAnimationFrame(hzRaf); let frames = 0; const t0 = performance.now(); const tick = (t) => { frames++; if (t - t0 < 2000) hzRaf = requestAnimationFrame(tick); else { const hz = frames / ((t - t0) / 1000); hzOut.textContent = `${Math.round(hz)} Hz`; hzOut.append(h("div.hint", { text: `${frames} frames in ${((t - t0) / 1000).toFixed(2)}s · rAF-based, so a busy tab lowers it` })); } }; hzRaf = requestAnimationFrame(tick); };
    cleanups.push(() => cancelAnimationFrame(hzRaf));
    const motionBox = h("div", { style: { height: "80px", position: "relative", overflow: "hidden", borderRadius: "10px", background: "var(--bg-2)", border: "1px solid var(--line)" } }, h("div", { style: { position: "absolute", top: "20px", width: "40px", height: "40px", borderRadius: "8px", background: "var(--a1)", animation: "hw-slide 2s linear infinite" } }));
    const style = h("style", { text: "@keyframes hw-slide { from { left: 0 } to { left: calc(100% - 40px) } }" });

    /* camera */
    let camStream = null;
    const camVideo = h("video", { autoplay: true, playsinline: true, muted: true, style: { width: "100%", maxHeight: "360px", borderRadius: "12px", background: "#000" } });
    const camInfo = h("div.kv-list");
    const camSel = select([], { style: { width: "auto" } });
    const startCam = async () => { camStream?.getTracks().forEach((t) => t.stop()); try { camStream = await navigator.mediaDevices.getUserMedia({ video: camSel.value ? { deviceId: { exact: camSel.value }, width: { ideal: 1920 } } : { width: { ideal: 1920 } } }); camVideo.srcObject = camStream; const t = camStream.getVideoTracks()[0]; const s = t.getSettings(); camInfo.replaceChildren(kv("device", t.label), kv("resolution", `${s.width} × ${s.height}`), kv("frame rate", s.frameRate + " fps"), kv("facing", s.facingMode || "—"), kv("aspect", (s.aspectRatio || s.width / s.height).toFixed(3))); const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput"); camSel.replaceChildren(...devs.map((d) => h("option", { value: d.deviceId, text: d.label || "camera" }))); camSel.value = s.deviceId || ""; } catch (e) { toast("camera: " + e.message, "bad"); } };
    const camSnap = () => { const c = document.createElement("canvas"); c.width = camVideo.videoWidth; c.height = camVideo.videoHeight; c.getContext("2d").drawImage(camVideo, 0, 0); c.toBlob((b) => { window.__pendingFile = new File([b], "camera.png", { type: "image/png" }); navigate("image"); }); };
    cleanups.push(() => camStream?.getTracks().forEach((t) => t.stop()));

    /* mic */
    let micStream = null, micRaf = 0;
    const micCanvas = h("canvas", { width: 900, height: 160, style: { width: "100%", borderRadius: "10px", background: "var(--bg-2)", border: "1px solid var(--line)" } });
    const micLevel = h("div.bar", h("i"));
    const micInfo = h("div.kv-list");
    const micPeakEl = h("span.chip", { text: "peak —" });
    const startMic = async () => { micStream?.getTracks().forEach((t) => t.stop()); try { micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false } }); const ac = new (window.AudioContext || window.webkitAudioContext)(); const src = ac.createMediaStreamSource(micStream); const an = ac.createAnalyser(); an.fftSize = 2048; src.connect(an); const buf = new Uint8Array(an.fftSize); const freq = new Uint8Array(an.frequencyBinCount); const t = micStream.getAudioTracks()[0]; micInfo.replaceChildren(kv("device", t.label), kv("sample rate", ac.sampleRate + " Hz"), kv("channels", String(t.getSettings().channelCount || 1))); let peak = 0; const ctx = micCanvas.getContext("2d"); const loop = () => { an.getByteTimeDomainData(buf); an.getByteFrequencyData(freq); ctx.clearRect(0, 0, 900, 160); ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--a1"); ctx.beginPath(); let rms = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; rms += v * v; const x = (i / buf.length) * 900; i ? ctx.lineTo(x, 80 + v * 70) : ctx.moveTo(x, 80 + v * 70); } ctx.stroke(); ctx.fillStyle = "rgba(255,47,208,.5)"; for (let i = 0; i < 90; i++) { const v = freq[i * 2] / 255; ctx.fillRect(i * 10, 160 - v * 60, 8, v * 60); } rms = Math.sqrt(rms / buf.length); peak = Math.max(peak, rms); const db = 20 * Math.log10(rms || 1e-6); micLevel.firstChild.style.width = Math.min(100, Math.max(0, (db + 60) / 60 * 100)) + "%"; micPeakEl.textContent = `level ${db.toFixed(0)} dBFS · peak ${(20 * Math.log10(peak || 1e-6)).toFixed(0)} dBFS`; micRaf = requestAnimationFrame(loop); }; loop(); } catch (e) { toast("microphone: " + e.message, "bad"); } };
    cleanups.push(() => { micStream?.getTracks().forEach((t) => t.stop()); cancelAnimationFrame(micRaf); });

    /* speakers */
    let ac = null;
    const play = (pan, secs = 1.2, freq = 440) => { ac ||= new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(); const g = ac.createGain(); const p = ac.createStereoPanner(); o.frequency.value = freq; g.gain.setValueAtTime(0.3, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + secs); p.pan.value = pan; o.connect(g); g.connect(p); p.connect(ac.destination); o.start(); o.stop(ac.currentTime + secs); };
    const sweepPan = () => { ac ||= new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(); const g = ac.createGain(); const p = ac.createStereoPanner(); o.frequency.value = 330; g.gain.value = 0.25; p.pan.setValueAtTime(-1, ac.currentTime); p.pan.linearRampToValueAtTime(1, ac.currentTime + 3); p.pan.linearRampToValueAtTime(-1, ac.currentTime + 6); o.connect(g); g.connect(p); p.connect(ac.destination); o.start(); o.stop(ac.currentTime + 6); };
    const bass = () => { ac ||= new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(); const g = ac.createGain(); o.frequency.setValueAtTime(20, ac.currentTime); o.frequency.exponentialRampToValueAtTime(200, ac.currentTime + 5); g.gain.value = 0.4; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 5); };
    const outSel = select([], { style: { width: "auto" } });
    const listOuts = async () => { try { await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop())); } catch {} const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audiooutput"); outSel.replaceChildren(...devs.map((d) => h("option", { value: d.deviceId, text: d.label || "output" }))); if (!devs.length) toast("output selection not supported here"); };

    /* sensors */
    const sensorBox = h("div.kv-list");
    const onOrient = (e) => sensorBox.replaceChildren(kv("alpha (compass)", e.alpha?.toFixed(1) + "°"), kv("beta (front/back)", e.beta?.toFixed(1) + "°"), kv("gamma (left/right)", e.gamma?.toFixed(1) + "°"), kv("absolute", String(e.absolute)));
    const onMotion = (e) => { const a = e.accelerationIncludingGravity || {}; sensorBox.append(kv("accel x/y/z", `${a.x?.toFixed(2)} / ${a.y?.toFixed(2)} / ${a.z?.toFixed(2)} m/s²`), kv("rotation rate", `${e.rotationRate?.alpha?.toFixed(1)} / ${e.rotationRate?.beta?.toFixed(1)} / ${e.rotationRate?.gamma?.toFixed(1)}`)); };
    const startSensors = async () => { if (typeof DeviceOrientationEvent?.requestPermission === "function") { try { await DeviceOrientationEvent.requestPermission(); } catch { return toast("motion permission denied", "bad"); } } window.addEventListener("deviceorientation", onOrient); window.addEventListener("devicemotion", onMotion); sensorBox.replaceChildren(out("waiting for sensor events… (desktops usually have none)")); };
    cleanups.push(() => { window.removeEventListener("deviceorientation", onOrient); window.removeEventListener("devicemotion", onMotion); });

    root.append(style, subtabs([
      { id: "display", label: "Display", render: () => h("div.col",
          h("div.row", btn("Solid colours", () => fsTest("colors"), "primary sm"), btn("Gradients (banding)", () => fsTest("gradient"), "sm"), btn("Checkerboards", () => fsTest("checker"), "sm"), btn("1px lines", () => fsTest("lines"), "sm"), btn("Sharpness", () => fsTest("sharp"), "sm"), h("span.hint", { text: "runs fullscreen · click to cycle · Esc exits" })),
          h("div.grid.g2", card("Refresh rate", h("div.col", hzOut, btn("Measure (2s)", measureHz, "sm"))), card("Motion smoothness", h("div.col", motionBox, h("p.hint", { text: "the square should glide evenly; stutter = dropped frames" })))),
          h("div.kv-list", kv("screen", `${screen.width} × ${screen.height} @ ${devicePixelRatio}x`), kv("colour depth", screen.colorDepth + " bit"), kv("HDR", String(matchMedia("(dynamic-range: high)").matches)), kv("gamut", ["rec2020", "p3", "srgb"].find((g) => matchMedia(`(color-gamut: ${g})`).matches) || "?"))) },
      { id: "camera", label: "Camera", render: () => h("div.col", h("div.row", btn("▶ Start camera", startCam, "primary sm"), field("device", camSel), btn("📸 Snapshot → Image Forge", camSnap, "sm"), btn("■ Stop", () => { camStream?.getTracks().forEach((t) => t.stop()); camVideo.srcObject = null; }, "ghost sm")), camVideo, camInfo) },
      { id: "mic", label: "Microphone", render: () => h("div.col", h("div.row", btn("▶ Start mic", startMic, "primary sm"), btn("■ Stop", () => { micStream?.getTracks().forEach((t) => t.stop()); cancelAnimationFrame(micRaf); }, "ghost sm"), micPeakEl), micCanvas, micLevel, micInfo, h("p.hint", { text: "speak normally — the level should sit around −20 to −12 dBFS; solid green with no waveform means the wrong input is selected in your OS" })) },
      { id: "speakers", label: "Speakers", render: () => h("div.col", h("div.row", btn("◀ Left", () => play(-1), "sm"), btn("Center", () => play(0), "sm"), btn("Right ▶", () => play(1), "sm"), btn("Pan sweep L→R→L", sweepPan, "sm"), btn("Bass sweep 20–200 Hz", bass, "sm"), btn("High 12 kHz", () => play(0, 1, 12000), "sm"), btn("List outputs", listOuts, "ghost sm"), outSel), h("p.hint", { text: "If left and right sound swapped, check the OS balance or the cable. Use the Audio Bench for full tone control." })) },
      { id: "sensors", label: "Sensors", render: () => h("div.col", btn("Start motion sensors", startSensors, "sm"), sensorBox, h("p.hint", { text: "phones and tablets only; iOS asks for permission" })) },
    ], { remember: "hardware.tab" }));
    return () => cleanups.forEach((f) => f());
  },
});
