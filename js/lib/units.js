/* Unit conversion tables. Every unit maps to a base unit by factor (or fn for temperature). */
"use strict";

export const CATEGORIES = {
  length: {
    label: "Length", base: "m",
    units: {
      nm: ["nanometre", 1e-9], um: ["micrometre", 1e-6], mm: ["millimetre", 1e-3], cm: ["centimetre", 1e-2],
      m: ["metre", 1], km: ["kilometre", 1000],
      in: ["inch", 0.0254], ft: ["foot", 0.3048], yd: ["yard", 0.9144], mi: ["mile", 1609.344],
      nmi: ["nautical mile", 1852], furlong: ["furlong", 201.168],
      ly: ["light year", 9.4607304725808e15], au: ["astronomical unit", 1.495978707e11], pc: ["parsec", 3.0856775814913673e16],
      thou: ["thou (mil)", 2.54e-5], px96: ["CSS pixel (96dpi)", 0.0254 / 96], pt: ["point", 0.0254 / 72],
    },
  },
  mass: {
    label: "Mass", base: "kg",
    units: {
      ug: ["microgram", 1e-9], mg: ["milligram", 1e-6], g: ["gram", 1e-3], kg: ["kilogram", 1], t: ["tonne", 1000],
      oz: ["ounce", 0.028349523125], lb: ["pound", 0.45359237], st: ["stone", 6.35029318],
      ton_us: ["US ton", 907.18474], ton_uk: ["long ton", 1016.0469088], ct: ["carat", 2e-4],
      gr: ["grain", 6.479891e-5],
    },
  },
  temperature: {
    label: "Temperature", base: "C", special: true,
    units: {
      C: ["Celsius", { to: (v) => v, from: (v) => v }],
      F: ["Fahrenheit", { to: (v) => (v - 32) * (5 / 9), from: (v) => v * (9 / 5) + 32 }],
      K: ["Kelvin", { to: (v) => v - 273.15, from: (v) => v + 273.15 }],
      R: ["Rankine", { to: (v) => (v - 491.67) * (5 / 9), from: (v) => (v + 273.15) * (9 / 5) }],
    },
  },
  area: {
    label: "Area", base: "m2",
    units: {
      mm2: ["square millimetre", 1e-6], cm2: ["square centimetre", 1e-4], m2: ["square metre", 1],
      km2: ["square kilometre", 1e6], ha: ["hectare", 1e4], acre: ["acre", 4046.8564224],
      in2: ["square inch", 6.4516e-4], ft2: ["square foot", 0.09290304], yd2: ["square yard", 0.83612736],
      mi2: ["square mile", 2589988.110336],
    },
  },
  volume: {
    label: "Volume", base: "l",
    units: {
      ml: ["millilitre", 1e-3], cl: ["centilitre", 1e-2], l: ["litre", 1], m3: ["cubic metre", 1000],
      cm3: ["cubic centimetre", 1e-3], in3: ["cubic inch", 0.016387064], ft3: ["cubic foot", 28.316846592],
      tsp: ["teaspoon (US)", 0.00492892159375], tbsp: ["tablespoon (US)", 0.01478676478125],
      floz: ["fluid ounce (US)", 0.0295735295625], cup: ["cup (US)", 0.2365882365],
      pt: ["pint (US)", 0.473176473], qt: ["quart (US)", 0.946352946], gal: ["gallon (US)", 3.785411784],
      gal_uk: ["gallon (imperial)", 4.54609], floz_uk: ["fluid ounce (imperial)", 0.0284130625],
      bbl: ["oil barrel", 158.987294928],
    },
  },
  speed: {
    label: "Speed", base: "mps",
    units: {
      mps: ["metre / second", 1], kph: ["km / hour", 1 / 3.6], mph: ["mile / hour", 0.44704],
      fps: ["foot / second", 0.3048], knot: ["knot", 0.514444444444], mach: ["mach (sea level)", 340.29],
      c: ["speed of light", 299792458],
    },
  },
  time: {
    label: "Time", base: "s",
    units: {
      ns: ["nanosecond", 1e-9], us: ["microsecond", 1e-6], ms: ["millisecond", 1e-3], s: ["second", 1],
      min: ["minute", 60], h: ["hour", 3600], d: ["day", 86400], wk: ["week", 604800],
      mo: ["month (30d)", 2592000], yr: ["year (365d)", 31536000], decade: ["decade", 315360000],
    },
  },
  data: {
    label: "Data", base: "B",
    units: {
      bit: ["bit", 0.125], B: ["byte", 1],
      KB: ["kilobyte (1000)", 1e3], MB: ["megabyte (1000)", 1e6], GB: ["gigabyte (1000)", 1e9], TB: ["terabyte (1000)", 1e12], PB: ["petabyte (1000)", 1e15],
      KiB: ["kibibyte (1024)", 1024], MiB: ["mebibyte (1024)", 1048576], GiB: ["gibibyte (1024)", 1073741824], TiB: ["tebibyte (1024)", 1099511627776],
    },
  },
  angle: {
    label: "Angle", base: "deg",
    units: {
      deg: ["degree", 1], rad: ["radian", 180 / Math.PI], grad: ["gradian", 0.9],
      turn: ["turn", 360], arcmin: ["arcminute", 1 / 60], arcsec: ["arcsecond", 1 / 3600],
    },
  },
  pressure: {
    label: "Pressure", base: "Pa",
    units: {
      Pa: ["pascal", 1], hPa: ["hectopascal", 100], kPa: ["kilopascal", 1000], bar: ["bar", 1e5],
      atm: ["atmosphere", 101325], psi: ["psi", 6894.757293168], torr: ["torr / mmHg", 133.322368421],
      inHg: ["inch of mercury", 3386.389],
    },
  },
  energy: {
    label: "Energy", base: "J",
    units: {
      J: ["joule", 1], kJ: ["kilojoule", 1000], cal: ["calorie", 4.184], kcal: ["kilocalorie", 4184],
      Wh: ["watt hour", 3600], kWh: ["kilowatt hour", 3.6e6], eV: ["electronvolt", 1.602176634e-19],
      BTU: ["BTU", 1055.05585262], ftlb: ["foot-pound", 1.3558179483314],
    },
  },
  power: {
    label: "Power", base: "W",
    units: {
      mW: ["milliwatt", 1e-3], W: ["watt", 1], kW: ["kilowatt", 1000], MW: ["megawatt", 1e6],
      hp: ["horsepower (mech)", 745.6998715823], PS: ["metric horsepower", 735.49875],
      BTUh: ["BTU / hour", 0.29307107], dbm: ["dBm is not linear", NaN],
    },
  },
  frequency: {
    label: "Frequency", base: "Hz",
    units: { Hz: ["hertz", 1], kHz: ["kilohertz", 1e3], MHz: ["megahertz", 1e6], GHz: ["gigahertz", 1e9], rpm: ["rpm", 1 / 60], bpm: ["bpm", 1 / 60] },
  },
  fuel: {
    label: "Fuel economy", base: "kmpl",
    units: {
      kmpl: ["km / litre", 1], mpg_us: ["mpg (US)", 0.4251437074], mpg_uk: ["mpg (imperial)", 0.354006],
      l100: ["L / 100 km (inverse)", NaN],
    },
  },
  css: {
    label: "CSS / typography", base: "px",
    units: { px: ["pixel", 1], pt: ["point", 96 / 72], pc: ["pica", 16], in: ["inch", 96], cm: ["centimetre", 96 / 2.54], mm: ["millimetre", 9.6 / 2.54], rem16: ["rem (16px root)", 16], em16: ["em (16px)", 16] },
  },
};

