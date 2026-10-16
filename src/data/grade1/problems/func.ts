import { mistakeNum, registerTemplate, type Difficulty, type Mistake, type Problem } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat, toTex, type Rational } from '@/math/rational';
import { paren, plainMinus, text } from '@/math/format';

/**
 * 第4章「比例と反比例」のテンプレート(台本 04_waterwheel_lake.md の敵に対応)。
 *   g1.func.prop     比例のヌシ        比例の式(場面・表・1 組の x, y から)・値・比例定数・変域
 *   g1.func.invprop  反比例のアメンボ  反比例の式・値・比例定数(利用の 文章題は 難しすぎるので 出さない)
 *   g1.func.coord    座標クラゲ        点の座標を読む・座標から点を選ぶ・対称な点・移動した点
 *   g1.func.graph    グラフウナギ      グラフから式(比例・反比例。★3 は 比例定数が 分数)
 * ★ は 教科書の 節の 順(関数と変域 → 比例の式 → 座標 → 比例のグラフ → 反比例の式 → 反比例のグラフ → 利用)と
 * チャレンジテスト(座標 80〜86%、反比例の値 76%、グラフの選択 67〜72%、点 (5, −1) を通る比例の比例定数 40%、変域 54〜62%)に 合わせた。
 * 教科書 4 章の 本文は まだ 読んでいない(2026-10-15 時点。届いたら 第3章と 同じく 数の 範囲を 合わせ直す)。
 * 各 ★ の 1 段目が 教科書の 前の方の 問、★3 は 章の問題と チャレンジテストの 形
 */
const UNIT = '比例と反比例';

// ---------------------------------------------------------------- 書き方

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
/** 数を 平文の −(問題文・一言用) */
const pm = (n: number | string): string => plainMinus(String(n));
/** 表の ます(平文の −) */
const cell = (n: number): string => pm(n);

/** 約分した 分数 p/q(q は 正) */
function reduce(p: number, q: number): [number, number] {
  const s = q < 0 ? -1 : 1;
  const g = gcd(p, q) || 1;
  return [(s * p) / g, (s * q) / g];
}
/** 比例定数 p/q の TeX(2 → 2、−2/3 → −\frac{2}{3}) */
function constTex(p: number, q = 1): string {
  const [n, d] = reduce(p, q);
  if (d === 1) return String(n);
  return `${n < 0 ? '-' : ''}\\frac{${Math.abs(n)}}{${d}}`;
}
/** p/q · x の TeX(1x → x、−1x → −x、−\frac{2}{3}x) */
function propTex(p: number, q = 1): string {
  const [n, d] = reduce(p, q);
  if (d === 1) return n === 1 ? 'x' : n === -1 ? '-x' : `${n}x`;
  return `${constTex(n, d)}x`;
}
/** p/q · x の 入力の 形(答えの 式。生徒は 2/3x と 打つ) */
function propInput(p: number, q = 1): string {
  const [n, d] = reduce(p, q);
  if (d === 1) return n === 1 ? 'x' : n === -1 ? '-x' : `${n}x`;
  return `${n}/${d}x`;
}
/** p/q · x の 平文(−2/3x) */
const propPlain = (p: number, q = 1): string => pm(propInput(p, q));
/** 反比例の 右辺 a/x の TeX(負の数は −\frac{12}{x} と 書く。教科書と 同じ) */
const invTex = (a: number): string => `${a < 0 ? '-' : ''}\\frac{${Math.abs(a)}}{x}`;
const invPlain = (a: number): string => `${pm(a)}/x`;
/** 座標 (x, y) の TeX */
const pt = (x: number, y: number): string => `(${x}, \\ ${y})`;
const ptPlain = (x: number, y: number): string => `(${pm(x)}, ${pm(y)})`;
const ratOf = (p: number, q = 1): Rational => rat(p, q);

/**
 * 選択肢を 作る。wrongs の say が あれば、それを 選んだ 子への 一言(よくある まちがい)に なる。
 * 正解と 同じ 表示・重なる 表示は 取り除き、のこりから 3 つ
 */
function choose(rng: Rng, correct: string, wrongs: { opt: string; say?: string }[]): { answer: Problem['answer']; mistakes: Mistake[] } {
  const seen = new Set([correct]);
  const picked: { opt: string; say?: string }[] = [];
  for (const w of wrongs) {
    if (seen.has(w.opt) || picked.length >= 3) continue;
    seen.add(w.opt);
    picked.push(w);
  }
  const options = rng.shuffle([correct, ...picked.map((w) => w.opt)]);
  const mistakes = picked.filter((w) => w.say).map((w) => ({ answer: { kind: 'choice' as const, options, correct: options.indexOf(w.opt) }, say: w.say! }));
  return { answer: { kind: 'choice', options, correct: options.indexOf(correct) }, mistakes };
}

/** 式で 答える 問題の まちがい(y = □ の □ を 入れる) */
const mistakeExpr = (expected: string, say: string): Mistake => ({ answer: { kind: 'expression', expected }, say });

/** 重みつきで 形を 選ぶ */
function weighted<T extends string>(rng: Rng, table: [T, number][]): T {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = rng.int(1, total);
  for (const [k, w] of table) if ((r -= w) <= 0) return k;
  return table[0][0];
}

// ---------------------------------------------------------------- 比例

/**
 * 変域(★2・★3 の 4 回に 1 回)。チャレンジテストで毎年出る(正答率 54〜62%)。docs/difficulty.md
 *   ★2: 具体的な場面(水そう・道のり)で、x または y の変域を選ぶ
 *   ★3: y = ax で x の変域から y の変域を選ぶ(a が負なら大小が入れかわる)
 */
function genDomain(rng: Rng, d: Difficulty): Problem {
  if (d === 2) {
    const tank = rng.bool();
    // 水そうは 教科書の 180 cm(毎分 3 cm で 60 分)も
    const [total, speed] = tank
      ? rng.pick([[30, 2], [30, 3], [30, 5], [40, 2], [40, 5], [60, 3], [60, 4], [60, 5], [180, 3], [180, 6]])
      : rng.pick([[600, 40], [600, 60], [800, 40], [800, 80], [1200, 60], [1200, 80]]);
    const time = total / speed;
    const story = tank
      ? `深さ ${total} cm の 水そうに、毎分 ${speed} cm ずつ 水を 入れる。入れ始めてから x 分後の 水の 深さを y cm とする`
      : `家から ${total} m 先の 駅まで、分速 ${speed} m で 歩く。歩き始めてから x 分後に 進んだ 道のりを y m とする`;
    const until = tank ? '水そうが いっぱいに なるまで' : '駅に 着くまで';
    const askX = rng.bool();
    const [v, max] = askX ? ['x', time] : ['y', total];
    const other = askX ? total : time;
    const { answer, mistakes } = choose(rng, `0 \\leqq ${v} \\leqq ${max}`, [
      { opt: `0 < ${v} < ${max}`, say: `入れ始め(歩き始め)の 0 と、${tank ? 'いっぱいに なった' : '着いた'} ときの ${max} も ふくむので ≦ を 使うよ` },
      { opt: `0 \\leqq ${v} \\leqq ${other}`, say: askX ? `${other} は 深さ(道のり)の 最大。x は 時間なので ${total} ÷ ${speed} = ${time} 分まで` : `${other} は かかる 時間。y は ${tank ? '深さ' : '道のり'}なので ${total} まで` },
      { opt: `${v} \\geqq 0` },
      { opt: `0 \\leqq ${v} \\leqq ${speed}`, say: `${speed} は 1 分あたりの 量。${askX ? `x の 最大は ${total} ÷ ${speed} = ${time}` : `y の 最大は ${total}`} だよ` },
    ]);
    return {
      templateId: 'g1.func.prop',
      difficulty: d,
      prompt: text(`${story}。\n${until}の ${v} の 変域は?`),
      promptText: `${story}。${until}の ${v} の 変域は?`,
      layout: 'prose',
      answer,
      hint: askX ? `いっぱいに なる(着く)のは 何分後? ${total} ÷ ${speed} を 計算しよう` : 'y は 0 から、いっぱい(着いた)ときの 値まで。はしも ふくむ',
      explanation: askX
        ? [`${text('入れ始め(歩き始め)は')} \\; x = 0`, `${text(tank ? 'いっぱいに なるのは' : '駅に 着くのは')} \\; ${total} \\div ${speed} = ${time} \\; ${text('(分後)')}`, `${text('はしの 値も ふくむので')} \\; 0 \\leqq x \\leqq ${time}`, `${text('答え: ')} 0 \\leqq x \\leqq ${time}`]
        : [`${text('はじめは')} \\; y = 0`, `${text(tank ? 'いっぱいの ときの 深さは' : '駅に 着いた ときの 道のりは')} \\; ${total}`, `${text('答え: ')} 0 \\leqq y \\leqq ${total}`],
      mistakes,
      tags: ['prop_domain'],
      key: `dom2:${tank}:${total}:${speed}:${v}`,
      verify: String(answer.kind === 'choice' ? answer.correct : -1),
    };
  }
  const a = rng.nonZero(5);
  const p = -rng.int(1, 4);
  const q = rng.int(1, 5);
  const [yp, yq] = [a * p, a * q];
  const [lo, hi] = [Math.min(yp, yq), Math.max(yp, yq)];
  const { answer, mistakes } = choose(rng, `${lo} \\leqq y \\leqq ${hi}`, [
    { opt: `${yp} \\leqq y \\leqq ${yq}`, say: `比例定数が 負なので、x = ${pm(p)} の ときの y = ${pm(yp)} の ほうが 大きい。小さい ほうを 左に 書くよ` },
    { opt: `${p} \\leqq y \\leqq ${q}`, say: 'それは x の 変域。x の はしの 値を y = ax に 代入して、y の 値を 求めよう' },
    { opt: `${lo} < y < ${hi}`, say: 'x の 変域に はしの 値(≦)が ふくまれるので、y の 変域も ≦ だよ' },
    { opt: `${-hi} \\leqq y \\leqq ${-lo}`, say: '符号に 注意。負の数 × 負の数 は 正の数' },
    { opt: `0 \\leqq y \\leqq ${hi}` },
  ]);
  return {
    templateId: 'g1.func.prop',
    difficulty: d,
    prompt: `y = ${propTex(a)} \\quad ${text(`x の 変域が`)} ${p} \\leqq x \\leqq ${q} ${text(' のとき、y の 変域は?')}`,
    promptText: `y = ${propPlain(a)} で、x の変域が ${pm(p)} ≦ x ≦ ${q} のとき、y の変域は?`,
    answer,
    hint: a < 0 ? 'x の はしの 値を 代入しよう。比例定数が 負なので、大小が 入れかわる' : 'x の はしの 値を それぞれ 代入しよう',
    explanation: [
      `x = ${p} \\; ${text('のとき')} \\; y = ${a} \\times (${p}) = ${yp}`,
      `x = ${q} \\; ${text('のとき')} \\; y = ${a} \\times ${q} = ${yq}`,
      ...(a < 0 ? [`${text('比例定数が 負なので、x が 増えると y は 減る。小さい ほうを 左に')}`] : []),
      `${text('答え: ')} ${lo} \\leqq y \\leqq ${hi}`,
    ],
    mistakes,
    tags: ['prop_domain'],
    key: `dom3:${a}:${p}:${q}`,
    verify: String(answer.kind === 'choice' ? answer.correct : -1),
  };
}

