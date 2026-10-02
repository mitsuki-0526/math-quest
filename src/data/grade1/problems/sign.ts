import { mistakeNum, registerTemplate, type Difficulty, type Mistake, type Problem, type ProblemTemplate } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat, add, sub, mul, div, pow, neg, toTex, toNumber, toString } from '@/math/rational';
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
 * 加減(マイナススライム)。教科書の練習問題の形に合わせ、先生の見本帳の印で直した(2026-09-27。docs/difficulty.md)。
 *   ★1: 加法・減法の 2 項。正の数も (+7) と符号つき。0 を含む式・反数どうしも出る。1 けただけ(「2けたはまだ早い」)
 *   ★2: かっこつきの数 3 つ((+3) + (−5) − (−2))が基本。ときどき かっこなしの 2〜3 項(−2 − 6、6 − 7 + 5)。
 *       2 けたは 2 回に 1 回ほど・1 つだけ(30 まで)。「数字 4 つは多い」ので 3 つまで
 *   ★3: 加法と減法の混じった 3〜4 項(項だけの式・かっこ混じり)。2 けたは 35 まで・1 問に 2 つまで。5 回に 1 回は 小数・分数
 * 2 けたの数ばかりの計算は、ボス(符号王ネガ)専用の addsub_big で出す
 */
interface AddSubToken {
  /** 先頭の項は null */
  op: '+' | '-' | null;
  /** 書かれている数(かっこの中の符号つきの数、または 項の絶対値) */
  value: number;
  /** かっこで書くか */
  paren: boolean;
}

const ADDSUB_SPEC: Record<Difficulty, { terms: number[]; bigMax: number; bigProb: number; maxBig: number; zeroProb: number }> = {
  1: { terms: [2], bigMax: 9, bigProb: 0, maxBig: 0, zeroProb: 0.12 },
  // ★2・★3 の 2 けたは 授業の プリント(第1章 84 ページ、2026-10-02)に 合わせて 増やした:
  // 加法・減法は 2 けたを ふくむ 問題が 4〜5 割(53 まで)、加減の混じった計算は 35 まで(先生の方針「★2 から 2 けたを 増やす」)
  2: { terms: [3], bigMax: 30, bigProb: 0.5, maxBig: 1, zeroProb: 0.08 },
  3: { terms: [3, 4], bigMax: 35, bigProb: 0.5, maxBig: 2, zeroProb: 0.08 },
};

/** 符号つきの項(+7, −2, 0 …)を 教科書の形に 並べる */
function addSubSignedTerms(rng: Rng, d: Difficulty): number[] {
  const spec = ADDSUB_SPEC[d];
  const n = rng.pick(spec.terms);
  const terms = Array.from({ length: n }, () => rng.nonZero(9));
  // 2 けたの数(1 問に maxBig 個まで)
  let bigs = rng.bool(spec.bigProb) ? 1 : 0;
  if (bigs && spec.maxBig > 1 && rng.bool(0.25)) bigs = 2;
  for (const i of rng.shuffle(terms.map((_, i) => i)).slice(0, bigs)) terms[i] = rng.nonZero(spec.bigMax, 10);
  // 0 を含む式((−4) + 0、0 − (−3))
  if (rng.bool(spec.zeroProb)) terms[rng.int(0, n - 1)] = 0;
  // ★1 は ときどき 反数どうし((+9) + (−9))。教科書では 1 けたなので 1 けたのときだけ
  if (d === 1 && terms[0] !== 0 && terms[1] !== 0 && Math.abs(terms[0]) < 10 && rng.bool(0.08)) terms[1] = -terms[0];
  // 負の数を 必ず含める(正の数だけでは 符号の練習にならない)
  if (!terms.some((t) => t < 0)) {
    // どの項を負にするかは ばらけさせる(先頭ばかり 負にならないように)
    const i = rng.pick(terms.map((t, k) => (t > 0 ? k : -1)).filter((k) => k >= 0));
    terms[i] = -terms[i];
  }
  return terms;
}

function genAddSubTextbook(rng: Rng, d: Difficulty): Problem {
  if (d === 3 && rng.int(0, 4) === 0) return genAddSubFraction(rng, d);
  const signedTerms = addSubSignedTerms(rng, d);
  let tokens: AddSubToken[];
  if (d === 1) {
    // (+7) + (−2) / (−4) − (−11): 2 つめの数を「ひく」ときは 符号を反対にして持つ
    const op = rng.pick(['+', '-'] as const);
    const second = op === '+' ? signedTerms[1] : -signedTerms[1];
    tokens = [
      { op: null, value: signedTerms[0], paren: signedTerms[0] !== 0 },
      { op, value: second, paren: second !== 0 },
    ];
  } else if (d === 2) {
    // 基本は かっこつきの数 3 つ((+3) + (−5) − (−2))。3 回に 1 回は かっこなしの 2〜3 項(−2 − 6、6 − 7 + 5)
    if (rng.bool(0.35)) {
      const terms = rng.bool() ? signedTerms.slice(0, 2) : signedTerms;
      if (!terms.some((t) => t < 0)) terms[terms.length - 1] = -Math.abs(terms[terms.length - 1]) || -rng.int(1, 9);
      // 「7 − 6」のように 小学校の ひき算で 済む式は 出さない。先頭が負か、答えが負になる形に(−2 − 6、6 − 7。Codex のレビュー)
      if (terms[0] >= 0 && terms.reduce((a, b) => a + b, 0) >= 0) terms[0] = -Math.abs(terms[0]) || -rng.int(1, 9);
      tokens = terms.map((t, i) => (i === 0 ? { op: null, value: t, paren: false } : { op: t < 0 ? '-' : '+', value: Math.abs(t), paren: false }));
    } else {
      tokens = signedTerms.map((t, i) => {
        if (i === 0) return { op: null, value: t, paren: t !== 0 };
        const op = rng.pick(['+', '-'] as const);
        const v = op === '+' ? t : -t;
        return { op, value: v, paren: v !== 0 };
      });
    }
  } else {
    // 半分は 項だけの式(6 − 7 + 5 − 2)、半分は かっこ混じり(−1 − (−3) − 5、10 + (−15) − (−13) − 23)
    const termOnly = rng.bool();
    tokens = signedTerms.map((t, i) => {
      if (i === 0) return { op: null, value: t, paren: false };
      // かっこ混じりの式では 多めに かっこを使う(教科書の問3は 6 問中 4 問に かっこがある)
      if (termOnly || rng.bool(0.3)) return { op: t < 0 ? '-' : '+', value: Math.abs(t), paren: false };
      // かっこで書く: + (−15) / − (−13)。− のときは 符号を反対にして持つ
      const op = rng.pick(['+', '-'] as const);
      const v = op === '+' ? t : -t;
      return v < 0 ? { op, value: v, paren: true } : { op: t < 0 ? '-' : '+', value: Math.abs(t), paren: false };
    });
  }
  const show = (tk: AddSubToken) => {
    const num = tk.paren ? `(${tk.value > 0 ? '+' : ''}${tk.value})` : `${tk.value}`;
    return tk.op ? ` ${tk.op} ${num}` : num;
  };
  const tex = tokens.map(show).join('');
  const plain = plainMinus(tex);
  const value = tokens.reduce((s, tk) => (tk.op === '-' ? s - tk.value : s + tk.value), 0);
  const asTerms = tokens.map((tk) => (tk.op === '-' ? -tk.value : tk.value));

  const negs = asTerms.filter((t) => t < 0);
  const explanation = addSubSteps(tex, tokens, asTerms, value);

  // よくある まちがい(その子に合った 一言を 出す)
  const mistakes: Mistake[] = [];
  tokens.forEach((tk) => {
    if (!tk.paren || tk.op === null || tk.value === 0) return;
    const a = Math.abs(tk.value);
    // −(−2) を −2 のまま / +(−5) を +5 / −(+3) を +3 と 計算した。
    // ひく項 −v を +v と 取りちがえると 答えが 2v ずれる(たす項 +v を −v なら −2v)
    const wrong = value + (tk.op === '-' ? 2 * tk.value : -2 * tk.value);
    if (tk.op === '-' && tk.value < 0) mistakes.push(mistakeNum(wrong, `−(−${a}) は +${a}。負の数を ひくときは、符号を 変えて たし算に なるよ`));
    if (tk.op === '+' && tk.value < 0) mistakes.push(mistakeNum(wrong, `+(−${a}) は −${a} と 同じ。負の数を たすと 小さく なるよ`));
    if (tk.op === '-' && tk.value > 0) mistakes.push(mistakeNum(wrong, `−(+${a}) は −${a}。正の数を ひくと 小さく なるよ`));
  });
  mistakes.push(
    mistakeNum(
      -value,
      asTerms.filter((t) => t !== 0).length > 2 ? '数の 大きさは 合ってる! 正の項の 合計と 負の項の 合計、大きいほうの 符号に なるよ' : '数の 大きさは 合ってる! 符号は 絶対値の 大きいほうの 符号に なるよ',
    ),
  );

  const tags: string[] = [];
  if (tokens.some((tk) => tk.op === '-' && tk.value < 0)) tags.push('minus_minus');
  if (negs.length >= 2) tags.push('neg_plus_neg');
  if (asTerms.includes(0)) tags.push('with_zero');
  return {
    templateId: 'g1.sign.addsub',
    difficulty: d,
    prompt: `${tex} = ?`,
    promptText: `${plain} = ?`,
    answer: { kind: 'number', value: rat(value) },
    hint:
      d === 1
        ? tokens[1].op === '-'
          ? 'ひく数の 符号を 変えて たし算に。−(−3) は +3'
          : '同じ符号なら 絶対値を たして その符号。ちがう符号なら 大きいほうから 小さいほうを ひく'
        : '正の項どうし、負の項どうしを 先に まとめてみよう。−(−3) は +3',
    explanation,
    mistakes,
    tags,
    key: `addsub:${tex}`,
    verify: tokens.map((tk) => `${tk.op ?? ''}(${tk.value})`).join(''),
  };
}

const sumOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** 項の式: −1 + 8 − 3 */
const termsTex = (ts: number[]) => ts.map((t, i) => (i === 0 ? `${t}` : t < 0 ? ` - ${-t}` : ` + ${t}`)).join('');

/**
 * 加減の解説。教科書の 手順に そろえる(先生の要望 2026-09-29「解説の手順を ていねいに」):
 *   ① ひき算を たし算に: (−1) − (−8) = (−1) + (+8)
 *   ② かっこを はずす(項だけの式に): −1 + 8
 *   ③ 正の項・負の項を まとめる: 8 + 3 − 2 − 7 = 11 − 9(項が 3 つ以上のとき)
 *   ④ 計算: 大きいほうの 絶対値から 小さいほうを ひき、大きいほうの 符号を つける
 */
function addSubSteps(tex: string, tokens: AddSubToken[], asTerms: number[], value: number): string[] {
  const steps: string[] = [];
  const signed = (v: number) => (v === 0 ? '0' : v > 0 ? `(+${v})` : `(${v})`);
  // ① かっこの前が − の数が あれば、たし算の 形に
  if (tokens.some((tk) => tk.paren && tk.op === '-')) {
    steps.push(`${text('ひき算を たし算に: ')} ${tex} = ${asTerms.map((t, i) => (i === 0 ? signed(t) : ` + ${signed(t)}`)).join('')}`);
  }
  // ② かっこを はずす
  if (tokens.some((tk) => tk.paren)) steps.push(`${text('かっこを はずす: ')} ${termsTex(asTerms)}`);
  const nz = asTerms.filter((t) => t !== 0);
  const pos = nz.filter((t) => t > 0);
  const negAbs = nz.filter((t) => t < 0).map((t) => -t);
  const P = sumOf(pos);
  const N = sumOf(negAbs);
  // ③ 正の項・負の項を まとめる(並べかえて それぞれ たす)
  if (nz.length > 2 && pos.length && negAbs.length) {
    const grouped = [...pos.map((p, i) => (i === 0 ? `${p}` : ` + ${p}`)), ...negAbs.map((n) => ` - ${n}`)].join('');
    steps.push(`${text('正の項・負の項を まとめる: ')} ${grouped} = ${P} - ${N}`);
  }
  // ④ 計算
  let calc: string;
  if (P === N && pos.length && negAbs.length) {
    // 反数どうし((+5) + (−5))は 0
    calc = `${nz.length === 2 ? termsTex(nz) : `${P} - ${N}`} = 0`;
  } else if (pos.length && negAbs.length) {
    // 符号の ちがう 2 数: 絶対値の 大きいほうから 小さいほうを ひいて、大きいほうの 符号(教科書の 書き方)
    const rule = P >= N ? `+(${P} - ${N})` : `-(${N} - ${P})`;
    calc = `${nz.length === 2 ? termsTex(nz) : `${P} - ${N}`} = ${rule} = ${value}`;
  }
  else if (negAbs.length > 1) calc = `${termsTex(nz)} = -(${negAbs.join(' + ')}) = ${value}`;
  else if (pos.length > 1) calc = `${termsTex(nz)} = ${value}`;
  else calc = `${nz.length ? termsTex(nz) : '0'} = ${value}`;
  if (nz.length < asTerms.length) steps.push(text('0 は たしても ひいても 変わらない'));
  // 0 以外の 項が 1 つなら、計算は いらない(「−6 = −6」と 書かない)
  if (nz.length > 1) steps.push(`${text('計算: ')} ${calc}`);
  steps.push(`${text('答え: ')} ${value}`);
  return steps;
}

/** ボス(符号王ネガ)専用: 50 までの 2 けたの数の加減 */
function addSubTerms(rng: Rng, d: Difficulty): number[] {
  return Array.from({ length: d === 1 ? 3 : rng.pick([3, 4]) }, () => rng.nonZero(50));
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
  const valText = decimal ? String(toNumber(value)) : toTex(value);
  // 分数は 通分した 形を 見せる(教科書の 手順)
  const lcd = decimal ? 1 : Number(nums[0].d * nums[1].d) / gcdOf(Number(nums[0].d), Number(nums[1].d));
  const common = (r: (typeof nums)[number]) => {
    const n = (Number(r.n) * lcd) / Number(r.d);
    return n < 0 ? `\\left(-\\frac{${-n}}{${lcd}}\\right)` : `\\left(+\\frac{${n}}{${lcd}}\\right)`;
  };
  const steps = [
    ...(op === '-' ? [`${text('ひき算を たし算に: ')} ${show(nums[0])} + ${show(signed)}`] : []),
    ...(!decimal && nums[0].d !== nums[1].d ? [`${text('通分する: ')} ${common(nums[0])} + ${common(signed)}`] : []),
    `${text('計算: ')} = ${valText}`,
    `${text('答え: ')} ${valText}`,
  ];
  const mistakes: Mistake[] = [mistakeNum(neg(value), '数の 大きさは 合ってる! 符号は 絶対値の 大きいほうの 符号に なるよ')];
  if (toNumber(nums[1]) < 0) {
    // −(−b) を −b のまま / +(−b) を +b と 計算した
    if (op === '-') mistakes.push(mistakeNum(add(nums[0], nums[1]), '負の数を ひくときは、符号を 変えて たし算に なるよ(−(−a) は +a)'));
    else mistakes.push(mistakeNum(sub(nums[0], nums[1]), '負の数を たすと 小さく なるよ(+(−a) は −a)'));
  }
  return {
    templateId: 'g1.sign.addsub',
    difficulty: d,
    prompt: `${tex} = ?`,
    promptText: `${plain(nums[0])} ${op === '+' ? '+' : '−'} ${plain(nums[1])} = ?`,
    answer: { kind: 'number', value },
    hint: decimal ? '小数でも 整数と 同じ。符号を 決めてから 絶対値を 計算' : '分数は 通分してから。符号の 決め方は 整数と 同じ',
    explanation: steps,
    mistakes,
    // 小数の問題の正解は 小数で 見せる(26/5 ではなく 5.2)
    ...(decimal ? { answerLabel: String(toNumber(value)) } : {}),
    tags: [decimal ? 'decimal_addsub' : 'fraction_addsub'],
    key: `addsub:frac:${tex}`,
    verify: `(${toNumber(nums[0])})${op}(${toNumber(nums[1])})`,
  };
}

