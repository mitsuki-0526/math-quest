import { describe, it, expect } from 'vitest';
import '@/data/grade1/problems';
import { generateProblem, needsFractionInput, type Problem } from '@/math/template';
import { rat } from '@/math/rational';
import { createRng } from '@/math/rng';

/**
 * 分数の 入れ方の 補助(先生の要望 2026-10-04): 答えが 分数の 問題でだけ、はじめての 練習と 入力欄の 見本を 出す
 */
const base: Problem = {
  templateId: 'test',
  difficulty: 1,
  prompt: '',
  promptText: '',
  answer: { kind: 'number', value: rat(3) },
  hint: '',
  explanation: [],
  tags: [],
  key: 'k',
  verify: '3',
};

describe('分数で 答える 問題の 見分け', () => {
  it('数・数の組・式の 答えに 分数が あれば 分数の 問題', () => {
    expect(needsFractionInput(base)).toBe(false);
    expect(needsFractionInput({ ...base, answer: { kind: 'number', value: rat(-3, 4) } })).toBe(true);
    expect(needsFractionInput({ ...base, answer: { kind: 'numbers', values: [rat(2), rat(1, 2)] } })).toBe(true);
    expect(needsFractionInput({ ...base, answer: { kind: 'expression', expected: '(1/3+1)x' } })).toBe(true);
    expect(needsFractionInput({ ...base, answer: { kind: 'expression', expected: '3x-2' } })).toBe(false);
    expect(needsFractionInput({ ...base, answer: { kind: 'choice', options: ['\frac{1}{2}', '2'], correct: 0 } })).toBe(false);
  });

  it('小数で 見せる 答え(answerLabel)は 小数で 入れればよいので 分数の 問題に しない', () => {
    expect(needsFractionInput({ ...base, answer: { kind: 'number', value: rat(26, 5) }, answerLabel: '5.2' })).toBe(false);
    // ボスの 小数の係数の 式も 同じ
    for (let i = 0; i < 50; i++) {
      const p = generateProblem('g1.expr.boss_calc', 1, [], createRng(i + 1));
      if (p.tags[0] === 'boss_decimal') expect(needsFractionInput(p), p.promptText).toBe(false);
    }
  });

  it('同類項 ★3(分数の係数)は 分数の 問題', () => {
    for (let i = 0; i < 30; i++) expect(needsFractionInput(generateProblem('g1.expr.collect', 3, [], createRng(i + 1)))).toBe(true);
  });
});
