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
      prompt: `x = ${paren(x)} ${text('のとき、')} ${expr} ${text('の値は?')}`,
      promptText: `x = ${plainMinus(paren(x))} のとき、${plainMinus(expr.replace('^{2}', '²'))} の値は?`,
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
  // ★3: 2文字の代入
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
    prompt: `x = ${paren(x)}, y = ${paren(y)} ${text('のとき、')} ${expr} ${text('の値は?')}`,
    promptText: `x = ${plainMinus(paren(x))}, y = ${plainMinus(paren(y))} のとき、${plainMinus(expr)} の値は?`,
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
    // 2文字
    const a = rng.nonZero(6);
    const b = rng.nonZero(6);
    const c = rng.nonZero(6);
    const e = rng.nonZero(6);
    const expr = `${coefTex(a, 'a')}${signedTex(c, 'b')}${signedTex(b, 'a')}${signedTex(e, 'b')}`;
    const expected = `${a + b}a+${c + e}b`;
    return {
      templateId: 'g1.expr.collect',
      difficulty: d,
      prompt: `${expr} ${text('を 簡単にせよ')}`,
      promptText: `${plainMinus(expr)} を 簡単にせよ`,
      answer: { kind: 'expression', expected },
      hint: 'a は a どうし、b は b どうし。別の文字は まとめられない',
      explanation: [`${coefTex(a, 'a')}${signedTex(b, 'a')} = ${coefTex(a + b, 'a')}`, `${coefTex(c, 'b')}${signedTex(e, 'b')} = ${coefTex(c + e, 'b')}`, `${text('答え: ')} ${polyToTex(parseExpression(expected)!)}`],
      tags: ['collect_two_vars'],
      key: `collect2:${a}:${b}:${c}:${e}`,
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
    // 2つのかっこの和・差
    const k1 = rng.nonZero(5, 2);
    const k2 = rng.nonZero(5, 2);
    const a = rng.nonZero(6);
    const b = rng.nonZero(6);
    const c = rng.nonZero(6);
    const e = rng.nonZero(6);
    const expr = `${paren(k1)}(${coefTex(a, 'x')}${signedTex(b)}) + ${paren(k2)}(${coefTex(c, 'x')}${signedTex(e)})`;
    const expected = `${k1 * a + k2 * c}x+${k1 * b + k2 * e}`;
    return {
      templateId: 'g1.expr.distribute',
      difficulty: d,
      prompt: `${expr} ${text('を 計算せよ')}`,
      promptText: `${plainMinus(expr)} を 計算せよ`,
      answer: { kind: 'expression', expected },
      hint: 'それぞれの かっこを 先に はずして、あとで 同類項を まとめる',
      explanation: [
        `${paren(k1)}(${coefTex(a, 'x')}${signedTex(b)}) = ${coefTex(k1 * a, 'x')}${signedTex(k1 * b)}`,
        `${paren(k2)}(${coefTex(c, 'x')}${signedTex(e)}) = ${coefTex(k2 * c, 'x')}${signedTex(k2 * e)}`,
        `${text('答え: ')} ${polyToTex(parseExpression(expected)!)}`,
      ],
      tags: ['distribute_two'],
      key: `dist2:${k1}:${a}:${b}:${k2}:${c}:${e}`,
      verify: expected,
    };
  }
  // ★3: 分数をかける
  const den = rng.pick([2, 3, 4]);
  const num = rng.int(1, den - 1) || 1;
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

function genModel(rng: Rng, d: Difficulty): Problem {
  const c = modelCases(rng, d);
  const tex = (s: string) => {
    const p = parseExpression(s);
    return p ? polyToTex(p) : s.replace(/\//g, ' \\div ');
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