function gcdOf(a: number, b: number): number {
  return b === 0 ? a : gcdOf(b, a % b);
}

function genAddSub(rng: Rng, d: Difficulty, big = false): Problem {
  if (!big) return genAddSubTextbook(rng, d);
  // ここから ボス専用(addsub_big)
  const terms = addSubTerms(rng, d);
  const ops: ('+' | '-')[] = terms.slice(1).map(() => rng.pick(['+', '-']));
  // 必ず負の数を含める(正の数だけでは符号の練習にならないため)。
  // 「− (−46)」のように ひく数が負だと 項に直したとき正になるので、演算子を ふくめた「項」で 確かめる
  // (以前は 31 + 46 + 40 のような 正の数だけの式が 出ていた。Codex のレビュー)
  const asTerm = (i: number) => (i === 0 ? terms[0] : ops[i - 1] === '+' ? terms[i] : -terms[i]);
  if (terms.every((_, i) => asTerm(i) > 0)) terms[rng.int(0, terms.length - 1)] *= -1;

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

  // 解説: 雑魚の加減と 同じ 手順(ひき算を たし算に → かっこを はずす → 正の項・負の項 → 計算)
  const signedTerms = terms.map((t, i) => (i === 0 ? t : ops[i - 1] === '+' ? t : -t));
  const tokens: AddSubToken[] = termForm
    ? signedTerms.map((t, i) => (i === 0 ? { op: null, value: t, paren: false } : { op: t < 0 ? '-' : '+', value: Math.abs(t), paren: false }))
    : terms.map((t, i) => ({ op: i === 0 ? null : ops[i - 1], value: t, paren: true }));
  const v = toNumber(value);
  const explanation = addSubSteps(tex, tokens, signedTerms, v);
  const mistakes: Mistake[] = [];
  tokens.forEach((tk) => {
    if (!tk.paren || tk.op === null) return;
    const a = Math.abs(tk.value);
    const wrong = v + (tk.op === '-' ? 2 * tk.value : -2 * tk.value);
    if (tk.op === '-' && tk.value < 0) mistakes.push(mistakeNum(wrong, `−(−${a}) は +${a}。負の数を ひくときは、符号を 変えて たし算に なるよ`));
    if (tk.op === '+' && tk.value < 0) mistakes.push(mistakeNum(wrong, `+(−${a}) は −${a} と 同じ。負の数を たすと 小さく なるよ`));
  });
  mistakes.push(mistakeNum(-v, '数の 大きさは 合ってる! 正の項の 合計と 負の項の 合計、大きいほうの 符号に なるよ'));

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
    mistakes,
    tags,
    key: `${big ? 'addsub_big' : 'addsub'}:${tex}`,
    verify: verifyExpr,
  };
}

// ---------------------------------------------------------------- 乗除

/** 乗除の 符号の まちがいへの 一言(負の数の 個数で 決まる) */
const SIGN_SAY = (k: number) => `絶対値は 合ってる! 符号を もう一度。負の数が ${k} 個 → ${k % 2 ? '奇数個なので −' : '偶数個なので +'}`;

function genMulDiv(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    // 2数の積。必ず負の数を含める。1・−1 は 10 回に 1 回ほどに(多いと 符号だけの練習に 偏る。Codex のレビュー)
    const factor = () => (rng.bool(0.1) ? rng.nonZero(9) : rng.nonZero(9, 2));
    let a = factor();
    let b = factor();
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
      mistakes: [mistakeNum(-a * b, SIGN_SAY([a, b].filter((x) => x < 0).length))],
      tags: a < 0 && b < 0 ? ['neg_times_neg'] : ['sign_of_product'],
      key: `muldiv:${a}*${b}`,
      verify: `(${a})*(${b})`,
    };
  }
  if (d === 2) {
    // 5 回に 1 回は 逆数(授業の プリント。2026-10-02)
    if (rng.int(0, 4) === 0) return genReciprocal(rng, d);
    // 割り切れる除算だけ(先生の印「★2 は わり算のみ」2026-09-27。3 数の積は ★3 へ)
    {
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
        mistakes: [mistakeNum(-q, SIGN_SAY([a, b].filter((x) => x < 0).length))],
        tags: ['sign_of_quotient'],
        key: `muldiv:${a}/${b}`,
        verify: `(${a})/(${b})`,
      };
    }
  }
  // ★3 の 4 回に 1 回は 分数の乗除(学習プリントの 3/4 × (−5/6) ÷ 15/4 の形)
  if (rng.int(0, 3) === 0) return genMulDivFraction(rng, d);
  // 5 回に 1 回は 計算しないで 符号だけを 判断する(教科書・チャレンジテストの「積の符号」。2026-09-29 追加)
  if (rng.int(0, 4) === 0) return genSignJudge(rng, d);
  // 4 回に 1 回は 小数・分数を 入れかえて 工夫する かけ算(授業の プリント「乗法の計算法則」。2026-10-02)
  if (rng.int(0, 3) === 0) return genMulLaw(rng, d);
  // ★3: 答えが整数になる ×÷ の混合(例: (−24) ÷ (−8) × 3)、または 1けたの 4数の積(docs/difficulty.md)
  const form = rng.int(0, 2);
  if (form === 2) {
    let ns: number[];
    do {
      // 3 数 または 4 数の積(3 数の積は ★2 から移した)
      ns = Array.from({ length: rng.pick([3, 4]) }, () => rng.nonZero(6));
      if (ns.every((x) => x > 0)) ns[rng.int(0, ns.length - 1)] *= -1;
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
      mistakes: [mistakeNum(-prod, SIGN_SAY(ns.filter((x) => x < 0).length))],
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
    mistakes: [
      mistakeNum(neg(value), SIGN_SAY(nums.filter((x) => x < 0).length)),
      // a ÷ b × c を a ÷ (b × c) と 計算した(× を 先に)
      ...(divFirst ? [mistakeNum(div(rat(a), rat(divisor * other)), '× と ÷ だけの 式は、左から 順に 計算するよ(× を 先に しない)')] : []),
    ],
    tags: ['count_negatives'],
    key: `muldiv:${tex}`,
    verify: divFirst ? `(${a})/(${divisor})*(${other})` : `(${a})*(${other})/(${divisor})`,
  };
}

/**
 * 積・商の符号だけを 判断する(選択式)。5〜6 個の 数の ×÷ で、計算すると 大きくなる式にして「数える」ほうが 早いと 気づかせる。
 * 累乗(−2)³ を 1 つ 入れることも ある(−2 が 3 個 と 数える)
 */
