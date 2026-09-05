import { h, defineTool, store, input, textarea, btn, card, copy, toast, tbl, field, out, kv, debounce, subtabs } from "../core.js";

const TRACKING = /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ref|ref_src|_hsenc|_hsmi|yclid|twclid|si)$/i;

defineTool({
  id: "url", name: "URL Inspector", icon: "⛓", cat: "data",
  desc: "Parse, edit and rebuild URLs; query params table; encode/decode; strip trackers.",
  tags: ["url", "query string", "params", "encode", "decode", "utm", "link"],
  mount(root) {
    const urlIn = input({ placeholder: "https://example.com/path?x=1&y=two#frag", value: store.get("url.value", "https://rueyday.github.io/WebLab/?utm_source=demo&q=hello%20world#/url") });
    const parts = h("div.kv-list");
    const params = h("div");
    const rebuilt = out();
    let current = null;

    function render() {
      store.set("url.value", urlIn.value);
      parts.replaceChildren(); params.replaceChildren();
      let u;
      try { u = new URL(urlIn.value.trim()); } catch { try { u = new URL("https://" + urlIn.value.trim()); } catch { rebuilt.textContent = "not a valid URL"; return; } }
      current = u;
      const rows = [["protocol", u.protocol], ["username", u.username], ["password", u.password], ["host", u.host], ["hostname", u.hostname], ["port", u.port || "(default)"], ["origin", u.origin], ["pathname", u.pathname], ["search", u.search], ["hash", u.hash], ["tld", u.hostname.split(".").slice(-1)[0]], ["path segments", u.pathname.split("/").filter(Boolean).join("  /  ") || "/"]];
      parts.append(...rows.map(([k, v]) => kv(k, v || "—")));
      const entries = [...u.searchParams.entries()];
      const table = h("div.col", { style: { gap: "6px" } });
      entries.forEach(([k, v], i) => {
        const kIn = input({ value: k, style: { flex: "0 0 180px" } });
        const vIn = input({ value: v });
        const upd = () => { const sp = new URLSearchParams(); entries.forEach(([kk, vv], j) => sp.append(j === i ? kIn.value : kk, j === i ? vIn.value : vv)); u.search = sp.toString(); urlIn.value = u.toString(); render(); };
        kIn.addEventListener("change", upd); vIn.addEventListener("change", upd);
        table.append(h("div.row", { style: { flexWrap: "nowrap" } },
          TRACKING.test(k) ? h("span.chip.warn", { text: "tracker" }) : null, kIn, h("span.mono", { text: "=" }), vIn,
          btn("✕", () => { u.searchParams.delete(k); urlIn.value = u.toString(); render(); }, "ghost sm danger")));
      });
      const newK = input({ placeholder: "key", style: { flex: "0 0 180px" } }), newV = input({ placeholder: "value" });
      table.append(h("div.row", { style: { flexWrap: "nowrap" } }, newK, h("span.mono", { text: "=" }), newV,
        btn("add", () => { if (!newK.value) return; u.searchParams.append(newK.value, newV.value); urlIn.value = u.toString(); render(); }, "sm")));
      params.append(entries.length ? h("p.hint", { text: `${entries.length} parameter${entries.length === 1 ? "" : "s"}` }) : h("p.hint", { text: "no query parameters" }), table);
      rebuilt.textContent = u.toString();
    }
    urlIn.addEventListener("input", debounce(render, 120));

    const encIn = textarea({ placeholder: "text to encode / decode", style: { minHeight: "100px" } });
    const encOut = out();
    const encode = (mode) => {
      try {
        encOut.textContent = mode === "component" ? encodeURIComponent(encIn.value) : mode === "uri" ? encodeURI(encIn.value)
          : mode === "decode" ? decodeURIComponent(encIn.value.replace(/\+/g, " ")) : mode === "form" ? new URLSearchParams({ v: encIn.value }).toString().slice(2) : encIn.value;
      } catch (e) { encOut.textContent = "error: " + e.message; }
    };

    root.append(
      card("URL", h("div.col", urlIn, rebuilt), [
        btn("Copy", () => copy(rebuilt.textContent), "ghost sm"),
        btn("Strip trackers", () => { if (!current) return; [...current.searchParams.keys()].filter((k) => TRACKING.test(k)).forEach((k) => current.searchParams.delete(k)); urlIn.value = current.toString(); render(); toast("tracking params removed"); }, "sm"),
        btn("Sort params", () => { if (!current) return; current.searchParams.sort(); urlIn.value = current.toString(); render(); }, "sm"),
        btn("Drop hash", () => { if (!current) return; current.hash = ""; urlIn.value = current.toString(); render(); }, "sm"),
        btn("Open ↗", () => current && window.open(current.toString(), "_blank", "noopener"), "ghost sm"),
        btn("Use this page", () => { urlIn.value = location.href; render(); }, "ghost sm"),
      ]),
      h("div.grid.g2", { style: { marginTop: "14px" } },
        card("Components", parts),
        card("Query parameters", params)),
      h("div", { style: { marginTop: "14px" } },
        card("Encode / decode", h("div.col", encIn,
          h("div.row", btn("encodeURIComponent", () => encode("component"), "sm"), btn("encodeURI", () => encode("uri"), "sm"), btn("form (+ for space)", () => encode("form"), "sm"), btn("decode", () => encode("decode"), "sm")),
          encOut), [btn("Copy", () => copy(encOut.textContent), "ghost sm")])));
    render();
  },
});
