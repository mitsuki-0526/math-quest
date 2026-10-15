import { mistakeNum, registerTemplate, type Difficulty, type Mistake, type Problem } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat, toTex, type Rational } from '@/math/rational';
import { plainMinus, text } from '@/math/format';

/**
 * 第3章「方程式」のテンプレート(台本 03_unknown_cave.md の敵に対応)。
 *   g1.eq.basic    てんびんスライム  方程式の解・等式の性質(x + a = b、ax = b、x/k = b)
 *   g1.eq.linear   移項ネズミ        移項(ax + b = c、両辺に x)
 *   g1.eq.paren    かっこトロル      かっこを含む方程式
 *   g1.eq.fraction 分数ゴースト      小数・分数の係数
 *   g1.eq.ratio    比のカニ          比例式
 *   g1.eq.word     (ボス)            文章題(選択式で式 → 数値で解)
 * ★ は 教科書(東京書籍「新しい数学1」3章)の 順に 合わせた(2026-10-15、先生の方針「道中は教科書」)。
 * 各 ★ の 1 段目が 教科書の 前の方の問題に なるようにし、チャレンジテストの 形(12x + 9 = 7x − 11、2 − 7x = 3x − 8、
 * x + 3(2x − 5) = 6、(x + 2) : 9 = 10 : 6)は ★3 に 置く。解は 整数(±12 まで)が 基本で、
 * 分数の 解は 基本の ★3(6x = 4)だけ。答えは すべて「x の値」
 */
const UNIT = '方程式';

// ---------------------------------------------------------------- 式の 書き方

