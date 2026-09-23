import { registerTemplate, type Difficulty, type Problem } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat } from '@/math/rational';
import { text } from '@/math/format';

/**
 * 第6章「空間図形」のテンプレート(台本 06_solid_mountain.md の敵に対応)。
 *   g1.solid.prism      角柱ゴーレム     角柱・円柱の体積
 *   g1.solid.pyramid    円錐コウモリ     角錐・円錐の体積(柱の 1/3)
 *   g1.solid.sphere     球のスピリット   球の体積・表面積
 *   g1.solid.surface    面のカメ         表面積
 *   g1.solid.projection 投影図ワシ       投影図・展開図から立体(選択式)
 *   g1.solid.relation   位置関係クモ     直線と平面の位置関係(選択式)
 * π を含む答えは式入力(`36π`)。
 */
const UNIT = '空間図形';

// ---------------------------------------------------------------- 柱の体積

function genPrism(rng: Rng, d: Difficulty): Problem {
  const h = rng.int(3, 12);
  if (d === 1) {
    // 直方体・四角柱
    const a = rng.int(2, 9);
    const b = rng.int(2, 9);
    const v = a * b * h;
    return {
      templateId: 'g1.solid.prism',
      difficulty: d,
      prompt: `${text(`底面が たて ${a}、よこ ${b} の 長方形、高さ ${h} の 四角柱の 体積は?`)}`,
      promptText: `底面がたて ${a}、よこ ${b} の長方形、高さ ${h} の四角柱の体積は?`,
      answer: { kind: 'number', value: rat(v) },
      hint: '柱の 体積 = 底面積 × 高さ',
      explanation: [`${text('底面積: ')} ${a} \\times ${b} = ${a * b}`, `${a * b} \\times ${h} = ${v}`, `${text('答え: ')} ${v}`],
      tags: ['prism_volume'],
      key: `pri1:${a}:${b}:${h}`,
      figure: { kind: 'solid', shape: 'prism4', labels: { base: `${a}`, base2: `${b}`, height: `${h}` } },
      verify: `${a}*${b}*${h}`,
    };
  }
  if (d === 2) {
    // 三角柱
    const base = rng.int(2, 10);
    const height2 = rng.pick([2, 4, 6, 8]);
    const v = (base * height2 * h) / 2;
    return {
      templateId: 'g1.solid.prism',
      difficulty: d,
      prompt: `${text(`底面が 底辺 ${base}、高さ ${height2} の 三角形、柱の 高さ ${h} の 三角柱の 体積は?`)}`,
      promptText: `底面が底辺 ${base}、高さ ${height2} の三角形、柱の高さ ${h} の三角柱の体積は?`,
      answer: { kind: 'number', value: rat(v) },
      hint: '底面積(三角形)を 先に 出そう',
      explanation: [`${text('底面積: ')} ${base} \\times ${height2} \\div 2 = ${(base * height2) / 2}`, `${(base * height2) / 2} \\times ${h} = ${v}`, `${text('答え: ')} ${v}`],
      tags: ['prism_triangle'],
      key: `pri2:${base}:${height2}:${h}`,
      figure: { kind: 'solid', shape: 'prism3', labels: { base: `${base}`, height: `${h}` } },
      verify: `${base}*${height2}*${h}/2`,
    };
  }
  // ★3: 円柱(π を含む)
  const r = rng.int(2, 9);
  const v = r * r * h;
  return {
    templateId: 'g1.solid.prism',
    difficulty: d,
    prompt: `${text(`底面の 半径 ${r}、高さ ${h} の 円柱の 体積は?(π を使って答える)`)}`,
    promptText: `底面の半径 ${r}、高さ ${h} の円柱の体積は?(π を使って答える)`,
    answer: { kind: 'expression', expected: `${v}π` },
    hint: '底面積は πr²。それに 高さを かける',
    explanation: [`${text('底面積: ')} \\pi \\times ${r}^{2} = ${r * r}\\pi`, `${r * r}\\pi \\times ${h} = ${v}\\pi`, `${text('答え: ')} ${v}\\pi`],
    tags: ['cylinder_volume'],
    key: `pri3:${r}:${h}`,
    figure: { kind: 'solid', shape: 'cylinder', labels: { radius: `${r}`, height: `${h}` } },
    verify: `${v}π`,
  };
}

// ---------------------------------------------------------------- 錐の体積

