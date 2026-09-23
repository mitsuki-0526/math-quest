/**
 * 有理数(分数)の正確な演算と、生徒の入力の正規化・解釈(要件 F41)。
 * 浮動小数を使わず bigint で持つので、0.5 と 1/2 の同値、1/3 と 0.333 の非同値を正しく判定できる。
 */
export interface Rational {
  /** 分子(符号はこちらに持つ) */
  n: bigint;
  /** 分母(常に正) */
  d: bigint;
}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

/** 約分して分母を正にした有理数を作る */
export function rat(n: bigint | number, d: bigint | number = 1n): Rational {
  let nn = BigInt(n);
  let dd = BigInt(d);
  if (dd === 0n) throw new Error('分母が 0');
  if (dd < 0n) {
    nn = -nn;
    dd = -dd;
  }
  const g = gcd(nn, dd) || 1n;
  return { n: nn / g, d: dd / g };
}

export const ZERO = rat(0);
export const ONE = rat(1);

export const add = (a: Rational, b: Rational): Rational => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Rational, b: Rational): Rational => rat(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Rational, b: Rational): Rational => rat(a.n * b.n, a.d * b.d);
export const div = (a: Rational, b: Rational): Rational => rat(a.n * b.d, a.d * b.n);
export const neg = (a: Rational): Rational => rat(-a.n, a.d);
export const abs = (a: Rational): Rational => rat(a.n < 0n ? -a.n : a.n, a.d);
export const eq = (a: Rational, b: Rational): boolean => a.n === b.n && a.d === b.d;
export const isZero = (a: Rational): boolean => a.n === 0n;
export const isInteger = (a: Rational): boolean => a.d === 1n;
export const isNegative = (a: Rational): boolean => a.n < 0n;

/** a と b の大小: a<b → -1, a=b → 0, a>b → 1 */
export function cmp(a: Rational, b: Rational): -1 | 0 | 1 {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
}

/** 整数乗(指数 ≥ 0) */
export function pow(a: Rational, e: number): Rational {
  if (!Number.isInteger(e) || e < 0) throw new Error('指数は 0 以上の整数');
  return rat(a.n ** BigInt(e), a.d ** BigInt(e));
}

export function toNumber(a: Rational): number {
  return Number(a.n) / Number(a.d);
}

/** 表示用の文字列: 整数は "5"、分数は "-3/4" */
export function toString(a: Rational): string {
  return a.d === 1n ? a.n.toString() : `${a.n}/${a.d}`;
}

/** KaTeX 用: 整数は "5"、負数は "-5"、分数は "-\frac{3}{4}" */
export function toTex(a: Rational): string {
  if (a.d === 1n) return a.n.toString();
  const sign = a.n < 0n ? '-' : '';
  const num = a.n < 0n ? -a.n : a.n;
  return `${sign}\\frac{${num}}{${a.d}}`;
}

/**
 * 入力文字列の正規化。全角数字・全角記号・各種マイナス記号・全角スペースを半角に寄せる。
 * 数値以外(x, √ など)もここを通す。
 */
export function normalizeInput(raw: string): string {
  return normalizeChars(raw).replace(/[\s　]+/g, '');
}

/** 文字種だけを正規化する(空白は残す)。帯分数「1 1/2」の検出などに使う */
export function normalizeChars(raw: string): string {
  return raw
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[−–—－ー‐]/g, '-')
    .replace(/[＋]/g, '+')
    .replace(/[／]/g, '/')
    .replace(/[．。]/g, '.')
    .replace(/[×✕✖＊]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[，、]/g, ',')
    .replace(/　/g, ' ')
    .trim();
}

const NUMBER_RE = /^([+-]?)(\d+)(?:\.(\d+))?$/;
const FRACTION_RE = /^([+-]?)(\d+)\/(\d+)$/;

/**
 * 1つの数(整数・小数・分数・負の数)を有理数として解釈する。
 * 式(2+3)、帯分数、分母 0、空文字は null。
 * "-3/4" と "3/-4" のうち、後者は生徒の書き方として一般的でないので受けない。
 */
export function parseRational(raw: string): Rational | null {
  const chars = normalizeChars(raw);
  // 内側に空白がある(帯分数「1 1/2」など)は数として読まない
  if (/\S\s+\S/.test(chars)) return null;
  const s = chars.replace(/\s+/g, '');
  if (!s) return null;
  let m = FRACTION_RE.exec(s);
  if (m) {
    const [, sign, num, den] = m;
    if (BigInt(den) === 0n) return null;
    const r = rat(BigInt(num), BigInt(den));
    return sign === '-' ? neg(r) : r;
  }
  m = NUMBER_RE.exec(s);
  if (m) {
    const [, sign, intPart, frac] = m;
    const scale = 10n ** BigInt(frac?.length ?? 0);
    const r = rat(BigInt(intPart) * scale + BigInt(frac ?? '0'), scale);
    return sign === '-' ? neg(r) : r;
  }
  return null;
}

/** カンマ区切りの複数の数を解釈する。1つでも解釈できなければ null */
export function parseRationalList(raw: string): Rational[] | null {
  const parts = normalizeInput(raw).split(',').filter((p) => p.length > 0);
  if (parts.length === 0) return null;
  const out: Rational[] = [];
  for (const p of parts) {
    const r = parseRational(p);
    if (!r) return null;
    out.push(r);
  }
  return out;
}
