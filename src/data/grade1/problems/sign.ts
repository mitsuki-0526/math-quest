import { registerTemplate, type Difficulty, type Problem, type ProblemTemplate } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat, add, sub, mul, div, pow, neg, toTex, toNumber } from '@/math/rational';
import { paren, plainMinus, text } from '@/math/format';
import { primeFactors, factorsToTex } from '@/math/factorization';

/**
 * 第1章「正の数と負の数」のテンプレート(台本 01_sign_forest.md の敵に対応)。
 *   g1.sign.addsub      マイナススライム   加減
 *   g1.sign.addsub_big  符号王ネガ         大きな数の加減(ボス専用)
 *   g1.sign.muldiv      プラマイコウモリ   乗除
 *   g1.sign.abs         ゼッタイチ・ゴーレム 絶対値・大小
 *   g1.sign.mixed       クロスバッタ       四則混合・累乗
 *   g1.sign.primefactor 素数バチ           素因数分解
 */

const UNIT = '正の数と負の数';

// ---------------------------------------------------------------- 加減

/**
 * 加減の数の選び方。雑魚(マイナススライム)は符号の練習が目的なので、★が上がっても項の数と式の形で難しくし、
 * 2 けたの数は 1 問に 1 つまでにする(試遊で「★3 が 2 けただらけで難しすぎる」と先生の指摘)。
 * 2 けたの数ばかりの計算は、ボス(符号王ネガ)専用の addsub_big で出す
 */
function addSubTerms(rng: Rng, d: Difficulty, big: boolean): number[] {
  if (big) return Array.from({ length: d === 1 ? 3 : rng.pick([3, 4]) }, () => rng.nonZero(50));
  // ★1 は 習いたてでも 解けるように 1 けただけ(10 も 出さない)
  if (d === 1) return [rng.nonZero(9), rng.nonZero(9)];
  const terms = Array.from({ length: d === 2 ? 3 : rng.pick([3, 4]) }, () => rng.nonZero(9));
  terms[rng.int(0, terms.length - 1)] = rng.nonZero(d === 2 ? 15 : 20);
  return terms;
}

/**
 * 小数・分数の加減(★3 の 5 回に 1 回)。学習プリントに (+1.3) − (−2.8)、(+1/4) + (−2/3) の形がある(docs/difficulty.md)。
 * 小数は 小数第 1 位まで・5 以下、分数は 分母 2・3・4・6 の 真分数
 */
function genAddSubFraction(rng: Rng, d: Difficulty): Problem {
  const decimal = rng.bool();
  const nums = decimal
    ? [rat(rng.nonZero(50), 10), rat(rng.nonZero(50), 10)]
    : [0, 1].map(() => {
        const den = rng.pick([2, 3, 4, 6]);
        let num = rng.int(1, den - 1);
        while (Number(gcdOf(num, den)) !== 1) num = rng.int(1, den - 1);
        return rat(rng.bool() ? num : -num, den);
      });
  const op = rng.pick(['+', '-'] as const);
  const value = op === '+' ? add(nums[0], nums[1]) : sub(nums[0], nums[1]);
  const show = (r: (typeof nums)[number]) => {
    const t = decimal ? String(toNumber(r)) : toTex(r);
    return toNumber(r) < 0 ? `\\left(${t}\\right)` : `\\left(+${t}\\right)`;
  };
  const plain = (r: (typeof nums)[number]) => {
    const t = decimal ? String(toNumber(r)) : `${r.n}/${r.d}`;
    return toNumber(r) < 0 ? `(${plainMinus(t)})` : `(+${t})`;
  };
  const tex = `${show(nums[0])} ${op} ${show(nums[1])}`;
  const signed = op === '+' ? nums[1] : neg(nums[1]);
  return {
    templateId: 'g1.sign.addsub',
    difficulty: d,
    prompt: `${tex} = ?`,
    promptText: `${plain(nums[0])} ${op === '+' ? '+' : '−'} ${plain(nums[1])} = ?`,
    answer: { kind: 'number', value },
    hint: decimal ? '小数でも 整数と 同じ。符号を 決めてから 絶対値を 計算' : '分数は 通分してから。符号の 決め方は 整数と 同じ',
    explanation: [
      `${text('ひき算は 符号を 変えて たし算に: ')} ${show(nums[0])} + ${show(signed)}`,
      `${text('答え: ')} ${decimal ? String(toNumber(value)) : toTex(value)}`,
    ],
    tags: [decimal ? 'decimal_addsub' : 'fraction_addsub'],
    key: `addsub:frac:${tex}`,
    verify: `(${toNumber(nums[0])})${op}(${toNumber(nums[1])})`,
  };
}

function gcdOf(a: number, b: number): number {
  return b === 0 ? a : gcdOf(b, a % b);
}