export function convert(category, from, to, value) {
  const cat = CATEGORIES[category];
  if (!cat) throw new Error("unknown category");
  if (cat.special) {
    const base = cat.units[from][1].to(value);
    return cat.units[to][1].from(base);
  }
  if (category === "fuel") {
    const toKmpl = (u, v) => (u === "l100" ? 100 / v : v * CATEGORIES.fuel.units[u][1]);
    const kmpl = toKmpl(from, value);
    return to === "l100" ? 100 / kmpl : kmpl / CATEGORIES.fuel.units[to][1];
  }
  return (value * cat.units[from][1]) / cat.units[to][1];
}

export const unitList = (category) =>
  Object.entries(CATEGORIES[category].units).map(([id, [label]]) => [id, `${label} (${id})`]);

/* ── extras used by other tools ─────────────────────────── */
export const ROMAN = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
export function toRoman(n) {
  n = Math.floor(n);
  if (!(n > 0 && n < 4000)) throw new Error("roman numerals cover 1-3999");
  let out = "";
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
  return out;
}
export function fromRoman(s) {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const str = String(s).toUpperCase().trim();
  if (!/^[IVXLCDM]+$/.test(str)) throw new Error("not a roman numeral");
  let total = 0;
  for (let i = 0; i < str.length; i++) {
    const cur = map[str[i]], next = map[str[i + 1]] || 0;
    total += cur < next ? -cur : cur;
  }
  if (toRoman(total) !== str) throw new Error("malformed roman numeral");
  return total;
}

export const NATO = {
  a: "Alfa", b: "Bravo", c: "Charlie", d: "Delta", e: "Echo", f: "Foxtrot", g: "Golf", h: "Hotel",
  i: "India", j: "Juliett", k: "Kilo", l: "Lima", m: "Mike", n: "November", o: "Oscar", p: "Papa",
  q: "Quebec", r: "Romeo", s: "Sierra", t: "Tango", u: "Uniform", v: "Victor", w: "Whiskey",
  x: "X-ray", y: "Yankee", z: "Zulu",
  0: "Zero", 1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven", 8: "Eight", 9: "Nine",
};
export const MORSE = {
  a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....", i: "..", j: ".---",
  k: "-.-", l: ".-..", m: "--", n: "-.", o: "---", p: ".--.", q: "--.-", r: ".-.", s: "...", t: "-",
  u: "..-", v: "...-", w: ".--", x: "-..-", y: "-.--", z: "--..",
  0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--", "/": "-..-.", "(": "-.--.",
  ")": "-.--.-", "&": ".-...", ":": "---...", ";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-",
  _: "..--.-", '"': ".-..-.", $: "...-..-", "@": ".--.-.",
};
