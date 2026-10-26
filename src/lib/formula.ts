/**
 * Custom chart formulas: a small arithmetic language over a model's metrics, e.g.
 * `score / (cost * time)`. Parsed to a closure, never `eval`ed. Names are forgiving:
 * case, underscores and spaces are ignored, and common long forms map to the short variable
 * ("Cost_per_Task" → cost), so a formula written in prose usually works as typed.
 */
export const FORMULA_MAX = 200;
const MAX_DEPTH = 40;

export type FormulaVars = Record<string, number | undefined>;
export type Formula = { ok: true; source: string; uses: string[]; evaluate: (vars: FormulaVars) => number | undefined } | { ok: false; error: string };

const ALIASES: Record<string, string> = {
  intelligence: "score", index: "score", indexscore: "score", iq: "score",
  costpertask: "cost", price: "cost", usd: "cost",
  timepertask: "time", seconds: "time", duration: "time",
  tokpersec: "speed", tokenspersecond: "speed", tps: "speed", outputspeed: "speed",
  ttft: "latency", timetofirsttoken: "latency",
  outputtokens: "tokens", tokenspertask: "tokens",
  days: "age", x: "value", metric: "value",
};
const FUNCTIONS: Record<string, { args: [number, number]; fn: (...a: number[]) => number }> = {
  log: { args: [1, 2], fn: (v, base) => (base == null ? Math.log10(v) : Math.log(v) / Math.log(base)) },
  log10: { args: [1, 1], fn: Math.log10 }, log2: { args: [1, 1], fn: Math.log2 }, ln: { args: [1, 1], fn: Math.log },
  sqrt: { args: [1, 1], fn: Math.sqrt }, abs: { args: [1, 1], fn: Math.abs }, exp: { args: [1, 1], fn: Math.exp },
  round: { args: [1, 1], fn: Math.round }, pow: { args: [2, 2], fn: Math.pow },
  min: { args: [1, 8], fn: Math.min }, max: { args: [1, 8], fn: Math.max },
};
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

/** Canonical variable name for what someone typed, or the cleaned name when it is not an alias. */
export function formulaName(raw: string): string {
  const k = raw.toLowerCase().replace(/[_\s]/g, "");
  return ALIASES[k] ?? k;
}

type Node = (vars: FormulaVars) => number;
type Token = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Token[] | string {
  const out: Token[] = [];
  // Typed and pasted math: ×, ·, ÷, the various minus signs, and ** for powers.
  const s = src.replace(/[×·∙⋅]/g, "*").replace(/[÷∕]/g, "/").replace(/[−–—]/g, "-").replace(/\*\*/g, "^");
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(s.slice(i));
    if (num) { out.push({ t: "num", v: Number(num[0]) }); i += num[0].length; continue; }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (id) { out.push({ t: "id", v: id[0] }); i += id[0].length; continue; }
    if ("+-*/^(),".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    return `Unexpected "${c}"`;
  }
  return out;
}

/**
 * Compile a formula. `known` lists the variables this chart can supply; anything else is an error
 * naming what is available. A model missing an input, or whose result is not a finite number
 * (division by zero, log of zero), evaluates to undefined and is left off the chart.
 */
export function compileFormula(source: string, known: readonly string[]): Formula {
  const text = source.trim();
  if (!text) return { ok: false, error: "Enter a formula" };
  if (text.length > FORMULA_MAX) return { ok: false, error: `Keep the formula under ${FORMULA_MAX} characters` };
  const tokens = tokenize(text);
  if (typeof tokens === "string") return { ok: false, error: tokens };
  const uses = new Set<string>();
  let at = 0, depth = 0;
  class Fail extends Error {}
  const peek = () => tokens[at];
  const isOp = (v: string) => { const t = tokens[at]; return t?.t === "op" && t.v === v; };
  const nest = <T,>(f: () => T): T => { if (++depth > MAX_DEPTH) throw new Fail("Formula is nested too deeply"); try { return f(); } finally { depth--; } };

  const sum = (): Node => nest(() => {
    let left = product();
    while (isOp("+") || isOp("-")) { const op = (tokens[at++] as { v: string }).v, a = left, b = product(); left = op === "+" ? (v) => a(v) + b(v) : (v) => a(v) - b(v); }
    return left;
  });
  const product = (): Node => {
    let left = unary();
    while (isOp("*") || isOp("/")) { const op = (tokens[at++] as { v: string }).v, a = left, b = unary(); left = op === "*" ? (v) => a(v) * b(v) : (v) => a(v) / b(v); }
    return left;
  };
  // Unary minus binds looser than ^, so -2^2 is -4.
  const unary = (): Node => {
    if (isOp("-")) { at++; const a = nest(unary); return (v) => -a(v); }
    if (isOp("+")) { at++; return nest(unary); }
    return power();
  };
  const power = (): Node => {
    const base = atom();
    if (!isOp("^")) return base;
    at++;
    const exponent = nest(unary); // right-associative
    return (v) => Math.pow(base(v), exponent(v));
  };
  const atom = (): Node => {
    const t = peek();
    if (!t) throw new Fail("Formula ends early");
    if (t.t === "num") { at++; return () => t.v; }
    if (t.t === "op" && t.v === "(") { at++; const inner = sum(); if (!isOp(")")) throw new Fail("Missing )"); at++; return inner; }
    if (t.t === "id") {
      at++;
      const name = formulaName(t.v);
      if (isOp("(")) {
        const f = FUNCTIONS[name];
        if (!f) throw new Fail(`Unknown function "${t.v}". Try ${Object.keys(FUNCTIONS).join(", ")}`);
        at++;
        const args: Node[] = [];
        if (!isOp(")")) { args.push(sum()); while (isOp(",")) { at++; args.push(sum()); } }
        if (!isOp(")")) throw new Fail("Missing )");
        at++;
        if (args.length < f.args[0] || args.length > f.args[1]) throw new Fail(`${name}() takes ${f.args[0] === f.args[1] ? f.args[0] : `${f.args[0]} to ${f.args[1]}`} value${f.args[1] === 1 ? "" : "s"}`);
        return (v) => f.fn(...args.map((a) => a(v)));
      }
      if (known.includes(name)) { uses.add(name); return (v) => v[name] ?? NaN; }
      if (name in CONSTANTS) return () => CONSTANTS[name];
      throw new Fail(`Unknown variable "${t.v}". Available: ${known.join(", ")}`);
    }
    throw new Fail(t.v === ")" ? "Unexpected )" : `Unexpected "${t.v}"`);
  };

  try {
    const root = sum();
    const rest = peek();
    if (rest) throw new Fail(rest.t === "op" && rest.v === ")" ? "Unexpected )" : `Unexpected "${rest.t === "num" ? rest.v : rest.v}". Use * to multiply`);
    if (!uses.size) throw new Fail(`Use at least one variable: ${known.join(", ")}`);
    return { ok: true, source: text, uses: [...uses], evaluate: (vars) => { const x = root(vars); return Number.isFinite(x) ? x : undefined; } };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, error: e.message };
    throw e;
  }
}
