import { registerTemplate, type Difficulty, type Problem } from '@/math/template';
import type { Rng } from '@/math/rng';
import { add, isZero, rat, sub, toTex } from '@/math/rational';
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
    // ax + b に正の数を代入(x は 6 まで。章の最初の地点で出るので、かけ算は 九九の範囲)
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
      explanation: [`${expr.replace(/x/, `(${x})`)} = ${a * x}${signedTex(b)}`, `${text('答え: ')} ${value}`],
      tags: ['substitute'],
      key: `subst:${a}x${b}:${x}`,
      verify: `${a}*(${x})+(${b})`,
    };
  }
  if (d === 2) {
    // 負の数の代入(教科書の「x = −3 のとき 2x + 7、5 − 2x、−x、x²、−x²」の形)。x は −1 〜 −6
    const x = -rng.int(1, 6);
    // 1 つの項だけの式(−x、x²、−x²)は やさしいので 少なめ
    const form = rng.pick([0, 0, 1, 1, 2, 3, 4]);
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
      tags: power ? ['substitute_power'] : ['substitute_negative'],
      key: `subst2:${expr}:${x}`,
      verify,
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
  if (d === 1 || (d === 2 && rng.int(0, 2) === 0)) {
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
  // ★3: かっこが 2 つある式(チャレンジテストの −2(3x − 5) + (7x − 8) の形と、2(3x + 5) − 6(x − 5) の形)、
  // 分数をかける、数 × 分数の形の式
  const form = rng.int(0, 3);
  if (form === 3) return genTimesFractionForm(rng, d);
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
    explanation: [`${task.from} = ${task.correct}`, `${text('答え: ')} ${task.correct}`, ...fractionForms(task.correct)],
    tags: ['notation'],
    key: `notation:${task.fromText}`,
    verify: String(correct),
  };
}

function genModel(rng: Rng, d: Difficulty): Problem {
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
    prompt: `${text(`${c.story} を 文字式で 表すと?`)}`,
    promptText: `${c.story} を 文字式で 表すと?`,
    answer: { kind: 'choice', options: options.map(tex), correct },
    hint: '言葉を 前から 順に 式に 置きかえてみよう',
    explanation: [`${text(c.story)}`, `${text('答え: ')} ${tex(c.correct)}`, ...fractionForms(tex(c.correct))],
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
  // ★3: 棒の本数(図形の並び)か 減っていく並び。以前は ★2 と 同じ形だった(2026-09-28)
  if (d === 3) return rng.bool() ? genMatchsticks(rng, d) : genDecreasing(rng, d);
  // ★2: n番目を式で
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

/**
 * 棒で 図形を 横に つなげて 並べるときの 本数(教科書の「マッチ棒の問題」。チャレンジテストの規則性は 正答率 21〜40%)。
 * 1 個目は 辺の数、1 個 ふえるごとに 辺の数 − 1 本 ふえる
 */
const SHAPES = [
  { name: '正三角形', sides: 3 },
  { name: '正方形', sides: 4 },
  { name: '正五角形', sides: 5 },
  { name: '正六角形', sides: 6 },
];

function genMatchsticks(rng: Rng, d: Difficulty): Problem {
  const shape = rng.pick(SHAPES);
  const step = shape.sides - 1;
  const counts = [1, 2, 3].map((k) => shape.sides + step * (k - 1));
  const expected = `${step}n+1`;
  const story = `棒で ${shape.name}を 横に つなげて 並べる。${shape.name}が 1 個なら ${counts[0]} 本、2 個なら ${counts[1]} 本、3 個なら ${counts[2]} 本。`;
  // 半分は 式を、半分は 20 個などのときの 本数を 聞く
  if (rng.bool()) {
    return {
      templateId: 'g1.expr.pattern',
      difficulty: d,
      prompt: text(`${story}${shape.name}を n 個 つくるのに 必要な 棒の 本数を n の式で 表せ`),
      promptText: `${story}${shape.name}を n 個 つくるのに 必要な 棒の 本数を n の式で 表せ`,
      answer: { kind: 'expression', expected },
      hint: `1 個 ふえるごとに ${step} 本 ふえる。はじめの 1 本に、${step} 本の まとまりが n 個`,
      explanation: [`${text(`1 個 ふえるごとに ${step} 本 → ${step}n`)}`, `${text('1 個のとき ')} ${step} \\times 1 + 1 = ${shape.sides}`, `${text('答え: ')} ${polyToTex(parseExpression(expected)!)}`],
      tags: ['pattern_matchsticks'],
      key: `match:${shape.sides}`,
      verify: expected,
    };
  }
  const n = rng.pick([10, 12, 15, 20, 25, 30]);
  const value = step * n + 1;
  return {
    templateId: 'g1.expr.pattern',
    difficulty: d,
    prompt: text(`${story}${shape.name}を ${n} 個 つくるのに 必要な 棒は 何本?`),
    promptText: `${story}${shape.name}を ${n} 個 つくるのに 必要な 棒は 何本?`,
    answer: { kind: 'number', value: rat(value) },
    hint: `n 個のときの 式を 先に 考えよう(1 個 ふえるごとに ${step} 本)`,
    explanation: [`${text('n 個のとき ')} ${step}n + 1`, `${step} \\times ${n} + 1 = ${value}`, `${text('答え: ')} ${value} ${text('本')}`],
    tags: ['pattern_matchsticks'],
    key: `match:${shape.sides}:${n}`,
    verify: `${step}*${n}+1`,
  };
}

/** ★3: 減っていく並び(20, 17, 14, 11, … → −3n + 23) */
function genDecreasing(rng: Rng, d: Difficulty): Problem {
  const a = rng.int(2, 5);
  const b = rng.int(15, 30);
  const terms = [0, 1, 2, 3].map((i) => b - a * i);
  const expected = `${-a}n+${b + a}`;
  return {
    templateId: 'g1.expr.pattern',
    difficulty: d,
    prompt: `${terms.join(', ')}, \\ldots \\quad ${text('この並びの n 番目の数を n の式で 表せ')}`,
    promptText: `${terms.join(', ')}, … この並びの n 番目の数を n の式で 表せ`,
    answer: { kind: 'expression', expected },
    hint: `${a} ずつ 減っているから −${a}n。1 番目が ${b} になるように 数を たそう`,
    explanation: [`${text(`${a} ずつ 減る → `)} -${a}n`, `${text('1番目は ')} -${a} \\times 1 + ${b + a} = ${b}`, `${text('答え: ')} ${polyToTex(parseExpression(expected)!)}`],
    tags: ['pattern_decreasing'],
    key: `patd:${a}:${b}`,
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
