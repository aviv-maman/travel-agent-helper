/**
 * Soulver/Numi-style line calculator for the dashboard scratchpad. A safe,
 * hand-rolled recursive-descent evaluator — NEVER `eval`/`new Function` on user
 * input. Supports `+ - * / ( )`, decimals, and contextual percent shorthand:
 *   `2500 + 8%` → 2700, `3000 - 10%` → 2700, `2500 * 8%` → 200, bare `8%` → 0.08.
 * Any line that isn't a valid expression returns null (rendered as a plain note).
 *
 * The percent is contextual: in an additive chain `A ± B%`, `B%` means a
 * percentage *of the running total A*; anywhere else `B%` is just `B/100`.
 */

type Token =
  | { kind: "num"; value: number }
  | { kind: "op"; value: "+" | "-" | "*" | "/" }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "percent" };

/** A parsed operand: its numeric value, and whether it is a bare percent literal. */
type Operand = { value: number; percent: boolean };

function tokenize(src: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      let j = i + 1;
      while (j < src.length && ((src[j] >= "0" && src[j] <= "9") || src[j] === ".")) j++;
      const num = Number(src.slice(i, j));
      if (!Number.isFinite(num)) return null;
      tokens.push({ kind: "num", value: num });
      i = j;
      continue;
    }
    if (ch === ".") {
      // A number that starts with a decimal point (e.g. ".5").
      let j = i + 1;
      while (j < src.length && src[j] >= "0" && src[j] <= "9") j++;
      if (j === i + 1) return null;
      tokens.push({ kind: "num", value: Number(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ kind: "op", value: ch });
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i++;
      continue;
    }
    if (ch === "%") {
      tokens.push({ kind: "percent" });
      i++;
      continue;
    }
    return null; // any other character → not a math line
  }
  return tokens;
}

/** Recursive-descent parser with a cursor over the token stream. */
class Parser {
  private pos = 0;
  private readonly tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  atEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  // expr := term (('+' | '-') term)*  — additive chain, contextual percent.
  parseExpr(): Operand {
    let left = this.parseTerm();
    let acc = left.value;
    while (true) {
      const t = this.peek();
      if (t?.kind !== "op" || (t.value !== "+" && t.value !== "-")) break;
      this.pos++;
      const right = this.parseTerm();
      const addend = right.percent ? acc * right.value : right.value;
      acc = t.value === "+" ? acc + addend : acc - addend;
      left = { value: acc, percent: false };
    }
    return { value: acc, percent: left.percent };
  }

  // term := factor (('*' | '/') factor)*  — percent resolves to its fraction here.
  private parseTerm(): Operand {
    let left = this.parseFactor();
    while (true) {
      const t = this.peek();
      if (t?.kind !== "op" || (t.value !== "*" && t.value !== "/")) break;
      this.pos++;
      const right = this.parseFactor();
      const value = t.value === "*" ? left.value * right.value : left.value / right.value;
      left = { value, percent: false };
    }
    return left;
  }

  // factor := '-' factor | '(' expr ')' | number '%'?
  private parseFactor(): Operand {
    const t = this.peek();
    if (t?.kind === "op" && t.value === "-") {
      this.pos++;
      const f = this.parseFactor();
      return { value: -f.value, percent: f.percent };
    }
    if (t?.kind === "op" && t.value === "+") {
      this.pos++;
      return this.parseFactor();
    }
    if (t?.kind === "lparen") {
      this.pos++;
      const inner = this.parseExpr();
      if (this.peek()?.kind !== "rparen") throw new Error("expected )");
      this.pos++;
      return { value: inner.value, percent: false };
    }
    if (t?.kind === "num") {
      this.pos++;
      if (this.peek()?.kind === "percent") {
        this.pos++;
        return { value: t.value / 100, percent: true };
      }
      return { value: t.value, percent: false };
    }
    throw new Error("expected a number");
  }
}

/**
 * Evaluate one scratchpad line. Returns the numeric result, or null when the
 * line isn't a (trailing) math expression. Accepts a leading label ended by
 * `:` or `=` (e.g. "hotel = 1250*1.065"), and thousands-separator commas.
 */
export function evalLine(line: string): number | null {
  const seg = (line.split(/[:=]/).pop() ?? line).replace(/,/g, "").trim();
  if (!seg) return null;
  // Require at least one operator/percent so plain numbers/notes stay unlabeled.
  if (!/[+\-*/%]/.test(seg)) return null;
  const tokens = tokenize(seg);
  if (!tokens || tokens.length === 0) return null;
  try {
    const parser = new Parser(tokens);
    const result = parser.parseExpr();
    if (!parser.atEnd()) return null; // trailing garbage → not a clean expression
    return Number.isFinite(result.value) ? result.value : null;
  } catch {
    return null;
  }
}

const FMT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Format a result with thousands separators, rounded to ≤2 decimals. */
export function formatNumber(n: number): string {
  return FMT.format(n);
}
