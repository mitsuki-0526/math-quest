import { registerTemplate, type Difficulty, type Problem } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat } from '@/math/rational';
import { plainMinus, text } from '@/math/format';

/**
 * 基準との差・平均(第1章 ヘイキンタヌキ `g1.sign.average`)。
 * 大阪府チャレンジテストで毎年出題され、正答率が低い(20〜67%)ので加えた(docs/difficulty.md)。
 *   ★1: 実際の数 ↔ 目標との差(1 つ)
 *   ★2: 目標との差の表から、合計を求める
 *   ★3: 目標との差の表から、平均を求める / 平均から、表の ? を求める
 * 差は ±15 まで。目標との差を先に足してから、目標の分を足す(大きな数を足さずにすむ)のが ねらい
 */

interface Scene {
  /** 表の題材(「〜を」に続く) */
  thing: string;
  /** 実際の数の呼び名(答えの単位の前) */
  noun: string;
  unit: string;
  targets: number[];
  /** 目標 or 基準 */
  baseWord: string;
  /** 表の列の見出し */
  col: (i: number) => string;
  /** n 日間 / n 人 */
  span: (n: number) => string;
}

const SCENES: Scene[] = [
  {
    thing: 'テオの店で 1日に 売れた りんごの 個数',
    noun: '売れた 個数',
    unit: '個',
    targets: [30, 40, 50],
    baseWord: '目標',
    col: (i) => `${i + 1}日目`,
    span: (n) => `${n}日間`,
  },
  {
    thing: 'パン屋が 1日に 焼いた パンの 個数',
    noun: '焼いた 個数',
    unit: '個',
    targets: [60, 80, 100],
    baseWord: '目標',
    col: (i) => `${i + 1}日目`,
    span: (n) => `${n}日間`,
  },
  {
    thing: '見習い剣士の 1日の 素振りの 回数',
    noun: '素振りの 回数',
    unit: '回',
    targets: [50, 100],
    baseWord: '目標',
    col: (i) => `${i + 1}日目`,
    span: (n) => `${n}日間`,
  },
  {
    thing: '村の子どもたちの 計算テストの 得点',
    noun: '得点',
    unit: '点',
    targets: [60, 70, 80],
    baseWord: '基準',
    col: (i) => 'ABCDEF'[i],
    span: (n) => `${n}人`,
  },
];

const MAX_DIFF = 15;

