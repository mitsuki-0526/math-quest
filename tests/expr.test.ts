import { describe, it, expect } from 'vitest';
import { parseExpression, polyEquals, polyToTex, judgeExpression } from '@/math/expr';

const same = (a: string, b: string) => polyEquals(parseExpression(a)!, parseExpression(b)!);

describe('式の解釈', () => {
  it('基本の形', () => {
    expect(parseExpression('2x+3')).not.toBeNull();
    expect(same('2x+3', '3+2x')).toBe(true);
    expect(same('x+x', '2x')).toBe(true);
    expect(same('2(x+1)', '2x+2')).toBe(true);
    expect(same('-(x-3)', '3-x')).toBe(true);
    expect(same('3a-2b+1', '1-2b+3a')).toBe(true);
  });
  it('暗黙の掛け算・累乗・上付き', () => {
    expect(same('3a^2b', '3*a*a*b')).toBe(true);
    expect(same('x²', 'x*x')).toBe(true);
    expect(same('2xy', '2*x*y')).toBe(true);
    expect(same('(x+1)(x+2)', 'x^2+3x+2')).toBe(true);
    expect(same('2(x+1)^2', '2x^2+4x+2')).toBe(true);
  });
  it('分数係数・小数・定数での割り算', () => {
    expect(same('x/2', '0.5x')).toBe(true);
    expect(same('(2x+4)/2', 'x+2')).toBe(true);
    expect(same('x/3+x/6', 'x/2')).toBe(true);
  });
  it('全角・× ÷ ・空白', () => {
    expect(same('２ｘ＋３', '2x+3')).toBe(true);
    expect(same('3×x', '3x')).toBe(true);
    expect(same(' 2x + 3 ', '2x+3')).toBe(true);
  });
  it('違う式は違う', () => {
    expect(same('2x+3', '2x-3')).toBe(false);
    expect(same('x^2', 'x')).toBe(false);
    expect(same('3a', '3b')).toBe(false);
    expect(same('2(x+1)', '2x+1')).toBe(false);
  });
  it('読めない入力は null', () => {
    expect(parseExpression('2x+')).toBeNull();
    expect(parseExpression('(x+1')).toBeNull();
    expect(parseExpression('x=3')).toBeNull();
    expect(parseExpression('√2')).toBeNull();
    expect(parseExpression('')).toBeNull();
    expect(parseExpression('2/x')).toBeNull(); // 文字での割り算は中1〜2の答えの形にない
  });
});

describe('表示', () => {
  it('次数の高い順、係数 1 と × を省く', () => {
    expect(polyToTex(parseExpression('1+2x')!)).toBe('2x + 1');
    expect(polyToTex(parseExpression('x*x+x')!)).toBe('x^{2} + x');
    expect(polyToTex(parseExpression('-x+3')!)).toBe('-x + 3');
    expect(polyToTex(parseExpression('3*a*a*b')!)).toBe('3a^{2}b');
    expect(polyToTex(parseExpression('x-x')!)).toBe('0');
    expect(polyToTex(parseExpression('x/2')!)).toBe('\\frac{1}{2}x');
  });
});

describe('judgeExpression', () => {
  it('同値なら正解。書き方が違えば注意を添える', () => {
    expect(judgeExpression('2x+3', '3+2x').correct).toBe(true);
    const j = judgeExpression('3x', 'x3');
    expect(j.correct).toBe(true);
    expect(j.note).toContain('数を 先に');
    expect(judgeExpression('3x', '3*x').note).toContain('×');
    expect(judgeExpression('x', '1x').note).toContain('1');
  });
  it('違う式は不正解。読めない入力は理由を返す', () => {
    expect(judgeExpression('2x+3', '2x-3').correct).toBe(false);
    expect(judgeExpression('2x+3', 'x=3').note).toContain('=');
    expect(judgeExpression('2x+3', '').note).toContain('答えを');
    expect(judgeExpression('2x+3', '2x+').note).toContain('読めません');
  });
});
