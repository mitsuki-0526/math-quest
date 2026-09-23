import { registerTemplate, type Difficulty, type Problem } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat, toTex, type Rational } from '@/math/rational';
import { paren, plainMinus, text } from '@/math/format';

/**
 * 第3章「方程式」のテンプレート(台本 03_unknown_cave.md の敵に対応)。
 *   g1.eq.basic    てんびんスライム  x+a=b, ax=b
 *   g1.eq.linear   移項ネズミ        ax+b=c, 両辺に x
 *   g1.eq.paren    かっこトロル      かっこを含む方程式
 *   g1.eq.fraction 分数ゴースト      分数・小数の係数
 *   g1.eq.ratio    比のカニ          比例式
 *   g1.eq.word     (ボス)            文章題(選択式で式 → 数値で解)
 * 答えはすべて「x の値」。分数になる場合も有理数として判定する。
 */
const UNIT = '方程式';

const coef = (c: number, v = 'x'): string => (c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`);
const signed = (c: number, v = ''): string => `${c < 0 ? ' - ' : ' + '}${v ? coef(Math.abs(c), v) : Math.abs(c)}`;
/** 「= の右側」へ移項したときの式を解説に書く */
const moveText = (from: number): string => `${text('両辺から ')} ${paren(from)} ${text(' を引く(移項)')}`;

// ---------------------------------------------------------------- 基本

function genBasic(rng: Rng, d: Difficulty): Problem {
  const x = d === 1 ? rng.int(2, 12) : rng.nonZero(12);
  if (d === 1 || rng.bool()) {
    // x + a = b
    const a = rng.nonZero(12);
    const b = x + a;
    const lhs = `x${signed(a)}`;
    return {
      templateId: 'g1.eq.basic',
      difficulty: d,
      prompt: `${lhs} = ${b} \\quad ${text('x を求めよ')}`,
      promptText: `${plainMinus(lhs)} = ${plainMinus(String(b))} の x を求めよ`,
      answer: { kind: 'number', value: rat(x) },
      hint: '天秤の 両側から 同じ数を 取ってみよう',
      explanation: [`${moveText(a)}`, `x = ${b} ${a < 0 ? '+' : '-'} ${Math.abs(a)} = ${x}`, `${text('答え: x = ')} ${x}`],
      tags: ['eq_add'],
      key: `eqb:x${a}=${b}`,
      verify: `${b}-(${a})`,
    };
  }
  // ax = b(割り切れる)
  const a = rng.nonZero(9, 2);
  const b = a * x;
  return {
    templateId: 'g1.eq.basic',
    difficulty: d,
    prompt: `${coef(a)} = ${b} \\quad ${text('x を求めよ')}`,
    promptText: `${plainMinus(coef(a))} = ${plainMinus(String(b))} の x を求めよ`,
    answer: { kind: 'number', value: rat(x) },
    hint: '両辺を 同じ数で 割ってみよう',
    explanation: [`${text('両辺を ')} ${paren(a)} ${text(' で割る')}`, `x = \\frac{${b}}{${a}} = ${x}`, `${text('答え: x = ')} ${x}`],
    tags: ['eq_mul'],
    key: `eqb:${a}x=${b}`,
    verify: `(${b})/(${a})`,
  };
}

// ---------------------------------------------------------------- ax+b=c / 両辺に x

function genLinear(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    const a = rng.nonZero(6, 2);
    const x = rng.nonZero(9);
    const b = rng.nonZero(12);
    const c = a * x + b;
    const lhs = `${coef(a)}${signed(b)}`;
    return {
      templateId: 'g1.eq.linear',
      difficulty: d,
      prompt: `${lhs} = ${c} \\quad ${text('x を求めよ')}`,
      promptText: `${plainMinus(lhs)} = ${plainMinus(String(c))} の x を求めよ`,
      answer: { kind: 'number', value: rat(x) },
      hint: 'まず 数の項を 右へ 移項(符号を 変えて)。次に x の係数で 割る',
      explanation: [`${moveText(b)}`, `${coef(a)} = ${c} ${b < 0 ? '+' : '-'} ${Math.abs(b)} = ${a * x}`, `x = \\frac{${a * x}}{${a}} = ${x}`, `${text('答え: x = ')} ${x}`],
      tags: ['eq_transpose'],
      key: `eql:${a}x${b}=${c}`,
      verify: `((${c})-(${b}))/(${a})`,
    };
  }
  // 両辺に x: ax+b = cx+e
  const x = d === 2 ? rng.nonZero(9) : rng.nonZero(12);
  let a = rng.nonZero(8);
  let c = rng.nonZero(8);
  while (a === c) c = rng.nonZero(8);
  const b = rng.nonZero(12);
  const e = (a - c) * x + b;
  const lhs = `${coef(a)}${signed(b)}`;
  const rhs = `${coef(c)}${signed(e)}`;
  return {
    templateId: 'g1.eq.linear',
    difficulty: d,
    prompt: `${lhs} = ${rhs} \\quad ${text('x を求めよ')}`,
    promptText: `${plainMinus(lhs)} = ${plainMinus(rhs)} の x を求めよ`,
    answer: { kind: 'number', value: rat(x) },
    hint: 'x の項は 左へ、数の項は 右へ。移すときは 符号を 変える',
    explanation: [
      `${text('x の項を 左へ、数を 右へ 移項')}`,
      `${coef(a)} ${c < 0 ? '+' : '-'} ${coef(Math.abs(c))} = ${e} ${b < 0 ? '+' : '-'} ${Math.abs(b)}`,
      `${coef(a - c)} = ${e - b} \\quad x = ${toTex(rat(e - b, a - c))}`,
      `${text('答え: x = ')} ${x}`,
    ],
    tags: ['eq_both_sides'],
    key: `eql2:${a}x${b}=${c}x${e}`,
    verify: `((${e})-(${b}))/((${a})-(${c}))`,
  };
}

// ---------------------------------------------------------------- かっこ

function genParen(rng: Rng, d: Difficulty): Problem {
  const x = rng.nonZero(9);
  const k = rng.nonZero(5, 2);
  const a = rng.nonZero(5);
  const b = rng.nonZero(9);
  if (d === 1) {
    // k(x + a) = c
    const c = k * (x + a);
    const lhs = `${paren(k)}(x${signed(a)})`;
    return {
      templateId: 'g1.eq.paren',
      difficulty: d,
      prompt: `${lhs} = ${c} \\quad ${text('x を求めよ')}`,
      promptText: `${plainMinus(lhs)} = ${plainMinus(String(c))} の x を求めよ`,
      answer: { kind: 'number', value: rat(x) },
      hint: 'まず かっこを はずす(分配法則)',
      explanation: [`${lhs} = ${coef(k)}${signed(k * a)}`, `${coef(k)} = ${c} ${k * a < 0 ? '+' : '-'} ${Math.abs(k * a)} = ${k * x}`, `${text('答え: x = ')} ${x}`],
      tags: ['eq_paren'],
      key: `eqp:${k}(x${a})=${c}`,
      verify: `(${c})/(${k})-(${a})`,
    };
  }
  // k(ax + b) = m x + n の形(両辺 x あり)
  const m = rng.nonZero(6);
  const lhsA = k * a;
  if (lhsA === m) return genParen(rng, d); // 係数が同じだと解けない
  const n = lhsA * x + k * b - m * x;
  const lhs = `${paren(k)}(${coef(a)}${signed(b)})`;
  const rhs = `${coef(m)}${signed(n)}`;
  return {
    templateId: 'g1.eq.paren',
    difficulty: d,
    prompt: `${lhs} = ${rhs} \\quad ${text('x を求めよ')}`,
    promptText: `${plainMinus(lhs)} = ${plainMinus(rhs)} の x を求めよ`,
    answer: { kind: 'number', value: rat(x) },
    hint: 'かっこを はずしてから、x の項を 左へ 集めよう',
    explanation: [
      `${lhs} = ${coef(lhsA)}${signed(k * b)}`,
      `${coef(lhsA)} ${m < 0 ? '+' : '-'} ${coef(Math.abs(m))} = ${n} ${k * b < 0 ? '+' : '-'} ${Math.abs(k * b)}`,
      `${coef(lhsA - m)} = ${n - k * b}`,
      `${text('答え: x = ')} ${x}`,
    ],
    tags: ['eq_paren_both'],
    key: `eqp2:${k}(${a}x${b})=${m}x${n}`,
    verify: `((${n})-(${k})*(${b}))/((${k})*(${a})-(${m}))`,
  };
}

// ---------------------------------------------------------------- 分数・小数

function genFraction(rng: Rng, d: Difficulty): Problem {
  const x = rng.nonZero(9);
  if (d === 3 && rng.bool()) {
    // 小数係数: 0.a x + 0.b = c
    const a10 = rng.int(2, 9);
    const b10 = rng.nonZero(9);
    const c = (a10 * x + b10) / 10;
    const lhs = `0.${a10}x ${b10 < 0 ? '-' : '+'} 0.${Math.abs(b10)}`;
    return {
      templateId: 'g1.eq.fraction',
      difficulty: d,
      prompt: `${lhs} = ${c} \\quad ${text('x を求めよ')}`,
      promptText: `${plainMinus(lhs)} = ${plainMinus(String(c))} の x を求めよ`,
      answer: { kind: 'number', value: rat(x) },
      hint: '両辺を 10倍して 小数を 消そう',
      explanation: [`${text('両辺を 10倍: ')} ${coef(a10)}${signed(b10)} = ${c * 10}`, `${coef(a10)} = ${a10 * x}`, `${text('答え: x = ')} ${x}`],
      tags: ['eq_decimal'],
      key: `eqf:0.${a10}x${b10}=${c}`,
      verify: `((${c})*10-(${b10}))/(${a10})`,
    };
  }
  // 分数係数: x/p + a = x/q + b の簡単な形 → 分母をはらう
  const p = rng.pick([2, 3, 4, 6]);
  const q = rng.pick([2, 3, 4, 6].filter((n) => n !== p));
  const lcm = (p * q) / gcd(p, q);
  const xx = lcm * rng.nonZero(3); // 通分して整数解になるように
  const a = rng.nonZero(6);
  const rhsConst = xx / p + a - xx / q;
  const lhs = `\\frac{x}{${p}}${signed(a)}`;
  const rhs = `\\frac{x}{${q}}${signed(rhsConst)}`;
  return {
    templateId: 'g1.eq.fraction',
    difficulty: d,
    prompt: `${lhs} = ${rhs} \\quad ${text('x を求めよ')}`,
    promptText: `x/${p} ${a < 0 ? '-' : '+'} ${Math.abs(a)} = x/${q} ${rhsConst < 0 ? '-' : '+'} ${Math.abs(rhsConst)} の x を求めよ`,
    answer: { kind: 'number', value: rat(xx) },
    hint: `両辺に ${lcm}(分母の 最小公倍数)を かけて 分数を 消そう`,
    explanation: [
      `${text(`両辺に ${lcm} をかける`)}`,
      `${coef(lcm / p)}${signed(lcm * a)} = ${coef(lcm / q)}${signed(lcm * rhsConst)}`,
      `${coef(lcm / p - lcm / q)} = ${lcm * rhsConst - lcm * a}`,
      `${text('答え: x = ')} ${xx}`,
    ],
    tags: ['eq_fraction'],
    key: `eqf2:${p}:${q}:${xx}:${a}`,
    verify: `((${rhsConst})-(${a}))/(1/${p}-1/${q})`,
  };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// ---------------------------------------------------------------- 比例式

function genRatio(rng: Rng, d: Difficulty): Problem {
  const k = rng.int(2, d === 1 ? 6 : 12);
  const a = rng.int(2, 9);
  const b = rng.int(2, 9);
  // a : b = ka : x  → x = kb
  const x = k * b;
  const left = `${a} : ${b}`;
  const right = `${k * a} : x`;
  const flip = d === 3 && rng.bool();
  const prompt = flip ? `x : ${k * b} = ${a} : ${b}` : `${left} = ${right}`;
  const value = flip ? k * a : x;
  return {
    templateId: 'g1.eq.ratio',
    difficulty: d,
    prompt: `${prompt} \\quad ${text('x を求めよ')}`,
    promptText: `${prompt} の x を求めよ`,
    answer: { kind: 'number', value: rat(value) },
    hint: '外どうし、内どうしの 積が 等しい。a : b = c : d なら a×d = b×c',
    explanation: flip
      ? [`x \\times ${b} = ${k * b} \\times ${a}`, `${b}x = ${k * b * a}`, `${text('答え: x = ')} ${value}`]
      : [`${a} \\times x = ${b} \\times ${k * a}`, `${a}x = ${b * k * a}`, `${text('答え: x = ')} ${value}`],
    tags: ['eq_ratio'],
    key: `eqr:${a}:${b}:${k}:${flip}`,
    verify: flip ? `${k}*${a}` : `${k}*${b}`,
  };
}

// ---------------------------------------------------------------- 文章題(ボス)

interface WordCase {
  story: string;
  equation: string;
  wrong: string[];
  answer: Rational;
  unit: string;
  steps: string[];
  /** 検証用: 答えを使わずに求める JS 式 */
  verify: string;
}

function wordCase(rng: Rng, d: Difficulty): WordCase {
  const price = rng.pick([80, 120, 150, 200]);
  const n = rng.int(3, 8);
  const paid = rng.pick([1000, 2000]);
  const kind = rng.int(0, d === 1 ? 1 : 2);
  if (kind === 0) {
    // 代金とおつり
    const change = paid - price * n;
    if (change <= 0) return wordCase(rng, d);
    return {
      story: `1個 x 円の おかしを ${n} 個 買って ${paid} 円 出したら、おつりは ${change} 円だった`,
      equation: `${paid} - ${n}x = ${change}`,
      wrong: [`${n}x - ${paid} = ${change}`, `${paid} + ${n}x = ${change}`, `${n}x = ${change}`],
      answer: rat(price),
      unit: '円',
      verify: `(${paid}-${change})/${n}`,
      steps: [`${n}x = ${paid} - ${change} = ${price * n}`, `x = ${price}`],
    };
  }
  if (kind === 1) {
    // 過不足
    const per = rng.int(3, 6);
    const short = rng.int(2, 9);
    const extra = rng.int(2, 9);
    // per*x + short = (per+1)*x - extra → x = short + extra
    const people = short + extra;
    return {
      story: `あめを 何人かに 配る。1人に ${per} 個ずつ 配ると ${short} 個 余り、1人に ${per + 1} 個ずつ 配ると ${extra} 個 足りない。人数を x とする`,
      equation: `${per}x + ${short} = ${per + 1}x - ${extra}`,
      wrong: [`${per}x - ${short} = ${per + 1}x + ${extra}`, `${per}x + ${short} = ${per + 1}x + ${extra}`, `${per}x = ${per + 1}x`],
      answer: rat(people),
      unit: '人',
      verify: `${short}+${extra}`,
      steps: [`${per}x + ${short} = ${per + 1}x - ${extra}`, `${short} + ${extra} = ${per + 1}x - ${per}x = x`, `x = ${people}`],
    };
  }
  // 速さ(道のりが等しい)
  const v1 = rng.pick([40, 50, 60]);
  const v2 = v1 + rng.pick([10, 20, 30]);
  const diffMin = rng.int(2, 6);
  // v1 * x = v2 * (x - diff) → (v2 - v1) x = v2 * diff。解は分数になりうるので丸めずに有理数で持つ
  const x = rat(v2 * diffMin, v2 - v1);
  return {
    story: `家から 駅まで、分速 ${v1} m で 歩くと、分速 ${v2} m で 歩くより ${diffMin} 分 多く かかる。分速 ${v1} m で かかる時間を x 分とする`,
    equation: `${v1}x = ${v2}(x - ${diffMin})`,
    wrong: [`${v1}x = ${v2}(x + ${diffMin})`, `${v1}(x - ${diffMin}) = ${v2}x`, `${v1}x + ${diffMin} = ${v2}x`],
    answer: x,
    unit: '分',
    verify: `(${v2}*${diffMin})/(${v2}-${v1})`,
    steps: [`${v1}x = ${v2}x - ${v2 * diffMin}`, `${v2 - v1}x = ${v2 * diffMin}`, `x = ${toTex(x)}`],
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
      hint: '「何が 等しいか」を 先に 決めよう',
      explanation: [`${text('答え: ')} ${c.equation}`, ...c.steps.map((s) => s)],
      tags: ['word_equation'],
      key: `eqw:eq:${c.story}`,
      verify: String(correct),
    };
  }
  return {
    templateId: 'g1.eq.word',
    difficulty: d,
    prompt: `${text(`${c.story}。x を求めよ(単位: ${c.unit})`)}`,
    promptText: `${c.story}。x を求めよ(単位: ${c.unit})`,
    answer: { kind: 'number', value: c.answer },
    hint: `まず 方程式を 立てよう: ${c.equation}`,
    explanation: [`${text('方程式: ')} ${c.equation}`, ...c.steps, `${text('答え: ')} ${toTex(c.answer)} ${text(c.unit)}`],
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