function genAddSub(rng: Rng, d: Difficulty, big = false): Problem {
  if (!big && d === 3 && rng.int(0, 4) === 0) return genAddSubFraction(rng, d);
  const terms = addSubTerms(rng, d, big);
  const ops: ('+' | '-')[] = terms.slice(1).map(() => rng.pick(['+', '-']));
  // 必ず負の数を含める(正の数だけでは符号の練習にならないため)
  if (terms.every((t) => t > 0)) terms[rng.int(0, terms.length - 1)] *= -1;

  // ★3(ボスは ★2 から)の半分は「項だけの式」(-3 + 7 - 5)で出す
  const termForm = (d === 3 || (big && d >= 2)) && rng.bool();
  let tex: string;
  let plain: string;
  if (termForm) {
    // 項の形: 各項に符号を持たせ、演算子は + / − だけに畳む
    const signed = terms.map((t, i) => (i === 0 ? t : ops[i - 1] === '+' ? t : -t));
    tex = signed.map((t, i) => (i === 0 ? `${t}` : t < 0 ? ` - ${-t}` : ` + ${t}`)).join('');
    plain = plainMinus(tex);
  } else {
    tex = terms.map((t, i) => (i === 0 ? paren(t) : ` ${ops[i - 1]} ${paren(t)}`)).join('');
    plain = plainMinus(tex.replace(/\s/g, ' '));
  }

  let value = rat(terms[0]);
  for (let i = 1; i < terms.length; i++) value = ops[i - 1] === '+' ? add(value, rat(terms[i])) : sub(value, rat(terms[i]));

  // 解説: 項に直す → 正の項・負の項をまとめる → 計算
  const signedTerms = terms.map((t, i) => (i === 0 ? t : ops[i - 1] === '+' ? t : -t));
  const pos = signedTerms.filter((t) => t > 0);
  const negs = signedTerms.filter((t) => t < 0);
  const explanation: string[] = [];
  if (!termForm) explanation.push(`${text('項に直す: ')} ${signedTerms.map((t, i) => (i === 0 ? `${t}` : t < 0 ? ` - ${-t}` : ` + ${t}`)).join('')}`);
  if (pos.length && negs.length && signedTerms.length > 2) {
    explanation.push(`${text('正の項: ')} ${pos.join(' + ')} = ${pos.reduce((a, b) => a + b, 0)} \\quad ${text('負の項: ')} ${negs.map((n) => `(${n})`).join(' + ')} = ${negs.reduce((a, b) => a + b, 0)}`);
  }
  explanation.push(`${text('答え: ')} ${toTex(value)}`);

  const tags: string[] = [];
  if (ops.includes('-') && terms.slice(1).some((t, i) => t < 0 && ops[i] === '-')) tags.push('minus_minus');
  if (signedTerms.filter((t) => t < 0).length >= 2) tags.push('neg_plus_neg');

  const verifyExpr = terms.map((t, i) => (i === 0 ? `(${t})` : ` ${ops[i - 1]} (${t})`)).join('');
  return {
    templateId: big ? 'g1.sign.addsub_big' : 'g1.sign.addsub',
    difficulty: d,
    prompt: `${tex} = ?`,
    promptText: `${plain} = ?`,
    answer: { kind: 'number', value },
    hint: termForm ? '正の項どうし、負の項どうしを 先に まとめてみよう' : 'まず かっこを はずして、項だけの式に してみよう。−(−3) は +3',
    explanation,
    tags,
    key: `${big ? 'addsub_big' : 'addsub'}:${tex}`,
    verify: verifyExpr,
  };
}

// ---------------------------------------------------------------- 乗除