function genSignJudge(rng: Rng, d: Difficulty): Problem {
  const n = rng.int(5, 6);
  // 負の数は 2〜4 個(1 個だけだと 見た瞬間に 分かる)
  const negAt = new Set(rng.shuffle(Array.from({ length: n }, (_, i) => i)).slice(0, rng.int(2, 4)));
  const nums = Array.from({ length: n }, (_, i) => rng.int(2, 9) * (negAt.has(i) ? -1 : 1));
  const ops = nums.slice(1).map(() => (rng.bool(0.25) ? '÷' : '×'));
  const withPow = rng.bool(0.3);
  const powExp = rng.pick([2, 3]);
  // 負の数の 個数(累乗は 指数の 数だけ 数える)
  const negCount = nums.reduce((c, x, i) => c + (x < 0 ? (withPow && i === 0 ? powExp : 1) : 0), 0);
  const positive = negCount % 2 === 0;
  const TEX = { '×': '\\times', '÷': '\\div' } as const;
  const first = withPow ? `(${nums[0]})^{${powExp}}` : paren(nums[0]);
  const tex = first + nums.slice(1).map((x, i) => ` ${TEX[ops[i] as '×' | '÷']} ${paren(x)}`).join('');
  const plain = plainMinus((withPow ? `(${nums[0]})${sup(powExp)}` : paren(nums[0])) + nums.slice(1).map((x, i) => ` ${ops[i]} ${paren(x)}`).join(''));
  const options = ['\\text{正の数(+)}', '\\text{負の数(−)}'];
  const correct = positive ? 0 : 1;
  return {
    templateId: 'g1.sign.muldiv',
    difficulty: d,
    prompt: `${tex} \\quad ${text('の 答えの 符号は?(計算しなくて よい)')}`,
    promptText: `${plain} の 答えの 符号は?(計算しなくて よい)`,
    answer: { kind: 'choice', options, correct },
    hint: '負の数が いくつ あるかを 数えよう。÷ も × と 同じ。偶数個なら +、奇数個なら −',
    explanation: [
      ...(withPow && nums[0] < 0 ? [`(${nums[0]})^{${powExp}} ${text(` は ${nums[0]} を ${powExp} 回 かける → 負の数 ${powExp} 個`)}`] : []),
      `${text(`負の数は ぜんぶで ${negCount} 個 → ${positive ? '偶数個なので +' : '奇数個なので −'}`)}`,
      `${text('答え: ')} ${options[correct]}`,
    ],
    mistakes: [{ answer: { kind: 'choice', options, correct: 1 - correct }, say: `負の数を もう一度 数えよう。${withPow && nums[0] < 0 ? '累乗は かける回数だけ 数えるよ。' : ''}${negCount} 個なら ${positive ? '偶数個で +' : '奇数個で −'}` }],
    tags: ['sign_judge'],
    key: `muldiv:sign:${tex}`,
    verify: String(correct),
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
    mistakes: [
      mistakeNum(neg(value), SIGN_SAY(negatives)),
      // ÷ を 逆数に しないで そのまま かけた
      ...(ops.includes('÷') ? [mistakeNum(fs.reduce((acc, f, i) => (i === 0 ? f : mul(acc, f))), '÷ は わる数の 逆数を かけるよ(÷ 3/4 → × 4/3)')] : []),
    ],
    tags: ['fraction_muldiv'],
    key: `muldiv:frac:${plain}`,
    verify: fs.map((f, i) => `${i === 0 ? '' : ops[i - 1] === '×' ? '*' : '/'}(${Number(f.n)}/${Number(f.d)})`).join(''),
  };
}

type Rat = ReturnType<typeof rat>;

/** 負の数は かっこつき: (−0.25)、\left(-\frac{3}{4}\right)。小数で 見せるか 分数で 見せるか を 選ぶ */
function ratTex(r: Rat, decimal: boolean, withParen = true): string {
  const t = decimal ? String(toNumber(r)) : toTex(r);
  return toNumber(r) < 0 && withParen ? `\\left(${t}\\right)` : t;
}
function ratPlain(r: Rat, decimal: boolean, withParen = true): string {
  const t = plainMinus(decimal || r.d === 1n ? String(toNumber(r)) : `${r.n}/${r.d}`);
  return toNumber(r) < 0 && withParen ? `(${t})` : t;
}

/**
 * 逆数(乗除 ★2 の 5 回に 1 回、2026-10-02)。授業の プリント「逆数」(定着・標準)に 合わせて、整数・分数・小数の 逆数を 聞く。
 * 逆数は かけて 1 に なる数。符号は そのまま(反数と 取りちがえやすい)
 */
const RECIPROCAL_DECIMALS: Rat[] = [rat(1, 2), rat(1, 4), rat(1, 5), rat(2, 5), rat(3, 2), rat(5, 2)];

function genReciprocal(rng: Rng, d: Difficulty): Problem {
  const kind = rng.pick(['integer', 'fraction', 'fraction', 'decimal'] as const);
  let x: Rat;
  if (kind === 'integer') x = rat(rng.int(2, 9));
  else if (kind === 'decimal') x = rng.pick(RECIPROCAL_DECIMALS);
  else {
    const den = rng.int(2, 9);
    let num = rng.int(1, 9);
    while (gcdOf(num, den) !== 1 || num === den) num = rng.int(1, 9);
    x = rat(num, den);
  }
  // 負の数を 多めに(符号の 取りちがえが いちばん 多い)
  if (rng.bool(0.6)) x = neg(x);
  const decimal = kind === 'decimal';
  const value = div(rat(1), x);
  const xTex = ratTex(x, decimal, false);
  return {
    templateId: 'g1.sign.muldiv',
    difficulty: d,
    prompt: `${xTex} ${text(' の 逆数は?')}`,
    promptText: `${ratPlain(x, decimal, false)} の 逆数は?`,
    answer: { kind: 'number', value },
    hint: '逆数は かけて 1 に なる数。分数なら 分子と 分母を 入れかえる。符号は そのまま',
    explanation: [
      ...(decimal ? [`${text('小数を 分数に: ')} ${xTex} = ${toTex(x)}`] : []),
      ...(kind === 'integer' ? [`${toTex(x)} = \\frac{${toTex(x)}}{1}`] : []),
      `${text('分子と 分母を 入れかえる(符号は そのまま): ')} ${toTex(value)}`,
      `${text('確かめ: ')} ${ratTex(x, decimal)} \\times ${ratTex(value, false)} = 1`,
      `${text('答え: ')} ${toTex(value)}`,
    ],
    mistakes: [
      mistakeNum(neg(value), '逆数は 符号は そのまま。負の数の 逆数は 負の数だよ(かけて +1 に なる)'),
      mistakeNum(neg(x), 'それは 反数(符号を 変えた数)。逆数は かけて 1 に なる数だよ'),
    ],
    tags: ['reciprocal'],
    key: `muldiv:recip:${toString(x)}${decimal ? 'd' : ''}`,
    verify: `1/((${Number(x.n)})/(${Number(x.d)}))`,
  };
}

/**
 * 計算法則を 使って 工夫する かけ算(乗除 ★3 の 一部、2026-10-02)。授業の プリント「乗法の計算法則」は 小数が 35%・分数が 23%。
 * かけると 整数に なる 組(0.25 と 4、3/4 と 8 など)を 離して 置き、入れかえて 先に かけると 楽に なる 式にする
 */
const MUL_LAW_PAIRS: { a: Rat; b: number; decimal: boolean }[] = [
  { a: rat(1, 2), b: 2, decimal: true },
  { a: rat(1, 2), b: 4, decimal: true },
  { a: rat(1, 2), b: 6, decimal: true },
  { a: rat(1, 4), b: 4, decimal: true },
  { a: rat(1, 4), b: 8, decimal: true },
  { a: rat(1, 5), b: 5, decimal: true },
  { a: rat(2, 5), b: 5, decimal: true },
  { a: rat(3, 2), b: 2, decimal: true },
  { a: rat(5, 2), b: 4, decimal: true },
  { a: rat(3, 4), b: 8, decimal: false },
  { a: rat(2, 3), b: 6, decimal: false },
  { a: rat(5, 6), b: 12, decimal: false },
  { a: rat(3, 5), b: 10, decimal: false },
];

