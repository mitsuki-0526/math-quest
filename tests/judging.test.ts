import { describe, it, expect, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// node には localStorage が ないので 最小のものを 用意する
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const { buildChapterJudgeQueue: buildJudgeQueue, problemFromId, setJudgment, judgeStore, judgmentsToText, clearAllJudgments } = await import('@/engine/judging');
await import('@/data/grade1/problems');
const { grade1 } = await import('@/data/grade1/chapters');

/** 1 問ずつ ○/× を 付ける 判定(先生用) */
describe('判定', () => {
  it('ID から いつも 同じ問題を 作り直せる(× の 問題を あとで 特定できる)', () => {
    const q = buildJudgeQueue(grade1.chapters[0], 5);
    for (const item of q.slice(0, 40)) expect(problemFromId(item.id).key).toBe(item.problem.key);
    // 出題タイプ × ★ ごとに 最大 5 問、同じ問題は 入らない
    expect(new Set(q.map((i) => i.id)).size).toBe(q.length);
    expect(q.length).toBeLessThanOrEqual((grade1.chapters[0].templates?.length ?? 0) * 3 * 5);
  });

  it('コピーした 文を review:import が 読んで × を まとめる', () => {
    clearAllJudgments();
    const q = buildJudgeQueue(grade1.chapters[0], 5);
    setJudgment(q[0], 'ok', '', '0');
    setJudgment(q[1], 'ng', '数が 大きい・早い', '−6');
    setJudgment(q[2], 'ng', '解説が 分かりにくい', '−1');
    const text = judgmentsToText(Object.values(judgeStore.get()));
    expect(text).toMatch(/○ 1 \/ × 2/);
    const dir = mkdtempSync(join(tmpdir(), 'mq-judge-'));
    const file = join(dir, 'judge.txt');
    writeFileSync(file, text);
    const dataset = join(dir, 'judgments.jsonl');
    const r = spawnSync('node', ['scripts/review-import.mjs', file], { encoding: 'utf8', env: { ...process.env, MQ_JUDGMENTS: dataset } });
    expect(r.status, r.stderr).toBe(0);
    const summary = readFileSync(file.replace(/\.txt$/, '') + '.txt-summary.md', 'utf8');
    expect(summary).toMatch(/判定あり 3 問 \/ × 2 問/);
    expect(summary).toMatch(/数が 大きい・早い ×1/);
    // 判定の 記録(次の ゲームへ 持っていける)。単元つき、個人情報なし
    const records = readFileSync(dataset, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(records).toHaveLength(3);
    expect(records.find((x) => x.verdict === 'ng')).toMatchObject({ unit: '正の数と負の数', templateId: 'g1.sign.addsub' });
    expect(Object.keys(records[0]).sort()).toEqual(['answer', 'game', 'id', 'judgedAt', 'question', 'reasons', 'star', 'templateId', 'type', 'unit', 'verdict']);
    // 同じ ID を もう一度 取りこむと 上書き(ふえない)
    spawnSync('node', ['scripts/review-import.mjs', file], { encoding: 'utf8', env: { ...process.env, MQ_JUDGMENTS: dataset } });
    expect(readFileSync(dataset, 'utf8').trim().split('\n')).toHaveLength(3);
  });
});