function genMulDiv(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    // 2数の積。必ず負の数を含める
    let a = rng.nonZero(9);
    let b = rng.nonZero(9);
    if (a > 0 && b > 0) (rng.bool() ? (a *= -1) : (b *= -1));
    const value = rat(a * b);
    return {
      templateId: 'g1.sign.muldiv',
      difficulty: d,
      prompt: `${paren(a)} \\times ${paren(b)} = ?`,
      promptText: plainMinus(`${paren(a)} × ${paren(b)} = ?`),
      answer: { kind: 'number', value },
      hint: '先に 符号を 決めよう。負の数が 1つなら −、2つなら +',
      explanation: [
        `${text('符号: 負の数が ')}${[a, b].filter((x) => x < 0).length}${text(' 個 → ')}${a * b < 0 ? '-' : '+'}`,
        `${text('絶対値の積: ')} ${Math.abs(a)} \\times ${Math.abs(b)} = ${Math.abs(a * b)}`,
        `${text('答え: ')} ${toTex(value)}`,
      ],
      tags: a < 0 && b < 0 ? ['neg_times_neg'] : ['sign_of_product'],
      key: `muldiv:${a}*${b}`,
      verify: `(${a})*(${b})`,
    };
  }
  if (d === 2) {
    // 割り切れる除算、または 3数の積
    if (rng.bool()) {
      // 教科書・学習プリントの割り算は わられる数が 48 程度まで(docs/difficulty.md)
      const b = rng.nonZero(9, 2);
      const q = rng.nonZero(9);
      const a = b * q;
      const value = rat(q);
      return {
        templateId: 'g1.sign.muldiv',
        difficulty: d,
        prompt: `${paren(a)} \\div ${paren(b)} = ?`,
        promptText: plainMinus(`${paren(a)} ÷ ${paren(b)} = ?`),
        answer: { kind: 'number', value },
        hint: 'わり算も 符号を 先に。負の数が 奇数個なら −',
        explanation: [
          `${text('符号: ')}${[a, b].filter((x) => x < 0).length}${text(' 個の負の数 → ')}${q < 0 ? '-' : '+'}`,
          `${Math.abs(a)} \\div ${Math.abs(b)} = ${Math.abs(q)}`,
          `${text('答え: ')} ${toTex(value)}`,
        ],
        tags: ['sign_of_quotient'],
        key: `muldiv:${a}/${b}`,
        verify: `(${a})/(${b})`,
      };
    }
    const ns = [rng.nonZero(6), rng.nonZero(6), rng.nonZero(6)];
    if (ns.filter((x) => x < 0).length === 0) ns[rng.int(0, 2)] *= -1;
    const prod = ns[0] * ns[1] * ns[2];
    return {
      templateId: 'g1.sign.muldiv',
      difficulty: d,
      prompt: `${ns.map(paren).join(' \\times ')} = ?`,
      promptText: plainMinus(`${ns.map(paren).join(' × ')} = ?`),
      answer: { kind: 'number', value: rat(prod) },
      hint: '負の数の個数を 数えよう。奇数個なら −、偶数個なら +',
      explanation: [
        `${text('負の数が ')}${ns.filter((x) => x < 0).length}${text(' 個 → 符号は ')}${prod < 0 ? '-' : '+'}`,
        `${ns.map((x) => Math.abs(x)).join(' \\times ')} = ${Math.abs(prod)}`,
        `${text('答え: ')} ${prod}`,
      ],
      tags: ['count_negatives'],
      key: `muldiv:${ns.join('*')}`,
      verify: ns.map((x) => `(${x})`).join('*'),
    };
  }
  // ★3 の 4 回に 1 回は 分数の乗除(学習プリントの 3/4 × (−5/6) ÷ 15/4 の形)
  if (rng.int(0, 3) === 0) return genMulDivFraction(rng, d);
  // ★3: 答えが整数になる ×÷ の混合(例: (−24) ÷ (−8) × 3)、または 1けたの 4数の積(docs/difficulty.md)
  const form = rng.int(0, 2);
  if (form === 2) {
    let ns: number[];
    do {
      ns = [rng.nonZero(6), rng.nonZero(6), rng.nonZero(6), rng.nonZero(6)];
      if (ns.every((x) => x > 0)) ns[rng.int(0, 3)] *= -1;
    } while (Math.abs(ns.reduce((p, x) => p * x, 1)) > 360);
    const prod = ns.reduce((p, x) => p * x, 1);
    return {
      templateId: 'g1.sign.muldiv',
      difficulty: d,
      prompt: `${ns.map(paren).join(' \\times ')} = ?`,
      promptText: plainMinus(`${ns.map(paren).join(' × ')} = ?`),
      answer: { kind: 'number', value: rat(prod) },
      hint: '負の数の個数を 数えて 符号を 先に。あとは 絶対値を かけていく',
      explanation: [
        `${text('負の数が ')}${ns.filter((x) => x < 0).length}${text(' 個 → 符号は ')}${prod < 0 ? '-' : '+'}`,
        `${ns.map((x) => Math.abs(x)).join(' \\times ')} = ${Math.abs(prod)}`,
        `${text('答え: ')} ${prod}`,
      ],
      tags: ['count_negatives'],
      key: `muldiv:${ns.join('*')}`,
      verify: ns.map((x) => `(${x})`).join('*'),
    };
  }
  // form 0: a ÷ b × c / form 1: a × b ÷ c。どちらも わり切れるように作る
  const divFirst = form === 0;
  const divisor = rng.nonZero(9, 2);
  const k = rng.nonZero(6);
  const other = rng.nonZero(9);
  const a = divisor * k;
  const nums = divFirst ? [a, divisor, other] : [a, other, divisor];
  const ops = divFirst ? ['\\div', '\\times'] : ['\\times', '\\div'];
  const value = rat(k * other);
  const tex = `${paren(nums[0])} ${ops[0]} ${paren(nums[1])} ${ops[1]} ${paren(nums[2])}`;
  const mid = divFirst ? k : a * other;
  return {
    templateId: 'g1.sign.muldiv',
    difficulty: d,
    prompt: `${tex} = ?`,
    promptText: plainMinus(tex.replace(/\\times/g, '×').replace(/\\div/g, '÷')) + ' = ?',
    answer: { kind: 'number', value },
    hint: '符号を 先に 決めよう。あとは 左から 順に 計算する',
    explanation: [
      `${text('負の数が ')}${nums.filter((x) => x < 0).length}${text(' 個 → 符号は ')}${toNumber(value) < 0 ? '-' : '+'}`,
      `${paren(nums[0])} ${ops[0]} ${paren(nums[1])} = ${mid}`,
      `${paren(mid)} ${ops[1]} ${paren(nums[2])} = ${toTex(value)}`,
      `${text('答え: ')} ${toTex(value)}`,
    ],
    tags: ['count_negatives'],
    key: `muldiv:${tex}`,
    verify: divFirst ? `(${a})/(${divisor})*(${other})` : `(${a})*(${other})/(${divisor})`,
  };
}