function genPyramid(rng: Rng, d: Difficulty): Problem {
  const h = rng.pick([3, 6, 9, 12]);
  if (d <= 2) {
    const a = rng.int(2, 9);
    const b = d === 1 ? a : rng.int(2, 9);
    const v = (a * b * h) / 3;
    if (!Number.isInteger(v)) return genPyramid(rng, d);
    return {
      templateId: 'g1.solid.pyramid',
      difficulty: d,
      prompt: `${text(`底面が たて ${a}、よこ ${b} の 長方形、高さ ${h} の 四角錐の 体積は?`)}`,
      promptText: `底面がたて ${a}、よこ ${b} の長方形、高さ ${h} の四角錐の体積は?`,
      answer: { kind: 'number', value: rat(v) },
      hint: '錐は 同じ底面・高さの 柱の 3分の1',
      explanation: [`${text('底面積: ')} ${a} \\times ${b} = ${a * b}`, `${a * b} \\times ${h} \\times \\frac{1}{3} = ${v}`, `${text('答え: ')} ${v}`],
      tags: ['pyramid_volume'],
      key: `pyr:${a}:${b}:${h}`,
      figure: { kind: 'solid', shape: 'pyramid4', labels: { base: `${a}`, height: `${h}` } },
      verify: `${a}*${b}*${h}/3`,
    };
  }
  // ★3: 円錐(π)
  const r = rng.int(2, 9);
  const v = (r * r * h) / 3;
  if (!Number.isInteger(v)) return genPyramid(rng, d);
  return {
    templateId: 'g1.solid.pyramid',
    difficulty: d,
    prompt: `${text(`底面の 半径 ${r}、高さ ${h} の 円錐の 体積は?(π を使って答える)`)}`,
    promptText: `底面の半径 ${r}、高さ ${h} の円錐の体積は?(π を使って答える)`,
    answer: { kind: 'expression', expected: `${v}π` },
    hint: '円柱の 3分の1。πr² × 高さ ÷ 3',
    explanation: [`\\pi \\times ${r}^{2} \\times ${h} \\times \\frac{1}{3} = ${v}\\pi`, `${text('答え: ')} ${v}\\pi`],
    tags: ['cone_volume'],
    key: `pyr3:${r}:${h}`,
    figure: { kind: 'solid', shape: 'cone', labels: { radius: `${r}`, height: `${h}` } },
    verify: `${v}π`,
  };
}

// ---------------------------------------------------------------- 球

function genSphere(rng: Rng, d: Difficulty): Problem {
  // 体積(4/3πr³)が整数になるのは r が 3 の倍数のときだけなので、表面積は広く、体積は 3 の倍数から選ぶ
  const askArea = d === 1 ? true : rng.bool();
  const r = askArea ? rng.int(1, 20) : rng.pick([3, 6, 9, 12, 15, 18]);
  if (askArea) {
    const v = 4 * r * r;
    return {
      templateId: 'g1.solid.sphere',
      difficulty: d,
      prompt: `${text(`半径 ${r} の 球の 表面積は?(π を使って答える)`)}`,
      promptText: `半径 ${r} の球の表面積は?(π を使って答える)`,
      answer: { kind: 'expression', expected: `${v}π` },
      hint: '球の 表面積は 4πr²(「心配 ある事情」)',
      explanation: [`4 \\times \\pi \\times ${r}^{2} = ${v}\\pi`, `${text('答え: ')} ${v}\\pi`],
      tags: ['sphere_area'],
      key: `sph:a:${r}`,
      figure: { kind: 'solid', shape: 'sphere', labels: { radius: `${r}` } },
      verify: `${v}π`,
    };
  }
  const v = (4 * r * r * r) / 3;
  if (!Number.isInteger(v)) return genSphere(rng, d);
  return {
    templateId: 'g1.solid.sphere',
    difficulty: d,
    prompt: `${text(`半径 ${r} の 球の 体積は?(π を使って答える)`)}`,
    promptText: `半径 ${r} の球の体積は?(π を使って答える)`,
    answer: { kind: 'expression', expected: `${v}π` },
    hint: '球の 体積は 4/3 πr³(「身の上に 心配 あるので 参上」)',
    explanation: [`\\frac{4}{3} \\times \\pi \\times ${r}^{3} = ${v}\\pi`, `${text('答え: ')} ${v}\\pi`],
    tags: ['sphere_volume'],
    key: `sph:v:${r}`,
    figure: { kind: 'solid', shape: 'sphere', labels: { radius: `${r}` } },
    verify: `${v}π`,
  };
}

