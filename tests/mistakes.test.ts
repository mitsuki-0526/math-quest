import { describe, it, expect } from 'vitest';
import '@/data/grade1/problems';
import { allTemplates, diagnose, generateProblem, judge, type Difficulty, type Problem } from '@/math/template';
import { toNumber, toString } from '@/math/rational';
import { createRng } from '@/math/rng';
import { grade1 } from '@/data/grade1/chapters';

/**
 * よくある まちがいへの 一言(先生の要望 2026-09-29「まちがい方に合わせた解説」)。
 * 誤答の値は 別の計算で 確かめる(一言が 的外れに ならないように)
 */
const N = 300;
const each = (id: string, d: Difficulty, f: (p: Problem) => void) => {
  for (let i = 0; i < N; i++) f(generateProblem(id, d, [], createRng(7919 * (i + 1))));
};
const numOf = (p: Problem) => (p.answer.kind === 'number' ? toNumber(p.answer.value) : NaN);
const mistakeNums = (p: Problem) => (p.mistakes ?? []).map((m) => (m.answer.kind === 'number' ? toNumber(m.answer.value) : NaN));
/** verify(JS の式)を 計算する */
const evalJs = (s: string) => Function(`return (${s})`)() as number;

describe('よくある まちがい', () => {
  it('どのテンプレートでも、まちがいの答えは 正解と ちがい、答えの 形が 同じ', () => {
    for (const t of allTemplates())
      for (const d of [1, 2, 3] as const)
        for (let i = 0; i < 60; i++) {
          const p = generateProblem(t.id, d, [], createRng(31 * (i + 1)));
          for (const m of p.mistakes ?? []) {
            expect(m.answer.kind, t.id).toBe(p.answer.kind);
            expect(m.say.length).toBeGreaterThan(0);
            // 正解を 入れても まちがいの 一言は 出ない
            const correctInput = p.answer.kind === 'number' ? toString(p.answer.value) : p.answer.kind === 'choice' ? String(p.answer.correct) : null;
            if (correctInput !== null) expect(judge(m.answer, correctInput).correct, `${p.promptText} / ${m.say}`).toBe(false);
          }
        }
  });

  it('第1章は ほとんどの問題に 一言がある(素因数分解は 書き方の 指摘で 代わる)', () => {
    const ids = (grade1.chapters[0].templates ?? []).filter((t) => t !== 'g1.sign.primefactor');
    for (const id of ids)
      for (const d of [1, 2, 3] as const) {
        let withMistake = 0;
        each(id, d, (p) => void ((p.mistakes?.length ?? 0) > 0 && withMistake++));
        expect(withMistake / N, `${id} ★${d}`).toBeGreaterThan(0.6);
      }
  });

  it('加減: −(−b) を −b のまま 計算した答えに「符号を 変えて たし算」と 言う(別の計算で 確かめる)', () => {
    let checked = 0;
    for (const d of [1, 2, 3] as const)
      each('g1.sign.addsub', d, (p) => {
        const m = p.verify.match(/-\(-(\d+)\)/);
        if (!m) return;
        // 最初の −(−b) を −(b) に 書きかえて 計算 = 符号を 変えなかった答え
        const wrong = evalJs(p.verify.replace(m[0], `-(${m[1]})`));
        expect(mistakeNums(p), p.promptText).toContain(wrong);
        expect(diagnose(p, String(wrong)), p.promptText).toMatch(/たし算/);
        checked++;
      });
    expect(checked).toBeGreaterThan(50);
  });

  it('加減: 符号だけ ちがう答えには「数の大きさは合ってる」', () => {
    each('g1.sign.addsub', 1, (p) => {
      const v = numOf(p);
      if (v === 0) return;
      // 0 + (−4) の 4 のように、もっと くわしい 一言(+(−4) は −4)が 先に 当たる ことも ある
      expect(diagnose(p, String(-v)), p.promptText).toMatch(/大きさは 合ってる|と 同じ|たし算|小さく/);
    });
  });

  it('累乗: (−3)² と −3² の 取りちがえ、3² を 3×2 に した答えに 一言', () => {
    each('g1.sign.mixed', 1, (p) => {
      const m = p.promptText.match(/^(\(?)−(\d)\)?([²³⁴⁵])/);
      if (!m) return;
      const a = Number(m[2]);
      const e = ' ²³⁴⁵'.indexOf(m[3]) + 1;
      const other = m[1] ? -(a ** e) : (-a) ** e;
      if (other !== numOf(p)) expect(diagnose(p, String(other)), p.promptText).toMatch(/かける|乗する/);
    });
  });

  it('四則: 左から 順に 計算した答えに「× ÷ が先」', () => {
    let checked = 0;
    each('g1.sign.mixed', 3, (p) => {
      if (!p.tags.includes('order_of_operations') || p.tags.length > 1) return;
      const say = (p.mistakes ?? []).find((m) => m.say.includes('左から'));
      if (say) checked++;
    });
    expect(checked).toBeGreaterThan(N / 3);
  });

  it('絶対値: 負の数を 答えると「負の数に ならない」', () => {
    each('g1.sign.abs', 1, (p) => {
      const v = numOf(p);
      if (v !== 0) expect(diagnose(p, String(-v)), p.promptText).toMatch(/負の数に ならない/);
    });
  });

  it('解説は 教科書の 手順: かっこの式は「かっこを はずす」、最後は「計算」と「答え」', () => {
    for (const d of [1, 2, 3] as const)
      each('g1.sign.addsub', d, (p) => {
        if (p.tags.includes('decimal_addsub') || p.tags.includes('fraction_addsub')) return;
        if (p.promptText.includes('(')) expect(p.explanation.join(' '), p.promptText).toMatch(/かっこを はずす/);
        // 0 以外の 項が 1 つの式((−9) − 0)は 計算の 行が なく「0 は …」で 終わる
        expect(p.explanation.at(-2), p.promptText).toMatch(/計算|0 は/);
        expect(p.explanation.at(-1), p.promptText).toMatch(/答え/);
      });
  });
});