/**
 * 変域を 不等号で 表す(★2。教科書の 例 1・問 1「x が 4 未満」→ x < 4、「0 より 大きく 5 以下」→ 0 < x ≦ 5)。
 * 以上・以下は ≦ を、未満・より大きいは < を 使う
 */
function genDomainWords(rng: Rng, d: Difficulty): Problem {
  const lo = rng.pick([0, 0, 1, 2, 3, -2, -3]);
  const hi = lo + rng.int(3, 8);
  // [言葉, 左の 不等号(なければ 片側), 右の 不等号]。true が ≦
  const forms: [string, boolean | null, boolean | null][] = [
    [`${pm(hi)} 未満`, null, false],
    [`${pm(hi)} 以下`, null, true],
    [`${pm(lo)} 以上 ${pm(hi)} 以下`, true, true],
    [`${pm(lo)} 以上 ${pm(hi)} 未満`, true, false],
    [`${pm(lo)} より 大きく ${pm(hi)} 以下`, false, true],
  ];
  const [words, left, right] = rng.pick(forms);
  const ineq = (l: boolean | null, r: boolean | null): string => {
    const op = (le: boolean | null) => (le ? '\\leqq' : '<');
    return l === null ? `x ${op(r)} ${hi}` : `${lo} ${op(l)} x ${op(r)} ${hi}`;
  };
  const sayRight = right ? `「以下」は ${pm(hi)} を ふくむので ≦ だよ` : `「未満」は ${pm(hi)} を ふくまないので < だよ`;
  const sayLeft = left ? `「以上」は ${pm(lo)} を ふくむので ≦ だよ` : `「より 大きい」は ${pm(lo)} を ふくまないので < だよ`;
  const wrongs: { opt: string; say?: string }[] = [{ opt: ineq(left, !right), say: sayRight }];
  if (left !== null) wrongs.push({ opt: ineq(!left, right), say: sayLeft }, { opt: ineq(!left, !right), say: `${sayLeft}。${sayRight}` });
  else wrongs.push({ opt: `x ${right ? '\\geqq' : '>'} ${hi}`, say: `「${right ? '以下' : '未満'}」は ${pm(hi)} より 小さい ほう。不等号の 向きに 注意` }, { opt: `x ${right ? '>' : '\\geqq'} ${hi}` });
  const correct = ineq(left, right);
  const { answer, mistakes } = choose(rng, correct, wrongs);
  return {
    templateId: 'g1.func.prop',
    difficulty: d,
    prompt: text(`変数 x が ${words}の 範囲の 値を とるとき、x の 変域を 不等号で 表すと?`),
    promptText: `変数 x が ${words}の範囲の値をとるとき、x の変域を不等号で表すと?`,
    layout: 'prose',
    answer,
    mistakes,
    hint: '「以上」「以下」は その数を ふくむ(≦)、「未満」「より 大きい」は ふくまない(<)',
    explanation: [
      text(`${words}`),
      ...(left === null ? [] : [text(left ? `${pm(lo)} 以上 → ${pm(lo)} を ふくむ(≦)` : `${pm(lo)} より 大きい → ${pm(lo)} を ふくまない(<)`)]),
      text(right ? `${pm(hi)} 以下 → ${pm(hi)} を ふくむ(≦)` : `${pm(hi)} 未満 → ${pm(hi)} を ふくまない(<)`),
      `${text('答え: ')} ${correct}`,
    ],
    tags: ['domain_words'],
    key: `domw:${lo}:${hi}:${words}`,
    verify: String(answer.kind === 'choice' ? answer.correct : -1),
  };
}

/** 比例の 場面(教科書の 1 節: 長方形・平行四辺形の 面積、時速、毎分の 水、正方形の 周)。y = ax の a */
const PROP_SCENES: { story: (a: number) => string; a: number[]; rule: string }[] = [
  { story: (a) => `縦が ${a} cm、横が x cm の 長方形の 面積を y cm² とする`, a: [3, 4, 5, 6, 7, 8], rule: '(長方形の 面積)=(縦)×(横)' },
  { story: (a) => `底辺が ${a} cm、高さが x cm の 平行四辺形の 面積を y cm² とする`, a: [5, 6, 8, 9, 10, 12], rule: '(平行四辺形の 面積)=(底辺)×(高さ)' },
  { story: (a) => `時速 ${a} km で x 時間 歩いたら、y km 進んだ`, a: [3, 4, 5, 6], rule: '(道のり)=(速さ)×(時間)' },
  { story: (a) => `容器に 毎分 ${a} L ずつ 水を 入れると、水は x 分間に y L たまる`, a: [2, 3, 4, 5, 6], rule: '(水の 量)=(1 分間に 入る 量)×(時間)' },
  { story: () => `1 辺が x cm の 正方形の 周の 長さを y cm とする`, a: [4], rule: '(周の 長さ)=(1 辺の 長さ)× 4' },
];

/** 場面から y = ax を 作る(★1) */
function genPropScene(rng: Rng, d: Difficulty): Problem {
  const s = rng.pick(PROP_SCENES);
  const a = rng.pick(s.a);
  const story = s.story(a);
  return {
    templateId: 'g1.func.prop',
    difficulty: d,
    prompt: text(`${story}。\ny を x の 式で 表せ`),
    promptText: `${story}。y を x の 式で 表せ`,
    layout: 'prose',
    answer: { kind: 'expression', expected: `${a}x` },
    answerLabel: `y = ${a}x`,
    hint: `言葉の 式 ${s.rule} を 作ってから、x と y を 入れよう`,
    explanation: [text(s.rule), `y = ${a} \\times x`, `${text('答え: ')} y = ${a}x \\quad ${text(`(比例定数は ${a})`)}`],
    mistakes: [mistakeExpr(`x+${a}`, `${s.rule.split('=')[1]}。たすのでは なく かけるよ`), mistakeExpr(`1/${a}x`, `x ÷ ${a} では なく、${a} × x だよ`)],
    tags: ['prop_model'],
    key: `props:${PROP_SCENES.indexOf(s)}:${a}`,
    verify: `x*${a}`,
  };
}

