import { registerTemplate, type Difficulty, type Problem } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat, toTex, toNumber } from '@/math/rational';
import { text } from '@/math/format';

/**
 * 第7章「データの活用」のテンプレート(台本 07_record_tower.md の敵に対応)。
 *   g1.data.mean   平均ゴースト      平均値
 *   g1.data.median 中央値の司書      中央値・最頻値・範囲
 *   g1.data.freq   度数コウモリ      度数分布表・相対度数(図つき)
 *   g1.data.prob   キマグレフクロウ  多数回の試行による確率(相対度数)
 * 近似値・誤差・有効数字は、今の学習指導要領(平成29年告示)では 3 年の内容なので 1 年版では出さない(docs/difficulty.md)
 */
const UNIT = 'データの活用';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);

function listTex(xs: number[]): string {
  return xs.join(', ');
}

// ---------------------------------------------------------------- 平均

function genMean(rng: Rng, d: Difficulty): Problem {
  const n = d === 1 ? rng.pick([4, 5]) : d === 2 ? rng.pick([5, 6, 8]) : rng.pick([6, 8, 10]);
  const base = d === 1 ? rng.int(3, 15) : rng.int(20, 80);
  const spread = d === 1 ? 4 : 10;
  let xs: number[] = [];
  // 平均が割り切れるように、最後の1つで調整する
  for (let i = 0; i < n - 1; i++) xs.push(base + rng.int(-spread, spread));
  const target = base * n;
  const last = target - sum(xs);
  if (last < 0 || last > base + spread * 2) return genMean(rng, d);
  xs.push(last);
  xs = rng.shuffle(xs);
  const mean = sum(xs) / n;
  if (!Number.isInteger(mean)) return genMean(rng, d);
  return {
    templateId: 'g1.data.mean',
    difficulty: d,
    prompt: `${listTex(xs)} \\quad ${text('この データの 平均値は?')}`,
    promptText: `${listTex(xs)} このデータの平均値は?`,
    answer: { kind: 'number', value: rat(mean) },
    hint: '全部 足して、個数で 割る',
    explanation: [`${text('合計: ')} ${sum(xs)}`, `${sum(xs)} \\div ${n} = ${mean}`, `${text('答え: ')} ${mean}`],
    tags: ['mean'],
    key: `mean:${xs.join(',')}`,
    verify: `(${xs.join('+')})/${n}`,
  };
}

// ---------------------------------------------------------------- 中央値・最頻値・範囲

