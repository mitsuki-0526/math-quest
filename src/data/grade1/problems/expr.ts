import { registerTemplate, type Difficulty, type Problem } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat, toTex } from '@/math/rational';
import { paren, plainMinus, text } from '@/math/format';
import { parseExpression, polyToTex } from '@/math/expr';

/**
 * 第2章「文字と式」のテンプレート(台本 02_nameless_plain.md の敵に対応)。
 *   g1.expr.subst      文字の妖精エックス  式の値(代入)
 *   g1.expr.collect    まとめ屋ゴブリン    同類項をまとめる(式入力)
 *   g1.expr.distribute 分配キツネ          分配法則・かっこをはずす(式入力)
 *   g1.expr.model      表しヒツジ          数量を文字式で表す(選択式)
 *   g1.expr.pattern    規則ムカデ          n番目の数(式入力)
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

function genSubst(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    // ax + b に正の数を代入
    const a = rng.int(2, 9);
    const b = rng.nonZero(9);
    const x = rng.int(2, 9);
    const value = a * x + b;
    const expr = `${coefTex(a, 'x')}${signedTex(b)}`;
    return {
      templateId: 'g1.expr.subst',
      difficulty: d,
      prompt: `x = ${x} ${text('のとき、')} ${expr} ${text('の値は?')}`,
      promptText: `x = ${x} のとき、${plainMinus(expr)} の値は?`,
      answer: { kind: 'number', value: rat(value) },
      hint: 'x のところに 数を そのまま 入れてみよう',
      explanation: [`${expr.replace(/x/, `(${x})`)} = ${a * x}${signedTex(b)}`, `${text('答え: ')} ${value}`],
      tags: ['substitute'],
      key: `subst:${a}x${b}:${x}`,
      verify: `${a}*(${x})+(${b})`,
    };
  }
  if (d === 2) {
    // 負の数の代入、または 2乗を含む
    const usePower = rng.bool();
    const a = rng.nonZero(6);
    const b = rng.nonZero(9);
    const x = rng.nonZero(6);
    const value = usePower ? a * x * x + b : a * x + b;
    const expr = usePower ? `${coefTex(a, 'x^{2}')}${signedTex(b)}` : `${coefTex(a, 'x')}${signedTex(b)}`;
    return {
      templateId: 'g1.expr.subst',
      difficulty: d,
      prompt: `x = ${x} ${text('のとき、')} ${expr} ${text('の値は?')}`,
      promptText: `x = ${plainMinus(String(x))} のとき、${plainMinus(expr.replace('^{2}', '²'))} の値は?`,
      answer: { kind: 'number', value: rat(value) },
      hint: usePower ? '負の数を 代入するときは かっこを つけて (−3)² のように' : 'x のところに かっこをつけて 入れよう',
      explanation: [
        usePower ? `${a} \\times ${paren(x)}^{2}${signedTex(b)} = ${a} \\times ${x * x}${signedTex(b)}` : `${a} \\times ${paren(x)}${signedTex(b)} = ${a * x}${signedTex(b)}`,
        `${text('答え: ')} ${value}`,
      ],
      tags: usePower ? ['substitute_power'] : ['substitute_negative'],
      key: `subst2:${a}:${b}:${x}:${usePower}`,
      verify: usePower ? `${a}*(${x})**2+(${b})` : `${a}*(${x})+(${b})`,
    };
  }
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
  // 2文字の代入
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

// ---------------------------------------------------------------- 同類項

function genCollect(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    // ax + bx + c + e
    const a = rng.int(2, 9);
    const b = rng.nonZero(8);
    const c = rng.nonZero(9);
    const e = rng.nonZero(9);
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
  if (d === 2) {
    // 一次式の加法・減法: (ax + b) ± (cx + d)。教科書・学習プリントの形(docs/difficulty.md)。
    // 2 文字の同類項(3a + 2b − a + 4b)は 2 年の「整式の加減」なので出さない
    const a = rng.nonZero(6);
    const b = rng.nonZero(9);
    const c = rng.nonZero(6);
    const e = rng.nonZero(9);
    const minus = rng.bool();
    const s = minus ? -1 : 1;
    const inner = (p: number, q: number) => `${coefTex(p, 'x')}${signedTex(q)}`;
    const expr = `(${inner(a, b)}) ${minus ? '-' : '+'} (${inner(c, e)})`;
    // x の項が 消える式(答えが 数だけ)は 練習の ねらいから外れるので 作り直す
    if (a + s * c === 0) return genCollect(rng, d);
    const expected = `${a + s * c}x+${b + s * e}`;
    return {
      templateId: 'g1.expr.collect',
      difficulty: d,
      prompt: `${expr} ${text('を 計算せよ')}`,
      promptText: `${plainMinus(expr)} を 計算せよ`,
      answer: { kind: 'expression', expected },
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
  // ★3: 分数係数
  const den = rng.pick([2, 3, 4]);
  const a = rng.int(1, 5);
  const b = rng.int(1, 5);
  const c = rng.nonZero(6);
  const expr = `\\frac{${a}}{${den}}x${signedTex(b, 'x')}${signedTex(c)}`;
  const expected = `(${a}/${den}+${b})x+${c}`;
  return {
    templateId: 'g1.expr.collect',
    difficulty: d,
    prompt: `${expr} ${text('を 簡単にせよ')}`,
    promptText: `${a}/${den}x ${b < 0 ? '-' : '+'} ${Math.abs(b)}x ${c < 0 ? '-' : '+'} ${Math.abs(c)} を 簡単にせよ`,
    answer: { kind: 'expression', expected },
    hint: '分数の 係数も 同じように 足せる。通分してから',
    explanation: [`${text('x の項: ')} \\frac{${a}}{${den}} ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${toTex(rat(a + b * den, den))}`, `${text('答え: ')} ${polyToTex(parseExpression(expected)!)}`],
    tags: ['collect_fraction'],
    key: `collect3:${a}/${den}:${b}:${c}`,
    verify: expected,
  };
}

// ---------------------------------------------------------------- 分配法則

function genDistribute(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    const k = rng.nonZero(6, 2);
    const a = rng.nonZero(8);
    const b = rng.nonZero(9);
    const expr = `${paren(k)}(${coefTex(a, 'x')}${signedTex(b)})`;
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
    // 一次式 ÷ 数(例: (12x − 4) ÷ 4、(16x + 10) ÷ (−2))。わり切れるように作る
    const k = rng.nonZero(5, 2);
    const a = k * rng.nonZero(4);
    const b = k * rng.nonZero(5);
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
      tags: ['divide_expression'],
      key: `dist2:${a}:${b}:${k}`,
      verify: expected,
    };
  }
  // ★3: かっこが 2 つある式(チャレンジテストの −2(3x − 5) + (7x − 8) の形と、2(3x + 5) − 6(x − 5) の形)、または 分数をかける
  const form = rng.int(0, 2);
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
  let task: { from: string; fromText: string; correct: string; wrong: string[]; hint: string };
  if (d === 3 && rng.bool()) {
    // 不等式で表す
    const k = rng.pick([3, 4, 5, 6, 8]);
    const total = rng.pick([100, 500, 1000]);
    const rel = rng.pick([
      { word: '以下', tex: '\\leqq' },
      { word: '以上', tex: '\\geqq' },
      { word: '未満', tex: '<' },
      { word: 'より 大きい', tex: '>' },
    ]);
    const lhs = `${k}a`;
    const story = `1個 a 円の パンを ${k} 個 買った 代金は、${total} 円${rel.word}`;
    const all = ['\\leqq', '\\geqq', '<', '>'].map((t) => `${lhs} ${t} ${total}`);
    task = {
      from: text(`「${story}」を 不等式で 表すと?`),
      fromText: `「${story}」を 不等式で 表すと?`,
      correct: `${lhs} ${rel.tex} ${total}`,
      wrong: all.filter((s) => s !== `${lhs} ${rel.tex} ${total}`),
      hint: '以上・以下は その数を ふくむ(≧ ≦)。未満・より大きいは ふくまない(< >)',
    };
    const options = rng.shuffle([task.correct, ...task.wrong]);
    return {
      templateId: 'g1.expr.model',
      difficulty: d,
      prompt: task.from,
      promptText: task.fromText,
      answer: { kind: 'choice', options, correct: options.indexOf(task.correct) },
      hint: task.hint,
      explanation: [`${text(`${rel.word} → `)} ${rel.tex}`, `${text('答え: ')} ${task.correct}`],
      tags: ['inequality'],
      key: `ineq:${k}:${total}:${rel.word}`,
      verify: String(options.indexOf(task.correct)),
    };
  }
  const cases =
    d === 1
      ? [
          { from: `a \\times ${n} \\times b`, fromText: `a × ${n} × b`, correct: `${n}ab`, wrong: [`a${n}b`, `${n}+ab`, `\\frac{ab}{${n}}`], hint: '× を はぶいて、数を 文字の 前に 書く' },
          { from: `x \\div ${n}`, fromText: `x ÷ ${n}`, correct: `\\frac{x}{${n}}`, wrong: [`\\frac{${n}}{x}`, `${n}x`, `x-${n}`], hint: '÷ は 分数の 形に。わられる数が 分子' },
          { from: `a \\times a \\times b`, fromText: 'a × a × b', correct: 'a^{2}b', wrong: ['2ab', 'a^{2}+b', '2a+b'], hint: '同じ 文字の 積は 累乗で 書く' },
        ]
      : d === 2
        ? [
            { from: `x \\times ${p} \\div ${q}`, fromText: `x × ${p} ÷ ${q}`, correct: `\\frac{${p}x}{${q}}`, wrong: [`\\frac{${q}x}{${p}}`, `${p * q}x`, `\\frac{x}{${p * q}}`], hint: '× の数は 分子に、÷ の数は 分母に' },
            { from: `${n} - a \\div ${q}`, fromText: `${n} − a ÷ ${q}`, correct: `${n}-\\frac{a}{${q}}`, wrong: [`\\frac{${n}-a}{${q}}`, `${n}-${q}a`, `\\frac{a}{${q}}-${n}`], hint: '÷ は その 直前の 数(文字)だけに かかる' },
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
    explanation: [`${task.from} = ${task.correct}`, `${text('答え: ')} ${task.correct}`],
    tags: ['notation'],
    key: `notation:${task.fromText}`,
    verify: String(correct),
  };
}

function genModel(rng: Rng, d: Difficulty): Problem {
  // 3 回に 1 回は 表し方・不等式
  if (rng.int(0, 2) === 0) return genNotation(rng, d);
  const c = modelCases(rng, d);
  // 文字で わる式(5/x など)は 多項式として読めないので、分数の形で書く(文字式では ÷ を使わない)
  const tex = (s: string) => {
    const p = parseExpression(s);
    if (p) return polyToTex(p);
    const [num, den] = s.split('/');
    return den ? `\\frac{${num}}{${den}}` : s;
  };
  // 表示が同じになる誤答(x+3 と 3+x など)は除く。同じ選択肢が2つあると正解を選んでも不正解になりうる
  const seen = new Set([tex(c.correct)]);
  const wrong = c.wrong.filter((w) => !seen.has(tex(w)) && seen.add(tex(w)));
  const options = rng.shuffle([c.correct, ...wrong.slice(0, 3)]);
  const correct = options.indexOf(c.correct);
  return {
    templateId: 'g1.expr.model',
    difficulty: d,
    prompt: `${text(`${c.story} を 文字式で 表すと?`)}`,
    promptText: `${c.story} を 文字式で 表すと?`,
    answer: { kind: 'choice', options: options.map(tex), correct },
    hint: '言葉を 前から 順に 式に 置きかえてみよう',
    explanation: [`${text(c.story)}`, `${text('答え: ')} ${tex(c.correct)}`],
    tags: ['model_expression'],
    key: `model:${c.story}`,
    verify: String(correct),
  };
}

// ---------------------------------------------------------------- 規則性(n番目)

function genPattern(rng: Rng, d: Difficulty): Problem {
  const a = rng.int(2, 6); // 増える数
  const b = rng.int(1, 8); // 1番目の数
  const terms = [0, 1, 2, 3].map((i) => b + a * i);
  const expected = `${a}n+${b - a}`;
  if (d === 1) {
    // 5番目の数を答える(数値)
    const nth = rng.int(5, 8);
    const value = b + a * (nth - 1);
    return {
      templateId: 'g1.expr.pattern',
      difficulty: d,
      prompt: `${terms.join(', ')}, \\ldots \\quad ${text(`この並びの ${nth} 番目の数は?`)}`,
      promptText: `${terms.join(', ')}, … この並びの ${nth} 番目の数は?`,
      answer: { kind: 'number', value: rat(value) },
      hint: `いくつずつ 増えているか 数えてみよう`,
      explanation: [`${text(`${a} ずつ 増えている`)}`, `${b} + ${a} \\times ${nth - 1} = ${value}`, `${text('答え: ')} ${value}`],
      tags: ['pattern_value'],
      key: `pat:${a}:${b}:${nth}`,
      verify: `${b}+${a}*${nth - 1}`,
    };
  }
  // ★2〜3: n番目を式で
  return {
    templateId: 'g1.expr.pattern',
    difficulty: d,
    prompt: `${terms.join(', ')}, \\ldots \\quad ${text('この並びの n 番目の数を n の式で 表せ')}`,
    promptText: `${terms.join(', ')}, … この並びの n 番目の数を n の式で 表せ`,
    answer: { kind: 'expression', expected },
    hint: `${a} ずつ 増えているから、まず ${a}n を 考えて、ずれを 足し引きしよう`,
    explanation: [`${text(`${a} ずつ 増える → ${a}n`)}`, `${text('1番目は ')} ${a} \\times 1 ${b - a < 0 ? '-' : '+'} ${Math.abs(b - a)} = ${b}`, `${text('答え: ')} ${polyToTex(parseExpression(expected)!)}`],
    tags: ['pattern_expression'],
    key: `patn:${a}:${b}`,
    verify: expected,
  };
}

// ---------------------------------------------------------------- 登録

registerTemplate({ id: 'g1.expr.subst', unit: UNIT, title: '式の値(代入)', timeLimit: { 1: 35, 2: 45, 3: 60 }, generate: genSubst });
registerTemplate({ id: 'g1.expr.collect', unit: UNIT, title: '同類項をまとめる', timeLimit: { 1: 45, 2: 55, 3: 75 }, generate: genCollect });
registerTemplate({ id: 'g1.expr.distribute', unit: UNIT, title: 'かっこをはずす', timeLimit: { 1: 45, 2: 60, 3: 80 }, generate: genDistribute });
registerTemplate({ id: 'g1.expr.model', unit: UNIT, title: '数量を文字式で表す', timeLimit: { 1: 40, 2: 50, 3: 60 }, generate: genModel });
registerTemplate({ id: 'g1.expr.pattern', unit: UNIT, title: '規則を式にする', timeLimit: { 1: 40, 2: 60, 3: 70 }, generate: genPattern });

function gcdOf(a: number, b: number): number {
  return b === 0 ? a : gcdOf(b, a % b);
}
