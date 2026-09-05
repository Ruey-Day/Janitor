import { h, defineTool, store, input, btn, card, toast, subtabs, field, select, seg, kv, out, textarea, copy } from "../core.js";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const freqOf = (midi) => 440 * 2 ** ((midi - 69) / 12);
const midiOf = (f) => Math.round(69 + 12 * Math.log2(f / 440));
const noteName = (midi) => NOTES[midi % 12] + (Math.floor(midi / 12) - 1);

defineTool({
  id: "audio", name: "Audio Bench", icon: "♫", cat: "misc",
  desc: "Tone generator, metronome, noise machine, chromatic tuner, text-to-speech and dictation.",
  tags: ["audio", "tone", "frequency", "metronome", "bpm", "tuner", "pitch", "noise", "white noise", "speech", "tts", "dictation", "speech to text", "transcribe", "hearing test", "sine"],
  mount(root) {
    let ac = null;
    const ctxGet = () => { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); return ac; };
    const cleanups = [];

    /* tone */
    const freq = input({ type: "number", value: store.get("audio.freq", 440), min: 20, max: 20000, step: 1, class: "mono", style: { width: "110px" } });
    const wave = select(["sine", "square", "sawtooth", "triangle"], { value: store.get("audio.wave", "sine"), style: { width: "auto" } });
    const vol = h("input", { type: "range", min: 0, max: 1, step: 0.01, value: 0.3 });
    const toneInfo = h("span.chip");
    let osc = null, gain = null;
    const toneBtn = btn("▶ Play", () => {
      if (osc) { osc.stop(); osc = null; toneBtn.textContent = "▶ Play"; return; }
      const c = ctxGet(); osc = c.createOscillator(); gain = c.createGain(); osc.type = wave.value; osc.frequency.value = +freq.value; gain.gain.value = +vol.value; osc.connect(gain); gain.connect(c.destination); osc.start(); toneBtn.textContent = "■ Stop";
    }, "primary sm");
    const updTone = () => { store.set("audio.freq", +freq.value); store.set("audio.wave", wave.value); if (osc) { osc.frequency.value = +freq.value; osc.type = wave.value; gain.gain.value = +vol.value; } const m = midiOf(+freq.value); toneInfo.textContent = `≈ ${noteName(m)} (${freqOf(m).toFixed(1)} Hz, ${((1200 * Math.log2(freq.value / freqOf(m)))).toFixed(0)} cents)`; };
    [freq, wave, vol].forEach((e) => e.addEventListener("input", updTone)); updTone();
    const sweep = () => { const c = ctxGet(); const o = c.createOscillator(); const g = c.createGain(); o.frequency.setValueAtTime(20, c.currentTime); o.frequency.exponentialRampToValueAtTime(20000, c.currentTime + 8); g.gain.value = 0.2; o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 8); toast("20 Hz → 20 kHz sweep (8s)"); };
    const piano = h("div.row.tight", ...Array.from({ length: 25 }, (_, i) => 48 + i).map((m) => btn(noteName(m), () => { const c = ctxGet(); const o = c.createOscillator(); const g = c.createGain(); o.frequency.value = freqOf(m); o.type = wave.value; g.gain.setValueAtTime(0.3, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.2); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 1.2); freq.value = freqOf(m).toFixed(2); updTone(); }, noteName(m).includes("#") ? "sm" : "ghost sm")));

    /* metronome */
    const bpm = input({ type: "number", value: store.get("audio.bpm", 100), min: 20, max: 300, class: "mono", style: { width: "90px" } });
    const beats = select([["4", "4/4"], ["3", "3/4"], ["2", "2/4"], ["6", "6/8"], ["1", "no accent"]], { style: { width: "auto" } });
    const beatDots = h("div.row.tight");
    let metTimer = null, beat = 0, nextTime = 0;
    const tick = () => { const c = ctxGet(); const per = 60 / +bpm.value; while (nextTime < c.currentTime + 0.15) { const o = c.createOscillator(); const g = c.createGain(); const accent = beat % +beats.value === 0; o.frequency.value = accent ? 1400 : 900; g.gain.setValueAtTime(accent ? 0.5 : 0.3, nextTime); g.gain.exponentialRampToValueAtTime(0.001, nextTime + 0.06); o.connect(g); g.connect(c.destination); o.start(nextTime); o.stop(nextTime + 0.07); const b = beat; setTimeout(() => { [...beatDots.children].forEach((d, i) => d.classList.toggle("hit", i === b % +beats.value)); }, Math.max(0, (nextTime - c.currentTime) * 1000)); nextTime += per; beat++; } };
    const renderDots = () => beatDots.replaceChildren(...Array.from({ length: +beats.value }, (_, i) => h("span.keycap", { text: String(i + 1) })));
    beats.addEventListener("change", renderDots); renderDots();
    bpm.addEventListener("input", () => store.set("audio.bpm", +bpm.value));
    const metBtn = btn("▶ Start", () => { if (metTimer) { clearInterval(metTimer); metTimer = null; metBtn.textContent = "▶ Start"; return; } const c = ctxGet(); beat = 0; nextTime = c.currentTime + 0.05; metTimer = setInterval(tick, 50); metBtn.textContent = "■ Stop"; }, "primary sm");
    let taps = [];
    const tap = btn("Tap tempo", () => { const now = Date.now(); taps = taps.filter((t) => now - t < 3000); taps.push(now); if (taps.length > 1) { const avg = (taps.at(-1) - taps[0]) / (taps.length - 1); bpm.value = Math.round(60000 / avg); store.set("audio.bpm", +bpm.value); } }, "sm");

    /* noise */
    let noiseSrc = null;
    const noiseType = seg([["white", "white"], ["pink", "pink"], ["brown", "brown"]], null, "pink");
    const noiseVol = h("input", { type: "range", min: 0, max: 1, step: 0.01, value: 0.25 });
    let noiseGain = null;
    const noiseBtn = btn("▶ Play", () => {
      if (noiseSrc) { noiseSrc.stop(); noiseSrc = null; noiseBtn.textContent = "▶ Play"; return; }
      const c = ctxGet(); const len = c.sampleRate * 4; const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (noiseType.value === "white") d[i] = w; else if (noiseType.value === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; } }
      noiseSrc = c.createBufferSource(); noiseSrc.buffer = buf; noiseSrc.loop = true; noiseGain = c.createGain(); noiseGain.gain.value = +noiseVol.value; noiseSrc.connect(noiseGain); noiseGain.connect(c.destination); noiseSrc.start(); noiseBtn.textContent = "■ Stop";
    }, "primary sm");
    noiseVol.addEventListener("input", () => noiseGain && (noiseGain.gain.value = +noiseVol.value));

    /* tuner */
    const tunerOut = h("div.out.big", { style: { textAlign: "center", fontSize: "34px" }, text: "—" });
    const tunerBar = h("div.bar", { style: { position: "relative" } }, h("i", { style: { width: "50%" } }));
    const tunerInfo = h("div.row", { style: { justifyContent: "center" } });
    let stream = null, raf = null;
    const tunerBtn = btn("🎤 Start tuner", async () => {
      if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; cancelAnimationFrame(raf); tunerBtn.textContent = "🎤 Start tuner"; return; }
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } }); } catch { return toast("microphone blocked", "bad"); }
      const c = ctxGet(); const src = c.createMediaStreamSource(stream); const an = c.createAnalyser(); an.fftSize = 4096; src.connect(an); const buf = new Float32Array(an.fftSize);
      tunerBtn.textContent = "■ Stop tuner";
      const loop = () => {
        an.getFloatTimeDomainData(buf);
        let rms = 0; for (const v of buf) rms += v * v; rms = Math.sqrt(rms / buf.length);
        if (rms > 0.01) {
          // autocorrelation pitch detection
          const SIZE = buf.length; let best = -1, bestCorr = 0;
          for (let lag = Math.floor(c.sampleRate / 1000); lag < Math.floor(c.sampleRate / 60); lag++) { let corr = 0; for (let i = 0; i < SIZE - lag; i++) corr += buf[i] * buf[i + lag]; corr /= SIZE - lag; if (corr > bestCorr) { bestCorr = corr; best = lag; } }
          if (best > 0 && bestCorr > 0.001) { const f = c.sampleRate / best; const m = midiOf(f); const cents = 1200 * Math.log2(f / freqOf(m)); tunerOut.textContent = noteName(m); tunerOut.style.color = Math.abs(cents) < 6 ? "var(--lime)" : "var(--text-hi)"; tunerBar.firstChild.style.width = 50 + cents + "%"; tunerInfo.replaceChildren(h("span.chip", { text: f.toFixed(1) + " Hz" }), h("span.chip", { class: Math.abs(cents) < 6 ? "ok" : "warn", text: (cents > 0 ? "+" : "") + cents.toFixed(0) + " cents" }), h("span.chip", { text: "level " + Math.round(rms * 100) })); }
        }
        raf = requestAnimationFrame(loop);
      };
      loop();
    }, "primary sm");

    /* tts */
    const ttsText = h("textarea", { placeholder: "text to speak…", style: { minHeight: "90px" } });
    const voices = select([], { style: { maxWidth: "280px" } });
    const rate = h("input", { type: "range", min: 0.5, max: 2, step: 0.1, value: 1 }), pitch = h("input", { type: "range", min: 0, max: 2, step: 0.1, value: 1 });
    const loadVoices = () => { const vs = speechSynthesis?.getVoices() || []; voices.replaceChildren(...vs.map((v, i) => h("option", { value: i, text: `${v.name} (${v.lang})` }))); };
    if ("speechSynthesis" in window) { loadVoices(); speechSynthesis.addEventListener("voiceschanged", loadVoices); }
    const speak = () => { if (!("speechSynthesis" in window)) return toast("speech synthesis unsupported", "bad"); speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(ttsText.value); const vs = speechSynthesis.getVoices(); if (vs[voices.value]) u.voice = vs[voices.value]; u.rate = +rate.value; u.pitch = +pitch.value; speechSynthesis.speak(u); };

    /* dictation (Web Speech API) */
    let recog = null;
    const dictOut = textarea({ placeholder: "transcript appears here…", style: { minHeight: "160px" } });
    const dictStatus = h("span.chip", { text: "idle" });
    const dictLang = select([["en-US", "English (US)"], ["en-GB", "English (UK)"], ["es-ES", "Spanish"], ["fr-FR", "French"], ["de-DE", "German"], ["it-IT", "Italian"], ["pt-BR", "Portuguese"], ["ja-JP", "Japanese"], ["zh-CN", "Chinese"], ["ko-KR", "Korean"], ["hi-IN", "Hindi"]], { style: { width: "auto" } });
    const dictStart = () => { const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return toast("speech recognition unavailable in this browser (Chrome / Safari support it)", "bad"); recog?.stop(); recog = new SR(); recog.lang = dictLang.value; recog.continuous = true; recog.interimResults = true; let finalText = dictOut.value; recog.onresult = (e) => { let interim = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) finalText += (finalText && !finalText.endsWith(" ") ? " " : "") + t.trim(); else interim += t; } dictOut.value = finalText + (interim ? " " + interim : ""); }; recog.onerror = (e) => { dictStatus.textContent = "error: " + e.error; }; recog.onend = () => { dictStatus.textContent = "stopped"; }; recog.start(); dictStatus.textContent = "● listening"; };
    cleanups.push(() => recog?.stop());

    root.append(subtabs([
      { id: "tone", label: "Tone", render: () => h("div.col", h("div.row", field("frequency Hz", freq), field("wave", wave), field("volume", h("div", { style: { width: "140px" } }, vol)), toneBtn, btn("Sweep 20→20k", sweep, "ghost sm"), toneInfo), h("span.label", { text: "keyboard (C3–C5)" }), piano, h("p.hint", { text: "Hearing check: most adults lose sensitivity above ~15 kHz. Keep the volume modest." })) },
      { id: "met", label: "Metronome", render: () => h("div.col", { style: { alignItems: "center" } }, beatDots, h("div.row", field("BPM", bpm), field("meter", beats), metBtn, tap), h("div.row.tight", ...[60, 80, 100, 120, 140, 160, 180].map((b) => btn(String(b), () => { bpm.value = b; store.set("audio.bpm", b); }, "ghost sm")))) },
      { id: "noise", label: "Noise", render: () => h("div.col", h("div.row", noiseType, field("volume", h("div", { style: { width: "160px" } }, noiseVol)), noiseBtn), h("p.hint", { text: "Pink noise for focus and sleep, brown for a deeper rumble, white for masking." })) },
      { id: "tuner", label: "Tuner", render: () => h("div.col", { style: { alignItems: "center" } }, tunerOut, h("div", { style: { width: "min(420px, 100%)" } }, tunerBar), tunerInfo, tunerBtn, h("p.hint", { text: "Autocorrelation pitch detection, A4 = 440 Hz. Audio never leaves your device." })) },
      { id: "dict", label: "Dictation", render: () => h("div.col", h("div.row", btn("🎤 Start dictation", dictStart, "primary sm"), btn("■ Stop", () => recog?.stop(), "ghost sm"), field("language", dictLang), dictStatus, btn("Copy", () => copy(dictOut.value), "ghost sm"), btn("Clear", () => (dictOut.value = ""), "ghost sm danger")), dictOut, h("p.hint", { text: "Uses the browser's built-in speech recognition. In Chrome the audio is processed by Google's speech service — the one feature here that isn't strictly local." })) },
      { id: "tts", label: "Speech", render: () => h("div.col", ttsText, h("div.row", field("voice", voices), field("rate", h("div", { style: { width: "120px" } }, rate)), field("pitch", h("div", { style: { width: "120px" } }, pitch)), btn("🔊 Speak", speak, "primary sm"), btn("Stop", () => speechSynthesis?.cancel(), "ghost sm"))) },
    ], { remember: "audio.tab" }));
    return () => { osc?.stop(); noiseSrc?.stop(); if (metTimer) clearInterval(metTimer); stream?.getTracks().forEach((t) => t.stop()); cancelAnimationFrame(raf); speechSynthesis?.cancel(); cleanups.forEach((f) => f()); };
  },
});