/**
 * 分数の乗除。2 つ または 3 つの分数(分母 2〜9)。答えは 約分して 分子・分母とも 20 以下になるものだけ出す
 * (約分の練習にはなるが、大きな数の計算にはしない)
 */
function genMulDivFraction(rng: Rng, d: Difficulty): Problem {
  const frac = () => {
    const den = rng.int(2, 9);
    let num = rng.int(1, 9);
    while (gcdOf(num, den) !== 1 || num === den) num = rng.int(1, 9);
    return rat(rng.bool() ? num : -num, den);
  };
  let fs: ReturnType<typeof rat>[];
  let ops: ('×' | '÷')[];
  let value: ReturnType<typeof rat>;
  do {
    const three = rng.bool();
    fs = three ? [frac(), frac(), frac()] : [frac(), frac()];
    if (fs.every((f) => toNumber(f) > 0)) {
      const i = rng.int(0, fs.length - 1);
      fs[i] = neg(fs[i]);
    }
    ops = fs.slice(1).map(() => rng.pick(['×', '÷'] as const));
    value = fs[0];
    for (let i = 1; i < fs.length; i++) value = ops[i - 1] === '×' ? mul(value, fs[i]) : div(value, fs[i]);
  } while (Math.abs(Number(value.n)) > 20 || Number(value.d) > 20 || (fs.length === 3 && Number(value.d) === 1 && Math.abs(Number(value.n)) === 1));
  const TEX = { '×': '\\times', '÷': '\\div' } as const;
  // 負の分数は かっこつき
  const fTex = (f: ReturnType<typeof rat>) => (toNumber(f) < 0 ? `\\left(${toTex(f)}\\right)` : toTex(f));
  const fPlain = (f: ReturnType<typeof rat>) => (toNumber(f) < 0 ? `(${plainMinus(`${f.n}/${f.d}`)})` : `${f.n}/${f.d}`);
  const tex = fs.map((f, i) => (i === 0 ? fTex(f) : ` ${TEX[ops[i - 1]]} ${fTex(f)}`)).join('');
  const plain = fs.map((f, i) => (i === 0 ? fPlain(f) : ` ${ops[i - 1]} ${fPlain(f)}`)).join('');
  // ÷ を 逆数の × に 直した式(解説用)
  const asMul = fs.map((f, i) => (i === 0 ? fTex(f) : ` \\times ${fTex(ops[i - 1] === '÷' ? div(rat(1), f) : f)}`)).join('');
  const negatives = fs.filter((f) => toNumber(f) < 0).length;
  return {
    templateId: 'g1.sign.muldiv',
    difficulty: d,
    prompt: `${tex} = ?`,
    promptText: `${plain} = ?`,
    answer: { kind: 'number', value },
    hint: '÷ は 逆数の × に 直す。符号を 先に 決めて、かける前に 約分',
    explanation: [
      ...(ops.includes('÷') ? [`${text('÷ を 逆数の × に: ')} ${asMul}`] : []),
      `${text('負の数が ')}${negatives}${text(' 個 → 符号は ')}${toNumber(value) < 0 ? '-' : '+'}`,
      `${text('答え: ')} ${toTex(value)}`,
    ],
    tags: ['fraction_muldiv'],
    key: `muldiv:frac:${plain}`,
    verify: fs.map((f, i) => `${i === 0 ? '' : ops[i - 1] === '×' ? '*' : '/'}(${Number(f.n)}/${Number(f.d)})`).join(''),
  };
}

// ---------------------------------------------------------------- 絶対値・大小