/** y = ax の x に 値を 入れる */
function genPropValue(rng: Rng, d: Difficulty): Problem {
  const a = d === 1 ? rng.int(2, 9) : rng.nonZero(9, 2);
  // ★1 も 3 回に 1 回は x が 負の数(教科書の「x が 負の 値の ときも」)
  const x = d === 1 ? (rng.int(0, 2) === 0 ? -rng.int(1, 9) : rng.int(1, 9)) : rng.nonZero(9);
  const y = a * x;
  const mistakes: Mistake[] = [mistakeNum(a + x, `y = ${propPlain(a)} は ${pm(a)} × x の こと。たすのでは なく かけるよ`)];
  if (a < 0 || x < 0) mistakes.push(mistakeNum(-y, `符号に 注意。${a < 0 && x < 0 ? '負の数 × 負の数 は 正の数' : '正の数 × 負の数 は 負の数'}`));
  return {
    templateId: 'g1.func.prop',
    difficulty: d,
    prompt: `y = ${propTex(a)} \\quad x = ${x} \\; ${text('のときの y は?')}`,
    promptText: `y = ${propPlain(a)} で x = ${pm(x)} のときの y は?`,
    answer: { kind: 'number', value: rat(y) },
    hint: x < 0 ? 'x の ところに 負の数を かっこを つけて 入れよう' : 'x の ところに 数を 入れて かけるだけ',
    explanation: [`y = ${a} \\times ${paren(x)}`, `y = ${y}`, `${text('答え: ')} ${y}`],
    mistakes,
    tags: ['prop_value'],
    key: `prop:${a}:${x}`,
    verify: `${a}*(${x})`,
  };
}

/** 比例定数を 答える(★1 は 整数、★2 は 分数も) */
function genPropConstant(rng: Rng, d: Difficulty): Problem {
  const frac = d > 1 && rng.bool();
  const q = frac ? rng.pick([2, 3, 4, 5]) : 1;
  const p = frac ? rng.pick([1, 2, 3, 4, 5].filter((v) => gcd(v, q) === 1)) * (rng.bool() ? 1 : -1) : rng.nonZero(9, 2);
  const [n, den] = [p, q];
  // 1/3 x は x/3 と 書くことも ある(教科書の y = x/3)
  const asOver = den > 1 && Math.abs(n) === 1 && rng.bool();
  const rhs = asOver ? `${n < 0 ? '-' : ''}\\frac{x}{${den}}` : propTex(n, den);
  const rhsPlain = asOver ? `${n < 0 ? '−' : ''}x/${den}` : propPlain(n, den);
  const mistakes: Mistake[] = [mistakeNum(ratOf(-n, den), '比例定数は 符号も ふくめて 答えるよ')];
  if (asOver) mistakes.push(mistakeNum(ratOf(n * den), `x/${den} は 1/${den} × x の こと。比例定数は 1/${den} だよ`));
  return {
    templateId: 'g1.func.prop',
    difficulty: d,
    prompt: `y = ${rhs} \\quad ${text('の 比例定数は?')}`,
    promptText: `y = ${rhsPlain} の 比例定数は?`,
    answer: { kind: 'number', value: ratOf(n, den) },
    hint: 'y = ax の a が 比例定数。x に かかっている 数を 見よう',
    explanation: [...(asOver ? [`${rhs} = ${propTex(n, den)}`] : []), `y = ax \\; ${text('の')} \\; a = ${constTex(n, den)}`, `${text('答え: ')} ${constTex(n, den)}`],
    mistakes,
    tags: ['prop_constant'],
    key: `propc:${n}/${den}:${asOver}`,
    verify: `${n}/${den}`,
  };
}

/**
 * 1 組の x, y から 式を 求める。
 *   ★2: 教科書の 例題・問((2, −6)、(3, 15)、(−8, 4) → −½)。x は 8 まで、y は 30 まで。4 回に 1 回 比例定数が ½・⅓・¼
 *   ★3: 比例定数が 分数(章の問題 B の (10, 15) → 3/2、チャレンジテストの 点 (5, −1) は 40%)
 */
function genPropFindA(rng: Rng, d: Difficulty): Problem {
  let p: number;
  let q: number;
  let x: number;
  if (d === 2 && rng.int(0, 3) > 0) {
    q = 1;
    x = rng.nonZero(8);
    p = rng.pick([-9, -8, -7, -6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8, 9].filter((v) => Math.abs(v * x) <= 30));
  } else if (d === 2) {
    q = rng.pick([2, 3, 4]);
    p = rng.bool() ? 1 : -1;
    x = q * rng.pick([1, 2]) * (rng.bool() ? 1 : -1);
  } else {
    q = rng.pick([2, 3, 4, 5]);
    p = rng.pick([2, 3, 4, 5].filter((v) => gcd(v, q) === 1)) * (rng.bool() ? 1 : -1);
    x = q * rng.pick([1, 1, 2]) * (rng.bool() ? 1 : -1);
  }
  const y = (p * x) / q;
  const mistakes: Mistake[] = [];
  if (y !== 0) mistakes.push(mistakeExpr(propInput(x, y), `a は y ÷ x = ${pm(y)} ÷ ${pm(paren(x))}。x ÷ y では ないよ`));
  mistakes.push(mistakeExpr(propInput(-p, q), `符号に 注意。${pm(y)} ÷ ${pm(paren(x))} の 符号を 確かめよう`));
  return {
    templateId: 'g1.func.prop',
    difficulty: d,
    prompt: `${text('y は x に比例し、')} x = ${x} ${text(' のとき ')} y = ${y} ${text('。\ny を x の式で表せ')}`,
    promptText: `y は x に比例し、x = ${pm(x)} のとき y = ${pm(y)}。y を x の式で表せ`,
    layout: 'prose',
    answer: { kind: 'expression', expected: propInput(p, q) },
    answerLabel: `y = ${propTex(p, q)}`,
    hint: 'y = ax に 分かっている x と y を 入れて、a を 求めよう',
    explanation: [
      `${text('比例なので')} \\; y = ax \\; ${text('と おく')}`,
      `${y} = a \\times ${paren(x)} \\quad ${text('(x と y を 代入)')}`,
      `a = ${y} \\div ${paren(x)} = ${constTex(p, q)}`,
      `${text('答え: ')} y = ${propTex(p, q)}`,
    ],
    mistakes,
    tags: [q === 1 ? 'prop_find_a' : 'prop_find_a_frac'],
    key: `prop2:${p}/${q}:${x}`,
    verify: `${p}/${q}*x`,
  };
}

/** 表から 式を 求める(★2。教科書の「y ÷ x の 値が いつも 同じ」) */
function genPropTable(rng: Rng, d: Difficulty): Problem {
  const a = rng.nonZero(6, 2);
  const start = rng.pick([-2, -1, 1]);
  const xs = Array.from({ length: 5 }, (_, i) => start + i);
  const ys = xs.map((x) => a * x);
  const k = xs.findIndex((x) => x !== 0 && x !== 1);
  return {
    templateId: 'g1.func.prop',
    difficulty: d,
    prompt: `${text('表は、y が x に 比例する ようすを 表している。\ny を x の 式で 表せ')}`,
    promptText: '表は、y が x に 比例する ようすを 表している。y を x の 式で 表せ',
    layout: 'prose',
    answer: { kind: 'expression', expected: propInput(a) },
    answerLabel: `y = ${propTex(a)}`,
    figure: { kind: 'table', head: ['x', ...xs.map(cell)], rows: [['y', ...ys.map(cell)]] },
    hint: 'x が 0 で ない ところの y ÷ x を 計算しよう',
    explanation: [`x = ${xs[k]} \\; ${text('のとき')} \\; y = ${ys[k]}`, `a = ${ys[k]} \\div ${paren(xs[k])} = ${a}`, `${text('答え: ')} y = ${propTex(a)}`],
    mistakes: [mistakeExpr(propInput(-a), '符号に 注意。x が 増えると y が 減っているか、増えているか 見よう'), mistakeExpr(propInput(1, a), `a は y ÷ x。x ÷ y では ないよ`)],
    tags: ['prop_table'],
    key: `propt:${a}:${start}`,
    verify: `${a}*x`,
  };
}

