import { registerTemplate, mistakeNum, type Difficulty, type Mistake, type Problem } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat, toTex, toNumber, type Rational } from '@/math/rational';
import { text } from '@/math/format';
import type { FigureSpec } from '@/math/figure';
import { choose, type Wrong } from './choice';

/**
 * 第7章「データの活用」のテンプレート(台本 07_record_tower.md の敵に対応)。
 *   g1.data.mean   平均ゴースト      平均値(★2 は 5 人・★3 は 10 人で 小数)、代表値の 選び方
 *   g1.data.median 中央値の司書      中央値(偶数個も)・最頻値・範囲、度数分布表の 最頻値と 中央値の 階級
 *   g1.data.freq   度数コウモリ      度数分布表(以上・未満)・累積度数・相対度数・累積相対度数
 *   g1.data.prob   キマグレフクロウ  多数回の試行による確率(相対度数)。確率は 分数で 見せる
 *
 * 教科書 7 章の 本文(2026-10-16。refs/prints/7章_honbun-features.md)に 合わせた。
 * 度数分布表は 表(以上・未満)で 見せる。相対度数は 小数第 2 位、確率の 実験の 相対度数は 小数第 3 位まで。
 * 近似値・誤差・有効数字は、今の学習指導要領(平成29年告示)では 3 年の内容なので 1 年版では出さない(docs/difficulty.md)
 */
const UNIT = 'データの活用';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
const listTex = (xs: number[]): string => xs.join(',\\ ');
/** 小数の 答えを 見せる 文字(74.1、0.35) */
const dec = (v: Rational): string => String(Math.round(toNumber(v) * 1000) / 1000);

function dataProblem(
  id: string,
  d: Difficulty,
  p: Pick<Problem, 'hint' | 'explanation' | 'tags' | 'key' | 'figure' | 'mistakes' | 'verify' | 'answerLabel' | 'answerUnit' | 'finisher' | 'oncePerNode'> & { q: string; data?: number[]; v: Rational | number },
): Problem {
  const value = typeof p.v === 'number' ? rat(p.v) : p.v;
  return {
    templateId: id,
    difficulty: d,
    prompt: p.data ? `${listTex(p.data)} \\\\ ${text(p.q)}` : text(p.q),
    promptText: p.data ? `${p.data.join(', ')} ${p.q}` : p.q,
    answer: { kind: 'number', value },
    answerLabel: p.answerLabel,
    answerUnit: p.answerUnit,
    finisher: p.finisher,
    oncePerNode: p.oncePerNode,
    layout: 'prose',
    hint: p.hint,
    explanation: p.explanation,
    tags: p.tags,
    key: p.key,
    figure: p.figure,
    mistakes: p.mistakes,
    verify: p.verify,
  };
}

// ---------------------------------------------------------------- 平均値

function genMean(rng: Rng, d: Difficulty): Problem {
  const ID = 'g1.data.mean';
  if (d === 3 && rng.int(0, 2) === 0) return chooseRepresentative(rng, d);
  // ★1: 4〜5 人・整数の 平均 / ★2: 5 人の 得点(平均が 小数第 1 位)/ ★3: 10 人の 得点(小数第 1 位)。
  // 3 けたの 記録の 平均を 四捨五入する 問題は やめた(先生の判定 2026-10-18「四捨五入が 必要な 問題は やめましょう」。10 人は ★3 に)
  const n = d === 1 ? rng.pick([4, 5]) : d === 2 ? 5 : 10;
  const lo = d === 1 ? 10 : 45;
  const hi = d === 1 ? 40 : 95;
  const xs = Array.from({ length: n }, () => rng.int(lo, hi));
  const total = sum(xs);
  const exact = rat(total, n);
  if (d === 1 && exact.d !== 1n) return genMean(rng, d);
  const label = '点';
  const what = 'ゲームの 得点(点)';
  const mistakes: Mistake[] = [mistakeNum(rat(total, n - 1), `データは ${n} こ。${n} で わろう`), mistakeNum(total, '合計を 個数で わるのを 忘れずに')];
  const med = median(xs);
  if (toNumber(exact) !== med) mistakes.push(mistakeNum(rat(Math.round(med * 2), 2), 'それは 中央値(真ん中の 値)。平均値は 合計 ÷ 個数'));
  return dataProblem(ID, d, {
    q: `上の データは ${n} 人の ${what}。平均値は?${exact.d !== 1n ? '(小数で 答える)' : ''}`,
    data: xs,
    v: exact,
    answerLabel: exact.d !== 1n ? dec(exact) : undefined,
    hint: '全部 たして、個数で わる',
    explanation: [text('(平均値)=(データの 値の 合計)÷(データの 総数)'), `${text('合計: ')} ${xs.join(' + ')} = ${total}`, `${total} \\div ${n} = ${exact.d !== 1n ? dec(exact) : toTex(exact)}`, `${text('答え: ')} ${exact.d !== 1n ? dec(exact) : toTex(exact)} ${text(label)}`],
    tags: ['mean'],
    key: `mean:${xs.join(',')}`,
    mistakes,
    verify: `(${xs.join('+')})/${n}`,
  });
}

