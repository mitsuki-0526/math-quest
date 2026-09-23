import { registerTemplate, type Difficulty, type Problem } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat } from '@/math/rational';
import { plainMinus, text } from '@/math/format';

/**
 * 数直線の読み取り(第1章ボス 符号王ネガ フェーズ③)。図つき問題の最初の例。
 *   ★1: 点の位置を読む
 *   ★2: 2点の間の距離
 *   ★3: ある点から右/左へ n 進んだ位置
 */
function gen(rng: Rng, d: Difficulty): Problem {
  const half = d === 1 ? 8 : 10;
  const step = 1;
  const a = rng.int(-half, half);
  if (d === 1) {
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
      figure: { kind: 'numberline', min: -half, max: half, step, points: [{ value: a, label: 'A' }] },
      verify: `${a}`,
    };
  }
  if (d === 2) {
    let b = rng.int(-half, half);
    while (b === a) b = rng.int(-half, half);
    const dist = Math.abs(a - b);
    return {
      templateId: 'g1.sign.numberline',
      difficulty: d,
      prompt: `${text('点 A と 点 B の間の 距離は?')}`,
      promptText: '数直線上の 点 A と 点 B の間の 距離は?',
      answer: { kind: 'number', value: rat(dist) },
      hint: '目盛りを 数えてもいいし、大きい数から 小さい数を 引いてもいい',
      explanation: [
        `${text(`A = ${plainMinus(String(a))}, B = ${plainMinus(String(b))}`)}`,
        `${text('距離 = 大きい数 − 小さい数 = ')} ${Math.max(a, b)} - (${Math.min(a, b)}) = ${dist}`,
        `${text('答え: ')} ${dist}`,
      ],
      tags: ['numberline_distance'],
      key: `nl:dist:${a}:${b}`,
      figure: {
        kind: 'numberline',
        min: -half,
        max: half,
        step,
        points: [
          { value: a, label: 'A' },
          { value: b, label: 'B' },
        ],
      },
      verify: `Math.abs((${a})-(${b}))`,
    };
  }
  // ★3: A から 右/左へ n 進む
  const right = rng.bool();
  const n = rng.int(2, 9);
  const start = right ? rng.int(-half, half - n) : rng.int(-half + n, half);
  const end = right ? start + n : start - n;
  return {
    templateId: 'g1.sign.numberline',
    difficulty: d,
    prompt: `${text(`点 A から ${right ? '右' : '左'}へ ${n} 進んだ 位置を表す数は?`)}`,
    promptText: `点 A から ${right ? '右' : '左'}へ ${n} 進んだ 位置を表す数は?`,
    answer: { kind: 'number', value: rat(end) },
    hint: right ? '右へ進む = 足す。A の数に n を 足そう' : '左へ進む = 引く。A の数から n を 引こう',
    explanation: [
      `${text(`A = ${plainMinus(String(start))}`)}`,
      `${start} ${right ? '+' : '-'} ${n} = ${end}`,
      `${text('答え: ')} ${end}`,
    ],
    tags: [right ? 'numberline_add' : 'numberline_sub'],
    key: `nl:move:${start}:${right ? '+' : '-'}${n}`,
    figure: {
      kind: 'numberline',
      min: -half,
      max: half,
      step,
      // 矢印を描くと答えの位置が見えてしまうので、図には点 A だけを置く
      points: [{ value: start, label: 'A' }],
    },
    verify: `(${start}) ${right ? '+' : '-'} ${n}`,
  };
}

registerTemplate({
  id: 'g1.sign.numberline',
  unit: '正の数と負の数',
  title: '数直線の読み取り',
  timeLimit: { 1: 30, 2: 45, 3: 50 },
  generate: gen,
});
