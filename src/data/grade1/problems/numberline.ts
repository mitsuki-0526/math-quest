import { registerTemplate, type Difficulty, type Problem } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat } from '@/math/rational';
import { plainMinus, text } from '@/math/format';

/**
 * 数直線の読み取り(第1章ボス 符号王ネガ フェーズ③)。図つき問題の最初の例。
 *   ★1: 点の位置を読む
 *   ★2: 2 点の間の距離(0 をまたぐことが多い)/ 点から 右・左へ n 目盛り 進んだ位置
 *   ★3: 2 回 進んだあとの位置 / 進んだあとの点から はじめの点を求める(逆向きに考える)
 * 目盛りは 1 だけ(授業は 1 目盛り 1。先生の印 2026-09-27)。0 の目盛りには 必ず数を書く(Figure 側でも保証)。
 * Codex のレビュー(2026-09-27): 以前の ★2(0.5 きざみの距離)が ★3(1 回進む)より難しく、逆転していたので組み直した
 * 範囲は docs/difficulty.md
 */
const HALF = 10;
const line = (points: { value: number; label: string }[], half = HALF) => ({ kind: 'numberline' as const, min: -half, max: half, step: 1, points });
const dir = (n: number) => (n > 0 ? '右' : '左');
const pm = (n: number) => plainMinus(String(n));

