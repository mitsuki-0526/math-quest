import { mistakeNum, registerTemplate, type Difficulty, type Problem, type ProblemBasis } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat } from '@/math/rational';
import { plainMinus, text } from '@/math/format';

/**
 * 基準との差・平均(第1章 ヘイキンタヌキ `g1.sign.average`)。
 * 大阪府チャレンジテストで毎年出題され、正答率が低い(20〜67%)ので加えた(docs/difficulty.md)。
 *   ★1: 実際の数 ↔ 目標との差(1 つ)
 *   ★2: 目標との差の表から、合計を求める
 *   ★3: 目標との差の表から、平均を求める / 平均から、表の ? を求める(道中では 1 戦に 1 問まで: hardPerBattle)
 * 表の数: 道中は教科書に合わせて ★2 が 3〜4、★3 が 4〜5。修練の泉は チャレンジテストに合わせて ★2 が 5、★3 が 5〜6
 * (先生の方針 2026-09-28「道中は教科書、修練の泉はチャレンジテスト基準」)
 * 差は ±15 まで。目標との差を先に足してから、目標の分を足す(大きな数を足さずにすむ)のが ねらい。
 * 先生の印(2026-09-27)「文章が長い」「文章と表の両方を見るのは難しい」を受けて、
 * 問題文は 短くし、目標や +・− の決まりは 表の見出しと 下の一言に まとめる
 */

interface Scene {
  /** 実際の数の呼び名(「売れた 個数」) */
  noun: string;
  unit: string;
  targets: number[];
  /** 目標 or 基準 */
  baseWord: string;
  /** 目標の言い方(「目標は 1日 30 個」) */
  base: (t: number) => string;
  /** 1 つ分の言い方(「27 個 売れた 日」) */
  one: (n: number) => string;
  /** 日 or 人 */
  per: string;
  /** 表の列の見出し */
  col: (i: number) => string;
  /** n 日間 / n 人 */
  span: (n: number) => string;
}

const SCENES: Scene[] = [
  {
    noun: '売れた 個数',
    unit: '個',
    targets: [30, 40, 50],
    baseWord: '目標',
    base: (t) => `りんごを 売る 目標は 1日 ${t} 個`,
    one: (n) => `${n} 個 売れた 日`,
    per: '日',
    col: (i) => `${i + 1}日目`,
    span: (n) => `${n}日間`,
  },
  {
    noun: '焼いた 個数',
    unit: '個',
    targets: [60, 80, 100],
    baseWord: '目標',
    base: (t) => `パンを 焼く 目標は 1日 ${t} 個`,
    one: (n) => `${n} 個 焼いた 日`,
    per: '日',
    col: (i) => `${i + 1}日目`,
    span: (n) => `${n}日間`,
  },
  {
    noun: '素振りの 回数',
    unit: '回',
    targets: [50, 100],
    baseWord: '目標',
    base: (t) => `素振りの 目標は 1日 ${t} 回`,
    one: (n) => `${n} 回 素振りした 日`,
    per: '日',
    col: (i) => `${i + 1}日目`,
    span: (n) => `${n}日間`,
  },
  {
    noun: '得点',
    unit: '点',
    targets: [60, 70, 80],
    baseWord: '基準',
    base: (t) => `テストの 基準は ${t} 点`,
    one: (n) => `${n} 点の 人`,
    per: '人',
    col: (i) => 'ABCDEF'[i],
    span: (n) => `${n}人`,
  },
];

const MAX_DIFF = 15;
const RULE = '多いときは +、少ないときは −';

