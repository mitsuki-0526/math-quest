import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createNewSave } from '@/engine/save';
import { recordTally, type TallyData } from '@/engine/tally';

/**
 * 授業の集計: ゲーム側で 地点 × 出題タイプ × ★ を数え(engine/tally.ts)、
 * GAS の summarizeTallies が 生徒全員ぶんを 合計して summary シートの行にする(gas/Code.gs)
 */
type Summarize = (
  list: { cls: string; tally: TallyData }[],
  targets: Record<number, [number, number]>,
  minAnswers: number,
) => { header: string[]; rows: (string | number)[][] };

// Code.gs は関数と定数の定義だけなので、そのまま評価して 集計の関数を取り出す(シートには触らない)
const gas = new Function(`${readFileSync('gas/Code.gs', 'utf8')}; return { summarizeTallies, SUMMARY_TARGETS };`)() as {
  summarizeTallies: Summarize;
  SUMMARY_TARGETS: Record<number, [number, number]>;
};

function answer(d: ReturnType<typeof createNewSave>, nodeId: string, templateId: string, star: number, correct: boolean, extra: Partial<{ seconds: number; hinted: boolean; timedOut: boolean }> = {}) {
  recordTally(d, {
    nodeId,
    nodeName: nodeId.endsWith('road') ? '森の小道' : '符号の湿地',
    nodeOrder: nodeId.endsWith('road') ? 1 : 2,
    templateId,
    templateTitle: '正負の数の加減',
    star,
    correct,
    seconds: extra.seconds ?? 10,
    hinted: extra.hinted ?? false,
    timedOut: extra.timedOut ?? false,
  });
}

describe('授業の集計', () => {
  it('ゲーム側: 1 問ごとに 回答数・正解数・秒数・ヒント・時間切れを 数え、名前と順番も 持つ', () => {
    const d = createNewSave();
    answer(d, 'g1c1.road', 'g1.sign.addsub', 1, true, { seconds: 12.4 });
    answer(d, 'g1c1.road', 'g1.sign.addsub', 1, false, { seconds: 999, hinted: true, timedOut: true });
    expect(d.tally!.c['g1c1.road|g1.sign.addsub|1']).toEqual([2, 1, 12 + 300, 1, 1]); // 秒数は 1 問 300 秒まで
    expect(d.tally!.names['g1c1.road']).toBe('森の小道');
    expect(d.tally!.names['g1.sign.addsub']).toBe('正負の数の加減');
    expect(d.tally!.order['g1c1.road']).toBe(1);
  });

  it('GAS 側: 全員を 合計し、クラス別の正答率も 出す。目標から外れた組に 判定を付ける', () => {
    const students = [];
    // 1-1 の 10 人: 森の小道 ★1 を 3 問ずつ、2 問正解(67%) → ★1 の目標 90% に 届かない
    for (let i = 0; i < 10; i++) {
      const d = createNewSave();
      for (let q = 0; q < 3; q++) answer(d, 'g1c1.road', 'g1.sign.addsub', 1, q < 2);
      students.push({ cls: '1-1', tally: d.tally! });
    }
    // 1-2 の 2 人: 湿地 ★2 を 2 問ずつ 全問正解(回答 4 問で データ不足)
    for (let i = 0; i < 2; i++) {
      const d = createNewSave();
      for (let q = 0; q < 2; q++) answer(d, 'g1c1.marsh', 'g1.sign.addsub', 2, true);
      students.push({ cls: '1-2', tally: d.tally! });
    }
    const { header, rows } = gas.summarizeTallies(students, gas.SUMMARY_TARGETS, 20);
    expect(header.slice(-2)).toEqual(['1-1 正答率', '1-2 正答率']);
    // 地図の順(小道 → 湿地)に並ぶ
    expect(rows.map((r) => r[1])).toEqual(['森の小道', '符号の湿地']);
    const road = rows[0];
    const col = (h: string) => road[header.indexOf(h)];
    expect(col('章')).toBe('第1章');
    expect(col('出題タイプ')).toBe('正負の数の加減');
    expect(col('人数')).toBe(10);
    expect(col('回答数')).toBe(30);
    expect(col('正答率')).toBe('66.7%');
    expect(col('判定')).toBe('むずかしめ');
    expect(col('1-1 正答率')).toBe('66.7%(30)');
    expect(col('1-2 正答率')).toBe('');
    expect(rows[1][header.indexOf('判定')]).toBe('データ不足');
  });

  it('★3 で 正答率が 高すぎる組は「やさしめ」、範囲内は「ちょうど」', () => {
    const make = (ok: number, n: number) => {
      const d = createNewSave();
      for (let q = 0; q < n; q++) answer(d, 'g1c1.road', 'g1.sign.addsub', 3, q < ok);
      return { cls: '1-1', tally: d.tally! };
    };
    const judge = (ok: number) => {
      const { header, rows } = gas.summarizeTallies([make(ok, 20)], gas.SUMMARY_TARGETS, 20);
      return rows[0][header.indexOf('判定')];
    };
    expect(judge(19)).toBe('やさしめ'); // 95%
    expect(judge(13)).toBe('ちょうど'); // 65%
    expect(judge(8)).toBe('むずかしめ'); // 40%
  });
});
