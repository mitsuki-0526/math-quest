import { registerTemplate, type Difficulty, type Problem, type ProblemTemplate } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat, add, sub, mul, div, pow, neg, abs as rabs, toTex, toNumber } from '@/math/rational';
import { paren, plainMinus, text } from '@/math/format';
import { primeFactors, factorsToTex, isPrime } from '@/math/factorization';

/**
 * 第1章「正の数と負の数」のテンプレート(台本 01_sign_forest.md の敵に対応)。
 *   g1.sign.addsub      マイナススライム   加減
 *   g1.sign.muldiv      プラマイコウモリ   乗除
 *   g1.sign.abs         ゼッタイチ・ゴーレム 絶対値・大小
 *   g1.sign.mixed       クロスバッタ       四則混合・累乗
 *   g1.sign.primefactor 素数バチ           素因数分解
 */

const UNIT = '正の数と負の数';

// ---------------------------------------------------------------- 加減

function genAddSub(rng: Rng, d: Difficulty): Problem {
  const count = d === 1 ? 2 : d === 2 ? 3 : rng.pick([3, 4]);
  const max = d === 1 ? 10 : d === 2 ? 20 : 50;
  const terms: number[] = [];
  const ops: ('+' | '-')[] = [];
  for (let i = 0; i < count; i++) {
    terms.push(rng.nonZero(max));
    if (i > 0) ops.push(rng.pick(['+', '-']));
  }
  // ★1 は必ず負の数を含める(符号の練習にならないため)
  if (d === 1 && terms.every((t) => t > 0)) terms[rng.int(0, 1)] *= -1;

  // ★3 の半分は「項だけの式」(-3 + 7 - 5)で出す
  const termForm = d === 3 && rng.bool();
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
    templateId: 'g1.sign.addsub',
    difficulty: d,
    prompt: `${tex} = ?`,
    promptText: `${plain} = ?`,
    answer: { kind: 'number', value },
    hint: termForm ? '正の項どうし、負の項どうしを 先に まとめてみよう' : 'まず かっこを はずして、項だけの式に してみよう。−(−3) は +3',
    explanation,
    tags,
    key: `addsub:${tex}`,
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
      const b = rng.nonZero(12, 2);
      const q = rng.nonZero(12);
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
  // ★3: 乗除の混合。答えが分数になることもある
  const a = rng.nonZero(12);
  const b = rng.nonZero(9);
  const c = rng.nonZero(6, 2);
  const value = div(mul(rat(a), rat(b)), rat(c));
  return {
    templateId: 'g1.sign.muldiv',
    difficulty: d,
    prompt: `${paren(a)} \\times ${paren(b)} \\div ${paren(c)} = ?`,
    promptText: plainMinus(`${paren(a)} × ${paren(b)} ÷ ${paren(c)} = ?`),
    answer: { kind: 'number', value },
    hint: '符号を 先に 決めて、÷ は 逆数の × に 直すと 楽',
    explanation: [
      `${text('負の数が ')}${[a, b, c].filter((x) => x < 0).length}${text(' 個 → 符号は ')}${toNumber(value) < 0 ? '-' : '+'}`,
      `${Math.abs(a)} \\times ${Math.abs(b)} \\div ${Math.abs(c)} = \\frac{${Math.abs(a * b)}}{${Math.abs(c)}} = ${toTex(rabs(value))}`,
      `${text('答え: ')} ${toTex(value)}`,
    ],
    tags: value.d !== 1n ? ['fraction_result'] : ['count_negatives'],
    key: `muldiv:${a}*${b}/${c}`,
    verify: `(${a})*(${b})/(${c})`,
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
  // ★3: 絶対値が a の数を すべて / ある範囲の整数の個数
  if (rng.bool()) {
    const a = rng.int(1, 30);
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
      const e = rng.pick([2, 3]);
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
  // ★3: 累乗 + 乗除 + 加減
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

function sup(e: number): string {
  return e === 2 ? '²' : e === 3 ? '³' : `^${e}`;
}

// ---------------------------------------------------------------- 素因数分解

const SMALL_PRIMES = [2, 3, 5, 7];
const MID_PRIMES = [2, 3, 5, 7, 11, 13];

function genPrimeFactor(rng: Rng, d: Difficulty): Problem {
  let n: number;
  if (d === 1) {
    // 2〜3個の小さな素数の積(≤ 50)
    do {
      const k = rng.pick([2, 3]);
      n = 1;
      for (let i = 0; i < k; i++) n *= rng.pick(SMALL_PRIMES);
    } while (n > 50 || isPrime(n));
  } else if (d === 2) {
    do {
      const k = rng.pick([3, 4]);
      n = 1;
      for (let i = 0; i < k; i++) n *= rng.pick(MID_PRIMES);
    } while (n > 200 || isPrime(n));
  } else {
    do {
      n = rng.int(100, 999);
    } while (isPrime(n) || primeFactors(n).length < 3);
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
  { id: 'g1.sign.addsub', unit: UNIT, title: '正負の数の加減', timeLimit: { 1: 40, 2: 45, 3: 60 }, generate: genAddSub },
  { id: 'g1.sign.muldiv', unit: UNIT, title: '正負の数の乗除', timeLimit: { 1: 30, 2: 40, 3: 60 }, generate: genMulDiv },
  { id: 'g1.sign.abs', unit: UNIT, title: '絶対値と大小', timeLimit: { 1: 25, 2: 40, 3: 60 }, generate: genAbs },
  { id: 'g1.sign.mixed', unit: UNIT, title: '四則混合と累乗', timeLimit: { 1: 40, 2: 50, 3: 75 }, generate: genMixed },
  { id: 'g1.sign.primefactor', unit: UNIT, title: '素因数分解', timeLimit: { 1: 45, 2: 60, 3: 90 }, generate: genPrimeFactor },
];
for (const t of templates) registerTemplate(t);

