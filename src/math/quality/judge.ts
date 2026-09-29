import type { Problem } from '../template';
import { reject, type RejectReason, type Rejection } from './rejectReason';

/**
 * 教育的な 検査(Judge)。数学的に 正しい 問題が、学習問題として ふさわしいかを 見る。
 * ゲームの 中では AI を 使わない(生徒の 端末から 外部に 送らない・速さ・費用)。ここでは
 *   ・学習指導要領と 先生の 方針から 決めた ルール(未習の 記号、係数の 分母に 文字 など)
 *   ・先生の 一括判定で × に なった 問題(学年の データが addTeacherRejected で 登録する。src/data/grade1/rejected.ts)
 * を 確かめる。ルールは データとして 足していける。開発中に AI(Codex)の 意見を 聞くときは、
 * 書き出した 問題例を 見てもらい、ここに ルールとして 取りこむ
 */
/** 先生の 一括判定で × に なった 問題の キー → 理由(学年ごとの データから 登録) */
const teacherRejected: Record<string, string> = {};
export function addTeacherRejected(map: Record<string, string>): void {
  Object.assign(teacherRejected, map);
}

export interface JudgeRule {
  id: string;
  reason: RejectReason;
  /** この ルールを 当てる テンプレート(省略時は すべて) */
  templates?: readonly string[];
  /** 当てはまったら その説明、問題なければ null */
  test(p: Problem): string | null;
}

/** 問題の 文字列 すべて(問題文・選択肢・解説・答えの 式) */
function texts(p: Problem): string[] {
  const a = p.answer;
  return [p.prompt, p.promptText, ...p.explanation, ...(a.kind === 'choice' ? a.options : []), ...(a.kind === 'expression' ? [a.expected] : [])];
}

/** 係数の 問題(同類項・かっこ・代入・規則性)。分母に 文字を 出さない(先生の方針 2026-09-28) */
const COEFFICIENT_TEMPLATES = ['g1.expr.subst', 'g1.expr.collect', 'g1.expr.distribute', 'g1.expr.pattern'];

export const JUDGE_RULES: JudgeRule[] = [
  {
    id: 'no-abs-notation',
    reason: 'OUT_OF_SCOPE',
    // 絶対値の 記号 |−7| は 中学校で 教えない(高校。先生の印 2026-09-27)
    test: (p) => (/\|[^|]*\d[^|]*\||｜/.test(p.promptText) ? '絶対値の 記号を 使っている' : null),
  },
  {
    id: 'no-letter-denominator',
    reason: 'OUT_OF_SCOPE',
    templates: COEFFICIENT_TEMPLATES,
    test: (p) => {
      const t = texts(p).find((s) => /\\frac\{[^{}]*\}\{[^{}]*[a-z][^{}]*\}|\/\s*\(?[a-z]/.test(s));
      return t ? `係数の 問題で 分母に 文字: ${t.slice(0, 40)}` : null;
    },
  },
  {
    id: 'one-letter-like-terms',
    reason: 'OUT_OF_SCOPE',
    templates: ['g1.expr.collect'],
    // 2 文字の 同類項(3a + 2b − a)は 2 年の 内容
    test: (p) => (/[ab]/.test(p.promptText) && /x/.test(p.promptText) ? '2 文字の 同類項(2 年の 内容)' : null),
  },
  {
    id: 'teacher-rejected',
    reason: 'TEACHER_REJECTED',
    test: (p) => {
      const note = teacherRejected[p.key];
      return note ? `先生の判定で ×: ${note}` : null;
    },
  },
];

export const JUDGE_VERSION = '1.0';

export function judgeProblem(p: Problem, rules: readonly JudgeRule[] = JUDGE_RULES): Rejection | null {
  for (const r of rules) {
    if (r.templates && !r.templates.includes(p.templateId)) continue;
    const detail = r.test(p);
    if (detail) return reject(r.reason, `[${r.id}] ${detail}`);
  }
  return null;
}