function genMedian(rng: Rng, d: Difficulty): Problem {
  const n = d === 1 ? rng.pick([5, 7]) : rng.pick([6, 8, 9]);
  const xs = rng.shuffle(Array.from({ length: n }, () => rng.int(1, 30)));
  const s = sorted(xs);
  const ask = d === 1 ? 'median' : rng.pick(['median', 'mode', 'range'] as const);
  if (ask === 'median') {
    const mid = n % 2 === 1 ? rat(s[(n - 1) / 2]) : rat(s[n / 2 - 1] + s[n / 2], 2);
    return {
      templateId: 'g1.data.median',
      difficulty: d,
      prompt: `${listTex(xs)} \\quad ${text('この データの 中央値は?')}`,
      promptText: `${listTex(xs)} このデータの中央値は?`,
      answer: { kind: 'number', value: mid },
      hint: n % 2 === 1 ? '小さい順に 並べて 真ん中' : '小さい順に 並べて、真ん中 2つの 平均',
      explanation: [`${text('小さい順: ')} ${listTex(s)}`, `${text('答え: ')} ${toTex(mid)}`],
      tags: ['median'],
      key: `med:${xs.join(',')}`,
      verify: n % 2 === 1 ? `${s[(n - 1) / 2]}` : `(${s[n / 2 - 1]}+${s[n / 2]})/2`,
    };
  }
  if (ask === 'range') {
    const r = s[n - 1] - s[0];
    return {
      templateId: 'g1.data.median',
      difficulty: d,
      prompt: `${listTex(xs)} \\quad ${text('この データの 範囲は?')}`,
      promptText: `${listTex(xs)} このデータの範囲は?`,
      answer: { kind: 'number', value: rat(r) },
      hint: '一番 大きい値 − 一番 小さい値',
      explanation: [`${s[n - 1]} - ${s[0]} = ${r}`, `${text('答え: ')} ${r}`],
      tags: ['range'],
      key: `rng:${xs.join(',')}`,
      verify: `${s[n - 1]}-${s[0]}`,
    };
  }
  // 最頻値: わざと重複を作る
  const value = rng.int(1, 20);
  // 残りは 21〜40 から重複なしで選ぶ(各1回)。これで 3回出る value が唯一の最頻値になる
  const others = rng.shuffle(Array.from({ length: 20 }, (_, i) => 21 + i)).slice(0, n - 3);
  const data = rng.shuffle([value, value, value, ...others]);
  return {
    templateId: 'g1.data.median',
    difficulty: d,
    prompt: `${listTex(data)} \\quad ${text('この データの 最頻値は?')}`,
    promptText: `${listTex(data)} このデータの最頻値は?`,
    answer: { kind: 'number', value: rat(value) },
    hint: '一番 多く 出てくる 値',
    explanation: [`${text(`${value} が 3回 出てくる`)}`, `${text('答え: ')} ${value}`],
    tags: ['mode'],
    key: `mode:${data.join(',')}`,
    verify: `${value}`,
  };
}

// ---------------------------------------------------------------- 度数分布

function genFreq(rng: Rng, d: Difficulty): Problem {
  const classes = 5;
  const width = rng.pick([10, 20]);
  const start = rng.pick([0, 10, 20]);
  const counts = Array.from({ length: classes }, () => rng.int(1, 9));
  const total = sum(counts);
  const labels = counts.map((_, i) => `${start + i * width}〜`);
  const idx = rng.int(0, classes - 1);
  const figure = { kind: 'chart' as const, type: 'histogram' as const, labels, values: counts, xTitle: '階級', yTitle: '度数(人)' };

  if (d === 1) {
    return {
      templateId: 'g1.data.freq',
      difficulty: d,
      prompt: `${text(`${start + idx * width} 以上 ${start + (idx + 1) * width} 未満 の 階級の 度数は?(人)`)}`,
      promptText: `${start + idx * width} 以上 ${start + (idx + 1) * width} 未満 の階級の度数は?(人)`,
      answer: { kind: 'number', value: rat(counts[idx]) },
      hint: 'グラフの 柱の 高さを 読もう',
      explanation: [`${text('答え: ')} ${counts[idx]} ${text('人')}`],
      tags: ['freq_read'],
      key: `frq1:${counts.join(',')}:${idx}`,
      figure,
      verify: `${counts[idx]}`,
    };
  }
  if (d === 2) {
    // 相対度数(割り切れる組み合わせに調整)
    const rel = rat(counts[idx], total);
    return {
      templateId: 'g1.data.freq',
      difficulty: d,
      prompt: `${text(`全体は ${total} 人。${start + idx * width} 以上 ${start + (idx + 1) * width} 未満 の 階級の 相対度数は?(分数か 小数)`)}`,
      promptText: `全体は ${total} 人。${start + idx * width} 以上 ${start + (idx + 1) * width} 未満 の階級の相対度数は?`,
      answer: { kind: 'number', value: rel },
      hint: 'その階級の 度数 ÷ 全体の 度数',
      explanation: [`\\frac{${counts[idx]}}{${total}} = ${toTex(rel)}`, `${text('答え: ')} ${toTex(rel)}`],
      tags: ['freq_relative'],
      key: `frq2:${counts.join(',')}:${idx}`,
      figure,
      verify: `${counts[idx]}/${total}`,
    };
  }
  // ★3: 累積度数 / 最頻値の階級
  if (rng.bool()) {
    const upto = rng.int(1, classes - 1);
    const cum = sum(counts.slice(0, upto + 1));
    return {
      templateId: 'g1.data.freq',
      difficulty: d,
      prompt: `${text(`${start + (upto + 1) * width} 未満 の 累積度数は?(人)`)}`,
      promptText: `${start + (upto + 1) * width} 未満の累積度数は?(人)`,
      answer: { kind: 'number', value: rat(cum) },
      hint: '小さい 階級から 順に 足していく',
      explanation: [`${counts.slice(0, upto + 1).join(' + ')} = ${cum}`, `${text('答え: ')} ${cum}`],
      tags: ['freq_cumulative'],
      key: `frq3:${counts.join(',')}:${upto}`,
      figure,
      verify: `${counts.slice(0, upto + 1).join('+')}`,
    };
  }
  const maxIdx = counts.indexOf(Math.max(...counts));
  if (counts.filter((c) => c === counts[maxIdx]).length > 1) return genFreq(rng, d);
  const mid = start + maxIdx * width + width / 2;
  const options = rng.shuffle([mid, mid + width, mid - width, mid + 2 * width]).map((v) => String(v));
  const correct = options.indexOf(String(mid));
  return {
    templateId: 'g1.data.freq',
    difficulty: d,
    prompt: `${text('最頻値(度数が 最も 多い 階級の 真ん中の 値)は?')}`,
    promptText: '最頻値(度数が最も多い階級の真ん中の値)は?',
    answer: { kind: 'choice', options, correct },
    hint: '一番 高い 柱の 階級を 見つけて、その 真ん中の 値',
    explanation: [`${text(`最も多い階級: ${start + maxIdx * width} 以上 ${start + (maxIdx + 1) * width} 未満`)}`, `${text('答え: ')} ${mid}`],
    tags: ['freq_mode_class'],
    key: `frq3b:${counts.join(',')}`,
    figure,
    verify: String(correct),
  };
}