function genMulLaw(rng: Rng, d: Difficulty): Problem {
  const pair = rng.pick(MUL_LAW_PAIRS);
  const other = rng.int(3, 9);
  // [組の 片方, ほかの数, 組の もう片方](入れかえないと 楽に ならない 並び)
  const raw: Rat[] = rng.bool() ? [pair.a, rat(other), rat(pair.b)] : [rat(pair.b), rat(other), pair.a];
  let fs = raw.map((f) => (rng.bool(0.4) ? neg(f) : f));
  if (fs.every((f) => toNumber(f) > 0)) {
    const j = rng.int(0, 2);
    fs = fs.map((f, i) => (i === j ? neg(f) : f));
  }
  const isPairPart = (i: number) => i !== 1;
  const value = fs.reduce((acc, f) => mul(acc, f), rat(1));
  const negatives = fs.filter((f) => toNumber(f) < 0).length;
  const showDec = (f: Rat) => pair.decimal && f.d !== 1n;
  const tex = fs.map((f) => ratTex(f, showDec(f))).join(' \\times ');
  const plain = fs.map((f) => ratPlain(f, showDec(f))).join(' × ');
  const absTex = (f: Rat) => ratTex(f.n < 0n ? neg(f) : f, showDec(f));
  const pairAbs = fs.filter((_, i) => isPairPart(i)).map(absTex);
  const pairProduct = pair.a.n * BigInt(pair.b) / pair.a.d;
  return {
    templateId: 'g1.sign.muldiv',
    difficulty: d,
    prompt: `${tex} = ?`,
    promptText: `${plain} = ?`,
    answer: { kind: 'number', value },
    hint: '符号を 先に 決めよう。かけると きりの よい 数に なる 組を さがして、入れかえて 先に かける',
    explanation: [
      `${text('負の数が ')}${negatives}${text(' 個 → 符号は ')}${toNumber(value) < 0 ? '-' : '+'}`,
      `${text('入れかえて 組を 先に(計算法則): ')} (${pairAbs.join(' \\times ')}) \\times ${other} = ${pairProduct} \\times ${other} = ${Math.abs(toNumber(value))}`,
      `${text('答え: ')} ${toTex(value)}`,
    ],
    mistakes: [mistakeNum(neg(value), SIGN_SAY(negatives))],
    tags: ['mul_law', pair.decimal ? 'decimal_mul' : 'fraction_mul'],
    key: `muldiv:law:${plain}`,
    verify: fs.map((f) => `((${Number(f.n)})/(${Number(f.d)}))`).join('*'),
  };
}

// ---------------------------------------------------------------- 絶対値・大小

function genAbs(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    // 絶対値の記号 |−7| は中学校では教えない(高校で習う)ので、文で聞く(先生の印 2026-09-27)
    // 0 の絶対値・小数(−2.5 など)も ときどき 出す(Codex のレビュー)
    const r = rng.int(0, 9);
    const n = r === 0 ? 0 : r === 1 ? rng.nonZero(5) + (rng.bool() ? 0.5 : -0.5) : rng.nonZero(20);
    const shown = n > 0 ? `+${n}` : String(n);
    const abs = Math.abs(n);
    return {
      templateId: 'g1.sign.abs',
      difficulty: d,
      prompt: text(`${plainMinus(shown)} の 絶対値は?`),
      promptText: `${plainMinus(shown)} の 絶対値は?`,
      answer: { kind: 'number', value: rat(Math.round(abs * 2), 2) },
      answerLabel: String(abs),
      hint: '絶対値は 0 からの 距離。符号を とった 数だよ',
      explanation: [`${text(`${plainMinus(String(n))} は 0 から ${abs} はなれている`)}`, `${text('答え: ')} ${abs}`],
      mistakes: n !== 0 ? [mistakeNum(-abs, '絶対値は 0 からの 距離なので、負の数に ならないよ')] : [],
      tags: ['abs_value'],
      key: `abs:${n}`,
      verify: `Math.abs(${n})`,
    };
  }
  // ★2 の 10 回に 3 回は 数の大小を 不等号で 表す(教科書の「数の大小」。2026-09-29 追加)
  if (d === 2 && rng.bool(0.3)) return genInequality(rng, d);
  if (d === 2 && rng.bool(0.4)) {
    // 絶対値が a である数を すべて(±a)。以前は ★3 だったが 易しいので ★2 へ(Codex のレビュー)
    const a = rng.int(1, 10);
    return {
      templateId: 'g1.sign.abs',
      difficulty: d,
      prompt: `${text(`絶対値が ${a} である数を すべて答えよ`)}`,
      promptText: `絶対値が ${a} である数を すべて答えよ(「,」で区切る)`,
      answer: { kind: 'numbers', values: [rat(a), rat(-a)] },
      hint: '0 から 同じ 距離の 数は、右と左に 1つずつ',
      explanation: [`${text('0 から')} ${a} ${text('はなれた数は')} ${a} ${text('と')} -${a}`, `${text('答え: ')} ${a}, -${a}`],
      mistakes: [
        { answer: { kind: 'numbers', values: [rat(a)] }, say: `もう 1 つ あるよ。0 から 左にも ${a} はなれた 数が ある` },
        { answer: { kind: 'numbers', values: [rat(-a)] }, say: `もう 1 つ あるよ。0 から 右にも ${a} はなれた 数が ある` },
      ],
      tags: ['abs_two_values'],
      key: `abs:both:${a}`,
      verify: `[${a}, -${a}]`,
    };
  }
  if (d === 2) {
    // 4つの数から 最も小さい/大きい 数を選ぶ(選択式)。
    // 半分は 負の数どうし(−5 / −5.5 / −0.5 / −1)。正の数が 1 つだけだと 符号を見るだけで 選べてしまう(Codex のレビュー)
    const negativesOnly = rng.bool();
    const nums = new Set<number>();
    while (nums.size < 4) {
      const v = rng.pick([rng.nonZero(15), rat2num(rng)]);
      nums.add(negativesOnly ? -Math.abs(v) : v);
    }
    const options = rng.shuffle([...nums]);
    const wantMin = rng.bool();
    const target = wantMin ? Math.min(...options) : Math.max(...options);
    const correct = options.indexOf(target);
    const optTex = options.map((o) => plainMinus(String(o)));
    // 絶対値で 比べてしまう まちがい(−5 と −0.5 で、−0.5 のほうが 小さいと 思う)
    const absPick = options.reduce((best, o, i) => ((wantMin ? Math.abs(o) < Math.abs(options[best]) : Math.abs(o) > Math.abs(options[best])) ? i : best), 0);
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
      mistakes: [{ answer: { kind: 'choice', options: optTex, correct: absPick }, say: '絶対値で 比べて いないかな? 負の数は 絶対値が 大きいほど 小さいよ(−5 < −1)' }],
      tags: ['compare_negative'],
      key: `abs:cmp:${options.join(',')}:${wantMin}`,
      // 選択式は「正解の番号」を照合する。選択肢の配列から独立に求める
      verify: `[${options.join(',')}].indexOf(Math.${wantMin ? 'min' : 'max'}(${options.join(',')}))`,
    };
  }
  // ★3: 条件を組み合わせる。絶対値が a より小さい整数を すべて / 絶対値が a より小さい 負の整数を すべて /
  //       絶対値が a 以下の整数の個数 / ある範囲の整数の個数
  const form = rng.int(0, 3);
  if (form === 0) {
    const a = rng.int(3, 6);
    const list = Array.from({ length: a - 1 }, (_, i) => -(i + 1));
    return {
      templateId: 'g1.sign.abs',
      difficulty: d,
      prompt: `${text(`絶対値が ${a} より小さい 負の整数を すべて答えよ`)}`,
      promptText: `絶対値が ${a} より小さい 負の整数を すべて答えよ(「,」で区切る)`,
      answer: { kind: 'numbers', values: list.map((k) => rat(k)) },
      hint: '負の整数だけ。0 は ふくまない。−' + a + ' は ちょうど ' + a + ' なので ふくまない',
      explanation: [`${text(`0 より左で、0 からの 距離が ${a} より 小さい 整数`)}`, `${text('答え: ')} ${list.join(', ')}`],
      mistakes: [
        { answer: { kind: 'numbers', values: [...list, 0].map((k) => rat(k)) }, say: '0 は 負の数では ないよ' },
        { answer: { kind: 'numbers', values: [...list, -a].map((k) => rat(k)) }, say: `「${a} より小さい」は ${a} ちょうどを ふくまないよ。−${a} の 絶対値は ${a}` },
      ],
      tags: ['abs_negative_list'],
      key: `abs:negless:${a}`,
      verify: `[${list.join(',')}]`,
    };
  }
  if (form === 2) {
    const a = rng.int(2, 7);
    return {
      templateId: 'g1.sign.abs',
      difficulty: d,
      prompt: `${text(`絶対値が ${a} 以下の 整数は 何個?`)}`,
      promptText: `絶対値が ${a} 以下の 整数は 何個?`,
      answer: { kind: 'number', value: rat(2 * a + 1) },
      hint: `−${a} から ${a} まで。0 も 数えるのを わすれずに`,
      explanation: [`${text(`−${a}, …, −1, 0, 1, …, ${a}`)}`, `${a} \\times 2 + 1 = ${2 * a + 1}`, `${text('答え: ')} ${2 * a + 1} ${text('個')}`],
      mistakes: [mistakeNum(2 * a, '0 も 整数だよ。数えるのを わすれずに'), mistakeNum(a + 1, '負の数の 側も 数えよう。0 から 右にも 左にも ある')],
      tags: ['abs_count'],
      key: `abs:atmost:${a}`,
      verify: `${2 * a}+1`,
    };
  }
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
      mistakes: [
        { answer: { kind: 'numbers', values: list.filter((k) => k !== 0).map((k) => rat(k)) }, say: '0 も 整数だよ。0 の 絶対値は 0' },
        { answer: { kind: 'numbers', values: list.filter((k) => k >= 0).map((k) => rat(k)) }, say: '負の数も あるよ。0 から 左にも 同じだけ' },
      ],
      tags: ['abs_range_list'],
      key: `abs:less:${a}`,
      verify: `[${list.join(',')}]`,
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
    mistakes: lo < 0 && hi > 0 ? [mistakeNum(count - 1, '0 も 整数だよ。数えるのを わすれずに')] : [],
    tags: ['count_integers'],
    key: `abs:count:${lo}:${hi}`,
    verify: `(()=>{let c=0;for(let k=Math.ceil(${lo});k<=Math.floor(${hi});k++) if(k>${lo}&&k<${hi}) c++;return c;})()`,
  };
}

