import { mistakeNum, registerTemplate, type Difficulty, type Mistake, type Problem, type ProblemBasis } from '@/math/template';
import type { Rng } from '@/math/rng';
import { add, isZero, rat, sub, toTex } from '@/math/rational';
import { paren, plainMinus, text, textVars } from '@/math/format';
import { parseExpression, polyToTex } from '@/math/expr';

/**
 * 第2章「文字と式」のテンプレート(台本 02_nameless_plain.md の敵に対応)。
 *   g1.expr.subst      文字の妖精エックス  式の値(代入)
 *   g1.expr.collect    まとめ屋ゴブリン    同類項をまとめる(式入力)
 *   g1.expr.distribute 分配キツネ          分配法則・かっこをはずす(式入力)
 *   g1.expr.model      表しヒツジ          数量を文字式で表す(選択式)
 *   g1.expr.pattern    規則ムカデ          n番目の数(数で答える)/ n 番目を表す式を選ぶ
 */
const UNIT = '文字と式';

/** 係数を式の一部として書く(1 は省く、−1 は − だけ) */
function coefTex(c: number, v: string): string {
  if (c === 1) return v;
  if (c === -1) return `-${v}`;
  return `${c}${v}`;
}
/** 符号つきで後ろにつなぐ: +3x / -3x */
function signedTex(c: number, v = ''): string {
  const body = v ? coefTex(Math.abs(c), v) : String(Math.abs(c));
  return `${c < 0 ? ' - ' : ' + '}${body}`;
}

// ---------------------------------------------------------------- 代入

/**
 * 式の値(代入)。先生の印(2026-10-13)「代入が 難しい。最初は 2x など 1 つの項で よい。今の 問題は もう 1 段 上で」で 1 段ずつ 上げた。
 *   ★1: 1 つの項 ax に 正の数(x = 3 のとき 4x。x は 2〜9。先生の要望 2026-10-15 で 6 → 9)
 *   ★2: ax + b に 正の数(以前の ★1)/ 3 回に 1 回 1 つの項に 負の数(x = −3 のとき 4x)
 *   ★3: 負の数の 代入(以前の ★2: 2x + 7、5 − 2x、−x、x²、−x²、12/x)/ 4 回に 1 回 2 文字の 代入
 * 累乗の 式(−4x²、5x³)と 2 文字で 累乗を ふくむ 式は、修練の泉(チャレンジテスト基準)の ★3 と ボスで 出す
 */
function genSubst(rng: Rng, d: Difficulty, basis: ProblemBasis = 'textbook'): Problem {
  if (d === 3 && basis === 'challenge') return genSubstPowerOrTwo(rng, d);
  if (d === 1) return genSubstOneTerm(rng, d, rng.int(2, 9));
  if (d === 3) return rng.int(0, 3) === 0 ? genSubstTwoLinear(rng, d) : genSubstNegative(rng, d);
  if (rng.int(0, 2) === 0) return genSubstOneTerm(rng, d, -rng.int(1, 6));
  {
    // ★2: ax + b に正の数を代入(x は 6 まで。かけ算は 九九の範囲)
    const a = rng.int(2, 9);
    const b = rng.nonZero(9);
    const x = rng.int(2, 6);
    const value = a * x + b;
    const expr = `${coefTex(a, 'x')}${signedTex(b)}`;
    return {
      templateId: 'g1.expr.subst',
      difficulty: d,
      prompt: `x = ${x} ${text('のとき、')} ${expr} ${text('の値は?')}`,
      promptText: `x = ${x} のとき、${plainMinus(expr)} の値は?`,
      answer: { kind: 'number', value: rat(value) },
      hint: 'x のところに 数を そのまま 入れてみよう',
      explanation: [`${a} \\times ${x}${signedTex(b)} = ${a * x}${signedTex(b)}`, `${text('答え: ')} ${value}`],
      // 2x に x = 3 を 入れて 23 と 書いた(数字を 並べた)
      mistakes: [mistakeNum(Number(`${a}${x}`) + b, `${a}x の x に ${x} を 入れると ${a} × ${x}。${a}${x} と 並べるのでは ないよ`)],
      tags: ['substitute'],
      key: `subst:${a}x${b}:${x}`,
      verify: `${a}*(${x})+(${b})`,
    };
  }
}

/** 1 つの 項 ax に 代入(★1 は 正の数 x = 3、★2 は 負の数 x = −3) */
function genSubstOneTerm(rng: Rng, d: Difficulty, x: number): Problem {
  const a = x > 0 ? rng.int(2, 9) : rng.int(2, 6);
  const value = a * x;
  const xs = plainMinus(String(x));
  return {
    templateId: 'g1.expr.subst',
    difficulty: d,
    prompt: `x = ${x} ${text('のとき、')} ${a}x ${text('の値は?')}`,
    promptText: `x = ${xs} のとき、${a}x の値は?`,
    answer: { kind: 'number', value: rat(value) },
    hint: `${a}x は ${a} × x。x の ところに ${xs} を 入れよう${x < 0 ? '(負の数は かっこを つけて)' : ''}`,
    explanation: [`${a}x = ${a} \\times ${paren(x)} = ${value}`, `${text('答え: ')} ${value}`],
    mistakes:
      x > 0
        ? [
            // 2x を 2 + x と 読んだ / 数字を 並べた(x = 3 で 23)
            mistakeNum(a + x, `${a}x は ${a} × x の ことだよ(${a} + x では ない)`),
            mistakeNum(Number(`${a}${x}`), `${a}x の x に ${x} を 入れると ${a} × ${x}。${a}${x} と 並べるのでは ないよ`),
          ]
        : [mistakeNum(-value, '数の 大きさは 合ってる! 正の数 × 負の数 は 負の数 だよ')],
    tags: x > 0 ? ['substitute_one_term'] : ['substitute_negative'],
    key: `subst1:${a}:${x}`,
    verify: `${a}*(${x})`,
  };
}

/** ★3: 負の数の代入(教科書の「x = −3 のとき 2x + 7、5 − 2x、−x、x²、−x²」の形)。x は −1 〜 −6 */
function genSubstNegative(rng: Rng, d: Difficulty): Problem {
  {
    const x = -rng.int(1, 6);
    // 1 つの項だけの式(−x、x²、−x²)は やさしいので 少なめ
    const form = rng.pick([0, 0, 1, 1, 2, 3, 4, 5]);
    if (form === 5) return genSubstFraction(rng, d, x);
    const a = rng.int(2, 6);
    const b = rng.int(1, 9);
    // [式の TeX, 値, 代入した式の TeX, verify]
    const [expr, value, work, verify]: [string, number, string, string] =
      form === 0
        ? [`${a}x + ${b}`, a * x + b, `${a} \\times (${x}) + ${b}`, `${a}*(${x})+${b}`]
        : form === 1
          ? [`${b} - ${a}x`, b - a * x, `${b} - ${a} \\times (${x})`, `${b}-${a}*(${x})`]
          : form === 2
            ? ['-x', -x, `-(${x})`, `-(${x})`]
            : form === 3
              ? ['x^{2}', x * x, `(${x})^{2}`, `(${x})**2`]
              : ['-x^{2}', -(x * x), `-(${x})^{2}`, `-((${x})**2)`];
    const power = form >= 3;
    return {
      templateId: 'g1.expr.subst',
      difficulty: d,
      prompt: `x = ${x} ${text('のとき、')} ${expr} ${text('の値は?')}`,
      promptText: `x = ${plainMinus(String(x))} のとき、${plainMinus(expr.replace('^{2}', '²'))} の値は?`,
      answer: { kind: 'number', value: rat(value) },
      hint: power ? '負の数を 代入するときは かっこを つけて (−3)² のように。−x² は −(x²)' : 'x のところに かっこを つけて 入れよう',
      explanation: [`${work} = ${value}`, `${text('答え: ')} ${value}`],
      // 負の数の 符号を 落として 代入した(2x + 7 に x = −3 で 13)/ (−3)² を −9 に した
      mistakes:
        form === 0
          ? [mistakeNum(a * -x + b, `x = ${plainMinus(String(x))} は 負の数。${a} × (${plainMinus(String(x))}) = ${a * x} だよ`)]
          : form === 1
            ? [mistakeNum(b + a * x, `${a} × (${plainMinus(String(x))}) = ${a * x}。それを ひくから ${b} − (${a * x}) = ${b - a * x}`)]
            : form === 3
              ? [mistakeNum(-(x * x), '負の数の 2 乗は 正の数。(−3)² = (−3) × (−3) = 9')]
              : form === 4
                ? [mistakeNum(x * x, '−x² は −(x²)。x² を 先に 計算して、そのあと − を つけるよ')]
                : [],
      tags: power ? ['substitute_power'] : ['substitute_negative'],
      key: `subst2:${expr}:${x}`,
      verify,
    };
  }
}

/**
 * ★3: a/x に 負の数を 代入(12/x に x = −3 → −4)。授業の プリントの 定着の 問題(2026-10-02)。
 * 数で 答える 式の値なので 分母に 文字が 来てよい(先生 2026-10-02)
 */
function genSubstFraction(rng: Rng, d: Difficulty, x: number): Problem {
  const m = rng.int(1, 6);
  const neg = rng.bool(0.3);
  const a = (neg ? -1 : 1) * -x * m;
  const value = a / x;
  const expr = `${neg ? '-' : ''}\\frac{${Math.abs(a)}}{x}`;
  return {
    templateId: 'g1.expr.subst',
    difficulty: d,
    prompt: `x = ${x} ${text('のとき、')} ${expr} ${text('の値は?')}`,
    promptText: `x = ${plainMinus(String(x))} のとき、${neg ? '−' : ''}${Math.abs(a)}/x の値は?`,
    answer: { kind: 'number', value: rat(value) },
    hint: `${Math.abs(a)}/x は ${Math.abs(a)} ÷ x。x に かっこを つけて 入れよう`,
    explanation: [`${neg ? '-' : ''}\\frac{${Math.abs(a)}}{${paren(x)}} = ${neg ? '-' : ''}${Math.abs(a)} \\div ${paren(x)} = ${value}`, `${text('答え: ')} ${value}`],
    mistakes: [mistakeNum(-value, '数の 大きさは 合ってる! 正の数 ÷ 負の数 は 負の数、負の数 ÷ 負の数 は 正の数 だよ')],
    tags: ['substitute_negative'],
    key: `subst2f:${a}:${x}`,
    verify: `(${a})/(${x})`,
  };
}

function genSubstPowerOrTwo(rng: Rng, d: Difficulty): Problem {
  // 3 回に 1 回は 2 文字で 累乗を ふくむ 式(教科書の 基本の問題 x² + 3y、−x − y²。2026-10-13)
  if (rng.int(0, 2) === 0) return genSubstTwoPower(rng, d);
  // ★3: 半分は 負の数を 累乗の式に 代入(チャレンジテストの −2x²(x = −3)、5x³(x = −2) の形。正答率 52〜63%)
  if (rng.bool()) {
    const e = rng.pick([2, 3]);
    const a = rng.nonZero(5, 2);
    const x = -rng.int(2, 3);
    const value = a * x ** e;
    const expr = coefTex(a, `x^{${e}}`);
    return {
      templateId: 'g1.expr.subst',
      difficulty: d,
      prompt: `x = ${x} ${text('のとき、')} ${expr} ${text('の値は?')}`,
      promptText: `x = ${plainMinus(String(x))} のとき、${plainMinus(expr.replace(`^{${e}}`, e === 2 ? '²' : '³'))} の値は?`,
      answer: { kind: 'number', value: rat(value) },
      hint: `${a}x${e === 2 ? '²' : '³'} は ${a} × x${e === 2 ? '²' : '³'}。x に かっこを つけて (${plainMinus(String(x))})${e === 2 ? '²' : '³'} を 先に`,
      explanation: [`${a} \\times ${paren(x)}^{${e}} = ${a} \\times ${paren(x ** e)} = ${value}`, `${text('答え: ')} ${value}`],
      tags: ['substitute_power'],
      key: `subst3p:${a}:${e}:${x}`,
      verify: `${a}*(${x})**${e}`,
    };
  }
  return genSubstTwoLinear(rng, d);
}

