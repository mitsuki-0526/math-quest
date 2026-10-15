import { mistakeNum, registerTemplate, type Difficulty, type Mistake, type Problem } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat, toTex, type Rational } from '@/math/rational';
import { plainMinus, text } from '@/math/format';

/**
 * 第3章「方程式」のテンプレート(台本 03_unknown_cave.md の敵に対応)。
 *   g1.eq.basic    てんびんスライム  方程式の解・等式の性質(x + a = b、ax = b、x/k = b、(p/q)x = b)
 *   g1.eq.linear   移項ネズミ        移項(ax + b = c、ax = cx + e、ax + b = cx + e)
 *   g1.eq.paren    かっこトロル      かっこを含む方程式
 *   g1.eq.fraction 分数ゴースト      小数・分数の係数
 *   g1.eq.ratio    比のカニ          比例式
 *   g1.eq.word     (ボス)            文章題(選択式で式 → 数値で解)
 * ★ は 教科書の 本文(先生から 受け取った 3 章 26 ページ、2026-10-15。特徴は refs/prints/3章_honbun-features.md)に 合わせた。
 * 各 ★ の 1 段目が 教科書の 前の方の 問(♥ の 基本)、★3 は 章の問題 A と チャレンジテストの 形。
 * 解は 整数が 基本。教科書の 基本に ある −6x = 3 のような 分数の 解は 等式の性質の ★2 から、移項の ★3 にも 出す。
 * 答えは すべて「x の値」
 */
const UNIT = '方程式';

// ---------------------------------------------------------------- 式の 書き方

