import { describe, it, expect } from 'vitest';
import '@/data/grade1/problems';
import { allTemplates, judge, generateProblem, type Difficulty, type AnswerSpec } from '@/math/template';
import { createRng } from '@/math/rng';
import { toNumber, toString, eq } from '@/math/rational';
import { primeFactors, factorsToText } from '@/math/factorization';
import { parseExpression } from '@/math/expr';

/**
 * 検証ハーネス(要件 F52)。登録済みの全テンプレート × 全難易度 × N 問について、
 *  1. テンプレートが出した答えを、問題に添えられた verify 式(別の計算方法)で照合する
 *  2. 正解を文字列にして judge に通すと必ず正解になる
 *  3. わざと違う値を入れると不正解になる
 * テンプレートを追加すると自動的に対象になる。
 */
const N = Number(process.env.TEMPLATE_N ?? 1000);
const DIFFICULTIES: Difficulty[] = [1, 2, 3];

/** 式を x=2, y=3, a=5, b=7, n=4 で評価して数値にする(verify 式も同じ値で書く) */
export const VERIFY_VARS: Record<string, number> = { x: 2, y: 3, a: 5, b: 7, n: 4, m: 6, t: 9, 'π': 3.14159 };
function evalPolyAt(expr: string): number {
  const p = parseExpression(expr);
  if (!p) throw new Error(`verify: 式が読めない: ${expr}`);
  return p.terms.reduce((sum, t) => {
    const v = Object.entries(t.vars).reduce((acc, [name, e]) => acc * Math.pow(VERIFY_VARS[name] ?? 1, e), 1);
    return sum + (Number(t.coef.n) / Number(t.coef.d)) * v;
  }, 0);
}

function evalVerify(expr: string): unknown {
  // テスト専用。テンプレートの verify はデータファイル内で人が書く文字列
  return new Function(`return (${expr});`)();
}

/** 答えを「生徒が入力する文字列」にする(正解として通るはずの表現) */
function canonicalInput(answer: AnswerSpec): string {
  switch (answer.kind) {
    case 'number':
      return toString(answer.value);
    case 'numbers':
      return answer.values.map(toString).join(',');
    case 'choice':
      return String(answer.correct);
    case 'factorization':
      return factorsToText(primeFactors(answer.n));
    case 'expression':
      return answer.expected;
  }
}

/** 必ず不正解になる入力 */
function wrongInput(answer: AnswerSpec): string {
  switch (answer.kind) {
    case 'number':
      return toString({ n: answer.value.n + 1n * answer.value.d, d: answer.value.d });
    case 'numbers':
      return answer.values.map((v) => toString({ n: v.n + v.d, d: v.d })).join(',');
    case 'choice':
      return String((answer.correct + 1) % answer.options.length);
    case 'factorization':
      return String(answer.n * 2);
    case 'expression':
      return `${answer.expected}+1`;
  }
}

function numericOf(answer: AnswerSpec): number | number[] {
  switch (answer.kind) {
    case 'number':
      return toNumber(answer.value);
    case 'numbers':
      return answer.values.map(toNumber).sort((a, b) => a - b);
    case 'choice':
      // 選択肢は式や文章のこともあるので、正解の「番号」を照合する
      return answer.correct;
    case 'factorization':
      return answer.n;
    case 'expression':
      // 式は数値にならないので、各変数に決まった値を入れて数値化して照合する
      return evalPolyAt(answer.expected);
  }
}

describe('問題テンプレートの検証', () => {
  for (const t of allTemplates()) {
    for (const d of DIFFICULTIES) {
      it(`${t.id} ★${d}: ${N}問を別解法で照合`, () => {
        const rng = createRng(12345 + d);
        const keys = new Set<string>();
        for (let i = 0; i < N; i++) {
          const p = t.generate(rng, d);
          expect(p.templateId).toBe(t.id);
          expect(p.prompt.length).toBeGreaterThan(0);
          expect(p.hint.length).toBeGreaterThan(0);
          expect(p.explanation.length).toBeGreaterThan(0);

          // 1. 別解法で照合(式の答えは verify も式なので、同じ値を代入して数値にする)
          const expected = p.answer.kind === 'expression' ? evalPolyAt(p.verify) : evalVerify(p.verify);
          const actual = numericOf(p.answer);
          if (Array.isArray(actual)) {
            const exp = (expected as number[]).slice().sort((a, b) => a - b);
            expect(exp.length).toBe(actual.length);
            actual.forEach((v, k) => expect(Math.abs(v - exp[k])).toBeLessThan(1e-9));
          } else {
            expect(Math.abs(actual - (expected as number))).toBeLessThan(1e-9);
          }

          // 2. 正解表現は正解、3. ずらした表現は不正解
          expect(judge(p.answer, canonicalInput(p.answer)).correct, `正解が通らない: ${p.promptText}`).toBe(true);
          expect(judge(p.answer, wrongInput(p.answer)).correct, `不正解が通る: ${p.promptText}`).toBe(false);

          // 選択肢は一意(同じ表示・同値の式が2つあると、正しいものを選んでも不正解になりうる)
          if (p.answer.kind === 'choice') {
            const opts = p.answer.options;
            expect(new Set(opts).size, `選択肢が重複: ${opts.join(' / ')}`).toBe(opts.length);
          }
          // 座標のように順番に意味がある答えは、逆順を不正解にする
          if (p.answer.kind === 'numbers' && p.answer.ordered && p.answer.values.length === 2 && !eq(p.answer.values[0], p.answer.values[1])) {
            const rev = [...p.answer.values].reverse().map(toString).join(',');
            expect(judge(p.answer, rev).correct, `逆順が正解になる: ${p.promptText}`).toBe(false);
          }

          keys.add(p.key);
        }
        // 同じ問題ばかりにならない(★1 でも 15 種類以上。素因数分解 ★1 は 50 以下の合成数で 20 通り)
        expect(keys.size).toBeGreaterThanOrEqual(15);
      });
    }
  }

  it('generateProblem は直近のキーを避ける', () => {
    const rng = createRng(1);
    const first = generateProblem('g1.sign.addsub', 1, [], rng);
    const second = generateProblem('g1.sign.addsub', 1, [first.key], rng);
    expect(second.key).not.toBe(first.key);
  });
});