/** 1 組の x, y から 式を 求めて、別の x の y を 求める(★3。教科書の 例題) */
function genPropTwoStep(rng: Rng, d: Difficulty): Problem {
  // ★2 は 教科書の 基本の問題(x = 4 のとき y = −8 → x = 3、−6 の y)、★3 は 比例定数が 分数
  const frac = d === 3 && rng.bool(0.6);
  const [p, q] = frac ? reduce(rng.pick([1, 2, 3]) * (rng.bool() ? 1 : -1), rng.pick([2, 3])) : [rng.nonZero(5, 2), 1];
  const x1 = q * rng.nonZero(4);
  const y1 = (p * x1) / q;
  // x2 = −x1 は 符号を 変えるだけで 求まって しまうので 避ける
  const x2 = q * rng.pick([-4, -3, -2, -1, 1, 2, 3, 4].filter((v) => Math.abs(q * v) !== Math.abs(x1)));
  const y2 = (p * x2) / q;
  const mistakes: Mistake[] = [mistakeNum(-y2, '符号に 注意。比例定数の 符号を 確かめよう')];
  if (y1 !== 0) mistakes.push(mistakeNum(ratOf(x1 * x2, y1), `比例定数は y ÷ x = ${pm(y1)} ÷ ${pm(paren(x1))}。x ÷ y では ないよ`));
  return {
    templateId: 'g1.func.prop',
    difficulty: d,
    prompt: `${text('y は x に比例し、')} x = ${x1} ${text(' のとき ')} y = ${y1} ${text('。\n')} x = ${x2} ${text(' のときの y の 値は?')}`,
    promptText: `y は x に比例し、x = ${pm(x1)} のとき y = ${pm(y1)}。x = ${pm(x2)} のときの y の値は?`,
    layout: 'prose',
    answer: { kind: 'number', value: rat(y2) },
    hint: 'まず y = ax の a を 求めて、式を 作ってから x を 代入しよう',
    explanation: [
      `${y1} = a \\times ${paren(x1)} \\; ${text('より')} \\; a = ${constTex(p, q)}`,
      `y = ${propTex(p, q)}`,
      `y = ${constTex(p, q)} \\times ${paren(x2)} = ${y2}`,
      `${text('答え: ')} ${y2}`,
    ],
    mistakes,
    tags: ['prop_two_step'],
    key: `prop3t:${p}/${q}:${x1}:${x2}`,
    verify: `(${y1})/(${x1})*(${x2})`,
  };
}

/** 比例定数が 分数の 式に 値を 入れる(★3) */
function genPropValueFrac(rng: Rng, d: Difficulty): Problem {
  const den = rng.pick([2, 3, 4]);
  const num = rng.pick([1, 2, 3, 5].filter((v) => gcd(v, den) === 1)) * (rng.bool() ? 1 : -1);
  const x = den * rng.nonZero(4);
  const y = (num * x) / den;
  return {
    templateId: 'g1.func.prop',
    difficulty: d,
    prompt: `y = ${propTex(num, den)} \\quad x = ${x} \\; ${text('のときの y は?')}`,
    promptText: `y = ${propPlain(num, den)} で x = ${pm(x)} のときの y は?`,
    answer: { kind: 'number', value: rat(y) },
    hint: '分数を かけるときは 約分してから',
    explanation: [`y = ${constTex(num, den)} \\times ${paren(x)}`, `y = ${y}`, `${text('答え: ')} ${y}`],
    mistakes: [mistakeNum(-y, '符号に 注意'), mistakeNum(ratOf(x * den, num), `${pm(x)} を ${pm(num)}/${den} で わるのでは なく、かけるよ`)],
    tags: ['prop_fraction'],
    key: `prop3f:${num}/${den}:${x}`,
    verify: `${num}*(${x})/${den}`,
  };
}

/** y の 値から x を 求める(★3) */
function genPropFindX(rng: Rng, d: Difficulty): Problem {
  const a = rng.nonZero(9, 2);
  const x = rng.nonZero(6);
  const y = a * x;
  return {
    templateId: 'g1.func.prop',
    difficulty: d,
    prompt: `y = ${propTex(a)} \\quad y = ${y} \\; ${text('のときの x は?')}`,
    promptText: `y = ${propPlain(a)} で y = ${pm(y)} のときの x は?`,
    answer: { kind: 'number', value: rat(x) },
    hint: 'y に 値を 入れると x の 方程式に なる。両辺を 比例定数で わろう',
    explanation: [`${y} = ${propTex(a)} \\quad ${text('(y に 代入)')}`, `x = ${y} \\div ${paren(a)} = ${x}`, `${text('答え: ')} ${x}`],
    mistakes: [mistakeNum(y * a, `y = ${pm(y)} を 入れたら、両辺を ${pm(a)} で わるよ(かけるのでは ない)`), mistakeNum(-x, '符号に 注意。わる数の 符号を 確かめよう')],
    tags: ['prop_find_x'],
    key: `prop3x:${a}:${y}`,
    verify: `${y}/(${a})`,
  };
}

function genProp(rng: Rng, d: Difficulty): Problem {
  if (d === 2 && rng.int(0, 3) === 0) return rng.bool() ? genDomainWords(rng, d) : genDomain(rng, d);
  if (d === 3 && rng.int(0, 3) === 0) return genDomain(rng, d);
  if (d === 1) {
    const kind = weighted(rng, [['scene', 3], ['value', 4], ['constant', 2]]);
    return kind === 'scene' ? genPropScene(rng, d) : kind === 'value' ? genPropValue(rng, d) : genPropConstant(rng, d);
  }
  if (d === 2) {
    const kind = weighted(rng, [['find', 3], ['two', 2], ['table', 2], ['value', 1], ['constant', 1]]);
    return kind === 'find' ? genPropFindA(rng, d) : kind === 'two' ? genPropTwoStep(rng, d) : kind === 'table' ? genPropTable(rng, d) : kind === 'value' ? genPropValue(rng, d) : genPropConstant(rng, d);
  }
  const kind = weighted(rng, [['two', 3], ['frac', 3], ['valueFrac', 2], ['findX', 2]]);
  return kind === 'two' ? genPropTwoStep(rng, d) : kind === 'frac' ? genPropFindA(rng, d) : kind === 'valueFrac' ? genPropValueFrac(rng, d) : genPropFindX(rng, d);
}

// ---------------------------------------------------------------- 反比例

const divisors = (n: number): number[] => {
  const out: number[] = [];
  for (let i = 1; i <= Math.abs(n); i++) if (n % i === 0) out.push(i);
  return out;
};
/**
 * 反比例の 比例定数。教科書の 例題・問は 6〜24(18/x、8/x、24/x、−20/x、(3, −8) → −24)。
 * ★3 の 2 段の 問題・y から x は 章の問題と チャレンジテスト(12〜48)の 範囲まで
 */
const INV_BASES = [6, 8, 12, 16, 18, 20, 24];
const INV_BASES_BIG = [24, 30, 36, 48];
/** a の 約数(1 と a を のぞく)から 1 つ */
const innerDivisor = (rng: Rng, a: number): number => rng.pick(divisors(a).filter((v) => v > 1 && v < Math.abs(a)));

/** 反比例の 場面(教科書の 1 節・章の問題: 長方形・平行四辺形の 面積、ひもを 等分、道のりと 分速、容器と 毎分の 水) */
const INV_SCENES: { story: (a: number) => string; a: number[]; rule: string }[] = [
  { story: (a) => `面積が ${a} cm² の 長方形の 横の 長さを x cm、縦の 長さを y cm とする`, a: [12, 18, 24], rule: '(横)×(縦)=(面積)' },
  { story: (a) => `面積が ${a} cm² の 平行四辺形の 底辺を x cm と すると、高さは y cm に なる`, a: [8, 12, 16], rule: '(底辺)×(高さ)=(面積)' },
  { story: (a) => `${a} cm の ひもを x 等分 すると、1 本の 長さは y cm に なる`, a: [60, 120], rule: '(本数)×(1 本の 長さ)=(ひもの 長さ)' },
  { story: (a) => `${a} m の 道のりを 分速 x m で 歩くと、y 分 かかる`, a: [600, 1200], rule: '(速さ)×(時間)=(道のり)' },
  { story: (a) => `${a} L 入る 容器に 毎分 x L ずつ 水を 入れると、いっぱいに なるまでに y 分 かかる`, a: [24, 30, 60], rule: '(1 分間に 入る 量)×(時間)=(容器の 量)' },
];

/** 場面から 反比例の 式を 選ぶ(★1) */
function genInvScene(rng: Rng, d: Difficulty): Problem {
  const s = rng.pick(INV_SCENES);
  const a = rng.pick(s.a);
  const story = s.story(a);
  const correct = `y = ${invTex(a)}`;
  const { answer, mistakes } = choose(rng, correct, [
    { opt: `y = ${a}x`, say: `x が 2 倍に なると y は 1/2 倍。かけ算の 式 y = ${a}x は 比例だよ` },
    { opt: `y = \\frac{x}{${a}}`, say: `${s.rule} だから、y は ${a} ÷ x。x ÷ ${a} では ないよ` },
    { opt: `y = ${a} - x`, say: `ひき算では なく、x × y = ${a} に なる 関係だよ` },
  ]);
  return {
    templateId: 'g1.func.invprop',
    difficulty: d,
    prompt: text(`${story}。\ny を x の 式で 表すと?`),
    promptText: `${story}。y を x の 式で 表すと?`,
    layout: 'prose',
    answer,
    mistakes,
    hint: `言葉の 式 ${s.rule} を 作ってから、y = の 形に しよう`,
    explanation: [text(s.rule), `x \\times y = ${a}`, `${text('答え: ')} y = ${invTex(a)} \\quad ${text(`(比例定数は ${a})`)}`],
    tags: ['invprop_model'],
    key: `invs:${INV_SCENES.indexOf(s)}:${a}`,
    verify: String(answer.kind === 'choice' ? answer.correct : -1),
  };
}