/** 2 文字の 代入(x = 2, y = −3 のとき 3x − 2y + 4)。教科書の 基本の問題 */
function genSubstTwoLinear(rng: Rng, d: Difficulty): Problem {
  const a = rng.nonZero(5);
  const b = rng.nonZero(5);
  const c = rng.nonZero(9);
  const x = rng.nonZero(5);
  const y = rng.nonZero(5);
  const value = a * x + b * y + c;
  const expr = `${coefTex(a, 'x')}${signedTex(b, 'y')}${signedTex(c)}`;
  return {
    templateId: 'g1.expr.subst',
    difficulty: d,
    prompt: `x = ${x}, y = ${y} ${text('のとき、')} ${expr} ${text('の値は?')}`,
    promptText: `x = ${plainMinus(String(x))}, y = ${plainMinus(String(y))} のとき、${plainMinus(expr)} の値は?`,
    answer: { kind: 'number', value: rat(value) },
    hint: 'x と y を 別べつに 代入して、あとで 足そう',
    explanation: [`${a} \\times ${paren(x)} ${b < 0 ? '-' : '+'} ${Math.abs(b)} \\times ${paren(y)}${signedTex(c)}`, `= ${a * x}${signedTex(b * y)}${signedTex(c)} = ${value}`, `${text('答え: ')} ${value}`],
    tags: ['substitute_two_vars'],
    key: `subst3:${a}:${b}:${c}:${x}:${y}`,
    verify: `${a}*(${x})+(${b})*(${y})+(${c})`,
  };
}

/**
 * ★3: 2 文字で 累乗を ふくむ 式の値(x = −2, y = 3 のとき x² + 3y、−x − y²、ax − y²)。
 * −y² は −(y²)。y が 負でも −y² は 負に なる(よくある まちがい: (−y)² と 取りちがえる)
 */
function genSubstTwoPower(rng: Rng, d: Difficulty): Problem {
  const x = rng.nonZero(4);
  const y = rng.nonZero(4);
  // 少なくとも 1 つは 負の数にする(負の数の 代入の 練習)
  if (x > 0 && y > 0) return genSubstTwoPower(rng, d);
  const a = rng.int(2, 5);
  const form = rng.int(0, 2);
  // [式の TeX, 平文, 値, 代入した式の TeX, verify, まちがいの値, 一言]
  const [tex, txt, value, work, verify, wrong, say]: [string, string, number, string, string, number, string] =
    form === 0
      ? [`x^{2} + ${a}y`, `x² + ${a}y`, x * x + a * y, `${paren(x)}^{2} + ${a} \\times ${paren(y)}`, `(${x})**2+${a}*(${y})`, -(x * x) + a * y, '負の数の 2 乗は 正の数。(−2)² = 4 だよ']
      : form === 1
        ? ['-x - y^{2}', '−x − y²', -x - y * y, `-${paren(x)} - ${paren(y)}^{2}`, `-(${x})-(${y})**2`, -x + y * y, '−y² は −(y²)。y² を 先に 計算して、そのあと − を つける']
        : [`${a}x - y^{2}`, `${a}x − y²`, a * x - y * y, `${a} \\times ${paren(x)} - ${paren(y)}^{2}`, `${a}*(${x})-(${y})**2`, a * x + y * y, '−y² は −(y²)。y が 負の数でも、y² は 正なので −y² は 負になる'];
  return {
    templateId: 'g1.expr.subst',
    difficulty: d,
    prompt: `x = ${x}, y = ${y} ${text('のとき、')} ${tex} ${text('の値は?')}`,
    promptText: `x = ${plainMinus(String(x))}, y = ${plainMinus(String(y))} のとき、${txt} の値は?`,
    answer: { kind: 'number', value: rat(value) },
    hint: '負の数は かっこを つけて 代入する。累乗を 先に 計算しよう',
    explanation: [`${work} = ${value}`, `${text('答え: ')} ${value}`],
    // まちがいは 負の数を 2 乗する ときだけ(form 0 は x、ほかは y が 負の数)
    mistakes: (form === 0 ? x : y) < 0 ? [mistakeNum(wrong, say)] : [],
    tags: ['substitute_two_power'],
    key: `subst3tp:${form}:${a}:${x}:${y}`,
    verify,
  };
}

// ---------------------------------------------------------------- 同類項

/**
 * 同類項。教科書の順(項をまとめる → 一次式の加法・減法)に合わせる(2026-09-28)。
 *   ★1: 2 つの項をまとめる(5x + 3x、−x + 6x、4x − 7x)
 *   ★2: 数の項もある 4 項(3x − 7 − 5x + 3)/ 一次式の加法・減法((ax + b) ± (cx + d))
 *   ★3: 分数の係数(½x + ⅓x、¾x − x)。分数は 約分した形で出す
 */
function genCollect(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    // 2 つの項: 先頭は 3 回に 1 回 負。まとめて 0 になる組は 作り直す
    const a = rng.int(1, 9) * (rng.bool(0.3) ? -1 : 1);
    const b = rng.nonZero(9);
    if (a + b === 0) return genCollect(rng, d);
    const expr = `${coefTex(a, 'x')}${signedTex(b, 'x')}`;
    const expected = `${a + b}x`;
    return {
      templateId: 'g1.expr.collect',
      difficulty: d,
      prompt: `${expr} ${text('を 簡単にせよ')}`,
      promptText: `${plainMinus(expr)} を 簡単にせよ`,
      answer: { kind: 'expression', expected },
      hint: '係数(x の前の数)どうしを 計算しよう。x だけのときは 1x',
      explanation: [`${coefTex(a, 'x')}${signedTex(b, 'x')} = (${a}${b < 0 ? ' - ' : ' + '}${Math.abs(b)})x = ${coefTex(a + b, 'x')}`, `${text('答え: ')} ${coefTex(a + b, 'x')}`],
      tags: ['collect_two_terms'],
      key: `collect1:${a}:${b}`,
      verify: expected,
    };
  }
  if (d === 3) return genCollectFraction(rng, d);
  if (rng.bool()) {
    // ax + b + cx + e(数の項もある 4 項)
    const a = rng.int(2, 9);
    const b = rng.nonZero(8);
    const c = rng.nonZero(9);
    const e = rng.nonZero(9);
    // x の項が 消える式は 作り直す(★2 の かっこの式と 同じ)
    if (a + b === 0) return genCollect(rng, d);
    const expr = `${coefTex(a, 'x')}${signedTex(c)}${signedTex(b, 'x')}${signedTex(e)}`;
    const expected = `${a + b}x+${c + e}`;
    return {
      templateId: 'g1.expr.collect',
      difficulty: d,
      prompt: `${expr} ${text('を 簡単にせよ')}`,
      promptText: `${plainMinus(expr)} を 簡単にせよ`,
      answer: { kind: 'expression', expected },
      hint: '同じ文字の 項どうし、数だけの 項どうしを まとめよう',
      explanation: [
        `${text('文字の項: ')} ${coefTex(a, 'x')}${signedTex(b, 'x')} = ${coefTex(a + b, 'x')}`,
        `${text('数の項: ')} ${c}${signedTex(e)} = ${c + e}`,
        `${text('答え: ')} ${polyToTex(parseExpression(expected)!)}`,
      ],
      tags: ['collect_like_terms'],
      key: `collect:${a}:${b}:${c}:${e}`,
      verify: expected,
    };
  }
  // 一次式の加法・減法: (ax + b) ± (cx + d)。教科書・学習プリントの形(docs/difficulty.md)。
  // 2 文字の同類項(3a + 2b − a + 4b)は 2 年の「整式の加減」なので出さない。
  // 数の項は 12 まで(授業の プリントの 一次式の 加法・減法は 12〜15 まで。2026-10-02)
  const a = rng.nonZero(6);
  const b = rng.nonZero(12);
  const c = rng.nonZero(6);
  const e = rng.nonZero(12);
  const minus = rng.bool();
  const s = minus ? -1 : 1;
  const inner = (p: number, q: number) => `${coefTex(p, 'x')}${signedTex(q)}`;
  const expr = `(${inner(a, b)}) ${minus ? '-' : '+'} (${inner(c, e)})`;
  // x の項が 消える式(答えが 数だけ)は 練習の ねらいから外れるので 作り直す
  if (a + s * c === 0) return genCollect(rng, d);
  const expected = `${a + s * c}x+${b + s * e}`;
  // 「2 つの式 … の 和を 求めよ」「左の式から 右の式を ひけ」の 聞き方は 出さない。
  // 先生の印(2026-10-14・10-15)「分かりにくい。試験でも 見かけない」
  return {
    templateId: 'g1.expr.collect',
    difficulty: d,
    prompt: `${expr} ${text('を 計算せよ')}`,
    promptText: `${plainMinus(expr)} を 計算せよ`,
    answer: { kind: 'expression', expected },
    // ひく式の 数の項の 符号を 変え忘れた(1 つめの 項だけ 変えた)
    mistakes: minus ? [mistakeExpr(`${a - c}x+${b + e}`, 'ひく式の かっこを はずすときは、うしろの 数の 項の 符号も 変えるよ')] : [],
    hint: minus ? 'ひく式の かっこを はずすときは、中の 項の 符号を ぜんぶ 変える' : 'かっこを はずして、x の項どうし・数の項どうしを まとめよう',
    explanation: [
      minus ? `${text('符号を変えて かっこを はずす: ')} ${inner(a, b)}${signedTex(-c, 'x')}${signedTex(-e)}` : `${text('かっこを はずす: ')} ${inner(a, b)}${signedTex(c, 'x')}${signedTex(e)}`,
      `${text('答え: ')} ${polyToTex(parseExpression(expected)!)}`,
    ],
    tags: [minus ? 'subtract_expression' : 'add_expression'],
    key: `collect2:${expr}`,
    verify: expected,
  };
}

/**
 * 分数の係数の 2 つの書き方(\frac{2}{3}x と \frac{2x}{3}、\frac{x}{4} と \frac{1}{4}x)は どちらも 正解。
 * 生徒が 片方しか 正しくないと 思わないように、解説に もう一方の 書き方を 添える(先生の要望 2026-09-28)。
 * 判定は どちらの 入力も 正解にしている(src/math/expr.ts)
 */
function fractionForms(answerTex: string): string[] {
  const coefFirst = answerTex.match(/^(-?)\\frac\{(\d+)\}\{(\d+)\}x$/);
  const letterUp = answerTex.match(/^(-?)\\frac\{(\d*)x\}\{(\d+)\}$/);
  let alt: string | null = null;
  if (coefFirst) alt = `${coefFirst[1]}\\frac{${coefFirst[2] === '1' ? '' : coefFirst[2]}x}{${coefFirst[3]}}`;
  else if (letterUp) alt = `${letterUp[1]}\\frac{${letterUp[2] || '1'}}{${letterUp[3]}}x`;
  return alt ? [`${answerTex} ${text(' は ')} ${alt} ${text(' と 書いても 同じ(どちらも 正解)')}`] : [];
}

/** 真分数(約分ずみ)。分母は 2・3・4・6 */
function properFraction(rng: Rng, avoidDen?: number): [number, number] {
  const den = rng.pick([2, 3, 4, 6].filter((q) => q !== avoidDen));
  const num = rng.pick([1, 2, 3, 4, 5].filter((p) => p < den && gcdOf(p, den) === 1));
  return [num, den];
}

/**
 * ★3: 分数の係数(½x + ⅓x、¾x − ½x、x − ⅔x)。以前は 4/4x・3/3x・1x のような 約分していない係数が出ていた(2026-09-28 修正)
 */
function genCollectFraction(rng: Rng, d: Difficulty): Problem {
  const [p, q] = properFraction(rng);
  // 2 つめの項: 4 回に 3 回は 分母のちがう分数、1 回は 整数(x、2x)
  const [r, s] = rng.int(0, 3) > 0 ? properFraction(rng, q) : [rng.int(1, 2), 1];
  const minus = rng.bool();
  const firstInt = s !== 1 && rng.bool(0.2);
  // たまに 整数の項を 先に(x − ⅔x)
  const terms: [number, number][] = firstInt ? [[1, 1], [p, q]] : [[p, q], [r, s]];
  const coef = (n: number, dd: number) => (dd === 1 ? coefTex(n, 'x') : `\\frac{${n}}{${dd}}x`);
  // 文字の 見本(コピー)で 2/(3x) と 読まれないように かっこを つける
  const coefText = (n: number, dd: number) => (dd === 1 ? (n === 1 ? 'x' : `${n}x`) : `(${n}/${dd})x`);
  const [[n1, d1], [n2, d2]] = terms;
  const value = minus ? sub(rat(n1, d1), rat(n2, d2)) : add(rat(n1, d1), rat(n2, d2));
  if (isZero(value)) return genCollectFraction(rng, d);
  const op = minus ? '-' : '+';
  const expr = `${coef(n1, d1)} ${op} ${coef(n2, d2)}`;
  const expected = `(${n1}/${d1}${op}${n2}/${d2})x`;
  const lcm = (d1 * d2) / gcdOf(d1, d2);
  const f = (n: number, dd: number) => `\\frac{${(n * lcm) / dd}}{${lcm}}`;
  return {
    templateId: 'g1.expr.collect',
    difficulty: d,
    prompt: `${expr} ${text('を 簡単にせよ')}`,
    promptText: `${coefText(n1, d1)} ${op === '-' ? '−' : '+'} ${coefText(n2, d2)} を 簡単にせよ`,
    answer: { kind: 'expression', expected },
    hint: '係数(分数)どうしを 通分して 計算しよう。x は 1x。答えは 2/3x と 入れても 2x/3 と 入れても 正解',
    explanation: [
      `${text('係数: ')} ${f(n1, d1)} ${op} ${f(n2, d2)} = ${toTex(value)}`,
      `${text('答え: ')} ${polyToTex(parseExpression(expected)!)}`,
      ...fractionForms(polyToTex(parseExpression(expected)!)),
    ],
    tags: ['collect_fraction'],
    key: `collect3:${expr}`,
    verify: expected,
  };
}