function gen(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    const a = rng.int(-8, 8);
    return {
      templateId: 'g1.sign.numberline',
      difficulty: d,
      prompt: `${text('点 A の位置を表す数は?')}`,
      promptText: '数直線上の 点 A の位置を表す数は?',
      answer: { kind: 'number', value: rat(a) },
      hint: '0 の目盛りを 見つけて、そこから 左なら マイナス、右なら プラス',
      explanation: [`${text(`0 から ${a < 0 ? '左' : '右'}へ ${Math.abs(a)} 目盛り`)}`, `${text('答え: ')} ${a}`],
      tags: ['numberline_read'],
      key: `nl:read:${a}`,
      figure: line([{ value: a, label: 'A' }], 8),
      verify: `${a}`,
    };
  }
  if (d === 2) {
    if (rng.bool()) {
      // 2 点の距離。3 回に 2 回は 0 をまたぐ(負の数と正の数)
      let a: number;
      let b: number;
      do {
        a = rng.int(-HALF, HALF);
        b = rng.int(-HALF, HALF);
      } while (a === b || (rng.bool(0.67) && a * b >= 0));
      const dist = Math.abs(a - b);
      return {
        templateId: 'g1.sign.numberline',
        difficulty: d,
        prompt: `${text('点 A と 点 B の間の 距離は?')}`,
        promptText: '数直線上の 点 A と 点 B の間の 距離は?',
        answer: { kind: 'number', value: rat(dist) },
        hint: '目盛りを 数えてもいいし、大きい数から 小さい数を 引いてもいい',
        explanation: [
          `${text(`A = ${pm(a)}, B = ${pm(b)}`)}`,
          `${text('距離 = 大きい数 − 小さい数 = ')} ${Math.max(a, b)} - (${Math.min(a, b)}) = ${dist}`,
          `${text('答え: ')} ${dist}`,
        ],
        tags: ['numberline_distance'],
        key: `nl:dist:${a}:${b}`,
        figure: line([
          { value: a, label: 'A' },
          { value: b, label: 'B' },
        ]),
        verify: `Math.abs((${a})-(${b}))`,
      };
    }
    // 1 回 進む(以前の ★3)
    const move = rng.nonZero(9, 2);
    const start = rng.int(Math.max(-HALF, -HALF - move), Math.min(HALF, HALF - move));
    const end = start + move;
    return {
      templateId: 'g1.sign.numberline',
      difficulty: d,
      prompt: `${text(`点 A から ${dir(move)}へ ${Math.abs(move)} 目盛り 進んだ 点を 表す 数は?`)}`,
      promptText: `点 A から ${dir(move)}へ ${Math.abs(move)} 目盛り 進んだ 点を 表す 数は?`,
      answer: { kind: 'number', value: rat(end) },
      hint: move > 0 ? '右へ 進む = たす。A の数に たそう' : '左へ 進む = ひく。A の数から ひこう',
      explanation: [`${text(`A = ${pm(start)}`)}`, `${start} ${move > 0 ? '+' : '-'} ${Math.abs(move)} = ${end}`, `${text('答え: ')} ${end}`],
      tags: [move > 0 ? 'numberline_add' : 'numberline_sub'],
      key: `nl:move:${start}:${move}`,
      // 矢印を描くと答えの位置が見えてしまうので、図には点 A だけを置く
      figure: line([{ value: start, label: 'A' }]),
      verify: `(${start}) + (${move})`,
    };
  }
  // ★3
  if (rng.bool()) {
    // 2 回 進む: 右へ 5 目盛り 進み、さらに 左へ 8 目盛り
    let start: number, m1: number, m2: number;
    do {
      start = rng.int(-6, 6);
      m1 = rng.nonZero(8, 2);
      m2 = rng.nonZero(8, 2);
    } while (Math.sign(m1) === Math.sign(m2) || Math.abs(start + m1) > HALF || Math.abs(start + m1 + m2) > HALF);
    const end = start + m1 + m2;
    return {
      templateId: 'g1.sign.numberline',
      difficulty: d,
      prompt: text(`点 A から ${dir(m1)}へ ${Math.abs(m1)} 目盛り 進み、さらに ${dir(m2)}へ ${Math.abs(m2)} 目盛り 進んだ 点を 表す 数は?`),
      promptText: `点 A から ${dir(m1)}へ ${Math.abs(m1)} 目盛り 進み、さらに ${dir(m2)}へ ${Math.abs(m2)} 目盛り 進んだ 点を 表す 数は?`,
      answer: { kind: 'number', value: rat(end) },
      hint: '右は +、左は −。A の数に 2 回ぶんを 順に たそう',
      explanation: [`${text(`A = ${pm(start)}`)}`, `${start} ${m1 > 0 ? '+' : '-'} ${Math.abs(m1)} ${m2 > 0 ? '+' : '-'} ${Math.abs(m2)} = ${end}`, `${text('答え: ')} ${end}`],
      tags: ['numberline_two_moves'],
      key: `nl:two:${start}:${m1}:${m2}`,
      figure: line([{ value: start, label: 'A' }]),
      verify: `(${start}) + (${m1}) + (${m2})`,
    };
  }
  // 逆向き: ある点から 右へ 6 目盛り 進むと 点 A。はじめの点は?
  const move = rng.nonZero(9, 2);
  const end = rng.int(Math.max(-HALF, -HALF + move), Math.min(HALF, HALF + move));
  const start = end - move;
  return {
    templateId: 'g1.sign.numberline',
    difficulty: d,
    prompt: text(`ある点から ${dir(move)}へ ${Math.abs(move)} 目盛り 進むと、点 A に 着いた。はじめの 点を 表す 数は?`),
    promptText: `ある点から ${dir(move)}へ ${Math.abs(move)} 目盛り 進むと、点 A に 着いた。はじめの 点を 表す 数は?`,
    answer: { kind: 'number', value: rat(start) },
    hint: `A から 逆向き(${dir(-move)})へ ${Math.abs(move)} 目盛り もどろう`,
    explanation: [`${text(`A = ${pm(end)}。逆向きに ${Math.abs(move)} 目盛り もどる`)}`, `${end} ${move > 0 ? '-' : '+'} ${Math.abs(move)} = ${start}`, `${text('答え: ')} ${start}`],
    tags: ['numberline_reverse'],
    key: `nl:back:${end}:${move}`,
    figure: line([{ value: end, label: 'A' }]),
    verify: `(${end}) - (${move})`,
  };
}

registerTemplate({
  id: 'g1.sign.numberline',
  unit: '正の数と負の数',
  title: '数直線の読み取り',
  timeLimit: { 1: 30, 2: 45, 3: 60 },
  generate: gen,
});
