import { toTex, type Rational } from './rational';

/** 負の数をかっこで包む: -3 → (-3), 5 → 5 */
export function paren(n: number): string {
  return n < 0 ? `(${n})` : `${n}`;
}

/** 演算子の後ろに置く数: 負ならかっこつき */
export const operand = paren;

/** 平文用の負号(−)に統一 */
export function plainMinus(s: string): string {
  return s.replace(/-/g, '−');
}

/** KaTeX の \text{} で日本語を入れる */
export function text(s: string): string {
  return `\\text{${s}}`;
}

/** 有理数を KaTeX に(負の分数はかっこ付き) */
export function ratTexParen(r: Rational): string {
  const t = toTex(r);
  return r.n < 0n ? `(${t})` : t;
}