// ---------------------------------------------------------------- 分配法則

/**
 * かっこをはずす(一次式と数の乗除)。教科書の順(項と数の乗除 → 数 × 一次式 → 一次式 ÷ 数 → かっこが 2 つ)に合わせる(2026-09-28)。
 *   ★1: 項と数の乗除(4x × 3、12x ÷ (−4))/ 小さい数の k(ax + b)(−3(2x − 5)。積は 25 まで)
 *   ★2: 一次式 ÷ 数 / 大きめの数の k(ax + b)
 *   ★3: かっこが 2 つ / 分数 × 一次式 / 数 × 分数の形の式(6 × (2x − 1)/3)
 * 負の数を かっこの前に書くときは 教科書どおり −3(2x − 5)((−3)(2x − 5) とは書かない)
 */
function genDistribute(rng: Rng, d: Difficulty): Problem {
  if (d === 1 && rng.bool()) return genTermMulDiv(rng, d);
  // ★2: 大きめの k(ax + b)・一次式 ÷ 数・項 × 分数 を 同じくらい
  const form2 = d === 2 ? rng.int(0, 2) : -1;
  if (form2 === 2) return genTermTimesFraction(rng, d);
  if (d === 1 || form2 === 0) {
    const small = d === 1;
    const k = small ? rng.nonZero(5, 2) : rng.nonZero(6, 2);
    const a = small ? rng.nonZero(5) : rng.nonZero(8);
    const b = small ? rng.nonZero(5) : rng.nonZero(9);
    const expr = `${k}(${coefTex(a, 'x')}${signedTex(b)})`;
    const expected = `${k * a}x+${k * b}`;
    return {
      templateId: 'g1.expr.distribute',
      difficulty: d,
      prompt: `${expr} ${text('を 計算せよ')}`,
      promptText: `${plainMinus(expr)} を 計算せよ`,
      answer: { kind: 'expression', expected },
      hint: 'かっこの外の数を、中の すべての項に かける',
      explanation: [`${paren(k)} \\times ${coefTex(a, 'x')} = ${coefTex(k * a, 'x')} \\quad ${paren(k)} \\times ${paren(b)} = ${k * b}`, `${text('答え: ')} ${polyToTex(parseExpression(expected)!)}`],
      tags: ['distribute'],
      key: `dist:${k}:${a}:${b}`,
      verify: expected,
    };
  }
  if (d === 2) {
    // 一次式 ÷ 数(例: (12x − 4) ÷ 4、(16x + 10) ÷ (−2))。わり切れるように作る。
    // わられる式の 数は 36 まで(授業の プリント: 36 まで・2 けたが 半分ほど。2026-10-02)
    const k = rng.nonZero(6, 2);
    const a = k * rng.nonZero(6);
    const b = k * rng.nonZero(6);
    const expr = `(${coefTex(a, 'x')}${signedTex(b)}) \\div ${paren(k)}`;
    const expected = `${a / k}x+${b / k}`;
    return {
      templateId: 'g1.expr.distribute',
      difficulty: d,
      prompt: `${expr} ${text('を 計算せよ')}`,
      promptText: `${plainMinus(`(${coefTex(a, 'x')}${signedTex(b)}) ÷ ${paren(k)}`)} を 計算せよ`,
      answer: { kind: 'expression', expected },
      hint: 'かっこの中の すべての項を、その数で わる。負の数で わるときは 符号に 注意',
      explanation: [
        `${coefTex(a, 'x')} \\div ${paren(k)} = ${coefTex(a / k, 'x')} \\quad ${paren(b)} \\div ${paren(k)} = ${b / k}`,
        `${text('答え: ')} ${polyToTex(parseExpression(expected)!)}`,
      ],
      mistakes: [
        // x の項だけ わって、数の項を わり忘れた
        mistakeExpr(`${a / k}x+${b}`, 'かっこの 中の 数の 項も わるよ'),
        // 負の数で わって 符号を 変えなかった
        ...(k < 0 ? [mistakeExpr(`${-a / k}x+${-b / k}`, '負の数で わるから、符号が ぜんぶ 変わるよ')] : []),
      ],
      tags: ['divide_expression'],
      key: `dist2:${a}:${b}:${k}`,
      verify: expected,
    };
  }
  // ★3: かっこが 2 つある式(チャレンジテストの −2(3x − 5) + (7x − 8) の形と、2(3x + 5) − 6(x − 5) の形)、
  // 分数をかける、数 × 分数の形の式
  const form = rng.int(0, 4);
  if (form === 3) return genTimesFractionForm(rng, d);
  if (form === 4) return genIntTimesFractionExpr(rng, d);
  if (form < 2) {
    const k1 = rng.nonZero(4, 2);
    // form 0: 2 つめの かっこの前は ± だけ(チャレンジテスト) / form 1: 2 つめにも 数がつく(学習プリント)
    const k2 = form === 0 ? rng.pick([1, -1]) : rng.nonZero(5, 2);
    const a = rng.nonZero(4);
    const b = rng.nonZero(9);
    const c = rng.nonZero(9);
    const e = rng.nonZero(9);
    const inner = (p: number, q: number) => `${coefTex(p, 'x')}${signedTex(q)}`;
    const second = Math.abs(k2) === 1 ? `(${inner(c, e)})` : `${Math.abs(k2)}(${inner(c, e)})`;
    const expr = `${k1}(${inner(a, b)}) ${k2 < 0 ? '-' : '+'} ${second}`;
    if (k1 * a + k2 * c === 0) return genDistribute(rng, d);
    const expected = `${k1 * a + k2 * c}x+${k1 * b + k2 * e}`;
    return {
      templateId: 'g1.expr.distribute',
      difficulty: d,
      prompt: `${expr} ${text('を 計算せよ')}`,
      promptText: `${plainMinus(expr)} を 計算せよ`,
      answer: { kind: 'expression', expected },
      hint: 'それぞれの かっこを 先に はずして、あとで 同類項を まとめる。− の後ろの かっこは 符号が 変わる',
      explanation: [
        `${k1}(${inner(a, b)}) = ${inner(k1 * a, k1 * b)}`,
        `${k2 < 0 ? '-' : '+'} ${second} = ${k2 * c < 0 ? '' : '+'}${inner(k2 * c, k2 * e)}`,
        `${text('答え: ')} ${polyToTex(parseExpression(expected)!)}`,
      ],
      tags: ['distribute_two'],
      key: `dist3:${expr}`,
      verify: expected,
    };
  }
  // 分数をかける
  const den = rng.pick([2, 3, 4]);
  // 約分できる分数(2/4 など)は 出さない
  const num = rng.pick([1, 2, 3].filter((n) => n < den && gcdOf(n, den) === 1));
  const a = den * rng.nonZero(3);
  const b = den * rng.nonZero(3);
  const expr = `\\frac{${num}}{${den}}(${coefTex(a, 'x')}${signedTex(b)})`;
  const expected = `${(num * a) / den}x+${(num * b) / den}`;
  return {
    templateId: 'g1.expr.distribute',
    difficulty: d,
    prompt: `${expr} ${text('を 計算せよ')}`,
    promptText: `${num}/${den}(${plainMinus(`${coefTex(a, 'x')}${signedTex(b)}`)}) を 計算せよ`,
    answer: { kind: 'expression', expected },
    hint: '分数も 中の すべての項に かける。約分できるところは 約分しよう',
    explanation: [
      `\\frac{${num}}{${den}} \\times ${coefTex(a, 'x')} = ${coefTex((num * a) / den, 'x')}`,
      `\\frac{${num}}{${den}} \\times ${paren(b)} = ${(num * b) / den}`,
      `${text('答え: ')} ${polyToTex(parseExpression(expected)!)}`,
    ],
    tags: ['distribute_fraction'],
    key: `dist3:${num}/${den}:${a}:${b}`,
    verify: expected,
  };
}

/** ★1: 項と数の乗除(4x × 3、(−5x) × (−2)、12x ÷ 4、−18x ÷ 6)。教科書で かっこの前に 習う形 */
function genTermMulDiv(rng: Rng, d: Difficulty): Problem {
  const k = rng.nonZero(6, 2);
  if (rng.bool()) {
    const a = rng.nonZero(6, 2); // 1 × x・6 × x は 計算にならない
    // 数を前に書く形(3 × 4x)と 後ろに書く形(4x × 3)
    const front = rng.bool();
    const term = a < 0 ? `(${coefTex(a, 'x')})` : coefTex(a, 'x');
    const expr = front ? `${k} \\times ${term}` : `${term} \\times ${paren(k)}`;
    const expected = `${k * a}x`;
    return {
      templateId: 'g1.expr.distribute',
      difficulty: d,
      prompt: `${expr} ${text('を 計算せよ')}`,
      promptText: `${plainMinus(expr.replace('\\times', '×'))} を 計算せよ`,
      answer: { kind: 'expression', expected },
      hint: '数どうしを かけて、x を うしろに つける',
      explanation: [`${paren(k)} \\times ${paren(a)} = ${k * a}`, `${text('答え: ')} ${coefTex(k * a, 'x')}`],
      tags: ['term_times_number'],
      key: `term:${expr}`,
      verify: expected,
    };
  }
  // わる: 係数が わり切れるように
  const q = rng.nonZero(6);
  const a = k * q;
  const expr = `${coefTex(a, 'x')} \\div ${paren(k)}`;
  const expected = `${q}x`;
  return {
    templateId: 'g1.expr.distribute',
    difficulty: d,
    prompt: `${expr} ${text('を 計算せよ')}`,
    promptText: `${plainMinus(expr.replace('\\div', '÷'))} を 計算せよ`,
    answer: { kind: 'expression', expected },
    hint: '係数(x の前の数)を その数で わる',
    explanation: [`${a} \\div ${paren(k)} = ${q}`, `${text('答え: ')} ${coefTex(q, 'x')}`],
    tags: ['term_div_number'],
    key: `term:${expr}`,
    verify: expected,
  };
}

/**
 * ★2: 項 × 分数(9x × 2/3 → 6x、(−8x) × 3/4 → −6x)。授業の プリントの 定着の 問題(2026-10-02)。
 * 係数と 分母が 約分できるように 作る(答えは 整数の 係数)
 */
function genTermTimesFraction(rng: Rng, d: Difficulty): Problem {
  const [p, q] = rng.pick([
    [1, 2],
    [1, 3],
    [2, 3],
    [1, 4],
    [3, 4],
    [2, 5],
    [5, 6],
  ]);
  const a = q * rng.nonZero(4);
  const neg = rng.bool(0.3);
  const fracTex = `${neg ? '-' : ''}\\frac{${p}}{${q}}`;
  const term = a < 0 ? `(${coefTex(a, 'x')})` : coefTex(a, 'x');
  const expr = `${term} \\times ${neg ? `\\left(${fracTex}\\right)` : fracTex}`;
  const value = ((neg ? -1 : 1) * a * p) / q;
  const expected = `${value}x`;
  return {
    templateId: 'g1.expr.distribute',
    difficulty: d,
    prompt: `${expr} ${text('を 計算せよ')}`,
    promptText: `${plainMinus(`${term} × ${neg ? `(-${p}/${q})` : `${p}/${q}`}`)} を 計算せよ`,
    answer: { kind: 'expression', expected },
    hint: `係数の ${plainMinus(String(a))} に ${neg ? '−' : ''}${p}/${q} を かける。先に ${q} で 約分すると 楽`,
    explanation: [
      `${text('係数: ')} ${paren(a)} \\times ${neg ? `\\left(${fracTex}\\right)` : fracTex} = ${paren(a)} \\div ${q} \\times ${paren(neg ? -p : p)} = ${toTex(rat(value))}`,
      `${text('答え: ')} ${coefTex(value, 'x')}`,
    ],
    // 分母で わらずに 分子だけ かけた
    mistakes: [mistakeExpr(`${(neg ? -1 : 1) * a * p}x`, `分数を かけるときは、分子を かけて 分母で わる(${q} で わるのを 忘れずに)`)],
    tags: ['term_times_fraction'],
    key: `termf:${a}:${neg ? '-' : ''}${p}/${q}`,
    verify: expected,
  };
}

/**
 * ★3: 整数 × 分数の係数の式(12(2/3x − 3/4) = 8x − 9)。授業の プリントの 標準の 問題(2026-10-02)。
 * かっこが 2 つの 形は ボス(boss_calc)で 出す
 */
