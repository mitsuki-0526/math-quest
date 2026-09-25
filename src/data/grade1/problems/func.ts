import { registerTemplate, type Difficulty, type Problem } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat, toTex } from '@/math/rational';
import { paren, plainMinus, text } from '@/math/format';

/**
 * 第4章「比例と反比例」のテンプレート(台本 04_waterwheel_lake.md の敵に対応)。
 *   g1.func.prop     比例のヌシ        y=ax の値・式
 *   g1.func.invprop  反比例のアメンボ  y=a/x の値・式
 *   g1.func.coord    座標クラゲ        点の座標(複数値)・点の位置(選択式、図つき)
 *   g1.func.graph    グラフウナギ      グラフから式(選択式、図つき)
 */
const UNIT = '比例と反比例';

const divisors = (n: number): number[] => {
  const out: number[] = [];
  for (let i = 1; i <= Math.abs(n); i++) if (n % i === 0) out.push(i);
  return out;
};

// ---------------------------------------------------------------- 比例

/**
 * 変域(★2・★3 の 3 回に 1 回)。チャレンジテストで毎年出る(正答率 54〜62%)。docs/difficulty.md
 *   ★2: 具体的な場面(水そう・道のり)で、x または y の変域を選ぶ
 *   ★3: y = ax で x の変域から y の変域を選ぶ(a が負なら大小が入れかわる)
 */
function genDomain(rng: Rng, d: Difficulty): Problem {
  const choice = (correct: string, wrongs: string[]) => {
    const uniq = [...new Set(wrongs.filter((w) => w !== correct))].slice(0, 3);
    const options = rng.shuffle([correct, ...uniq]);
    return { options, correct: options.indexOf(correct) };
  };
  if (d === 2) {
    const tank = rng.bool();
    const [total, speed] = tank
      ? rng.pick([[30, 2], [30, 3], [30, 5], [40, 2], [40, 5], [60, 3], [60, 4], [60, 5]])
      : rng.pick([[600, 40], [600, 60], [800, 40], [800, 80], [1200, 60], [1200, 80]]);
    const time = total / speed;
    const story = tank
      ? `深さ ${total} cm の 水そうに、毎分 ${speed} cm ずつ 水を 入れる。入れ始めてから x 分後の 水の 深さを y cm とする`
      : `家から ${total} m 先の 駅まで、分速 ${speed} m で 歩く。歩き始めてから x 分後に 進んだ 道のりを y m とする`;
    const until = tank ? '水そうが いっぱいに なるまで' : '駅に 着くまで';
    const askX = rng.bool();
    const [v, max] = askX ? ['x', time] : ['y', total];
    const other = askX ? total : time;
    const { options, correct } = choice(`0 \\leqq ${v} \\leqq ${max}`, [`0 < ${v} < ${max}`, `0 \\leqq ${v} \\leqq ${other}`, `${v} \\geqq 0`, `0 \\leqq ${v} \\leqq ${speed}`]);
    return {
      templateId: 'g1.func.prop',
      difficulty: d,
      prompt: text(`${story}。${until}の ${v} の 変域は?`),
      promptText: `${story}。${until}の ${v} の 変域は?`,
      answer: { kind: 'choice', options, correct },
      hint: askX ? `いっぱいに なる(着く)のは 何分後? ${total} ÷ ${speed} を 計算しよう` : 'y は 0 から、いっぱい(着いた)ときの 値まで。はしも ふくむ',
      explanation: [askX ? `${total} \\div ${speed} = ${time}` : `${text(`y の 最大は ${total}`)}`, `${text('答え: ')} 0 \\leqq ${v} \\leqq ${max}`],
      tags: ['prop_domain'],
      key: `dom2:${tank}:${total}:${speed}:${v}`,
      verify: String(correct),
    };
  }
  const a = rng.nonZero(5);
  const p = -rng.int(1, 4);
  const q = rng.int(1, 5);
  const [yp, yq] = [a * p, a * q];
  const [lo, hi] = [Math.min(yp, yq), Math.max(yp, yq)];
  const { options, correct } = choice(`${lo} \\leqq y \\leqq ${hi}`, [
    `${yp} \\leqq y \\leqq ${yq}`,
    `${p} \\leqq y \\leqq ${q}`,
    `${lo} < y < ${hi}`,
    `${-hi} \\leqq y \\leqq ${-lo}`,
    `0 \\leqq y \\leqq ${hi}`,
  ]);
  return {
    templateId: 'g1.func.prop',
    difficulty: d,
    prompt: `y = ${a === 1 ? '' : a === -1 ? '-' : a}x \\quad ${text(`x の 変域が`)} ${p} \\leqq x \\leqq ${q} ${text(' のとき、y の 変域は?')}`,
    promptText: `y = ${plainMinus(`${a === 1 ? '' : a === -1 ? '-' : a}x`)} で、x の変域が ${plainMinus(String(p))} ≦ x ≦ ${q} のとき、y の変域は?`,
    answer: { kind: 'choice', options, correct },
    hint: a < 0 ? 'x の はしの 値を 代入しよう。比例定数が 負なので、大小が 入れかわる' : 'x の はしの 値を それぞれ 代入しよう',
    explanation: [`x = ${p} \\to y = ${yp} \\quad x = ${q} \\to y = ${yq}`, `${text('答え: ')} ${lo} \\leqq y \\leqq ${hi}`],
    tags: ['prop_domain'],
    key: `dom3:${a}:${p}:${q}`,
    verify: String(correct),
  };
}

