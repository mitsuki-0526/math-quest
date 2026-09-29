import { describe, it, expect } from 'vitest';
import '@/data/grade1/problems';
import { grade1 } from '@/data/grade1/chapters';
import { getTemplate, type Problem } from '@/math/template';
import { rat } from '@/math/rational';
import { allSpecs, getSpec, validateSpec, numbersInText } from '@/math/quality/spec';

/** 問題の 仕様(ProblemSpec)。docs/difficulty.md の 表を データに したもの */
describe('ProblemSpec', () => {
  it('第1章の 出題タイプは ★1〜★3 の 仕様が そろっている(平均の ★1 は 題材が 多様なので 除く)', () => {
    for (const id of grade1.chapters[0].templates ?? [])
      for (const d of [1, 2, 3] as const) {
        if (id === 'g1.sign.average' && d === 1) continue;
        expect(getSpec(id, d), `${id} ★${d}`).toBeTruthy();
      }
    // 仕様の テンプレートは 実在する
    for (const s of allSpecs()) expect(() => getTemplate(s.templateId)).not.toThrow();
  });

  it('範囲から はみ出した 問題を 見つける', () => {
    const p = (over: Partial<Problem>): Problem => ({
      templateId: 'g1.sign.addsub',
      difficulty: 1,
      prompt: '',
      promptText: '(+7) + (−2) = ?',
      answer: { kind: 'number', value: rat(5) },
      hint: '',
      explanation: [],
      tags: [],
      key: 'k',
      verify: '',
      ...over,
    });
    expect(validateSpec(p({}))).toBeNull();
    // ★1 に 2 けた(先生の印「2けたは まだ早い」)
    expect(validateSpec(p({ promptText: '(+17) + (−2) = ?' }))?.reason).toBe('SPEC_VIOLATION');
    // ★1 に 3 項
    expect(validateSpec(p({ promptText: '(+7) + (−2) − (+1) = ?' }))?.reason).toBe('SPEC_VIOLATION');
    // 素因数分解 ★1 に ★2 の 数
    expect(validateSpec(p({ templateId: 'g1.sign.primefactor', answer: { kind: 'factorization', n: 63 } }))?.reason).toBe('SPEC_VIOLATION');
    // 答えが 整数でない
    expect(validateSpec(p({ answer: { kind: 'number', value: rat(1, 2) } }))?.reason).toBe('SPEC_VIOLATION');
  });

  it('問題文の 数の 読み取り(入力の 例は 数えない)', () => {
    expect(numbersInText('(−3/4) − (+1.5) = ?')).toEqual([3, 4, 1.5]);
    expect(numbersInText('21 を 素因数分解せよ(例: 2×2×3 または 2^2×3)')).toEqual([21]);
  });
});