// ---------------------------------------------------------------- 表面積

function genSurface(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    // 立方体
    const a = rng.int(2, 20);
    const s = 6 * a * a;
    return {
      templateId: 'g1.solid.surface',
      difficulty: d,
      prompt: `${text(`1辺 ${a} の 立方体の 表面積は?`)}`,
      promptText: `1辺 ${a} の立方体の表面積は?`,
      answer: { kind: 'number', value: rat(s) },
      hint: '同じ 正方形が 6つ',
      explanation: [`${a} \\times ${a} \\times 6 = ${s}`, `${text('答え: ')} ${s}`],
      tags: ['surface_cube'],
      key: `sur1:${a}`,
      figure: { kind: 'solid', shape: 'prism4', labels: { base: `${a}`, base2: `${a}`, height: `${a}` } },
      verify: `6*${a}*${a}`,
    };
  }
  if (d === 2) {
    // 直方体
    const a = rng.int(2, 8);
    const b = rng.int(2, 8);
    const c = rng.int(2, 8);
    const s = 2 * (a * b + b * c + a * c);
    return {
      templateId: 'g1.solid.surface',
      difficulty: d,
      prompt: `${text(`たて ${a}、よこ ${b}、高さ ${c} の 直方体の 表面積は?`)}`,
      promptText: `たて ${a}、よこ ${b}、高さ ${c} の直方体の表面積は?`,
      answer: { kind: 'number', value: rat(s) },
      hint: '向かい合う 面が 3組。それぞれ 2つずつ',
      explanation: [`(${a} \\times ${b} + ${b} \\times ${c} + ${a} \\times ${c}) \\times 2 = ${s}`, `${text('答え: ')} ${s}`],
      tags: ['surface_box'],
      key: `sur2:${a}:${b}:${c}`,
      figure: { kind: 'solid', shape: 'prism4', labels: { base: `${a}`, base2: `${b}`, height: `${c}` } },
      verify: `2*(${a}*${b}+${b}*${c}+${a}*${c})`,
    };
  }
  // ★3: 円柱の表面積(π)
  const r = rng.int(2, 8);
  const h = rng.int(3, 12);
  const s = 2 * r * r + 2 * r * h;
  return {
    templateId: 'g1.solid.surface',
    difficulty: d,
    prompt: `${text(`底面の 半径 ${r}、高さ ${h} の 円柱の 表面積は?(π を使って答える)`)}`,
    promptText: `底面の半径 ${r}、高さ ${h} の円柱の表面積は?(π を使って答える)`,
    answer: { kind: 'expression', expected: `${s}π` },
    hint: '展開図を 思い出そう。底面の 円 2つ + 側面の 長方形(横は 円周)',
    explanation: [
      `${text('底面 2つ: ')} \\pi \\times ${r}^{2} \\times 2 = ${2 * r * r}\\pi`,
      `${text('側面: ')} 2\\pi \\times ${r} \\times ${h} = ${2 * r * h}\\pi`,
      `${text('答え: ')} ${s}\\pi`,
    ],
    tags: ['surface_cylinder'],
    key: `sur3:${r}:${h}`,
    figure: { kind: 'solid', shape: 'cylinder', labels: { radius: `${r}`, height: `${h}` } },
    verify: `${s}π`,
  };
}

// ---------------------------------------------------------------- 投影図

const PROJECTIONS: { top: 'circle' | 'square' | 'triangle'; front: 'rect' | 'triangle' | 'circle'; a: string; w: string[] }[] = [
  { top: 'circle', front: 'rect', a: '円柱', w: ['円錐', '球', '四角柱'] },
  { top: 'circle', front: 'triangle', a: '円錐', w: ['円柱', '三角錐', '球'] },
  { top: 'circle', front: 'circle', a: '球', w: ['円柱', '円錐', '半球'] },
  { top: 'square', front: 'rect', a: '四角柱(直方体)', w: ['四角錐', '三角柱', '円柱'] },
  { top: 'square', front: 'triangle', a: '四角錐', w: ['三角錐', '四角柱', '円錐'] },
  { top: 'triangle', front: 'rect', a: '三角柱', w: ['三角錐', '四角柱', '円柱'] },
  { top: 'triangle', front: 'triangle', a: '三角錐', w: ['三角柱', '四角錐', '円錐'] },
];