/** 表に書く差: +5 / −3 / 0 */
function signed(n: number): string {
  return n > 0 ? `+${n}` : n === 0 ? '0' : plainMinus(String(n));
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
/** 解説の たし算: 3 + (−5) + 0 */
const addTex = (xs: number[]) => xs.map((x, i) => (i === 0 ? String(x) : x < 0 ? ` + (${x})` : ` + ${x}`)).join('');

/** 正と負がまざった差の列(0 も少しだけ) */
function diffs(rng: Rng, n: number): number[] {
  let ds: number[];
  do ds = Array.from({ length: n }, () => (rng.bool(0.1) ? 0 : rng.nonZero(MAX_DIFF)));
  while (!ds.some((x) => x > 0) || !ds.some((x) => x < 0));
  return ds;
}

/** 目標・+− の決まりは 表の見出しと 下の一言に 入れる(問題文を 短くするため) */
function table(s: Scene, target: number, ds: (number | null)[]) {
  return {
    kind: 'table' as const,
    head: ['', ...ds.map((_, i) => s.col(i))],
    rows: [[`${s.baseWord} ${target} ${s.unit}との差`, ...ds.map((x) => (x === null ? '?' : signed(x)))]],
    caption: `${s.baseWord}より ${RULE}`,
  };
}

/** 問題文(本文書体で出す)。短く、1 文で聞く */
function ask(q: string) {
  return { prompt: text(q), promptText: q };
}

function gen(rng: Rng, d: Difficulty, basis: ProblemBasis = 'textbook'): Problem {
  const challenge = basis === 'challenge';
  const s = rng.pick(SCENES);
  const target = rng.pick(s.targets);

  // ★1 の 3 回に 1 回は 反対の性質の ことば(東へ ↔ 西へ、増える ↔ 減る)。教科書の 最初の 単元(2026-09-29 追加)
  if (d === 1 && rng.int(0, 2) === 0) return genOpposite(rng, d);
  if (d === 1) {
    const diff = rng.nonZero(MAX_DIFF);
    const actual = target + diff;
    if (rng.bool()) {
      return {
        templateId: 'g1.sign.average',
        difficulty: d,
        ...ask(`${s.base(target)}。${s.one(actual)}は、${s.baseWord}との差を どう表す?(${RULE})`),
        answer: { kind: 'number', value: rat(diff) },
        hint: `${s.baseWord}より 多い? 少ない? 少ないなら 負の数`,
        explanation: [`${actual} - ${target} = ${diff}`, `${text(`${s.baseWord}より ${Math.abs(diff)} ${s.unit} ${diff > 0 ? '多い' : '少ない'} → `)} ${signed(diff).replace('−', '-')}`],
        mistakes: [mistakeNum(-diff, `${s.baseWord}より 多いときは +、少ないときは −。${actual} は ${s.baseWord}の ${target} より ${diff > 0 ? '多い' : '少ない'}よ`)],
        tags: ['base_difference'],
        key: `avg:diff:${s.unit}:${target}:${actual}`,
        verify: `${actual}-${target}`,
      };
    }
    return {
      templateId: 'g1.sign.average',
      difficulty: d,
      ...ask(`${s.base(target)}。${s.baseWord}との差が ${signed(diff)} ${s.unit}の ${s.per}の ${s.noun}は?`),
      answer: { kind: 'number', value: rat(actual) },
      hint: `${s.baseWord}の ${target} に 差を たそう。負の数なら 減る`,
      explanation: [`${target} + ${diff < 0 ? `(${diff})` : diff} = ${actual}`, `${text('答え: ')} ${actual} ${text(s.unit)}`],
      mistakes: [
        mistakeNum(target - diff, `差が ${diff > 0 ? '+ なら 目標より 多い' : '− なら 目標より 少ない'}。${s.baseWord}に 差を そのまま たそう`),
        mistakeNum(diff, `差は ${s.baseWord}からの ずれ。${s.baseWord}の ${target} に たすと 実際の 数に なるよ`),
      ],
      tags: ['base_difference'],
      key: `avg:actual:${s.unit}:${target}:${diff}`,
      verify: `${target}+(${diff})`,
    };
  }

  if (d === 2) {
    const n = challenge ? 5 : rng.pick([3, 4]);
    const ds = diffs(rng, n);
    const total = target * n + sum(ds);
    const actuals = ds.map((x) => target + x);
    return {
      templateId: 'g1.sign.average',
      difficulty: d,
      ...ask(`表の ${s.span(n)}で、${s.noun}の 合計は?`),
      answer: { kind: 'number', value: rat(total) },
      hint: `差を ぜんぶ たしてから、${s.baseWord} × ${n} を たそう`,
      explanation: [
        `${text('① 差を ぜんぶ たす: ')} ${addTex(ds)} = ${sum(ds)}`,
        `${text(`② ${s.baseWord}の ${n} つ分に たす: `)} ${target} \\times ${n} + (${sum(ds)}) = ${total}`,
        `${text('答え: ')} ${total} ${text(s.unit)}`,
      ],
      mistakes: [
        mistakeNum(sum(ds), `それは 差の 合計。${s.baseWord}の ${target} × ${n} を たすと ${s.noun}の 合計に なるよ`),
        mistakeNum(target * n, `${s.baseWord} × ${n} に、差の 合計(${sum(ds)})も たそう`),
      ],
      tags: ['base_total'],
      key: `avg:total:${s.unit}:${target}:${ds.join(',')}`,
      figure: table(s, target, ds),
      verify: `[${actuals.join(',')}].reduce((a,b)=>a+b,0)`,
    };
  }

  // ★3: 差の合計が n で わり切れるように 最後の差を選ぶ
  const n = challenge ? rng.pick([5, 6]) : rng.pick([4, 5]);
  let ds: number[];
  do {
    ds = diffs(rng, n - 1);
    const rest = sum(ds);
    const lasts = Array.from({ length: MAX_DIFF * 2 + 1 }, (_, i) => i - MAX_DIFF).filter((x) => (rest + x) % n === 0);
    ds.push(rng.pick(lasts));
  } while (Math.abs(sum(ds) / n) > 8);
  const mean = sum(ds) / n;
  const average = target + mean;
  const actuals = ds.map((x) => target + x);

  // 難しい問題なので、まちがえたときの 解説を 手順ごとに 分ける(先生の印「まちがえたときの ケア」)
  if (rng.int(0, 2) > 0) {
    return {
      templateId: 'g1.sign.average',
      difficulty: d,
      ...ask(`表の ${s.span(n)}で、${s.noun}の 平均は?`),
      answer: { kind: 'number', value: rat(average) },
      hint: `① 差を ぜんぶ たす → ② ${n} で わる(差の平均) → ③ ${s.baseWord}の ${target} に たす`,
      explanation: [
        `${text('① 差を ぜんぶ たす: ')} ${addTex(ds)} = ${sum(ds)}`,
        `${text(`② ${n} で わる(差の平均): `)} ${sum(ds)} \\div ${n} = ${mean}`,
        `${text(`③ ${s.baseWord}に たす: `)} ${target} + (${mean}) = ${average}`,
        `${text('答え: ')} ${average} ${text(s.unit)}`,
      ],
      mistakes: [
        mistakeNum(mean, `それは 差の 平均。${s.baseWord}の ${target} に たすと ${s.noun}の 平均に なるよ`),
        mistakeNum(target * n + sum(ds), `それは 合計。${n} で わると 平均に なるよ`),
      ],
      tags: ['base_average'],
      key: `avg:mean:${s.unit}:${target}:${ds.join(',')}`,
      figure: table(s, target, ds),
      verify: `[${actuals.join(',')}].reduce((a,b)=>a+b,0)/${n}`,
    };
  }
  // 平均から、表の ? を求める(チャレンジテスト R6 の形)
  const hole = rng.int(0, n - 1);
  const others = ds.filter((_, i) => i !== hole);
  return {
    templateId: 'g1.sign.average',
    difficulty: d,
    ...ask(`${s.span(n)}の ${s.noun}の 平均は ${average} ${s.unit}。表の ? に 入る、${s.baseWord}との差は?`),
    answer: { kind: 'number', value: rat(ds[hole]) },
    // 差は 符号つきのまま 使う(「いくつ 少ない?」と聞くと 正の数で 答えてしまい、差の合計の符号を まちがえる。Codex のレビュー)
    hint: `① 平均 − ${s.baseWord} = ${average} − ${target}(符号つき)→ ② それを ${n} 倍すると 差の合計 → ③ ? 以外の 差を ひく`,
    explanation: [
      `${text(`① 平均と ${s.baseWord}の差: `)} ${average} - ${target} = ${mean}`,
      `${text(`② 差の合計は ${n} つ分: `)} ${mean} \\times ${n} = ${sum(ds)}`,
      `${text('③ ? 以外の 差を たす: ')} ${addTex(others)} = ${sum(others)}`,
      `${text('④ ? = 差の合計 − ③: ')} ${sum(ds)} - (${sum(others)}) = ${ds[hole]}`,
      `${text('答え: ')} ${ds[hole]}`,
    ],
    mistakes: [mistakeNum(-ds[hole], '符号に 気をつけて。差の 合計から ? 以外の 差を ひいた 数が そのまま 答え')],
    tags: ['base_average_missing'],
    key: `avg:hole:${s.unit}:${target}:${ds.join(',')}:${hole}`,
    figure: table(
      s,
      target,
      ds.map((x, i) => (i === hole ? null : x)),
    ),
    verify: `${average}*${n}-[${others.map((x) => target + x).join(',')}].reduce((a,b)=>a+b,0)-${target}`,
  };
}

/** 反対の性質を もつ ことばの 組。phrase(ことば, 数) で 「東へ 5 m 進む」「700 円の 支出」の形にする */
const OPPOSITES: { pos: string; neg: string; unit: string; max: number; step?: number; phrase: (w: string, n: string | number) => string }[] = [
  { pos: '東', neg: '西', unit: 'm', max: 20, phrase: (w, n) => `${w}へ ${n} m 進む` },
  { pos: '北', neg: '南', unit: 'km', max: 12, phrase: (w, n) => `${w}へ ${n} km 進む` },
  { pos: '増える', neg: '減る', unit: 'kg', max: 9, phrase: (w, n) => `${n} kg ${w}` },
  { pos: '収入', neg: '支出', unit: '円', max: 900, step: 100, phrase: (w, n) => `${n} 円の ${w}` },
  { pos: '後', neg: '前', unit: '分', max: 30, phrase: (w, n) => `${n} 分${w}` },
  { pos: '上がる', neg: '下がる', unit: '℃', max: 9, phrase: (w, n) => `${n} ℃ ${w}` },
];

/**
 * 反対の性質の ことばを 正の数・負の数で 表す(教科書「正の数・負の数で 量を表す」)。
 *   「東へ 5 m 進む」を +5 m と表すとき、「西へ 3 m 進む」は?  → −3
 *   「西へ 3 m 進む」を、「東」を使って 言いかえると「東へ □ m 進む」 → −3
 */
function genOpposite(rng: Rng, d: Difficulty): Problem {
  const o = rng.pick(OPPOSITES);
  const step = o.step ?? 1;
  const num = () => rng.int(1, Math.floor(o.max / step)) * step;
  const a = num();
  const b = num();
  const say = `反対の 性質の ことばは、符号を 反対に して 表すよ(${o.pos} ↔ ${o.neg})`;
  const minus = (n: number) => `−${n}`;
  if (rng.bool()) {
    const q = `「${o.phrase(o.pos, a)}」を +${a} ${o.unit} と 表すとき、「${o.phrase(o.neg, b)}」は?`;
    return {
      templateId: 'g1.sign.average',
      difficulty: d,
      prompt: text(q),
      promptText: q,
      answer: { kind: 'number', value: rat(-b) },
      hint: '反対の 向き・性質なら 符号を 反対に。数(大きさ)は そのまま',
      explanation: [text(`「${o.pos}」が +。反対の「${o.neg}」は −`), `${text('答え: ')} -${b} ${text(o.unit)}`],
      mistakes: [{ answer: { kind: 'number', value: rat(b) }, say }],
      tags: ['opposite_quantity'],
      key: `avg:opp:${o.unit}:${a}:${b}`,
      verify: `-${b}`,
    };
  }
  // 言いかえ: 西へ 3 m 進む = 東へ −3 m 進む
  const q = `「${o.phrase(o.neg, b)}」を、「${o.pos}」を 使って 言いかえると「${o.phrase(o.pos, '□')}」。□ に 入る数は?`;
  return {
    templateId: 'g1.sign.average',
    difficulty: d,
    prompt: text(q),
    promptText: q,
    answer: { kind: 'number', value: rat(-b) },
    hint: '反対の ことばに 言いかえると、符号が 反対に なる',
    explanation: [text(`「${o.phrase(o.neg, b)}」=「${o.phrase(o.pos, minus(b))}」`), `${text('答え: ')} -${b}`],
    mistakes: [{ answer: { kind: 'number', value: rat(b) }, say }],
    tags: ['opposite_quantity'],
    key: `avg:oppsay:${o.unit}:${b}`,
    verify: `-${b}`,
  };
}

registerTemplate({
  id: 'g1.sign.average',
  unit: '正の数と負の数',
  title: '基準との差・平均',
  timeLimit: { 1: 45, 2: 75, 3: 100 },
  // ★3 は かなり難しいので、道中の 1 戦では 1 問まで(先生の印 2026-09-27)
  hardPerBattle: 1,
  generate: gen,
});
