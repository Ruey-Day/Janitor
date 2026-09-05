import { h, defineTool, input, btn, card, toast, subtabs, field, select, kv, download, bytes, dropzone, navigate } from "../core.js";
import { encodeGIF } from "../lib/gif.js";

const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${String(Math.floor((s % 1) * 10))}`;
function wavEncode(channels, sampleRate) {
  const n = channels[0].length, nc = channels.length;
  const buf = new ArrayBuffer(44 + n * nc * 2), dv = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); dv.setUint32(4, 36 + n * nc * 2, true); str(8, "WAVE"); str(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, nc, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * nc * 2, true); dv.setUint16(32, nc * 2, true); dv.setUint16(34, 16, true); str(36, "data"); dv.setUint32(40, n * nc * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) { const v = Math.max(-1, Math.min(1, channels[c][i])); dv.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2; }
  return new Blob([buf], { type: "audio/wav" });
}
const AC = () => new (window.AudioContext || window.webkitAudioContext)();

defineTool({
  id: "media", name: "Media Tools", icon: "🎞", cat: "media",
  desc: "Video → GIF / frames / audio, audio trim & convert to WAV, record screen / mic / camera, images → GIF.",
  tags: ["video", "gif", "convert", "mp4 to gif", "extract audio", "audio trim", "wav", "mp3", "screen recorder", "record", "webcam", "microphone", "frames", "animated gif"],
  mount(root) {
    const cleanups = [];

    /* ── video ── */
    let vfile = null;
    const video = h("video", { controls: true, playsinline: true, style: { width: "100%", maxHeight: "360px", borderRadius: "12px", background: "#000" } });
    const vInfo = h("div.kv-list");
    const gStart = input({ type: "number", value: 0, step: 0.1, class: "mono", style: { width: "90px" } });
    const gEnd = input({ type: "number", value: 3, step: 0.1, class: "mono", style: { width: "90px" } });
    const gFps = input({ type: "number", value: 10, min: 1, max: 30, class: "mono", style: { width: "80px" } });
    const gWidth = input({ type: "number", value: 480, min: 16, class: "mono", style: { width: "90px" } });
    const gStatus = h("span.chip");
    const loadVideo = (fl) => {
      vfile = fl[0]; video.src = URL.createObjectURL(vfile);
      video.onloadedmetadata = () => { vInfo.replaceChildren(kv("file", vfile.name), kv("size", bytes(vfile.size)), kv("type", vfile.type || "?"), kv("duration", fmtT(video.duration)), kv("dimensions", `${video.videoWidth} × ${video.videoHeight}`), kv("bitrate", Math.round((vfile.size * 8) / video.duration / 1000) + " kb/s")); gEnd.value = Math.min(3, video.duration).toFixed(1); };
    };
    const seek = (t) => new Promise((r) => { video.onseeked = () => r(); video.currentTime = t; });
    const frameCanvas = (w) => { const k = w / video.videoWidth; const c = document.createElement("canvas"); c.width = Math.round(w); c.height = Math.round(video.videoHeight * k); c.getContext("2d").drawImage(video, 0, 0, c.width, c.height); return c; };
    const snap = () => { if (!vfile) return toast("load a video", "bad"); frameCanvas(video.videoWidth).toBlob((b) => download(b, `frame-${video.currentTime.toFixed(2)}.png`)); };
    const toForge = () => { if (!vfile) return; frameCanvas(video.videoWidth).toBlob((b) => { window.__pendingFile = new File([b], "frame.png", { type: "image/png" }); navigate("image"); }); };
    const makeGif = async () => {
      if (!vfile) return toast("load a video", "bad");
      const s = +gStart.value, e = Math.min(+gEnd.value, video.duration), fps = +gFps.value, w = +gWidth.value;
      if (e <= s) return toast("end must be after start", "bad");
      const n = Math.min(300, Math.floor((e - s) * fps));
      video.pause(); const frames = [];
      for (let i = 0; i < n; i++) { await seek(s + i / fps); const c = frameCanvas(w); frames.push(c.getContext("2d").getImageData(0, 0, c.width, c.height)); gStatus.textContent = `capturing ${i + 1}/${n}`; }
      gStatus.textContent = "encoding…"; await new Promise((r) => setTimeout(r, 30));
      const gif = encodeGIF(frames, { delay: 1000 / fps });
      download(new Blob([gif], { type: "image/gif" }), vfile.name.replace(/\.\w+$/, "") + ".gif");
      gStatus.textContent = `${n} frames · ${bytes(gif.length)}`;
    };
    const extractAudio = async () => {
      if (!vfile) return toast("load a video", "bad");
      gStatus.textContent = "decoding audio…";
      try { const buf = await AC().decodeAudioData(await vfile.arrayBuffer()); const ch = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i)); download(wavEncode(ch, buf.sampleRate), vfile.name.replace(/\.\w+$/, "") + ".wav"); gStatus.textContent = "done"; }
      catch (e) { gStatus.textContent = ""; toast("could not decode audio from this container: " + e.message, "bad"); }
    };
    const contactSheet = async () => {
      if (!vfile) return toast("load a video", "bad");
      const n = 8, w = 240, cells = [];
      for (let i = 0; i < n; i++) { await seek((video.duration * (i + 0.5)) / n); cells.push(frameCanvas(w)); }
      const c = document.createElement("canvas"); c.width = w * 4; c.height = cells[0].height * 2; const cx = c.getContext("2d");
      cells.forEach((f, i) => cx.drawImage(f, (i % 4) * w, Math.floor(i / 4) * f.height));
      c.toBlob((b) => download(b, "contact-sheet.png"));
    };

    /* ── audio ── */
    let abuf = null, afile = null;
    const wave = h("canvas", { width: 900, height: 140, style: { width: "100%", borderRadius: "10px", background: "var(--bg-2)", border: "1px solid var(--line)" } });
    const aInfo = h("div.kv-list");
    const aStart = input({ type: "number", value: 0, step: 0.01, class: "mono", style: { width: "100px" } });
    const aEnd = input({ type: "number", value: 0, step: 0.01, class: "mono", style: { width: "100px" } });
    const gain = input({ type: "number", value: 1, step: 0.1, class: "mono", style: { width: "80px" } });
    const fadeIn = input({ type: "number", value: 0, step: 0.1, class: "mono", style: { width: "80px" } });
    const fadeOut = input({ type: "number", value: 0, step: 0.1, class: "mono", style: { width: "80px" } });
    const speed = select([["1", "1×"], ["0.5", "0.5×"], ["0.75", "0.75×"], ["1.25", "1.25×"], ["1.5", "1.5×"], ["2", "2×"]], { style: { width: "auto" } });
    const mono = h("input", { type: "checkbox" }), reverse = h("input", { type: "checkbox" }), normalize = h("input", { type: "checkbox" });
    const player = h("audio", { controls: true, style: { width: "100%" } });
    const drawWave = () => {
      if (!abuf) return;
      const ctx = wave.getContext("2d"); ctx.clearRect(0, 0, wave.width, wave.height);
      const d = abuf.getChannelData(0), step = Math.ceil(d.length / wave.width);
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--a1");
      for (let x = 0; x < wave.width; x++) { let mn = 1, mx = -1; for (let j = 0; j < step; j++) { const v = d[x * step + j] || 0; if (v < mn) mn = v; if (v > mx) mx = v; } ctx.fillRect(x, (1 + mn) * 70, 1, Math.max(1, (mx - mn) * 70)); }
      const s = (+aStart.value / abuf.duration) * wave.width, e = (+aEnd.value / abuf.duration) * wave.width;
      ctx.fillStyle = "rgba(255,47,208,.18)"; ctx.fillRect(s, 0, Math.max(1, e - s), wave.height);
    };
    const loadAudio = async (fl) => {
      afile = fl[0];
      try { abuf = await AC().decodeAudioData(await afile.arrayBuffer()); aInfo.replaceChildren(kv("file", afile.name), kv("size", bytes(afile.size)), kv("duration", fmtT(abuf.duration)), kv("sample rate", abuf.sampleRate + " Hz"), kv("channels", String(abuf.numberOfChannels)), kv("bitrate", Math.round((afile.size * 8) / abuf.duration / 1000) + " kb/s")); aStart.value = 0; aEnd.value = abuf.duration.toFixed(2); player.src = URL.createObjectURL(afile); drawWave(); }
      catch (e) { toast("cannot decode: " + e.message, "bad"); }
    };
    [aStart, aEnd].forEach((i) => i.addEventListener("input", drawWave));
    wave.addEventListener("click", (e) => { if (!abuf) return; const t = ((e.offsetX / wave.clientWidth) * abuf.duration).toFixed(2); if (e.shiftKey) aEnd.value = t; else aStart.value = t; drawWave(); });
    const processAudio = () => {
      if (!abuf) return null;
      const sr = abuf.sampleRate, s = Math.floor(+aStart.value * sr), e = Math.min(abuf.length, Math.floor(+aEnd.value * sr));
      let chans = Array.from({ length: abuf.numberOfChannels }, (_, i) => abuf.getChannelData(i).slice(s, e));
      if (mono.checked && chans.length > 1) { const m = new Float32Array(chans[0].length); for (let i = 0; i < m.length; i++) m[i] = chans.reduce((a, c) => a + c[i], 0) / chans.length; chans = [m]; }
      const sp = +speed.value;
      if (sp !== 1) chans = chans.map((c) => { const n = Math.floor(c.length / sp); const o = new Float32Array(n); for (let i = 0; i < n; i++) { const p = i * sp, k = Math.floor(p), f = p - k; o[i] = c[k] * (1 - f) + (c[k + 1] || 0) * f; } return o; });
      const g = +gain.value; let peak = 0; chans.forEach((c) => { for (const v of c) peak = Math.max(peak, Math.abs(v)); });
      const ng = normalize.checked && peak > 0 ? 0.98 / peak : 1;
      const fi = +fadeIn.value * sr, fo = +fadeOut.value * sr;
      chans = chans.map((c) => { const n = c.length; const o = new Float32Array(n); for (let i = 0; i < n; i++) { let v = c[i] * g * ng; if (i < fi) v *= i / fi; if (i > n - fo) v *= (n - i) / fo; o[i] = v; } return reverse.checked ? o.reverse() : o; });
      return { chans, sr };
    };
    const exportWav = () => { const r = processAudio(); if (!r) return toast("load audio", "bad"); download(wavEncode(r.chans, r.sr), (afile.name.replace(/\.\w+$/, "") || "audio") + "-edit.wav"); };
    const previewEdit = () => { const r = processAudio(); if (!r) return; player.src = URL.createObjectURL(wavEncode(r.chans, r.sr)); player.play(); };

    /* ── recorder ── */
    let rec = null, stream = null, chunks = [], recStart = 0, recTimer = null;
    const recVideo = h("video", { autoplay: true, muted: true, playsinline: true, style: { width: "100%", maxHeight: "320px", borderRadius: "12px", background: "#000" } });
    const recStatus = h("span.chip", { text: "idle" });
    const recMic = h("input", { type: "checkbox", checked: true });
    const recResult = h("div.col");
    const stopAll = () => { if (rec && rec.state !== "inactive") rec.stop(); stream?.getTracks().forEach((t) => t.stop()); stream = null; clearInterval(recTimer); };
    const startRec = async (kind) => {
      stopAll(); chunks = [];
      try {
        if (kind === "screen") { stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true }); if (recMic.checked) { try { const mic = await navigator.mediaDevices.getUserMedia({ audio: true }); mic.getAudioTracks().forEach((t) => stream.addTrack(t)); } catch {} } }
        else if (kind === "camera") stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 } }, audio: recMic.checked });
        else stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) { return toast("permission denied or unsupported: " + e.message, "bad"); }
      recVideo.srcObject = kind === "mic" ? null : stream; recVideo.hidden = kind === "mic";
      const mime = ["video/webm;codecs=vp9,opus", "video/webm", "video/mp4", "audio/webm", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m) && (kind !== "mic" || m.startsWith("audio")));
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: rec.mimeType }); const url = URL.createObjectURL(blob);
        const ext = rec.mimeType.includes("mp4") ? "mp4" : rec.mimeType.includes("ogg") ? "ogg" : "webm";
        recResult.replaceChildren(kind === "mic" ? h("audio", { controls: true, src: url, style: { width: "100%" } }) : h("video", { controls: true, src: url, style: { width: "100%", maxHeight: "320px", borderRadius: "12px" } }),
          h("div.row", h("span.chip", { text: bytes(blob.size) }), btn("↓ Download", () => download(blob, `recording-${Date.now()}.${ext}`), "primary sm")));
        recStatus.textContent = "stopped"; stream?.getTracks().forEach((t) => t.stop());
      };
      stream.getVideoTracks()[0]?.addEventListener("ended", () => rec.state !== "inactive" && rec.stop());
      rec.start(250); recStart = Date.now();
      recTimer = setInterval(() => (recStatus.textContent = `● recording ${fmtT((Date.now() - recStart) / 1000)}`), 200);
    };
    cleanups.push(stopAll);

    /* ── images → gif ── */
    let gifImgs = [];
    const giList = h("div.row.tight");
    const giDelay = input({ type: "number", value: 500, min: 20, class: "mono", style: { width: "90px" } });
    const giWidth = input({ type: "number", value: 400, class: "mono", style: { width: "90px" } });
    const giStatus = h("span.chip");
    const renderGi = () => giList.replaceChildren(...gifImgs.map((f, i) => h("div.col", { style: { alignItems: "center", gap: "2px" } }, h("img", { src: URL.createObjectURL(f), style: { height: "70px", borderRadius: "6px" } }), btn("✕", () => { gifImgs.splice(i, 1); renderGi(); }, "ghost sm"))));
    const buildGi = async () => {
      if (gifImgs.length < 1) return toast("add images", "bad");
      const w = +giWidth.value;
      const bmps = await Promise.all(gifImgs.map((f) => createImageBitmap(f)));
      const hgt = Math.round((bmps[0].height / bmps[0].width) * w);
      const frames = bmps.map((b) => { const c = document.createElement("canvas"); c.width = w; c.height = hgt; const cx = c.getContext("2d"); cx.fillStyle = "#000"; cx.fillRect(0, 0, w, hgt); const k = Math.min(w / b.width, hgt / b.height); cx.drawImage(b, (w - b.width * k) / 2, (hgt - b.height * k) / 2, b.width * k, b.height * k); return cx.getImageData(0, 0, w, hgt); });
      const gif = encodeGIF(frames, { delay: +giDelay.value });
      download(new Blob([gif], { type: "image/gif" }), "animation.gif");
      giStatus.textContent = `${frames.length} frames · ${bytes(gif.length)}`;
    };

    root.append(subtabs([
      { id: "video", label: "Video", render: () => h("div.col", dropzone("Drop a video (mp4 / webm / mov)", loadVideo, { accept: "video/*", multiple: false }), video, vInfo,
          h("div.row", btn("📸 Snapshot PNG", snap, "sm"), btn("Frame → Image Forge", toForge, "sm"), btn("Contact sheet", contactSheet, "sm"), btn("Extract audio → WAV", extractAudio, "sm")),
          card("Video → GIF", h("div.col", h("div.row", field("start s", gStart), field("end s", gEnd), field("fps", gFps), field("width px", gWidth), btn("Make GIF", makeGif, "primary sm"), gStatus), h("p.hint", { text: "Frames are captured by seeking, so it runs slower than real time. Max 300 frames." })))) },
      { id: "audio", label: "Audio", render: () => h("div.col", dropzone("Drop an audio (or video) file", loadAudio, { accept: "audio/*,video/*", multiple: false }), aInfo, wave, h("p.hint", { text: "click the waveform to set start · shift-click to set end" }),
          h("div.row", field("start s", aStart), field("end s", aEnd), field("gain", gain), field("fade in s", fadeIn), field("fade out s", fadeOut), field("speed", speed), h("label.check", mono, "mono"), h("label.check", reverse, "reverse"), h("label.check", normalize, "normalise")),
          h("div.row", btn("▶ Preview edit", previewEdit, "sm"), btn("↓ Export WAV", exportWav, "primary sm")), player, h("p.hint", { text: "Output is 16-bit PCM WAV (lossless). Browsers cannot write MP3/M4A natively." })) },
      { id: "rec", label: "Record", render: () => h("div.col", h("div.row", btn("🖥 Screen", () => startRec("screen"), "primary sm"), btn("📷 Camera", () => startRec("camera"), "sm"), btn("🎤 Mic only", () => startRec("mic"), "sm"), h("label.check", recMic, "include microphone"), btn("■ Stop", () => rec?.state === "recording" && rec.stop(), "sm danger"), recStatus), recVideo, recResult, h("p.hint", { text: "Recordings are WebM (VP9/Opus) or MP4 depending on the browser. Nothing is uploaded." })) },
      { id: "gif", label: "Images → GIF", render: () => h("div.col", dropzone("Drop images in order", (fl) => { gifImgs.push(...fl); renderGi(); }, { accept: "image/*" }), giList, h("div.row", field("delay ms", giDelay), field("width", giWidth), btn("Build GIF", buildGi, "primary sm"), giStatus)) },
    ], { remember: "media.tab" }));
    return () => cleanups.forEach((f) => f());
  },
});
