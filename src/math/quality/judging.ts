import { generateProblem, getTemplate, type Difficulty, type Problem } from '../template';
import { createRng } from '../rng';

/**
 * 先生が 1 問ずつ ○/× を 付ける 判定の 中心(持っていける 部品。画面や 保存は ゲーム側)。
 * 判定は 品質の 仕組みの「先生の ものさし」で、ためた 記録(JudgmentRecord)は 次の ゲームでも 手本に なる。
 * ID(テンプレート|★|種)から 同じ問題を 作り直せるので、× の 問題を あとで 特定できる
 */
export type Verdict = 'ok' | 'ng';

export interface JudgeItem {
  id: string;
  templateId: string;
  star: Difficulty;
  problem: Problem;
}

export interface Judgment {
  id: string;
  templateId: string;
  star: Difficulty;
  verdict: Verdict;
  /** × の 理由(選んだ 理由と 自由記述を「 / 」で つなぐ) */
  reason: string;
  question: string;
  answer: string;
  /** 送り先(スプレッドシートなど)に 送ったか */
  sent: boolean;
}

/** × の 理由の 候補(数字キー 1〜8 で 選べる)。理由ごとに 集計して 直す 所を 決める */
export const NG_REASONS = ['数が 大きい・早い', '難しすぎる', 'やさしすぎる', '文が 不自然・分かりにくい', '解説が 分かりにくい', '答え・解説が まちがい', '習っていない 内容', 'その他'];

export const judgeId = (templateId: string, star: Difficulty, seed: number) => `${templateId}|${star}|${seed}`;

/** ID から 問題を 作り直す(同じ ID なら いつも 同じ問題) */
export function problemFromId(id: string): Problem {
  const [templateId, star, seed] = id.split('|');
  return generateProblem(templateId, Number(star) as Difficulty, [], createRng(Number(seed) * 7919 + Number(star)));
}

/**
 * 出題タイプ × ★ ごとに per 問の 判定の 列。同じ 出題タイプ・★ を 続けて 並べる(比べながら 判定しやすいように)。
 * 同じ問題(キーが 同じ)は 1 回だけ。seedBase は 範囲(章など)ごとに 変える(ID が ぶつからないように)
 */
export function buildJudgeQueue(templateIds: readonly string[], seedBase: number, per: number): JudgeItem[] {
  const out: JudgeItem[] = [];
  for (const templateId of templateIds)
    for (const star of [1, 2, 3] as Difficulty[]) {
      const keys = new Set<string>();
      for (let i = 1, made = 0; made < per && i <= per * 5; i++) {
        const id = judgeId(templateId, star, seedBase + i);
        const problem = problemFromId(id);
        if (keys.has(problem.key)) continue;
        keys.add(problem.key);
        out.push({ id, templateId, star, problem });
        made++;
      }
    }
  return out;
}

/**
 * 判定を 文字に(チャットに 貼る用)。タブ区切りで、npm run review:import が そのまま 読める。
 * × を 先に。○ も「良い問題の 例」として 残す
 */
export function judgmentsToText(list: Judgment[]): string {
  const ng = list.filter((j) => j.verdict === 'ng');
  const ok = list.filter((j) => j.verdict === 'ok');
  const lines = [`【1問ずつの判定】 ○ ${ok.length} / × ${ng.length}`, ['ID', '判定', '理由', '単元', '出題タイプ', '★', '問題', '正解'].join('\t')];
  for (const j of [...ng, ...ok]) {
    const t = safeTemplate(j.templateId);
    lines.push([j.id, j.verdict === 'ok' ? '○' : '×', j.reason, t?.unit ?? '', t?.title ?? j.templateId, String(j.star), j.question, j.answer].map((s) => s.replace(/[\t\n]/g, ' ')).join('\t'));
  }
  return lines.join('\n');
}

function safeTemplate(id: string) {
  try {
    return getTemplate(id);
  } catch {
    return null;
  }
}