function genAbs(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    const n = rng.nonZero(20);
    return {
      templateId: 'g1.sign.abs',
      difficulty: d,
      prompt: `|${n}| = ?`,
      promptText: plainMinus(`|${n}| = ?`),
      answer: { kind: 'number', value: rat(Math.abs(n)) },
      hint: '絶対値は 0 からの 距離。符号を とった 数だよ',
      explanation: [`${text(`${plainMinus(String(n))} は 0 から ${Math.abs(n)} はなれている`)}`, `${text('答え: ')} ${Math.abs(n)}`],
      tags: ['abs_value'],
      key: `abs:${n}`,
      verify: `Math.abs(${n})`,
    };
  }
  if (d === 2) {
    // 4つの数から 最も小さい/大きい 数を選ぶ(選択式)
    const nums = new Set<number>();
    while (nums.size < 4) nums.add(rng.pick([rng.nonZero(15), rat2num(rng)]));
    const options = rng.shuffle([...nums]);
    const wantMin = rng.bool();
    const target = wantMin ? Math.min(...options) : Math.max(...options);
    const correct = options.indexOf(target);
    const optTex = options.map((o) => plainMinus(String(o)));
    return {
      templateId: 'g1.sign.abs',
      difficulty: d,
      prompt: `${text(`次のうち、最も${wantMin ? '小さい' : '大きい'}数は?`)}`,
      promptText: `次のうち、最も${wantMin ? '小さい' : '大きい'}数は?`,
      answer: { kind: 'choice', options: optTex, correct },
      hint: '数直線を 思い浮かべて。負の数は 絶対値が 大きいほど 小さい',
      explanation: [
        `${text('小さい順に並べると: ')} ${[...options].sort((a, b) => a - b).map((o) => plainMinus(String(o))).join(' < ')}`,
        `${text('答え: ')} ${plainMinus(String(target))}`,
      ],
      tags: ['compare_negative'],
      key: `abs:cmp:${options.join(',')}:${wantMin}`,
      // 選択式は「正解の番号」を照合する。選択肢の配列から独立に求める
      verify: `[${options.join(',')}].indexOf(Math.${wantMin ? 'min' : 'max'}(${options.join(',')}))`,
    };
  }
  // ★3: 絶対値が a の数を すべて / 絶対値が a より小さい整数を すべて / ある範囲の整数の個数
  const form = rng.int(0, 2);
  if (form === 1) {
    const a = rng.int(2, 4);
    const list = Array.from({ length: 2 * a - 1 }, (_, i) => i - (a - 1));
    return {
      templateId: 'g1.sign.abs',
      difficulty: d,
      prompt: `${text(`絶対値が ${a} より小さい 整数を すべて答えよ`)}`,
      promptText: `絶対値が ${a} より小さい 整数を すべて答えよ(「,」で区切る)`,
      answer: { kind: 'numbers', values: list.map((k) => rat(k)) },
      hint: '数直線で 0 から 左右に 同じだけ。0 も 整数だよ',
      explanation: [
        `${text(`0 からの 距離が ${a} より 小さい 整数`)}`,
        `${text('答え: ')} ${list.join(', ')} ${text(`(${list.length} 個)`)}`,
      ],
      tags: ['abs_range_list'],
      key: `abs:less:${a}`,
      verify: `[${list.join(',')}]`,
    };
  }
  if (form === 0) {
    const a = rng.int(1, 10);
    return {
      templateId: 'g1.sign.abs',
      difficulty: d,
      prompt: `${text(`絶対値が ${a} である数を すべて答えよ`)}`,
      promptText: `絶対値が ${a} である数を すべて答えよ(「,」で区切る)`,
      answer: { kind: 'numbers', values: [rat(a), rat(-a)] },
      hint: '0 から 同じ 距離の 数は、右と左に 1つずつ',
      explanation: [`${text('0 から')} ${a} ${text('はなれた数は')} ${a} ${text('と')} -${a}`, `${text('答え: ')} ${a}, -${a}`],
      tags: ['abs_two_values'],
      key: `abs:both:${a}`,
      verify: `[${a}, -${a}]`,
    };
  }
  const lo = -rng.int(1, 6) - (rng.bool() ? 0.5 : 0);
  const hi = rng.int(1, 6) + (rng.bool() ? 0.5 : 0);
  let count = 0;
  for (let k = Math.ceil(lo); k <= Math.floor(hi); k++) if (k > lo && k < hi) count++;
  return {
    templateId: 'g1.sign.abs',
    difficulty: d,
    prompt: `${text(`${plainMinus(String(lo))} より大きく ${hi} より小さい整数は 何個?`)}`,
    promptText: `${plainMinus(String(lo))} より大きく ${hi} より小さい整数は 何個?`,
    answer: { kind: 'number', value: rat(count) },
    hint: '数直線に 目盛りを 書いて、両はしを 含むか どうかを 確かめよう',
    explanation: [
      `${text('あてはまる整数: ')} ${listIntegers(lo, hi).map((k) => plainMinus(String(k))).join(', ')}`,
      `${text('答え: ')} ${count} ${text('個')}`,
    ],
    tags: ['count_integers'],
    key: `abs:count:${lo}:${hi}`,
    verify: `(()=>{let c=0;for(let k=Math.ceil(${lo});k<=Math.floor(${hi});k++) if(k>${lo}&&k<${hi}) c++;return c;})()`,
  };
}