/**
 * 数の大小を 不等号で 表す(選択式)。2 数: −3 と −5 → −3 > −5 / 3 数: −2, 0, −5 を 小さい順に → −5 < −2 < 0。
 * まちがいの 選択肢は 絶対値で 比べた 並び(負の数どうしで 起きやすい)
 */
function genInequality(rng: Rng, d: Difficulty): Problem {
  const show = (v: number) => plainMinus(String(v));
  if (rng.bool()) {
    // 2 数。半分は 負の数どうし
    let a: number, b: number;
    do {
      a = rng.nonZero(9);
      b = rng.bool() ? -rng.int(1, 9) : rng.nonZero(9);
    } while (a === b || (rng.bool(0.5) && (a > 0 || b > 0)));
    const options = [`${a} < ${b}`, `${a} > ${b}`];
    const correct = a < b ? 0 : 1;
    const absWrong = Math.abs(a) < Math.abs(b) ? 0 : 1;
    return {
      templateId: 'g1.sign.abs',
      difficulty: d,
      prompt: text(`${show(a)} と ${show(b)} の 大小を、不等号を 使って 表すと?`),
      promptText: `${show(a)} と ${show(b)} の 大小を、不等号を 使って 表すと?`,
      answer: { kind: 'choice', options, correct },
      hint: '数直線で 右に あるほうが 大きい。不等号は 大きいほうに 口を 開く',
      explanation: [`${text('数直線で 右に あるのは ')} ${Math.max(a, b)}`, `${text('答え: ')} ${options[correct]}`],
      mistakes: [{ answer: { kind: 'choice', options, correct: absWrong }, say: '絶対値で 比べて いないかな? 負の数は 絶対値が 大きいほど 小さいよ' }],
      tags: ['inequality_sign'],
      key: `abs:ineq2:${a}:${b}`,
      verify: String(correct),
    };
  }
  // 3 数を 小さい順に(負の数を 2 つ以上)
  const nums = new Set<number>();
  while (nums.size < 3) nums.add(nums.size < 2 ? -rng.int(1, 9) : rng.int(-9, 9));
  const vs = rng.shuffle([...nums]);
  const chain = (xs: number[]) => xs.join(' < ');
  const sorted = [...vs].sort((x, y) => x - y);
  const byAbs = [...vs].sort((x, y) => Math.abs(x) - Math.abs(y) || x - y);
  const cands = [chain(sorted), chain(byAbs), chain([...sorted].reverse()), chain(vs)];
  const options = rng.shuffle([...new Set(cands)]);
  // 4 つ そろわなければ 並べかえを 足す
  for (const p of [[sorted[1], sorted[0], sorted[2]], [sorted[0], sorted[2], sorted[1]]]) if (options.length < 4 && !options.includes(chain(p))) options.push(chain(p));
  const correct = options.indexOf(chain(sorted));
  const absIdx = options.indexOf(chain(byAbs));
  return {
    templateId: 'g1.sign.abs',
    difficulty: d,
    prompt: text(`${vs.map(show).join('、')} を、不等号を 使って 小さい順に 表すと?`),
    promptText: `${vs.map(show).join('、')} を、不等号を 使って 小さい順に 表すと?`,
    answer: { kind: 'choice', options, correct },
    hint: '数直線に 3 つの 点を 置いて、左から 順に 読もう',
    explanation: [`${text('数直線で 左から: ')} ${sorted.join(',\\ ')}`, `${text('答え: ')} ${chain(sorted)}`],
    mistakes: absIdx >= 0 ? [{ answer: { kind: 'choice', options, correct: absIdx }, say: '絶対値の 小さい順に なって いないかな? 負の数は 絶対値が 大きいほど 小さいよ' }] : [],
    tags: ['inequality_sign'],
    key: `abs:ineq3:${vs.join(',')}`,
    verify: String(correct),
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
  // ★1 と ★2 の中身を入れかえた(先生の印 2026-09-27)。教科書でも 累乗 → 四則の混じった計算 の順
  //   ★1: 累乗だけ((−a)² と −a² の区別。ほかの計算と まぜない) / ★2: a × b + c(× が先)・a × (b ± c)(かっこが先)
  // 先生の方針(2026-09-28)「累乗の計算単体で出題されているのであれば そのままで」。
  // かっこの式は ★1 だと 9 × (8 + 9) のように ★2 より重くなるので(Codex のレビュー)、数を小さくして ★2 へ
  if (d === 2 && rng.int(0, 2) === 0) {
    // a × (b ± c): かっこの中は 1けたで 0 にならない
    const a = rng.nonZero(6, 2); // 1 × (…) は かっこを 先にする 意味が うすい
    let b: number, c: number;
    do {
      b = rng.nonZero(9);
      c = rng.nonZero(9);
    } while (b + c === 0 || Math.abs(b + c) > 9);
    const tex = `${paren(a)} \\times (${b} ${c < 0 ? '-' : '+'} ${Math.abs(c)})`;
    return {
      templateId: 'g1.sign.mixed',
      difficulty: d,
      prompt: `${tex} = ?`,
      promptText: plainMinus(tex.replace('\\times', '×')) + ' = ?',
      answer: { kind: 'number', value: rat(a * (b + c)) },
      hint: 'かっこの中を 先に 計算しよう',
      explanation: [`${b} ${c < 0 ? '-' : '+'} ${Math.abs(c)} = ${b + c}`, `${paren(a)} \\times ${paren(b + c)} = ${a * (b + c)}`, `${text('答え: ')} ${a * (b + c)}`],
      mistakes: [mistakeNum(a * b + c, 'かっこの 中を 先に 計算しよう'), mistakeNum(-a * (b + c), SIGN_SAY([a, b + c].filter((x) => x < 0).length))],
      tags: ['parentheses_first'],
      key: `mixed:${tex}`,
      verify: `(${a})*((${b})+(${c}))`,
    };
  }
  if (d === 2) {
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
      mistakes: [
        // c + a × b を 左から (c + a) × b と 計算した
        ...(first ? [] : [mistakeNum((c + a) * b, 'かけ算が 先。たし算は あとで するよ')]),
        mistakeNum(-a * b + c, `かけ算の 符号を もう一度。${paren(a)} × ${paren(b)} = ${a * b}`.replace(/-/g, '−')),
      ],
      tags: ['order_of_operations'],
      key: `mixed:${tex}`,
      verify: `(${a})*(${b})+(${c})`,
    };
  }
  // ★1 の 4 回に 1 回は 同じ数の かけ算を 累乗で 表す(授業の プリント「累乗」。2026-10-02)
  if (d === 1 && rng.int(0, 3) === 0) return genPowerNotation(rng, d);
  if (d === 1) {
    // 累乗だけ: (−a)ⁿ と −aⁿ の区別。a は 6 まで、3 乗は a が 3 まで((−6)³ = −216 のような大きな数は 教科書に出ない)。
    // (−1)ⁿ は 5 乗まで(偶数・奇数で 符号が決まることに 気づかせる)
    const withParen = rng.bool();
    let a: number, e: number;
    if (withParen && rng.bool(0.2)) {
      a = 1;
      e = rng.int(2, 5);
    } else {
      a = rng.int(2, 6);
      e = a <= 3 ? rng.pick([2, 3]) : 2;
    }
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
      mistakes: [
        // (−a)ⁿ と −aⁿ の 取りちがえ
        mistakeNum(
          withParen ? neg(pow(rat(a), e)) : pow(rat(-a), e),
          withParen ? `(−${a})${sup(e)} は (−${a}) を ${e} 回 かける。− も いっしょに かけるよ` : `−${a}${sup(e)} は −(${a}${sup(e)})。${e} 乗するのは ${a} だけで、− は あとから つけるよ`,
        ),
        // 累乗を「a × n」と した(3² を 6 に)
        ...(a > 1 ? [mistakeNum(withParen ? (e % 2 ? -a * e : a * e) : -a * e, `${a}${sup(e)} は ${a}×${e} では なく、${a} を ${e} 回 かけるよ`)] : []),
      ],
      tags: [withParen ? 'power_of_negative' : 'negative_of_power'],
      key: `mixed:${tex}`,
      verify: withParen ? `(-${a})**${e}` : `-(${a}**${e})`,
    };
  }
  // ★3: 5 回に 1 回は 分配法則を 使う 工夫(授業の プリント。2026-10-02)。
  // のこりの 4 回に 3 回は チャレンジテストの形(乗除のかたまりを 加減でつなぐ)、1 回は 累乗 + 乗除
  if (rng.int(0, 4) === 0) return genDistributive(rng, d);
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
    mistakes: [
      mistakeNum(
        add(withParen ? neg(pow(rat(Math.abs(a)), e)) : pow(rat(-Math.abs(a)), e), mul(rat(b), div(rat(k), rat(c)))),
        withParen ? `(−${Math.abs(a)})² は +${Math.abs(a) ** 2}。− も いっしょに 2 回 かけるよ` : `−${Math.abs(a)}² は −${Math.abs(a) ** 2}。2 乗するのは ${Math.abs(a)} だけ`,
      ),
    ],
    tags: ['order_of_operations', withParen ? 'power_of_negative' : 'negative_of_power'],
    key: `mixed:${tex}`,
    verify: `${withParen ? `(-${Math.abs(a)})**${e}` : `-(${Math.abs(a)}**${e})`} + (${b})*(${k})/(${c})`,
  };
}

