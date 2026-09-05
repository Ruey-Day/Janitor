/* Safe arithmetic expression evaluator -- tokenizer + Pratt parser, no eval(). */
"use strict";

export const CONSTANTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2 };

export const FUNCTIONS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  atan2: Math.atan2, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, sign: Math.sign,
  ln: Math.log, log: Math.log10, log2: Math.log2, log10: Math.log10, exp: Math.exp,
  floor: Math.floor, ceil: Math.ceil, round: Math.round, trunc: Math.trunc,
  min: Math.min, max: Math.max, hypot: Math.hypot,
  rand: Math.random,
  deg: (r) => (r * 180) / Math.PI, rad: (d) => (d * Math.PI) / 180,
  fact: (n) => { let r = 1; for (let i = 2; i <= Math.round(n); i++) r *= i; return r; },
  gcd: (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; },
  lcm: (a, b) => Math.abs(a * b) / FUNCTIONS.gcd(a, b),
  sum: (...xs) => xs.reduce((s, x) => s + x, 0),
  avg: (...xs) => xs.reduce((s, x) => s + x, 0) / xs.length,
  clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
};

function tokenize(src) {
  const tokens = [];
  let i = 0;
  const s = String(src);
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[\d.]/.test(c)) {
      let j = i;
      if (s.startsWith("0x", i) || s.startsWith("0X", i)) {
        j = i + 2;
        while (j < s.length && /[0-9a-fA-F_]/.test(s[j])) j++;
        tokens.push({ t: "num", v: parseInt(s.slice(i + 2, j).replace(/_/g, ""), 16) });
        i = j; continue;
      }
      if (s.startsWith("0b", i) || s.startsWith("0B", i)) {
        j = i + 2;
        while (j < s.length && /[01_]/.test(s[j])) j++;
        tokens.push({ t: "num", v: parseInt(s.slice(i + 2, j).replace(/_/g, ""), 2) });
        i = j; continue;
      }
      while (j < s.length && /[\d_]/.test(s[j])) j++;
      if (s[j] === ".") { j++; while (j < s.length && /[\d_]/.test(s[j])) j++; }
      if (/[eE]/.test(s[j]) && /[\d+-]/.test(s[j + 1] || "")) {
        j++;
        if (/[+-]/.test(s[j])) j++;
        while (j < s.length && /\d/.test(s[j])) j++;
      }
      tokens.push({ t: "num", v: parseFloat(s.slice(i, j).replace(/_/g, "")) });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j++;
      tokens.push({ t: "name", v: s.slice(i, j) });
      i = j;
      continue;
    }
    const three = s.slice(i, i + 3);
    const two = s.slice(i, i + 2);
    if (three === ">>>") { tokens.push({ t: "op", v: three }); i += 3; continue; }
    if (["**", "<<", ">>", "//"].includes(two)) { tokens.push({ t: "op", v: two }); i += 2; continue; }
    if ("+-*/%^()!,&|~".includes(c)) { tokens.push({ t: "op", v: c }); i++; continue; }
    throw new Error("unexpected character: " + c);
  }
  return tokens;
}

const BINARY = {
  "|": 1, "&": 2, "<<": 3, ">>": 3, ">>>": 3,
  "+": 4, "-": 4,
  "*": 5, "/": 5, "%": 5, "//": 5,
  "^": 7, "**": 7,
};
const RIGHT = new Set(["^", "**"]);

/** Evaluate an expression. vars: extra variables merged over CONSTANTS. */
export function evaluate(src, vars = {}) {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = (v) => {
    const t = tokens[pos];
    if (!t || (v !== undefined && t.v !== v)) throw new Error("expected " + (v ?? "token"));
    pos++;
    return t;
  };
  const scope = { ...CONSTANTS, ...vars };

  function parsePrimary() {
    const t = peek();
    if (!t) throw new Error("unexpected end of expression");
    if (t.t === "num") { pos++; return applyPostfix(t.v); }
    if (t.t === "op" && (t.v === "-" || t.v === "+")) { pos++; const v = parseExpr(6); return t.v === "-" ? -v : v; }
    if (t.t === "op" && t.v === "~") { pos++; return ~parseExpr(6); }
    if (t.t === "op" && t.v === "(") {
      pos++;
      const v = parseExpr(0);
      eat(")");
      return applyPostfix(v);
    }
    if (t.t === "name") {
      pos++;
      const name = t.v.toLowerCase();
      if (peek() && peek().v === "(") {
        pos++;
        const args = [];
        if (peek() && peek().v !== ")") {
          args.push(parseExpr(0));
          while (peek() && peek().v === ",") { pos++; args.push(parseExpr(0)); }
        }
        eat(")");
        const fn = FUNCTIONS[name];
        if (!fn) throw new Error("unknown function: " + t.v);
        return applyPostfix(fn(...args));
      }
      if (name in scope) return applyPostfix(scope[name]);
      throw new Error("unknown name: " + t.v);
    }
    throw new Error("unexpected token: " + t.v);
  }
  function applyPostfix(value) {
    while (peek() && peek().t === "op" && (peek().v === "!" || peek().v === "%")) {
      // "!" = factorial; "%" only as postfix when not followed by an operand
      if (peek().v === "!") { pos++; value = FUNCTIONS.fact(value); continue; }
      const next = tokens[pos + 1];
      if (next && (next.t === "num" || next.t === "name" || next.v === "(")) break;
      pos++;
      value = value / 100;
    }
    return value;
  }
  function parseExpr(minPrec) {
    let left = parsePrimary();
    while (peek() && peek().t === "op" && BINARY[peek().v] !== undefined && BINARY[peek().v] >= minPrec) {
      const op = eat().v;
      const prec = BINARY[op];
      const right = parseExpr(RIGHT.has(op) ? prec : prec + 1);
      switch (op) {
        case "+": left = left + right; break;
        case "-": left = left - right; break;
        case "*": left = left * right; break;
        case "/": left = left / right; break;
        case "//": left = Math.floor(left / right); break;
        case "%": left = left % right; break;
        case "^": case "**": left = left ** right; break;
        case "<<": left = left << right; break;
        case ">>": left = left >> right; break;
        case ">>>": left = left >>> right; break;
        case "&": left = left & right; break;
        case "|": left = left | right; break;
      }
    }
    return left;
  }
  const value = parseExpr(0);
  if (pos < tokens.length) throw new Error("unexpected trailing input: " + tokens[pos].v);
  return value;
}
