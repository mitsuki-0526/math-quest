import { describe, it, expect } from 'vitest';
import { parseRational, parseRationalList, rat, eq, add, mul, div, toTex, toString, normalizeInput } from '@/math/rational';
import { judge } from '@/math/template';
import { parseFactorization } from '@/math/factorization';

/** 前回試作(計算ライド)の判定ルールを踏襲する(要件 F41)。 */
describe('parseRational', () => {
  it('整数・負の数・小数・分数を読む', () => {
    expect(parseRational('5')).toEqual(rat(5));
    expect(parseRational('-3')).toEqual(rat(-3));
    expect(parseRational('0.5')).toEqual(rat(1, 2));
    expect(parseRational('3/4')).toEqual(rat(3, 4));
    expect(parseRational('-3/4')).toEqual(rat(-3, 4));
    expect(parseRational('+7')).toEqual(rat(7));
  });
  it('全角・各種マイナス記号・空白を受け付ける', () => {
    expect(parseRational('－３')).toEqual(rat(-3));
    expect(parseRational('−3')).toEqual(rat(-3));
    expect(parseRational('３／４')).toEqual(rat(3, 4));
    expect(parseRational('０．５')).toEqual(rat(1, 2));
    expect(parseRational(' 12 ')).toEqual(rat(12));
  });
  it('式・帯分数・分母0・空は読まない', () => {
    expect(parseRational('2+3')).toBeNull();
    expect(parseRational('1 1/2')).toBeNull();
    expect(parseRational('3/0')).toBeNull();
    expect(parseRational('')).toBeNull();
    expect(parseRational('abc')).toBeNull();
  });
  it('未約分・同値の小数は同じ値、近似は違う値', () => {
    expect(eq(parseRational('2/4')!, rat(1, 2))).toBe(true);
    expect(eq(parseRational('0.50')!, rat(1, 2))).toBe(true);
    expect(eq(parseRational('0.333')!, rat(1, 3))).toBe(false);
  });
  it('複数の値', () => {
    expect(parseRationalList('2, -1')).toEqual([rat(2), rat(-1)]);
    expect(parseRationalList('２、－１')).toEqual([rat(2), rat(-1)]);
    expect(parseRationalList('2,,')).toEqual([rat(2)]);
    expect(parseRationalList('2,x')).toBeNull();
  });
});

describe('有理数の演算と表示', () => {
  it('演算', () => {
    expect(add(rat(1, 2), rat(1, 3))).toEqual(rat(5, 6));
    expect(mul(rat(-2, 3), rat(3, 4))).toEqual(rat(-1, 2));
    expect(div(rat(1, 2), rat(-1, 4))).toEqual(rat(-2));
  });
  it('表示', () => {
    expect(toString(rat(-6, 4))).toBe('-3/2');
    expect(toTex(rat(-6, 4))).toBe('-\\frac{3}{2}');
    expect(toTex(rat(7))).toBe('7');
  });
  it('normalizeInput は × ÷ を * / に寄せる', () => {
    expect(normalizeInput('２×３÷４')).toBe('2*3/4');
  });
});

describe('judge', () => {
  it('number: 同値なら正解、式は不正解で補足つき', () => {
    expect(judge({ kind: 'number', value: rat(1, 2) }, '0.5').correct).toBe(true);
    const j = judge({ kind: 'number', value: rat(5) }, '2+3');
    expect(j.correct).toBe(false);
    expect(j.note).toContain('式');
  });
  it('numbers: 順不同、個数違いは不正解', () => {
    const a = { kind: 'numbers' as const, values: [rat(4), rat(-4)] };
    expect(judge(a, '-4, 4').correct).toBe(true);
    expect(judge(a, '4').correct).toBe(false);
    expect(judge(a, '4, 4').correct).toBe(false);
  });
  it('choice: 選択肢の番号', () => {
    const a = { kind: 'choice' as const, options: ['a', 'b', 'c'], correct: 2 };
    expect(judge(a, '2').correct).toBe(true);
    expect(judge(a, '1').correct).toBe(false);
  });
  it('factorization: 書き方の違いを吸収、分けきれていなければ不正解', () => {
    const a = { kind: 'factorization' as const, n: 12 };
    expect(judge(a, '2×2×3').correct).toBe(true);
    expect(judge(a, '2^2×3').correct).toBe(true);
    expect(judge(a, '2²×3').correct).toBe(true);
    expect(judge(a, '3*2*2').correct).toBe(true);
    expect(judge(a, '２ｘ２ｘ３').correct).toBe(true);
    const half = judge(a, '4×3');
    expect(half.correct).toBe(false);
    expect(half.note).toContain('素数');
    expect(judge(a, '2×3').correct).toBe(false);
    expect(judge({ kind: 'factorization', n: 7 }, '7').correct).toBe(true);
  });
  it('parseFactorization の細部', () => {
    expect(parseFactorization('2^2*3')).toEqual({ factors: [2, 2, 3], product: 12, allPrime: true });
    expect(parseFactorization('2+3')).toBeNull();
    expect(parseFactorization('')).toBeNull();
  });
});
