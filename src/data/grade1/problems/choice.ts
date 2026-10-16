import type { Mistake, Problem } from '@/math/template';
import type { Rng } from '@/math/rng';
import { type Rational, toTex, toString } from '@/math/rational';
import { text } from '@/math/format';

/**
 * 第5〜7章で 使う 小さな 部品(選択肢と π の 答え)。
 * 選択肢は 教科書の 言葉で 書き、まちがいの 選択肢には それを 選んだ 子への 一言(よくある まちがい)を 付ける
 */

/** 選択肢の 1 つ。say が あれば、それを 選んだ 子への 一言に なる */
export interface Wrong {
  opt: string;
  say?: string;
}

/**
 * 選択肢を 作る。正解と 同じ 表示・重なる 表示は 取り除き、のこりから max - 1 個。
 * 文字は \text{} に 入れて 返す(問題文と 同じ 書体)
 */
export function choose(rng: Rng, correct: string, wrongs: Wrong[], max = 4): { answer: Problem['answer']; mistakes: Mistake[] } {
  const seen = new Set([correct]);
  const picked: Wrong[] = [];
  for (const w of wrongs) {
    if (seen.has(w.opt) || picked.length >= max - 1) continue;
    seen.add(w.opt);
    picked.push(w);
  }
  const raw = rng.shuffle([correct, ...picked.map((w) => w.opt)]);
  const options = raw.map((o) => text(o));
  const mistakes = picked
    .filter((w) => w.say)
    .map((w) => ({ answer: { kind: 'choice' as const, options, correct: raw.indexOf(w.opt) }, say: w.say! }));
  return { answer: { kind: 'choice', options, correct: raw.indexOf(correct) }, mistakes };
}

/** π の 係数(分数も)を 式の 答え(5/3π)に */
export const piExpr = (c: Rational): string => `${toString(c)}π`;
/** π の 係数を TeX に(\frac{5}{3}\pi、3\pi、\pi) */
export const piTex = (c: Rational): string => {
  const s = toTex(c);
  return s === '1' ? '\\pi' : `${s}\\pi`;
};
/** 式で 答える 問題の まちがい */
export const mistakeExpr = (expected: string, say: string): Mistake => ({ answer: { kind: 'expression', expected }, say });
/** π の 係数で 書く まちがい(0 以下・正解と 同じ は generateProblem が 取り除く) */
export const mistakePi = (c: Rational, say: string): Mistake => mistakeExpr(piExpr(c), say);
