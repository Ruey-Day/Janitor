/* TRINKET LAB — everything runs client-side. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  /* ── toast ─────────────────────────────────────────────── */
  const toastEl = $("toast");
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
      setTimeout(() => { toastEl.hidden = true; }, 260);
    }, 2200);
  }

  /* ── tabs ──────────────────────────────────────────────── */
  const tabs = [...document.querySelectorAll(".tab")];
  const glider = document.querySelector(".tab-glider");

  function moveGlider() {
    const active = document.querySelector(".tab.is-active");
    if (!active) return;
    glider.style.width = active.offsetWidth + "px";
    glider.style.transform = `translateX(${active.offsetLeft - 6}px)`;
  }

  function activateTab(tab) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
      const panel = $(t.dataset.panel);
      panel.classList.toggle("is-active", on);
      panel.hidden = !on;
    });
    moveGlider();
  }

  tabs.forEach((t) => t.addEventListener("click", () => activateTab(t)));
  window.addEventListener("resize", moveGlider);
  document.fonts?.ready.then(moveGlider);
  moveGlider();

  /* ── 01 · text metrics ─────────────────────────────────── */
  const input = $("text-input");
  const outputs = {
    chars: $("stat-chars"),
    nws: $("stat-chars-nws"),
    words: $("stat-words"),
    lines: $("stat-lines"),
  };
  const fmt = new Intl.NumberFormat();

  function paint(el, value) {
    const next = fmt.format(value);
    if (el.textContent === next) return;
    el.textContent = next;
    el.classList.remove("bump");
    void el.offsetWidth; // restart the animation
    el.classList.add("bump");
  }

  function updateStats() {
    const text = input.value;
    const trimmed = text.trim();
    paint(outputs.chars, [...text].length);
    paint(outputs.nws, [...text.replace(/\s/g, "")].length);
    paint(outputs.words, trimmed ? trimmed.split(/\s+/).length : 0);
    paint(outputs.lines, text === "" ? 0 : text.split(/\r\n|\r|\n/).length);
  }

  input.addEventListener("input", updateStats);
  updateStats();

  $("text-clear").addEventListener("click", () => {
    input.value = "";
    updateStats();
    input.focus();
    toast("buffer cleared");
  });

  $("text-copy").addEventListener("click", async () => {
    if (!input.value) return toast("nothing to copy");
    try {
      await navigator.clipboard.writeText(input.value);
      toast("copied to clipboard");
    } catch {
      input.select();
      document.execCommand("copy");
      toast("copied to clipboard");
    }
  });

  $("text-paste").addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      input.value = input.value.slice(0, start) + text + input.value.slice(end);
      input.setSelectionRange(start + text.length, start + text.length);
      updateStats();
      input.focus();
    } catch {
      input.focus();
      toast("press ⌘V / Ctrl+V to paste");
    }
  });

  /* ── 02 · image forge ──────────────────────────────────── */
  const stage = $("stage");
  const ctx = stage.getContext("2d", { willReadFrequently: true });
  const holder = $("canvas-holder");
  const stageWrap = $("stage-wrap");
  const dropzone = $("dropzone");
  const fileInput = $("file-input");
  const actions = $("image-actions");
  const selBox = $("sel");
  const selSize = $("sel-size");
  const metaDims = $("meta-dims");
  const cropBtn = $("btn-crop");

  let original = null; // pristine copy as a canvas
  let selection = null; // {x, y, w, h} in image pixels
  let drag = null;

  function hasImage() {
    return original !== null;
  }

  function showEditor(on) {
    dropzone.hidden = on;
    stageWrap.hidden = !on;
    actions.hidden = !on;
  }

  function refreshMeta() {
    metaDims.textContent = `${stage.width} × ${stage.height} px`;
  }

  function clearSelection() {
    selection = null;
    selBox.hidden = true;
    cropBtn.disabled = true;
  }

  function loadImage(src) {
    const img = new Image();
    img.onload = () => {
      stage.width = img.naturalWidth;
      stage.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      original = document.createElement("canvas");
      original.width = stage.width;
      original.height = stage.height;
      original.getContext("2d").drawImage(stage, 0, 0);
      clearSelection();
      showEditor(true);
      refreshMeta();
      toast(`loaded ${stage.width} × ${stage.height}`);
    };
    img.onerror = () => toast("could not read that image");
    img.src = src;
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith("image/")) return toast("that is not an image");
    const reader = new FileReader();
    reader.onload = () => loadImage(reader.result);
    reader.onerror = () => toast("could not read that file");
    reader.readAsDataURL(file);
  }

  /* input routes: browse, drop, paste */
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener("change", () => {
    loadFile(fileInput.files[0]);
    fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach((ev) =>
    document.addEventListener(ev, (e) => {
      if (![...e.dataTransfer.types].includes("Files")) return;
      e.preventDefault();
      dropzone.classList.add("hot");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    document.addEventListener(ev, () => dropzone.classList.remove("hot"))
  );
  document.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    e.preventDefault();
    activateTab($("tab-image"));
    loadFile(file);
  });

  document.addEventListener("paste", (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
    if (!item) return; // plain text keeps its normal behaviour
    e.preventDefault();
    activateTab($("tab-image"));
    loadFile(item.getAsFile());
  });

  /* crop selection */
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function toImageCoords(e) {
    const rect = stage.getBoundingClientRect();
    const sx = stage.width / rect.width;
    const sy = stage.height / rect.height;
    return {
      x: clamp((e.clientX - rect.left) * sx, 0, stage.width),
      y: clamp((e.clientY - rect.top) * sy, 0, stage.height),
    };
  }

  function drawSelection() {
    if (!selection) return;
    const rect = stage.getBoundingClientRect();
    const hrect = holder.getBoundingClientRect();
    const sx = rect.width / stage.width;
    const sy = rect.height / stage.height;
    selBox.hidden = false;
    selBox.style.left = rect.left - hrect.left + selection.x * sx + "px";
    selBox.style.top = rect.top - hrect.top + selection.y * sy + "px";
    selBox.style.width = selection.w * sx + "px";
    selBox.style.height = selection.h * sy + "px";
    selSize.textContent = `${Math.round(selection.w)} × ${Math.round(selection.h)}`;
  }

  stage.addEventListener("pointerdown", (e) => {
    if (!hasImage()) return;
    stage.setPointerCapture(e.pointerId);
    drag = toImageCoords(e);
    selection = { x: drag.x, y: drag.y, w: 0, h: 0 };
    drawSelection();
  });

  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = toImageCoords(e);
    selection = {
      x: Math.min(drag.x, p.x),
      y: Math.min(drag.y, p.y),
      w: Math.abs(p.x - drag.x),
      h: Math.abs(p.y - drag.y),
    };
    drawSelection();
  });

  function endDrag() {
    if (!drag) return;
    drag = null;
    if (!selection || selection.w < 2 || selection.h < 2) clearSelection();
    else cropBtn.disabled = false;
  }
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  window.addEventListener("resize", () => selection && drawSelection());

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && selection) clearSelection();
  });

  /* operations */
  $("btn-invert").addEventListener("click", () => {
    if (!hasImage()) return;
    const data = ctx.getImageData(0, 0, stage.width, stage.height);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      px[i] = 255 - px[i];
      px[i + 1] = 255 - px[i + 1];
      px[i + 2] = 255 - px[i + 2];
    }
    ctx.putImageData(data, 0, 0);
    toast("colours inverted");
  });

  cropBtn.addEventListener("click", () => {
    if (!hasImage() || !selection) return;
    const x = Math.round(selection.x);
    const y = Math.round(selection.y);
    const w = Math.max(1, Math.round(selection.w));
    const h = Math.max(1, Math.round(selection.h));
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    tmp.getContext("2d").drawImage(stage, x, y, w, h, 0, 0, w, h);
    stage.width = w;
    stage.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(tmp, 0, 0);
    clearSelection();
    refreshMeta();
    toast(`cropped to ${w} × ${h}`);
  });

  $("btn-reset").addEventListener("click", () => {
    if (!hasImage()) return;
    stage.width = original.width;
    stage.height = original.height;
    ctx.drawImage(original, 0, 0);
    clearSelection();
    refreshMeta();
    toast("restored original");
  });

  $("btn-unload").addEventListener("click", () => {
    original = null;
    clearSelection();
    showEditor(false);
  });

  $("btn-download").addEventListener("click", () => {
    if (!hasImage()) return;
    stage.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trinketlab-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("download started");
    }, "image/png");
  });
})();
