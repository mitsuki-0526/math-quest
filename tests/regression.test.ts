import { describe, it, expect } from 'vitest';
import '@/data/grade1/problems';
import { getTemplate, judge } from '@/math/template';
import { createRng } from '@/math/rng';
import { rat } from '@/math/rational';
import { parseExpression, polyToTex } from '@/math/expr';

/** Codex レビュー(2026-09-23)で見つかった不具合の回帰テスト */
describe('レビュー指摘の回帰', () => {
  it('π は TeX の pi として表示する(p×i にしない)', () => {
    expect(polyToTex(parseExpression('6π')!)).toBe(String.raw`6\pi `);
    expect(polyToTex(parseExpression('6pi')!)).toBe(String.raw`6\pi `);
  });

  it('速さの文章題の答えは丸めない(14/3 が正解、4.67 は不正解)', () => {
    const rng = createRng(1);
    for (let i = 0; i < 3000; i++) {
      const p = getTemplate('g1.eq.word').generate(rng, 3);
      if (p.answer.kind !== 'number' || !p.promptText.includes('分速')) continue;
      const v = p.answer.value;
      if (v.d === 1n) continue;
      expect(judge(p.answer, `${v.n}/${v.d}`).correct).toBe(true);
      const approx = (Number(v.n) / Number(v.d)).toFixed(2);
      expect(judge(p.answer, approx).correct).toBe(false);
      return;
    }
    throw new Error('分数解の速さの問題が生成されなかった');
  });

  it('座標は順番も判定し、逆順には理由を添える', () => {
    const a = { kind: 'numbers' as const, values: [rat(2), rat(3)], ordered: true };
    expect(judge(a, '2,3').correct).toBe(true);
    const j = judge(a, '3,2');
    expect(j.correct).toBe(false);
    expect(j.note).toContain('順番');
    // 順不同の問題(絶対値の2解)は従来どおり
    expect(judge({ kind: 'numbers', values: [rat(4), rat(-4)] }, '-4,4').correct).toBe(true);
  });

  it('最頻値の問題は、意図した値が唯一の最頻値', () => {
    const rng = createRng(3);
    for (let i = 0; i < 2000; i++) {
      const p = getTemplate('g1.data.median').generate(rng, 2);
      if (!p.promptText.includes('最頻値') || p.answer.kind !== 'number') continue;
      const data = p.key.slice('mode:'.length).split(',').map(Number);
      const counts = new Map<number, number>();
      for (const v of data) counts.set(v, (counts.get(v) ?? 0) + 1);
      const max = Math.max(...counts.values());
      const modes = [...counts.entries()].filter(([, c]) => c === max).map(([v]) => v);
      expect(modes).toEqual([Number(p.answer.value.n)]);
    }
  });

  it('角度★2 の図には x の位置が描かれ、対頂角と隣の角で図が変わる', () => {
    const rng = createRng(5);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = getTemplate('g1.geo.angle').generate(rng, 2);
      expect(p.figure?.kind).toBe('angles');
      if (p.figure?.kind !== 'angles') continue;
      const xMark = p.figure.marks.find((m) => m.label === 'x');
      expect(xMark).toBeDefined();
      seen.add(`${xMark!.from}-${xMark!.to}`);
    }
    expect(seen.size).toBe(2);
  });
});