function genProp(rng: Rng, d: Difficulty): Problem {
  if (d > 1 && rng.int(0, 2) === 0) return genDomain(rng, d);
  const a = d === 1 ? rng.int(2, 9) : rng.nonZero(9);
  if (d === 1) {
    const x = rng.int(2, 9);
    return {
      templateId: 'g1.func.prop',
      difficulty: d,
      prompt: `y = ${a}x \\quad ${text(`x = ${x} のときの y は?`)}`,
      promptText: `y = ${a}x で x = ${x} のときの y は?`,
      answer: { kind: 'number', value: rat(a * x) },
      hint: 'x のところに 数を 入れて かけるだけ',
      explanation: [`y = ${a} \\times ${x} = ${a * x}`, `${text('答え: ')} ${a * x}`],
      tags: ['prop_value'],
      key: `prop:${a}:${x}`,
      verify: `${a}*${x}`,
    };
  }
  if (d === 2) {
    // 比例定数を求める → 式で答える
    const x = rng.nonZero(6);
    const y = a * x;
    return {
      templateId: 'g1.func.prop',
      difficulty: d,
      prompt: `${text('y は x に比例し、')} x = ${paren(x)} ${text(' のとき ')} y = ${y} ${text('。y を x の式で表せ')}`,
      promptText: `y は x に比例し、x = ${plainMinus(paren(x))} のとき y = ${plainMinus(String(y))}。y を x の式で表せ`,
      answer: { kind: 'expression', expected: `${a}x` },
      hint: 'y = ax に 分かっている x と y を 入れて、a を 求めよう',
      explanation: [`${y} = a \\times ${paren(x)}`, `a = \\frac{${y}}{${x}} = ${a}`, `${text('答え: ')} y = ${a}x`],
      tags: ['prop_find_a'],
      key: `prop2:${a}:${x}`,
      verify: `${a}x`,
    };
  }
  // ★3: 比例定数が分数 or x を求める
  if (rng.bool()) {
    const y = a * rng.int(2, 6);
    const x = y / a;
    return {
      templateId: 'g1.func.prop',
      difficulty: d,
      prompt: `y = ${a}x \\quad ${text(`y = ${y} のときの x は?`)}`,
      promptText: `y = ${a}x で y = ${plainMinus(String(y))} のときの x は?`,
      answer: { kind: 'number', value: rat(x) },
      hint: 'y が 分かっているので、両辺を 比例定数で 割ろう',
      explanation: [`${y} = ${a}x`, `x = \\frac{${y}}{${a}} = ${x}`, `${text('答え: ')} ${x}`],
      tags: ['prop_find_x'],
      key: `prop3x:${a}:${y}`,
      verify: `${y}/${a}`,
    };
  }
  const den = rng.pick([2, 3, 4]);
  const num = rng.nonZero(5);
  const x = den * rng.int(1, 4);
  const y = (num * x) / den;
  return {
    templateId: 'g1.func.prop',
    difficulty: d,
    prompt: `y = \\frac{${num}}{${den}}x \\quad ${text(`x = ${x} のときの y は?`)}`,
    promptText: `y = ${num}/${den}x で x = ${x} のときの y は?`,
    answer: { kind: 'number', value: rat(y) },
    hint: '分数を かけるときは 約分してから',
    explanation: [`y = \\frac{${num}}{${den}} \\times ${x} = ${y}`, `${text('答え: ')} ${y}`],
    tags: ['prop_fraction'],
    key: `prop3f:${num}/${den}:${x}`,
    verify: `${num}*${x}/${den}`,
  };
}

// ---------------------------------------------------------------- 反比例