function rat2num(rng: Rng): number {
  return rng.nonZero(9) + (rng.bool() ? 0.5 : 0) * Math.sign(rng.nonZero(1));
}
function listIntegers(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let k = Math.ceil(lo); k <= Math.floor(hi); k++) if (k > lo && k < hi) out.push(k);
  return out;
}

// ---------------------------------------------------------------- 四則混合・累乗

function genMixed(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    // a × b + c / a + b × c(× が先)
    const a = rng.nonZero(6);
    const b = rng.nonZero(6);
    const c = rng.nonZero(10);
    const first = rng.bool();
    const tex = first ? `${paren(a)} \\times ${paren(b)} + ${paren(c)}` : `${paren(c)} + ${paren(a)} \\times ${paren(b)}`;
    const value = rat(a * b + c);
    return {
      templateId: 'g1.sign.mixed',
      difficulty: d,
      prompt: `${tex} = ?`,
      promptText: plainMinus(tex.replace('\\times', '×')) + ' = ?',
      answer: { kind: 'number', value },
      hint: 'かけ算が 先。足し算は あと',
      explanation: [`${paren(a)} \\times ${paren(b)} = ${a * b}`, `${a * b} + ${paren(c)} = ${a * b + c}`, `${text('答え: ')} ${a * b + c}`],
      tags: ['order_of_operations'],
      key: `mixed:${tex}`,
      verify: `(${a})*(${b})+(${c})`,
    };
  }
  if (d === 2) {
    // 累乗: (−a)² と −a² の区別、または かっこつき
    if (rng.bool()) {
      const a = rng.int(2, 6);
      const withParen = rng.bool();
      // 3乗は 3 まで((−6)³ = −216 のような大きな数は 教科書に出ない)
      const e = a <= 3 ? rng.pick([2, 3]) : 2;
      const value = withParen ? pow(rat(-a), e) : neg(pow(rat(a), e));
      const tex = withParen ? `(-${a})^{${e}}` : `-${a}^{${e}}`;
      return {
        templateId: 'g1.sign.mixed',
        difficulty: d,
        prompt: `${tex} = ?`,
        promptText: plainMinus(withParen ? `(−${a})${sup(e)}` : `−${a}${sup(e)}`) + ' = ?',
        answer: { kind: 'number', value },
        hint: withParen ? 'かっこの中 ぜんぶを かける。(−a)² = (−a)×(−a)' : 'かっこが ないときは a² を 先に 計算して、あとで −',
        explanation: withParen
          ? [`(-${a})^{${e}} = ${Array(e).fill(`(-${a})`).join(' \\times ')} = ${toTex(value)}`, `${text('答え: ')} ${toTex(value)}`]
          : [`-${a}^{${e}} = -(${a}^{${e}}) = -${a ** e}`, `${text('答え: ')} ${toTex(value)}`],
        tags: [withParen ? 'power_of_negative' : 'negative_of_power'],
        key: `mixed:${tex}`,
        verify: withParen ? `(-${a})**${e}` : `-(${a}**${e})`,
      };
    }
    const a = rng.nonZero(9);
    const b = rng.nonZero(9);
    const c = rng.nonZero(9);
    const tex = `${paren(a)} \\times (${b} ${c < 0 ? '-' : '+'} ${Math.abs(c)})`;
    const value = rat(a * (b + c));
    return {
      templateId: 'g1.sign.mixed',
      difficulty: d,
      prompt: `${tex} = ?`,
      promptText: plainMinus(tex.replace('\\times', '×')) + ' = ?',
      answer: { kind: 'number', value },
      hint: 'かっこの中を 先に 計算しよう',
      explanation: [`${b} ${c < 0 ? '-' : '+'} ${Math.abs(c)} = ${b + c}`, `${paren(a)} \\times ${paren(b + c)} = ${a * (b + c)}`, `${text('答え: ')} ${a * (b + c)}`],
      tags: ['parentheses_first'],
      key: `mixed:${tex}`,
      verify: `(${a})*((${b})+(${c}))`,
    };
  }
  // ★3: 4 回に 3 回は チャレンジテストの形(乗除のかたまりを 加減でつなぐ)、1 回は 累乗 + 乗除
  if (rng.int(0, 3) > 0) return genMixedChain(rng, d);
  const a = rng.nonZero(4, 2);
  const b = rng.nonZero(9);
  const c = rng.nonZero(6, 2);
  const e = 2;
  const k = rng.int(1, 3) * c; // 割り切れるように
  const withParen = rng.bool();
  const powVal = withParen ? pow(rat(-Math.abs(a)), e) : neg(pow(rat(Math.abs(a)), e));
  const powTex = withParen ? `(-${Math.abs(a)})^{${e}}` : `-${Math.abs(a)}^{${e}}`;
  const value = add(powVal, mul(rat(b), div(rat(k), rat(c))));
  const tex = `${powTex} + ${paren(b)} \\times ${paren(k)} \\div ${paren(c)}`;
  return {
    templateId: 'g1.sign.mixed',
    difficulty: d,
    prompt: `${tex} = ?`,
    promptText: plainMinus(tex.replace(/\\times/g, '×').replace(/\\div/g, '÷').replace(/\^\{2\}/g, '²')) + ' = ?',
    answer: { kind: 'number', value },
    hint: '累乗 → 乗除 → 加減 の順。ひとつずつ 書きながら',
    explanation: [
      `${powTex} = ${toTex(powVal)}`,
      `${paren(b)} \\times ${paren(k)} \\div ${paren(c)} = ${toTex(mul(rat(b), div(rat(k), rat(c))))}`,
      `${toTex(powVal)} + (${toTex(mul(rat(b), div(rat(k), rat(c))))}) = ${toTex(value)}`,
      `${text('答え: ')} ${toTex(value)}`,
    ],
    tags: ['order_of_operations', withParen ? 'power_of_negative' : 'negative_of_power'],
    key: `mixed:${tex}`,
    verify: `${withParen ? `(-${Math.abs(a)})**${e}` : `-(${Math.abs(a)}**${e})`} + (${b})*(${k})/(${c})`,
  };
}

