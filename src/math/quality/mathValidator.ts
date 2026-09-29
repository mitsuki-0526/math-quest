import type { Problem } from '../template';
import { eq, rat, toNumber, type Rational } from '../rational';
import { parseExpression } from '../expr';
import { reject, type Rejection } from './rejectReason';

/**
 * 数学的な 検査(決定論的。AI には 判定させない)。問題を 作る プログラムとは 別に、できあがった 問題そのものを 確かめる。
 * テスト(tests/templates.test.ts)では 別解法の 式(verify)とも 照合しているが、ゲームの 中では 式を 実行しないで
 * 確かめられることだけを 見る(速く、安全に)
 */
export const MATH_VALIDATOR_VERSION = '1.0';

/** 文字化けの しるし */
const BROKEN = /NaN|undefined|Infinity|\[object|null\b|\t/;

export function validateMath(p: Problem): Rejection | null {
  // 1. 文字化け
  for (const s of [p.prompt, p.promptText, p.hint, ...p.explanation]) {
    if (BROKEN.test(s)) return reject('BROKEN_TEXT', `「${s.slice(0, 40)}」に 文字化け`);
  }
  if (!p.promptText.trim() || p.explanation.length === 0) return reject('BROKEN_TEXT', '問題文か 解説が 空');

  // 2. 答えが 成り立つか
  const a = p.answer;
  switch (a.kind) {
    case 'number':
      if (!isFiniteRat(a.value)) return reject('INVALID_ANSWER', '答えが 数でない');
      break;
    case 'numbers':
      if (a.values.length === 0 || !a.values.every(isFiniteRat)) return reject('INVALID_ANSWER', '答えの 組が 空か 数でない');
      break;
    case 'choice':
      if (a.options.length < 2) return reject('INVALID_CHOICE', '選択肢が 2 つ未満');
      if (new Set(a.options).size !== a.options.length) return reject('INVALID_CHOICE', `選択肢が 重複: ${a.options.join(' / ')}`);
      if (!Number.isInteger(a.correct) || a.correct < 0 || a.correct >= a.options.length) return reject('INVALID_CHOICE', `正解の 番号 ${a.correct} が 範囲外`);
      break;
    case 'factorization':
      if (!Number.isInteger(a.n) || a.n < 2) return reject('INVALID_ANSWER', `素因数分解する 数 ${a.n} が 不正`);
      break;
    case 'expression':
      if (!parseExpression(a.expected)) return reject('INVALID_EXPRESSION', `答えの 式「${a.expected}」が 読めない`);
      break;
  }

  // 3. 解説の「答え」と 正解が 一致するか(数の 答えだけ。答えの 行が ない 解説は 見ない)
  const mismatch = checkAnswerLine(p);
  if (mismatch) return mismatch;

  // 4. よくある まちがいが 正解と 同じに なっていないか(generateProblem で 取り除くが、念のため)
  if (a.kind === 'number') {
    for (const m of p.mistakes ?? []) if (m.answer.kind === 'number' && eq(m.answer.value, a.value)) return reject('MISTAKE_EQUALS_ANSWER', `まちがい例「${m.say}」が 正解と 同じ値`);
  }
  return null;
}

function isFiniteRat(r: Rational): boolean {
  return r && typeof r.n === 'bigint' && typeof r.d === 'bigint' && r.d !== 0n;
}

/** 解説の「答え」の 行に 出てくる 数(分数・小数・負の数)を 取り出す */
export function numbersInTex(tex: string): Rational[] {
  const out: Rational[] = [];
  const s = tex.replace(/−/g, '-');
  // 分数: -\frac{3}{4}
  const fracRe = /(-?)\s*\\frac\{(\d+)\}\{(\d+)\}/g;
  let rest = s.replace(fracRe, (_m, sign: string, n: string, d: string) => {
    out.push(rat(BigInt(n) * (sign ? -1n : 1n), BigInt(d)));
    return ' ';
  });
  // 答えの 行の 単位(kg など)や \text{} の 中の 日本語は 数に ならないので そのまま
  rest = rest.replace(/\\[a-zA-Z]+/g, ' ');
  for (const m of rest.matchAll(/-?\d+(?:\.\d+)?/g)) {
    const [ip, fp = ''] = m[0].replace('-', '').split('.');
    const neg = m[0].startsWith('-');
    const den = 10n ** BigInt(fp.length);
    out.push(rat((BigInt(ip) * den + BigInt(fp || '0')) * (neg ? -1n : 1n), den));
  }
  return out;
}

function checkAnswerLine(p: Problem): Rejection | null {
  const line = [...p.explanation].reverse().find((l) => l.includes('答え'));
  if (!line) return null;
  const a = p.answer;
  const shown = numbersInTex(line.slice(line.indexOf('答え')));
  if (a.kind === 'number') {
    if (!shown.some((r) => eq(r, a.value))) return reject('ANSWER_MISMATCH', `解説の 答え「${line}」に 正解 ${toNumber(a.value)} が ない`);
  }
  if (a.kind === 'numbers') {
    for (const v of a.values) if (!shown.some((r) => eq(r, v))) return reject('ANSWER_MISMATCH', `解説の 答え「${line}」に ${toNumber(v)} が ない`);
  }
  return null;
}
