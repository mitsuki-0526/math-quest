import { getTemplate, type Problem } from '../template';
import { reject, type RejectReason, type Rejection } from './rejectReason';
import { CURRICULUM_RULES } from './rules/curriculum';

/**
 * 教育的な 検査(Judge)。数学的に 正しい 問題が、学習問題として ふさわしいかを 見る。
 * ゲームの 中では AI を 使わない(生徒の 端末から 外部に 送らない・速さ・費用)。ルールは 2 種類:
 *   ・学年・単元の 決まり(rules/curriculum.ts)… 学習指導要領と 先生の 方針。ゲームが 変わっても 持っていける
 *   ・ゲームごとの 調整(registerJudgeRules で 足す)… 先生の 一括判定で × に なった 問題(addTeacherRejected)など
 * 部品を ほかの ゲームで 使う 手順は docs/quality-kit.md
 */
export interface JudgeRule {
  id: string;
  reason: RejectReason;
  /** 当てる 範囲(省略時は すべて)。単元は テンプレートの unit(教科書の 章名) */
  scope?: { units?: readonly string[]; templates?: readonly string[] };
  /** 当てはまったら その説明、問題なければ null */
  test(p: Problem): string | null;
  /** 根拠(学習指導要領・先生の 印 など)。ほかの ゲームに 持っていくとき 判断の 材料に する */
  source?: string;
}

/** ゲームごとの ルール(学年の データが 登録する) */
const gameRules: JudgeRule[] = [];
export function registerJudgeRules(rules: JudgeRule[]): void {
  gameRules.push(...rules);
}

/** 先生の 一括判定で × に なった 問題の キー → 理由(ゲームごとの データから 登録) */
const teacherRejected: Record<string, string> = {};
export function addTeacherRejected(map: Record<string, string>): void {
  Object.assign(teacherRejected, map);
}

const TEACHER_RULE: JudgeRule = {
  id: 'teacher-rejected',
  reason: 'TEACHER_REJECTED',
  test: (p) => {
    const note = teacherRejected[p.key];
    return note ? `先生の判定で ×: ${note}` : null;
  },
};

export const JUDGE_VERSION = '1.1';

/** いま 当てる ルール すべて(学年・単元の 決まり → ゲームごと → 先生の ×) */
export function activeJudgeRules(): JudgeRule[] {
  return [...CURRICULUM_RULES, ...gameRules, TEACHER_RULE];
}

function inScope(r: JudgeRule, p: Problem): boolean {
  if (!r.scope) return true;
  if (r.scope.templates && !r.scope.templates.includes(p.templateId)) return false;
  if (r.scope.units) {
    let unit = '';
    try {
      unit = getTemplate(p.templateId).unit;
    } catch {
      return false;
    }
    if (!r.scope.units.includes(unit)) return false;
  }
  return true;
}

export function judgeProblem(p: Problem, rules: readonly JudgeRule[] = activeJudgeRules()): Rejection | null {
  for (const r of rules) {
    if (!inScope(r, p)) continue;
    const detail = r.test(p);
    if (detail) return reject(r.reason, `[${r.id}] ${detail}`);
  }
  return null;
}