/** y = a/x の x に 値を 入れる(★1 は 正の数が 中心、★2 は 負の数も・ときどき 分数の 答え。教科書の 表の 24/x に x = 5) */
function genInvValue(rng: Rng, d: Difficulty): Problem {
  const base = rng.pick(INV_BASES);
  const a = d === 1 ? base : rng.bool() ? base : -base;
  // ★1 も 4 回に 1 回は x が 負の数
  const neg = d === 1 ? rng.int(0, 3) === 0 : rng.bool();
  // ★2 は 5 回に 1 回、わり切れない x(答えが 分数)
  const fracX = [3, 4, 5, 6].filter((v) => base % v !== 0);
  const absX = d > 1 && fracX.length && rng.int(0, 4) === 0 ? rng.pick(fracX) : innerDivisor(rng, base);
  const x = neg ? -absX : absX;
  const y = ratOf(a, x);
  const mistakes: Mistake[] = [mistakeNum(a * x, `y = ${invPlain(a)} は ${pm(a)} ÷ x。かけるのでは なく わるよ`)];
  if (a < 0 || x < 0) mistakes.push(mistakeNum(ratOf(-a, x), '符号に 注意。わり算の 符号も かけ算と 同じ きまり'));
  return {
    templateId: 'g1.func.invprop',
    difficulty: d,
    prompt: `y = ${invTex(a)} \\quad x = ${x} \\; ${text('のときの y は?')}`,
    promptText: `y = ${invPlain(a)} で x = ${pm(x)} のときの y は?`,
    answer: { kind: 'number', value: y },
    hint: x < 0 ? '比例定数を x で わる。負の数で わるときは 符号に 注意' : '比例定数を x で わるだけ。x × y は いつも 同じ数',
    explanation: [`y = ${a} \\div ${paren(x)}`, `y = ${toTex(y)}`, `${text('答え: ')} ${toTex(y)}`],
    mistakes,
    tags: ['invprop_value'],
    key: `inv:${a}:${x}`,
    verify: `${a}/(${x})`,
  };
}

/** 反比例の 比例定数を 答える(★1) */
function genInvConstant(rng: Rng, d: Difficulty): Problem {
  const a = rng.pick(INV_BASES) * (rng.bool() ? 1 : -1);
  return {
    templateId: 'g1.func.invprop',
    difficulty: d,
    prompt: `y = ${invTex(a)} \\quad ${text('の 比例定数は?')}`,
    promptText: `y = ${invPlain(a)} の 比例定数は?`,
    answer: { kind: 'number', value: rat(a) },
    hint: 'y = a/x の a が 比例定数。符号も ふくめて',
    explanation: [`y = \\frac{a}{x} \\; ${text('の')} \\; a = ${a}`, `${text('答え: ')} ${a}`],
    mistakes: [mistakeNum(-a, '比例定数は 符号も ふくめて 答えるよ'), mistakeNum(ratOf(1, a), `反比例の 比例定数は 分子の ${pm(a)} だよ`)],
    tags: ['invprop_constant'],
    key: `invc:${a}`,
    verify: String(a),
  };
}

/** 反比例の 式の 選択肢(a/x が 正解。比例・逆・符号の 取りちがえ) */
function invChoices(rng: Rng, a: number, x: number, y: number) {
  const propA = y / x;
  return choose(rng, `y = ${invTex(a)}`, [
    {
      opt: Number.isInteger(propA) ? `y = ${propTex(propA)}` : `y = ${a}x`,
      say: Number.isInteger(propA) ? `y ÷ x を 求めると 比例の 式。反比例は x × y = ${pm(a)} が いつも 同じ` : `反比例は y = a/x。a は x × y = ${pm(a)} だよ`,
    },
    { opt: `y = ${invTex(-a)}`, say: `符号に 注意。${pm(x)} × ${pm(paren(y))} = ${pm(a)}` },
    { opt: `y = ${a < 0 ? '-' : ''}\\frac{x}{${Math.abs(a)}}`, say: 'y = a/x の 形。x は 分母だよ' },
    { opt: `y = ${a}x` },
  ]);
}

/** 教科書の 1 組の x, y(x は ±2〜5、y は ±2〜8。(5, −4)、(2, −8)、(−2, 6)、(3, −8)) */
function invPair(rng: Rng): [number, number] {
  for (;;) {
    const x = rng.nonZero(5, 2);
    const y = rng.nonZero(8, 2);
    if (Math.abs(x * y) <= 30) return [x, y];
  }
}

/** 1 組の x, y から 式を 求める(★2、選択式) */
function genInvFindA(rng: Rng, d: Difficulty): Problem {
  const [x, y] = invPair(rng);
  const a = x * y;
  const { answer, mistakes } = invChoices(rng, a, x, y);
  return {
    templateId: 'g1.func.invprop',
    difficulty: d,
    prompt: `${text('y は x に反比例し、')} x = ${x} ${text(' のとき ')} y = ${y} ${text('。\ny を x の式で表すと?')}`,
    promptText: `y は x に反比例し、x = ${pm(x)} のとき y = ${pm(y)}。y を x の式で表すと?`,
    layout: 'prose',
    answer,
    mistakes,
    hint: 'y = a/x と おいて、a = x × y を 計算しよう',
    explanation: [`${text('反比例なので')} \\; y = \\frac{a}{x} \\; ${text('と おく')}`, `a = x \\times y = ${x} \\times ${paren(y)} = ${a}`, `${text('答え: ')} y = ${invTex(a)}`],
    tags: ['invprop_find_a'],
    key: `inv2:${a}:${x}`,
    verify: String(answer.kind === 'choice' ? answer.correct : -1),
  };
}

/** 表から 反比例の 式を 選ぶ(★2。教科書の 12/x・24/x・6/x の 表) */
function genInvTable(rng: Rng, d: Difficulty): Problem {
  const base = rng.pick([6, 12, 24]);
  const a = rng.bool() ? base : -base;
  const xs = divisors(base).filter((v) => v <= 6).slice(0, 5);
  const ys = xs.map((x) => a / x);
  const { answer, mistakes } = invChoices(rng, a, xs[1], ys[1]);
  return {
    templateId: 'g1.func.invprop',
    difficulty: d,
    prompt: `${text('表は、y が x に 反比例する ようすを 表している。\ny を x の 式で 表すと?')}`,
    promptText: '表は、y が x に 反比例する ようすを 表している。y を x の 式で 表すと?',
    layout: 'prose',
    answer,
    mistakes,
    figure: { kind: 'table', head: ['x', ...xs.map(cell)], rows: [['y', ...ys.map(cell)]] },
    hint: 'x × y を 計算しよう。どこで かけても 同じ 数に なる',
    explanation: [`${xs[1]} \\times ${paren(ys[1])} = ${a}`, `${text('x × y が いつも')} \\; ${a} \\; ${text('なので')}`, `${text('答え: ')} y = ${invTex(a)}`],
    tags: ['invprop_table'],
    key: `invt:${a}`,
    verify: String(answer.kind === 'choice' ? answer.correct : -1),
  };
}

/**
 * 1 組の x, y から 別の x の y を 求める。
 *   ★2: 教科書の 基本の問題(x = 3 のとき y = −8 → x = 2、−4 の y)
 *   ★3: 比例定数が 24〜48
 */
function genInvTwoStep(rng: Rng, d: Difficulty): Problem {
  let a: number;
  let x1: number;
  if (d === 2) {
    const [x, y] = invPair(rng);
    [a, x1] = [x * y, x];
  } else {
    const base = rng.pick(INV_BASES_BIG);
    a = rng.bool() ? base : -base;
    x1 = innerDivisor(rng, base) * (rng.bool() ? 1 : -1);
  }
  const y1 = a / x1;
  const cands = divisors(a)
    .filter((v) => v <= 8 && v !== Math.abs(a))
    .flatMap((v) => [v, -v])
    // x2 = −x1 は 符号を 変えるだけで 求まり、比例と まちがえても 同じ 答えに なるので 避ける
    .filter((v) => Math.abs(v) !== Math.abs(x1));
  const x2 = rng.pick(cands.length ? cands : [-x1]);
  const y2 = a / x2;
  return {
    templateId: 'g1.func.invprop',
    difficulty: d,
    prompt: `${text('y は x に反比例し、')} x = ${x1} ${text(' のとき ')} y = ${y1} ${text('。\n')} x = ${x2} ${text(' のときの y の 値は?')}`,
    promptText: `y は x に反比例し、x = ${pm(x1)} のとき y = ${pm(y1)}。x = ${pm(x2)} のときの y の値は?`,
    layout: 'prose',
    answer: { kind: 'number', value: rat(y2) },
    hint: 'まず a = x × y を 求めて 式を 作り、x を 代入しよう',
    explanation: [`a = ${x1} \\times ${paren(y1)} = ${a}`, `y = ${invTex(a)}`, `y = ${a} \\div ${paren(x2)} = ${y2}`, `${text('答え: ')} ${y2}`],
    mistakes: [mistakeNum(ratOf(y1 * x2, x1), '比例と まちがえて いないかな。反比例は x × y が いつも 同じ'), mistakeNum(-y2, '符号に 注意')],
    tags: ['invprop_two_step'],
    key: `inv3t:${a}:${x1}:${x2}`,
    verify: `(${x1})*(${y1})/(${x2})`,
  };
}

