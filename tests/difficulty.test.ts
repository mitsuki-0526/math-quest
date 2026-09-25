import { describe, it, expect } from 'vitest';
import '@/data/grade1/problems';
import { generateProblem, type Difficulty, type Problem } from '@/math/template';
import { toNumber } from '@/math/rational';
import { createRng } from '@/math/rng';
import { getEnemy } from '@/data/grade1/enemies';
import type { NumberLineSpec, TableSpec } from '@/math/figure';

/**
 * 問題の難易度の仕様(docs/difficulty.md)を固定する。
 * 教科書・大阪府チャレンジテストを基準に決めた範囲から、生成した問題がはみ出さないことを確かめる。
 * 仕様を変えるときは、docs/difficulty.md とこのテストを いっしょに直す
 */
const N = 400;

function each(templateId: string, d: Difficulty, check: (p: Problem) => void) {
  // 乱数の種を毎回変える(省略すると現在時刻が種になり、同じ問題ばかりになる)
  for (let i = 0; i < N; i++) check(generateProblem(templateId, d, [], createRng(7919 * (i + 1))));
}
/** 問題文に出てくる数(符号なし) */
const numbersIn = (p: Problem) => (p.promptText.match(/\d+(\.\d+)?/g) ?? []).map(Number);
const answerOf = (p: Problem) => (p.answer.kind === 'number' ? toNumber(p.answer.value) : NaN);

describe('第1章 正の数と負の数', () => {
  it('加減: ★2・★3 は 2 けたの数が 1 問に 1 つまで。2 けただらけはボス専用', () => {
    for (const d of [2, 3] as const) {
      each('g1.sign.addsub', d, (p) => expect(numbersIn(p).filter((n) => n >= 10).length, p.promptText).toBeLessThanOrEqual(1));
    }
    expect(getEnemy('king_nega').phases![0].templates).toEqual(['g1.sign.addsub_big']);
  });

  it('乗除: ★2 の割り算は わられる数 81 まで。★3 は答えが整数', () => {
    each('g1.sign.muldiv', 2, (p) => {
      if (p.promptText.includes('÷')) expect(numbersIn(p)[0], p.promptText).toBeLessThanOrEqual(81);
    });
    each('g1.sign.muldiv', 3, (p) => {
      expect(Number.isInteger(answerOf(p)), p.promptText).toBe(true);
      expect(Math.abs(answerOf(p)), p.promptText).toBeLessThanOrEqual(360);
    });
  });

  it('絶対値: ★3 の「絶対値が a」は 10 まで', () => {
    each('g1.sign.abs', 3, (p) => {
      const m = p.promptText.match(/絶対値が (\d+)/);
      if (m) expect(Number(m[1]), p.promptText).toBeLessThanOrEqual(10);
    });
  });

  it('四則混合: ★2 の 3 乗は 3 まで。★3 は 20 までの数で、答えは整数', () => {
    each('g1.sign.mixed', 2, (p) => {
      if (p.promptText.includes('³')) expect(Math.max(...numbersIn(p)), p.promptText).toBeLessThanOrEqual(3);
    });
    each('g1.sign.mixed', 3, (p) => {
      expect(Math.max(...numbersIn(p)), p.promptText).toBeLessThanOrEqual(20);
      expect(Number.isInteger(answerOf(p)), p.promptText).toBe(true);
    });
  });

  it('素因数分解: 300 以下で、素数は 2・3・5・7(★3 だけ 11 か 13 を 1 つまで)', () => {
    for (const d of [1, 2, 3] as const) {
      each('g1.sign.primefactor', d, (p) => {
        const n = (p.answer as { n: number }).n;
        expect(n).toBeLessThanOrEqual(d === 1 ? 50 : d === 2 ? 120 : 300);
        let m = n;
        for (const q of [2, 3, 5, 7]) while (m % q === 0) m /= q;
        expect(d === 3 ? [1, 11, 13] : [1], `${n}`).toContain(m);
      });
    }
  });

  it('数直線: ★2 に 0.5 きざみ、★3 に 2・5 きざみの目盛りが出る', () => {
    const steps = (d: Difficulty) => {
      const set = new Set<number>();
      each('g1.sign.numberline', d, (p) => set.add((p.figure as NumberLineSpec).step ?? 1));
      return set;
    };
    expect([...steps(2)].sort()).toEqual([0.5, 1]);
    expect([...steps(3)].sort((a, b) => a - b)).toEqual([1, 2, 5]);
  });

  it('基準との差・平均: 差は ±15 まで。★2・★3 は表つき、★3 の平均は整数', () => {
    for (const d of [2, 3] as const) {
      each('g1.sign.average', d, (p) => {
        const t = p.figure as TableSpec;
        expect(t.kind).toBe('table');
        for (const c of t.rows[0].slice(1)) if (c !== '?') expect(Math.abs(Number(c.replace('−', '-'))), c).toBeLessThanOrEqual(15);
        expect(Number.isInteger(answerOf(p)), p.promptText).toBe(true);
      });
    }
  });
});