/** 代表値の 選び方(極端な 値・目的) */
function chooseRepresentative(rng: Rng, d: Difficulty): Problem {
  const facts: { q: string; a: string; w: Wrong[] }[] = [
    { q: 'ほかから 大きく はずれた 値(極端な 値)が ふくまれる データで、その 影響を いちばん 受けるのは どれか?', a: '平均値', w: [{ opt: '中央値', say: '中央値は 真ん中の 値なので、はしの 値が 大きく なっても あまり 変わらないよ' }, { opt: '最頻値', say: '最頻値は いちばん 多い 値。極端な 値 1 つでは 変わらないよ' }, { opt: 'どれも 同じように 受ける' }] },
    { q: '5 人の こづかいが 1000 円、1200 円、1300 円、1500 円、20000 円。この データの ようすを 表すのに 適した 代表値は?', a: '中央値', w: [{ opt: '平均値', say: '20000 円が 平均値を 大きく 引き上げるので、多くの 人の ようすとは ずれるよ' }, { opt: '最大値', say: '最大値は 代表値では ないよ' }, { opt: '範囲' }] },
    { q: '靴の 店が、いちばん よく 売れる サイズを 多めに 仕入れたい。参考に する 代表値は?', a: '最頻値', w: [{ opt: '平均値', say: '平均の サイズの 靴が いちばん 売れるとは かぎらないよ' }, { opt: '中央値' }, { opt: '範囲' }] },
    { q: '左右 対称な 山の 形の 分布で、平均値・中央値・最頻値の 関係は?', a: 'ほぼ 同じ 値に なる', w: [{ opt: '平均値が いちばん 大きい', say: '左右 対称なら、真ん中・平均・山の 頂上が そろうよ' }, { opt: '中央値が いちばん 小さい' }, { opt: '関係は ない' }] },
    { q: 'データの 散らばりぐあいを 表す 値として、(最大値)−(最小値)を 何という?', a: '範囲(レンジ)', w: [{ opt: '中央値(メジアン)', say: '中央値は 真ん中の 値' }, { opt: '最頻値(モード)' }, { opt: '相対度数' }] },
    { q: '平均値が 同じ 2 つの データ。ちがいが わかるのは?', a: '範囲や ヒストグラム(散らばりぐあい)', w: [{ opt: '平均値だけで 十分', say: '平均だけでは 散らばりは わからない(碑文の ことば)' }, { opt: '合計', say: '個数が 同じなら 合計も 同じに なるよ' }, { opt: 'データの 個数' }] },
  ];
  const f = rng.pick(facts);
  const { answer, mistakes } = choose(rng, f.a, f.w);
  return {
    templateId: 'g1.data.mean',
    difficulty: d,
    prompt: text(f.q),
    promptText: f.q,
    answer,
    layout: 'prose',
    hint: '平均値・中央値・最頻値の ちがいを 思い出そう',
    explanation: [text(`答え: ${f.a}`), text('極端な 値が あると 平均値は 影響を 受けるが、中央値や 最頻値は あまり 受けない')],
    tags: ['mean_choose'],
    key: `mean:rep:${f.q}`,
    mistakes,
    verify: String(answer.kind === 'choice' ? answer.correct : 0),
  };
}