/**
 * 四則混合 ★3 の「かたまり」の形。大阪府チャレンジテストの計算問題に合わせる(docs/difficulty.md)。
 *   [['÷'], ['×']]       −20 ÷ (−4) + (−6) × 2
 *   [['÷', '×'], ['×']]  −20 ÷ 5 × 2 − 7 × (−2)
 *   [['×'], ['÷', '×']]  5 × (−3) − 18 ÷ (−2) × 3
 *   [[], ['×'], ['÷']]   −3 + 5 × (−4) − 6 ÷ (−2)
 * わられる数は 20 まで、ほかは 1けた。どの割り算も わり切れる
 */
const CHAIN_SHAPES: ('×' | '÷')[][][] = [
  [['÷'], ['×']],
  [['÷', '×'], ['×']],
  [['×'], ['÷', '×']],
  [[], ['×'], ['÷']],
];

function genChainBlock(rng: Rng, ops: ('×' | '÷')[]): { nums: number[]; value: number } {
  if (ops[0] === '÷') {
    const b = rng.nonZero(6, 2);
    const q = rng.nonZero(Math.floor(20 / Math.abs(b)));
    const nums = [b * q, b];
    let value = q;
    // ÷ のあとは × だけ(CHAIN_SHAPES)。× 1 は計算にならないので 2 から
    for (const _ of ops.slice(1)) {
      const c = rng.nonZero(5, 2);
      nums.push(c);
      value *= c;
    }
    return { nums, value };
  }
  const nums = [rng.nonZero(9, 2)];
  for (const _ of ops) nums.push(rng.nonZero(9, 2));
  return { nums, value: nums.reduce((p, x) => p * x, 1) };
}

function genMixedChain(rng: Rng, d: Difficulty): Problem {
  const shape = rng.pick(CHAIN_SHAPES);
  let blocks: { sign: 1 | -1; nums: number[]; value: number; ops: ('×' | '÷')[] }[];
  let value: number;
  do {
    blocks = shape.map((ops, i) => ({ sign: i === 0 ? 1 : rng.pick([1, -1] as const), ops, ...genChainBlock(rng, ops) }));
    value = blocks.reduce((sum, b) => sum + b.sign * b.value, 0);
  } while (Math.abs(value) > 60);

  const TEX_OP = { '×': '\\times', '÷': '\\div' } as const;
  // 先頭の負の数は かっこなし(−20 ÷ 5)。演算子のうしろの負の数は かっこつき
  const blockTex = (b: (typeof blocks)[number], first: boolean) =>
    b.nums.map((n, i) => (i === 0 ? (first ? String(n) : paren(n)) : ` ${TEX_OP[b.ops[i - 1]]} ${paren(n)}`)).join('');
  const tex = blocks.map((b, i) => (i === 0 ? blockTex(b, true) : ` ${b.sign > 0 ? '+' : '-'} ${blockTex(b, false)}`)).join('');
  const sumTex = blocks.map((b, i) => (i === 0 ? String(b.value) : ` ${b.sign > 0 ? '+' : '-'} ${paren(b.value)}`)).join('');
  const jsOp = { '×': '*', '÷': '/' } as const;
  const verify = blocks
    .map((b, i) => `${i === 0 ? '' : b.sign > 0 ? '+' : '-'}(${b.nums.map((n, k) => (k === 0 ? `(${n})` : `${jsOp[b.ops[k - 1]]}(${n})`)).join('')})`)
    .join('');
  return {
    templateId: 'g1.sign.mixed',
    difficulty: d,
    prompt: `${tex} = ?`,
    promptText: plainMinus(tex.replace(/\\times/g, '×').replace(/\\div/g, '÷')) + ' = ?',
    answer: { kind: 'number', value: rat(value) },
    hint: '× と ÷ の かたまりを 先に 計算して、あとで 足し引き',
    explanation: [
      ...blocks.filter((b) => b.ops.length > 0).map((b) => `${blockTex(b, false)} = ${b.value}`),
      `${sumTex} = ${value}`,
      `${text('答え: ')} ${value}`,
    ],
    tags: ['order_of_operations'],
    key: `mixed:${tex}`,
    verify,
  };
}

