import { registerTemplate, type Difficulty, type Problem } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat, toTex } from '@/math/rational';
import { text } from '@/math/format';

/**
 * 第7章「データの活用」のテンプレート(台本 07_record_tower.md の敵に対応)。
 *   g1.data.mean   平均ゴースト      平均値
 *   g1.data.median 中央値の司書      中央値・最頻値・範囲
 *   g1.data.freq   度数コウモリ      度数分布表・相対度数(図つき)
 *   g1.data.approx 近似値フクロウ    近似値・誤差・有効数字
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

// ---------------------------------------------------------------- 近似値

function genApprox(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    // 四捨五入
    const place = rng.pick([10, 100]);
    const n = rng.int(place * 2, place * 90);
    const rounded = Math.round(n / place) * place;
    return {
      templateId: 'g1.data.approx',
      difficulty: d,
      prompt: `${text(`${n} を ${place === 10 ? '十' : '百'}の位まで の 概数にすると?(四捨五入)`)}`,
      promptText: `${n} を${place === 10 ? '十' : '百'}の位までの概数にすると?(四捨五入)`,
      answer: { kind: 'number', value: rat(rounded) },
      hint: `${place === 10 ? '一' : '十'}の位を 四捨五入する`,
      explanation: [`${text('答え: ')} ${rounded}`],
      tags: ['approx_round'],
      key: `apx1:${n}:${place}`,
      verify: `Math.round(${n}/${place})*${place}`,
    };
  }
  if (d === 2) {
    // 真の値の範囲(以上・未満)
    const place = rng.pick([10, 100]);
    const approx = rng.int(2, 90) * place;
    const half = place / 2;
    const options = rng.shuffle([
      `${approx - half} ${text('以上')} ${approx + half} ${text('未満')}`,
      `${approx - place} ${text('以上')} ${approx + place} ${text('未満')}`,
      `${approx} ${text('以上')} ${approx + place} ${text('未満')}`,
      `${approx - half} ${text('より大きく')} ${approx + half} ${text('以下')}`,
    ]);
    const correct = 0;
    const answerText = `${approx - half} ${text('以上')} ${approx + half} ${text('未満')}`;
    const idx = options.indexOf(answerText);
    return {
      templateId: 'g1.data.approx',
      difficulty: d,
      prompt: `${text(`測定値 ${approx}(${place === 10 ? '十' : '百'}の位まで の 概数)の 真の値 a の 範囲は?`)}`,
      promptText: `測定値 ${approx} の真の値 a の範囲は?`,
      answer: { kind: 'choice', options, correct: idx >= 0 ? idx : correct },
      hint: '四捨五入した 位の 半分だけ ずれる',
      explanation: [`${text(`${approx - half} 以上 ${approx + half} 未満`)}`],
      tags: ['approx_range'],
      key: `apx2:${approx}:${place}`,
      verify: String(idx >= 0 ? idx : correct),
    };
  }
  // ★3: 誤差
  const trueV = rng.int(100, 999);
  const place = rng.pick([10, 100]);
  const approx = Math.round(trueV / place) * place;
  const err = approx - trueV;
  return {
    templateId: 'g1.data.approx',
    difficulty: d,
    prompt: `${text(`真の値 ${trueV}、近似値 ${approx} のときの 誤差(近似値 − 真の値)は?`)}`,
    promptText: `真の値 ${trueV}、近似値 ${approx} のときの誤差(近似値 − 真の値)は?`,
    answer: { kind: 'number', value: rat(err) },
    hint: '誤差 = 近似値 − 真の値。マイナスに なることもある',
    explanation: [`${approx} - ${trueV} = ${err}`, `${text('答え: ')} ${err}`],
    tags: ['approx_error'],
    key: `apx3:${trueV}:${place}`,
    verify: `${approx}-${trueV}`,
  };
}

registerTemplate({ id: 'g1.data.mean', unit: UNIT, title: '平均値', timeLimit: { 1: 45, 2: 60, 3: 75 }, generate: genMean });
registerTemplate({ id: 'g1.data.median', unit: UNIT, title: '中央値・最頻値・範囲', timeLimit: { 1: 45, 2: 55, 3: 65 }, generate: genMedian });
registerTemplate({ id: 'g1.data.freq', unit: UNIT, title: '度数分布と相対度数', timeLimit: { 1: 40, 2: 60, 3: 70 }, generate: genFreq });
registerTemplate({ id: 'g1.data.approx', unit: UNIT, title: '近似値と誤差', timeLimit: { 1: 40, 2: 50, 3: 55 }, generate: genApprox });