describe('第2章 文字と式', () => {
  it('同類項 ★2 は 1 文字の一次式の加減((ax + b) ± (cx + d))。2 文字の同類項は 2 年なので出さない', () => {
    each('g1.expr.collect', 2, (p) => {
      expect(p.promptText, p.promptText).toMatch(/^\(/);
      expect(p.promptText, p.promptText).not.toMatch(/[ab]/);
    });
  });

  it('かっこ ★2 は 一次式 ÷ 数、★3 は かっこが 2 つ(または 分数)', () => {
    each('g1.expr.distribute', 2, (p) => expect(p.promptText, p.promptText).toContain('÷'));
    const tags = new Set<string>();
    each('g1.expr.distribute', 3, (p) => p.tags.forEach((t) => tags.add(t)));
    expect([...tags].sort()).toEqual(['distribute_fraction', 'distribute_two']);
  });

  it('代入 ★3 に 負の数を 累乗の式に 代入する形がある(x は −2 か −3)', () => {
    let power = 0;
    each('g1.expr.subst', 3, (p) => {
      if (!p.tags.includes('substitute_power')) return;
      power++;
      expect(p.promptText, p.promptText).toMatch(/x = −[23] /);
    });
    expect(power).toBeGreaterThan(N / 4);
  });

  it('表しヒツジ: ×÷ をはぶく表し方が ★1〜★3、不等式が ★3 に出る', () => {
    for (const d of [1, 2, 3] as const) {
      const tags = new Set<string>();
      each('g1.expr.model', d, (p) => p.tags.forEach((t) => tags.add(t)));
      expect(tags.has('notation'), `★${d}`).toBe(true);
      expect(tags.has('inequality'), `★${d}`).toBe(d === 3);
    }
  });
});

describe('第3章 方程式', () => {
  it('比例式: ★1 は 45 まで。★3 に (x ± m) : b = c : d がある', () => {
    each('g1.eq.ratio', 1, (p) => expect(Math.max(...numbersIn(p)), p.promptText).toBeLessThanOrEqual(45));
    let paren = 0;
    each('g1.eq.ratio', 3, (p) => {
      expect(Number.isInteger(answerOf(p)), p.promptText).toBe(true);
      if (p.promptText.startsWith('(x')) paren++;
    });
    expect(paren).toBeGreaterThan(N / 4);
  });
});

describe('第5章・第6章 図形', () => {
  it('おうぎ形 ★1: 半径は 3・4・6・8・12、中心角は 120° まで', () => {
    each('g1.geo.sector', 1, (p) => {
      const [r, angle] = numbersIn(p);
      expect([3, 4, 6, 8, 12]).toContain(r);
      expect(angle).toBeLessThanOrEqual(120);
    });
  });

  it('球: 半径は 10 まで(直径なら 20 まで)、体積は 半径 3・6・9', () => {
    for (const d of [1, 2, 3] as const) {
      each('g1.solid.sphere', d, (p) => {
        const n = numbersIn(p)[0];
        const r = p.promptText.startsWith('直径') ? n / 2 : n;
        if (p.tags.includes('sphere_volume')) expect([3, 6, 9]).toContain(r);
        else expect(r).toBeLessThanOrEqual(10);
      });
    }
  });
});
