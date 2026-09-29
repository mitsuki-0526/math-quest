import type { ChapterDef } from './types';
import { generateProblem, getTemplate, type Difficulty, type Problem } from '@/math/template';
import { createRng } from '@/math/rng';
import { createStore } from './store';

/**
 * 1 問ずつ ○/× を 付ける 判定(先生用。先生の要望 2026-09-29「CSV より ○× を どんどん 押せるほうが 操作しやすい」)。
 * 判定は 品質の 仕組みの「先生の ものさし」に なる(docs/difficulty.md「問題の品質の 仕組み」)。
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
  /** × の 理由(選んだ 理由と 自由記述) */
  reason: string;
  question: string;
  answer: string;
  /** スプレッドシートに 送ったか */
  sent: boolean;
}

/** × の 理由の 候補(先生の これまでの 印から)。数字キー 1〜8 で 選べる */
export const NG_REASONS = ['数が 大きい・早い', '難しすぎる', 'やさしすぎる', '文が 不自然・分かりにくい', '解説が 分かりにくい', '答え・解説が まちがい', '習っていない 内容', 'その他'];

const idOf = (templateId: string, star: Difficulty, seed: number) => `${templateId}|${star}|${seed}`;

/** ID から 問題を 作り直す(同じ ID なら いつも 同じ問題) */
export function problemFromId(id: string): Problem {
  const [templateId, star, seed] = id.split('|');
  return generateProblem(templateId, Number(star) as Difficulty, [], createRng(Number(seed) * 7919 + Number(star)));
}

/**
 * 章の 出題タイプ × ★ ごとに per 問の 判定の 列。同じ 出題タイプ・★ を 続けて 並べる(比べながら 判定しやすいように)。
 * 同じ問題(キーが 同じ)は 1 回だけ
 */
export function buildJudgeQueue(chapter: ChapterDef, per: number): JudgeItem[] {
  const out: JudgeItem[] = [];
  for (const templateId of chapter.templates ?? [])
    for (const star of [1, 2, 3] as Difficulty[]) {
      const keys = new Set<string>();
      for (let i = 1, made = 0; made < per && i <= per * 5; i++) {
        const seed = chapter.number * 1000 + i;
        const id = idOf(templateId, star, seed);
        const problem = problemFromId(id);
        if (keys.has(problem.key)) continue;
        keys.add(problem.key);
        out.push({ id, templateId, star, problem });
        made++;
      }
    }
  return out;
}

const STORAGE_KEY = 'mq-judgments';

function load(): Record<string, Judgment> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Judgment>;
  } catch {
    return {};
  }
}

export const judgeStore = createStore<Record<string, Judgment>>(load());
judgeStore.subscribe(() => {
  // 途中で 閉じても 判定が 消えないように、端末にも 残す
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(judgeStore.get()));
  } catch {
    /* 保存できない 環境でも 画面は 使える */
  }
});

export function setJudgment(item: JudgeItem, verdict: Verdict, reason: string, answer: string): void {
  judgeStore.set({
    ...judgeStore.get(),
    [item.id]: { id: item.id, templateId: item.templateId, star: item.star, verdict, reason, question: item.problem.promptText, answer, sent: false },
  });
}

export function clearJudgment(id: string): void {
  const next = { ...judgeStore.get() };
  delete next[id];
  judgeStore.set(next);
}

export function clearAllJudgments(): void {
  judgeStore.set({});
}

export function markJudgmentsSent(ids: string[]): void {
  const cur = { ...judgeStore.get() };
  for (const id of ids) if (cur[id]) cur[id] = { ...cur[id], sent: true };
  judgeStore.set(cur);
}

/**
 * 判定を 文字に(チャットに 貼る用)。タブ区切りで、npm run review:import が そのまま 読める。
 * × を 先に、○ は 数だけでなく ID も 残す(○ も「良い問題の 例」として 使う)
 */
export function judgmentsToText(list: Judgment[]): string {
  const ng = list.filter((j) => j.verdict === 'ng');
  const ok = list.filter((j) => j.verdict === 'ok');
  const lines = [`【1問ずつの判定】 ○ ${ok.length} / × ${ng.length}`, ['ID', '判定', '理由', '出題タイプ', '★', '問題', '正解'].join('\t')];
  for (const j of [...ng, ...ok]) lines.push([j.id, j.verdict === 'ok' ? '○' : '×', j.reason, getTemplate(j.templateId).title, String(j.star), j.question, j.answer].map((s) => s.replace(/[\t\n]/g, ' ')).join('\t'));
  return lines.join('\n');
}