function genIntTimesFractionExpr(rng: Rng, d: Difficulty): Problem {
  const q = rng.pick([2, 3, 4, 5]);
  const s = rng.pick([2, 3, 4, 5]);
  const p = rng.pick([1, 2, 3, 4].filter((n) => n < q && gcdOf(n, q) === 1));
  const r = rng.pick([1, 2, 3, 4].filter((n) => n < s && gcdOf(n, s) === 1));
  const lcm = (q * s) / gcdOf(q, s);
  // かっこの前の 整数は 30 まで(プリントの いちばん大きい数)
  const k = lcm * (lcm <= 10 && rng.bool(0.4) ? 2 : 1) * (rng.bool(0.3) ? -1 : 1);
  const minus = rng.bool();
  const x = (k * p) / q;
  const c = ((minus ? -1 : 1) * k * r) / s;
  const inner = `\\frac{${p}}{${q}}x ${minus ? '-' : '+'} \\frac{${r}}{${s}}`;
  const expr = `${k}\\left(${inner}\\right)`;
  const expected = `${x}x+${c}`;
  return {
    templateId: 'g1.expr.distribute',
    difficulty: d,
    prompt: `${expr} ${text('を 計算せよ')}`,
    promptText: `${plainMinus(String(k))}((${p}/${q})x ${minus ? '−' : '+'} ${r}/${s}) を 計算せよ`,
    answer: { kind: 'expression', expected },
    hint: `${k} を 中の すべての 項に かける。分母と 約分してから かけよう`,
    explanation: [
      `${paren(k)} \\times \\frac{${p}}{${q}}x = ${coefTex(x, 'x')} \\quad ${paren(k)} \\times ${minus ? `\\left(-\\frac{${r}}{${s}}\\right)` : `\\frac{${r}}{${s}}`} = ${c}`,
      `${text('答え: ')} ${polyToTex(parseExpression(expected)!)}`,
    ],
    // 数の項に かけ忘れた(x の項だけ かけた)
    mistakes: [mistakeExpr(`${x}x+(${minus ? -r : r}/${s})`, `${k} は かっこの 中の 数の 項にも かけるよ`)],
    tags: ['distribute_int_fraction'],
    key: `distif:${k}:${inner}`,
    verify: expected,
  };
}

/** ★3: 数 × 分数の形の式(6 × (2x − 1)/3 → 2(2x − 1) = 4x − 2)。教科書の「一次式と数の乗法」の最後の形 */
function genTimesFractionForm(rng: Rng, d: Difficulty): Problem {
  const den = rng.pick([2, 3, 4, 5]);
  const m = rng.nonZero(3);
  const k = den * m;
  const a = rng.nonZero(5);
  const b = rng.nonZero(7);
  const inner = `${coefTex(a, 'x')}${signedTex(b)}`;
  // 先頭の負の数は かっこなし(第1章と同じ: −8 × …)
  const expr = `${k} \\times \\frac{${inner}}{${den}}`;
  const expected = `${m * a}x+${m * b}`;
  return {
    templateId: 'g1.expr.distribute',
    difficulty: d,
    prompt: `${expr} ${text('を 計算せよ')}`,
    promptText: `${plainMinus(`${k} × (${inner})/${den}`)} を 計算せよ`,
    answer: { kind: 'expression', expected },
    hint: `先に ${k} と 分母の ${den} を 約分して、かっこの 形に しよう`,
    explanation: [
      `${text('約分: ')} ${paren(k)} \\div ${den} = ${m} \\;\\to\\; ${m === 1 ? '' : m === -1 ? '-' : m}(${inner})`,
      `${text('答え: ')} ${polyToTex(parseExpression(expected)!)}`,
    ],
    tags: ['distribute_fraction_form'],
    key: `dist3f:${k}:${inner}:${den}`,
    verify: expected,
  };
}

// ---------------------------------------------------------------- 文字式で表す(選択式)

interface ModelCase {
  story: string;
  correct: string;
  wrong: string[];
}

function modelCases(rng: Rng, d: Difficulty): ModelCase {
  const a = rng.int(2, 9);
  // 5割だと「b割」と「(10−b)割」が同じ 0.5 になり、選択肢が重複するので除く
  const b = rng.pick([2, 3, 4, 6, 7, 8, 9]);
  const price = rng.pick([80, 100, 120, 150]);
  const cases1: ModelCase[] = [
    { story: `1本 x 円の えんぴつを ${a} 本 買ったときの 代金`, correct: `${a}x`, wrong: [`x+${a}`, `x-${a}`, `x/${a}`] },
    { story: `${a} 個の あめを x 人で 同じ数ずつ 分けたときの 1人分`, correct: `${a}/x`, wrong: [`x/${a}`, `${a}x`, `${a}-x`] },
    { story: `x 円 持っていて ${price} 円の パンを 買ったときの 残り`, correct: `x-${price}`, wrong: [`${price}-x`, `x+${price}`, `${price}x`] },
    { story: `たて x cm、よこ ${a} cm の 長方形の 面積`, correct: `${a}x`, wrong: [`x+${a}`, `2x+${2 * a}`, `${a}/x`] },
  ];
  const cases2: ModelCase[] = [
    { story: `1個 x 円の りんごを ${a} 個と、${price} 円の かごを 買ったときの 代金`, correct: `${a}x+${price}`, wrong: [`${a}x-${price}`, `x+${a + price}`, `${a}(x+${price})`] },
    { story: `x 円の ${b} 割引きの 値段`, correct: `${(10 - b) / 10}x`, wrong: [`${b / 10}x`, `x-${b}`, `${b}x`] },
    { story: `たて x cm、よこ ${a} cm の 長方形の まわりの長さ`, correct: `2x+${2 * a}`, wrong: [`${a}x`, `x+${a}`, `${2 * a}x`] },
    { story: `時速 ${a} km で x 時間 進んだときの 道のり`, correct: `${a}x`, wrong: [`${a}/x`, `x/${a}`, `${a}+x`] },
  ];
  const cases3: ModelCase[] = [
    { story: `1個 x 円の ケーキを ${a} 個 買って ${price * 10} 円 出したときの おつり`, correct: `${price * 10}-${a}x`, wrong: [`${a}x-${price * 10}`, `${price * 10}-x`, `${a}(x-${price * 10})`] },
    { story: `x 人の ${b} 割`, correct: `${b / 10}x`, wrong: [`${b}x`, `x/${b}`, `${(10 - b) / 10}x`] },
    { story: `${a} km の 道のりを 時速 x km で 進んだときの 時間`, correct: `${a}/x`, wrong: [`x/${a}`, `${a}x`, `${a}-x`] },
    { story: `a 円の 品物 ${b} 個の 代金を x 人で 同じ額ずつ 出すときの 1人分`, correct: `${b}a/x`, wrong: [`a/${b}x`, `${b}ax`, `${b}x/a`] },
  ];
  return rng.pick(d === 1 ? cases1 : d === 2 ? cases2 : cases3);
}

/**
 * 文字式の表し方(× ÷ をはぶく)と、不等式で表す。チャレンジテストで毎年出る形(docs/difficulty.md)。
 *   ★1: a × 3 × b → 3ab、x ÷ 4 → x/4、a × a × b → a²b
 *   ★2: x × 3 ÷ 7 → 3x/7(正答率 88%)、7 − a ÷ 5 → 7 − a/5(49%)
 *   ★3: 5 + x ÷ 10 × 3 → 5 + 3x/10(36%)、数量の関係を不等式で(66〜81%)
 * 選択肢は TeX で直接書く(分数の形を 教科書どおりに 見せるため)
 */
function genNotation(rng: Rng, d: Difficulty): Problem {
  const n = rng.int(2, 9);
  const [p, q] = rng.pick([
    [3, 7],
    [2, 5],
    [3, 4],
    [5, 6],
    [2, 9],
    [4, 7],
  ]);
  /** say: 誤答の 何番目を 選んだ子に 何と 言うか(よくある まちがい) */
  let task: { from: string; fromText: string; correct: string; wrong: string[]; hint: string; say?: [number, string] };
  if (d === 3 && rng.bool()) {
    // 不等式で表す
    const k = rng.pick([3, 4, 5, 6, 8]);
    let total = rng.pick([100, 500, 1000]);
    const rel = rng.pick([
      { word: '以下', tex: '\\leqq' },
      { word: '以上', tex: '\\geqq' },
      { word: '未満', tex: '<' },
      { word: 'より 大きい', tex: '>' },
    ]);
    // 授業の プリント(2026-10-02): 2 文字の 不等式・おつりの 不等式も 定着・標準に ある
    const shape = rng.int(0, 2);
    const m = rng.pick([2, 3, 4, 5].filter((v) => v !== k));
    const change = rng.pick([50, 100, 200]);
    // 2 つ 買う・おつりの 形は 100 円では 足りないので 500 円 以上に する
    if (shape > 0 && total < 500) total = rng.pick([500, 1000]);
    const [lhs, rhs, story] =
      shape === 0
        ? [`${k}a`, total, `1個 a 円の パンを ${k} 個 買った 代金は、${total} 円${rel.word}`]
        : shape === 1
          ? [`${k}x + ${m}y`, total, `1個 x 円の パンを ${k} 個と、1本 y 円の ジュースを ${m} 本 買った 代金は、${total} 円${rel.word}`]
          : [`${total} - ${k}a`, change, `${total} 円 出して、1冊 a 円の ノートを ${k} 冊 買うと、おつりは ${change} 円${rel.word}`];
    const all = ['\\leqq', '\\geqq', '<', '>'].map((t) => `${lhs} ${t} ${rhs}`);
    task = {
      from: textVars(`「${story}」を 不等式で 表すと?`),
      fromText: `「${story}」を 不等式で 表すと?`,
      correct: `${lhs} ${rel.tex} ${rhs}`,
      wrong: all.filter((s) => s !== `${lhs} ${rel.tex} ${rhs}`),
      hint: '以上・以下は その数を ふくむ(≧ ≦)。未満・より大きいは ふくまない(< >)',
    };
    const options = rng.shuffle([task.correct, ...task.wrong]);
    return {
      templateId: 'g1.expr.model',
      difficulty: d,
      layout: 'prose',
      prompt: task.from,
      promptText: task.fromText,
      answer: { kind: 'choice', options, correct: options.indexOf(task.correct) },
      hint: task.hint,
      explanation: [`${text(`${rel.word} → `)} ${rel.tex}`, `${text('答え: ')} ${task.correct}`],
      tags: ['inequality'],
      key: `ineq:${story}`,
      verify: String(options.indexOf(task.correct)),
    };
  }
  const cases: (typeof task)[] =
    d === 1
      ? [
          { from: `a \\times ${n} \\times b`, fromText: `a × ${n} × b`, correct: `${n}ab`, wrong: [`a${n}b`, `${n}+ab`, `\\frac{ab}{${n}}`], hint: '× を はぶいて、数を 文字の 前に 書く' },
          { from: `x \\div ${n}`, fromText: `x ÷ ${n}`, correct: `\\frac{x}{${n}}`, wrong: [`\\frac{${n}}{x}`, `${n}x`, `x-${n}`], hint: '÷ は 分数の 形に。わられる数が 分子' },
          { from: `a \\times a \\times b`, fromText: 'a × a × b', correct: 'a^{2}b', wrong: ['2ab', 'a^{2}+b', '2a+b'], hint: '同じ 文字の 積は 累乗で 書く' },
          // 授業の プリント(2026-10-02): 負の数を ふくむ 積・かっこの 式・1 を はぶく
          { from: `y \\times (-${n}) \\times x`, fromText: `y × (−${n}) × x`, correct: `-${n}xy`, wrong: [`${n}xy`, `y-${n}x`, `-${n}+xy`], hint: '数を 前に(符号も いっしょに)、文字は ふつう アルファベット順' },
          { from: `(x + y) \\times ${n}`, fromText: `(x + y) × ${n}`, correct: `${n}(x+y)`, wrong: [`${n}x+y`, `x+${n}y`, `x+y+${n}`], hint: 'かっこの 式は ひとまとまり。数を かっこの 前に 書く' },
          { from: `a \\times (-1)`, fromText: 'a × (−1)', correct: '-a', wrong: ['-1a', 'a-1', '1-a'], hint: '1 は はぶく。−1 との 積は − だけ 書く' },
          // 教科書の 章末問題(2026-10-13): 同じ 文字が 何回も かかる 積
          {
            from: 'a \\times a \\times a \\times b \\times b',
            fromText: 'a × a × a × b × b',
            correct: 'a^{3}b^{2}',
            wrong: ['3a2b', 'a^{3}+b^{2}', '6ab'],
            hint: '同じ 文字の 積は 累乗で。a が 3 個なら a³',
            say: [0, 'a が 3 個 かかるのは a³(累乗)。3a は a + a + a のことだよ'],
          },
        ]
      : d === 2
        ? [
            { from: `x \\times ${p} \\div ${q}`, fromText: `x × ${p} ÷ ${q}`, correct: `\\frac{${p}x}{${q}}`, wrong: [`\\frac{${q}x}{${p}}`, `${p * q}x`, `\\frac{x}{${p * q}}`], hint: '× の数は 分子に、÷ の数は 分母に' },
            { from: `${n} - a \\div ${q}`, fromText: `${n} − a ÷ ${q}`, correct: `${n}-\\frac{a}{${q}}`, wrong: [`\\frac{${n}-a}{${q}}`, `${n}-${q}a`, `\\frac{a}{${q}}-${n}`], hint: '÷ は その 直前の 数(文字)だけに かかる' },
            // 授業の プリント(2026-10-02): かっこの 式で わる
            { from: `x \\div (y + z)`, fromText: 'x ÷ (y + z)', correct: '\\frac{x}{y+z}', wrong: ['\\frac{x}{y}+z', '\\frac{y+z}{x}', 'x(y+z)'], hint: 'かっこの 式は ひとまとまりで 分母に なる' },
            // 教科書の 商の表し方(2026-10-13): 負の数で わる・かっこの 式を わる
            {
              from: `a \\div (-${q})`,
              fromText: `a ÷ (−${q})`,
              correct: `-\\frac{a}{${q}}`,
              wrong: [`\\frac{a}{${q}}`, `-${q}a`, `\\frac{-${q}}{a}`],
              hint: '÷ は 分数の 形に。負の数で わるときは − を 分数の 前に 出す',
              say: [0, '負の数で わるので、答えは 負。− を 分数の 前に 書こう'],
            },
            {
              from: `(a + b) \\div ${q}`,
              fromText: `(a + b) ÷ ${q}`,
              correct: `\\frac{a+b}{${q}}`,
              wrong: [`a+\\frac{b}{${q}}`, `\\frac{a}{${q}}+b`, `${q}(a+b)`],
              hint: 'かっこの 式は ひとまとまり。分子に そのまま 書く(かっこは いらない)',
              say: [0, 'かっこの 中の a + b ぜんぶを わるよ。分子は a + b'],
            },
          ]
        : [
            {
              from: `${n} + x \\div ${q} \\times ${p}`,
              fromText: `${n} + x ÷ ${q} × ${p}`,
              correct: `${n}+\\frac{${p}x}{${q}}`,
              wrong: [`\\frac{${n}+x}{${q}}`, `${n}+\\frac{x}{${p * q}}`, `\\frac{${n}+${p}x}{${q}}`],
              hint: '× ÷ は 足し算より 先。x ÷ ' + q + ' × ' + p + ' の 部分だけを 分数に する',
            },
          ];
  task = rng.pick(cases);
  const options = rng.shuffle([task.correct, ...task.wrong]);
  const correct = options.indexOf(task.correct);
  return {
    templateId: 'g1.expr.model',
    difficulty: d,
    prompt: `${task.from} ${text(' を、× や ÷ を 使わずに 表すと?')}`,
    promptText: `${task.fromText} を、× や ÷ を 使わずに 表すと?`,
    answer: { kind: 'choice', options, correct },
    hint: task.hint,
    explanation: [`${task.from} = ${task.correct}`, `${text('答え: ')} ${task.correct}`, ...fractionForms(task.correct)],
    mistakes: task.say ? [{ answer: { kind: 'choice', options, correct: options.indexOf(task.wrong[task.say[0]]) }, say: task.say[1] }] : [],
    tags: ['notation'],
    key: `notation:${task.fromText}`,
    verify: String(correct),
  };
}

