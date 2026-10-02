import type { Difficulty, Problem } from '../template';
import { toNumber } from '../rational';
import { reject, type Rejection } from './rejectReason';

/**
 * 問題の 仕様(ProblemSpec)。「どんな問題を 作るか」を データで 決め、できた 問題が はみ出していないかを 確かめる。
 * docs/difficulty.md の ★ ごとの 表を、プログラムで 読める 形に したもの(仕様は 文書と ここの 両方を 直す)。
 * 学年ごとの データ(src/data/grade1/specs.ts)が registerSpecs で 登録する。
 * 問題を 作る プログラム(Generator)は 仕様に 合わせて 作るが、信用せずに ここで 確かめる
 */
export interface ProblemSpec {
  templateId: string;
  difficulty: Difficulty;
  /** 学年(中1 = 1) */
  grade: number;
  /** 単元(教科書の章名) */
  unit: string;
  /** 問題文に 出てくる 数の 絶対値の 上限(小数・分数の 分子分母も ふくむ) */
  maxNumber?: number;
  /** 問題文に 出てくる 数の 個数(項の数など)[最小, 最大] */
  numberCount?: [number, number];
  /** 答え(数)の 絶対値の 上限 */
  maxAnswer?: number;
  /** 答えは 整数だけ */
  integerAnswer?: boolean;
  /** 素因数分解する 数の 範囲 [最小, 最大] */
  factorRange?: [number, number];
  /** 使ってはいけない 書き方(未習の 記号 など) */
  forbid?: { pattern: RegExp; why: string }[];
  /**
   * 出題の 形(問題の tags)ごとの 上書き。同じ ★ に 形の ちがう 問題を まぜるとき
   * (例: 分配法則の 工夫は 63・37 のような 2 けたを 使う)、その形だけ 範囲を 変える
   */
  forms?: Record<string, Partial<Pick<ProblemSpec, 'maxNumber' | 'numberCount' | 'maxAnswer' | 'integerAnswer'>>>;
  /** 根拠(教科書・チャレンジテスト・先生の印) */
  source: string;
}

export const SPEC_VERSION = '1.0';

const specs = new Map<string, ProblemSpec>();
const keyOf = (templateId: string, d: Difficulty) => `${templateId}|${d}`;

export function registerSpecs(list: ProblemSpec[]): void {
  for (const s of list) specs.set(keyOf(s.templateId, s.difficulty), s);
}

export function getSpec(templateId: string, d: Difficulty): ProblemSpec | undefined {
  return specs.get(keyOf(templateId, d));
}

export function allSpecs(): ProblemSpec[] {
  return [...specs.values()];
}

/** 問題文の 数(符号なし。「(例: 2×2×3 …)」の 例は 数えない) */
export function numbersInText(text: string): number[] {
  return (text.replace(/\(例:.*?\)/g, '').match(/\d+(\.\d+)?/g) ?? []).map(Number);
}

/** 仕様から はみ出していないか。仕様が ない テンプレートは 見ない */
export function validateSpec(p: Problem, base: ProblemSpec | undefined = getSpec(p.templateId, p.difficulty)): Rejection | null {
  if (!base) return null;
  const form = Object.keys(base.forms ?? {}).find((t) => p.tags.includes(t));
  const spec: ProblemSpec = form ? { ...base, ...base.forms![form] } : base;
  const nums = numbersInText(p.promptText);
  if (spec.maxNumber !== undefined) {
    const big = nums.find((n) => n > spec.maxNumber!);
    if (big !== undefined) return reject('SPEC_VIOLATION', `数 ${big} が 上限 ${spec.maxNumber} を 超える`);
  }
  if (spec.numberCount && (nums.length < spec.numberCount[0] || nums.length > spec.numberCount[1])) {
    return reject('SPEC_VIOLATION', `数の 個数 ${nums.length} が ${spec.numberCount[0]}〜${spec.numberCount[1]} の 外`);
  }
  if (p.answer.kind === 'number') {
    const v = toNumber(p.answer.value);
    if (spec.maxAnswer !== undefined && Math.abs(v) > spec.maxAnswer) return reject('SPEC_VIOLATION', `答え ${v} が 上限 ${spec.maxAnswer} を 超える`);
    if (spec.integerAnswer && !Number.isInteger(v)) return reject('SPEC_VIOLATION', `答え ${v} が 整数でない`);
  }
  if (spec.factorRange && p.answer.kind === 'factorization') {
    const [lo, hi] = spec.factorRange;
    if (p.answer.n < lo || p.answer.n > hi) return reject('SPEC_VIOLATION', `素因数分解する 数 ${p.answer.n} が ${lo}〜${hi} の 外`);
  }
  for (const f of spec.forbid ?? []) {
    if (f.pattern.test(p.promptText) || f.pattern.test(p.prompt)) return reject('OUT_OF_SCOPE', f.why);
  }
  return null;
}