/** y の 値から x を 求める(★3) */
function genInvFindX(rng: Rng, d: Difficulty): Problem {
  const base = rng.pick([...INV_BASES, ...INV_BASES_BIG]);
  const a = rng.bool() ? base : -base;
  const y = innerDivisor(rng, base) * (rng.bool() ? 1 : -1);
  const x = a / y;
  return {
    templateId: 'g1.func.invprop',
    difficulty: d,
    prompt: `y = ${invTex(a)} \\quad y = ${y} \\; ${text('のときの x は?')}`,
    promptText: `y = ${invPlain(a)} で y = ${pm(y)} のときの x は?`,
    answer: { kind: 'number', value: rat(x) },
    hint: 'x × y = a。y が 分かっているので a を y で わろう',
    explanation: [`x \\times ${paren(y)} = ${a}`, `x = ${a} \\div ${paren(y)} = ${x}`, `${text('答え: ')} ${x}`],
    mistakes: [mistakeNum(a * y, `x × ${pm(paren(y))} = ${pm(a)} だから、${pm(a)} を ${pm(y)} で わるよ`), mistakeNum(-x, '符号に 注意')],
    tags: ['invprop_find_x'],
    key: `inv3:${a}:${y}`,
    verify: `${a}/(${y})`,
  };
}

function genInvProp(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    const kind = weighted(rng, [['scene', 3], ['value', 5], ['constant', 2]]);
    return kind === 'scene' ? genInvScene(rng, d) : kind === 'value' ? genInvValue(rng, d) : genInvConstant(rng, d);
  }
  if (d === 2) {
    const kind = weighted(rng, [['find', 3], ['two', 2], ['table', 2], ['value', 3]]);
    return kind === 'find' ? genInvFindA(rng, d) : kind === 'two' ? genInvTwoStep(rng, d) : kind === 'table' ? genInvTable(rng, d) : genInvValue(rng, d);
  }
  // 利用(スライドショー・電子レンジ)の 文章題は 出さない: 文が 分かりにくく 難しすぎる(先生の判定 2026-10-16)
  return rng.bool() ? genInvTwoStep(rng, d) : genInvFindX(rng, d);
}

// ---------------------------------------------------------------- 座標

const RANGE = 6;
/** 点の 座標の 範囲(教科書の 図は ±4〜5) */
const PT = 5;
const mistakePoint = (x: number, y: number, say: string): Mistake => ({ answer: { kind: 'numbers', values: [rat(x), rat(y)], ordered: true }, say });
/** 原点から どう 動くか(解説用) */
const walk = (x: number, y: number): string =>
  text(`原点から 横に ${x === 0 ? '0(動かない)' : x < 0 ? `左へ ${-x}` : `右へ ${x}`}、縦に ${y === 0 ? '0(動かない)' : y < 0 ? `下へ ${-y}` : `上へ ${y}`}`);

/** 図の 点 A の 座標を 読む(★1 は 第 1 象限が 中心、★2 は どこでも・軸の 上も) */
function genCoordRead(rng: Rng, d: Difficulty): Problem {
  let x: number;
  let y: number;
  // 教科書の 問 1 は はじめから 4 つの 向きと 軸の 上の 点 (0, 2)・(−4, 0) を 読む。★1 は ±4、★2 は ±5
  const r = d === 1 ? 4 : PT;
  if (rng.int(0, d === 1 ? 5 : 4) === 0) {
    [x, y] = rng.bool() ? [rng.nonZero(r), 0] : [0, rng.nonZero(r)];
  } else {
    x = rng.nonZero(r);
    y = rng.nonZero(r);
  }
  const mistakes: Mistake[] = [];
  if (x !== 0) mistakes.push(mistakePoint(-x, y, `x 座標の 符号に 注意。原点より ${x < 0 ? '左' : '右'}なので ${x < 0 ? '負' : '正'}の数`));
  if (y !== 0) mistakes.push(mistakePoint(x, -y, `y 座標の 符号に 注意。原点より ${y < 0 ? '下' : '上'}なので ${y < 0 ? '負' : '正'}の数`));
  return {
    templateId: 'g1.func.coord',
    difficulty: d,
    prompt: `${text('点 A の 座標を 答えよ')}`,
    promptText: '点 A の座標を答えよ',
    answer: { kind: 'numbers', values: [rat(x), rat(y)], ordered: true },
    hint: '横(x)が 先、縦(y)が 後。左と 下は マイナス',
    explanation: [walk(x, y), `${text('x 座標が')} \\; ${x}${text('、y 座標が')} \\; ${y}`, `${text('答え: ')} ${pt(x, y)}`],
    mistakes,
    tags: [x === 0 || y === 0 ? 'coord_axis' : 'coord_read'],
    key: `coord:${x}:${y}`,
    figure: { kind: 'plane', range: RANGE, points: [{ x, y, label: 'A' }], guides: x !== 0 && y !== 0 ? [{ x, y }] : [] },
    verify: `[${x},${y}]`,
  };
}

/** 座標から 点を 選ぶ(★2。教科書の「点を とる」の 代わり。x と y・符号の 取りちがえを 並べる) */
function genCoordPick(rng: Rng, d: Difficulty): Problem {
  let x = rng.nonZero(5);
  let y = rng.nonZero(5);
  while (Math.abs(x) === Math.abs(y)) y = rng.nonZero(5);
  const cands = rng.shuffle([
    { x, y, say: '' },
    { x: y, y: x, say: 'x 座標と y 座標が 逆。横(x)が 先、縦(y)が 後だよ' },
    { x: -x, y, say: `x 座標の 符号に 注意。${x < 0 ? '負の数は 原点より 左' : '正の数は 原点より 右'}` },
    { x, y: -y, say: `y 座標の 符号に 注意。${y < 0 ? '負の数は 原点より 下' : '正の数は 原点より 上'}` },
  ]);
  const labels = ['A', 'B', 'C', 'D'];
  const options = labels.map((l) => `${text(`点 ${l}`)}`);
  const correct = cands.findIndex((c) => c.x === x && c.y === y);
  const mistakes = cands.map((c, i) => ({ c, i })).filter(({ c }) => c.say).map(({ c, i }) => ({ answer: { kind: 'choice' as const, options, correct: i }, say: c.say }));
  return {
    templateId: 'g1.func.coord',
    difficulty: d,
    prompt: `${text('座標が')} \\; ${pt(x, y)} \\; ${text('の 点は どれ?')}`,
    promptText: `座標が ${ptPlain(x, y)} の点はどれ?`,
    answer: { kind: 'choice', options, correct },
    mistakes,
    hint: 'x 座標の 分だけ 横に、y 座標の 分だけ 縦に 進んだ ところ',
    explanation: [walk(x, y), `${text('答え: ')} ${text(`点 ${labels[correct]}`)}`],
    tags: ['coord_plot'],
    key: `coordp:${x}:${y}:${cands.map((c) => `${c.x},${c.y}`).join('|')}`,
    figure: { kind: 'plane', range: RANGE, points: cands.map((c, i) => ({ x: c.x, y: c.y, label: labels[i] })) },
    verify: String(correct),
  };
}

