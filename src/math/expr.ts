import { rat, add, mul, div, neg, eq, isZero, toTex, type Rational } from './rational';
import { normalizeInput } from './rational';

/**
 * 式の入力と同値判定(要件 F44 段階2)。
 * 中学範囲に絞った自作エンジン: 有理数係数の多項式(複数の文字、整数の指数)を正規形にして比べる。
 *   2x+3 と 3+2x、x+x と 2x、(x+1)*2 と 2x+2 は同じ
 *   x² と x*x は同じ。3a²b の形も扱う
 * 段階3以降(√の簡約・因数分解形の判定)は 3年版で足す。
 */

// ---------------------------------------------------------------- 多項式

/** 単項式: 係数 × 変数の積。vars は変数名 → 指数(昇順に正規化したキーで持つ) */
export interface Term {
  coef: Rational;
  vars: Record<string, number>;
}

export interface Poly {
  terms: Term[];
}

const varKey = (vars: Record<string, number>): string =>
  Object.entries(vars)
    .filter(([, e]) => e !== 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([v, e]) => `${v}^${e}`)
    .join('*');

export const constPoly = (r: Rational): Poly => (isZero(r) ? { terms: [] } : { terms: [{ coef: r, vars: {} }] });
export const varPoly = (name: string): Poly => ({ terms: [{ coef: rat(1), vars: { [name]: 1 } }] });

/** 同じ変数部分の項をまとめ、係数 0 の項を落とす */
export function normalize(p: Poly): Poly {
  const map = new Map<string, Term>();
  for (const t of p.terms) {
    const vars: Record<string, number> = {};
    for (const [v, e] of Object.entries(t.vars)) if (e !== 0) vars[v] = e;
    const key = varKey(vars);
    const cur = map.get(key);
    if (cur) cur.coef = add(cur.coef, t.coef);
    else map.set(key, { coef: t.coef, vars });
  }
  const terms = [...map.values()].filter((t) => !isZero(t.coef));
  // 次数の高い順 → 変数名順(表示のため)
  terms.sort((a, b) => degree(b) - degree(a) || (varKey(a.vars) < varKey(b.vars) ? -1 : 1));
  return { terms };
}

const degree = (t: Term): number => Object.values(t.vars).reduce((a, b) => a + b, 0);

export const addPoly = (a: Poly, b: Poly): Poly => normalize({ terms: [...a.terms, ...b.terms] });
export const negPoly = (a: Poly): Poly => ({ terms: a.terms.map((t) => ({ coef: neg(t.coef), vars: t.vars })) });
export const subPoly = (a: Poly, b: Poly): Poly => addPoly(a, negPoly(b));

export function mulPoly(a: Poly, b: Poly): Poly {
  const terms: Term[] = [];
  for (const x of a.terms)
    for (const y of b.terms) {
      const vars: Record<string, number> = { ...x.vars };
      for (const [v, e] of Object.entries(y.vars)) vars[v] = (vars[v] ?? 0) + e;
      terms.push({ coef: mul(x.coef, y.coef), vars });
    }
  return normalize({ terms });
}

/** 多項式 ÷ 定数。定数以外での割り算は中学1〜2年の答えの形にないので扱わない */
export function divPoly(a: Poly, b: Poly): Poly | null {
  if (b.terms.length !== 1 || degree(b.terms[0]) !== 0) return null;
  const d = b.terms[0].coef;
  if (isZero(d)) return null;
  return normalize({ terms: a.terms.map((t) => ({ coef: div(t.coef, d), vars: t.vars })) });
}

export function powPoly(a: Poly, e: number): Poly | null {
  if (!Number.isInteger(e) || e < 0 || e > 6) return null;
  let out = constPoly(rat(1));
  for (let i = 0; i < e; i++) out = mulPoly(out, a);
  return out;
}

