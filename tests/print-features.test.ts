import { describe, it, expect } from 'vitest';
// @ts-expect-error 型の ない mjs(道具の スクリプト)
import { factorFeatures, factorize, featuresOf, isMathExpr, normalizeExpr, opsOf, sameReading, summarize, termCount } from '../scripts/print-features.mjs';

/** プリントの 読み取りから 特徴を 計算する(LLM には 計算させない) */
describe('プリントの 特徴', () => {
  it('全角・各種マイナスを そろえる', () => {
    expect(normalizeExpr('（－３）＋（＋５）−（−２）')).toBe('(-3)+(+5)-(-2)');
  });

  it('項の 数(かっこの 外の + − で 区切る)', () => {
    expect(termCount('(-3)+(+5)-(-2)')).toBe(3);
    expect(termCount('-2-6+5')).toBe(3);
    expect(termCount('(-3)*(-4)')).toBe(1);
    expect(termCount('-20/4-(-6)*5')).toBe(2);
  });

  it('特徴: 数の 範囲・2 けた・かっこ・累乗・演算', () => {
    const f = featuresOf('(-12)+(+5)-(-2)');
    expect(f).toMatchObject({ shape: '(-#)+(+#)-(-#)', terms: 3, maxNumber: 12, twoDigit: 1, hasParen: true, hasPower: false, ops: '加減' });
    expect(featuresOf('-3^2').hasPower).toBe(true);
    expect(featuresOf('3/4*(-5/6)').hasFraction).toBe(true);
    expect(featuresOf('3x+2-5x').letters).toBe('x');
  });

  it('演算: 符号の + − と 分数の / は 数えない(わり算は ÷)', () => {
    expect(opsOf('(+7)+(-2)')).toBe('加');
    expect(opsOf('(-4)-(-9)')).toBe('減');
    expect(opsOf('-2-6+5')).toBe('加減');
    expect(opsOf('(+1/4)-(-2/3)')).toBe('減');
    expect(opsOf('(-3)×(-4)÷2')).toBe('乗除');
    expect(opsOf('-3^2')).toBe('累乗');
    expect(termCount('12÷(-3)-4')).toBe(2);
  });

  it('数 1 つの 問題(素因数分解): 素因数の 個数・種類・最大の 素因数・指数', () => {
    expect(factorize(360)).toEqual([[2, 3], [3, 2], [5, 1]]);
    expect(factorFeatures('264')).toMatchObject({ n: 264, digits: 3, primeCount: 5, distinct: 3, largestPrime: 11, maxExp: 3, isPrime: false });
    expect(factorFeatures('61')?.isPrime).toBe(true);
    expect(factorFeatures('4*4')).toBeNull();
    expect(factorFeatures('1')).toBeNull();
    const s = summarize(['30', '77', '4*4'].map(featuresOf));
    expect(s.factor).toMatchObject({ total: 2, min: 30, max: 77, largestPrime: { 5: 1, 11: 1 } });
  });

  it('数と 式だけ を 集計に 通す(文章が まじった ものは 通さない)', () => {
    expect(isMathExpr('(-3)+(+5)')).toBe(true);
    expect(isMathExpr('2,9,15,21')).toBe(true);
    expect(isMathExpr('3x+2-5x')).toBe(true);
    expect(isMathExpr('60を素因数分解しなさい。')).toBe(false);
    expect(isMathExpr('')).toBe(false);
  });

  it('2 回の 読み取りの 比べ方(書き方の 違いは 同じ、符号の 違いは 別)', () => {
    expect(sameReading('(−3) + (+5)', '(-3)+(+5)')).toBe(true);
    expect(sameReading('(-3)+(+5)', '(-3)+(-5)')).toBe(false);
  });

  it('集計: 形ごとの 件数と 数の 範囲', () => {
    const s = summarize(['(-3)+(+5)', '(-7)+(+2)', '-2-6+5'].map(featuresOf));
    expect(s.total).toBe(3);
    expect(s.shapes[0]).toMatchObject({ shape: '(-#)+(+#)', count: 2, maxNumber: 7 });
    expect(s.terms).toEqual({ 2: 2, 3: 1 });
  });
});
