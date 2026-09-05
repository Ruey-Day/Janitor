/* EXIF reader for JPEG (APP1) — IFD0, Exif sub-IFD, GPS. Returns a flat {tag: value} map. */
"use strict";

const TAGS = {
  0x010f: "Make", 0x0110: "Model", 0x0112: "Orientation", 0x011a: "XResolution", 0x011b: "YResolution", 0x0131: "Software", 0x0132: "DateTime", 0x013b: "Artist", 0x8298: "Copyright",
  0x829a: "ExposureTime", 0x829d: "FNumber", 0x8827: "ISO", 0x9003: "DateTimeOriginal", 0x9004: "DateTimeDigitized", 0x9201: "ShutterSpeedValue", 0x9202: "ApertureValue", 0x9204: "ExposureBias",
  0x9207: "MeteringMode", 0x9209: "Flash", 0x920a: "FocalLength", 0xa002: "PixelXDimension", 0xa003: "PixelYDimension", 0xa405: "FocalLengthIn35mm", 0xa430: "OwnerName", 0xa431: "SerialNumber", 0xa432: "LensInfo", 0xa434: "LensModel",
  0x8822: "ExposureProgram", 0x9000: "ExifVersion", 0xa001: "ColorSpace", 0xa402: "ExposureMode", 0xa403: "WhiteBalance", 0xa406: "SceneCaptureType",
};
const GPS = { 0x0001: "GPSLatitudeRef", 0x0002: "GPSLatitude", 0x0003: "GPSLongitudeRef", 0x0004: "GPSLongitude", 0x0005: "GPSAltitudeRef", 0x0006: "GPSAltitude", 0x0007: "GPSTimeStamp", 0x001d: "GPSDateStamp", 0x0010: "GPSImgDirection" };
const SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

export function readExif(buffer) {
  const b = new Uint8Array(buffer);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (dv.getUint16(0) !== 0xffd8) return null; // not JPEG
  let p = 2;
  while (p < b.length - 4) {
    if (b[p] !== 0xff) return null;
    const marker = b[p + 1], len = dv.getUint16(p + 2);
    if (marker === 0xe1 && dv.getUint32(p + 4) === 0x45786966) { // "Exif"
      return parseTiff(dv, p + 10);
    }
    if (marker === 0xda) break; // start of scan
    p += 2 + len;
  }
  return null;
}

function parseTiff(dv, base) {
  const le = dv.getUint16(base) === 0x4949;
  const u16 = (o) => dv.getUint16(base + o, le), u32 = (o) => dv.getUint32(base + o, le), s32 = (o) => dv.getInt32(base + o, le);
  if (u16(2) !== 0x2a) return null;
  const out = {};
  const readIFD = (offset, names) => {
    const n = u16(offset);
    for (let i = 0; i < n; i++) {
      const e = offset + 2 + i * 12;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
      const size = (SIZES[type] || 1) * count;
      const at = size > 4 ? u32(e + 8) : e + 8;
      let val;
      if (type === 2) { let s = ""; for (let k = 0; k < count - 1; k++) s += String.fromCharCode(dv.getUint8(base + at + k)); val = s.trim(); }
      else if (type === 3) val = count === 1 ? u16(at) : Array.from({ length: count }, (_, k) => u16(at + k * 2));
      else if (type === 4) val = count === 1 ? u32(at) : Array.from({ length: count }, (_, k) => u32(at + k * 4));
      else if (type === 9) val = s32(at);
      else if (type === 5 || type === 10) { const g = type === 5 ? u32 : s32; val = Array.from({ length: count }, (_, k) => { const num = g(at + k * 8), den = g(at + k * 8 + 4); return den ? num / den : 0; }); if (count === 1) val = val[0]; }
      else if (type === 7 && count <= 8) val = Array.from({ length: count }, (_, k) => dv.getUint8(base + at + k));
      else continue;
      if (tag === 0x8769) readIFD(val, TAGS);
      else if (tag === 0x8825) readIFD(val, GPS);
      else if (names[tag]) out[names[tag]] = val;
    }
  };
  readIFD(u32(4), TAGS);
  if (out.GPSLatitude && out.GPSLongitude) {
    const dms = (a) => a[0] + a[1] / 60 + a[2] / 3600;
    out.latitude = dms(out.GPSLatitude) * (out.GPSLatitudeRef === "S" ? -1 : 1);
    out.longitude = dms(out.GPSLongitude) * (out.GPSLongitudeRef === "W" ? -1 : 1);
  }
  return out;
}

export function describe(exif) {
  if (!exif) return [];
  const rows = [];
  const fmt = {
    ExposureTime: (v) => (v >= 1 ? v + " s" : "1/" + Math.round(1 / v) + " s"), FNumber: (v) => "f/" + v, FocalLength: (v) => v + " mm", FocalLengthIn35mm: (v) => v + " mm",
    Orientation: (v) => ({ 1: "normal", 3: "rotated 180°", 6: "rotated 90° CW", 8: "rotated 90° CCW", 2: "mirrored", 4: "mirrored + 180°", 5: "mirrored + 90° CCW", 7: "mirrored + 90° CW" }[v] || v),
    Flash: (v) => (v & 1 ? "fired" : "did not fire"), MeteringMode: (v) => ["unknown", "average", "center-weighted", "spot", "multi-spot", "pattern", "partial"][v] || v,
    ExposureProgram: (v) => ["not defined", "manual", "program", "aperture priority", "shutter priority", "creative", "action", "portrait", "landscape"][v] || v,
    WhiteBalance: (v) => (v ? "manual" : "auto"), ExposureMode: (v) => ["auto", "manual", "bracket"][v] ?? v, ColorSpace: (v) => (v === 1 ? "sRGB" : v === 65535 ? "uncalibrated" : v),
    GPSAltitude: (v) => Math.round(v) + " m", latitude: (v) => v.toFixed(6), longitude: (v) => v.toFixed(6), ExifVersion: (v) => String.fromCharCode(...v), LensInfo: (v) => v.join(" / "),
  };
  for (const [k, v] of Object.entries(exif)) {
    if (/^GPS(Latitude|Longitude)/.test(k)) continue;
    rows.push([k.replace(/([a-z])([A-Z])/g, "$1 $2"), fmt[k] ? fmt[k](v) : Array.isArray(v) ? v.join(", ") : String(v)]);
  }
  return rows;
}