function median(xs: number[]): number {
  const s = sorted(xs);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

// ---------------------------------------------------------------- 度数分布表

interface Table {
  /** 何の 記録か(表の 見出し) */
  title: string;
  unit: string;
  lows: number[];
  width: number;
  counts: number[];
  /** 小数の 階級(50 m 走) */
  decimals: number;
}

/** 表の 場面。start と width は 組で 使う(教科書: 50 m 走は 7.0 秒から 0.4 秒きざみ・6.5 秒から 0.5 秒きざみ) */
const SCENES = [
  { title: '50 m 走の 記録(秒)', unit: '秒', grids: [[7.0, 0.4], [6.5, 0.5]], decimals: 1, classes: 7 },
  { title: '1500 m 走の 記録(秒)', unit: '秒', grids: [[290, 10], [300, 10]], decimals: 0, classes: 8 },
  { title: 'ゲームの 得点(点)', unit: '点', grids: [[40, 10], [50, 10]], decimals: 0, classes: 6 },
  { title: 'ハンドボール投げの 記録(m)', unit: 'm', grids: [[8, 4], [10, 2]], decimals: 0, classes: 6 },
];

const fmt = (v: number, dec: number) => (dec ? v.toFixed(dec) : String(v));

function makeTable(rng: Rng, total?: number): Table {
  const s = rng.pick(SCENES);
  const [start, width] = rng.pick(s.grids);
  const k = s.classes;
  // 山の 形(真ん中が 多い)に 近い 度数
  const shape = Array.from({ length: k }, (_, i) => Math.max(1, Math.round(6 - Math.abs(i - (k - 1) / 2) * 1.6) + rng.int(-1, 2)));
  let counts = shape;
  if (total) {
    // 合計を total に そろえる(相対度数が 小数第 2 位で わり切れるように)
    const t0 = sum(shape);
    counts = shape.map((c) => Math.max(1, Math.round((c * total) / t0)));
    let diff = total - sum(counts);
    for (let i = 0; diff !== 0 && i < 100; i++) {
      const j = Math.floor(k / 2) + ((i % k) - Math.floor(k / 2));
      const jj = Math.min(k - 1, Math.max(0, j));
      if (diff > 0) {
        counts[jj]++;
        diff--;
      } else if (counts[jj] > 1) {
        counts[jj]--;
        diff++;
      }
    }
  }
  const lows = Array.from({ length: k }, (_, i) => Number((start + i * width).toFixed(s.decimals)));
  return { title: s.title, unit: s.unit, lows, width, counts, decimals: s.decimals };
}

const classLabel = (t: Table, i: number) => `${fmt(t.lows[i], t.decimals)} 以上 ${fmt(t.lows[i] + t.width, t.decimals)} 未満`;

function tableFigure(t: Table, extra?: { head: string; values: string[] }): FigureSpec {
  return {
    kind: 'table',
    head: [t.title, '度数(人)', ...(extra ? [extra.head] : [])],
    rows: [
      ...t.counts.map((c, i) => [`${fmt(t.lows[i], t.decimals)} 〜 ${fmt(t.lows[i] + t.width, t.decimals)}`, String(c), ...(extra ? [extra.values[i]] : [])]),
      ['合計', String(sum(t.counts)), ...(extra ? [''] : [])],
    ],
    caption: '階級は「以上 〜 未満」',
  };
}

function genFreq(rng: Rng, d: Difficulty): Problem {
  const ID = 'g1.data.freq';
  const ask = d === 1 ? rng.pick(['width', 'count', 'which', 'which', 'hist'] as const) : d === 2 ? rng.pick(['cum', 'rel', 'rel', 'which'] as const) : rng.pick(['cumRel', 'percent', 'relRound', 'cum'] as const);
  // 相対度数が 小数第 2 位で わり切れる 合計(20・25・50)。40 人・42 人などは 四捨五入(教科書の 50 m 走 40 人・1500 m 走 42 人)
  const total = ask === 'rel' || ask === 'cumRel' || ask === 'percent' ? rng.pick([20, 25, 50]) : ask === 'relRound' ? rng.pick([30, 40, 42, 45]) : undefined;
  const t = makeTable(rng, total);
  const n = sum(t.counts);
  const k = t.counts.length;
  const fig = tableFigure(t);
  const key = `${t.title}:${t.lows[0]}:${t.width}:${t.counts.join(',')}`;
  if (ask === 'width') {
    const w = t.width;
    return dataProblem(ID, d, {
      q: `表は ${t.title}の 度数分布表。階級の幅は いくつ?(${t.unit})`,
      v: rat(Math.round(w * 10), 10),
      answerLabel: fmt(w, t.decimals),
      hint: '1 つの 階級の「以上」と「未満」の 差',
      explanation: [text(`${classLabel(t, 0)} の 階級で、${fmt(t.lows[0] + w, t.decimals)} − ${fmt(t.lows[0], t.decimals)} = ${fmt(w, t.decimals)}`), `${text('答え: ')} ${fmt(w, t.decimals)} ${text(t.unit)}`],
      tags: ['freq_width'],
      key: `frq:w:${key}`,
      figure: fig,
      mistakes: [mistakeNum(rat(k), 'それは 階級の 数。階級の幅は 1 つの 区間の 大きさ'), mistakeNum(rat(Math.round(t.lows[0] * 10), 10), 'それは 最初の 階級の 下の はし。「以上」と「未満」の 差を 求めよう')],
      verify: `${w}`,
    });
  }
  if (ask === 'count' || ask === 'hist') {
    const i = rng.int(0, k - 1);
    const figure: FigureSpec =
      ask === 'hist'
        ? { kind: 'chart', type: 'histogram', labels: t.lows.map((l) => fmt(l, t.decimals)), values: t.counts, xTitle: `${t.title}(左の はしが 階級の 下の 値)`, yTitle: '度数(人)' }
        : fig;
    return dataProblem(ID, d, {
      q: `${ask === 'hist' ? 'ヒストグラム' : '度数分布表'}で、${classLabel(t, i)} の 階級の 度数は 何人?`,
      v: t.counts[i],
      hint: ask === 'hist' ? 'その 階級の 長方形の 高さを 読もう' : '表の その 階級の 行を 見よう',
      explanation: [`${text('答え: ')} ${t.counts[i]} ${text('人')}`],
      tags: [ask === 'hist' ? 'freq_hist' : 'freq_read'],
      key: `frq:c:${key}:${i}:${ask}`,
      figure,
      mistakes: i + 1 < k ? [mistakeNum(t.counts[i + 1], '1 つ となりの 階級を 見て いないかな')] : [mistakeNum(t.counts[i - 1], '1 つ となりの 階級を 見て いないかな')],
      verify: `${t.counts[i]}`,
    });
  }
  if (ask === 'which') {
    // 境目の 値(下の はし)は その 階級に 入る(以上)
    const i = rng.int(1, k - 1);
    const boundary = rng.int(0, 2) > 0;
    const x = boundary ? t.lows[i] : Number((t.lows[i] + t.width / 2).toFixed(t.decimals));
    const { answer, mistakes } = choose(rng, classLabel(t, i), [
      { opt: classLabel(t, i - 1), say: boundary ? `${fmt(x, t.decimals)} は「${fmt(x, t.decimals)} 以上」の 階級に 入るよ(「未満」には 入らない)` : '1 つ 下の 階級だよ' },
      ...(i + 1 < k ? [{ opt: classLabel(t, i + 1), say: '1 つ 上の 階級だよ' }] : []),
      ...(i >= 2 ? [{ opt: classLabel(t, i - 2) }] : []),
    ]);
    return {
      templateId: ID,
      difficulty: d,
      prompt: text(`表の 度数分布表で、${fmt(x, t.decimals)} ${t.unit} の 記録は どの 階級に 入る?`),
      promptText: `表の度数分布表で、${fmt(x, t.decimals)} ${t.unit} の記録はどの階級に入る?`,
      answer,
      layout: 'prose',
      hint: '階級は「○ 以上 △ 未満」。境目の 値は「以上」の ほうに 入る',
      explanation: [text(`${fmt(x, t.decimals)} は ${classLabel(t, i)} に 入る`), ...(boundary ? [text('「未満」は その 値を ふくまない。「以上」は ふくむ')] : [])],
      tags: [boundary ? 'freq_boundary' : 'freq_which'],
      key: `frq:which:${key}:${x}`,
      figure: fig,
      mistakes,
      verify: String(answer.kind === 'choice' ? answer.correct : 0),
    };
  }
  if (ask === 'cum') {
    const i = rng.int(1, k - 2);
    const cum = sum(t.counts.slice(0, i + 1));
    const upper = fmt(t.lows[i] + t.width, t.decimals);
    const asCount = rng.bool();
    return dataProblem(ID, d, {
      q: asCount ? `表で、記録が ${upper} ${t.unit} 未満の 人は 何人?` : `表で、${classLabel(t, i)} の 階級の 累積度数は?(人)`,
      v: cum,
      hint: '最初の 階級から その 階級までの 度数を たす',
      explanation: [text('累積度数 = 最初の 階級から その 階級までの 度数の 合計'), `${t.counts.slice(0, i + 1).join(' + ')} = ${cum}`, `${text('答え: ')} ${cum} ${text('人')}`],
      tags: ['freq_cumulative'],
      key: `frq:cum:${key}:${i}:${asCount}`,
      figure: fig,
      mistakes: [mistakeNum(cum - t.counts[i], 'その 階級の 度数も ふくめて たそう'), mistakeNum(t.counts[i], 'それは その 階級だけの 度数。最初の 階級から たそう'), mistakeNum(cum + t.counts[i + 1], `${upper} 未満 だから、${upper} 以上の 階級は 入れないよ`)],
      verify: `${t.counts.slice(0, i + 1).join('+')}`,
    });
  }
  if (ask === 'rel' || ask === 'relRound') {
    const i = rng.int(0, k - 1);
    const exact = rat(t.counts[i], n);
    const v = ask === 'rel' ? exact : rat(Math.round((t.counts[i] / n) * 100), 100);
    if (ask === 'relRound' && exact.d <= 100n && 100n % exact.d === 0n) return genFreq(rng, d);
    return dataProblem(ID, d, {
      q: `表で、${classLabel(t, i)} の 階級の 相対度数は?(小数で${ask === 'relRound' ? '、小数第 3 位を 四捨五入して 小数第 2 位まで' : ''})`,
      v,
      answerLabel: dec(v),
      hint: '相対度数 =(その 階級の 度数)÷(度数の 合計)',
      explanation: [text('(相対度数)=(その 階級の 度数)÷(度数の 合計)'), `${t.counts[i]} \\div ${n} = ${ask === 'rel' ? dec(v) : (t.counts[i] / n).toFixed(4) + '\\cdots'}`, `${text('答え: ')} ${dec(v)}`],
      tags: [ask === 'rel' ? 'freq_relative' : 'freq_relative_round'],
      key: `frq:rel:${key}:${i}`,
      figure: fig,
      mistakes: [mistakeNum(rat(n, t.counts[i]), 'わる 順が 逆。度数 ÷ 合計'), mistakeNum(rat(t.counts[i], 100), '合計の 人数で わろう'), ...(i > 0 ? [mistakeNum(rat(Math.round((sum(t.counts.slice(0, i + 1)) / n) * 100), 100), 'それは 累積相対度数。その 階級だけで 考えよう')] : [])],
      verify: ask === 'rel' ? `${t.counts[i]}/${n}` : `Math.round(${t.counts[i]}/${n}*100)/100`,
    });
  }
  {
    // 累積相対度数 または %(最頻値の 階級値は 2 で わるので 出さない。先生の判定 2026-10-18)
    const i = rng.int(1, k - 2);
    const cum = sum(t.counts.slice(0, i + 1));
    const v = ask === 'cumRel' ? rat(cum, n) : rat(cum * 100, n);
    const upper = fmt(t.lows[i] + t.width, t.decimals);
    return dataProblem(ID, d, {
      q:
        ask === 'cumRel'
          ? `表で、${classLabel(t, i)} の 階級の 累積相対度数は?(小数で)`
          : `表で、記録が ${upper} ${t.unit} 未満の 人は、全体の 何 % ?`,
      v,
      answerLabel: dec(v),
      answerUnit: ask === 'percent' ? '%' : undefined,
      // 累積相対度数は 難しいので 1 つの 地点で 1 問まで(先生の判定 2026-10-18「各ダンジョンで 1 問だけ」)
      oncePerNode: ask === 'cumRel' ? 'freq_cum_relative' : undefined,
      hint: ask === 'cumRel' ? '最初の 階級から その 階級までの 度数の 合計(累積度数)÷ 合計' : '累積度数 ÷ 合計 で 割合、100 を かけて %',
      explanation: [
        `${text('累積度数: ')} ${t.counts.slice(0, i + 1).join(' + ')} = ${cum}`,
        ask === 'cumRel' ? `${cum} \\div ${n} = ${dec(v)}` : `${cum} \\div ${n} \\times 100 = ${dec(v)}`,
        `${text('答え: ')} ${dec(v)}${ask === 'percent' ? text(' %') : ''}`,
      ],
      tags: [ask === 'cumRel' ? 'freq_cum_relative' : 'freq_percent'],
      key: `frq:${ask}:${key}:${i}`,
      figure: fig,
      mistakes:
        ask === 'cumRel'
          ? [mistakeNum(rat(t.counts[i], n), 'それは その 階級だけの 相対度数。最初の 階級から たそう'), mistakeNum(rat(cum - t.counts[i], n), 'その 階級の 度数も ふくめよう')]
          : [mistakeNum(rat(cum, n), '割合を % に するには 100 を かけよう'), mistakeNum(cum, 'それは 人数。全体に 対する 割合(%)を 求めよう')],
      verify: ask === 'cumRel' ? `(${t.counts.slice(0, i + 1).join('+')})/${n}` : `(${t.counts.slice(0, i + 1).join('+')})/${n}*100`,
    });
  }
}

// ---------------------------------------------------------------- 中央値・最頻値・範囲

function genMedian(rng: Rng, d: Difficulty): Problem {
  const ID = 'g1.data.median';
  const ask = d === 1 ? rng.pick(['medOdd', 'medOdd', 'range'] as const) : d === 2 ? rng.pick(['medEven', 'medEven', 'mode', 'range'] as const) : rng.pick(['medClass', 'medEven', 'judge'] as const);
  // 度数分布表の 最頻値(階級値 = 2 で わる)は 出さない(先生の判定 2026-10-18「割らないと いけない 最頻値は やめておきましょう」)
  if (ask === 'medClass') return medianClass(rng, d);
  if (ask === 'judge') return judgeStatement(rng, d);
  if (ask === 'mode') {
    const n = rng.pick([7, 8, 9, 10]);
    const value = rng.int(15, 30);
    const others: number[] = [];
    while (others.length < n - 3) {
      const v = rng.int(10, 35);
      if (v !== value && !others.includes(v)) others.push(v);
    }
    const xs = rng.shuffle([value, value, value, ...others]);
    return dataProblem(ID, d, {
      q: '上の データの 最頻値は?',
      data: xs,
      v: value,
      hint: 'データの 中で もっとも 多く 出てくる 値',
      explanation: [text(`${value} が 3 回 出てくる(ほかは 1 回ずつ)`), `${text('答え: ')} ${value}`],
      tags: ['mode'],
      key: `mode:${xs.join(',')}`,
      mistakes: [mistakeNum(3, 'それは 出てきた 回数。最頻値は その 値'), ...(median(xs) !== value ? [mistakeNum(rat(Math.round(median(xs) * 2), 2), 'それは 中央値。最頻値は いちばん 多く 出てくる 値')] : [])],
      verify: `${value}`,
    });
  }
  const n = ask === 'medOdd' ? rng.pick([5, 7, 9]) : ask === 'medEven' ? rng.pick([6, 8, 10]) : rng.pick([7, 8, 10]);
  const lo = d === 1 ? 1 : 40;
  const hi = d === 1 ? 30 : 95;
  const xs: number[] = [];
  while (xs.length < n) xs.push(rng.int(lo, hi));
  const s = sorted(xs);
  if (ask === 'range') {
    const r = s[n - 1] - s[0];
    return dataProblem(ID, d, {
      q: '上の データの 範囲は?',
      data: xs,
      v: r,
      hint: '範囲は、最大値と 最小値の 差だよ',
      explanation: [text(`最大値 ${s[n - 1]}、最小値 ${s[0]}`), `${s[n - 1]} - ${s[0]} = ${r}`, `${text('答え: ')} ${r}`],
      tags: ['range'],
      key: `rng:${xs.join(',')}`,
      mistakes: [mistakeNum(s[n - 1], 'それは 最大値。最小値を ひこう'), mistakeNum(s[n - 1] + s[0], '最大値 − 最小値。たすのでは なく ひくよ'), mistakeNum(xs[xs.length - 1] - xs[0], '並べかえて から、いちばん 大きい 値と 小さい 値を さがそう')],
      verify: `${s[n - 1]}-${s[0]}`,
    });
  }
  const mid = n % 2 === 1 ? rat(s[(n - 1) / 2]) : rat(s[n / 2 - 1] + s[n / 2], 2);
  const unsortedMid = n % 2 === 1 ? rat(xs[(n - 1) / 2]) : rat(xs[n / 2 - 1] + xs[n / 2], 2);
  const mistakes: Mistake[] = [mistakeNum(unsortedMid, 'まず 小さい 順に 並べかえよう。並べる 前の 真ん中では ないよ')];
  if (n % 2 === 0) mistakes.push(mistakeNum(s[n / 2 - 1], `データが ${n} こ(偶数)なので、真ん中の 2 つ(${n / 2} 番目と ${n / 2 + 1} 番目)の 平均`), mistakeNum(s[n / 2], `データが ${n} こ(偶数)なので、真ん中の 2 つの 平均`));
  mistakes.push(mistakeNum(rat(sum(xs), n), 'それは 平均値。中央値は 並べた ときの 真ん中の 値'));
  return dataProblem(ID, d, {
    q: `上の データの 中央値は?${mid.d !== 1n ? '(小数で 答える)' : ''}`,
    data: xs,
    v: mid,
    answerLabel: mid.d !== 1n ? dec(mid) : undefined,
    hint: n % 2 === 1 ? '小さい 順に 並べて 真ん中' : '小さい 順に 並べて、真ん中の 2 つの 平均',
    explanation: [
      `${text('小さい 順: ')} ${listTex(s)}`,
      n % 2 === 1 ? text(`${n} こ だから ${(n + 1) / 2} 番目`) : `${text(`${n} こ(偶数)だから ${n / 2} 番目と ${n / 2 + 1} 番目の 平均: `)} (${s[n / 2 - 1]} + ${s[n / 2]}) \\div 2 = ${dec(mid)}`,
      `${text('答え: ')} ${dec(mid)}`,
    ],
    tags: [n % 2 === 1 ? 'median' : 'median_even'],
    key: `med:${xs.join(',')}`,
    mistakes,
    verify: n % 2 === 1 ? `${s[(n - 1) / 2]}` : `(${s[n / 2 - 1]}+${s[n / 2]})/2`,
  });
}

/** 度数分布表から: 中央値が ふくまれる 階級 */
function medianClass(rng: Rng, d: Difficulty): Problem {
  const t = makeTable(rng, rng.pick([20, 25, 30, 40]));
  const n = sum(t.counts);
  const k = t.counts.length;
  const fig = tableFigure(t);
  const key = `${t.title}:${t.lows[0]}:${t.width}:${t.counts.join(',')}`;
  // 中央値が ふくまれる 階級(n が 偶数なら n/2 番目と n/2+1 番目)
  const pos = n % 2 ? [(n + 1) / 2] : [n / 2, n / 2 + 1];
  const classOf = (p: number) => {
    let c = 0;
    for (let i = 0; i < k; i++) {
      c += t.counts[i];
      if (p <= c) return i;
    }
    return k - 1;
  };
  const ci = pos.map(classOf);
  if (ci.length === 2 && ci[0] !== ci[1]) return medianClass(rng, d);
  const i = ci[0];
  const maxI = t.counts.indexOf(Math.max(...t.counts));
  const { answer, mistakes } = choose(rng, classLabel(t, i), [
    ...(maxI !== i ? [{ opt: classLabel(t, maxI), say: 'それは 度数が もっとも 多い 階級(最頻値の 階級)。中央値は 小さい ほうから 数えて 真ん中' }] : []),
    ...(i > 0 ? [{ opt: classLabel(t, i - 1), say: '累積度数を 数えて、真ん中の 人が 入る 階級を さがそう' }] : []),
    ...(i + 1 < k ? [{ opt: classLabel(t, i + 1), say: '累積度数を 数えて、真ん中の 人が 入る 階級を さがそう' }] : []),
    { opt: classLabel(t, Math.floor((k - 1) / 2)), say: '表の 真ん中の 行では なく、人数の 真ん中' },
  ]);
  let acc = 0;
  const cums = t.counts.map((c) => (acc += c));
  return {
    templateId: 'g1.data.median',
    difficulty: d,
    prompt: text(`表の 度数分布表(合計 ${n} 人)で、中央値が ふくまれる 階級は?`),
    promptText: `表の度数分布表(合計 ${n} 人)で、中央値がふくまれる階級は?`,
    answer,
    layout: 'prose',
    hint: n % 2 ? `${(n + 1) / 2} 番目の 人が 入る 階級。累積度数を 数えよう` : `${n / 2} 番目と ${n / 2 + 1} 番目の 人が 入る 階級。累積度数を 数えよう`,
    explanation: [text(`累積度数: ${cums.join('、')}`), text(n % 2 ? `${(n + 1) / 2} 番目は ${classLabel(t, i)}` : `${n / 2} 番目と ${n / 2 + 1} 番目は ${classLabel(t, i)}`)],
    tags: ['median_class'],
    key: `med:class:${key}`,
    // 累積度数の 列は 見せない(自分で たして さがす。解説で 見せる)
    figure: fig,
    mistakes,
    verify: String(answer.kind === 'choice' ? answer.correct : 0),
  };
}

/** 代表値・範囲の 表から 確実に いえる ことか(2 節 札幌の 最低気温) */
function judgeStatement(rng: Rng, d: Difficulty): Problem {
  const a = { mean: rng.int(40, 60), med: rng.int(40, 60), min: rng.int(10, 30), max: rng.int(80, 98) };
  const b = { mean: a.mean + rng.pick([-6, -4, 4, 6]), med: a.med + rng.pick([-5, -3, 3, 5]), min: a.min + rng.pick([-6, 6]), max: a.max + (a.max > 92 ? -8 : rng.pick([-8, 8])) };
  const rA = a.max - a.min;
  const rB = b.max - b.min;
  if (rA === rB) return judgeStatement(rng, d);
  const smallerRange = rA < rB ? 'A 組' : 'B 組';
  const correct = `${smallerRange}の ほうが、最高点と 最低点の 差が 小さい`;
  const higherMed = a.med > b.med ? 'A 組' : 'B 組';
  const { answer, mistakes } = choose(rng, correct, [
    { opt: `${higherMed}の ほうが、80 点以上の 人が 多い`, say: '中央値や 平均値だけでは、80 点以上の 人数は わからないよ' },
    { opt: `${a.mean > b.mean ? 'A 組' : 'B 組'}の 全員が、もう 一方の 組の 全員より 点が 高い`, say: '平均値が 高くても、全員が 高いとは かぎらないよ' },
    { opt: `${smallerRange === 'A 組' ? 'B 組' : 'A 組'}の ほうが、最高点と 最低点の 差が 小さい`, say: '範囲(最大値 − 最小値)を それぞれ 計算して くらべよう' },
  ]);
  return {
    templateId: 'g1.data.median',
    difficulty: d,
    prompt: text('表は 2 つの 組の テストの 結果。表から 確実に いえる ことは?'),
    promptText: '表は2つの組のテストの結果。表から確実にいえることは?',
    answer,
    layout: 'prose',
    hint: '代表値や 範囲から 確実に わかる ことか 考えよう',
    explanation: [text(`範囲: A 組 ${a.max} − ${a.min} = ${rA}、B 組 ${b.max} − ${b.min} = ${rB}`), text(`答え: ${correct}`)],
    tags: ['judge'],
    key: `med:judge:${JSON.stringify([a, b])}`,
    // 表を 読んで 4 つの 文を くらべる 重い 問題なので、正解したら 1 撃で たおせる(先生の判定 2026-10-18)
    finisher: true,
    figure: {
      kind: 'table',
      head: ['', '平均値', '中央値', '最小値', '最大値'],
      rows: [
        ['A 組', String(a.mean), String(a.med), String(a.min), String(a.max)],
        ['B 組', String(b.mean), String(b.med), String(b.min), String(b.max)],
      ],
      caption: '単位は 点',
    },
    mistakes,
    verify: String(answer.kind === 'choice' ? answer.correct : 0),
  };
}

// ---------------------------------------------------------------- 確率(多数回の試行)

const PROB_SCENES = [
  { thing: 'ペットボトルの キャップ', event: '表向き', other: '裏向き' },
  { thing: '画びょう', event: '針が 上向き', other: '針が 下向き' },
  { thing: 'びんの 王冠', event: '上向き', other: '下向き' },
  { thing: '紙コップ', event: '横向き', other: 'それ以外' },
];

function genProb(rng: Rng, d: Difficulty): Problem {
  const ID = 'g1.data.prob';
  const s = rng.pick(PROB_SCENES);
  // ★1: 相対度数・どちらが 起こりやすいか / ★2: 2 社の 割合・回数の 予想(分母 4・5・10)/ ★3: 回数の 予想(分母 20・25・50)・上ばき・2 社。
  // 表から 確率を 読む 問題は あいまいなので やめた。確率は 分数で 見せる(先生の判定 2026-10-18)
  const ask = d === 1 ? rng.pick(['rel', 'rel', 'likely'] as const) : d === 2 ? rng.pick(['compare', 'predict'] as const) : rng.pick(['predict', 'predict', 'compare'] as const);
  if (ask === 'rel') {
    // 教科書: 200 回 中 43 回 → 0.215(小数第 3 位まで)
    const n = rng.pick([200, 400, 500, 1000, 2000]);
    const c = rng.int(Math.round(n * 0.12), Math.round(n * 0.8));
    // 小数第 3 位で わり切れる 回数だけ(2000 回 中 421 回 → 0.2105 は 出さない)
    if ((1000 * c) % n !== 0) return genProb(rng, d);
    const v = rat(c, n);
    return dataProblem(ID, d, {
      q: `${s.thing}を ${n} 回 投げたら、${s.event}に なったのは ${c} 回 だった。${s.event}に なる 場合の 相対度数は?(小数で)`,
      v,
      answerLabel: dec(v),
      hint: '相対度数 =(起きた 回数)÷(投げた 回数)',
      explanation: [`${c} \\div ${n} = ${dec(v)}`, `${text('答え: ')} ${dec(v)}`],
      tags: ['prob_relative'],
      key: `prob1:${s.event}:${n}:${c}`,
      mistakes: [mistakeNum(rat(n, c), 'わる 順が 逆。起きた 回数 ÷ 投げた 回数'), mistakeNum(rat(n - c, n), `それは ${s.other}に なる 相対度数`), mistakeNum(rat(c, 100), `投げた ${n} 回で わろう`)],
      verify: `${c}/${n}`,
    });
  }
  // 本当の 確率 p(小数第 2 位まで)。回数が 少ないうちは ばらつき、多く なると p に 近づく 表
  const p100 = rng.int(15, 85);
  if (p100 === 50) return genProb(rng, d);
  if (ask === 'likely') {
    const n = rng.pick([1000, 2000]);
    const c = Math.round((n * p100) / 100);
    const eventLikely = p100 > 50;
    const { answer, mistakes } = choose(rng, eventLikely ? s.event : s.other, [{ opt: eventLikely ? s.other : s.event, say: `${s.event}の 相対度数は ${c} ÷ ${n} = ${p100 / 100}。0.5 より ${eventLikely ? '大きい' : '小さい'}よ` }, { opt: 'どちらとも いえない', say: '多数回の 実験の 相対度数で 判断できるよ' }]);
    return {
      templateId: ID,
      difficulty: d,
      prompt: text(`${s.thing}を ${n} 回 投げたら、${s.event}に なったのは ${c} 回。${s.event}と ${s.other}、どちらが 起こりやすいと いえる?`),
      promptText: `${s.thing}を ${n} 回投げたら、${s.event}になったのは ${c} 回。${s.event}と${s.other}、どちらが起こりやすいといえる?`,
      answer,
      layout: 'prose',
      hint: '相対度数を 求めて、0.5 と くらべよう',
      explanation: [`${c} \\div ${n} = ${p100 / 100}`, text(`${s.event}の 相対度数は 0.5 より ${eventLikely ? '大きい' : '小さい'} → ${eventLikely ? s.event : s.other}の ほうが 起こりやすい`), text(`答え: ${eventLikely ? s.event : s.other}`)],
      tags: ['prob_likely'],
      key: `prob:likely:${s.event}:${n}:${c}`,
      mistakes,
      verify: String(answer.kind === 'choice' ? answer.correct : 0),
    };
  }
  if (ask === 'compare') {
    // クジラの ツアー: 出航 回数と 出会った 回数(割合で くらべる)
    for (let t = 0; t < 50; t++) {
      const nA = rng.pick([20, 40, 50]);
      const cA = rng.int(Math.round(nA * 0.6), nA - 1);
      const nB = rng.pick([200, 360, 400, 500]);
      const cB = rng.int(Math.round(nB * 0.6), nB - 5);
      const rA = cA / nA;
      const rB = cB / nB;
      if (Math.abs(rA - rB) < 0.02 || cB < cA) continue;
      // 回数だけなら B が 多いので、割合で くらべる ことが 大切
      const better = rA > rB ? 'A 社' : 'B 社';
      const { answer, mistakes } = choose(rng, better, [
        { opt: better === 'A 社' ? 'B 社' : 'A 社', say: better === 'A 社' ? '出会った 回数は B 社が 多いが、出航した 回数も ちがう。割合(相対度数)で くらべよう' : `相対度数を 求めて くらべよう(A 社 ${cA}÷${nA}、B 社 ${cB}÷${nB})` },
        { opt: 'どちらも 同じ', say: '相対度数を 計算して くらべよう' },
      ]);
      return {
        templateId: ID,
        difficulty: d,
        prompt: text(`クジラを 見る ツアー。A 社は 出航 ${nA} 回で ${cA} 回、B 社は 出航 ${nB} 回で ${cB} 回 クジラに 出会った。出会いやすいのは?`),
        promptText: `クジラを見るツアー。A社は出航 ${nA} 回で ${cA} 回、B社は出航 ${nB} 回で ${cB} 回クジラに出会った。出会いやすいのは?`,
        answer,
        layout: 'prose',
        hint: '回数では なく、出航した 回数に 対する 割合(相対度数)で くらべる',
        explanation: [`${text('A 社: ')} ${cA} \\div ${nA} = ${rA.toFixed(3)}`, `${text('B 社: ')} ${cB} \\div ${nB} = ${rB.toFixed(3)}\\cdots`, text(`答え: ${better}`)],
        tags: ['prob_compare'],
        key: `prob:cmp:${nA}:${cA}:${nB}:${cB}`,
        mistakes,
        verify: String(answer.kind === 'choice' ? answer.correct : 0),
      };
    }
    return genProb(rng, d);
  }
  // 予想: 起きる 回数 ≒ 投げる 回数 × 確率(★3 は 上ばきの サイズも)
  if (d === 2 || rng.bool()) {
    const b = d === 2 ? rng.pick([4, 5, 10]) : rng.pick([20, 25, 50]);
    const a = rng.int(1, b - 1);
    // 約分できない・0.15〜0.85・1/2 でない 分数
    if (gcd(a, b) !== 1 || a / b < 0.15 || a / b > 0.85 || a * 2 === b) return genProb(rng, d);
    const total = rng.pick([500, 1000, 2000]);
    const expected = (total * a) / b;
    const pre = `${s.thing}を 投げて ${s.event}に なる 確率を`;
    const post = `と する。${total} 回 投げると、${s.event}に なるのは およそ 何回と 考えられるか`;
    return {
      templateId: ID,
      difficulty: d,
      prompt: `${text(pre)} \\dfrac{${a}}{${b}} ${text(post)}`,
      promptText: `${pre} ${a}/${b} ${post}`,
      answer: { kind: 'number', value: rat(expected) },
      answerUnit: '回',
      layout: 'prose',
      hint: '起きる 回数 ≒ 投げる 回数 × 確率',
      explanation: [`${total} \\times \\dfrac{${a}}{${b}} = ${expected}`, `${text('答え: およそ ')} ${expected} ${text('回')}`],
      tags: ['prob_predict'],
      key: `prob3:${s.event}:${a}/${b}:${total}`,
      mistakes: [mistakeNum(total - expected, `それは ${s.other}に なる 回数`), mistakeNum(rat(total * b, a), 'わるのでは なく、かけるよ(回数 × 確率)')],
      verify: `${total}*${a}/${b}`,
    };
  }
  const size = rng.pick(['23.5', '24.0', '24.5', '25.0']);
  const rel = rng.pick([0.1, 0.15, 0.2, 0.25, 0.3]);
  const people = rng.pick([120, 160, 200, 240, 300]);
  const v = Math.round(rel * people);
  return dataProblem(ID, d, {
    q: `過去 3 年の データで、新入生が 買った 上ばきの うち ${size} cm の 相対度数は ${rel}。来年の 新入生 ${people} 人の ために、${size} cm は およそ 何足 仕入れれば よいか`,
    v,
    hint: '同じ 傾向が くり返し 見られるなら、相対度数 × 人数 で 予想できる',
    explanation: [`${people} \\times ${rel} = ${v}`, `${text('答え: およそ ')} ${v} ${text('足')}`],
    tags: ['prob_predict_shoe'],
    key: `prob3:shoe:${size}:${rel}:${people}`,
    mistakes: [mistakeNum(people - v, 'それは ほかの サイズの 足数'), mistakeNum(Math.round(people / rel), 'わるのでは なく、かけるよ(人数 × 相対度数)')],
    verify: `Math.round(${people}*${rel})`,
  });
}

registerTemplate({ id: 'g1.data.mean', unit: UNIT, title: '平均値', timeLimit: { 1: 50, 2: 75, 3: 90 }, generate: genMean });
registerTemplate({ id: 'g1.data.median', unit: UNIT, title: '中央値・最頻値・範囲', timeLimit: { 1: 45, 2: 60, 3: 75 }, generate: genMedian });
registerTemplate({ id: 'g1.data.freq', unit: UNIT, title: '度数分布表と相対度数', timeLimit: { 1: 40, 2: 60, 3: 75 }, generate: genFreq });
registerTemplate({ id: 'g1.data.prob', unit: UNIT, title: '確率(相対度数)', timeLimit: { 1: 50, 2: 60, 3: 60 }, generate: genProb });