const NET_QUESTIONS = [
  { q: '長方形 3枚と 三角形 2枚の 展開図を 組み立てると?', a: '三角柱', w: ['三角錐', '四角柱', '円柱'] },
  { q: '長方形 1枚と 円 2枚の 展開図を 組み立てると?', a: '円柱', w: ['円錐', '球', '四角柱'] },
  { q: 'おうぎ形 1枚と 円 1枚の 展開図を 組み立てると?', a: '円錐', w: ['円柱', '球', '三角錐'] },
  { q: '正方形 6枚の 展開図を 組み立てると?', a: '立方体', w: ['四角錐', '直方体(正方形以外)', '六角柱'] },
  { q: '三角形 4枚の 展開図を 組み立てると?', a: '三角錐', w: ['三角柱', '四角錐', '正八面体'] },
  { q: '円柱の 展開図で、側面の 長方形の 横の長さは?', a: '底面の 円周(2πr)', w: ['底面の 直径', '底面の 面積', '高さ'] },
  { q: '円錐の 展開図で、側面の おうぎ形の 弧の長さは?', a: '底面の 円周', w: ['母線の 長さ', '底面の 半径', '高さ'] },
  { q: '三角柱の 面は 全部で 何枚?', a: '5枚', w: ['4枚', '6枚', '3枚'] },
  { q: '四角錐の 面は 全部で 何枚?', a: '5枚', w: ['4枚', '6枚', '8枚'] },
  { q: '立方体の 辺は 全部で 何本?', a: '12本', w: ['8本', '6本', '16本'] },
  { q: '三角錐の 頂点は 全部で いくつ?', a: '4つ', w: ['3つ', '5つ', '6つ'] },
  { q: '六角柱の 側面は 何枚?', a: '6枚', w: ['4枚', '8枚', '12枚'] },
  { q: '円柱の 展開図で、側面は どんな 形?', a: '長方形', w: ['おうぎ形', '三角形', '円'] },
  { q: '円錐の 展開図で、側面は どんな 形?', a: 'おうぎ形', w: ['長方形', '三角形', '半円(いつも)'] },
  { q: '角柱の 2つの 底面の 関係は?', a: '合同で 平行', w: ['合同だが 垂直', '大きさが ちがう', '重なっている'] },
  { q: '立方体の 展開図に なる 正方形 6枚の 並べ方は 何通り?', a: '11通り', w: ['6通り', '8通り', '24通り'] },
  { q: '角錐の 頂点と 底面の 関係は?', a: '頂点は 底面の 外(上)にある 1点', w: ['頂点は 底面上に ある', '頂点は 2つ ある', '底面と 平行'] },
  { q: '正八面体の 面の 形は?', a: '正三角形', w: ['正方形', '正五角形', '長方形'] },
  { q: '円柱を 底面に 平行な 平面で 切ると、切り口は?', a: '円', w: ['長方形', '楕円', '三角形'] },
];

function genProjection(rng: Rng, d: Difficulty): Problem {
  const useNet = rng.bool();
  if (useNet) {
    const c = rng.pick(NET_QUESTIONS);
    const options = rng.shuffle([c.a, ...c.w]);
    const correct = options.indexOf(c.a);
    return {
      templateId: 'g1.solid.projection',
      difficulty: d,
      prompt: `${text(c.q)}`,
      promptText: c.q,
      answer: { kind: 'choice', options: options.map((o) => text(o)), correct },
      hint: '面の 形と 数を 数えよう',
      explanation: [`${text('答え: ')} ${text(c.a)}`],
      tags: ['net'],
      key: `net:${c.q}`,
      verify: String(correct),
    };
  }
  const c = rng.pick(PROJECTIONS);
  const options = rng.shuffle([c.a, ...c.w]);
  const correct = options.indexOf(c.a);
  return {
    templateId: 'g1.solid.projection',
    difficulty: d,
    prompt: `${text('この 投影図が 表す 立体は?')}`,
    promptText: 'この投影図が表す立体は?',
    answer: { kind: 'choice', options: options.map((o) => text(o)), correct },
    hint: '上から 見た形で 底面が、正面から 見た形で 柱か 錐かが 分かる',
    explanation: [`${text('答え: ')} ${text(c.a)}`],
    tags: ['projection'],
    key: `prj:${c.top}:${c.front}`,
    figure: { kind: 'projection', top: c.top, front: c.front },
    verify: String(correct),
  };
}

// ---------------------------------------------------------------- 位置関係