function genInvProp(rng: Rng, d: Difficulty): Problem {
  const base = rng.pick([12, 18, 24, 36, 48]);
  const a = d === 1 ? base : rng.bool() ? base : -base;
  const ds = divisors(base).filter((v) => v > 1 && v < base);
  const x = rng.pick(ds.length ? ds : [2]);
  if (d === 1) {
    return {
      templateId: 'g1.func.invprop',
      difficulty: d,
      prompt: `y = \\frac{${a}}{x} \\quad ${text(`x = ${x} のときの y は?`)}`,
      promptText: `y = ${a}/x で x = ${x} のときの y は?`,
      answer: { kind: 'number', value: rat(a, x) },
      hint: 'x で 割るだけ。x × y は いつも 同じ数になる',
      explanation: [`y = \\frac{${a}}{${x}} = ${toTex(rat(a, x))}`, `${text('答え: ')} ${toTex(rat(a, x))}`],
      tags: ['invprop_value'],
      key: `inv:${a}:${x}`,
      verify: `${a}/${x}`,
    };
  }
  if (d === 2) {
    const y = a / x;
    return {
      templateId: 'g1.func.invprop',
      difficulty: d,
      prompt: `${text('y は x に反比例し、')} x = ${x} ${text(' のとき ')} y = ${paren(y)} ${text('。y を x の式で表せ')}`,
      promptText: `y は x に反比例し、x = ${x} のとき y = ${plainMinus(String(y))}。y を x の式で表せ`,
      // 反比例は分数式なので選択式で答える
      answer: {
        kind: 'choice',
        options: [`y = \\frac{${a}}{x}`, `y = ${a}x`, `y = \\frac{x}{${a}}`, `y = ${a} - x`],
        correct: 0,
      },
      hint: 'y = a/x に 入れて a を 求めよう。a = x × y',
      explanation: [`a = x \\times y = ${x} \\times ${paren(y)} = ${a}`, `${text('答え: ')} y = \\frac{${a}}{x}`],
      tags: ['invprop_find_a'],
      key: `inv2:${a}:${x}`,
      verify: '0',
    };
  }
  // ★3: x を求める / 表の穴埋め
  const y = rng.pick(ds.length ? ds : [2]);
  const xx = a / y;
  return {
    templateId: 'g1.func.invprop',
    difficulty: d,
    prompt: `y = \\frac{${a}}{x} \\quad ${text(`y = ${y} のときの x は?`)}`,
    promptText: `y = ${a}/x で y = ${y} のときの x は?`,
    answer: { kind: 'number', value: rat(xx) },
    hint: 'x × y = a。y が 分かっているので a を y で 割ろう',
    explanation: [`x \\times ${y} = ${a}`, `x = \\frac{${a}}{${y}} = ${toTex(rat(xx))}`, `${text('答え: ')} ${toTex(rat(xx))}`],
    tags: ['invprop_find_x'],
    key: `inv3:${a}:${y}`,
    verify: `${a}/${y}`,
  };
}

// ---------------------------------------------------------------- 座標

function genCoord(rng: Rng, d: Difficulty): Problem {
  const range = 6;
  const x = d === 1 ? rng.int(1, range) : rng.nonZero(range);
  const y = d === 1 ? rng.int(1, range) : rng.nonZero(range);
  if (d <= 2) {
    // 図の点の座標を答える(複数値)
    return {
      templateId: 'g1.func.coord',
      difficulty: d,
      prompt: `${text('点 A の座標を 答えよ(x座標, y座標 の順に「,」で区切る)')}`,
      promptText: '点 A の座標を答えよ(x座標, y座標 の順に「,」で区切る)',
      answer: { kind: 'numbers', values: [rat(x), rat(y)], ordered: true },
      hint: '横(x)が 先、縦(y)が 後。左と 下は マイナス',
      explanation: [`${text(`原点から 横に ${x < 0 ? `左へ ${-x}` : `右へ ${x}`}、縦に ${y < 0 ? `下へ ${-y}` : `上へ ${y}`}`)}`, `${text('答え: ')} (${x}, ${y})`],
      tags: ['coord_read'],
      key: `coord:${x}:${y}`,
      figure: { kind: 'plane', range, points: [{ x, y, label: 'A' }], guides: [{ x, y }] },
      verify: `[${x},${y}]`,
    };
  }
  // ★3: 対称な点(選択式)
  const kind = rng.pick(['x', 'y', 'o'] as const);
  const label = { x: 'x軸', y: 'y軸', o: '原点' }[kind];
  const ans = kind === 'x' ? [x, -y] : kind === 'y' ? [-x, y] : [-x, -y];
  const opts = [
    [x, -y],
    [-x, y],
    [-x, -y],
    [y, x],
  ];
  // x = y や x = −y のとき選択肢が同じ座標になるので、重複があれば作り直す
  if (new Set(opts.map((o) => o.join(','))).size !== opts.length) return genCoord(rng, d);
  const shuffled = rng.shuffle(opts);
  const correct = shuffled.findIndex((o) => o[0] === ans[0] && o[1] === ans[1]);
  if (correct < 0) return genCoord(rng, d);
  return {
    templateId: 'g1.func.coord',
    difficulty: d,
    prompt: `${text(`点 A (${x}, ${y}) と ${label} について 対称な点の座標は?`)}`,
    promptText: `点 A (${plainMinus(String(x))}, ${plainMinus(String(y))}) と ${label} について対称な点の座標は?`,
    answer: { kind: 'choice', options: shuffled.map(([a, b]) => `(${a < 0 ? `−${-a}` : a},\\ ${b < 0 ? `−${-b}` : b})`), correct },
    hint: kind === 'x' ? 'x軸で 折り返すと y の符号だけ 変わる' : kind === 'y' ? 'y軸で 折り返すと x の符号だけ 変わる' : '原点について 対称なら x も y も 符号が 変わる',
    explanation: [`${text(`${label} について 対称 → `)} (${ans[0]}, ${ans[1]})`],
    tags: ['coord_symmetry'],
    key: `coord3:${x}:${y}:${kind}`,
    figure: { kind: 'plane', range, points: [{ x, y, label: 'A' }] },
    verify: String(correct),
  };
}