/** 係数つきの x(1x → x、−1x → −x) */
const coef = (c: number, v = 'x'): string => (c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`);
/** 2 つめ以降の 項(符号つき。0 なら 書かない) */
const signed = (c: number, v = ''): string => (c === 0 ? '' : `${c < 0 ? ' - ' : ' + '}${v ? coef(Math.abs(c), v) : Math.abs(c)}`);
/** ax + b(a が 0 なら b だけ) */
const lin = (a: number, b: number): string => (a === 0 ? String(b) : `${coef(a)}${signed(b)}`);
/** 小数(10 分の n、100 分の n)。12 → 1.2、−5 → −0.5、20 → 2 */
const dec = (n: number, scale = 10): string => String(n / scale);
/** 答えの 行 */
const answerLine = (x: Rational | number): string => `${text('答え: ')} x = ${toTex(typeof x === 'number' ? rat(x) : x)}`;
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const lcm = (a: number, b: number): number => Math.abs(a * b) / gcd(a, b);
/** 数を 平文の −(問題文・一言用) */
const pm = (n: number | string): string => plainMinus(String(n));

// ---------------------------------------------------------------- 小さな 分数(問題を 作るときの 計算用)

interface Fr {
  n: number;
  d: number;
}
function fr(n: number, d = 1): Fr {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
const frAdd = (a: Fr, b: Fr): Fr => fr(a.n * b.d + b.n * a.d, a.d * b.d);
const frSub = (a: Fr, b: Fr): Fr => fr(a.n * b.d - b.n * a.d, a.d * b.d);
const frMul = (a: Fr, b: Fr): Fr => fr(a.n * b.n, a.d * b.d);
const frIsInt = (a: Fr): boolean => a.d === 1;
const frRat = (a: Fr): Rational => rat(a.n, a.d);

// ---------------------------------------------------------------- 両辺の 式(移項・かっこ・小数と分数を はらった あと で 使う)

/** 整数の 係数の 項。p は かっこ k(ax + b)。rev なら かっこの 中を 数から 書く k(b + ax)(教科書の −3(2 − x)) */
type Term = { t: 'x'; c: number } | { t: 'n'; c: number } | { t: 'p'; k: number; a: number; b: number; rev?: boolean };
type Side = Term[];

const innerTex = (p: { a: number; b: number; rev?: boolean }): string => (p.rev ? `${p.b}${signed(p.a, 'x')}` : lin(p.a, p.b));
function termTex(term: Term, first: boolean): string {
  if (term.t === 'x') return first ? coef(term.c) : signed(term.c, 'x');
  if (term.t === 'n') return first ? String(term.c) : signed(term.c);
  const body = `(${innerTex(term)})`;
  const k = Math.abs(term.k) === 1 ? '' : String(Math.abs(term.k));
  if (first) return `${term.k < 0 ? '-' : ''}${k}${body}`;
  return `${term.k < 0 ? ' - ' : ' + '}${k}${body}`;
}
const sideTex = (s: Side): string => (s.length ? s.map((t, i) => termTex(t, i === 0)).join('') : '0');
/** かっこを はずした 項の 並び(rev なら 数の項が 先) */
const flat = (s: Side): Side =>
  s.flatMap((t): Term[] => {
    if (t.t !== 'p') return [t];
    const x: Term = { t: 'x', c: t.k * t.a };
    const n: Term = { t: 'n', c: t.k * t.b };
    return (t.rev ? [n, x] : [x, n]).filter((u) => u.c !== 0);
  });
const sumX = (s: Side): number => flat(s).reduce((v, t) => v + (t.t === 'x' ? t.c : 0), 0);
const sumN = (s: Side): number => flat(s).reduce((v, t) => v + (t.t === 'n' ? t.c : 0), 0);
/** 検証用: その辺の 式に x = v を 入れる JS 式(問題を 作った 計算とは 別の 書き方で 答えを 確かめる) */
const sideJs = (s: Side, v: number): string =>
  s.map((t) => (t.t === 'x' ? `(${t.c})*(${v})` : t.t === 'n' ? `(${t.c})` : `(${t.k})*((${t.a})*(${v})+(${t.b}))`)).join('+') || '0';
const verifyOf = (l: Side, r: Side): string =>
  `((${sideJs(r, 0)})-(${sideJs(l, 0)}))/(((${sideJs(l, 1)})-(${sideJs(l, 0)}))-((${sideJs(r, 1)})-(${sideJs(r, 0)})))`;

/** 教科書の 手順の 解説: かっこを はずす → x の項を 左辺に、数の項を 右辺に 移項 → ax = b → 両辺を a で わる */
function solveSteps(left: Side, right: Side, firstLabel = ''): string[] {
  const steps = [`${sideTex(left)} = ${sideTex(right)}${firstLabel ? ` \\quad ${text(firstLabel)}` : ''}`];
  const fl = flat(left);
  const fr2 = flat(right);
  if ([...left, ...right].some((t) => t.t === 'p')) steps.push(`${sideTex(fl)} = ${sideTex(fr2)} \\quad ${text('(かっこを はずす)')}`);
  const Xl = sumX(left);
  const Xr = sumX(right);
  const Nl = sumN(left);
  const Nr = sumN(right);
  const movedX = fr2.filter((t) => t.t === 'x');
  const movedN = fl.filter((t) => t.t === 'n');
  const lx: Side = [...fl.filter((t) => t.t === 'x'), ...movedX.map((t): Term => ({ t: 'x', c: -(t as { c: number }).c }))];
  const rn: Side = [...fr2.filter((t) => t.t === 'n'), ...movedN.map((t): Term => ({ t: 'n', c: -(t as { c: number }).c }))];
  if (movedX.length || movedN.length) {
    const what = [...movedX.map((t) => pm(coef((t as { c: number }).c))), ...movedN.map((t) => pm((t as { c: number }).c))].join(' と ');
    steps.push(`${sideTex(lx)} = ${sideTex(rn)} \\quad ${text(`(${what} を 移項)`)}`);
  }
  const c = Xl - Xr;
  if (lx.length > 1 || rn.length > 1) steps.push(`${c === 0 ? '0' : coef(c)} = ${Nr - Nl}`);
  const v = rat(Nr - Nl, c);
  if (c !== 1) steps.push(`x = ${toTex(v)} \\quad ${text(`(両辺を ${pm(c)} で わる)`)}`);
  steps.push(answerLine(v));
  return steps;
}

/** 移項・かっこの よくある まちがい(それぞれの 誤答を 計算する) */
function solveMistakes(left: Side, right: Side): Mistake[] {
  const Xl = sumX(left);
  const Xr = sumX(right);
  const Nl = sumN(left);
  const Nr = sumN(right);
  const c = Xl - Xr;
  const out: Mistake[] = [];
  const nOnLeft = flat(left).find((t) => t.t === 'n') as { c: number } | undefined;
  const xOnRight = flat(right).find((t) => t.t === 'x') as { c: number } | undefined;
  // 数の項を 符号を 変えずに 右辺へ
  if (nOnLeft) out.push(mistakeNum(rat(Nr + Nl, c), `${pm(nOnLeft.c)} を 右辺へ 移すときは 符号を 変えて ${pm(-nOnLeft.c)} に するよ`));
  // x の項を 符号を 変えずに 左辺へ
  if (xOnRight && Xl + Xr !== 0) out.push(mistakeNum(rat(Nr - Nl, Xl + Xr), `${pm(coef(xOnRight.c))} を 左辺へ 移すときは 符号を 変えて ${pm(coef(-xOnRight.c))} に するよ`));
  // かっこの 後ろの 項に かけ忘れた(3(x + 2) → 3x + 2)/ かっこの 前が 負の数で 符号を 変え忘れた(−2(x − 3) → −2x − 6)
  for (const [side, sign] of [
    [left, 1],
    [right, -1],
  ] as const)
    for (const t of side) {
      if (t.t !== 'p') continue;
      if (Math.abs(t.k) !== 1) out.push(mistakeNum(rat(Nr - Nl + sign * (t.k * t.b - t.b), c), `かっこの 前の ${pm(t.k)} は、かっこの 中の ${pm(t.b)} にも かけるよ(分配法則)`));
      if (t.k < 0) out.push(mistakeNum(rat(Nr - Nl + sign * 2 * t.k * t.b, c), `${pm(t.k)}(…) は かっこの 中の どの項にも ${pm(t.k)} を かける。${pm(t.k)} × ${t.b < 0 ? `(${pm(t.b)})` : t.b} = ${pm(t.k * t.b)} だよ`));
    }
  // 最後に わるところを ひいた(5x = 15 で 10)
  if (Math.abs(c) !== 1) out.push(mistakeNum(Nr - Nl - c, `${pm(coef(c))} = ${pm(Nr - Nl)} は 両辺を ${pm(c)} で わるよ(ひくのでは ない)`));
  return out;
}

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
  const answer = typeof p.answer === 'number' ? rat(p.answer) : p.answer;
  return {
    templateId: p.id,
    difficulty: p.d,
    prompt: `${p.eq} \\quad ${text('x を求めよ')}`,
    promptText: `${plain} の x を求めよ`,
    answer: { kind: 'number', value: answer },
    hint: p.hint,
    explanation: p.explanation,
    // 一言の 負の数も 平文の −(−3 など)で 見せる
    mistakes: p.mistakes?.map((m) => ({ ...m, say: plainMinus(m.say) })),
    tags: answer.d !== 1n && !p.tags.includes('eq_fraction_answer') ? [...p.tags, 'eq_fraction_answer'] : p.tags,
    key: p.key,
    verify: p.verify,
  };
}

/** 両辺の 式から 問題を 作る(移項・かっこ・比例式) */
function sidesProblem(d: Difficulty, id: string, left: Side, right: Side, hint: string, tags: string[], eqTex?: string, firstSteps: string[] = []): Problem {
  const c = sumX(left) - sumX(right);
  const answer = rat(sumN(right) - sumN(left), c);
  const eq = eqTex ?? `${sideTex(left)} = ${sideTex(right)}`;
  return eqProblem({
    d,
    id,
    eq,
    answer,
    hint,
    explanation: [...firstSteps, ...solveSteps(left, right)],
    mistakes: solveMistakes(left, right),
    tags,
    key: `${id}:${eq}`,
    verify: verifyOf(left, right),
  });
}

// ---------------------------------------------------------------- 基本(方程式の解・等式の性質)

/**
 * 方程式の解・等式の性質(てんびんスライム)。教科書の 1 節 1・問題 3〜5。
 *   ★1: x + a = b / a + x = b / x − a = b(解は 負の数も。例題の x + 9 = 4)/ ax = b(九九)/ 7 回に 1 回 解を 選ぶ(1〜4 の うち 2x + 1 = 7 の 解は?)
 *   ★2: −4x = 12 / −x = 6 / x/k = b / (p/q)x = b(¼x = 5、⅔x = 6)/ **解が 分数**(−6x = 3。教科書の 基本)/ 6 回に 1 回 k が 解の 方程式を 選ぶ
 *   ★3: 解が 分数 / −(p/q)x = b / 数の 大きい ★2 の 形
 */
function genBasic(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    const form = rng.pick([0, 0, 1, 2, 2, 3, 3, 4]);
    if (form === 4) return genSolutionChoice(rng, d);
    if (form === 3) return basicMul(d, rng.int(2, 9), rng.int(1, 9));
    const a = rng.int(1, 12);
    const x = rng.bool(0.7) ? rng.int(1, 12) : -rng.int(1, 9);
    return form === 2 ? basicAdd(d, -a, x) : basicAdd(d, a, x, form === 1);
  }
  if (d === 2) {
    const form = rng.pick([0, 1, 1, 2, 3, 4, 5]);
    if (form === 0) return rng.bool() ? genWhichSolution(rng, d) : basicAdd(d, rng.nonZero(12), rng.nonZero(12), rng.bool(0.3));
    if (form === 1) {
      const a = rng.nonZero(9, 2);
      const x = rng.nonZero(9);
      return a > 0 && x > 0 ? basicMul(d, -a, x) : basicMul(d, a, x);
    }
    if (form === 2) return basicMul(d, -1, rng.nonZero(12, 2));
    if (form === 3) return basicDiv(d, rng.int(2, 6), rng.nonZero(6));
    if (form === 4) return basicFracCoefRandom(rng, d, false);
    return basicFracAnswer(rng, d, 6);
  }
  const form = rng.pick([0, 0, 1, 1, 2]);
  if (form === 0) return basicFracAnswer(rng, d, 9);
  if (form === 1) return basicFracCoefRandom(rng, d, true);
  return rng.bool() ? basicMul(d, rng.nonZero(12, 6), rng.nonZero(12)) : basicAdd(d, rng.nonZero(20, 10), rng.nonZero(12), rng.bool(0.3));
}

/** ax = b で 解が 分数(b が a で わりきれない。約分は する) */
function basicFracAnswer(rng: Rng, d: Difficulty, max: number): Problem {
  let a: number, b: number;
  do {
    a = rng.nonZero(max, 2);
    b = rng.nonZero(12, 1);
  } while (b % a === 0 || Math.abs(a) === Math.abs(b));
  return basicMul(d, a, rat(b, a));
}

/** (p/q)x = b。解は 整数。neg なら 係数が 負の数のことも(−½x = 6) */
function basicFracCoefRandom(rng: Rng, d: Difficulty, neg: boolean): Problem {
  let p: number, q: number;
  do {
    p = neg ? rng.nonZero(5) : rng.int(1, 5);
    q = rng.int(2, 6);
  } while (gcd(p, q) !== 1);
  const x = q * rng.nonZero(Math.max(1, Math.floor(12 / q)));
  return basicFracCoef(d, p, q, x);
}

/** x + a = b(a が 負なら x − |a| = b)。constFirst なら a + x = b(教科書の 10 + x = 7) */
function basicAdd(d: Difficulty, a: number, x: number, constFirst = false): Problem {
  const b = x + a;
  const left = constFirst && a > 0 ? `${a} + x` : lin(1, a);
  const eq = `${left} = ${b}`;
  return eqProblem({
    d,
    id: 'g1.eq.basic',
    eq,
    answer: x,
    hint: a > 0 ? `天秤の 両側から ${a} を 取ってみよう(両辺から ${a} を ひく)` : `天秤の 両側に ${-a} を のせてみよう(両辺に ${-a} を たす)`,
    explanation: [
      `${eq}`,
      `${left}${signed(-a)} = ${b}${signed(-a)} \\quad ${text(a > 0 ? `(両辺から ${a} を ひく)` : `(両辺に ${-a} を たす)`)}`,
      `x = ${x}`,
      answerLine(x),
    ],
    // 両辺から ひく ところを たした
    mistakes: [mistakeNum(b + a, a > 0 ? `x に ${a} が たしてあるから、両辺から ${a} を ひくんだよ(${pm(b)} − ${a})` : `x から ${-a} が ひいてあるから、両辺に ${-a} を たすんだよ(${pm(b)} + ${-a})`)],
    tags: ['eq_add'],
    key: `eqb:${left}=${b}`,
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
  const ap = a < 0 ? `(${a})` : String(a);
  const mistakes: Mistake[] = [];
  // わる数と わられる数を 逆に(4x = 12 で 4/12)
  if (b !== 0) mistakes.push(mistakeNum(rat(a, b), `${coef(a)} = ${b} は 両辺を ${ap} で わる。${b} ÷ ${ap} だよ(わる順が 逆)`));
  // 符号だけ ちがう
  if (a < 0) mistakes.push(mistakeNum(rat(-b, a), `数の 大きさは 合ってる! 両辺を ${a} で わるから、符号も 変わるよ`));
  // 両辺から a を ひいた(かけ算を 移項の ように した)
  mistakes.push(mistakeNum(b - a, `${coef(a)} は ${ap} × x。ひくのでは なく、両辺を ${ap} で わろう`));
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
    prompt: `${text(`${pm(values.join('、'))} の うち、方程式`)} \\; ${eq} \\; ${text('の 解は?')}`,
    promptText: `${pm(values.join('、'))} の うち、方程式 ${plainMinus(eq)} の 解は?`,
    answer: { kind: 'choice', options, correct },
    hint: 'x に 1 つずつ 入れて、左辺と 右辺が 等しく なるか 調べよう',
    explanation: [...values.map((v) => `x = ${v} ${text('のとき 左辺は')} ${a} \\times ${v < 0 ? `(${v})` : v}${signed(b)} = ${a * v + b}${v === x ? ` \\quad ${text('← 右辺と 等しい')}` : ''}`), `${text('答え: ')} x = ${x}`],
    tags: ['eq_solution'],
    key: `eqs:${a}:${b}:${c}:${start}`,
    verify: String(correct),
  };
}

/**
 * k が 解である 方程式を 選ぶ(教科書の「−4 が 解である ものを いいなさい」「6 が 解である ものは どれですか」)。
 * 3 つの 式の 形(x − a = b、x/m = b、ax + b = cx、ax − b = c)の うち 1 つだけ 解が k
 */
function genWhichSolution(rng: Rng, d: Difficulty): Problem {
  const k = rng.pick([-4, -3, -2, 2, 3, 4, 5, 6]);
  // 解が s の 式と、x = k を 入れたときの 左辺・右辺(解説に 使う)
  const make = (form: number, s: number): { eq: string; l: Fr; r: Fr } | null => {
    if (form === 0) {
      const a = rng.int(1, 9);
      return { eq: `${lin(1, -a)} = ${s - a}`, l: fr(k - a), r: fr(s - a) };
    }
    if (form === 1) {
      const m = s === 0 ? undefined : [2, 3, 4, 6].find((t) => s % t === 0 && rng.bool(0.7));
      if (!m) return null;
      return { eq: `\\frac{x}{${m}} = ${s / m}`, l: fr(k, m), r: fr(s / m) };
    }
    if (form === 2) {
      const c = rng.int(2, 4);
      const a = c + rng.pick([-1, 1]);
      const b = (c - a) * s;
      return { eq: `${lin(a, b)} = ${coef(c)}`, l: fr(a * k + b), r: fr(c * k) };
    }
    const a = rng.int(2, 3);
    const b = rng.int(1, 8);
    return { eq: `${lin(a, -b)} = ${a * s - b}`, l: fr(a * k - b), r: fr(a * s - b) };
  };
  for (;;) {
    const forms = rng.shuffle([0, 1, 2, 3]).slice(0, 3);
    const sols = [k, ...[1, 2].map(() => k + rng.pick([-2, -1, 1, 2, 3]))];
    if (sols[1] === k || sols[2] === k) continue;
    const eqs = forms.map((f, i) => make(f, sols[i]));
    if (eqs.some((e) => !e)) continue;
    const list = eqs as { eq: string; l: Fr; r: Fr }[];
    if (new Set(list.map((e) => e.eq)).size !== 3) continue;
    const order = rng.shuffle([0, 1, 2]);
    const options = order.map((i) => list[i].eq);
    const correct = order.indexOf(0);
    return {
      templateId: 'g1.eq.basic',
      difficulty: d,
      prompt: `${text(`次の 方程式で、${pm(k)} が 解である ものは?`)}`,
      promptText: `次の 方程式で、${pm(k)} が 解である ものは?`,
      answer: { kind: 'choice', options, correct },
      hint: `どの 式にも x = ${pm(k)} を 入れて、左辺と 右辺が 等しく なるか 調べよう(負の数は かっこを つけて)`,
      explanation: [
        ...order.map((i) => `${list[i].eq} \\quad x = ${k} ${text(' のとき 左辺')} ${toTex(frRat(list[i].l))}${text('、右辺')} ${toTex(frRat(list[i].r))}${i === 0 ? ` \\; ${text('← 等しい')}` : ''}`),
        `${text('答え: ')} ${list[0].eq}`,
      ],
      tags: ['eq_which_solution'],
      key: `eqws:${options.join('|')}`,
      verify: String(correct),
    };
  }
}

// ---------------------------------------------------------------- 移項

/**
 * 移項(移項ネズミ)。教科書の 1 節 2「方程式の解き方」。
 *   ★1: ax + b = c / b − ax = c(1 − 2x = 11)/ ax = cx + e(4x = 3x − 6)。係数 9 まで
 *   ★2: ax + b = cx + e(9x − 5 = 2x + 23)。右辺が 数から 始まる 形(2x + 7 = 19 − 4x)・解が 0(−7x + 1 = −x + 1)も
 *   ★3: 係数 12 まで。数の項が 先の 形(2 − 7x = 3x − 8。チャレンジテスト)/ 4 回に 1 回 解が 分数(9x = 4 − 7x、5 − x = 5x + 8)
 */
function genLinear(rng: Rng, d: Difficulty): Problem {
  const id = 'g1.eq.linear';
  const hint1 = '数の項を 右辺へ 移項しよう(移すと 符号が 変わる)。次に x の係数で わる';
  const hint2 = 'x の項は 左辺へ、数の項は 右辺へ。移すときは 符号を 変える';
  if (d === 1) {
    // 右辺の 数は 40 まで(教科書の 問 1: 2x − 3 = 7、1 − 2x = 11、7x = 5x − 6)
    for (;;) {
      const form = rng.pick([0, 0, 1, 2, 2]);
      const x = rng.nonZero(9);
      if (form === 0) {
        const a = rng.int(2, 9);
        const b = rng.nonZero(9);
        if (Math.abs(a * x + b) > 40 || a * x + b === 0) continue;
        return sidesProblem(d, id, [{ t: 'x', c: a }, { t: 'n', c: b }], [{ t: 'n', c: a * x + b }], hint1, ['eq_transpose']);
      }
      if (form === 1) {
        const a = -rng.int(2, 5);
        const b = rng.int(1, 9);
        if (a * x + b === 0) continue;
        return sidesProblem(d, id, [{ t: 'n', c: b }, { t: 'x', c: a }], [{ t: 'n', c: a * x + b }], hint1, ['eq_transpose']);
      }
      const a = rng.int(2, 9);
      const c = rng.int(1, 8);
      if (c === a || Math.abs((a - c) * x) > 30) continue;
      return sidesProblem(d, id, [{ t: 'x', c: a }], [{ t: 'x', c }, { t: 'n', c: (a - c) * x }], hint2, ['eq_both_sides']);
    }
  }
  const max = d === 2 ? 9 : 12;
  const fracAnswer = d === 3 && rng.bool(0.25);
  for (;;) {
    const a = rng.nonZero(max);
    const c = rng.nonZero(max);
    if (a === c || (d === 3 && Math.abs(a) < 2 && Math.abs(c) < 2)) continue;
    const b = rng.bool(0.15) ? 0 : rng.nonZero(d === 2 ? 12 : 15);
    let e: number;
    if (fracAnswer) {
      // 分母は 2〜4(教科書の 9x = 4 − 7x → ¼、5 − x = 5x + 8 → −½)
      if (Math.abs(a - c) > 4) continue;
      e = b + rng.nonZero(20);
      if ((e - b) % (a - c) === 0) continue;
    } else {
      const x = d === 2 && rng.bool(0.1) ? 0 : rng.nonZero(d === 2 ? 9 : 12);
      e = (a - c) * x + b;
    }
    if (e === 0 || Math.abs(e) > (d === 2 ? 30 : 60)) continue;
    const leftX: Term = { t: 'x', c: a };
    const rightX: Term = { t: 'x', c };
    // 数の項が 先の 形(左: 2 − 7x、右: 19 − 4x)。数の項が 0 なら その辺は x だけ
    const left: Side = b === 0 ? [leftX] : rng.bool(d === 3 ? 0.5 : 0.25) ? [{ t: 'n', c: b }, leftX] : [leftX, { t: 'n', c: b }];
    const right: Side = rng.bool(0.4) ? [{ t: 'n', c: e }, rightX] : [rightX, { t: 'n', c: e }];
    return sidesProblem(d, id, left, right, hint2, ['eq_both_sides']);
  }
}

// ---------------------------------------------------------------- かっこ

/**
 * かっこを含む方程式(かっこトロル)。教科書の 1 節 3「いろいろな方程式」の 例題・問 1、章の問題 A。
 *   ★1: k(x + a) = c / k(x + a) − mx = c(5(x + 4) − 3x = 10)
 *   ★2: c + k(x − a) = d(1 + 2(x − 4) = 3)/ mx − k(b − x) = c(2x − 3(2 − x) = 4)/ mx + c = k(x − a)(7x + 9 = 3(x − 1))/ x + k(ax + b) = c(チャレンジテスト)
 *   ★3: c − k(x − a) = mx + n(2 − 4(x − 1) = 2x − 18)/ かっこ 2 つ k(x + a) = m(x + b)/ k(ax + b) = mx + n
 */
function genParen(rng: Rng, d: Difficulty): Problem {
  const id = 'g1.eq.paren';
  const hint = 'まず かっこを はずそう(分配法則)。それから 移項';
  const ok = (n: number, max = 40) => n !== 0 && Math.abs(n) <= max;
  for (;;) {
    if (d === 1) {
      const k = rng.int(2, 5);
      const a = rng.nonZero(6);
      if (rng.bool(0.4)) {
        const x = rng.int(1, 9);
        if (x + a === 0) continue;
        return sidesProblem(d, id, [{ t: 'p', k, a: 1, b: a }], [{ t: 'n', c: k * (x + a) }], hint, ['eq_paren']);
      }
      const x = rng.nonZero(9);
      const m = rng.nonZero(4);
      if (k + m === 0) continue;
      const c = k * (x + a) + m * x;
      if (!ok(c)) continue;
      return sidesProblem(d, id, [{ t: 'p', k, a: 1, b: a }, { t: 'x', c: m }], [{ t: 'n', c }], hint, ['eq_paren', 'eq_paren_out']);
    }
    const x = rng.nonZero(9);
    const form = d === 2 ? rng.int(0, 3) : rng.int(4, 6);
    if (form === 0) {
      // c + k(x − a) = d
      const c0 = rng.int(1, 9);
      const k = rng.int(2, 5);
      const a = rng.nonZero(6);
      const r = c0 + k * (x + a);
      if (!ok(r)) continue;
      return sidesProblem(d, id, [{ t: 'n', c: c0 }, { t: 'p', k, a: 1, b: a }], [{ t: 'n', c: r }], hint, ['eq_paren', 'eq_paren_out']);
    }
    if (form === 1) {
      // mx − k(b − x) = c(かっこの 中が 数から)
      const m = rng.int(1, 5);
      const k = -rng.int(2, 4);
      const b = rng.int(1, 6);
      const r = m * x + k * (b - x);
      if (!ok(r) || m - k === 0) continue;
      return sidesProblem(d, id, [{ t: 'x', c: m }, { t: 'p', k, a: -1, b, rev: true }], [{ t: 'n', c: r }], hint, ['eq_paren', 'eq_paren_out']);
    }
    if (form === 2) {
      // mx + c = k(x − a)(かっこが 右辺)
      const m = rng.int(2, 9);
      const k = rng.int(2, 5);
      const a = rng.nonZero(6);
      if (m === k) continue;
      const c = k * (x + a) - m * x;
      if (!ok(c)) continue;
      return sidesProblem(d, id, [{ t: 'x', c: m }, { t: 'n', c }], [{ t: 'p', k, a: 1, b: a }], hint, ['eq_paren', 'eq_paren_right']);
    }
    if (form === 3) {
      // x + k(ax + b) = c
      const k = rng.int(2, 4);
      const a = rng.int(1, 3);
      const b = rng.nonZero(6);
      const c = x + k * (a * x + b);
      if (!ok(c)) continue;
      return sidesProblem(d, id, [{ t: 'x', c: 1 }, { t: 'p', k, a, b }], [{ t: 'n', c }], hint, ['eq_paren', 'eq_paren_out']);
    }
    if (form === 4) {
      // c − k(x − a) = mx + n
      const c0 = rng.int(1, 9);
      const k = -rng.int(2, 5);
      const a = rng.nonZero(6);
      const m = rng.nonZero(5);
      if (k === m) continue;
      const n = c0 + k * (x + a) - m * x;
      if (!ok(n)) continue;
      return sidesProblem(d, id, [{ t: 'n', c: c0 }, { t: 'p', k, a: 1, b: a }], [{ t: 'x', c: m }, { t: 'n', c: n }], hint, ['eq_paren', 'eq_paren_both']);
    }
    if (form === 5) {
      // k(x + a) = m(x + b)
      const k = rng.nonZero(6, 2);
      const m = rng.nonZero(6, 2);
      if (k === m) continue;
      const a = rng.nonZero(6);
      const bNum = k * (x + a) - m * x;
      if (bNum % m !== 0) continue;
      const b = bNum / m;
      if (!ok(b, 12) || b === a) continue;
      return sidesProblem(d, id, [{ t: 'p', k, a: 1, b: a }], [{ t: 'p', k: m, a: 1, b }], hint, ['eq_paren', 'eq_paren_two']);
    }
    // k(ax + b) = mx + n(k は 負の数も)
    const k = rng.nonZero(5, 2);
    const a = rng.int(2, 4);
    const b = rng.nonZero(6);
    const m = rng.nonZero(9);
    if (k * a === m || Math.abs(k * a - m) > 15) continue;
    const n = k * (a * x + b) - m * x;
    if (!ok(n, 50)) continue;
    return sidesProblem(d, id, [{ t: 'p', k, a, b }], [{ t: 'x', c: m }, { t: 'n', c: n }], hint, ['eq_paren', 'eq_paren_both']);
  }
}

// ---------------------------------------------------------------- 小数・分数

/**
 * 小数・分数の 係数(分数ゴースト)。教科書の 1 節 3 の 例題 2・3、問 2・3、章の問題 A。
 *   ★1: 小数で 片方の辺だけ x(0.5x − 0.3 = 4.2)/ x/p + a = b
 *   ★2: 小数第 2 位(0.12x − 0.28 = 0.8)/ ⅓x − 4 = ⅕x のように 両辺に x(解は 30 まで)/ (a/p)x + b = c
 *   ★3: 数の項も 分数(⅔x + ½ = ½x − ⅙)/ (2x − 1)/3 = (x + 3)/2、(x − 4)/3 = (1/7)x / 小数で 両辺に x(1.1x + 1.4 = 3 − 0.5x)
 */
function genFraction(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    if (rng.bool()) {
      const A = rng.int(2, 9);
      const B = rng.nonZero(19);
      const x = rng.int(1, 9);
      return decimalProblem(d, A, B, 0, A * x + B, 10);
    }
    const p = rng.int(2, 5);
    const x = p * rng.int(1, Math.floor(12 / p));
    const a = rng.nonZero(9);
    return fracProblem(d, [{ t: 'x', c: fr(1, p), over: true }, { t: 'n', c: fr(a) }], [{ t: 'n', c: fr(x / p + a) }]);
  }
  if (d === 2) {
    const form = rng.int(0, 2);
    if (form === 0) {
      // 小数第 2 位(片方の 辺だけ x)
      for (;;) {
        const A = rng.pick([4, 5, 6, 8, 12, 15, 25, 35]);
        const B = rng.nonZero(9) * rng.pick([2, 4, 5]);
        const x = rng.int(1, 12);
        const C = A * x + B;
        if (C <= 0 || C % 2 !== 0 || C > 900) continue;
        return decimalProblem(d, A, B, 0, C, 100);
      }
    }
    if (form === 1) {
      // (1/p)x + a = (1/q)x + b(数の項は 片方だけの ことも)
      const [p, q] = rng.shuffle([2, 3, 4, 5, 6]).slice(0, 2);
      const L = lcm(p, q);
      const x = L * rng.nonZero(Math.max(1, Math.floor(30 / L)));
      const a = rng.bool(0.3) ? 0 : rng.nonZero(6);
      const b = x / p + a - x / q;
      if (b === 0 && a === 0) return genFraction(rng, d);
      const over = rng.bool();
      const left: FSide = [{ t: 'x', c: fr(1, p), over }, ...(a ? [{ t: 'n' as const, c: fr(a) }] : [])];
      const right: FSide = [{ t: 'x', c: fr(1, q), over }, ...(b ? [{ t: 'n' as const, c: fr(b) }] : [])];
      return fracProblem(d, left, right);
    }
    // (n/p)x + b = c
    let num: number, p: number;
    do {
      num = rng.int(2, 5);
      p = rng.int(2, 6);
    } while (gcd(num, p) !== 1);
    const x = p * rng.nonZero(Math.max(1, Math.floor(12 / p)));
    const b = rng.nonZero(9);
    return fracProblem(d, [{ t: 'x', c: fr(num, p) }, { t: 'n', c: fr(b) }], [{ t: 'n', c: fr((num * x) / p + b) }]);
  }
  const form = rng.pick([0, 0, 1, 1, 2, 3]);
  if (form === 0) {
    // 数の項も 分数: αx + γ = βx + δ
    for (;;) {
      const den = [2, 3, 4, 6];
      const al = fr(rng.nonZero(3), rng.pick(den));
      const be = fr(rng.nonZero(3), rng.pick(den));
      if (al.n * be.d === be.n * al.d || Math.abs(al.n) >= al.d || Math.abs(be.n) >= be.d) continue;
      const x = rng.nonZero(12);
      const ga = fr(rng.nonZero(5), rng.pick(den));
      const de = frSub(frAdd(frMul(al, fr(x)), ga), frMul(be, fr(x)));
      if (de.n === 0 || de.d > 6 || Math.abs(de.n) > 9 || frIsInt(ga)) continue;
      // 右辺の 数も 真分数か 整数(⅙、−1 など)
      if (!frIsInt(de) && Math.abs(de.n) >= de.d) continue;
      const over = rng.bool(0.3);
      return fracProblem(d, [{ t: 'x', c: al, over }, { t: 'n', c: ga }], [{ t: 'x', c: be, over }, { t: 'n', c: de }]);
    }
  }
  if (form === 1) {
    // (a1 x + b1)/p = (a2 x + b2)/q、または (x + b)/p = (1/q)x
    for (;;) {
      const [p, q] = rng.shuffle([2, 3, 4, 5, 6, 7]).slice(0, 2);
      if (rng.bool(0.3)) {
        // (x − 4)/3 = (1/7)x
        const x = q * rng.int(1, Math.floor(30 / q));
        const b = (p * x) / q - x;
        if (!Number.isInteger(b) || b === 0 || Math.abs(b) > 12) continue;
        return fracProblem(d, [{ t: 'q', a: 1, b, p }], [{ t: 'x', c: fr(1, q) }]);
      }
      const a1 = rng.int(1, 3);
      const a2 = rng.int(1, 3);
      if (q * a1 === p * a2) continue;
      const x = rng.nonZero(12);
      const b1 = rng.nonZero(9);
      const b2Num = q * (a1 * x + b1) - p * a2 * x;
      if (b2Num % p !== 0) continue;
      const b2 = b2Num / p;
      if (b2 === 0 || Math.abs(b2) > 12) continue;
      return fracProblem(d, [{ t: 'q', a: a1, b: b1, p }], [{ t: 'q', a: a2, b: b2, p: q }]);
    }
  }
  if (form === 2) {
    // 小数で 両辺に x(右辺は 数から 始まる こともある: 1.1x + 1.4 = 3 − 0.5x)
    for (;;) {
      const x = rng.nonZero(9);
      const A = rng.nonZero(19, 2);
      const C = rng.nonZero(9);
      if (A === C || A % 10 === 0) continue;
      const B = rng.nonZero(30);
      const E = (A - C) * x + B;
      if (E === 0 || Math.abs(E) > 60) continue;
      return decimalProblem(d, A, B, C, E, 10, rng.bool());
    }
  }
  // 1/p x + a = 1/q x + b の 数を 大きく(⅓x − 4 = ⅕x、½x + 5 = ⅕x − 1)
  const [p, q] = rng.shuffle([2, 3, 4, 5, 6]).slice(0, 2);
  const L = lcm(p, q);
  const x = L * rng.nonZero(Math.max(1, Math.floor(36 / L)));
  const a = rng.nonZero(9);
  const b = x / p + a - x / q;
  if (b === 0) return genFraction(rng, d);
  return fracProblem(d, [{ t: 'x', c: fr(1, p) }, { t: 'n', c: fr(a) }], [{ t: 'x', c: fr(1, q) }, { t: 'n', c: fr(b) }]);
}

/**
 * 小数の 係数: (A x + B) / s = (C x + E) / s(s = 10 か 100)。両辺を s 倍して 整数の 方程式に する。
 * rightConstFirst なら 右辺を 数から 書く(3 − 0.5x)
 */
function decimalProblem(d: Difficulty, A: number, B: number, C: number, E: number, s: number, rightConstFirst = false): Problem {
  const dterm = (n: number, x: boolean, first: boolean): string => {
    const v = dec(Math.abs(n), s);
    const body = x ? (v === '1' ? 'x' : `${v}x`) : v;
    return first ? `${n < 0 ? '-' : ''}${body}` : ` ${n < 0 ? '-' : '+'} ${body}`;
  };
  const left = `${dterm(A, true, true)}${dterm(B, false, false)}`;
  const right = C === 0 ? dec(E, s) : rightConstFirst ? `${dterm(E, false, true)}${dterm(C, true, false)}` : `${dterm(C, true, true)}${dterm(E, false, false)}`;
  const eq = `${left} = ${right}`;
  const L: Side = [{ t: 'x', c: A }, { t: 'n', c: B }];
  const R: Side = C === 0 ? [{ t: 'n', c: E }] : rightConstFirst ? [{ t: 'n', c: E }, { t: 'x', c: C }] : [{ t: 'x', c: C }, { t: 'n', c: E }];
  return eqProblem({
    d,
    id: 'g1.eq.fraction',
    eq,
    answer: rat(E - B, A - C),
    hint: `両辺を ${s} 倍して 小数を 消そう(すべての 項に ${s} を かける)`,
    explanation: [eq, ...solveSteps(L, R, `(両辺を ${s} 倍する)`)],
    // 左辺の 数の項に s を かけ忘れた: Ax + B/s = Cx + E
    mistakes: [mistakeNum(rat(s * E - B, s * (A - C)), `両辺を ${s} 倍するときは、数の項にも ${s} を かけるよ`)],
    tags: s === 100 ? ['eq_decimal', 'eq_decimal_hundredths'] : ['eq_decimal'],
    key: `eqd:${eq}`,
    verify: verifyOf(L, R),
  });
}

/** 分数の 係数の 項。over なら x/p と 書く(係数が 1/p のとき)。q は 分子が 1 次式の 分数 (ax + b)/p */
type FTerm = { t: 'x'; c: Fr; over?: boolean } | { t: 'n'; c: Fr } | { t: 'q'; a: number; b: number; p: number };
type FSide = FTerm[];

function fracTermTex(t: FTerm, first: boolean): string {
  const sg = (neg: boolean) => (first ? (neg ? '-' : '') : neg ? ' - ' : ' + ');
  if (t.t === 'q') return `${first ? '' : ' + '}\\frac{${lin(t.a, t.b)}}{${t.p}}`;
  const neg = t.c.n < 0;
  const n = Math.abs(t.c.n);
  if (t.t === 'n') return `${sg(neg)}${t.c.d === 1 ? n : `\\frac{${n}}{${t.c.d}}`}`;
  if (t.c.d === 1) return `${sg(neg)}${n === 1 ? 'x' : `${n}x`}`;
  return `${sg(neg)}${t.over && n === 1 ? `\\frac{x}{${t.c.d}}` : `\\frac{${n}}{${t.c.d}}x`}`;
}
const fracSideTex = (s: FSide): string => s.map((t, i) => fracTermTex(t, i === 0)).join('');
const fracDens = (s: FSide): number[] => s.map((t) => (t.t === 'q' ? t.p : t.c.d));
/** 両辺に L を かけて 整数の 式に */
const scaleSide = (s: FSide, L: number): Side =>
  s.map((t): Term => (t.t === 'q' ? { t: 'p', k: L / t.p, a: t.a, b: t.b } : { t: t.t, c: (t.c.n * L) / t.c.d }));

/** 分数の 係数の 方程式。両辺に 分母の 最小公倍数を かけて(分母を はらって)解く */
function fracProblem(d: Difficulty, left: FSide, right: FSide): Problem {
  const L = [...fracDens(left), ...fracDens(right)].reduce(lcm, 1);
  const eq = `${fracSideTex(left)} = ${fracSideTex(right)}`;
  const Ls = scaleSide(left, L);
  const Rs = scaleSide(right, L);
  // かっこが 係数 1 の とき((x − 4) × 1)は かっこを 付けない
  const tidy = (s: Side): Side => s.flatMap((t): Term[] => (t.t === 'p' && t.k === 1 ? flat([t]) : [t]));
  const Lt = tidy(Ls);
  const Rt = tidy(Rs);
  // 分母を はらうとき 数の項に かけ忘れた(x の 項だけ L 倍)
  const forgot = (s: FSide): { x: number; n: Fr } =>
    s.reduce(
      (v, t) =>
        t.t === 'q' ? { x: v.x + (L / t.p) * t.a, n: frAdd(v.n, fr(t.b)) } : t.t === 'x' ? { x: v.x + (t.c.n * L) / t.c.d, n: v.n } : { x: v.x, n: frAdd(v.n, t.c) },
      { x: 0, n: fr(0) },
    );
  const fl = forgot(left);
  const frr = forgot(right);
  const wrongN = frSub(frr.n, fl.n);
  const mistakes: Mistake[] = fl.x !== frr.x ? [mistakeNum(rat(wrongN.n, wrongN.d * (fl.x - frr.x)), `分母を はらうときは、数の項にも ${L} を かけるよ`)] : [];
  const hasQ = [...left, ...right].some((t) => t.t === 'q');
  return eqProblem({
    d,
    id: 'g1.eq.fraction',
    eq,
    answer: rat(sumN(Rt) - sumN(Lt), sumX(Lt) - sumX(Rt)),
    hint: hasQ ? `両辺に ${L} を かけよう。分子の 式は かっこに 入れたまま かける` : `両辺に ${L}(分母の 最小公倍数)を かけて 分母を はらおう`,
    explanation: [eq, ...solveSteps(Lt, Rt, `(両辺に ${L} を かけて 分母を はらう)`)],
    mistakes,
    tags: hasQ ? ['eq_fraction', 'eq_fraction_paren'] : [...left, ...right].some((t) => t.t === 'n' && t.c.d !== 1) ? ['eq_fraction', 'eq_fraction_const'] : ['eq_fraction'],
    key: `eqf:${eq}`,
    verify: verifyOf(Ls, Rs),
  });
}

// ---------------------------------------------------------------- 比例式

/**
 * 比例式(比のカニ)。教科書の 2 節 2「比例式の利用」の 例 1・問 2、基本の問題・章の問題。
 *   ★1: x が どこか 1 か所(x : 10 = 3 : 2、16 : x = 12 : 9)。数は 40 まで
 *   ★2: ★1 の 数を 60 まで / 半分は (x ± m) が 1 か所(8 : 6 = (x − 6) : 18、(x − 2) : 3 = 4 : 2)
 *   ★3: 両方に x(2x : (x − 2) = 15 : 6、(12 + x) : (31 + x) = 1 : 2、4 : 5 = (x − 3) : (5 + x))
 */
function genRatio(rng: Rng, d: Difficulty): Problem {
  const id = 'g1.eq.ratio';
  const hint = '外側どうし、内側どうしの 積が 等しい。a : b = c : d なら ad = bc';
  if (d === 3) {
    // (a1 x + b1) : (a2 x + b2) = p : q
    for (;;) {
      const a1 = rng.pick([1, 1, 2]);
      const a2 = 1;
      const x = rng.int(2, 30);
      const b1 = a1 === 2 ? 0 : rng.int(-6, 15);
      const b2 = rng.int(-6, 31);
      const v1 = a1 * x + b1;
      const v2 = a2 * x + b2;
      if (v1 <= 0 || v2 <= 0 || v1 === v2 || (b1 === 0 && a1 === 1)) continue;
      const g = gcd(v1, v2);
      const t = rng.pick([1, 1, 2, 3]);
      if (v1 / g > 6 || v2 / g > 6) continue;
      const p = (v1 / g) * t;
      const q = (v2 / g) * t;
      if (p > 20 || q > 20 || q * a1 === p * a2) continue;
      // 左の 比に x が 2 つ / 右の 比に x が 2 つ
      // (5 + x) のように 数から 書く ことも ある(教科書の (12 + x) : (31 + x))
      const rev1 = a1 === 1 && b1 > 0 && rng.bool(0.4);
      const rev2 = b2 > 0 && rng.bool(0.4);
      const ex = (a: number, b: number, rev: boolean) => (b === 0 ? coef(a) : rev ? `(${b} + x)` : `(${lin(a, b)})`);
      const xLeft = rng.bool(0.6);
      const ratioX = `${ex(a1, b1, rev1)} : ${ex(a2, b2, rev2)}`;
      const eq = xLeft ? `${ratioX} = ${p} : ${q}` : `${p} : ${q} = ${ratioX}`;
      // 外側の積 = 内側の積
      const t1: Term = { t: 'p', k: q, a: a1, b: b1, rev: rev1 };
      const t2: Term = { t: 'p', k: p, a: a2, b: b2, rev: rev2 };
      const left: Side = xLeft ? [t1] : [t2];
      const right: Side = xLeft ? [t2] : [t1];
      const prod = (k: number, a: number, b: number, rev: boolean) => (b === 0 ? `${k} \\times ${coef(a)}` : `${k}${ex(a, b, rev)}`);
      const first = xLeft ? `${prod(q, a1, b1, rev1)} = ${prod(p, a2, b2, rev2)}` : `${prod(p, a2, b2, rev2)} = ${prod(q, a1, b1, rev1)}`;
      const p0 = sidesProblem(d, id, left, right, hint, ['eq_ratio', 'eq_ratio_both'], eq, [`${first} \\quad ${text('(外側の積 = 内側の積)')}`]);
      // 1 行目(かっこの 式)は 上に 書いたので、solveSteps の 1 行目は 省く
      p0.explanation.splice(1, 1);
      return p0;
    }
  }
  if (d === 2 && rng.bool()) {
    // (x ± m) が 1 か所
    for (;;) {
      const p = rng.int(2, 9);
      const q = rng.int(2, 9);
      if (p === q) continue;
      const t1 = rng.int(1, 3);
      const t2 = rng.int(2, 6);
      const nums = [p * t1, q * t1, p * t2, q * t2];
      if (t1 === t2 || Math.max(...nums) > 40) continue;
      const hole = rng.int(0, 3);
      const v = nums[hole];
      const m = rng.nonZero(8);
      const x = v - m;
      if (x <= 0) continue;
      const show = nums.map((n, i) => (i === hole ? `(${lin(1, m)})` : String(n)));
      const eq = `${show[0]} : ${show[1]} = ${show[2]} : ${show[3]}`;
      // 外側の積 = 内側の積 → x の ある 積を 左辺に
      const outerHas = hole === 0 || hole === 3;
      const partner = nums[3 - hole];
      const other = outerHas ? nums[1] * nums[2] : nums[0] * nums[3];
      const left: Side = [{ t: 'p', k: partner, a: 1, b: m }];
      const right: Side = [{ t: 'n', c: other }];
      const first = `${partner}(${lin(1, m)}) = ${outerHas ? `${nums[1]} \\times ${nums[2]}` : `${nums[0]} \\times ${nums[3]}`} \\quad ${text('(外側の積 = 内側の積)')}`;
      const p0 = sidesProblem(d, id, left, right, 'かっこごと 1 つの数と 思って、外側どうし・内側どうしの 積を 等しく おく', ['eq_ratio', 'eq_ratio_expr'], eq, [first]);
      p0.explanation.splice(1, 1);
      return p0;
    }
  }
  // a : b = c : e で 1 か所が x
  const max = d === 1 ? 40 : 60;
  for (;;) {
    const p = rng.int(1, 9);
    const q = rng.int(2, 9);
    if (p === q) continue;
    const t1 = rng.int(1, 4);
    const t2 = rng.int(2, 10);
    if (t1 === t2) continue;
    const nums = [p * t1, q * t1, p * t2, q * t2];
    if (Math.max(...nums) > max) continue;
    // 前の比と 後の比を 入れかえる(x : 10 = 3 : 2 のように 大きい 数の 比が 前)
    const ns = rng.bool() ? nums : [nums[2], nums[3], nums[0], nums[1]];
    const hole = rng.int(0, 3);
    const value = ns[hole];
    const show = ns.map((v, i) => (i === hole ? 'x' : String(v)));
    const eq = `${show[0]} : ${show[1]} = ${show[2]} : ${show[3]}`;
    const outerHasX = hole === 0 || hole === 3;
    const xCoef = ns[3 - hole];
    const other = outerHasX ? ns[1] * ns[2] : ns[0] * ns[3];
    const outer = `${show[0]} \\times ${show[3]}`;
    const inner = `${show[1]} \\times ${show[2]}`;
    // 外どうし・内どうしを まちがえて かけた(a × c = b × e)
    const [a, b, c, e] = ns;
    const wrongPair = [rat(b * e, c), rat(a * c, e), rat(b * e, a), rat(a * c, b)][hole];
    return {
      templateId: id,
      difficulty: d,
      prompt: `${eq} \\quad ${text('x を求めよ')}`,
      promptText: `${eq} の x を求めよ`,
      answer: { kind: 'number', value: rat(value) },
      hint,
      explanation: [`${outerHasX ? outer : inner} = ${outerHasX ? inner : outer} \\quad ${text('(外側の積 = 内側の積)')}`, `${xCoef}x = ${other}`, `x = ${value}`, answerLine(value)],
      mistakes: [mistakeNum(wrongPair, `かけるのは 外側どうし(${show[0]} と ${show[3]})と 内側どうし(${show[1]} と ${show[2]})だよ`)],
      tags: ['eq_ratio'],
      key: `eqr:${eq}`,
      verify: hole === 0 ? `${b}*${c}/${e}` : hole === 1 ? `${a}*${e}/${c}` : hole === 2 ? `${a}*${e}/${b}` : `${b}*${c}/${a}`,
    };
  }
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
 * 文章題。教科書の 2 節「1 次方程式の利用」「比例式の利用」の 場面:
 *   ★1: ある数(x を 3 倍して 5 を たすと 26)/ 代金(ペン n 本と ノート)/ テープを 分ける(姉が 50 cm 長い)
 *   ★2: 2 品の 個数と 代金(90 円と 140 円を 合わせて 15 個で 1800 円)/ 過不足(配る)/ 比例式(ソース 2 : 3、ケチャップ 120 mL)
 *   ★3: 追いつく(速さ)/ 値段と 持っている 金額(5 本だと 150 円 たりない、4 本だと 80 円 余る)/ 比例式(合計を 3 : 5 に 分ける)
 * 解は どれも 整数(速さも 割りきれる 数を 選ぶ)
 */
function wordCase(rng: Rng, d: Difficulty): WordCase {
  const kind = d === 1 ? rng.pick(['number', 'two', 'tape']) : d === 2 ? rng.pick(['count', 'share', 'ratio']) : rng.pick(['speed', 'money', 'ratioTotal']);
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
  if (kind === 'tape') {
    // 姉と 弟で 分ける。弟の 長さを x
    const x = rng.int(4, 15) * 10;
    const diff = rng.int(1, 6) * 10;
    const total = 2 * x + diff;
    return {
      story: `${total} cm の テープを 姉と 弟で 分ける。姉の ほうが ${diff} cm 長く なるように する。弟の 長さを x cm と する`,
      equation: `x + (x + ${diff}) = ${total}`,
      wrong: [`x + (x - ${diff}) = ${total}`, `x + ${diff} = ${total}`, `2x = ${total} + ${diff}`],
      answer: x,
      unit: 'cm',
      verify: `(${total}-${diff})/2`,
      steps: [`2x + ${diff} = ${total}`, `2x = ${total - diff}`, `x = ${x}`],
    };
  }
  if (kind === 'count') {
    // 安い品物の 個数を x: p1 x + p2(n − x) = T
    for (;;) {
      const [p1, p2] = rng.shuffle([30, 60, 90, 120, 140, 150, 250]).slice(0, 2).sort((u, v) => u - v);
      const n = rng.int(8, 15);
      const x = rng.int(2, n - 2);
      const T = p1 * x + p2 * (n - x);
      if (T % 10 !== 0) continue;
      return {
        story: `1 個 ${p1} 円の おかしと 1 個 ${p2} 円の おかしを 合わせて ${n} 個 買ったら、代金の 合計は ${T} 円だった。${p1} 円の おかしの 個数を x 個 とする`,
        equation: `${p1}x + ${p2}(${n} - x) = ${T}`,
        wrong: [`${p1}x + ${p2}x = ${T}`, `${p2}x + ${p1}(${n} - x) = ${T}`, `${p1}x + ${p2}(x - ${n}) = ${T}`],
        answer: x,
        unit: '個',
        verify: `(${T}-${p2}*${n})/(${p1}-${p2})`,
        steps: [`${p1}x + ${p2 * n} - ${p2}x = ${T}`, `${p1 - p2}x = ${T - p2 * n}`, `x = ${x}`],
      };
    }
  }
  if (kind === 'share') {
    // 過不足: a 枚ずつ 配ると s 枚 たりない、b 枚ずつ 配ると e 枚 余る → ax − s = bx + e
    const b = rng.int(2, 5);
    const a = b + 1;
    const s = rng.int(2, 12);
    let e = rng.int(2, 15);
    // たりない数と 余る数が 同じだと 選択肢が 重なる
    if (e === s) e++;
    const people = s + e;
    return {
      story: `折り紙を 何人かの 子どもに 配る。1 人に ${a} 枚ずつ 配ると ${s} 枚 たりない。1 人に ${b} 枚ずつ 配ると ${e} 枚 余る。子どもの 人数を x 人 とする`,
      equation: `${a}x - ${s} = ${b}x + ${e}`,
      wrong: [`${a}x + ${s} = ${b}x - ${e}`, `${a}x - ${s} = ${b}x - ${e}`, `${a}x - ${e} = ${b}x + ${s}`],
      answer: people,
      unit: '人',
      verify: `(${e}+${s})/(${a}-${b})`,
      steps: [`${a}x - ${b}x = ${e} + ${s}`, `x = ${people}`],
    };
  }
  if (kind === 'ratio') {
    // ソースと ケチャップを p : q で 混ぜる。ケチャップ K mL のとき ソース x mL
    for (;;) {
      const [p, q] = rng.pick([
        [2, 3],
        [3, 4],
        [2, 5],
        [3, 5],
        [4, 5],
      ]);
      const K = q * rng.int(4, 40);
      const x = (p * K) / q;
      if (K > 300 || K % 10 !== 0) continue;
      return {
        story: `ソースと ケチャップを ${p} : ${q} の 割合で 混ぜる。ケチャップを ${K} mL 使うとき、ソースを x mL とする`,
        equation: `x : ${K} = ${p} : ${q}`,
        wrong: [`x : ${K} = ${q} : ${p}`, `${K} : x = ${p} : ${q}`, `x : ${p} = ${q} : ${K}`],
        answer: x,
        unit: 'mL',
        verify: `${K}*${p}/${q}`,
        steps: [`x \\times ${q} = ${K} \\times ${p}`, `${q}x = ${K * p}`, `x = ${x}`],
      };
    }
  }
  if (kind === 'speed') {
    // 追いつく: 弟が 出て t 分後に 兄が 追いかける。v1(x + t) = v2 x → 割りきれる 数を 選ぶ
    for (;;) {
      const v1 = rng.pick([50, 60, 70, 80]);
      const t = rng.int(3, 10);
      const x = rng.int(2, 12);
      const v2 = (v1 * (x + t)) / x;
      if (!Number.isInteger(v2) || v2 % 10 !== 0 || v2 > 250) continue;
      const bike = v2 > 120;
      return {
        story: `弟が 家を 出て 分速 ${v1} m で 歩いた。その ${t} 分後に 兄が 家を 出て、${bike ? '自転車で ' : ''}分速 ${v2} m で 同じ道を 追いかけた。兄が 家を 出てから 追いつくまでの 時間を x 分 とする`,
        equation: `${v1}(x + ${t}) = ${v2}x`,
        wrong: [`${v1}x = ${v2}(x + ${t})`, `${v1}(x - ${t}) = ${v2}x`, `${v1}x + ${t} = ${v2}x`],
        answer: x,
        unit: '分',
        verify: `(${v1}*${t})/(${v2}-${v1})`,
        steps: [`${v1}x + ${v1 * t} = ${v2}x`, `${v1}x - ${v2}x = -${v1 * t}`, `-${v2 - v1}x = -${v1 * t}`, `x = ${x}`],
      };
    }
  }
  if (kind === 'money') {
    // 値段と 持っている 金額: n1 本 買うには s 円 たりない、n2 本 なら e 円 余る → n1 x − s = n2 x + e
    for (;;) {
      const n2 = rng.int(3, 6);
      const n1 = n2 + 1;
      const x = rng.int(10, 30) * 10;
      const s = rng.int(1, 25) * 10;
      const e = x - s;
      if (e <= 0 || e === s) continue;
      return {
        story: `同じ 値段の 花を 買う。${n1} 本 買うには 持っている お金では ${s} 円 たりず、${n2} 本 買うと ${e} 円 余る。花 1 本の 値段を x 円 とする`,
        equation: `${n1}x - ${s} = ${n2}x + ${e}`,
        wrong: [`${n1}x + ${s} = ${n2}x - ${e}`, `${n1}x - ${s} = ${n2}x - ${e}`, `${n1}x - ${e} = ${n2}x + ${s}`],
        answer: x,
        unit: '円',
        verify: `(${e}+${s})/(${n1}-${n2})`,
        steps: [`${n1}x - ${n2}x = ${e} + ${s}`, `x = ${x}`],
      };
    }
  }
  // 合計を p : q に 分ける(ミルクティーを 1200 mL、牛乳と 紅茶を 3 : 5)
  for (;;) {
    const [p, q] = rng.pick([
      [1, 2],
      [1, 3],
      [2, 3],
      [3, 5],
      [3, 4],
    ]);
    const unit = rng.int(2, 25) * 10;
    const total = (p + q) * unit;
    if (total > 1500) continue;
    const x = p * unit;
    return {
      story: `牛乳と 紅茶を ${p} : ${q} の 割合で 混ぜて、ミルクティーを ${total} mL 作る。牛乳を x mL とする`,
      equation: `x : (${total} - x) = ${p} : ${q}`,
      wrong: [`x : ${total} = ${p} : ${q}`, `x : (${total} - x) = ${q} : ${p}`, `(${total} - x) : x = ${p} : ${q}`],
      answer: x,
      unit: 'mL',
      verify: `${total}*${p}/(${p}+${q})`,
      steps: [`${q}x = ${p}(${total} - x)`, `${q}x = ${p * total} - ${p}x`, `${p + q}x = ${p * total}`, `x = ${x}`],
    };
  }
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