/** 2つの多項式が同じか(正規形どうしを比較) */
export function polyEquals(a: Poly, b: Poly): boolean {
  const x = normalize(a);
  const y = normalize(b);
  if (x.terms.length !== y.terms.length) return false;
  const key = (t: Term) => varKey(t.vars);
  const ys = new Map(y.terms.map((t) => [key(t), t.coef]));
  for (const t of x.terms) {
    const c = ys.get(key(t));
    if (!c || !eq(c, t.coef)) return false;
  }
  return true;
}

export const isConstPoly = (p: Poly): boolean => normalize(p).terms.every((t) => degree(t) === 0);

/** KaTeX 表示(解説用)。2x^{2}y - 3x + 1 の形 */
export function polyToTex(p: Poly): string {
  const n = normalize(p);
  if (n.terms.length === 0) return '0';
  return n.terms
    .map((t, i) => {
      const neg = t.coef.n < 0n;
      const abs = neg ? { n: -t.coef.n, d: t.coef.d } : t.coef;
      const vars = Object.entries(t.vars)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([v, e]) => {
          const name = v === 'π' ? '\\pi ' : v;
          return e === 1 ? name : `${name}^{${e}}`;
        })
        .join('');
      const coefTex = vars && abs.n === 1n && abs.d === 1n ? '' : toTex(abs);
      const sign = i === 0 ? (neg ? '-' : '') : neg ? ' - ' : ' + ';
      return `${sign}${coefTex}${vars}`;
    })
    .join('');
}

// ---------------------------------------------------------------- 構文解析

type Token = { t: 'num'; v: string } | { t: 'var'; v: string } | { t: 'op'; v: string } | { t: 'lp' } | { t: 'rp' };

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/**
 * 生徒の入力を字句に分ける。× ÷ の全角、² のような上付き、暗黙の掛け算(2x, 3(x+1), xy)に対応する。
 * 変数は 1 文字の英字(a〜z、π は定数として扱わない=中学1〜2年の式入力では使わない)。
 */
export function tokenize(raw: string): Token[] | null {
  const s = normalizeInput(raw)
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => '^' + [...m].map((c) => SUPERSCRIPT.indexOf(c)).join(''))
    .toLowerCase()
    // 円周率は 1 つの文字として扱う。「pi」と打っても π と読む
    .replace(/pi/g, 'π');
  const out: Token[] = [];
  for (let i = 0; i < s.length; ) {
    const c = s[i];
    if (/\d/.test(c)) {
      let j = i;
      while (j < s.length && /[\d.]/.test(s[j])) j++;
      out.push({ t: 'num', v: s.slice(i, j) });
      i = j;
      continue;
    }
    if (/[a-zπ]/.test(c)) {
      out.push({ t: 'var', v: c });
      i++;
      continue;
    }
    if ('+-*/^'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (c === '(') {
      out.push({ t: 'lp' });
      i++;
      continue;
    }
    if (c === ')') {
      out.push({ t: 'rp' });
      i++;
      continue;
    }
    return null; // 扱えない文字(=, √ など)
  }
  return out;
}

/** 暗黙の掛け算を * として補う: 2x → 2*x, 3(x+1) → 3*(x+1), xy → x*y, )( → )*( */
function insertImplicitMul(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i];
    const prev = out[out.length - 1];
    if (prev) {
      const prevEnd = prev.t === 'num' || prev.t === 'var' || prev.t === 'rp';
      const curStart = cur.t === 'num' || cur.t === 'var' || cur.t === 'lp';
      if (prevEnd && curStart) out.push({ t: 'op', v: '*' });
    }
    out.push(cur);
  }
  return out;
}

/**
 * 再帰下降で式 → 多項式。
 *   expr   := term (('+'|'-') term)*
 *   term   := unary (('*'|'/') unary)*
 *   unary  := '-'? power
 *   power  := atom ('^' number)?
 *   atom   := number | var | '(' expr ')'
 */
