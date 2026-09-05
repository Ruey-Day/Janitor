import { h, defineTool, tools, navigate, favorites, recents, getTool, isFav, toggleFav, openPalette, store, btn } from "../core.js";

const CAT_LABEL = {
  text: "Text & writing", data: "Data & code", crypto: "Crypto & security", media: "Design & media",
  numbers: "Numbers & units", time: "Time", web: "Web & system", workspace: "Workspace", misc: "Misc",
};

defineTool({
  id: "home", name: "Home", icon: "⌂", cat: "misc", desc: "",
  mount(root) {
    const card = (t) => h("button.home-card", { type: "button", onclick: () => navigate(t.id) },
      h("span.hc-idx", { text: String(tools.indexOf(t)).padStart(2, "0") }),
      h("span.hc-icon", { text: t.icon }),
      h("span.hc-name", { text: t.name }),
      h("span.hc-desc", { text: t.desc }),
      isFav(t.id) ? h("span.hc-fav", { text: "★" }) : null);

    const all = tools.filter((t) => t.id !== "home");
    const favs = favorites().map(getTool).filter(Boolean);
    const rec = recents().map(getTool).filter(Boolean).slice(0, 6);
    const notes = store.get("notes", []);
    const tasks = store.get("tasks", []);
    const openTasks = tasks.filter((t) => !t.done).length;

    const hero = h("section.card", { style: { marginBottom: "18px" } },
      h("div.card-body",
        h("div.row", { style: { justifyContent: "space-between", alignItems: "flex-start" } },
          h("div",
            h("h2", { style: { margin: "0 0 6px", fontFamily: "var(--mono)", letterSpacing: ".08em", fontSize: "22px", color: "var(--text-hi)" } },
              `${all.length} tools. Zero uploads.`),
            h("p", { style: { margin: 0, color: "var(--muted)", maxWidth: "56ch", lineHeight: 1.6 } },
              "Every utility here runs inside this tab — text, images, colours, JSON, hashes, encoders, QR codes, converters, timers, notes. Nothing leaves your machine, it works offline, and it remembers your inputs.")),
          h("div.col", { style: { alignItems: "flex-end", gap: "8px" } },
            btn("⌕  search everything   ⌘K", () => openPalette(), "primary"),
            h("div.row.tight",
              h("span.chip", { text: `${favs.length} pinned` }),
              h("span.chip", { text: `${notes.length} notes` }),
              h("span.chip", { text: `${openTasks} open tasks` }))))));

    const section = (title, items) => items.length
      ? h("div", { style: { marginBottom: "22px" } },
          h("div.rail-group", { style: { padding: 0, margin: "0 0 10px" }, text: title }),
          h("div.home-grid", items.map(card)))
      : null;

    const groups = new Map();
    for (const t of all) {
      if (!groups.has(t.cat)) groups.set(t.cat, []);
      groups.get(t.cat).push(t);
    }

    root.append(...[
      hero,
      section("★ pinned", favs),
      section("recent", rec),
      ...[...groups.entries()].map(([cat, items]) => section(CAT_LABEL[cat] || cat, items)),
    ].filter(Boolean));
  },
});
