import { h, defineTool, store, input, btn, card, copy, toast, download, pickFile, readAs } from "../core.js";

const DEFAULT_GROUPS = [
  { name: "Stuff", links: [{ title: "Google Doc", url: "https://docs.google.com/document/d/1uxSBcbUm9D7VS126Q2Donh8F1LV-in3Jo30mMCgRyck/edit?tab=t.0" }] },
  { name: "VM", links: [{ title: "Drive folder", url: "https://drive.google.com/drive/folders/1wMiWXJXqGRYzEg5KB68p-NVnI0UbFf7u?usp=sharing" }] },
  { name: "Dropbox", links: [{ title: "Shared folder", url: "https://www.dropbox.com/scl/fo/h49i0ajs1se7he0dxbgst/AAFxS9V1RMV_EX6QQ_GMWGs?rlkey=0qvm30nw6fnejquqtxjqoovgp&st=rcf2aetf&dl=0" }] },
  { name: "Dev", links: [{ title: "GitHub", url: "https://github.com" }, { title: "MDN", url: "https://developer.mozilla.org" }, { title: "Can I use", url: "https://caniuse.com" }, { title: "regex101", url: "https://regex101.com" }] },
];

defineTool({
  id: "links", name: "Launchpad", icon: "⇗", cat: "workspace",
  desc: "Your bookmarks, grouped — quick launch, search, import/export. Stored locally.",
  tags: ["links", "bookmarks", "launchpad", "start page", "favorites", "shortcuts", "dropbox", "drive"],
  mount(root) {
    let groups = store.get("links", DEFAULT_GROUPS);
    const save = () => store.set("links", groups);
    const search = input({ type: "search", placeholder: "search links… (Enter opens first match)" });
    const grid = h("div.col");
    const favicon = (url) => { try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; } catch { return ""; } };
    const render = () => {
      const q = search.value.toLowerCase();
      grid.replaceChildren(...groups.map((g, gi) => {
        const links = g.links.filter((l) => !q || (l.title + l.url).toLowerCase().includes(q));
        if (q && !links.length) return null;
        const nameIn = input({ value: g.name, style: { width: "180px", fontWeight: 700 } });
        nameIn.addEventListener("change", () => { g.name = nameIn.value; save(); });
        const t = input({ placeholder: "title", style: { width: "160px" } }), u = input({ placeholder: "https://…" });
        const add = () => { if (!u.value.trim()) return; g.links.push({ title: t.value.trim() || u.value.replace(/^https?:\/\//, "").split("/")[0], url: /^https?:\/\//.test(u.value) ? u.value.trim() : "https://" + u.value.trim() }); t.value = u.value = ""; save(); render(); };
        u.addEventListener("keydown", (e) => e.key === "Enter" && add());
        return card(null, h("div.col",
          h("div.row", nameIn, h("span.spacer"), btn("↑", () => { if (gi > 0) { [groups[gi - 1], groups[gi]] = [groups[gi], groups[gi - 1]]; save(); render(); } }, "ghost sm"), btn("delete group", () => { if (confirm(`Delete "${g.name}" and its ${g.links.length} links?`)) { groups.splice(gi, 1); save(); render(); } }, "ghost sm danger")),
          h("div.home-grid", { style: { gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" } }, ...links.map((l) => h("div.home-card", { style: { padding: "12px", flexDirection: "row", alignItems: "center", gap: "10px", cursor: "default" } },
            h("img", { src: favicon(l.url), width: 18, height: 18, alt: "", style: { borderRadius: "4px", flex: "none" }, onerror(e) { e.target.style.visibility = "hidden"; } }),
            h("a", { href: l.url, target: "_blank", rel: "noopener", text: l.title, title: l.url, style: { flex: 1, color: "var(--text-hi)", textDecoration: "none", fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }),
            btn("⧉", () => copy(l.url, "link copied"), "ghost sm"), btn("✕", () => { g.links.splice(g.links.indexOf(l), 1); save(); render(); }, "ghost sm danger")))),
          h("div.row", t, h("div", { style: { flex: 1, minWidth: "200px" } }, u), btn("add", add, "sm"))));
      }).filter(Boolean));
    };
    search.addEventListener("input", render);
    search.addEventListener("keydown", (e) => { if (e.key === "Enter") { const a = grid.querySelector("a"); if (a) window.open(a.href, "_blank", "noopener"); } });
    render();
    root.append(
      h("div.row", { style: { marginBottom: "12px" } }, h("div", { style: { flex: 1, minWidth: "220px" } }, search),
        btn("+ group", () => { groups.push({ name: "New group", links: [] }); save(); render(); }, "sm"),
        btn("Open all in group…", () => { const name = prompt("Group name to open:", groups[0]?.name); const g = groups.find((x) => x.name.toLowerCase() === (name || "").toLowerCase()); if (!g) return toast("no such group", "bad"); g.links.forEach((l) => window.open(l.url, "_blank", "noopener")); }, "ghost sm"),
        btn("Export JSON", () => download(JSON.stringify(groups, null, 2), "links.json", "application/json"), "ghost sm"),
        btn("Export HTML", () => download(`<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<TITLE>Bookmarks</TITLE><H1>Bookmarks</H1><DL><p>\n${groups.map((g) => `<DT><H3>${g.name}</H3><DL><p>\n${g.links.map((l) => `<DT><A HREF="${l.url}">${l.title}</A>`).join("\n")}\n</DL><p>`).join("\n")}\n</DL><p>`, "bookmarks.html", "text/html"), "ghost sm"),
        btn("Import", async () => { const f = await pickFile({ accept: ".json,.html" }); if (!f) return; const text = await readAs.text(f); try { if (f.name.endsWith(".json")) groups = JSON.parse(text); else { const doc = new DOMParser().parseFromString(text, "text/html"); const links = [...doc.querySelectorAll("a[href]")].map((a) => ({ title: a.textContent.trim() || a.href, url: a.href })); groups.push({ name: "Imported", links }); } save(); render(); toast("imported", "ok"); } catch { toast("could not import", "bad"); } }, "ghost sm"),
        btn("Reset defaults", () => { if (confirm("Replace all links with the defaults?")) { groups = structuredClone(DEFAULT_GROUPS); save(); render(); } }, "ghost sm danger")),
      grid);
  },
});