const RELATIONS = [
  { q: '空間で、交わらず 平行でもない 2直線の 位置関係を 何という?', a: 'ねじれの位置', w: ['平行', '垂直', '交わる'] },
  { q: '直方体で、1つの辺と ねじれの位置にある 辺は 何本?', a: '4本', w: ['2本', '3本', '6本'] },
  { q: '直線 ℓ が 平面 P 上の すべての 直線と 垂直なとき、ℓ と P の 関係は?', a: 'ℓ ⊥ P(垂直)', w: ['ℓ ∥ P(平行)', 'ℓ は P 上にある', '決まらない'] },
  { q: '2つの 平面が 交わると、その 交わりは?', a: '1本の 直線', w: ['1つの 点', '1つの 平面', '交わらない'] },
  { q: '同じ 直線に 垂直な 2つの 平面の 関係は?', a: '平行', w: ['垂直', 'ねじれの位置', '交わる'] },
  { q: '空間で、1直線と 交わらない 直線は?', a: '平行か ねじれの位置', w: ['平行だけ', '垂直だけ', 'ねじれの位置だけ'] },
  { q: '直方体で、底面と 垂直な 辺は 何本?', a: '4本', w: ['2本', '6本', '8本'] },
  { q: '平面を 1つに 決めるのに 必要なのは?', a: '一直線上にない 3点', w: ['どんな 2点でも', '一直線上の 3点', '1点と 1直線(どれでも)'] },
  { q: '円柱を 回転体と 見るとき、何を 回した 立体?', a: '長方形を 1辺を軸に 回した', w: ['三角形を 回した', '円を 回した', '半円を 回した'] },
  { q: '円錐を 回転体と 見るとき、何を 回した 立体?', a: '直角三角形を 1辺を軸に 回した', w: ['長方形を 回した', '半円を 回した', '正方形を 回した'] },
  { q: '球を 回転体と 見るとき、何を 回した 立体?', a: '半円を 直径を軸に 回した', w: ['円を 回した', '長方形を 回した', 'おうぎ形を 回した'] },
  { q: '角柱で、側面の 数と 底面の 辺の 数の 関係は?', a: '同じ', w: ['側面の方が 1つ 多い', '底面の辺の 2倍', '関係ない'] },
  { q: '正四面体の 面の 形は?', a: '正三角形', w: ['正方形', '二等辺三角形', '長方形'] },
  { q: '多面体で、面の 数が 4 のとき 何という?', a: '四面体', w: ['三面体', '五面体', '四角柱'] },
  { q: '正多面体は 全部で 何種類?', a: '5種類', w: ['3種類', '4種類', '6種類'] },
];

function genRelation(rng: Rng, d: Difficulty): Problem {
  const c = rng.pick(RELATIONS);
  const options = rng.shuffle([c.a, ...c.w]);
  const correct = options.indexOf(c.a);
  return {
    templateId: 'g1.solid.relation',
    difficulty: d,
    prompt: `${text(c.q)}`,
    promptText: c.q,
    answer: { kind: 'choice', options: options.map((o) => text(o)), correct },
    hint: '箱(直方体)を 思い浮かべて 指で なぞってみよう',
    explanation: [`${text('答え: ')} ${text(c.a)}`],
    tags: ['relation'],
    key: `rel:${c.q}`,
    verify: String(correct),
  };
}

registerTemplate({ id: 'g1.solid.prism', unit: UNIT, title: '柱の体積', timeLimit: { 1: 45, 2: 55, 3: 65 }, generate: genPrism });
registerTemplate({ id: 'g1.solid.pyramid', unit: UNIT, title: '錐の体積', timeLimit: { 1: 50, 2: 55, 3: 70 }, generate: genPyramid });
registerTemplate({ id: 'g1.solid.sphere', unit: UNIT, title: '球', timeLimit: { 1: 50, 2: 60, 3: 70 }, generate: genSphere });
registerTemplate({ id: 'g1.solid.surface', unit: UNIT, title: '表面積', timeLimit: { 1: 45, 2: 65, 3: 80 }, generate: genSurface });
registerTemplate({ id: 'g1.solid.projection', unit: UNIT, title: '投影図・展開図', timeLimit: { 1: 40, 2: 45, 3: 50 }, generate: genProjection });
registerTemplate({ id: 'g1.solid.relation', unit: UNIT, title: '位置関係', timeLimit: { 1: 40, 2: 45, 3: 50 }, generate: genRelation });