/**
 * 同じ数の かけ算を 累乗で 表す(四則 ★1 の 4 回に 1 回、選択式)。授業の プリント「累乗」に 7 問ある形。
 * 入力式に すると (−3)⁴ の かわりに 81 でも 同じ値に なり、表し方を 確かめられないので 選ばせる。
 * まちがいの 選択肢は (−a)ⁿ と −aⁿ の 取りちがえ、指数と 底の 入れかえ(aⁿ と nᵃ)
 */
function genPowerNotation(rng: Rng, d: Difficulty): Problem {
  const form = rng.pick(['neg', 'pos', 'negOutside', 'two', 'fraction'] as const);
  const a = rng.int(2, 6);
  let n = rng.int(2, 4);
  if (n === a) n = a === 2 ? 3 : 2;
  const rep = (s: string, k: number, sep: string) => Array(k).fill(s).join(sep);
  let tex: string;
  let plain: string;
  let options: string[];
  let say: string[];
  if (form === 'neg') {
    tex = rep(`(-${a})`, n, ' \\times ');
    plain = rep(`(−${a})`, n, '×');
    options = [`(-${a})^{${n}}`, `-${a}^{${n}}`, `(-${n})^{${a}}`];
    say = ['', `−${a}${sup(n)} は −(${a}${sup(n)})。−${a} を ${n} 回 かけるときは かっこを つけて (−${a})${sup(n)}`, `かける 数が 底(${a})、かける 回数が 指数(${n})だよ`];
  } else if (form === 'pos') {
    tex = rep(`${a}`, n, ' \\times ');
    plain = rep(`${a}`, n, '×');
    options = [`${a}^{${n}}`, `${n}^{${a}}`, `${a} \\times ${n}`];
    say = ['', `かける 数が 底(${a})、かける 回数が 指数(${n})だよ`, `${a}×${n} は ${a} を ${n} 回 たした 数。かける 回数は 指数で 書くよ`];
  } else if (form === 'negOutside') {
    tex = `-(${rep(`${a}`, n, ' \\times ')})`;
    plain = `−(${rep(`${a}`, n, '×')})`;
    options = [`-${a}^{${n}}`, `(-${a})^{${n}}`, `-${n}^{${a}}`];
    say = ['', `(−${a})${sup(n)} は −${a} を ${n} 回 かける 数。ここは ${a} を ${n} 回 かけてから − を つけるので −${a}${sup(n)}`, `かける 数が 底(${a})、かける 回数が 指数(${n})だよ`];
  } else if (form === 'two') {
    // 2 種類の 数: 3 × 3 × 7 × 7 × 7 = 3² × 7³(素因数分解の 書き方に つながる)
    const [p, q] = rng.shuffle([2, 3, 5, 7]).slice(0, 2).sort((x, y) => x - y);
    const [i, j] = rng.pick([[2, 3], [3, 2], [2, 4], [3, 4]] as const);
    tex = `${rep(`${p}`, i, ' \\times ')} \\times ${rep(`${q}`, j, ' \\times ')}`;
    plain = `${rep(`${p}`, i, '×')}×${rep(`${q}`, j, '×')}`;
    options = [`${p}^{${i}} \\times ${q}^{${j}}`, `${p}^{${j}} \\times ${q}^{${i}}`, `(${p} \\times ${q})^{${i + j}}`];
    say = ['', `${p} は ${i} 個、${q} は ${j} 個。数ごとに かける 回数を 数えよう`, `ちがう 数は まとめられない。${p} と ${q} を 別々に 累乗で 書くよ`];
  } else {
    // 分数: (−2/3) × (−2/3) = (−2/3)²
    const den = rng.pick([3, 4, 5]);
    let num = rng.int(1, den - 1);
    while (gcdOf(num, den) !== 1) num = rng.int(1, den - 1);
    n = 2;
    tex = rep(`\\left(-\\frac{${num}}{${den}}\\right)`, n, ' \\times ');
    plain = rep(`(−${num}/${den})`, n, '×');
    options = [`\\left(-\\frac{${num}}{${den}}\\right)^{2}`, `-\\frac{${num}^{2}}{${den}}`, `-\\frac{${num}}{${den}} \\times 2`];
    say = ['', `分数 全体を かけるので、かっこを つけて ( )² と 書くよ`, `× 2 は 2 回 たした 数。2 回 かける ときは 指数 2 で 書くよ`];
  }
  // 選択肢の 順番を まぜる(正解は いつも 1 番目に ならないように)
  const order = rng.shuffle([0, 1, 2]);
  const shown = order.map((k) => options[k]);
  const correct = order.indexOf(0);
  return {
    templateId: 'g1.sign.mixed',
    difficulty: d,
    prompt: `${tex} \\quad ${text('を 累乗の 指数を 使って 表すと?')}`,
    promptText: `${plain} を 累乗の 指数を 使って 表すと?`,
    answer: { kind: 'choice', options: shown, correct },
    hint: '同じ 数を かけた 回数を 右上に 小さく 書く。負の数や 分数 全体を かけるときは かっこを つける',
    explanation: [`${text('同じ 数を かけた 回数を 数える → ')} ${options[0]}`, `${text('答え: ')} ${options[0]}`],
    mistakes: order
      .filter((k) => k !== 0)
      .map((k) => ({ answer: { kind: 'choice' as const, options: shown, correct: order.indexOf(k) }, say: say[k] })),
    tags: ['power_notation'],
    key: `mixed:pownot:${tex}`,
    verify: String(correct),
  };
}

