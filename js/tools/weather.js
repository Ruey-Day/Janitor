import { h, defineTool, store, input, btn, card, toast, field, seg, out, kv, tbl, debounce } from "../core.js";

const WMO = { 0: ["Clear sky", "☀️"], 1: ["Mainly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"], 45: ["Fog", "🌫️"], 48: ["Rime fog", "🌫️"], 51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"], 56: ["Freezing drizzle", "🌧️"], 57: ["Freezing drizzle", "🌧️"], 61: ["Light rain", "🌧️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"], 66: ["Freezing rain", "🌧️"], 67: ["Freezing rain", "🌧️"], 71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"], 77: ["Snow grains", "🌨️"], 80: ["Rain showers", "🌦️"], 81: ["Showers", "🌧️"], 82: ["Violent showers", "⛈️"], 85: ["Snow showers", "🌨️"], 86: ["Heavy snow showers", "❄️"], 95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm + hail", "⛈️"], 99: ["Thunderstorm + heavy hail", "⛈️"] };
const wmo = (c) => WMO[c] || ["—", "❔"];
const dir = (d) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(d / 45) % 8];

defineTool({
  id: "weather", name: "Weather", icon: "🌤", cat: "time",
  desc: "Current conditions, hourly and 7-day forecast for any place (Open-Meteo, no key, no tracking).",
  tags: ["weather", "forecast", "temperature", "rain", "sunrise", "sunset", "uv", "wind", "humidity"],
  mount(root) {
    let unit = store.get("weather.unit", "celsius");
    let places = store.get("weather.places", []);
    let current = store.get("weather.current", null);
    const q = input({ type: "search", placeholder: "search a city…" });
    const results = h("div.row.tight");
    const saved = h("div.row.tight");
    const now = h("div"), hourly = h("div"), daily = h("div");
    const status = h("span.chip");
    const unitSeg = seg([["celsius", "°C"], ["fahrenheit", "°F"]], (v) => { unit = v; store.set("weather.unit", v); if (current) load(current); }, unit);

    const search = debounce(async () => { const s = q.value.trim(); if (s.length < 2) return results.replaceChildren(); try { const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(s)}&count=6&language=en`)).json(); results.replaceChildren(...(j.results || []).map((r) => btn(`${r.name}${r.admin1 ? ", " + r.admin1 : ""} · ${r.country_code}`, () => { const p = { name: `${r.name}${r.admin1 ? ", " + r.admin1 : ""}`, lat: r.latitude, lon: r.longitude }; load(p); results.replaceChildren(); q.value = ""; }, "ghost sm"))); if (!(j.results || []).length) results.replaceChildren(h("span.hint", { text: "no matches" })); } catch { results.replaceChildren(h("span.hint", { text: "search unavailable (offline?)" })); } }, 300);
    q.addEventListener("input", search);
    const renderSaved = () => saved.replaceChildren(...places.map((p) => h("span.chip", { style: { cursor: "pointer" }, onclick: () => load(p) }, p.name, h("span", { text: " ✕", style: { opacity: 0.6 }, onclick: (e) => { e.stopPropagation(); places = places.filter((x) => x !== p); store.set("weather.places", places); renderSaved(); } }))));

    const tU = () => (unit === "celsius" ? "°C" : "°F");
    async function load(p) {
      current = p; store.set("weather.current", p);
      status.textContent = "loading…";
      try {
        const u = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,surface_pressure&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,uv_index_max,wind_speed_10m_max&timezone=auto&forecast_days=7&temperature_unit=${unit}&wind_speed_unit=${unit === "celsius" ? "kmh" : "mph"}&precipitation_unit=${unit === "celsius" ? "mm" : "inch"}`;
        const j = await (await fetch(u)).json();
        if (j.error) throw new Error(j.reason);
        store.set("weather.cache", { p, j, t: Date.now() });
        render(p, j);
        status.textContent = `${p.name} · updated ${new Date().toLocaleTimeString()}`;
      } catch (e) { status.textContent = "failed: " + e.message; const c = store.get("weather.cache"); if (c && c.p.name === p.name) { render(c.p, c.j); status.textContent += ` · showing cached from ${new Date(c.t).toLocaleString()}`; } }
    }
    function render(p, j) {
      const c = j.current, [desc, icon] = wmo(c.weather_code);
      const wU = unit === "celsius" ? "km/h" : "mph", pU = unit === "celsius" ? "mm" : "in";
      now.replaceChildren(card(p.name, h("div.col",
        h("div.row", { style: { alignItems: "center", gap: "18px" } }, h("span", { text: icon, style: { fontSize: "56px" } }), h("div", h("div", { text: `${Math.round(c.temperature_2m)}${tU()}`, style: { fontSize: "44px", fontWeight: 800, fontFamily: "var(--mono)", lineHeight: 1 } }), h("div.hint", { text: `${desc} · feels like ${Math.round(c.apparent_temperature)}${tU()}` })),
          h("span.spacer"), places.some((x) => x.name === p.name) ? null : btn("☆ save place", () => { places.push(p); store.set("weather.places", places); renderSaved(); render(p, j); }, "ghost sm")),
        h("div.kv-list", kv("humidity", c.relative_humidity_2m + "%"), kv("wind", `${Math.round(c.wind_speed_10m)} ${wU} ${dir(c.wind_direction_10m)} · gusts ${Math.round(c.wind_gusts_10m)}`), kv("precipitation", `${c.precipitation} ${pU}`), kv("cloud cover", c.cloud_cover + "%"), kv("pressure", Math.round(c.surface_pressure) + " hPa"), kv("sunrise / sunset", `${j.daily.sunrise[0].slice(11)} / ${j.daily.sunset[0].slice(11)}`), kv("UV max today", String(j.daily.uv_index_max[0])), kv("timezone", j.timezone_abbreviation), kv("coordinates", `${(+p.lat).toFixed(3)}, ${(+p.lon).toFixed(3)} · ${j.elevation} m`)))));
      const nowIdx = Math.max(0, j.hourly.time.findIndex((t) => new Date(t) >= new Date()) - 1);
      const hrs = j.hourly.time.slice(nowIdx, nowIdx + 24).map((t, i) => ({ t, temp: j.hourly.temperature_2m[nowIdx + i], pop: j.hourly.precipitation_probability[nowIdx + i], code: j.hourly.weather_code[nowIdx + i], wind: j.hourly.wind_speed_10m[nowIdx + i], uv: j.hourly.uv_index[nowIdx + i] }));
      const tMin = Math.min(...hrs.map((x) => x.temp)), tMax = Math.max(...hrs.map((x) => x.temp));
      hourly.replaceChildren(card("Next 24 hours", h("div", { style: { display: "grid", gridTemplateColumns: `repeat(${hrs.length}, 1fr)`, gap: "3px", alignItems: "end", height: "150px" } }, ...hrs.map((x) => h("div", { title: `${new Date(x.t).toLocaleTimeString([], { hour: "2-digit" })}: ${x.temp}${tU()}, ${x.pop}% rain, ${wmo(x.code)[0]}, wind ${Math.round(x.wind)}, UV ${x.uv}`, style: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", fontSize: "10px", fontFamily: "var(--mono)", color: "var(--muted)" } }, h("span", { text: wmo(x.code)[1], style: { fontSize: "12px" } }), h("span", { text: Math.round(x.temp), style: { color: "var(--text-hi)" } }), h("div", { style: { width: "100%", height: 8 + ((x.temp - tMin) / Math.max(1, tMax - tMin)) * 60 + "px", borderRadius: "4px 4px 0 0", background: `linear-gradient(180deg, var(--a1), color-mix(in srgb, var(--a2) ${x.pop}%, transparent))` } }), h("span", { text: x.pop ? x.pop + "%" : "" }), h("span", { text: new Date(x.t).getHours() })))), h("p.hint", { text: "bar height = temperature · colour = rain chance · hover for details" })));
      daily.replaceChildren(card("7-day forecast", tbl(["day", "", "conditions", "high / low", "rain", "uv", "wind max", "sun"], j.daily.time.map((t, i) => { const [d, ic] = wmo(j.daily.weather_code[i]); return [new Date(t + "T00:00").toLocaleDateString([], { weekday: "short", day: "numeric" }), ic, d, `${Math.round(j.daily.temperature_2m_max[i])}° / ${Math.round(j.daily.temperature_2m_min[i])}°`, `${j.daily.precipitation_probability_max[i]}% · ${j.daily.precipitation_sum[i]} ${pU}`, String(j.daily.uv_index_max[i]), `${Math.round(j.daily.wind_speed_10m_max[i])} ${wU}`, `${j.daily.sunrise[i].slice(11)}–${j.daily.sunset[i].slice(11)}`]; }))));
    }
    const locate = () => { if (!navigator.geolocation) return toast("no geolocation", "bad"); status.textContent = "locating…"; navigator.geolocation.getCurrentPosition(async (pos) => { const { latitude: lat, longitude: lon } = pos.coords; let name = `${lat.toFixed(2)}, ${lon.toFixed(2)}`; load({ name, lat, lon }); }, () => (status.textContent = "location blocked — search instead"), { timeout: 8000 }); };

    renderSaved();
    root.append(h("div.col", h("div.row", h("div", { style: { flex: 1, minWidth: "220px" } }, q), btn("📍 my location", locate, "sm"), unitSeg, status), results, saved, now, hourly, daily,
      h("p.hint", { text: "Data: open-meteo.com (free, no API key). This tool necessarily talks to that API; results are cached locally for offline glances." })));
    if (current) load(current); else { const c = store.get("weather.cache"); if (c) { render(c.p, c.j); status.textContent = "cached"; } }
  },
});