export function parseExpression(raw: string): Poly | null {
  const t0 = tokenize(raw);
  if (!t0 || t0.length === 0) return null;
  const tokens = insertImplicitMul(t0);
  let pos = 0;

  const peek = () => tokens[pos];
  const eat = (pred: (t: Token) => boolean) => (peek() && pred(peek()) ? tokens[pos++] : null);

  function parseExpr(): Poly | null {
    let left = parseTerm();
    if (!left) return null;
    for (;;) {
      const op = eat((t) => t.t === 'op' && (t.v === '+' || t.v === '-'));
      if (!op) return left;
      const right = parseTerm();
      if (!right) return null;
      left = (op as { v: string }).v === '+' ? addPoly(left, right) : subPoly(left, right);
    }
  }

  function parseTerm(): Poly | null {
    let left = parseUnary();
    if (!left) return null;
    for (;;) {
      const op = eat((t) => t.t === 'op' && (t.v === '*' || t.v === '/'));
      if (!op) return left;
      const right = parseUnary();
      if (!right) return null;
      if ((op as { v: string }).v === '*') left = mulPoly(left, right);
      else {
        const q = divPoly(left, right);
        if (!q) return null;
        left = q;
      }
    }
  }

  function parseUnary(): Poly | null {
    if (eat((t) => t.t === 'op' && t.v === '-')) {
      const p = parseUnary();
      return p ? negPoly(p) : null;
    }
    if (eat((t) => t.t === 'op' && t.v === '+')) return parseUnary();
    return parsePower();
  }

  function parsePower(): Poly | null {
    const base = parseAtom();
    if (!base) return null;
    if (eat((t) => t.t === 'op' && t.v === '^')) {
      const e = eat((t) => t.t === 'num');
      if (!e) return null;
      const n = Number((e as { v: string }).v);
      return powPoly(base, n);
    }
    return base;
  }

  function parseAtom(): Poly | null {
    const n = eat((t) => t.t === 'num');
    if (n) {
      const text = (n as { v: string }).v;
      if (!/^\d+(\.\d+)?$/.test(text)) return null;
      const [int, frac = ''] = text.split('.');
      const scale = 10n ** BigInt(frac.length);
      return constPoly(rat(BigInt(int) * scale + BigInt(frac || '0'), scale));
    }
    const v = eat((t) => t.t === 'var');
    if (v) return varPoly((v as { v: string }).v);
    if (eat((t) => t.t === 'lp')) {
      const inner = parseExpr();
      if (!inner || !eat((t) => t.t === 'rp')) return null;
      return inner;
    }
    return null;
  }

  const result = parseExpr();
  if (!result || pos !== tokens.length) return null;
  return normalize(result);
}

/**
 * 生徒の入力が期待する式と同値か。
 * 同値でも「書き方のきまり」に反する場合は note を返す(判定は正解のまま、解説で書き方を伝える)。
 */
export function judgeExpression(expected: string, input: string): { correct: boolean; note?: string } {
  const want = parseExpression(expected);
  const got = parseExpression(input);
  if (!want) throw new Error(`期待する式が解釈できない: ${expected}`);
  if (!got) return { correct: false, note: noteForBadExpr(input) };
  if (!polyEquals(want, got)) return { correct: false };
  return { correct: true, note: styleNote(input) };
}

function noteForBadExpr(input: string): string | undefined {
  const s = normalizeInput(input);
  if (!s) return '答えを 入れてから こうげき!';
  if (/=/.test(s)) return '「=」は いりません。答えの式だけ 入れよう';
  if (/[√π]/.test(s)) return 'この問題では √ や π は 使いません';
  if (/[a-z]{1}\d/i.test(s)) return '文字と数の 順番に 注意。3x のように 数を 先に 書きます';
  return '式として 読めません。x や ( ) の 使い方を 確かめよう';
}

/** 同値だが書き方が教科書と違うときの注意(正解にはする) */
function styleNote(input: string): string | undefined {
  const s = normalizeInput(input).toLowerCase();
  if (/[a-z]\d/.test(s.replace(/\^\d+/g, ''))) return '書き方のこつ: 数を 先に 書きます(x3 → 3x)';
  if (/\*/.test(s)) return '書き方のこつ: 文字式では × を 省きます(3×x → 3x)';
  if (/1[a-z]/.test(s)) return '書き方のこつ: 係数の 1 は 省きます(1x → x)';
  return undefined;
}