/** 表に書く差: +5 / −3 / 0 */
function signed(n: number): string {
  return n > 0 ? `+${n}` : n === 0 ? '0' : plainMinus(String(n));
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** 正と負がまざった差の列(0 も少しだけ) */
function diffs(rng: Rng, n: number): number[] {
  let ds: number[];
  do ds = Array.from({ length: n }, () => (rng.bool(0.1) ? 0 : rng.nonZero(MAX_DIFF)));
  while (!ds.some((x) => x > 0) || !ds.some((x) => x < 0));
  return ds;
}

/** 「目標の 30 個より 多いときは 正の数、少ないときは 負の数で」(このあとに「表す」「表したものです」が続く) */
function rule(s: Scene, target: number): string {
  return `${s.baseWord}の ${target} ${s.unit}より 多いときは 正の数、少ないときは 負の数で`;
}

function table(s: Scene, ds: (number | null)[]) {
  return {
    kind: 'table' as const,
    head: ['', ...ds.map((_, i) => s.col(i))],
    rows: [[`${s.baseWord}との差(${s.unit})`, ...ds.map((x) => (x === null ? '?' : signed(x)))]],
  };
}

function gen(rng: Rng, d: Difficulty): Problem {
  const s = rng.pick(SCENES);
  const target = rng.pick(s.targets);

  if (d === 1) {
    const diff = rng.nonZero(MAX_DIFF);
    const actual = target + diff;
    if (rng.bool()) {
      return {
        templateId: 'g1.sign.average',
        difficulty: d,
        prompt: text(`${s.thing}を、${rule(s, target)} 表す。${actual} ${s.unit}の とき、${s.baseWord}との差は?`),
        promptText: `${s.thing}を、${rule(s, target)} 表す。${actual} ${s.unit}の とき、${s.baseWord}との差は?`,
        answer: { kind: 'number', value: rat(diff) },
        hint: `${s.baseWord}より 多い? 少ない? 少ないなら 負の数`,
        explanation: [`${actual} - ${target} = ${diff}`, `${text(`${s.baseWord}より ${Math.abs(diff)} ${s.unit} ${diff > 0 ? '多い' : '少ない'} → `)} ${signed(diff).replace('−', '-')}`],
        tags: ['base_difference'],
        key: `avg:diff:${s.unit}:${target}:${actual}`,
        verify: `${actual}-${target}`,
      };
    }
    return {
      templateId: 'g1.sign.average',
      difficulty: d,
      prompt: text(`${s.thing}を、${rule(s, target)} 表す。${s.baseWord}との差が ${signed(diff)} ${s.unit}の とき、${s.noun}は?`),
      promptText: `${s.thing}を、${rule(s, target)} 表す。${s.baseWord}との差が ${signed(diff)} ${s.unit}の とき、${s.noun}は?`,
      answer: { kind: 'number', value: rat(actual) },
      hint: `${s.baseWord}の ${target} に 差を 足そう。負の数なら 減る`,
      explanation: [`${target} + ${diff < 0 ? `(${diff})` : diff} = ${actual}`, `${text('答え: ')} ${actual} ${text(s.unit)}`],
      tags: ['base_difference'],
      key: `avg:actual:${s.unit}:${target}:${diff}`,
      verify: `${target}+(${diff})`,
    };
  }

  if (d === 2) {
    const n = 5;
    const ds = diffs(rng, n);
    const total = target * n + sum(ds);
    const actuals = ds.map((x) => target + x);
    return {
      templateId: 'g1.sign.average',
      difficulty: d,
      prompt: text(`表は、${s.thing}を、${rule(s, target)} 表したものです。${s.span(n)}の ${s.noun}の 合計は?`),
      promptText: `表は、${s.thing}を、${rule(s, target)} 表したものです。${s.span(n)}の ${s.noun}の 合計は?`,
      answer: { kind: 'number', value: rat(total) },
      hint: `差を ぜんぶ 足してから、${s.baseWord} × ${n} を 足そう`,
      explanation: [
        `${text('差の合計: ')} ${ds.map((x, i) => (i === 0 ? String(x) : x < 0 ? ` + (${x})` : ` + ${x}`)).join('')} = ${sum(ds)}`,
        `${target} \\times ${n} + (${sum(ds)}) = ${total}`,
        `${text('答え: ')} ${total} ${text(s.unit)}`,
      ],
      tags: ['base_total'],
      key: `avg:total:${s.unit}:${target}:${ds.join(',')}`,
      figure: table(s, ds),
      verify: `[${actuals.join(',')}].reduce((a,b)=>a+b,0)`,
    };
  }

  // ★3: 差の合計が n で わり切れるように 最後の差を選ぶ
  const n = rng.pick([5, 6]);
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

  if (rng.int(0, 2) > 0) {
    return {
      templateId: 'g1.sign.average',
      difficulty: d,
      prompt: text(`表は、${s.thing}を、${rule(s, target)} 表したものです。${s.span(n)}の ${s.noun}の 平均は?`),
      promptText: `表は、${s.thing}を、${rule(s, target)} 表したものです。${s.span(n)}の ${s.noun}の 平均は?`,
      answer: { kind: 'number', value: rat(average) },
      hint: `差の平均を 先に 出して、${s.baseWord}の ${target} に 足そう`,
      explanation: [
        `${text('差の合計: ')} ${sum(ds)} \\quad ${text('差の平均: ')} ${sum(ds)} \\div ${n} = ${mean}`,
        `${target} + (${mean}) = ${average}`,
        `${text('答え: ')} ${average} ${text(s.unit)}`,
      ],
      tags: ['base_average'],
      key: `avg:mean:${s.unit}:${target}:${ds.join(',')}`,
      figure: table(s, ds),
      verify: `[${actuals.join(',')}].reduce((a,b)=>a+b,0)/${n}`,
    };
  }
  // 平均から、表の ? を求める(チャレンジテスト R6 の形)
  const hole = rng.int(0, n - 1);
  const others = ds.filter((_, i) => i !== hole);
  return {
    templateId: 'g1.sign.average',
    difficulty: d,
    prompt: text(`表は、${s.thing}を、${rule(s, target)} 表したものです。${s.span(n)}の 平均が ${average} ${s.unit}の とき、表の ? に 当てはまる数は?`),
    promptText: `表は、${s.thing}を、${rule(s, target)} 表したものです。${s.span(n)}の 平均が ${average} ${s.unit}の とき、表の ? に 当てはまる数は?`,
    answer: { kind: 'number', value: rat(ds[hole]) },
    hint: `平均は ${s.baseWord}より ${Math.abs(mean)} ${mean >= 0 ? '多い' : '少ない'}。差の合計は いくつに なる?`,
    explanation: [
      `${text('差の平均: ')} ${average} - ${target} = ${mean} \\quad ${text('差の合計: ')} ${mean} \\times ${n} = ${sum(ds)}`,
      `${text('? 以外の差の合計: ')} ${sum(others)}`,
      `${sum(ds)} - (${sum(others)}) = ${ds[hole]}`,
      `${text('答え: ')} ${ds[hole]}`,
    ],
    tags: ['base_average_missing'],
    key: `avg:hole:${s.unit}:${target}:${ds.join(',')}:${hole}`,
    figure: table(
      s,
      ds.map((x, i) => (i === hole ? null : x)),
    ),
    verify: `${average}*${n}-[${others.map((x) => target + x).join(',')}].reduce((a,b)=>a+b,0)-${target}`,
  };
}

registerTemplate({
  id: 'g1.sign.average',
  unit: '正の数と負の数',
  title: '基準との差・平均',
  timeLimit: { 1: 45, 2: 75, 3: 100 },
  generate: gen,
});