/** 係数つきの x(1x → x、−1x → −x) */
const coef = (c: number, v = 'x'): string => (c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`);
/** 2 つめ以降の 項(符号つき。0 なら 書かない) */
const signed = (c: number, v = ''): string => (c === 0 ? '' : `${c < 0 ? ' - ' : ' + '}${v ? coef(Math.abs(c), v) : Math.abs(c)}`);
/** ax + b(a が 0 なら b だけ) */
const lin = (a: number, b: number): string => (a === 0 ? String(b) : `${coef(a)}${signed(b)}`);
/** 項を 反対の辺へ 移したときの 書き方(符号を 変えて たす) */
const moved = (c: number, v = ''): string => signed(-c, v);
/** 小数(10 分の n、100 分の n)。12 → 1.2、−5 → −0.5、20 → 2 */
const dec = (n: number, scale = 10): string => String(n / scale);
/** 小数の 係数の x */
const decCoef = (n: number, scale = 10): string => coef(n / scale);
const decSigned = (n: number, scale = 10): string => `${n < 0 ? ' - ' : ' + '}${dec(Math.abs(n), scale)}`;
/** 答えの 行 */
const answerLine = (x: Rational | number): string => `${text('答え: ')} x = ${toTex(typeof x === 'number' ? rat(x) : x)}`;
/** px + q = rx + s の 解(解説・まちがいの 計算に 使う) */
const solve = (p: number, q: number, r: number, s: number): Rational => rat(s - q, p - r);
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

interface EqParts {
  d: Difficulty;
  id: string;
  /** 方程式の TeX(「x を求めよ」は 付けない) */
  eq: string;
  answer: Rational | number;
  hint: string;
  explanation: string[];
  mistakes?: Mistake[];
  tags: string[];
  key: string;
  verify: string;
}

/** 「〜 の x を求めよ」の 形の 問題に まとめる */
function eqProblem(p: EqParts): Problem {
  const plain = plainMinus(p.eq.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/$2').replace(/\((\w)\)\//g, '$1/').replace(/\\times/g, '×'));
  return {
    templateId: p.id,
    difficulty: p.d,
    prompt: `${p.eq} \\quad ${text('x を求めよ')}`,
    promptText: `${plain} の x を求めよ`,
    answer: { kind: 'number', value: typeof p.answer === 'number' ? rat(p.answer) : p.answer },
    hint: p.hint,
    explanation: p.explanation,
    // 一言の 負の数も 平文の −(−3 など)で 見せる
    mistakes: p.mistakes?.map((m) => ({ ...m, say: plainMinus(m.say) })),
    tags: p.tags,
    key: p.key,
    verify: p.verify,
  };
}

// ---------------------------------------------------------------- 基本(等式の性質)

/**
 * 方程式の解・等式の性質(てんびんスライム)。
 *   ★1: x + a = b、x − a = b、ax = b(数は 1 けた・解は 正の数)/ 5 回に 1 回 解を 選ぶ(2x + 1 = 7 の 解は 1〜4 の どれ?)
 *   ★2: 解が 負の数(x + 7 = 3)/ ax = b の 負の数(−4x = 12)/ −x = 6 / x/k = b(両辺に k を かける)
 *   ★3: 解が 分数(6x = 4 → 2/3)/ 分数の 係数(⅔x = 6 → 両辺に 逆数を かける)/ ★2 の 形の 数を 大きく
 */
function genBasic(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    const form = rng.pick([0, 0, 1, 1, 2, 2, 3]);
    if (form === 3) return genSolutionChoice(rng, d);
    if (form === 2) {
      const a = rng.int(2, 9);
      const x = rng.int(2, 9);
      return basicMul(d, a, x);
    }
    const a = rng.int(1, 9);
    const x = rng.int(1, 9);
    return form === 0 ? basicAdd(d, a, x) : basicAdd(d, -a, x);
  }
  if (d === 2) {
    const form = rng.pick([0, 0, 1, 1, 2, 3, 3]);
    if (form === 0) {
      // 解が 負の数 / a が 負の数(x − 4 = −9)
      const x = rng.nonZero(9);
      const a = rng.nonZero(9);
      if (x > 0 && a > 0) return basicAdd(d, a, -x);
      return basicAdd(d, a, x);
    }
    if (form === 1) {
      const a = rng.nonZero(9, 2);
      const x = rng.nonZero(9);
      return a > 0 && x > 0 ? basicMul(d, -a, x) : basicMul(d, a, x);
    }
    if (form === 2) return basicMul(d, -1, rng.nonZero(12, 2));
    // x/k = b
    const k = rng.int(2, 6);
    const b = rng.nonZero(6);
    return basicDiv(d, k, b);
  }
  const form = rng.pick([0, 0, 1, 1, 2]);
  if (form === 0) {
    // 解が 分数: ax = b で b が a で わりきれない(約分は する)
    let a: number, b: number;
    do {
      a = rng.nonZero(9, 2);
      b = rng.nonZero(12, 1);
    } while (b % a === 0 || Math.abs(a) === Math.abs(b));
    return basicMul(d, a, rat(b, a));
  }
  if (form === 1) {
    // (p/q)x = b。解は 整数
    let p: number, q: number;
    do {
      p = rng.nonZero(5);
      q = rng.int(2, 6);
    } while (gcd(p, q) !== 1);
    const x = q * rng.nonZero(Math.max(1, Math.floor(12 / q)));
    return basicFracCoef(d, p, q, x);
  }
  return rng.bool() ? basicMul(d, rng.nonZero(12, 6), rng.nonZero(12)) : basicAdd(d, rng.nonZero(20, 10), rng.nonZero(12));
}

/** x + a = b(a が 負なら x − |a| = b) */
function basicAdd(d: Difficulty, a: number, x: number): Problem {
  const b = x + a;
  const eq = `${lin(1, a)} = ${b}`;
  return eqProblem({
    d,
    id: 'g1.eq.basic',
    eq,
    answer: x,
    hint: a > 0 ? `天秤の 両側から ${a} を 取ってみよう(両辺から ${a} を ひく)` : `天秤の 両側に ${-a} を のせてみよう(両辺に ${-a} を たす)`,
    explanation: [
      `${eq}`,
      `${lin(1, a)}${moved(a)} = ${b}${moved(a)} \\quad ${text(a > 0 ? `(両辺から ${a} を ひく)` : `(両辺に ${-a} を たす)`)}`,
      `x = ${x}`,
      answerLine(x),
    ],
    // 両辺から ひく ところを たした(符号を 変えずに 移した)
    mistakes: [mistakeNum(b + a, a > 0 ? `x に ${a} が たしてあるから、両辺から ${a} を ひくんだよ(${b} − ${a})` : `x から ${-a} が ひいてあるから、両辺に ${-a} を たすんだよ(${b} + ${-a})`)],
    tags: ['eq_add'],
    key: `eqb:x${a}=${b}`,
    verify: `${b}-(${a})`,
  });
}

/** ax = b(x は 整数 または 分数) */
function basicMul(d: Difficulty, a: number, x: number | Rational): Problem {
  const xr = typeof x === 'number' ? rat(x) : x;
  const b = Number((xr.n * BigInt(a)) / xr.d);
  const eq = `${coef(a)} = ${b}`;
  const frac = xr.d !== 1n;
  // 約分が いるのは 分子と 分母に 公約数が あるときだけ(4x = 11 は そのまま 11/4)
  const reduce = frac && gcd(a, b) !== 1;
  const mistakes: Mistake[] = [];
  // わる数と わられる数を 逆に(4x = 12 で 4/12)
  if (b !== 0) mistakes.push(mistakeNum(rat(a, b), `${coef(a)} = ${b} は 両辺を ${a < 0 ? `(${a})` : a} で わる。${b} ÷ ${a < 0 ? `(${a})` : a} だよ(わる順が 逆)`));
  // 符号だけ ちがう
  if (a < 0) mistakes.push(mistakeNum(rat(-b, a), `数の 大きさは 合ってる! 両辺を ${a} で わるから、符号も 変わるよ`));
  // 両辺から a を ひいた(かけ算を 移項の ように した)
  mistakes.push(mistakeNum(b - a, `${coef(a)} は ${a < 0 ? `(${a})` : a} × x。ひくのでは なく、両辺を ${a < 0 ? `(${a})` : a} で わろう`));
  return eqProblem({
    d,
    id: 'g1.eq.basic',
    eq,
    answer: xr,
    hint: a === -1 ? '−x は (−1) × x。両辺を −1 で わろう(両辺に −1 を かけても よい)' : `両辺を x の 係数 ${a} で わってみよう`,
    explanation: [
      `${eq}`,
      `\\frac{${coef(a)}}{${a}} = \\frac{${b}}{${a}} \\quad ${text(`(両辺を ${a} で わる)`)}`,
      `x = ${toTex(xr)}${reduce ? ` \\quad ${text('(約分する)')}` : ''}`,
      answerLine(xr),
    ],
    mistakes,
    tags: frac ? ['eq_mul', 'eq_fraction_answer'] : a === -1 ? ['eq_mul', 'eq_minus_x'] : ['eq_mul'],
    key: `eqb:${a}x=${b}`,
    verify: `(${b})/(${a})`,
  });
}

/** x/k = b(両辺に k を かける) */
function basicDiv(d: Difficulty, k: number, b: number): Problem {
  const x = k * b;
  const eq = `\\frac{x}{${k}} = ${b}`;
  return eqProblem({
    d,
    id: 'g1.eq.basic',
    eq,
    answer: x,
    hint: `x/${k} は x ÷ ${k}。両辺に ${k} を かけてみよう`,
    explanation: [`${eq}`, `\\frac{x}{${k}} \\times ${k} = ${b} \\times ${k} \\quad ${text(`(両辺に ${k} を かける)`)}`, `x = ${x}`, answerLine(x)],
    // かけずに わった(b ÷ k)
    mistakes: [mistakeNum(rat(b, k), `x/${k} は x を ${k} で わった数。もとの x に もどすには 両辺に ${k} を かけるよ`)],
    tags: ['eq_div'],
    key: `eqb:x/${k}=${b}`,
    verify: `(${b})*${k}`,
  });
}

/** (p/q)x = b(両辺に 逆数 q/p を かける) */
function basicFracCoef(d: Difficulty, p: number, q: number, x: number): Problem {
  const b = (p * x) / q;
  const sign = p < 0 ? '-' : '';
  const eq = `${sign}\\frac{${Math.abs(p)}}{${q}}x = ${b}`;
  const inv = Math.abs(p) === 1 ? `${sign}${q}` : `${sign}\\frac{${q}}{${Math.abs(p)}}`;
  return eqProblem({
    d,
    id: 'g1.eq.basic',
    eq,
    answer: x,
    hint: `x の 係数 ${p < 0 ? '−' : ''}${Math.abs(p)}/${q} の 逆数を 両辺に かけよう`,
    explanation: [`${eq}`, `x = ${b} \\times \\left(${inv}\\right) \\quad ${text('(両辺に 係数の 逆数を かける)')}`, `x = ${x}`, answerLine(x)],
    // 逆数で なく 係数を そのまま かけた
    mistakes: [mistakeNum(rat(b * p, q), `係数の ${p < 0 ? '−' : ''}${Math.abs(p)}/${q} を 消すには、逆数の ${p < 0 ? '−' : ''}${q}/${Math.abs(p)} を かけるよ`)],
    tags: ['eq_mul', 'eq_frac_coef'],
    key: `eqb:${p}/${q}x=${b}`,
    verify: `(${b})*${q}/(${p})`,
  });
}

/** 方程式の解を 選ぶ(教科書の はじめ: x に 数を 入れて 左辺と 右辺が 等しく なるか) */
function genSolutionChoice(rng: Rng, d: Difficulty): Problem {
  const a = rng.int(2, 4);
  const b = rng.nonZero(6);
  const start = rng.int(-1, 1);
  const values = [start, start + 1, start + 2, start + 3];
  const x = rng.pick(values.filter((v) => v !== 0));
  const c = a * x + b;
  const eq = `${lin(a, b)} = ${c}`;
  const options = values.map((v) => `x = ${v}`);
  const correct = values.indexOf(x);
  return {
    templateId: 'g1.eq.basic',
    difficulty: d,
    prompt: `${text(`${values.join('、').replace(/-/g, '−')} の うち、方程式`)} \\; ${eq} \\; ${text('の 解は?')}`,
    promptText: `${values.join('、').replace(/-/g, '−')} の うち、方程式 ${plainMinus(eq)} の 解は?`,
    answer: { kind: 'choice', options, correct },
    hint: 'x に 1 つずつ 入れて、左辺と 右辺が 等しく なるか 調べよう',
    explanation: [...values.map((v) => `x = ${v} ${text('のとき 左辺は')} ${a} \\times ${v < 0 ? `(${v})` : v}${signed(b)} = ${a * v + b}${v === x ? ` \\quad ${text('← 右辺と 等しい')}` : ''}`), `${text('答え: ')} x = ${x}`],
    tags: ['eq_solution'],
    key: `eqs:${a}:${b}:${c}:${start}`,
    verify: String(correct),
  };
}

// ---------------------------------------------------------------- 移項

/**
 * 移項(移項ネズミ)。
 *   ★1: ax + b = c(a は 2〜9、解は 正の数)
 *   ★2: ax = cx + e(5x = 3x + 8)/ ax + b = cx + e(係数 9 まで、解は ±9)
 *   ★3: チャレンジテストの形 12x + 9 = 7x − 11 / 数の項が 先の 2 − 7x = 3x − 8(係数 12 まで、解は ±12)
 */
function genLinear(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    const a = rng.int(2, 9);
    const x = rng.int(1, 9);
    const b = rng.nonZero(9);
    return linearProblem(d, a, b, 0, a * x + b, x, false);
  }
  if (d === 2 && rng.bool()) {
    // ax = cx + e(数の項は 右だけ)
    const a = rng.int(2, 9);
    let c = rng.int(1, 8);
    while (c === a) c = rng.int(1, 8);
    const x = rng.nonZero(9);
    return linearProblem(d, a, 0, c, (a - c) * x, x, false);
  }
  const max = d === 2 ? 9 : 12;
  const x = rng.nonZero(max);
  let a: number, c: number, b: number, e: number;
  do {
    a = rng.nonZero(max);
    c = rng.nonZero(max);
    b = rng.nonZero(d === 2 ? 12 : 15);
    e = (a - c) * x + b;
  } while (a === c || e === 0 || Math.abs(e) > (d === 2 ? 30 : 60) || (d === 3 && Math.abs(a) < 2 && Math.abs(c) < 2));
  // ★3 の 半分は 数の項が 先(2 − 7x = 3x − 8)
  return linearProblem(d, a, b, c, e, x, d === 3 && rng.bool());
}

/** ax + b = cx + e(c = 0 なら 右辺は 数だけ)。constFirst なら 左辺を b + ax と 書く */
function linearProblem(d: Difficulty, a: number, b: number, c: number, e: number, x: number, constFirst: boolean): Problem {
  const left = constFirst ? `${b}${signed(a, 'x')}` : lin(a, b);
  const right = lin(c, e);
  const eq = `${left} = ${right}`;
  const steps: string[] = [eq];
  // 移項: x の項は 左へ、数の項は 右へ(符号を 変える)
  const what = [c !== 0 ? `${plainMinus(coef(c))}` : '', b !== 0 ? `${plainMinus(String(b))}` : ''].filter(Boolean).join(' と ');
  steps.push(`${coef(a)}${c !== 0 ? moved(c, 'x') : ''} = ${e}${b !== 0 ? moved(b) : ''} \\quad ${text(`(${what} を 移項)`)}`);
  if (c !== 0 || b !== 0) steps.push(`${coef(a - c)} = ${e - b}`);
  if (a - c !== 1) steps.push(`x = ${toTex(rat(e - b, a - c))} \\quad ${text(`(両辺を ${a - c} で わる)`)}`);
  steps.push(answerLine(x));
  const mistakes: Mistake[] = [];
  // 数の項を 符号を 変えずに 移した
  if (b !== 0) mistakes.push(mistakeNum(solve(a - c, 0, 0, e + b), `${plainMinus(String(b))} を 右辺へ 移すときは 符号を 変えて ${plainMinus(String(-b))} に するよ`));
  // x の項を 符号を 変えずに 移した
  if (c !== 0 && a + c !== 0) mistakes.push(mistakeNum(solve(a + c, 0, 0, e - b), `${plainMinus(coef(c))} を 左辺へ 移すときは 符号を 変えて ${plainMinus(coef(-c))} に するよ`));
  // 最後に わるところを ひいた(5x = 15 で 10)
  if (a - c !== 1 && a - c !== -1) mistakes.push(mistakeNum(e - b - (a - c), `${coef(a - c)} = ${e - b} は 両辺を ${a - c} で わるよ(ひくのでは ない)`));
  return eqProblem({
    d,
    id: 'g1.eq.linear',
    eq,
    answer: x,
    hint: c === 0 ? '数の項を 右辺へ 移項しよう(移すと 符号が 変わる)。次に x の係数で わる' : 'x の項は 左辺へ、数の項は 右辺へ。移すときは 符号を 変える',
    explanation: steps,
    mistakes,
    tags: c === 0 ? ['eq_transpose'] : ['eq_both_sides'],
    key: `eql:${constFirst ? 'c' : ''}${a}x${b}=${c}x${e}`,
    verify: `((${e})-(${b}))/((${a})-(${c}))`,
  });
}

// ---------------------------------------------------------------- かっこ

/**
 * かっこを含む方程式(かっこトロル)。
 *   ★1: k(x + a) = c(k は 2〜5、解は 正の数)
 *   ★2: k(x + a) = mx + n(k は 負の数も。−2(x − 3) = 10 のように 書く)/ x + k(ax + b) = c(チャレンジテストの x + 3(2x − 5) = 6)
 *   ★3: かっこ 2 つ k(x + a) = m(x + b)/ ax − k(x + b) = c(かっこの前が ひき算)/ k(ax + b) = mx + n
 */
function genParen(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    const k = rng.int(2, 5);
    const a = rng.nonZero(6);
    let x = rng.int(1, 9);
    if (x + a === 0) x++;
    return parenProblem(d, { k, a: 1, b: a, outA: 0, outB: 0, m: 0, n: k * (x + a), x });
  }
  const x = rng.nonZero(9);
  const form = d === 2 ? rng.int(0, 1) : rng.int(2, 4);
  for (;;) {
    if (form === 0) {
      // k(x + a) = mx + n
      const k = rng.nonZero(5, 2);
      const a = rng.nonZero(6);
      const m = rng.nonZero(6);
      if (m === k) continue;
      const n = k * (x + a) - m * x;
      if (n === 0 || Math.abs(n) > 40) continue;
      return parenProblem(d, { k, a: 1, b: a, outA: 0, outB: 0, m, n, x });
    }
    if (form === 1) {
      // x + k(ax + b) = c
      const k = rng.int(2, 4);
      const a = rng.int(1, 3);
      const b = rng.nonZero(6);
      const c = x + k * (a * x + b);
      if (c === 0 || Math.abs(c) > 40) continue;
      return parenProblem(d, { k, a, b, outA: 1, outB: 0, m: 0, n: c, x });
    }
    if (form === 2) {
      // k(x + a) = m(x + b)
      const k = rng.nonZero(6, 2);
      const m = rng.nonZero(6, 2);
      if (k === m) continue;
      const a = rng.nonZero(6);
      // k(x + a) = m(x + b) → b = (k(x + a) − mx)/m
      const bNum = k * (x + a) - m * x;
      if (bNum % m !== 0) continue;
      const b = bNum / m;
      if (b === 0 || Math.abs(b) > 12 || b === a) continue;
      return parenProblem(d, { k, a: 1, b: a, outA: 0, outB: 0, m: 0, n: 0, x, right: { m, b } });
    }
    if (form === 3) {
      // ax − k(x + b) = c(かっこの前が ひき算)
      const outA = rng.int(1, 6);
      const k = -rng.int(2, 5);
      const b = rng.nonZero(6);
      if (outA + k === 0) continue;
      const c = outA * x + k * (x + b);
      if (c === 0 || Math.abs(c) > 40) continue;
      return parenProblem(d, { k, a: 1, b, outA, outB: 0, m: 0, n: c, x });
    }
    // k(ax + b) = mx + n
    const k = rng.nonZero(5, 2);
    const a = rng.int(2, 4);
    const b = rng.nonZero(6);
    const m = rng.nonZero(9);
    if (k * a === m) continue;
    const n = k * (a * x + b) - m * x;
    if (n === 0 || Math.abs(n) > 50) continue;
    return parenProblem(d, { k, a, b, outA: 0, outB: 0, m, n, x });
  }
}

interface ParenSpec {
  /** 左辺の かっこ k(ax + b) */
  k: number;
  a: number;
  b: number;
  /** 左辺の かっこの 前の 項 outA x + outB */
  outA: number;
  outB: number;
  /** 右辺 mx + n(right が あれば かっこの 式 m(x + b)) */
  m: number;
  n: number;
  x: number;
  right?: { m: number; b: number };
}

function parenProblem(d: Difficulty, s: ParenSpec): Problem {
  const { k, a, b, outA, x } = s;
  const inner = lin(a, b);
  // かっこの 前の 数: 先頭なら −2(…)、x の あとなら x − 2(…)
  const pk = (kk: number, body: string, first: boolean) => (first ? `${kk === -1 ? '-' : kk}(${body})` : `${kk < 0 ? ' - ' : ' + '}${Math.abs(kk)}(${body})`);
  const left = outA !== 0 ? `${coef(outA)}${pk(k, inner, false)}` : pk(k, inner, true);
  const right = s.right ? pk(s.right.m, lin(1, s.right.b), true) : lin(s.m, s.n);
  const eq = `${left} = ${right}`;
  // かっこを はずした 形: 左 Lx + Lc = 右 Rx + Rc
  const L = outA + k * a;
  const Lc = k * b;
  const R = s.right ? s.right.m : s.m;
  const Rc = s.right ? s.right.m * s.right.b : s.n;
  const expandedLeft = outA !== 0 ? `${coef(outA)}${signed(k * a, 'x')}${signed(Lc)}` : lin(k * a, Lc);
  const expandedRight = s.right ? lin(R, Rc) : right;
  const steps = [eq, `${expandedLeft} = ${expandedRight} \\quad ${text('(かっこを はずす)')}`];
  if (outA !== 0) steps.push(`${lin(L, Lc)} = ${expandedRight}`);
  steps.push(`${coef(L)}${R !== 0 ? moved(R, 'x') : ''} = ${Rc}${moved(Lc)} \\quad ${text('(移項)')}`);
  steps.push(`${coef(L - R)} = ${Rc - Lc}`);
  if (L - R !== 1) steps.push(`x = ${toTex(rat(Rc - Lc, L - R))}`);
  steps.push(answerLine(x));
  const mistakes: Mistake[] = [];
  // かっこの 後ろの 項に かけ忘れた(3(x + 2) → 3x + 2)
  if (L !== R) mistakes.push(mistakeNum(solve(L, b, R, s.right ? s.right.m * s.right.b : s.n), `かっこの 前の ${Math.abs(k)} は、かっこの 中の ${plainMinus(String(b))} にも かけるよ(分配法則)`));
  // かっこの 前が 負の数なのに、後ろの 項の 符号を 変えなかった(−2(x − 3) → −2x − 6)
  if (k < 0 && L !== R) mistakes.push(mistakeNum(solve(L, -Lc, R, Rc), `${k}(…) は かっこの 中の どの項にも ${k} を かける。${k} × (${plainMinus(String(b))}) = ${plainMinus(String(k * b))} だよ`));
  return eqProblem({
    d,
    id: 'g1.eq.paren',
    eq,
    answer: x,
    hint: 'まず かっこを はずそう(分配法則)。それから 移項',
    explanation: steps,
    mistakes,
    tags: s.right ? ['eq_paren', 'eq_paren_two'] : outA !== 0 || s.m !== 0 ? ['eq_paren_both'] : ['eq_paren'],
    key: `eqp:${eq}`,
    verify: `((${Rc})-(${Lc}))/((${L})-(${R}))`,
  });
}

// ---------------------------------------------------------------- 小数・分数

/**
 * 小数・分数の 係数(分数ゴースト)。
 *   ★1: 小数(0.4x + 1.2 = 2。片方の辺だけ x)/ x/p + a = b(分母を はらう)
 *   ★2: 小数で 両辺に x(0.5x + 2 = 0.3x + 1)/ x/p + a = x/q + b(解は ±24 まで)/ (a/p)x + b = c
 *   ★3: (x + a)/p = (x + b)/q / 小数第 2 位までの 係数(0.25x − 1 = 0.1x + 0.5)/ 分数の係数で 両辺に x
 */
function genFraction(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    if (rng.bool()) {
      const A = rng.int(2, 9);
      const B = rng.nonZero(19);
      const x = rng.int(1, 9);
      const C = A * x + B;
      return decimalProblem(d, A, B, 0, C, x, 10);
    }
    const p = rng.int(2, 5);
    const x = p * rng.int(1, Math.floor(12 / p));
    const a = rng.nonZero(9);
    return fracProblem(d, { p, q: 0, a, b: x / p + a, x, num: 1 });
  }
  if (d === 2) {
    const form = rng.int(0, 2);
    if (form === 0) {
      const x = rng.nonZero(9);
      let A: number, C: number, B: number, E: number;
      do {
        A = rng.int(2, 9);
        C = rng.int(1, 9);
        B = rng.nonZero(30);
        E = (A - C) * x + B;
      } while (A === C || E === 0 || Math.abs(E) > 60);
      return decimalProblem(d, A, B, C, E, x, 10);
    }
    if (form === 1) return fracBothSides(rng, d, 24);
    // (a/p)x + b = c
    let num: number, p: number;
    do {
      num = rng.int(2, 5);
      p = rng.int(2, 6);
    } while (gcd(num, p) !== 1);
    const x = p * rng.nonZero(Math.max(1, Math.floor(12 / p)));
    const b = rng.nonZero(9);
    return fracProblem(d, { p, q: 0, a: b, b: (num * x) / p + b, x, num });
  }
  const form = rng.pick([0, 0, 1, 2]);
  if (form === 0) {
    // (x + a)/p = (x + b)/q
    for (;;) {
      const p = rng.int(2, 6);
      const q = rng.int(2, 6);
      if (p === q) continue;
      const x = rng.nonZero(12);
      const a = rng.nonZero(9);
      // q(x + a) = p(x + b) → b = (q(x + a) − px)/p
      const bNum = q * (x + a) - p * x;
      if (bNum % p !== 0) continue;
      const b = bNum / p;
      if (b === 0 || b === a || Math.abs(b) > 12) continue;
      return fracParenProblem(d, p, q, a, b, x);
    }
  }
  if (form === 1) {
    // 小数第 2 位まで(100 分の 1 の 単位で 作る)
    const x = rng.nonZero(12);
    for (;;) {
      const A = rng.pick([5, 12, 15, 25, 35, 45, 75]);
      const C = rng.pick([1, 2, 3, 4, 5, 6, 8].map((t) => t * 10).filter((t) => t !== A));
      const B = rng.nonZero(15) * 10;
      const E = (A - C) * x + B;
      if (E === 0 || Math.abs(E) > 600 || E % 5 !== 0) continue;
      return decimalProblem(d, A, B, C, E, x, 100);
    }
  }
  return fracBothSides(rng, d, 36);
}

/** 小数の 係数: (A x + B) / s = (C x + E) / s(s = 10 か 100)。両辺を s 倍する */
function decimalProblem(d: Difficulty, A: number, B: number, C: number, E: number, x: number, s: number): Problem {
  const left = `${decCoef(A, s)}${decSigned(B, s)}`;
  const right = C === 0 ? dec(E, s) : `${decCoef(C, s)}${decSigned(E, s)}`;
  const eq = `${left} = ${right}`;
  const scaled = `${lin(A, B)} = ${lin(C, E)}`;
  const steps = [eq, `${scaled} \\quad ${text(`(両辺を ${s} 倍する)`)}`];
  steps.push(`${coef(A)}${C !== 0 ? moved(C, 'x') : ''} = ${E}${moved(B)} \\quad ${text('(移項)')}`);
  steps.push(`${coef(A - C)} = ${E - B}`);
  if (A - C !== 1) steps.push(`x = ${x}`);
  steps.push(answerLine(x));
  return eqProblem({
    d,
    id: 'g1.eq.fraction',
    eq,
    answer: x,
    hint: `両辺を ${s} 倍して 小数を 消そう(すべての 項に ${s} を かける)`,
    explanation: steps,
    // 左辺の 数の項に s を かけ忘れた: Ax + B/s = Cx + E
    mistakes: [mistakeNum(rat(s * E - B, s * (A - C)), `両辺を ${s} 倍するときは、数の項にも ${s} を かけるよ`)],
    tags: ['eq_decimal'],
    key: `eqd:${eq}`,
    verify: `((${E})-(${B}))/((${A})-(${C}))`,
  });
}

/** 分数の 係数: (num/p)x + a = (1/q)x + b(q = 0 なら 右辺は b だけ)。両辺に 分母の 最小公倍数を かける */
function fracProblem(d: Difficulty, s: { p: number; q: number; a: number; b: number; x: number; num: number }): Problem {
  const { p, q, a, b, x, num } = s;
  const L = q === 0 ? p : (p * q) / gcd(p, q);
  const xTerm = (n: number, den: number) => (n === 1 ? `\\frac{x}{${den}}` : `\\frac{${n}}{${den}}x`);
  const left = `${xTerm(num, p)}${signed(a)}`;
  const right = q === 0 ? String(b) : `${xTerm(1, q)}${signed(b)}`;
  const eq = `${left} = ${right}`;
  const lx = (num * L) / p;
  const rx = q === 0 ? 0 : L / q;
  const steps = [eq, `${lin(lx, L * a)} = ${lin(rx, L * b)} \\quad ${text(`(両辺に ${L} を かけて 分母を はらう)`)}`];
  steps.push(`${coef(lx)}${rx !== 0 ? moved(rx, 'x') : ''} = ${L * b}${moved(L * a)} \\quad ${text('(移項)')}`);
  steps.push(`${coef(lx - rx)} = ${L * (b - a)}`);
  if (lx - rx !== 1) steps.push(`x = ${x}`);
  steps.push(answerLine(x));
  return eqProblem({
    d,
    id: 'g1.eq.fraction',
    eq,
    answer: x,
    hint: q === 0 ? `両辺に ${L} を かけて 分母を はらおう` : `両辺に ${L}(分母 ${p} と ${q} の 最小公倍数)を かけて 分数を 消そう`,
    explanation: steps,
    // 分母を はらうとき 左辺の 数の項に かけ忘れた(x/3 + 2 = 5 → x + 2 = 15)
    mistakes: [mistakeNum(solve(lx, a, rx, L * b), `分母を はらうときは、数の項にも ${L} を かけるよ`)],
    tags: ['eq_fraction'],
    key: `eqf:${eq}`,
    verify: `((${b})-(${a}))/((${num})/${p}-${q === 0 ? 0 : `1/${q}`})`,
  });
}

/** x/p + a = x/q + b(解の 絶対値は max まで) */
function fracBothSides(rng: Rng, d: Difficulty, max: number): Problem {
  const p = rng.pick([2, 3, 4, 6]);
  const q = rng.pick([2, 3, 4, 6].filter((n) => n !== p));
  const L = (p * q) / gcd(p, q);
  const x = L * rng.nonZero(Math.max(1, Math.floor(max / L)));
  const a = rng.nonZero(6);
  const b = x / p + a - x / q;
  if (b === 0) return fracBothSides(rng, d, max);
  return fracProblem(d, { p, q, a, b, x, num: 1 });
}

/** (x + a)/p = (x + b)/q */
function fracParenProblem(d: Difficulty, p: number, q: number, a: number, b: number, x: number): Problem {
  const eq = `\\frac{${lin(1, a)}}{${p}} = \\frac{${lin(1, b)}}{${q}}`;
  const L = (p * q) / gcd(p, q);
  const lk = L / p;
  const rk = L / q;
  const steps = [
    eq,
    `${lk === 1 ? lin(1, a) : `${lk}(${lin(1, a)})`} = ${rk === 1 ? lin(1, b) : `${rk}(${lin(1, b)})`} \\quad ${text(`(両辺に ${L} を かける)`)}`,
    `${lin(lk, lk * a)} = ${lin(rk, rk * b)}`,
    `${coef(lk)}${moved(rk, 'x')} = ${rk * b}${moved(lk * a)}`,
    `${coef(lk - rk)} = ${rk * b - lk * a}`,
  ];
  if (lk - rk !== 1) steps.push(`x = ${x}`);
  steps.push(answerLine(x));
  return eqProblem({
    d,
    id: 'g1.eq.fraction',
    eq,
    answer: x,
    hint: `両辺に ${L} を かけよう。分子の 式は かっこに 入れたまま かける`,
    explanation: steps,
    // 分子の x だけに かけて、数の項に かけ忘れた
    mistakes: lk !== rk ? [mistakeNum(solve(lk, a, rk, b), `分子は ひとまとまり。${lk === 1 ? rk : lk}(${plainMinus(lin(1, lk === 1 ? b : a))}) のように、数の項にも かけるよ`)] : [],
    tags: ['eq_fraction', 'eq_fraction_paren'],
    key: `eqf2:${eq}`,
    verify: `(${p}*(${b})-${q}*(${a}))/(${q}-${p})`,
  });
}

// ---------------------------------------------------------------- 比例式

/**
 * 比例式(比のカニ)。数の大きさは 学習プリント(x : 8 = 3 : 4)とチャレンジテスト((x + 2) : 9 = 10 : 6、正答率 52%)に合わせる。
 *   ★1: a : b = ka : x(k は 2〜5)
 *   ★2: x の位置が 4 か所のどれか。a : b = c : x で c が a の倍数でないこともある(4 : 6 = 10 : x)
 *   ★3: 半分は (x ± m) : b = c : d
 */
function genRatio(rng: Rng, d: Difficulty): Problem {
  if (d === 3 && rng.bool()) {
    // (x + m) : b = c : d → (x + m) × d = b × c。整数の解になるまで 選び直す
    let x: number, m: number, b: number, c: number, dd: number;
    do {
      x = rng.int(1, 12);
      m = rng.nonZero(6);
      b = rng.int(2, 9);
      dd = rng.int(2, 9);
      c = ((x + m) * dd) / b;
    } while (x + m <= 0 || !Number.isInteger(c) || c < 2 || c > 30 || c === dd || b === dd);
    const lhs = `(${lin(1, m)}) : ${b}`;
    return {
      templateId: 'g1.eq.ratio',
      difficulty: d,
      prompt: `${lhs} = ${c} : ${dd} \\quad ${text('x を求めよ')}`,
      promptText: `${plainMinus(lhs)} = ${c} : ${dd} の x を求めよ`,
      answer: { kind: 'number', value: rat(x) },
      hint: 'かっこごと 1 つの数と 思って、外どうし・内どうしの 積を 等しく おく',
      explanation: [
        `(${lin(1, m)}) \\times ${dd} = ${b} \\times ${c} \\quad ${text('(外側の積 = 内側の積)')}`,
        `${lin(dd, m * dd)} = ${b * c}`,
        `${dd}x = ${b * c}${moved(m * dd)}`,
        `${dd}x = ${b * c - m * dd}`,
        `x = ${x}`,
        answerLine(x),
      ],
      // (x + m) × d の m に d を かけ忘れた
      mistakes: [mistakeNum(rat(b * c - m, dd), `(${plainMinus(lin(1, m))}) × ${dd} は、${plainMinus(String(m))} にも ${dd} を かけるよ`)],
      tags: ['eq_ratio', 'eq_ratio_expr'],
      key: `eqr3:${m}:${b}:${c}:${dd}`,
      verify: `(${b}*${c})/${dd}-(${m})`,
    };
  }
  // a : b = c : e の形で、4 つのうち 1 つを x にする。c : e は a : b の k 倍(★2 以上は k が分数のことも)
  const a = rng.int(2, 9);
  let b = rng.int(2, 9);
  while (b === a) b = rng.int(2, 9);
  const k = rng.int(2, d === 1 ? 5 : 6);
  let [c, e] = [a * k, b * k];
  // ★2 以上の半分は 4 : 6 = 10 : 15 のように 何倍かが 整数でない形(a と b に 公約数が あるときだけ作れる)
  const g = gcd(a, b);
  if (d > 1 && g > 1 && rng.bool()) {
    const ks = [2, 3, 4, 5, 6].filter((t) => t % g !== 0);
    const t = rng.pick(ks);
    [c, e] = [(a / g) * t, (b / g) * t];
  }
  const nums = [a, b, c, e];
  const hole = d === 1 ? 3 : rng.int(0, 3);
  const value = nums[hole];
  const show = nums.map((v, i) => (i === hole ? 'x' : String(v)));
  const prompt = `${show[0]} : ${show[1]} = ${show[2]} : ${show[3]}`;
  // 外項の積 = 内項の積。x の ある側を 左に 書く
  const outerHasX = hole === 0 || hole === 3;
  const xCoef = nums[3 - hole];
  const other = outerHasX ? b * c : a * e;
  const outer = `${show[0]} \\times ${show[3]}`;
  const inner = `${show[1]} \\times ${show[2]}`;
  // 外どうし・内どうしを まちがえて かけた(a × c = b × e)
  const wrongPair = [
    rat(b * e, c), // hole 0: x × c = b × e
    rat(a * c, e), // hole 1: a × c = x × e
    rat(b * e, a), // hole 2: a × x = b × e
    rat(a * c, b), // hole 3: a × c = b × x
  ][hole];
  return {
    templateId: 'g1.eq.ratio',
    difficulty: d,
    prompt: `${prompt} \\quad ${text('x を求めよ')}`,
    promptText: `${prompt} の x を求めよ`,
    answer: { kind: 'number', value: rat(value) },
    hint: '外側どうし、内側どうしの 積が 等しい。a : b = c : d なら ad = bc',
    explanation: [
      `${outerHasX ? outer : inner} = ${outerHasX ? inner : outer} \\quad ${text('(外側の積 = 内側の積)')}`,
      `${xCoef}x = ${other}`,
      `x = ${value}`,
      answerLine(value),
    ],
    mistakes: [mistakeNum(wrongPair, `かけるのは 外側どうし(${show[0]} と ${show[3]})と 内側どうし(${show[1]} と ${show[2]})だよ`)],
    tags: ['eq_ratio'],
    key: `eqr:${prompt}`,
    verify: hole === 0 ? `${b}*${c}/${e}` : hole === 1 ? `${a}*${e}/${c}` : hole === 2 ? `${a}*${e}/${b}` : `${b}*${c}/${a}`,
  };
}

// ---------------------------------------------------------------- 文章題(ボス)

interface WordCase {
  story: string;
  equation: string;
  wrong: string[];
  answer: number;
  unit: string;
  steps: string[];
  /** 検証用: 答えを使わずに求める JS 式 */
  verify: string;
}

/**
 * 文章題。教科書の「方程式の利用」の 順:
 *   ★1: ある数(x の 3 倍に 5 を たすと 26)/ 代金と おつり
 *   ★2: 2 品の 代金 / 過不足(配る)/ 代金と おつり
 *   ★3: 過不足 / 速さ(追いつく)/ 年れい(x 年後に 3 倍)
 * 解は どれも 整数(速さも 割りきれる 数を 選ぶ)
 */
function wordCase(rng: Rng, d: Difficulty): WordCase {
  const kind = d === 1 ? rng.pick(['number', 'change']) : d === 2 ? rng.pick(['two', 'share', 'change']) : rng.pick(['share', 'speed', 'age']);
  if (kind === 'number') {
    const a = rng.int(2, 6);
    let b = rng.int(2, 9);
    // a と b が 同じだと 選択肢が 重なる
    if (b === a) b++;
    const x = rng.int(2, 9);
    const c = a * x + b;
    return {
      story: `ある数 x を ${a} 倍して ${b} を たすと ${c} に なる`,
      equation: `${a}x + ${b} = ${c}`,
      wrong: [`${a}(x + ${b}) = ${c}`, `${b}x + ${a} = ${c}`, `x + ${a} + ${b} = ${c}`],
      answer: x,
      unit: '',
      verify: `(${c}-${b})/${a}`,
      steps: [`${a}x = ${c} - ${b} = ${c - b}`, `x = ${x}`],
    };
  }
  if (kind === 'change') {
    const price = rng.pick([80, 120, 150, 200]);
    const n = rng.int(3, 8);
    const paid = rng.pick([1000, 2000]);
    const change = paid - price * n;
    if (change <= 0) return wordCase(rng, d);
    return {
      story: `1 個 x 円の おかしを ${n} 個 買って ${paid} 円 出したら、おつりは ${change} 円だった`,
      equation: `${paid} - ${n}x = ${change}`,
      wrong: [`${n}x - ${paid} = ${change}`, `${paid} + ${n}x = ${change}`, `${n}x = ${change}`],
      answer: price,
      unit: '円',
      verify: `(${paid}-${change})/${n}`,
      steps: [`-${n}x = ${change} - ${paid}`, `${n}x = ${price * n}`, `x = ${price}`],
    };
  }
  if (kind === 'two') {
    const price = rng.pick([60, 80, 90, 110, 120, 150]);
    const n = rng.int(2, 6);
    const other = rng.pick([100, 120, 150, 180, 200]);
    const total = price * n + other;
    return {
      story: `1 本 x 円の ペンを ${n} 本と、${other} 円の ノートを 1 冊 買ったら、代金は ${total} 円だった`,
      equation: `${n}x + ${other} = ${total}`,
      wrong: [`${n}(x + ${other}) = ${total}`, `x + ${n} \\times ${other} = ${total}`, `${n}x = ${total} + ${other}`],
      answer: price,
      unit: '円',
      verify: `(${total}-${other})/${n}`,
      steps: [`${n}x = ${total} - ${other} = ${total - other}`, `x = ${price}`],
    };
  }
  if (kind === 'share') {
    // 過不足: per x + short = (per + 1) x − extra → x = short + extra
    const per = rng.int(3, 6);
    const short = rng.int(2, 9);
    let extra = rng.int(2, 9);
    // 余りと 不足が 同じだと 選択肢が 重なる
    if (extra === short) extra = short === 9 ? 2 : short + 1;
    const people = short + extra;
    return {
      story: `あめを 何人かに 配る。1 人に ${per} 個ずつ 配ると ${short} 個 余り、1 人に ${per + 1} 個ずつ 配ると ${extra} 個 足りない。人数を x 人 とする`,
      equation: `${per}x + ${short} = ${per + 1}x - ${extra}`,
      wrong: [`${per}x - ${short} = ${per + 1}x + ${extra}`, `${per}x + ${short} = ${per + 1}x + ${extra}`, `${per}x + ${extra} = ${per + 1}x - ${short}`],
      answer: people,
      unit: '人',
      verify: `${short}+${extra}`,
      steps: [`${per}x - ${per + 1}x = -${extra} - ${short}`, `-x = -${people}`, `x = ${people}`],
    };
  }
  if (kind === 'speed') {
    // 追いつく: 弟が 出て t 分後に 兄が 追いかける。v1(x + t) = v2 x → 割りきれる 数を 選ぶ
    for (;;) {
      const v1 = rng.pick([50, 60, 70, 80]);
      const t = rng.int(3, 10);
      const x = rng.int(2, 12);
      const v2 = (v1 * (x + t)) / x;
      if (!Number.isInteger(v2) || v2 % 10 !== 0 || v2 > 250) continue;
      return {
        story: `弟が 家を 出て 分速 ${v1} m で 歩いた。その ${t} 分後に 兄が 家を 出て、分速 ${v2} m で 同じ道を 追いかけた。兄が 家を 出てから 追いつくまでの 時間を x 分 とする`,
        equation: `${v1}(x + ${t}) = ${v2}x`,
        wrong: [`${v1}x = ${v2}(x + ${t})`, `${v1}(x - ${t}) = ${v2}x`, `${v1}x + ${t} = ${v2}x`],
        answer: x,
        unit: '分',
        verify: `(${v1}*${t})/(${v2}-${v1})`,
        steps: [`${v1}x + ${v1 * t} = ${v2}x`, `${v1}x - ${v2}x = -${v1 * t}`, `-${v2 - v1}x = -${v1 * t}`, `x = ${x}`],
      };
    }
  }
  // 年れい: 父 F 才、子 C 才。x 年後に 父の 年れいが 子の 3 倍 → F + x = 3(C + x)
  const C = rng.int(5, 12);
  const x = rng.int(1, 8);
  const F = 3 * C + 2 * x;
  return {
    story: `いま 父は ${F} 才、子は ${C} 才 です。父の 年れいが 子の 年れいの 3 倍に なるのは 何年後か。x 年後 とする`,
    equation: `${F} + x = 3(${C} + x)`,
    wrong: [`${F} + x = 3 \\times ${C} + x`, `${F} = 3(${C} + x)`, `3(${F} + x) = ${C} + x`],
    answer: x,
    unit: '年後',
    verify: `(${F}-3*${C})/2`,
    steps: [`${F} + x = ${3 * C} + 3x`, `x - 3x = ${3 * C} - ${F}`, `-2x = ${3 * C - F}`, `x = ${x}`],
  };
}

function genWord(rng: Rng, d: Difficulty): Problem {
  const c = wordCase(rng, d);
  // 第1段階: 式を選ぶ。第2段階は解説に書き、答えは x の値
  const options = rng.shuffle([c.equation, ...c.wrong.slice(0, 3)]);
  const correct = options.indexOf(c.equation);
  const asEquation = d === 1 || rng.bool();
  if (asEquation) {
    return {
      templateId: 'g1.eq.word',
      difficulty: d,
      prompt: `${text(`${c.story}。この場面を 表す 方程式は?`)}`,
      promptText: `${c.story}。この場面を 表す 方程式は?`,
      answer: { kind: 'choice', options, correct },
      hint: '「何と 何が 等しいか」を 先に 決めよう',
      explanation: [`${text('答え: ')} ${c.equation}`, ...c.steps],
      tags: ['word_equation'],
      key: `eqw:eq:${c.story}`,
      verify: String(correct),
    };
  }
  const unit = c.unit ? `(単位: ${c.unit})` : '';
  return {
    templateId: 'g1.eq.word',
    difficulty: d,
    prompt: `${text(`${c.story}。x を求めよ${unit}`)}`,
    promptText: `${c.story}。x を求めよ${unit}`,
    answer: { kind: 'number', value: rat(c.answer) },
    hint: `まず 方程式を 立てよう: ${plainMinus(c.equation.replace(/\\times/g, '×'))}`,
    explanation: [`${text('方程式: ')} ${c.equation}`, ...c.steps, `${text('答え: ')} ${c.answer} ${text(c.unit)}`],
    tags: ['word_solve'],
    key: `eqw:val:${c.story}`,
    verify: c.verify,
  };
}

// ---------------------------------------------------------------- 登録

registerTemplate({ id: 'g1.eq.basic', unit: UNIT, title: '基本の方程式', timeLimit: { 1: 35, 2: 45, 3: 55 }, generate: genBasic });
registerTemplate({ id: 'g1.eq.linear', unit: UNIT, title: '移項して解く', timeLimit: { 1: 45, 2: 55, 3: 70 }, generate: genLinear });
registerTemplate({ id: 'g1.eq.paren', unit: UNIT, title: 'かっこのある方程式', timeLimit: { 1: 50, 2: 65, 3: 80 }, generate: genParen });
registerTemplate({ id: 'g1.eq.fraction', unit: UNIT, title: '分数・小数の方程式', timeLimit: { 1: 60, 2: 70, 3: 90 }, generate: genFraction });
registerTemplate({ id: 'g1.eq.ratio', unit: UNIT, title: '比例式', timeLimit: { 1: 35, 2: 45, 3: 55 }, generate: genRatio });
registerTemplate({ id: 'g1.eq.word', unit: UNIT, title: '文章題', timeLimit: { 1: 70, 2: 85, 3: 100 }, generate: genWord });