/**
 * 式の 意味を 答える(選択式)。「3a + 2b は 何を 表す?」。授業の プリント(式の意味 11 問、2026-10-02)。
 * 先生の方針「ストーリー上では ごく小問で よい」(2026-10-04)ので、表しヒツジの ★2・★3 に 少しだけ まぜる
 */
function genMeaning(rng: Rng, d: Difficulty): Problem {
  const n = rng.int(2, 5);
  const m = rng.pick([2, 3, 4, 5].filter((v) => v !== n));
  const speed = rng.pick([50, 60, 70, 80]);
  const t = (s: string) => `\\text{${s}}`;
  const cases: { story: string; expr: string; correct: string; wrong: string[]; say: [number, string] }[] = [
    {
      story: '1 個 a 円の りんごと、1 個 b 円の みかんが ある。',
      expr: `${n}a + ${m}b`,
      correct: `りんご ${n} 個と みかん ${m} 個の 代金(円)`,
      wrong: [`りんご ${m} 個と みかん ${n} 個の 代金(円)`, `りんごと みかん 1 個ずつの 代金の ${n + m} 倍(円)`, `りんご ${n} 個と みかん ${m} 個の 個数の 合計(個)`],
      say: [0, `${n}a は「a 円の りんごが ${n} 個」。文字と 数の 組み合わせを 確かめよう`],
    },
    {
      story: `x m の 道のりを 分速 ${speed} m で 歩く。`,
      expr: `\\frac{x}{${speed}}`,
      correct: 'かかった 時間(分)',
      wrong: ['速さ(m/分)', '残りの 道のり(m)', `${speed} 分間に 進む 道のり(m)`],
      say: [0, `道のり ÷ 速さ = 時間。x/${speed} は 時間を 表すよ`],
    },
    {
      story: 'たて a cm、よこ b cm の 長方形が ある。',
      expr: '2(a + b)',
      correct: 'まわりの 長さ(cm)',
      wrong: ['面積(cm²)', 'たてと よこの 長さの 和(cm)', '面積の 2 倍(cm²)'],
      say: [1, '面積は ab。2(a + b) は たてと よこを 2 回ずつ たした 長さ'],
    },
  ];
  // ★2 は 代金の 形だけ、★3 は 単位も 考える 形も
  const c = d === 2 ? cases[0] : rng.pick(cases);
  const options = rng.shuffle([c.correct, ...c.wrong]).map(t);
  const correct = options.indexOf(t(c.correct));
  return {
    templateId: 'g1.expr.model',
    difficulty: d,
    // 文章の 問題は 短くても 本文の 書体で(数式の 書体だと ほかの 問題と 字が ちがって 見える。先生の判定 2026-10-15)
    layout: 'prose',
    prompt: `${textVars(c.story)} \\; ${c.expr} ${t(' は 何を 表す?')}`,
    promptText: `${c.story}${plainMinus(c.expr.replace(/\\frac\{(\w+)\}\{(\w+)\}/, '$1/$2'))} は 何を 表す?`,
    answer: { kind: 'choice', options, correct },
    hint: '式の 中の 文字と 数が、それぞれ 何の 量か 考えよう',
    explanation: [`${c.expr} \\;\\to\\; ${t(c.correct)}`],
    mistakes: [{ answer: { kind: 'choice', options, correct: options.indexOf(t(c.wrong[c.say[0]])) }, say: c.say[1] }],
    tags: ['expression_meaning'],
    key: `meaning:${c.story}:${c.expr}`,
    verify: String(correct),
  };
}

/**
 * ★3: 数の 表し方(十の位が a、一の位が b の 2 けたの数 → 10a + b、偶数 2n、奇数 2n + 1)。
 * 教科書の「数の表し方」(標準、2026-10-13)。選択式
 */
function genNumberForm(rng: Rng, d: Difficulty): Problem {
  const cases: { story: string; correct: string; wrong: string[]; say: [number, string]; hint: string }[] = [
    {
      story: '十の位の数が a、一の位の数が b の 2 けたの 自然数',
      correct: '10a+b',
      wrong: ['ab', 'a+b', '10b+a'],
      say: [0, 'ab は a × b のこと。たとえば 35 は 10 × 3 + 5。十の位の数は 10 倍しよう'],
      hint: '35 = 10 × 3 + 5 のように、十の位の数は 10 倍',
    },
    {
      story: '百の位の数が a、十の位の数が b、一の位の数が c の 3 けたの 自然数',
      correct: '100a+10b+c',
      wrong: ['abc', 'a+b+c', '100c+10b+a'],
      say: [0, 'abc は a × b × c のこと。百の位は 100 倍、十の位は 10 倍だよ'],
      hint: '247 = 100 × 2 + 10 × 4 + 7',
    },
    {
      story: 'n を 整数とするとき、偶数',
      correct: '2n',
      wrong: ['n+2', 'n^{2}', '2n+1'],
      say: [0, 'n + 2 は n が 奇数なら 奇数に なる。偶数は 2 の 倍数だから 2n'],
      hint: '偶数は 2 の 倍数(2 × 整数)',
    },
    {
      story: 'n を 整数とするとき、奇数',
      correct: '2n+1',
      wrong: ['n+1', '2n', '2n+2'],
      say: [0, 'n + 1 は n が 奇数なら 偶数に なる。偶数 2n に 1 を たすと 奇数'],
      hint: '奇数は 偶数より 1 大きい数',
    },
  ];
  const c = rng.pick(cases);
  // 選択肢は 書いたとおりに 見せる(式を 整えると 項の 順番が 変わり、10b + a が b の 前に 来たり する)
  const show = (s: string) => s.replace(/\+/g, ' + ');
  const options = rng.shuffle([c.correct, ...c.wrong]).map(show);
  const correct = options.indexOf(show(c.correct));
  return {
    templateId: 'g1.expr.model',
    difficulty: d,
    // 文章の 問題は 短くても 本文の 書体で(数式の 書体だと ほかの 問題と 字が ちがって 見える。先生の判定 2026-10-15)
    layout: 'prose',
    prompt: textVars(`${c.story} を 文字式で 表すと?`),
    promptText: `${c.story} を 文字式で 表すと?`,
    answer: { kind: 'choice', options, correct },
    hint: c.hint,
    explanation: [textVars(c.story), `${text('答え: ')} ${show(c.correct)}`],
    mistakes: [{ answer: { kind: 'choice', options, correct: options.indexOf(show(c.wrong[c.say[0]])) }, say: c.say[1] }],
    tags: ['number_form'],
    key: `numform:${c.story}`,
    verify: String(correct),
  };
}

function genModel(rng: Rng, d: Difficulty): Problem {
  // ★2・★3 の 8 回に 1 回は 式の 意味(ごく小問)
  if (d >= 2 && rng.int(0, 7) === 0) return genMeaning(rng, d);
  // ★3 の 6 回に 1 回は 数の 表し方
  if (d === 3 && rng.int(0, 5) === 0) return genNumberForm(rng, d);
  // 3 回に 1 回は 表し方・不等式
  if (rng.int(0, 2) === 0) return genNotation(rng, d);
  const c = modelCases(rng, d);
  // わる式は 分数の形で書く(文字式では ÷ を使わない)。x/3 は 表し方の問題と そろえて x/3 の形。
  // 1/3 x と書いても 同じなので、解説で 両方の 書き方を 見せる(fractionForms)
  const tex = (s: string) => {
    const [num, den] = s.split('/');
    if (den) return `\\frac{${num}}{${den}}`;
    const p = parseExpression(s);
    return p ? polyToTex(p) : s;
  };
  // 表示が同じになる誤答(x+3 と 3+x など)は除く。同じ選択肢が2つあると正解を選んでも不正解になりうる
  const seen = new Set([tex(c.correct)]);
  const wrong = c.wrong.filter((w) => !seen.has(tex(w)) && seen.add(tex(w)));
  const options = rng.shuffle([c.correct, ...wrong.slice(0, 3)]);
  const correct = options.indexOf(c.correct);
  return {
    templateId: 'g1.expr.model',
    difficulty: d,
    // 文章の 問題は 短くても 本文の 書体で(数式の 書体だと ほかの 問題と 字が ちがって 見える。先生の判定 2026-10-15)
    layout: 'prose',
    prompt: `${textVars(`${c.story} を 文字式で 表すと?`)}`,
    promptText: `${c.story} を 文字式で 表すと?`,
    answer: { kind: 'choice', options: options.map(tex), correct },
    hint: '言葉を 前から 順に 式に 置きかえてみよう',
    explanation: [textVars(c.story), `${text('答え: ')} ${tex(c.correct)}`, ...fractionForms(tex(c.correct))],
    tags: ['model_expression'],
    key: `model:${c.story}`,
    verify: String(correct),
  };
}

// ---------------------------------------------------------------- 規則性(n番目)

/**
 * 規則性(どの ★ でも 同じ 形)。
 *   3 回に 2 回: 並びの 5〜8 番目の数を答える
 *   3 回に 1 回: n 番目の数を表す 式を 4 つから 選ぶ(3, 7, 11, … → 4n − 1)
 * 先生の印(2026-10-14)「規則性は 難しすぎる。レベル 1 だけで 十分」で 式を 書く 問題と 棒の本数を やめ、
 * そのあと「式を 4 択で 選ぶ 問題を 追加」。問題文の 長さが 数の 桁で 変わるので、見せ方は いつも 文章(layout)
 */
