import { h, defineTool, store, input, textarea, btn, card, copy, toast, subtabs, download, debounce, num, seg } from "../core.js";
import { render as mdRender } from "../lib/markdown.js";

const uid = () => Math.random().toString(36).slice(2, 9);

defineTool({
  id: "notes", name: "Notes & Tasks", icon: "✎", cat: "workspace",
  desc: "Autosaving scratch notes (with Markdown preview) and a to-do list — stored only in this browser.",
  tags: ["notes", "notepad", "scratch", "todo", "tasks", "checklist", "markdown", "journal"],
  mount(root) {
    /* notes */
    let notes = store.get("notes", []);
    if (!notes.length) notes = [{ id: uid(), title: "Scratch", body: "", updated: Date.now() }];
    let activeId = store.get("notes.active", notes[0].id);
    const save = () => { store.set("notes", notes); store.set("notes.active", activeId); };
    const tabsBox = h("div.row.tight");
    const title = input({ placeholder: "title", style: { fontWeight: 700 } });
    const body = textarea({ placeholder: "write anything… markdown works in preview", style: { minHeight: "50vh", border: 0, background: "transparent", borderRadius: 0 } });
    const preview = h("div.md-body", { style: { padding: "0 18px 18px", minHeight: "50vh" } });
    const meta = h("span.chip");
    const searchIn = input({ type: "search", placeholder: "search notes…" });
    let view = "edit";
    const active = () => notes.find((n) => n.id === activeId) || notes[0];
    const renderTabs = () => { const q = searchIn.value.toLowerCase(); tabsBox.replaceChildren(...notes.filter((n) => !q || (n.title + n.body).toLowerCase().includes(q)).sort((a, b) => b.updated - a.updated).map((n) => h("button.note-tab", { type: "button", class: n.id === activeId ? "on" : "", onclick: () => { activeId = n.id; save(); load(); } }, h("span", { text: n.title || "untitled" }))), btn("+ new", () => { const n = { id: uid(), title: "", body: "", updated: Date.now() }; notes.unshift(n); activeId = n.id; save(); load(); title.focus(); }, "ghost sm")); };
    const load = () => { const n = active(); activeId = n.id; title.value = n.title; body.value = n.body; renderTabs(); refreshMeta(); if (view === "preview") preview.innerHTML = mdRender(n.body); };
    const refreshMeta = () => { const n = active(); meta.textContent = `${num(n.body.length)} chars · ${num(n.body.trim() ? n.body.trim().split(/\s+/).length : 0)} words · saved ${new Date(n.updated).toLocaleTimeString()}`; };
    const persist = debounce(() => { const n = active(); n.title = title.value; n.body = body.value; n.updated = Date.now(); save(); renderTabs(); refreshMeta(); }, 250);
    title.addEventListener("input", persist); body.addEventListener("input", persist);
    searchIn.addEventListener("input", renderTabs);
    body.addEventListener("keydown", (e) => { if (e.key === "Tab") { e.preventDefault(); body.setRangeText("  ", body.selectionStart, body.selectionEnd, "end"); persist(); } });
    const editorWrap = h("div");
    const layout = () => { editorWrap.replaceChildren(view === "edit" ? body : (preview.innerHTML = mdRender(body.value), preview)); };
    const notesTab = h("div.col",
      h("div.row", searchIn, seg([["edit", "edit"], ["preview", "preview"]], (v) => { view = v; layout(); }, view)),
      tabsBox,
      card(null, h("div.col", { style: { gap: 0 } }, h("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--line)" } }, title), editorWrap), [
        meta,
        btn("Copy", () => copy(body.value), "ghost sm"),
        btn("Save .md", () => download(body.value, (title.value || "note") + ".md", "text/markdown"), "ghost sm"),
        btn("Duplicate", () => { const n = { ...active(), id: uid(), title: active().title + " copy", updated: Date.now() }; notes.unshift(n); activeId = n.id; save(); load(); }, "ghost sm"),
        btn("Delete", () => { if (!confirm("Delete this note?")) return; notes = notes.filter((n) => n.id !== activeId); if (!notes.length) notes = [{ id: uid(), title: "Scratch", body: "", updated: Date.now() }]; activeId = notes[0].id; save(); load(); }, "ghost sm danger"),
      ]));

    /* tasks */
    let tasks = store.get("tasks", []);
    const saveT = () => store.set("tasks", tasks);
    const taskIn = input({ placeholder: "add a task… (Enter)  · prefix !! for high priority" });
    const list = h("div.col", { style: { gap: "6px" } });
    const summary = h("span.chip");
    let filter = "all";
    const renderTasks = () => {
      const shown = tasks.filter((t) => filter === "all" || (filter === "open" ? !t.done : t.done));
      list.replaceChildren(...shown.map((t) => {
        const cb = h("input", { type: "checkbox", checked: t.done, onchange: () => { t.done = cb.checked; t.doneAt = t.done ? Date.now() : null; saveT(); renderTasks(); } });
        const txt = h("span.li-text", { text: t.text, contenteditable: "true", spellcheck: "false", onblur: () => { t.text = txt.textContent.trim(); saveT(); }, onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); txt.blur(); } } });
        return h("div.list-item", { class: t.done ? "done" : "" }, cb, t.priority ? h("span.chip.warn", { text: "!" }) : null, txt,
          h("span.hint", { text: new Date(t.created).toLocaleDateString() }),
          btn("↑", () => { const i = tasks.indexOf(t); if (i > 0) { [tasks[i - 1], tasks[i]] = [tasks[i], tasks[i - 1]]; saveT(); renderTasks(); } }, "ghost sm"),
          btn("✕", () => { tasks = tasks.filter((x) => x !== t); saveT(); renderTasks(); }, "ghost sm danger"));
      }));
      const open = tasks.filter((t) => !t.done).length;
      summary.textContent = `${open} open · ${tasks.length - open} done`;
    };
    taskIn.addEventListener("keydown", (e) => { if (e.key === "Enter" && taskIn.value.trim()) { const pr = taskIn.value.startsWith("!!"); tasks.unshift({ id: uid(), text: taskIn.value.replace(/^!!\s*/, "").trim(), done: false, created: Date.now(), priority: pr }); taskIn.value = ""; saveT(); renderTasks(); } });
    const tasksTab = h("div.col", taskIn,
      h("div.row", seg([["all", "all"], ["open", "open"], ["done", "done"]], (v) => { filter = v; renderTasks(); }, "all"), summary, h("span.spacer"),
        btn("Copy as markdown", () => copy(tasks.map((t) => `- [${t.done ? "x" : " "}] ${t.text}`).join("\n")), "ghost sm"),
        btn("Clear done", () => { tasks = tasks.filter((t) => !t.done); saveT(); renderTasks(); }, "ghost sm danger")),
      list);

    root.append(subtabs([
      { id: "notes", label: "Notes", render: () => { load(); layout(); return notesTab; } },
      { id: "tasks", label: "Tasks", render: () => { renderTasks(); return tasksTab; } },
    ], { remember: "notes.tab" }));
  },
});
