import { normalizeInput } from './rational';

/** 素数判定(小さな数向け) */
export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
}

/** 素因数分解(昇順の配列。12 → [2,2,3]) */
export function primeFactors(n: number): number[] {
  const out: number[] = [];
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    while (m % p === 0) {
      out.push(p);
      m /= p;
    }
  }
  if (m > 1) out.push(m);
  return out;
}

/** 素因数分解を累乗つきの KaTeX にする。[2,2,3] → "2^{2} \times 3" */
export function factorsToTex(factors: number[]): string {
  const counts = new Map<number, number>();
  for (const f of factors) counts.set(f, (counts.get(f) ?? 0) + 1);
  return [...counts.entries()].map(([p, e]) => (e === 1 ? `${p}` : `${p}^{${e}}`)).join(' \\times ');
}

/** 平文用。[2,2,3] → "2²×3" */
export function factorsToText(factors: number[]): string {
  const counts = new Map<number, number>();
  for (const f of factors) counts.set(f, (counts.get(f) ?? 0) + 1);
  return [...counts.entries()].map(([p, e]) => (e === 1 ? `${p}` : `${p}${toSuperscript(e)}`)).join('×');
}

const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
function toSuperscript(n: number): string {
  return String(n)
    .split('')
    .map((c) => SUPERSCRIPTS[Number(c)])
    .join('');
}
function fromSuperscript(s: string): string {
  return s
    .split('')
    .map((c) => {
      const i = SUPERSCRIPTS.indexOf(c);
      return i >= 0 ? String(i) : c;
    })
    .join('');
}

export interface ParsedFactorization {
  factors: number[];
  product: number;
  allPrime: boolean;
}

/**
 * 「2×2×3」「2^2×3」「2²×3」「2*2*3」「2x2x3」などを解釈する。
 * 因数が全部素数かどうかは呼び出し側で判定に使う(積が合っていても分けきれていなければ不正解)。
 */
export function parseFactorization(raw: string): ParsedFactorization | null {
  let s = normalizeInput(raw).toLowerCase();
  // 上付き数字(²³)を ^2 ^3 に直し、区切り(x, ×→* 済み)を * に統一
  // ¹²³ は U+00B9/B2/B3 で、⁰⁴〜⁹(U+2070〜)と離れているので範囲指定にしない
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => '^' + fromSuperscript(m));
  s = s.replace(/x/g, '*');
  if (!/^[\d*^]+$/.test(s)) return null;
  const parts = s.split('*').filter(Boolean);
  if (parts.length === 0) return null;
  const factors: number[] = [];
  for (const part of parts) {
    const m = /^(\d+)(?:\^(\d+))?$/.exec(part);
    if (!m) return null;
    const base = Number(m[1]);
    const exp = m[2] ? Number(m[2]) : 1;
    if (base < 1 || exp < 1 || exp > 20) return null;
    for (let i = 0; i < exp; i++) factors.push(base);
  }
  const product = factors.reduce((a, b) => a * b, 1);
  return { factors, product, allPrime: factors.every(isPrime) };
}