function genPattern(rng: Rng, d: Difficulty): Problem {
  const a = rng.int(2, 6); // 増える数
  const b = rng.int(1, 8); // 1番目の数
  const terms = [0, 1, 2, 3].map((i) => b + a * i);
  if (rng.int(0, 2) === 0) return genPatternChoice(rng, d, a, b, terms);
  const nth = rng.int(5, 8);
  const value = b + a * (nth - 1);
  return {
    templateId: 'g1.expr.pattern',
    difficulty: d,
    prompt: `${terms.join(', ')}, \\ldots \\quad ${text(`この並びの ${nth} 番目の数は?`)}`,
    promptText: `${terms.join(', ')}, … この並びの ${nth} 番目の数は?`,
    answer: { kind: 'number', value: rat(value) },
    layout: 'prose',
    hint: `いくつずつ 増えているか 数えてみよう`,
    explanation: [`${text(`${a} ずつ 増えている`)}`, `${b} + ${a} \\times ${nth - 1} = ${value}`, `${text('答え: ')} ${value}`],
    // 1 番目から n 番目までに 増えるのは (n − 1) 回。n 回 たして しまう まちがい
    mistakes: [mistakeNum(b + a * nth, `1 番目から ${nth} 番目までに 増えるのは ${nth - 1} 回だよ(${nth} 回では ない)`)],
    tags: ['pattern_value'],
    key: `pat:${a}:${b}:${nth}`,
    verify: `${b}+${a}*${nth - 1}`,
  };
}

/** n 番目の数を表す式を 4 つから 選ぶ(3, 7, 11, 15, … → 4n − 1)。n = 1 を 入れて 確かめる 解説を 付ける */
function genPatternChoice(rng: Rng, d: Difficulty, a: number, b: number, terms: number[]): Problem {
  const lin = (p: number, q: number) => `${coefTex(p, 'n')}${q === 0 ? '' : signedTex(q)}`;
  const c = b - a;
  const correctTex = lin(a, c);
  // よくある まちがい: 1 番目の数を そのまま たす(an + b)/ 増える数を たす(n + a)/ 1 番目の数を かける(bn + a)
  const wrongs: [string, string][] = [
    [lin(a, b), `n = 1 を 入れると ${a + b} に なって、1 番目の ${b} に ならないよ。${a}n の あとの 数は ${b} − ${a}`],
    [lin(1, a), `${a} ずつ 増えるのは ${a}n。n + ${a} だと 1 ずつ しか 増えないよ`],
    [lin(b, a), `n の 前の 数は 増える数(${a})。1 番目の 数 ${b} では ないよ`],
  ];
  // 表示が 同じに なる 選択肢(b = a の とき an + b と bn + a など)は のぞく
  const seen = new Set([correctTex]);
  const picked = wrongs.filter(([t]) => !seen.has(t) && seen.add(t));
  // 足りない ときは 減る向き(−an + …)で 補う
  if (picked.length < 3) picked.push([lin(-a, b + a), `${a} ずつ 増えて いるので、n の 前は +${a}`]);
  const options = rng.shuffle([correctTex, ...picked.slice(0, 3).map(([t]) => t)]);
  const correct = options.indexOf(correctTex);
  return {
    templateId: 'g1.expr.pattern',
    difficulty: d,
    // 文の 中の n も 数式の 斜体で(教科書と 同じ 見た目)
    prompt: `${terms.join(', ')}, \\ldots \\quad ${text('この並びの ')} n ${text(' 番目の数を 表す 式は?')}`,
    promptText: `${terms.join(', ')}, … この並びの n 番目の数を 表す 式は?`,
    answer: { kind: 'choice', options, correct },
    layout: 'prose',
    hint: `${a} ずつ 増えているから ${a}n。n = 1 を 入れて 1 番目の ${b} に なるか 確かめよう`,
    explanation: [
      `${text(`${a} ずつ 増える → `)} ${a}n`,
      `${text('n = 1 のとき ')} ${a} \\times 1 ${c < 0 ? '-' : '+'} ${Math.abs(c)} = ${b} ${text(' で 1 番目と 合う')}`,
      `${text('答え: ')} ${correctTex}`,
    ],
    mistakes: picked.slice(0, 3).map(([t, say]) => ({ answer: { kind: 'choice' as const, options, correct: options.indexOf(t) }, say })),
    tags: ['pattern_choice'],
    key: `patc:${a}:${b}`,
    verify: String(correct),
  };
}

// ---------------------------------------------------------------- ボス専用(発展)

/*
 * 仮面の書記官(第2章のボス)でだけ出す 発展の形。授業の 発展プリント(2026-10-02 取り込み)の 特徴の 集計から。
 * プリントの 問題文・式は 使わず、形と 数の 大きさだけを 合わせて プログラムで 作る(docs/print-import.md)
 *   g1.expr.boss_calc      小数の係数 / 一次式 ÷ 分数 / 分数 × かっこ 2 つ / 整数 × 分数の係数の式 2 つ
 *   g1.expr.boss_subst     2 文字・累乗の 式の値(負の数を 代入)
 *   g1.expr.boss_relation  数量の関係を 等式・不等式で(2 文字。選択式)
 */

/** 0.1 きざみの 数を 10 倍の 整数で 持つ(小数の 計算で 誤差を 出さない)。-9 → "-0.9" */
const dec = (tenths: number) => String(tenths / 10);
function coefDec(tenths: number): string {
  if (tenths === 10) return 'x';
  if (tenths === -10) return '-x';
  return `${dec(tenths)}x`;
}
const signedDec = (tenths: number, v = '') => `${tenths < 0 ? ' - ' : ' + '}${v ? coefDec(Math.abs(tenths)) : dec(Math.abs(tenths))}`;
/** 0.1 〜 1.9 の 小数(整数に ならないもの)。10 倍の 整数で返す */
const tenthsNonInt = (rng: Rng, min = 1) => rng.pick([...Array(19).keys()].map((i) => i + 1).filter((n) => n >= min && n !== 10)) * (rng.bool() ? -1 : 1);

/** 正解と 同じ見せ方で 一次式を 書く(係数・数は 小数のまま) */
const decAnswerTex = (x: number, k: number) => `${coefDec(x)}${k === 0 ? '' : signedDec(k)}`;

function genBossCalc(rng: Rng, d: Difficulty): Problem {
  const forms = d === 1 ? ['decimal', 'divfrac'] : d === 2 ? ['decimal', 'divfrac', 'fractwo'] : ['decimal', 'divfrac', 'fractwo', 'inttimesfrac', 'fracform'];
  const form = rng.pick(forms);
  if (form === 'fracform') return genBossFractionForm(rng, d);
  if (form === 'decimal') return genBossDecimal(rng, d);
  if (form === 'divfrac') return genBossDivFraction(rng, d);
  if (form === 'fractwo') return genBossFractionTwo(rng, d);
  return genBossIntTimesFraction(rng, d);
}

/** 小数の係数(0.6x − 1.2 − 1.5x + 0.8)/ ★3 は 小数の 一次式の 減法((0.5x − 1.3) − (1.2x − 0.4)) */
function genBossDecimal(rng: Rng, d: Difficulty): Problem {
  const minus = d === 3 || (d === 2 && rng.bool());
  const a = Math.abs(tenthsNonInt(rng, 2));
  const b = tenthsNonInt(rng);
  const c = tenthsNonInt(rng, 2);
  const e = tenthsNonInt(rng);
  const s = minus ? -1 : 1;
  const x = a + s * c;
  const k = b + s * e;
  // x の項が 消える式・数の項が 消える式は 作り直す(答えの 形を そろえる)
  if (x === 0 || k === 0) return genBossDecimal(rng, d);
  const inner = (p: number, q: number) => `${coefDec(p)}${signedDec(q)}`;
  const expr = minus ? `(${inner(a, b)}) - (${inner(c, e)})` : `${coefDec(a)}${signedDec(b)}${signedDec(c, 'x')}${signedDec(e)}`;
  const expected = `${dec(x)}x+${dec(k)}`;
  const answerTex = decAnswerTex(x, k);
  const mistakes: Mistake[] = minus
    ? // ひく式の 1 つめの 項だけ 符号を 変えて、数の項の 符号を 変え忘れた
      [mistakeExpr(`${dec(x)}x+${dec(b + e)}`, 'ひく式の かっこを はずすときは、うしろの 数の 項の 符号も 変えるよ')]
    : c < 0
      ? // −1.5x の − を 落として まとめた
        [mistakeExpr(`${dec(a - c)}x+${dec(k)}`, '項は 符号ごと まとめるよ。−1.5x なら −1.5 を たす')]
      : [];
  return {
    templateId: 'g1.expr.boss_calc',
    difficulty: d,
    prompt: `${expr} ${text(minus ? 'を 計算せよ' : 'を 簡単にせよ')}`,
    promptText: `${plainMinus(expr)} を ${minus ? '計算せよ' : '簡単にせよ'}`,
    answer: { kind: 'expression', expected },
    answerLabel: answerTex,
    hint: minus ? 'ひく式の かっこを はずすときは、中の 項の 符号を ぜんぶ 変える。小数は 筆算と 同じ' : 'x の項どうし、数の項どうしを まとめよう。小数も 整数と 同じように 計算できる',
    explanation: [
      ...(minus ? [`${text('符号を変えて かっこを はずす: ')} ${inner(a, b)}${signedDec(-c, 'x')}${signedDec(-e)}`] : []),
      `${text('x の項: ')} ${coefDec(a)}${signedDec(s * c, 'x')} = ${coefDec(x)}`,
      `${text('数の項: ')} ${dec(b)}${signedDec(s * e)} = ${dec(k)}`,
      `${text('答え: ')} ${answerTex}`,
    ],
    mistakes,
    tags: [minus ? 'boss_decimal_subtract' : 'boss_decimal'],
    key: `boss_dec:${expr}`,
    verify: expected,
  };
}

/** 一次式 ÷ 分数((6x − 9) ÷ (−3/4) → (6x − 9) × (−4/3) = −8x + 12) */
function genBossDivFraction(rng: Rng, d: Difficulty): Problem {
  const [r, s] = rng.pick([
    [2, 3],
    [3, 2],
    [3, 4],
    [4, 3],
    [2, 5],
    [5, 2],
    [3, 5],
    [4, 5],
  ]);
  const neg = d >= 2 && rng.bool();
  const sign = neg ? -1 : 1;
  const a = r * rng.nonZero(4);
  const b = r * rng.nonZero(d === 1 ? 3 : 4);
  const inner = `${coefTex(a, 'x')}${signedTex(b)}`;
  const divisor = `${neg ? '-' : ''}\\frac{${r}}{${s}}`;
  const recip = `${neg ? '-' : ''}\\frac{${s}}{${r}}`;
  const x = (sign * s * a) / r;
  const k = (sign * s * b) / r;
  const expected = `${x}x+${k}`;
  const mistakes: Mistake[] = [
    // 逆数に しないで そのまま かけた
    mistakeExpr(`(${sign * r * a}/${s})x+(${sign * r * b}/${s})`, `分数で わるときは、逆数を かけるよ(÷ ${r}/${s} → × ${s}/${r})`),
  ];
  // 負の数で わるのに 符号を 変えなかった
  if (neg) mistakes.push(mistakeExpr(`${-x}x+${-k}`, '負の数で わるから、かっこの 中の 項の 符号が ぜんぶ 変わるよ'));
  return {
    templateId: 'g1.expr.boss_calc',
    difficulty: d,
    prompt: `(${inner}) \\div ${neg ? `\\left(${divisor}\\right)` : divisor} ${text('を 計算せよ')}`,
    promptText: `${plainMinus(`(${inner}) ÷ ${neg ? `(-${r}/${s})` : `${r}/${s}`}`)} を 計算せよ`,
    answer: { kind: 'expression', expected },
    hint: '分数で わるときは、わる数の 逆数を かける(かけ算に 直す)',
    explanation: [
      `${text('逆数を かける: ')} (${inner}) \\times ${neg ? `\\left(${recip}\\right)` : recip}`,
      `${coefTex(a, 'x')} \\times ${neg ? `\\left(${recip}\\right)` : recip} = ${coefTex(x, 'x')} \\quad ${paren(b)} \\times ${neg ? `\\left(${recip}\\right)` : recip} = ${k}`,
      `${text('答え: ')} ${polyToTex(parseExpression(expected)!)}`,
    ],
    mistakes,
    tags: ['boss_div_fraction'],
    key: `boss_divf:${inner}:${neg ? '-' : ''}${r}/${s}`,
    verify: expected,
  };
}

