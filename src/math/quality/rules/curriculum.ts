import type { Problem } from '../../template';
import { parseExpression } from '../../expr';
import type { JudgeRule } from '../judge';

/**
 * 学年・単元の 決まり(持っていける ルール)。学習指導要領と 先生の 方針から 決めたもので、
 * 出題タイプの 名前ではなく 単元(テンプレートの unit = 教科書の 章名)で 当てる。
 * ほかの ゲームでも 同じ 単元の 問題なら そのまま 使える(docs/quality-kit.md)。
 * 新しい 決まりを 足すときは source(根拠)を 必ず 書く
 */

/** 問題の 文字列 すべて(問題文・選択肢・解説・答えの 式) */
function texts(p: Problem): string[] {
  const a = p.answer;
  return [p.prompt, p.promptText, ...p.explanation, ...(a.kind === 'choice' ? a.options : []), ...(a.kind === 'expression' ? [a.expected] : [])];
}

export const CURRICULUM_RULES: JudgeRule[] = [
  {
    id: 'no-abs-notation',
    reason: 'OUT_OF_SCOPE',
    test: (p) => (/\|[^|]*\d[^|]*\||｜/.test(p.promptText) ? '絶対値の 記号を 使っている' : null),
    source: '絶対値の 記号 |−7| は 中学校で 教えない(高校)。先生の印 2026-09-27',
  },
  {
    id: 'no-letter-denominator-in-calculation',
    reason: 'OUT_OF_SCOPE',
    scope: { units: ['文字と式'] },
    // 「数量を 文字式で 表す」(選択式)の 4/x は よい。計算して 式で 答える 問題だけ
    test: (p) => {
      if (p.answer.kind === 'choice') return null;
      const t = texts(p).find((s) => /\\frac\{[^{}]*\}\{[^{}]*[a-z][^{}]*\}|\/\s*\(?[a-z]/.test(s));
      return t ? `計算の 問題で 分母に 文字: ${t.slice(0, 40)}` : null;
    },
    source: '先生の方針 2026-09-28「分母に 文字が 来てほしくないのは 係数に 関する 問題のみ」',
  },
  {
    id: 'one-letter-expressions-in-grade1',
    reason: 'OUT_OF_SCOPE',
    scope: { units: ['文字と式'] },
    // 2 文字の 式の 計算(3a + 2b − a + 4b)は 2 年「式の計算」。代入(x = 1, y = 2 のとき)は 1 年で よい
    test: (p) => {
      if (p.answer.kind !== 'expression') return null;
      const poly = parseExpression(p.answer.expected);
      const vars = new Set(poly?.terms.flatMap((t) => Object.keys(t.vars)) ?? []);
      vars.delete('π');
      return vars.size >= 2 ? `2 文字の 式の 計算(2 年の 内容): ${p.answer.expected}` : null;
    },
    source: '学習指導要領解説 数学編(1 年 文字と式は 1 文字の 一次式の 加減)',
  },
];