// ---------------------------------------------------------------- 確率(多数回の試行)

/**
 * 多数回の試行による確率(1 年の内容。学習指導要領解説の「ペットボトルのふたを投げる」例)。
 *   ★1: 投げた回数と 起きた回数から 相対度数を求める
 *   ★2: 回数を増やした表から、確率は およそ いくつと 考えられるか(いちばん多い回数の 相対度数)
 *   ★3: 確率を使って、N 回のうち およそ 何回 起きるかを 予想する
 */
const PROB_SCENES = [
  { thing: 'ペットボトルの キャップ', event: '上向き' },
  { thing: '画びょう', event: '針が 上向き' },
  { thing: '紙コップ', event: '横向き' },
  // 「表(おもて)」は 問題文の「表(ひょう)」と まぎれるので 使わない
];

function genProb(rng: Rng, d: Difficulty): Problem {
  const s = rng.pick(PROB_SCENES);
  if (d === 1) {
    // 相対度数が 小数第 2 位で わり切れるように、起きた回数を 選ぶ
    const n = rng.pick([50, 100, 200, 500, 1000]);
    const unit = Math.max(1, n / 100);
    const c = unit * rng.int(Math.ceil(10 / unit) || 1, Math.floor((n * 0.8) / unit));
    const value = rat(c, n);
    return {
      templateId: 'g1.data.prob',
      difficulty: d,
      prompt: text(`${s.thing}を ${n} 回 投げたら、${s.event}に なったのは ${c} 回だった。${s.event}に なる 相対度数は?`),
      promptText: `${s.thing}を ${n} 回 投げたら、${s.event}に なったのは ${c} 回だった。${s.event}に なる 相対度数は?`,
      answer: { kind: 'number', value },
      hint: '相対度数 = 起きた 回数 ÷ 投げた 回数。小数で 答えよう',
      explanation: [`${c} \\div ${n} = ${toNumber(value)}`, `${text('答え: ')} ${toNumber(value)}`],
      tags: ['prob_relative'],
      key: `prob1:${s.event}:${n}:${c}`,
      verify: `${c}/${n}`,
    };
  }
  // 本当の確率 p(小数第 2 位まで)。回数が少ないうちは ばらつき、多くなると p に 近づく表を作る
  const p100 = rng.int(15, 65);
  if (d === 2) {
    const ns = [50, 100, 200, 500, 1000, 2000];
    const spread = [0.12, 0.08, 0.05, 0.03, 0.015, 0];
    const counts = ns.map((n, i) => {
      const r = p100 / 100 + (rng.int(-100, 100) / 100) * spread[i];
      return Math.min(n, Math.max(0, Math.round(n * r)));
    });
    const last = counts[counts.length - 1];
    return {
      templateId: 'g1.data.prob',
      difficulty: d,
      prompt: text(`表は、${s.thing}を 投げて ${s.event}に なった 回数を まとめたもの。${s.event}に なる 確率は およそ いくつと 考えられるか(小数第2位まで)`),
      promptText: `表は、${s.thing}を 投げて ${s.event}に なった 回数を まとめたもの。${s.event}に なる 確率は およそ いくつと 考えられるか(小数第2位まで)`,
      answer: { kind: 'number', value: rat(p100, 100) },
      hint: '投げる 回数が 多いほど、相対度数は ある 値に 近づく。いちばん 多く 投げたときの 相対度数を 求めよう',
      explanation: [`${text('回数が 多いほど 相対度数は 一定の 値に 近づく')}`, `${last} \\div 2000 = ${p100 / 100}`, `${text('答え: ')} ${p100 / 100}`],
      tags: ['prob_estimate'],
      key: `prob2:${s.event}:${counts.join(',')}`,
      figure: {
        kind: 'table',
        head: ['投げた 回数', ...ns.map(String)],
        rows: [[`${s.event}の 回数`, ...counts.map(String)]],
      },
      verify: `${last}/2000`,
    };
  }
  // ★3: 予想。p × N が 整数に なるように N を選ぶ
  const total = rng.pick([500, 1000, 2000, 3000, 5000]);
  const expected = (p100 * total) / 100;
  return {
    templateId: 'g1.data.prob',
    difficulty: d,
    prompt: text(`${s.thing}を 投げて ${s.event}に なる 確率を ${p100 / 100} とする。${total} 回 投げると、${s.event}に なるのは およそ 何回と 考えられるか`),
    promptText: `${s.thing}を 投げて ${s.event}に なる 確率を ${p100 / 100} とする。${total} 回 投げると、${s.event}に なるのは およそ 何回と 考えられるか`,
    answer: { kind: 'number', value: rat(expected) },
    hint: '起きる 回数 ≒ 投げる 回数 × 確率',
    explanation: [`${total} \\times ${p100 / 100} = ${expected}`, `${text('答え: およそ ')} ${expected} ${text('回')}`],
    tags: ['prob_predict'],
    key: `prob3:${s.event}:${p100}:${total}`,
    verify: `${total}*${p100}/100`,
  };
}

registerTemplate({ id: 'g1.data.mean', unit: UNIT, title: '平均値', timeLimit: { 1: 45, 2: 60, 3: 75 }, generate: genMean });
registerTemplate({ id: 'g1.data.median', unit: UNIT, title: '中央値・最頻値・範囲', timeLimit: { 1: 45, 2: 55, 3: 65 }, generate: genMedian });
registerTemplate({ id: 'g1.data.freq', unit: UNIT, title: '度数分布と相対度数', timeLimit: { 1: 40, 2: 60, 3: 70 }, generate: genFreq });
registerTemplate({ id: 'g1.data.prob', unit: UNIT, title: '確率(相対度数)', timeLimit: { 1: 45, 2: 60, 3: 50 }, generate: genProb });