function sup(e: number): string {
  return e === 2 ? '²' : e === 3 ? '³' : `^${e}`;
}

// ---------------------------------------------------------------- 素因数分解

/**
 * 素因数分解の数の選び方。教科書の練習問題(60, 84, 126, 180 など)に合わせ、使う素数は 2・3・5・7 が中心。
 * 大きい素数(11, 13)は ★3 でたまに 1 つだけ入れる。100〜999 の数を無作為に選んでいたときは
 * 「割れる素数を探す」だけで時間が尽きたので、素数の積から作る(先生の試遊での指摘)
 */
const SMALL_PRIMES = [2, 3, 5, 7];

function productOf(rng: Rng, count: number, extra: number[] = []): number {
  let n = 1;
  for (let i = 0; i < count; i++) n *= rng.pick(SMALL_PRIMES);
  for (const p of extra) n *= p;
  return n;
}

function genPrimeFactor(rng: Rng, d: Difficulty): Problem {
  let n: number;
  if (d === 1) {
    // 2〜3個の素数の積(12〜50)。例: 12, 18, 30, 42(4 や 6 は分解する手順の練習にならない)
    do n = productOf(rng, rng.pick([2, 3]));
    while (n > 50 || n < 12);
  } else if (d === 2) {
    // 3〜4個の積(≤ 120)。例: 60, 72, 84, 90
    do n = productOf(rng, rng.pick([3, 4]));
    while (n > 120 || n < 24);
  } else {
    // 4〜5個の積(≤ 300)。5 回に 1 回は 11 か 13 を 1 つ混ぜる。例: 126, 180, 252, 132
    const extra = rng.bool(0.2) ? [rng.pick([11, 13])] : [];
    do n = productOf(rng, rng.pick([4, 5]) - extra.length, extra);
    while (n > 300 || n < 60);
  }
  const factors = primeFactors(n);
  // 解説: 小さい素数で 順に 割る
  const steps: string[] = [];
  let m = n;
  for (const p of factors) {
    if (m === p) break;
    steps.push(`${m} \\div ${p} = ${m / p}`);
    m /= p;
  }
  return {
    templateId: 'g1.sign.primefactor',
    difficulty: d,
    prompt: `${n} ${text(' を 素因数分解せよ')}`,
    promptText: `${n} を 素因数分解せよ(例: 2×2×3 または 2^2×3)`,
    answer: { kind: 'factorization', n },
    hint: '小さい 素数(2, 3, 5, 7…)で 割れるだけ 割っていこう',
    explanation: [...steps, `${text('答え: ')} ${factorsToTex(factors)}`],
    tags: ['prime_factorization'],
    key: `pf:${n}`,
    verify: `${n}`,
  };
}

// ---------------------------------------------------------------- 登録

const templates: ProblemTemplate[] = [
  { id: 'g1.sign.addsub', unit: UNIT, title: '正負の数の加減', timeLimit: { 1: 40, 2: 45, 3: 60 }, generate: (rng, d) => genAddSub(rng, d) },
  { id: 'g1.sign.addsub_big', unit: UNIT, title: '大きな数の加減', timeLimit: { 1: 60, 2: 75, 3: 90 }, generate: (rng, d) => genAddSub(rng, d, true) },
  { id: 'g1.sign.muldiv', unit: UNIT, title: '正負の数の乗除', timeLimit: { 1: 30, 2: 40, 3: 60 }, generate: genMulDiv },
  { id: 'g1.sign.abs', unit: UNIT, title: '絶対値と大小', timeLimit: { 1: 25, 2: 40, 3: 60 }, generate: genAbs },
  { id: 'g1.sign.mixed', unit: UNIT, title: '四則混合と累乗', timeLimit: { 1: 40, 2: 50, 3: 75 }, generate: genMixed },
  { id: 'g1.sign.primefactor', unit: UNIT, title: '素因数分解', timeLimit: { 1: 45, 2: 60, 3: 90 }, generate: genPrimeFactor },
];
for (const t of templates) registerTemplate(t);