/** 分数 × かっこ が 2 つ(½(x − 4) − ⅓(x + 6) = ⅙x − 4)。答えの x の係数は 分数 */
function genBossFractionTwo(rng: Rng, d: Difficulty): Problem {
  const [q1, q2] = rng.pick([
    [2, 3],
    [3, 2],
    [2, 4],
    [4, 2],
    [3, 4],
    [4, 3],
  ]);
  const n1 = rng.pick([1, 2, 3].filter((n) => n < q1 && gcdOf(n, q1) === 1));
  const n2 = rng.pick([1, 2, 3].filter((n) => n < q2 && gcdOf(n, q2) === 1));
  const b1 = q1 * rng.nonZero(3);
  const b2 = q2 * rng.nonZero(3);
  const minus = rng.bool();
  const s = minus ? -1 : 1;
  const c1 = (n1 * b1) / q1;
  const c2 = (n2 * b2) / q2;
  const k = c1 + s * c2;
  const coef = add(rat(n1, q1), rat(s * n2, q2));
  // 分母が ちがうので 係数は 0 に ならない。数の項が 消える式は 作り直す
  if (k === 0) return genBossFractionTwo(rng, d);
  const frac = (n: number, q: number) => `\\frac{${n}}{${q}}`;
  const op = minus ? '-' : '+';
  const expr = `${frac(n1, q1)}(x${signedTex(b1)}) ${op} ${frac(n2, q2)}(x${signedTex(b2)})`;
  const expected = `(${n1}/${q1}${op}${n2}/${q2})x+${k}`;
  const answerTex = polyToTex(parseExpression(expected)!);
  const lcm = (q1 * q2) / gcdOf(q1, q2);
  return {
    templateId: 'g1.expr.boss_calc',
    difficulty: d,
    prompt: `${expr} ${text('を 計算せよ')}`,
    promptText: `${plainMinus(`${n1}/${q1}(x${signedTex(b1)}) ${op} ${n2}/${q2}(x${signedTex(b2)})`)} を 計算せよ`,
    answer: { kind: 'expression', expected },
    hint: 'それぞれの かっこを 先に はずす(分数は 中の 数にも かける)。x の係数は 通分して まとめる。答えは 1/6x と 入れても x/6 と 入れても 正解',
    explanation: [
      `${frac(n1, q1)}(x${signedTex(b1)}) = ${frac(n1, q1)}x${signedTex(c1)}`,
      `${op} ${frac(n2, q2)}(x${signedTex(b2)}) = ${minus ? '-' : '+'}${frac(n2, q2)}x${signedTex(s * c2)}`,
      `${text('x の係数: ')} \\frac{${(n1 * lcm) / q1}}{${lcm}} ${op} \\frac{${(n2 * lcm) / q2}}{${lcm}} = ${toTex(coef)} \\quad ${text('数の項: ')} ${c1}${signedTex(s * c2)} = ${k}`,
      `${text('答え: ')} ${answerTex}`,
    ],
    mistakes: [
      // 分数を x にだけ かけて、かっこの 中の 数に かけ忘れた
      mistakeExpr(`(${n1}/${q1}${op}${n2}/${q2})x+${b1 + s * b2}`, '分数は かっこの 中の 数にも かけるよ'),
      // − の うしろの かっこの 数の項の 符号を 変え忘れた
      ...(minus ? [mistakeExpr(`(${n1}/${q1}${op}${n2}/${q2})x+${c1 + c2}`, '− の うしろの かっこは、中の 数の 項にも − が かかるよ')] : []),
    ],
    tags: ['boss_fraction_two'],
    key: `boss_f2:${expr}`,
    verify: expected,
  };
}

/** 整数 × 分数の係数の式 が 2 つ(6(⅔x + ½) − 4(¾x − ½) = x + 5)。答えは 整数の係数 */
function genBossIntTimesFraction(rng: Rng, d: Difficulty): Problem {
  const part = () => {
    const q = rng.pick([2, 3, 4]);
    const sd = rng.pick([2, 3, 4]);
    const p = rng.pick([1, 2, 3].filter((n) => n < q && gcdOf(n, q) === 1));
    const r = rng.pick([1, 2, 3].filter((n) => n < sd && gcdOf(n, sd) === 1)) * (rng.bool() ? -1 : 1);
    const k = (q * sd) / gcdOf(q, sd);
    return { k, p, q, r, sd, x: (k * p) / q, c: (k * r) / sd };
  };
  const A = part();
  const B = part();
  const minus = rng.bool();
  const s = minus ? -1 : 1;
  const x = A.x + s * B.x;
  const k = A.c + s * B.c;
  if (x === 0 || k === 0) return genBossIntTimesFraction(rng, d);
  const inner = (P: typeof A) => `\\frac{${P.p}}{${P.q}}x ${P.r < 0 ? '-' : '+'} \\frac{${Math.abs(P.r)}}{${P.sd}}`;
  const innerText = (P: typeof A) => `(${P.p}/${P.q})x ${P.r < 0 ? '−' : '+'} ${Math.abs(P.r)}/${P.sd}`;
  const op = minus ? '-' : '+';
  const expr = `${A.k}\\left(${inner(A)}\\right) ${op} ${B.k}\\left(${inner(B)}\\right)`;
  const expected = `${x}x+${k}`;
  return {
    templateId: 'g1.expr.boss_calc',
    difficulty: d,
    prompt: `${expr} ${text('を 計算せよ')}`,
    promptText: `${A.k}(${innerText(A)}) ${minus ? '−' : '+'} ${B.k}(${innerText(B)}) を 計算せよ`,
    answer: { kind: 'expression', expected },
    hint: 'かっこの 前の 整数と 分母を 約分しながら、中の すべての 項に かける',
    explanation: [
      `${A.k}\\left(${inner(A)}\\right) = ${coefTex(A.x, 'x')}${signedTex(A.c)}`,
      `${op} ${B.k}\\left(${inner(B)}\\right) = ${coefTex(s * B.x, 'x')}${signedTex(s * B.c)}`,
      `${text('答え: ')} ${polyToTex(parseExpression(expected)!)}`,
    ],
    mistakes: minus ? [mistakeExpr(`${x}x+${A.c + B.c}`, '− の うしろの かっこは、中の 数の 項にも − が かかるよ')] : [],
    tags: ['boss_int_times_fraction'],
    key: `boss_if:${expr}`,
    verify: expected,
  };
}

/**
 * ★3: 分数の形の式の加減((x + 1)/2 − (x − 3)/4 = (x + 5)/4)。教科書の 章の問題 B(2026-10-13)。
 * 通分して 分子を まとめる。答えは (x + 5)/4 と 入れても 1/4x + 5/4 と 入れても 正解
 */
function genBossFractionForm(rng: Rng, d: Difficulty): Problem {
  const [q1, q2] = rng.pick([
    [2, 4],
    [3, 6],
    [2, 3],
    [4, 2],
    [3, 2],
    [6, 3],
  ]);
  const m1 = rng.int(1, 3);
  const m2 = rng.int(1, 3);
  const c1 = rng.nonZero(5);
  const c2 = rng.nonZero(5);
  const minus = rng.bool(0.7);
  const s = minus ? -1 : 1;
  const l = (q1 * q2) / gcdOf(q1, q2);
  const k1 = l / q1;
  const k2 = l / q2;
  // 通分した 分子: k1(m1x + c1) ± k2(m2x + c2) = N x + C
  const N = k1 * m1 + s * k2 * m2;
  const C = k1 * c1 + s * k2 * c2;
  // 約分できる 答え((2x + 4)/4 → (x + 2)/2)は 約分した形で 見せる。分母が 1 に なる 式は 作り直す
  const g = gcdOf(gcdOf(Math.abs(N), Math.abs(C)), l);
  if (N === 0 || C === 0 || l / g === 1) return genBossFractionForm(rng, d);
  const inner = (m: number, c: number) => `${coefTex(m, 'x')}${signedTex(c)}`;
  const op = minus ? '-' : '+';
  const expr = `\\frac{${inner(m1, c1)}}{${q1}} ${op} \\frac{${inner(m2, c2)}}{${q2}}`;
  const expected = `(${inner(N / g, C / g).replace(/\s/g, '')})/${l / g}`;
  const numTex = (kk: number, m: number, c: number) => (kk === 1 ? `(${inner(m, c)})` : `${kk}(${inner(m, c)})`);
  const answerTex = `\\frac{${inner(N / g, C / g)}}{${l / g}}`;
  // − の うしろの 分子の 数の項に − を かけ忘れた
  const wrongC = k1 * c1 + k2 * c2;
  return {
    templateId: 'g1.expr.boss_calc',
    difficulty: d,
    prompt: `${expr} ${text('を 計算せよ')}`,
    promptText: `${plainMinus(`(${inner(m1, c1)})/${q1} ${op} (${inner(m2, c2)})/${q2}`)} を 計算せよ`,
    answer: { kind: 'expression', expected },
    answerLabel: answerTex,
    hint: `分母を ${l} に そろえて(通分)、分子を まとめる。答えは (分子)/${l} の 形で 入れてよい`,
    explanation: [
      `${text('通分: ')} \\frac{${numTex(k1, m1, c1)} ${op} ${numTex(k2, m2, c2)}}{${l}}`,
      `= \\frac{${inner(k1 * m1, k1 * c1)}${minus ? signedTex(-k2 * m2, 'x') + signedTex(-k2 * c2) : signedTex(k2 * m2, 'x') + signedTex(k2 * c2)}}{${l}}`,
      ...(g > 1 ? [`= \\frac{${inner(N, C)}}{${l}} = ${answerTex} \\quad ${text(`(${g} で 約分)`)}`] : []),
      `${text('答え: ')} ${answerTex}`,
    ],
    mistakes: minus && wrongC !== C ? [mistakeExpr(`(${inner(N, wrongC).replace(/\s/g, '')})/${l}`, '− の うしろの 分数は、分子の すべての 項に − が かかるよ(かっこを つけて 考えよう)')] : [],
    tags: ['boss_fraction_form'],
    key: `boss_ff:${expr}`,
    verify: expected,
  };
}

/** 式で 答える 問題の まちがい */
function mistakeExpr(expected: string, say: string): Mistake {
  return { answer: { kind: 'expression', expected }, say };
}

/**
 * 2 文字・累乗の 式の値(x = −3, y = 2 のとき x² + y²)。
 * 負の数を 2 乗して 負に した まちがい((−3)² = −9)に 一言を 出す
 */
