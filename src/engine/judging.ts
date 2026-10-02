import type { ChapterDef } from './types';
import { createStore } from './store';
import { buildJudgeQueue, type Judgment, type JudgeItem, type Verdict } from '@/math/quality/judging';

/**
 * 1 問ずつ ○/× 判定の ゲーム側(章からの 列の 作り方と、端末への 保存)。
 * 判定の 中心は 持っていける 部品 src/math/quality/judging.ts(docs/quality-kit.md)
 */
export { NG_REASONS, problemFromId, judgmentsToText, type Judgment, type JudgeItem, type Verdict } from '@/math/quality/judging';

/** 章の 出題タイプ × ★ ごとに per 問(ID の 種は 章番号 × 1000 から) */
export function buildChapterJudgeQueue(chapter: ChapterDef, per: number): JudgeItem[] {
  return buildJudgeQueue(chapter.templates ?? [], chapter.number * 1000, per);
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