/**
 * 分配法則を 使う 工夫(四則 ★3 の 5 回に 1 回)。授業の プリント「分配法則」は 分数が 55%、
 * (−6) × 58 + (−6) × 42 のように まとめて 100 に する 形も ある。
 *   ・k × (p/q ± r/s): k が 分母の 公倍数なので、分配すると 整数どうしの 計算に なる
 *   ・a × b + a × c(b + c = 100)/ a × b − a × c(b − c = 10, 20): まとめると 楽に なる
 */
const DIST_DENS: [number, number][] = [
  [2, 3],
  [2, 6],
  [3, 4],
  [3, 6],
  [4, 6],
  [2, 5],
];

function genDistributive(rng: Rng, d: Difficulty): Problem {
  if (rng.bool()) {
    const [q, s] = rng.pick(DIST_DENS);
    const l = (q * s) / gcdOf(q, s);
    const k = l * rng.int(1, Math.max(1, Math.floor(36 / l))) * (rng.bool() ? -1 : 1);
    const pick = (den: number) => {
      let num = rng.int(1, den - 1);
      while (gcdOf(num, den) !== 1) num = rng.int(1, den - 1);
      return num;
    };
    const p = pick(q);
    const r = pick(s);
    const op = rng.pick(['+', '-'] as const);
    const A = (k * p) / q;
    const B = (k * r) / s;
    const value = op === '+' ? A + B : A - B;
    const inner = `\\frac{${p}}{${q}} ${op} \\frac{${r}}{${s}}`;
    const kFirst = rng.bool();
    const tex = kFirst ? `${paren(k)} \\times \\left(${inner}\\right)` : `\\left(${inner}\\right) \\times ${paren(k)}`;
    const innerPlain = `${p}/${q} ${op === '+' ? '+' : '−'} ${r}/${s}`;
    const plain = plainMinus(kFirst ? `${paren(k)} × (${innerPlain})` : `(${innerPlain}) × ${paren(k)}`);
    return {
      templateId: 'g1.sign.mixed',
      difficulty: d,
      prompt: `${tex} = ?`,
      promptText: `${plain} = ?`,
      answer: { kind: 'number', value: rat(value) },
      hint: `分配法則で かっこの 中の 両方に ${k} を かけると、分数が 消えて 楽に なるよ`,
      explanation: [
        `${text('分配法則: ')} ${paren(k)} \\times \\frac{${p}}{${q}} ${op} ${paren(k)} \\times \\frac{${r}}{${s}}`,
        `= ${paren(A)} ${op} ${paren(B)} = ${value}`,
        `${text('答え: ')} ${value}`,
      ],
      mistakes: [
        // かっこの 中の 1 つめにだけ かけた
        mistakeNum(op === '+' ? add(rat(A), rat(r, s)) : sub(rat(A), rat(r, s)), `かっこの 中の どちらにも ${k} を かけるよ`.replace(/-/g, '−')),
      ],
      tags: ['distributive', 'distributive_fraction'],
      key: `mixed:dist:${tex}`,
      verify: `(${k})*((${p})/(${q}))${op}(${k})*((${r})/(${s}))`,
    };
  }
  // まとめて 楽に する: a × b ± a × c = a × (b ± c)
  const a = rng.int(2, 9) * (rng.bool(0.6) ? -1 : 1);
  const plus = rng.bool(0.6);
  let b: number, c: number;
  if (plus) {
    do b = rng.int(11, 89);
    while (b % 10 === 0);
    c = 100 - b;
  } else {
    c = rng.int(11, 79);
    b = c + rng.pick([10, 20]);
  }
  const op = plus ? '+' : '-';
  const sum = plus ? b + c : b - c;
  const value = a * sum;
  const tex = `${paren(a)} \\times ${b} ${op} ${paren(a)} \\times ${c}`;
  return {
    templateId: 'g1.sign.mixed',
    difficulty: d,
    prompt: `${tex} = ?`,
    promptText: plainMinus(`${paren(a)} × ${b} ${op} ${paren(a)} × ${c}`) + ' = ?',
    answer: { kind: 'number', value: rat(value) },
    hint: `どちらも ${paren(a)} を かけている。分配法則で ${paren(a)} × (${b} ${op} ${c}) に まとめると 楽`.replace(/-/g, '−'),
    explanation: [`${text('分配法則で まとめる: ')} ${paren(a)} \\times (${b} ${op} ${c})`, `= ${paren(a)} \\times ${sum} = ${value}`, `${text('答え: ')} ${value}`],
    mistakes: [mistakeNum(-value, SIGN_SAY(a < 0 ? 1 : 0))],
    tags: ['distributive', 'distributive_combine'],
    key: `mixed:dist:${tex}`,
    verify: `(${a})*(${b})${op}(${a})*(${c})`,
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
      ...blocks.filter((b) => b.ops.length > 0).map((b) => `${text('× ÷ を 先に: ')} ${blockTex(b, false)} = ${b.value}`),
      `${text('たし算・ひき算: ')} ${sumTex} = ${termsTex(blocks.map((b) => b.sign * b.value))} = ${value}`,
      `${text('答え: ')} ${value}`,
    ],
    mistakes: [mistakeNum(leftToRight(blocks), '× と ÷ が 先。左から 順に ぜんぶ 計算すると ちがう 答えに なるよ')],
    tags: ['order_of_operations'],
    key: `mixed:${tex}`,
    verify,
  };
}

/** 四則の 順番を 守らず、左から 順に 計算したときの 答え(よくある まちがい) */
function leftToRight(blocks: { sign: 1 | -1; nums: number[]; ops: ('×' | '÷')[] }[]) {
  let acc = rat(blocks[0].nums[0]);
  blocks.forEach((b, i) => {
    b.nums.forEach((n, k) => {
      if (i === 0 && k === 0) return;
      if (k === 0) acc = b.sign > 0 ? add(acc, rat(n)) : sub(acc, rat(n));
      else acc = b.ops[k - 1] === '×' ? mul(acc, rat(n)) : div(acc, rat(n));
    });
  });
  return acc;
}

function sup(e: number): string {
  return e === 2 ? '²' : e === 3 ? '³' : e === 4 ? '⁴' : e === 5 ? '⁵' : `^${e}`;
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
  // ★1 と ★2 は 数の範囲を 分ける(以前は 30〜50 が どちらにも出た。先生の方針 2026-09-28「重なりを減らす」)
  if (d === 1) {
    // 2〜3個の素数の積(12〜40)。例: 12, 18, 28, 35(4 や 6 は分解する手順の練習にならない)
    do n = productOf(rng, rng.pick([2, 3]));
    while (n > 40 || n < 12);
  } else if (d === 2) {
    // 2 けた(42〜99)で、素因数は 3 つまで(先生の印「54 = 2×3×3×3 や 105 は まだ」2026-09-27)。
    // 11・13 も使う(44 = 2×2×11、78 = 2×3×13 など)。例: 42, 45, 63, 70, 98
    do n = rng.bool(0.35) ? productOf(rng, rng.pick([1, 2]), [rng.pick([11, 13])]) : productOf(rng, rng.pick([2, 3]));
    while (n > 99 || n < 42);
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
    hint: '小さい 素数(2, 3, 5, 7…)で 割れるだけ 割っていこう。同じ素数が 並んだら 累乗で 2^2×3 と 書いてもいい',
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