function genBossSubst(rng: Rng, d: Difficulty): Problem {
  // ★1 は 負の数を 1 次式に、★2 から 累乗・2 文字(1 段 やさしくした。先生の指摘 2026-10-14)
  const forms = d === 1 ? ['neg_linear'] : d === 2 ? ['sq_linear', 'sq_linear', 'sum_sq', 'sq_minus_y', 'sign'] : ['sum_sq', 'sq_minus_y', 'sq_minus_xy', 'half', 'sign'];
  const form = rng.pick(forms);
  if (form === 'sign') return genBossSignChoice(rng, d);
  const neg = (max: number) => -rng.int(1, max);
  // 2 乗の 計算。wrong = true は 負の数の 2 乗を 負に した まちがい
  const sq = (v: number, wrong: boolean) => (wrong && v < 0 ? -(v * v) : v * v);
  let vars: [string, number][];
  let tex: string;
  let txt: string;
  let calc: (wrong: boolean) => number;
  let work: string;
  let verify: string;
  if (form === 'neg_linear') {
    // ★1: 負の数を 1 次式に(x = −3 のとき 2x − 7)。累乗は ★2 から(先生の指摘 2026-10-14「書記官の 1 問目が 難しすぎる」)
    const x = neg(5);
    const a = rng.int(2, 6);
    const b = rng.nonZero(9);
    vars = [['x', x]];
    tex = `${a}x${signedTex(b)}`;
    txt = tex;
    calc = () => a * x + b;
    work = `${a} \\times ${paren(x)}${signedTex(b)} = ${a * x}${signedTex(b)}`;
    verify = `${a}*(${x})+(${b})`;
  } else if (form === 'sq_linear') {
    // x² + ax + b(x は 負の数)
    const x = neg(d === 2 ? 4 : 5);
    const a = rng.nonZero(6);
    const b = rng.nonZero(9);
    vars = [['x', x]];
    tex = `x^{2}${signedTex(a, 'x')}${signedTex(b)}`;
    txt = `x²${signedTex(a, 'x')}${signedTex(b)}`;
    calc = (w) => sq(x, w) + a * x + b;
    work = `${paren(x)}^{2} ${a < 0 ? '-' : '+'} ${Math.abs(a)} \\times ${paren(x)}${signedTex(b)} = ${x * x}${signedTex(a * x)}${signedTex(b)}`;
    verify = `(${x})**2+(${a})*(${x})+(${b})`;
  } else if (form === 'sum_sq') {
    // x² + y²(少なくとも 1 つは 負の数)
    const x = neg(5);
    const y = rng.nonZero(5);
    vars = [['x', x], ['y', y]];
    tex = 'x^{2} + y^{2}';
    txt = 'x² + y²';
    calc = (w) => sq(x, w) + sq(y, w);
    work = `${paren(x)}^{2} + ${paren(y)}^{2} = ${x * x} + ${y * y}`;
    verify = `(${x})**2+(${y})**2`;
  } else if (form === 'sq_minus_y') {
    // ax² − by
    const a = rng.int(2, 3);
    const b = rng.int(2, 6);
    const x = neg(d === 2 ? 3 : 4);
    const y = rng.nonZero(5);
    vars = [['x', x], ['y', y]];
    tex = `${a}x^{2} - ${b}y`;
    txt = `${a}x² − ${b}y`;
    calc = (w) => a * sq(x, w) - b * y;
    work = `${a} \\times ${paren(x)}^{2} - ${b} \\times ${paren(y)} = ${a * x * x}${signedTex(-b * y)}`;
    verify = `${a}*(${x})**2-${b}*(${y})`;
  } else if (form === 'sq_minus_xy') {
    // x² − xy
    const x = neg(5);
    const y = rng.nonZero(5);
    vars = [['x', x], ['y', y]];
    tex = 'x^{2} - xy';
    txt = 'x² − xy';
    calc = (w) => sq(x, w) - x * y;
    work = `${paren(x)}^{2} - ${paren(x)} \\times ${paren(y)} = ${x * x}${signedTex(-x * y)}`;
    verify = `(${x})**2-(${x})*(${y})`;
  } else {
    // (x² + y²)/2 − xy。x と y の 偶奇を そろえて 答えを 整数に
    const x = neg(5);
    const y = rng.pick([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].filter((v) => (v - x) % 2 === 0 && v !== x));
    vars = [['x', x], ['y', y]];
    tex = '\\frac{x^{2} + y^{2}}{2} - xy';
    txt = '(x² + y²)/2 − xy';
    calc = (w) => (sq(x, w) + sq(y, w)) / 2 - x * y;
    work = `\\frac{${paren(x)}^{2} + ${paren(y)}^{2}}{2} - ${paren(x)} \\times ${paren(y)} = \\frac{${x * x + y * y}}{2}${signedTex(-x * y)}`;
    verify = `((${x})**2+(${y})**2)/2-(${x})*(${y})`;
  }
  const value = calc(false);
  const wrong = calc(true);
  const cond = vars.map(([v, n]) => `${v} = ${n}`).join(', ');
  const condText = vars.map(([v, n]) => `${v} = ${plainMinus(String(n))}`).join(', ');
  return {
    templateId: 'g1.expr.boss_subst',
    difficulty: d,
    prompt: `${cond} ${text('のとき、')} ${tex} ${text('の値は?')}`,
    promptText: `${condText} のとき、${plainMinus(txt)} の値は?`,
    answer: { kind: 'number', value: rat(value) },
    hint: '負の数は かっこを つけて 代入する。(−3)² は (−3) × (−3)',
    explanation: [`${work} = ${value}`, `${text('答え: ')} ${value}`],
    // wrong と value が 同じ(負の数を 2 乗しない式)なら generateProblem が 取り除く
    mistakes: [mistakeNum(wrong, '負の数の 2 乗は 正の数に なるよ。(−3)² = (−3) × (−3) = 9')],
    tags: ['boss_subst'],
    key: `boss_subst:${form}:${tex}:${cond}`,
    verify,
  };
}

/**
 * a が 負の数の とき、値が 正の数に なる 式を 選ぶ(−a、a²、(−a)²、−a³ …)。教科書の 章の問題 B(2026-10-13)。
 * 正しい 式 1 つと、負に なる 式 3 つを 並べる。a = −2 を 入れて 確かめる 解説を 付ける
 */
function genBossSignChoice(rng: Rng, d: Difficulty): Problem {
  // [TeX, a = −2 の ときの 値, 選んだ子への 一言]
  type SignExpr = [string, number, string];
  const positive: SignExpr[] = [
    ['-a', 2, ''],
    ['a^{2}', 4, ''],
    ['(-a)^{2}', 4, ''],
    ['-a^{3}', 8, ''],
    ['(-a)^{3}', 8, ''],
  ];
  const negative: SignExpr[] = [
    ['a', -2, 'a そのものが 負の数だよ'],
    ['-a^{2}', -4, '−a² は −(a²)。a² は 正なので、−a² は 負の数'],
    ['-(-a)', -2, '−(−a) は a と 同じ。a は 負の数だよ'],
    ['a^{3}', -8, '負の数を 3 回 かけると 負の数(−2 × −2 × −2 = −8)'],
  ];
  const right = rng.pick(positive);
  const wrongs = rng.shuffle(negative).slice(0, 3);
  const options = rng.shuffle([right, ...wrongs]).map((e) => e[0]);
  const correct = options.indexOf(right[0]);
  const all = [right, ...wrongs];
  return {
    templateId: 'g1.expr.boss_subst',
    difficulty: d,
    // 文章の 問題は 短くても 本文の 書体で(数式の 書体だと ほかの 問題と 字が ちがって 見える。先生の判定 2026-10-15)
    layout: 'prose',
    prompt: textVars('a が 負の数の とき、値が 正の数に なる 式は どれ?'),
    promptText: 'a が 負の数の とき、値が 正の数に なる 式は どれ?',
    answer: { kind: 'choice', options, correct },
    hint: 'a = −2 の ように、負の数を 1 つ 決めて 代入してみよう',
    explanation: [
      textVars('a = −2 を 代入して 確かめる:'),
      ...all.map(([tex, v]) => `${tex} \\;\\to\\; ${tex.replace(/a/g, '(-2)')} = ${v}`),
      `${text('答え: ')} ${right[0]}`,
    ],
    mistakes: wrongs.map(([tex, , say]) => ({ answer: { kind: 'choice', options, correct: options.indexOf(tex) }, say })),
    tags: ['boss_sign_choice'],
    key: `boss_sign:${options.join('|')}`,
    verify: String(correct),
  };
}

interface RelationCase {
  story: string;
  correct: string;
  wrong: string[];
  /** wrong の 何番目を 選んだら 何と 言うか */
  say?: [number, string][];
  tag: string;
  hint: string;
}

/** 数量の 関係を 等式・不等式で(2 文字)。選択式 */
function genBossRelation(rng: Rng, d: Difficulty): Problem {
  const n = rng.int(2, 6);
  const m = rng.pick([2, 3, 4, 5, 6, 7].filter((v) => v !== n));
  const q = rng.int(2, 9);
  const r = rng.int(1, 6);
  const total = rng.pick([500, 800, 1000, 1200, 1500]);
  const rels = [
    { word: '以下', tex: '\\leqq' },
    { word: '以上', tex: '\\geqq' },
    { word: '未満', tex: '<' },
    { word: 'より 大きい', tex: '>' },
  ];
  const rel = rng.pick(rels);
  const others = rels.filter((x) => x !== rel);
  const near = rel.word === '以上' ? '>' : rel.word === '以下' ? '<' : rel.word === '未満' ? '\\leqq' : '\\geqq';
  const cases: RelationCase[] = [
    {
      story: `a を b で わると、商が ${q} で 余りが ${r} になる`,
      correct: `a = ${q}b + ${r}`,
      wrong: [`b = ${q}a + ${r}`, `a = ${q}b - ${r}`, `a = ${q + r}b`],
      say: [[0, 'わられる数 = わる数 × 商 + 余り。わられる数は a だよ']],
      tag: 'boss_relation_eq',
      hint: 'わられる数 = わる数 × 商 + 余り',
    },
    {
      story: `あめが x 個 ある。y 人に ${q} 個ずつ 配ると ${r} 個 余る`,
      correct: `x = ${q}y + ${r}`,
      wrong: [`x = ${q}y - ${r}`, `y = ${q}x + ${r}`, `x + ${r} = ${q}y`],
      say: [[0, '余りは 配った あとに 残る 分。全部の 数 = 配った 数 + 余り']],
      tag: 'boss_relation_eq',
      hint: '全部の 数 = 配った 数 + 余った 数',
    },
    {
      story: `1 冊 x 円の ノートを ${n} 冊と、1 本 y 円の ペンを ${m} 本 買うと、代金は ${total} 円 になる`,
      correct: `${n}x + ${m}y = ${total}`,
      wrong: [`${m}x + ${n}y = ${total}`, `${n}x + ${m}y > ${total}`, `${n + m}xy = ${total}`],
      say: [[0, `x 円の ノートが ${n} 冊だから ${n}x。数と 文字の 組み合わせを 確かめよう`]],
      tag: 'boss_relation_eq',
      hint: '(1 冊の 値段)×(冊数)を 2 つ 足すと 代金',
    },
    {
      story: `1 個 x g の 品物 ${n} 個と、1 個 y g の 品物 ${m} 個を あわせた 重さは ${total} g ${rel.word}`,
      correct: `${n}x + ${m}y ${rel.tex} ${total}`,
      wrong: others.map((o) => `${n}x + ${m}y ${o.tex} ${total}`),
      say: [[others.findIndex((o) => o.tex === near), '以上・以下は その数を ふくむ(≧ ≦)。未満・より 大きいは ふくまない(< >)']],
      tag: 'boss_relation_ineq',
      hint: '以上・以下は その数を ふくむ(≧ ≦)。未満・より 大きいは ふくまない(< >)',
    },
    {
      story: `x の ${n} 倍に ${r} を たした 数は、y の ${m} 倍 ${rel.word}`,
      correct: `${n}x + ${r} ${rel.tex} ${m}y`,
      wrong: [`${n}(x + ${r}) ${rel.tex} ${m}y`, ...others.slice(0, 2).map((o) => `${n}x + ${r} ${o.tex} ${m}y`)],
      say: [[0, `「x の ${n} 倍に ${r} を たす」は ${n}x + ${r}。かっこは いらないよ`]],
      tag: 'boss_relation_ineq',
      hint: '言葉の 順に 式に する。「x の n 倍に たす」は nx + …',
    },
  ];
  // ★1 は 等式だけ、★2 は 等式と 品物の 不等式、★3 は 不等式を 多めに
  const pool = d === 1 ? cases.slice(0, 3) : d === 2 ? cases.slice(0, 4) : [cases[0], cases[3], cases[4], cases[4]];
  const c = rng.pick(pool);
  const options = rng.shuffle([c.correct, ...c.wrong]);
  const correct = options.indexOf(c.correct);
  const mistakes: Mistake[] = (c.say ?? [])
    .filter(([i]) => i >= 0 && i < c.wrong.length)
    .map(([i, say]) => ({ answer: { kind: 'choice', options, correct: options.indexOf(c.wrong[i]) }, say }));
  return {
    templateId: 'g1.expr.boss_relation',
    difficulty: d,
    // 文章の 問題は 短くても 本文の 書体で(数式の 書体だと ほかの 問題と 字が ちがって 見える。先生の判定 2026-10-15)
    layout: 'prose',
    prompt: textVars(`「${c.story}」を 式で 表すと?`),
    promptText: `「${c.story}」を 式で 表すと?`,
    answer: { kind: 'choice', options, correct },
    hint: c.hint,
    explanation: [textVars(c.story), `${text('答え: ')} ${c.correct}`],
    mistakes,
    tags: [c.tag],
    key: `boss_rel:${c.story}`,
    verify: String(correct),
  };
}

// ---------------------------------------------------------------- 登録

registerTemplate({ id: 'g1.expr.subst', unit: UNIT, title: '式の値(代入)', timeLimit: { 1: 35, 2: 45, 3: 60 }, generate: genSubst });
registerTemplate({ id: 'g1.expr.collect', unit: UNIT, title: '同類項をまとめる', timeLimit: { 1: 45, 2: 55, 3: 75 }, generate: genCollect });
registerTemplate({ id: 'g1.expr.distribute', unit: UNIT, title: 'かっこをはずす', timeLimit: { 1: 45, 2: 60, 3: 80 }, generate: genDistribute });
registerTemplate({ id: 'g1.expr.model', unit: UNIT, title: '数量を文字式で表す', timeLimit: { 1: 40, 2: 50, 3: 60 }, generate: genModel });
registerTemplate({ id: 'g1.expr.pattern', unit: UNIT, title: '規則を式にする', timeLimit: { 1: 40, 2: 60, 3: 70 }, generate: genPattern });
registerTemplate({ id: 'g1.expr.boss_calc', unit: UNIT, title: '発展の 一次式の計算', timeLimit: { 1: 75, 2: 90, 3: 110 }, generate: genBossCalc });
registerTemplate({ id: 'g1.expr.boss_subst', unit: UNIT, title: '発展の 式の値', timeLimit: { 1: 50, 2: 60, 3: 75 }, generate: genBossSubst });
registerTemplate({ id: 'g1.expr.boss_relation', unit: UNIT, title: '数量の関係を式で(発展)', timeLimit: { 1: 60, 2: 70, 3: 80 }, generate: genBossRelation });

function gcdOf(a: number, b: number): number {
  return b === 0 ? a : gcdOf(b, a % b);
}