/** 対称な点(★3、選択式) */
function genCoordSymmetry(rng: Rng, d: Difficulty): Problem {
  for (;;) {
    const x = rng.nonZero(PT);
    const y = rng.nonZero(PT);
    // x = y や x = −y のとき 選択肢が 同じ 座標に なる
    if (Math.abs(x) === Math.abs(y)) continue;
    const kind = rng.pick(['x', 'y', 'o'] as const);
    const label = { x: 'x 軸', y: 'y 軸', o: '原点' }[kind];
    const ans: [number, number] = kind === 'x' ? [x, -y] : kind === 'y' ? [-x, y] : [-x, -y];
    // 座標は 選ばせずに ( , ) の 欄で 答える(先生の指摘 2026-10-16)。取りちがえは よくある まちがいで 拾う
    const same = (a: number[], b: number[]) => a[0] === b[0] && a[1] === b[1];
    const mistakes: Mistake[] = [
      { pt: [x, -y], say: 'x 軸で 折り返すと y の 符号だけが 変わる。何に ついて 対称か 確かめよう' },
      { pt: [-x, y], say: 'y 軸で 折り返すと x の 符号だけが 変わる。何に ついて 対称か 確かめよう' },
      { pt: [-x, -y], say: '原点に ついて 対称なら x も y も 符号が 変わる。何に ついて 対称か 確かめよう' },
      { pt: [y, x], say: 'x と y を 入れかえるのでは なく、符号を 変えるよ' },
      { pt: [x, y], say: '点 A の まま。折り返した 先の 点を 答えよう' },
    ]
      .filter((m) => !same(m.pt, ans))
      .map((m) => mistakePoint(m.pt[0], m.pt[1], m.say));
    const answer: Problem['answer'] = { kind: 'numbers', values: [rat(ans[0]), rat(ans[1])], ordered: true };
    return {
      templateId: 'g1.func.coord',
      difficulty: d,
      prompt: `${text('点 A')} \\; ${pt(x, y)} \\; ${text(`と ${label}に ついて 対称な 点の 座標は?`)}`,
      promptText: `点 A ${ptPlain(x, y)} と ${label}について対称な点の座標は?`,
      answer,
      mistakes,
      hint: kind === 'x' ? 'x 軸で 折り返すと y の 符号だけ 変わる' : kind === 'y' ? 'y 軸で 折り返すと x の 符号だけ 変わる' : '原点に ついて 対称なら x も y も 符号が 変わる',
      explanation: [
        kind === 'x' ? text('x 軸で 折り返す → y 座標の 符号だけ 変わる') : kind === 'y' ? text('y 軸で 折り返す → x 座標の 符号だけ 変わる') : text('原点に ついて 対称 → x 座標も y 座標も 符号が 変わる'),
        `${text('答え: ')} ${pt(ans[0], ans[1])}`,
      ],
      tags: ['coord_symmetry'],
      key: `coord3:${x}:${y}:${kind}`,
      figure: { kind: 'plane', range: RANGE, points: [{ x, y, label: 'A' }] },
      verify: `[${ans[0]},${ans[1]}]`,
    };
  }
}

/** 点を 移動した 点の 座標(★3) */
function genCoordMove(rng: Rng, d: Difficulty): Problem {
  const x = rng.nonZero(5);
  const y = rng.nonZero(5);
  // 移動した 先も ±5 の 中に
  const step = (v: number): number => rng.pick([-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6].filter((t) => Math.abs(v + t) <= PT));
  const dx = step(x);
  const dy = step(y);
  const [nx, ny] = [x + dx, y + dy];
  const move = `${dx > 0 ? `右へ ${dx}` : `左へ ${-dx}`}、${dy > 0 ? `上へ ${dy}` : `下へ ${-dy}`}`;
  return {
    templateId: 'g1.func.coord',
    difficulty: d,
    prompt: `${text('点 A')} \\; ${pt(x, y)} \\; ${text(`を ${move} だけ 移動した 点の 座標を 答えよ`)}`,
    promptText: `点 A ${ptPlain(x, y)} を ${move} だけ移動した点の座標を答えよ`,
    layout: 'prose',
    answer: { kind: 'numbers', values: [rat(nx), rat(ny)], ordered: true },
    hint: '右は x に たす、左は x から ひく。上は y に たす、下は y から ひく',
    explanation: [`x \\; ${text('座標')} \\; ${x} ${dx > 0 ? '+' : '-'} ${Math.abs(dx)} = ${nx}`, `y \\; ${text('座標')} \\; ${y} ${dy > 0 ? '+' : '-'} ${Math.abs(dy)} = ${ny}`, `${text('答え: ')} ${pt(nx, ny)}`],
    mistakes: [
      mistakePoint(x - dx, ny, `${dx > 0 ? '右へ 動くと x 座標は 増える' : '左へ 動くと x 座標は 減る'}よ`),
      mistakePoint(nx, y - dy, `${dy > 0 ? '上へ 動くと y 座標は 増える' : '下へ 動くと y 座標は 減る'}よ`),
      mistakePoint(x + dy, y + dx, '横の 移動は x 座標、縦の 移動は y 座標に 足すよ'),
    ],
    tags: ['coord_move'],
    key: `coordm:${x}:${y}:${dx}:${dy}`,
    figure: { kind: 'plane', range: RANGE, points: [{ x, y, label: 'A' }] },
    verify: `[${x}+(${dx}),${y}+(${dy})]`,
  };
}

function genCoord(rng: Rng, d: Difficulty): Problem {
  if (d === 1) return genCoordRead(rng, d);
  if (d === 2) return rng.int(0, 2) === 0 ? genCoordPick(rng, d) : genCoordRead(rng, d);
  return rng.bool(0.6) ? genCoordSymmetry(rng, d) : genCoordMove(rng, d);
}

// ---------------------------------------------------------------- グラフから式

/** 比例の グラフから 式を 選ぶ(教科書は はじめから y = −2x も かく。★1 は ±3 まで、★2 は y = −5x まで) */
function genGraphProp(rng: Rng, d: Difficulty): Problem {
  const a = rng.nonZero(d === 1 ? 3 : 5);
  // 図の 中に 入る 格子点(x は 3 まで)
  const px = rng.int(1, Math.min(3, Math.floor(RANGE / Math.abs(a))));
  const { answer, mistakes } = choose(rng, `y = ${propTex(a)}`, [
    { opt: `y = ${propTex(-a)}`, say: a > 0 ? '右上がりの 直線は 比例定数が 正' : '右下がりの 直線は 比例定数が 負' },
    { opt: `y = ${invTex(a)}`, say: '原点を 通る 直線は 比例。双曲線(曲線)が 反比例だよ' },
    ...(Math.abs(a) > 1 ? [{ opt: `y = ${propTex(1, a)}`, say: `x が 1 増えると y は ${pm(a)} 増える。a = y ÷ x だよ` }] : []),
    { opt: `y = x ${a < 0 ? '-' : '+'} ${Math.abs(a)}` },
  ]);
  return {
    templateId: 'g1.func.graph',
    difficulty: d,
    prompt: `${text('この グラフを 表す 式は?')}`,
    promptText: 'このグラフを表す式は?',
    answer,
    mistakes,
    hint: '原点を 通る 直線は 比例。通っている 点を ひとつ 読んで y = ax に 入れよう',
    explanation: [`${text('原点を 通る 直線 → 比例')} \\; y = ax`, `${text('点')} \\; ${pt(px, a * px)} \\; ${text('を 通る')}`, `${a * px} = a \\times ${px} \\; ${text('より')} \\; a = ${a}`, `${text('答え: ')} y = ${propTex(a)}`],
    tags: ['graph_prop'],
    key: `graph:p:${a}:${px}`,
    figure: { kind: 'plane', range: RANGE, graphs: [{ type: 'prop', a }] },
    verify: String(answer.kind === 'choice' ? answer.correct : -1),
  };
}

/** 反比例の グラフから 式を 選ぶ(通る 格子点を 1 つ 示す。教科書の 6/x・4/x・−8/x が ★2、12/x は ★3) */
function genGraphInv(rng: Rng, d: Difficulty): Problem {
  const a = rng.pick(d === 2 ? [4, 6, 8, -4, -6, -8] : [6, 8, 12, -6, -8, -12]);
  const pts = divisors(a).filter((v) => v <= RANGE && Math.abs(a) / v <= RANGE && v !== 1 && v !== Math.abs(a));
  const px = rng.pick(pts.length ? pts : [2]) * (rng.bool() ? 1 : -1);
  const py = a / px;
  const { answer, mistakes } = choose(rng, `y = ${invTex(a)}`, [
    { opt: `y = ${invTex(-a)}`, say: `通る 点の x × y を 計算しよう。${pm(px)} × ${pm(paren(py))} = ${pm(a)}` },
    { opt: `y = ${propTex(a)}`, say: '双曲線(曲線)は 反比例。原点を 通る 直線が 比例だよ' },
    { opt: `y = \\frac{x}{${Math.abs(a)}}` },
    { opt: `y = ${invTex(a * 2)}` },
  ]);
  return {
    templateId: 'g1.func.graph',
    difficulty: d,
    prompt: `${text('この グラフを 表す 式は?')}`,
    promptText: 'このグラフを表す式は?',
    answer,
    mistakes,
    hint: '軸に 近づいていく 曲線(双曲線)は 反比例。通っている 点の x × y が a',
    explanation: [`${text('双曲線 → 反比例')} \\; y = \\frac{a}{x}`, `${text('点')} \\; ${pt(px, py)} \\; ${text('を 通る')}`, `a = ${px} \\times ${paren(py)} = ${a}`, `${text('答え: ')} y = ${invTex(a)}`],
    tags: ['graph_invprop'],
    key: `graph:i:${a}:${px}`,
    figure: { kind: 'plane', range: RANGE, graphs: [{ type: 'invprop', a }] },
    verify: String(answer.kind === 'choice' ? answer.correct : -1),
  };
}

