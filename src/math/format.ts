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

/**
 * 文字(x・a・n など)を ふくむ 文章を、文字だけ 数式(斜体)に して \text{} で つなぐ。
 * \text{} の 中の 文字は 立体の ゴシックに なり、教科書の 文字(斜体)と ちがって 見える(先生の判定 2026-10-15「a が 教科書と 違う」)。
 * ほかの 英字と 続いている もの(cm・km)は 単位なので そのまま
 */
export function textVars(s: string, vars = 'abcnxy'): string {
  const parts = s.split(new RegExp(`(?<![A-Za-z])([${vars}])(?![A-Za-z])`));
  return parts.map((p, i) => (i % 2 ? p : p ? text(p) : '')).join(' ');
}

/** 有理数を KaTeX に(負の分数はかっこ付き) */
export function ratTexParen(r: Rational): string {
  const t = toTex(r);
  return r.n < 0n ? `(${t})` : t;
}
