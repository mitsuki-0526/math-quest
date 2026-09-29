import { addTeacherRejected } from '@/math/quality/judge';

/**
 * 先生の 一括判定(npm run review:export の CSV)で × に なった 問題。キー(Problem.key)→ 理由。
 * Judge(src/math/quality/judge.ts)が この問題を 出さない。
 * 1 問ずつ 足すより、同じ理由の × は 問題を 作る ルールを 直して まとめて 出ないように するのが 本筋。
 * ここには ルールで 表しにくい 1 問だけの × を 入れる
 */
export const teacherRejected: Record<string, string> = {};

addTeacherRejected(teacherRejected);
