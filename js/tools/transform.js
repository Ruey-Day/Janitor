import { h, defineTool, store, textarea, btn, card, copy, toast, subtabs, field, input, seg, out } from "../core.js";
import { CASES, LINE_OPS, slugify, wrapText, escapeHtml, unescapeHtml } from "../lib/textkit.js";
import { NATO } from "../lib/units.js";

defineTool({
  id: "transform", name: "Text Transform", icon: "Aa", cat: "text",
  desc: "Case conversion, line operations, wrapping, slugs, find & replace.",
  tags: ["case", "uppercase", "camelcase", "snake", "kebab", "sort lines", "dedupe", "reverse", "slug", "replace", "wrap"],
  mount(root) {
    const src = textarea({ placeholder: "Input text…", style: { minHeight: "220px" } });
    const dst = textarea({ placeholder: "Output appears here…", style: { minHeight: "220px" }, readonly: true });
    src.value = store.get("transform.src", "");
    src.addEventListener("input", () => store.set("transform.src", src.value));

    const setOut = (v) => { dst.value = v; };
    const lines = () => src.value.split(/\r?\n/);

    const caseButtons = Object.keys(CASES).map((k) => btn(k, () => setOut(CASES[k](src.value)), "sm"));
    const lineButtons = [
      ["A→Z", "sortAZ"], ["Z→A", "sortZA"], ["0→9", "sortNum"], ["by length", "sortLen"], ["reverse", "reverse"], ["shuffle", "shuffle"],
      ["dedupe", "dedupe"], ["dedupe (ci)", "dedupeCI"], ["only dupes", "onlyDupes"], ["trim", "trim"], ["drop empty", "removeEmpty"],
      ["number", "number"], ["unnumber", "unnumber"], ["reverse each", "reverseEach"], ["join ,", "join"], ["quote", "quote"],
      ["bullets", "bullets"], ["collapse spaces", "collapseSpaces"], ["strip html", "stripHtml"],
    ].map(([label, k]) => btn(label, () => setOut(LINE_OPS[k](lines()).join("\n")), "sm"));

    const width = input({ type: "number", value: 80, min: 10, style: { width: "90px" } });
    const prefix = input({ placeholder: "prefix" });
    const suffix = input({ placeholder: "suffix" });
    const findIn = input({ placeholder: "find (text or /regex/flags)" });
    const replIn = input({ placeholder: "replace with ($1 for groups)" });

    const misc = h("div.col",
      h("div.row",
        btn("slugify", () => setOut(slugify(src.value)), "sm"),
        btn("reverse text", () => setOut([...src.value].reverse().join("")), "sm"),
        btn("remove line breaks", () => setOut(src.value.replace(/\s*\n\s*/g, " ")), "sm"),
        btn("remove all whitespace", () => setOut(src.value.replace(/\s+/g, "")), "sm"),
        btn("remove punctuation", () => setOut(src.value.replace(/[^\p{L}\p{N}\s]/gu, "")), "sm"),
        btn("remove digits", () => setOut(src.value.replace(/\d+/g, "")), "sm"),
        btn("remove accents", () => setOut(src.value.normalize("NFD").replace(/[̀-ͯ]/g, "")), "sm"),
        btn("escape HTML", () => setOut(escapeHtml(src.value)), "sm"),
        btn("unescape HTML", () => setOut(unescapeHtml(src.value)), "sm"),
        btn("NATO spell", () => setOut([...src.value].map((c) => NATO[c.toLowerCase()] || c).join(" ")), "sm"),
        btn("extract emails", () => setOut((src.value.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || []).join("\n")), "sm"),
        btn("extract URLs", () => setOut((src.value.match(/https?:\/\/[^\s<>"')\]]+/g) || []).join("\n")), "sm"),
        btn("extract numbers", () => setOut((src.value.match(/-?\d+(?:\.\d+)?/g) || []).join("\n")), "sm"),
        btn("extract hashtags", () => setOut((src.value.match(/#[\p{L}\p{N}_]+/gu) || []).join("\n")), "sm"),
        btn("smart quotes → straight", () => setOut(src.value.replace(/[‘’]/g, "'").replace(/[“”]/g, '"')), "sm"),
        btn("tabs → spaces", () => setOut(src.value.replace(/\t/g, "    ")), "sm"),
        btn("spaces → tabs", () => setOut(src.value.replace(/ {4}/g, "\t")), "sm")),
      h("div.row",
        field("wrap width", width),
        btn("wrap", () => setOut(wrapText(src.value, +width.value || 80)), "sm"),
        field("prefix", prefix), field("suffix", suffix),
        btn("apply to lines", () => setOut(lines().map((l) => prefix.value + l + suffix.value).join("\n")), "sm")),
      h("div.row",
        field("find", findIn), field("replace", replIn),
        btn("replace all", () => {
          const m = /^\/(.*)\/([gimsuy]*)$/.exec(findIn.value);
          try {
            const re = m ? new RegExp(m[1], m[2].includes("g") ? m[2] : m[2] + "g") : new RegExp(findIn.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
            setOut(src.value.replace(re, replIn.value));
          } catch (e) { toast("bad regex: " + e.message, "bad"); }
        }, "sm")));

    root.append(
      h("div.grid.g2",
        card("Input", src, [btn("Clear", () => { src.value = ""; store.set("transform.src", ""); }, "ghost sm danger")]),
        card("Output", dst, [
          btn("Copy", () => copy(dst.value), "ghost sm"),
          btn("↑ Use as input", () => { src.value = dst.value; store.set("transform.src", src.value); }, "ghost sm"),
        ])),
      h("div", { style: { marginTop: "14px" } },
        card("Operations", subtabs([
          { id: "case", label: "Case", render: () => h("div.row", caseButtons) },
          { id: "lines", label: "Lines", render: () => h("div.row", lineButtons) },
          { id: "misc", label: "More", render: () => misc },
        ], { remember: "transform.tab" }))));
  },
});