/**
 * 比例定数が 分数の グラフから 式を 書く(x 座標も y 座標も 整数の 点を 読む)。
 *   ★2: 教科書の 例題 (2, 1) → ½x と 問の ⅔x・−⅓x・¾x(分子が 分母より 小さい、分母 4 まで)
 *   ★3: 章の問題の ⅗x、3/2 x のような 形(分母 5 まで・分子が 大きい ものも)
 */
function genGraphPropFrac(rng: Rng, d: Difficulty): Problem {
  const q = rng.pick(d === 2 ? [2, 3, 4] : [2, 3, 4, 5]);
  const p = rng.pick([1, 2, 3, 4, 5].filter((v) => (d === 2 ? v < q : v < q * 2 && (v > 1 || q === 5)) && v !== q && gcd(v, q) === 1)) * (rng.bool() ? 1 : -1);
  const [px, py] = [q, p];
  return {
    templateId: 'g1.func.graph',
    difficulty: d,
    prompt: `${text('この グラフは 比例の グラフ。\ny を x の 式で 表せ')}`,
    promptText: 'このグラフは比例のグラフ。y を x の式で表せ',
    answer: { kind: 'expression', expected: propInput(p, q) },
    answerLabel: `y = ${propTex(p, q)}`,
    hint: 'x 座標も y 座標も 整数の 点を さがして、a = y ÷ x を 計算しよう',
    explanation: [`${text('点')} \\; ${pt(px, py)} \\; ${text('を 通る(x も y も 整数の 点)')}`, `a = ${py} \\div ${px} = ${constTex(p, q)}`, `${text('答え: ')} y = ${propTex(p, q)}`],
    mistakes: [mistakeExpr(propInput(q, p), `a は y ÷ x = ${pm(py)} ÷ ${px}。x ÷ y では ないよ`), mistakeExpr(propInput(-p, q), a0(p))],
    tags: ['graph_prop_frac'],
    key: `graph:f:${p}/${q}`,
    figure: { kind: 'plane', range: RANGE, graphs: [{ type: 'prop', a: p / q }] },
    verify: `${p}/${q}*x`,
  };
}
/** 式に 合う グラフを ア・イ・ウ から 選ぶ(★1。教科書の「y = 2x の グラフを かく」の 代わり) */
function genGraphPickLine(rng: Rng, d: Difficulty): Problem {
  const a = rng.int(1, 3);
  // y = 2x と y = 3x は 傾きが 近く、名前も 図の 上で 重なるので 並べない
  const b = a === 1 ? rng.pick([2, 3]) : 1;
  const lines = rng.shuffle([
    { a, say: '' },
    { a: -a, say: `比例定数が 正の 数なので 右上がりの 直線。x = 1 のとき y = ${a} の 点を 通るよ` },
    { a: b, say: `x = 1 のとき y = ${a} に なる 直線を さがそう。この 直線は (1, ${b}) を 通るよ` },
  ]);
  const labels = ['ア', 'イ', 'ウ'];
  const options = labels.map((l) => text(l));
  const correct = lines.findIndex((l) => l.a === a);
  return {
    templateId: 'g1.func.graph',
    difficulty: d,
    prompt: `y = ${propTex(a)} \\; ${text('の グラフは どれ?')}`,
    promptText: `y = ${propPlain(a)} のグラフはどれ?`,
    answer: { kind: 'choice', options, correct },
    mistakes: lines.map((l, i) => ({ l, i })).filter(({ l }) => l.say).map(({ l, i }) => ({ answer: { kind: 'choice' as const, options, correct: i }, say: l.say })),
    hint: `比例の グラフは 原点を 通る 直線。x = 1 のとき y は いくつ?`,
    explanation: [`${text('原点')} \\; (0, \\ 0) \\; ${text('と、x = 1 のとき y =')} \\; ${a} \\; ${text('の 点')} \\; (1, \\ ${a}) \\; ${text('を 通る 直線')}`, `${text('答え: ')} ${text(labels[correct])}`],
    tags: ['graph_pick'],
    key: `graph:k:${lines.map((l) => l.a).join(',')}`,
    figure: { kind: 'plane', range: RANGE, graphs: lines.map((l, i) => ({ type: 'prop' as const, a: l.a, label: labels[i] })) },
    verify: String(correct),
  };
}

const a0 = (p: number): string => (p > 0 ? '右上がりの 直線は 比例定数が 正' : '右下がりの 直線は 比例定数が 負');

/**
 * 増加・減少(★2。教科書の「y = ax の 増減と グラフ」「y = a/x の 増減と グラフ」と 基本の問題 3)。
 * 比例は a > 0 なら 増加、反比例は x > 0(x < 0)の 範囲で a > 0 なら 減少
 */
function genGraphTrend(rng: Rng, d: Difficulty): Problem {
  const inv = rng.bool();
  const a = inv ? rng.pick([4, 6, 8, 12]) * (rng.bool() ? 1 : -1) : rng.nonZero(5);
  const up = inv ? a < 0 : a > 0;
  const range = inv ? (rng.bool() ? 'x > 0' : 'x < 0') : '';
  const right = up ? '増加する' : '減少する';
  const wrong = up ? '減少する' : '増加する';
  const say = inv
    ? `反比例 y = a/x は、a ${a > 0 ? '> 0 なら x が 増えると y は 減る' : '< 0 なら x が 増えると y も 増える'}(x > 0、x < 0 の どちらでも)`
    : `比例 y = ax は、a ${a > 0 ? '> 0 なら 右上がり(y も 増える)' : '< 0 なら 右下がり(y は 減る)'}`;
  const { answer, mistakes } = choose(rng, text(right), [{ opt: text(wrong), say }, { opt: text('変わらない') }]);
  const eq = inv ? `y = ${invTex(a)}` : `y = ${propTex(a)}`;
  return {
    templateId: 'g1.func.graph',
    difficulty: d,
    prompt: `${eq} \\; ${text('で、')}${range ? `${range} \\; ${text('の 範囲で ')}` : ''}${text('x の 値が 増加すると、y の 値は?')}`,
    promptText: `${inv ? `y = ${invPlain(a)}` : `y = ${propPlain(a)}`} で、${range ? `${range} の範囲で ` : ''}x の値が増加すると、y の値は?`,
    answer,
    mistakes,
    hint: inv ? '反比例の グラフ(双曲線)を 思い出そう。比例定数の 符号で 決まる' : '比例の グラフが 右上がりか 右下がりかは、比例定数の 符号で 決まる',
    explanation: [
      inv ? `${text('反比例で 比例定数が')} \\; ${a} \\; ${text(a > 0 ? '(正の数)' : '(負の数)')}` : `${text('比例で 比例定数が')} \\; ${a} \\; ${text(a > 0 ? '(正の数)→ 右上がり' : '(負の数)→ 右下がり')}`,
      `${text(`答え: ${right}`)}`,
    ],
    tags: ['graph_trend'],
    key: `graph:t:${inv}:${a}:${range}`,
    figure: { kind: 'plane', range: RANGE, graphs: [{ type: inv ? 'invprop' : 'prop', a }] },
    verify: String(answer.kind === 'choice' ? answer.correct : -1),
  };
}

function genGraph(rng: Rng, d: Difficulty): Problem {
  if (d === 1) return rng.bool() ? genGraphPickLine(rng, d) : genGraphProp(rng, d);
  if (d === 2) {
    const kind = weighted(rng, [['prop', 1], ['frac', 2], ['inv', 2], ['trend', 1]]);
    return kind === 'prop' ? genGraphProp(rng, d) : kind === 'frac' ? genGraphPropFrac(rng, d) : kind === 'inv' ? genGraphInv(rng, d) : genGraphTrend(rng, d);
  }
  return rng.bool(0.6) ? genGraphPropFrac(rng, d) : genGraphInv(rng, d);
}

registerTemplate({ id: 'g1.func.prop', unit: UNIT, title: '比例', timeLimit: { 1: 40, 2: 50, 3: 60 }, generate: genProp });
registerTemplate({ id: 'g1.func.invprop', unit: UNIT, title: '反比例', timeLimit: { 1: 40, 2: 50, 3: 60 }, generate: genInvProp });
registerTemplate({ id: 'g1.func.coord', unit: UNIT, title: '座標', timeLimit: { 1: 35, 2: 40, 3: 50 }, generate: genCoord });
registerTemplate({ id: 'g1.func.graph', unit: UNIT, title: 'グラフから式', timeLimit: { 1: 45, 2: 55, 3: 60 }, generate: genGraph });
