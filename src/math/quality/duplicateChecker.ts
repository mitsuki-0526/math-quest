import type { Problem } from '../template';
import { reject, type Rejection } from './rejectReason';

/**
 * 重複の 検査。まずは 簡単な 方法で:
 *   ・同じ問題(キーが 同じ)を 直近 6 問の 中で 出さない
 *   ・数だけ ちがう 同じ形の 問題を 3 問 続けない(「(+7) + (−2)」「(+3) + (−5)」「(+1) + (−9)」…)
 * 形は 問題文の 数を # に 置きかえた 文字列(将来 文の 近さで 比べるときも ここを 差しかえる)
 */
export const RECENT_WINDOW = 6;

export function shapeOf(p: Problem): string {
  return p.promptText.replace(/[−-]?\d+(\.\d+)?/g, '#');
}

export interface ProblemHistory {
  keys: readonly string[];
  shapes: readonly string[];
}

/**
 * テンプレート × ★ ごとに これまでに 見た 形。形が 1 つしかない テンプレート(「N を 素因数分解せよ」など)は
 * 同じ形が 続くのが 当たり前なので、「同じ形の 3 連続」を 見ない(見ると 作り直しが 止まらない。品質レポートで 分かった)
 */
const knownShapes = new Map<string, Set<string>>();

export function checkDuplicate(p: Problem, history: ProblemHistory): Rejection | null {
  const shape = shapeOf(p);
  // ★ ごとに 形の 数が ちがう(規則性の ★2 は 1 つ、★3 は 2 つ など)ので、テンプレート × ★ で 数える
  const k = `${p.templateId}|${p.difficulty}`;
  const seen = knownShapes.get(k) ?? new Set<string>();
  if (seen.size < 50) seen.add(shape);
  knownShapes.set(k, seen);
  if (history.keys.slice(-RECENT_WINDOW).includes(p.key)) return reject('DUPLICATE', `直近 ${RECENT_WINDOW} 問に 同じ問題`);
  const last2 = history.shapes.slice(-2);
  if (seen.size >= 2 && last2.length === 2 && last2.every((s) => s === shape)) return reject('SAME_FORM', `同じ形が 3 問 続く: ${shape.slice(0, 40)}`);
  return null;
}