// ---------------------------------------------------------------- グラフから式

function genGraph(rng: Rng, d: Difficulty): Problem {
  const isProp = d === 1 ? true : rng.bool();
  if (isProp) {
    const a = rng.pick([1, 2, 3, 4, 5, -1, -2, -3, -4].filter((v) => d > 1 || v > 0));
    const px = rng.int(1, 3);
    const options = rng.shuffle([`y = ${a}x`, `y = ${-a}x`, `y = \\frac{${a}}{x}`, `y = x ${a < 0 ? '-' : '+'} ${Math.abs(a)}`]);
    const correct = options.indexOf(`y = ${a}x`);
    return {
      templateId: 'g1.func.graph',
      difficulty: d,
      prompt: `${text('このグラフを 表す式は?')}`,
      promptText: 'このグラフを表す式は?',
      answer: { kind: 'choice', options, correct },
      hint: '原点を 通る 直線は 比例。通っている 点を ひとつ 読んで y = ax に 入れよう',
      explanation: [`${text(`点 (${px}, ${a * px}) を 通る`)}`, `${a * px} = a \\times ${px} \\Rightarrow a = ${a}`, `${text('答え: ')} y = ${a}x`],
      tags: ['graph_prop'],
      key: `graph:p:${a}:${px}`,
      figure: { kind: 'plane', range: 6, graphs: [{ type: 'prop', a }], points: [{ x: px, y: a * px, label: '' }] },
      verify: String(correct),
    };
  }
  const a = rng.pick([4, 6, 8, 12, 18, -4, -6, -8, -12, -18]);
  const options = rng.shuffle([`y = \\frac{${a}}{x}`, `y = ${a}x`, `y = \\frac{${-a}}{x}`, `y = \\frac{x}{${a}}`]);
  const correct = options.indexOf(`y = \\frac{${a}}{x}`);
  return {
    templateId: 'g1.func.graph',
    difficulty: d,
    prompt: `${text('このグラフを 表す式は?')}`,
    promptText: 'このグラフを表す式は?',
    answer: { kind: 'choice', options, correct },
    hint: '軸に 近づいていく 曲線は 反比例。通っている 点の x × y が a',
    explanation: [`${text('通る点の x と y をかけると ')} ${a}`, `${text('答え: ')} y = \\frac{${a}}{x}`],
    tags: ['graph_invprop'],
    key: `graph:i:${a}`,
    figure: { kind: 'plane', range: 6, graphs: [{ type: 'invprop', a }] },
    verify: String(correct),
  };
}

registerTemplate({ id: 'g1.func.prop', unit: UNIT, title: '比例', timeLimit: { 1: 30, 2: 50, 3: 55 }, generate: genProp });
registerTemplate({ id: 'g1.func.invprop', unit: UNIT, title: '反比例', timeLimit: { 1: 35, 2: 50, 3: 55 }, generate: genInvProp });
registerTemplate({ id: 'g1.func.coord', unit: UNIT, title: '座標', timeLimit: { 1: 35, 2: 40, 3: 50 }, generate: genCoord });
registerTemplate({ id: 'g1.func.graph', unit: UNIT, title: 'グラフから式', timeLimit: { 1: 45, 2: 55, 3: 60 }, generate: genGraph });
