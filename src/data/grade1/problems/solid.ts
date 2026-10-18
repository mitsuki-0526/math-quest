import { registerTemplate, mistakeNum, type Difficulty, type Mistake, type Problem } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat, mul, add, type Rational, isInteger, toTex } from '@/math/rational';
import { text } from '@/math/format';
import type { FigureSpec, SolidSpec } from '@/math/figure';
import { choose, piExpr, piTex, mistakePi, type Wrong } from './choice';
import { drawConvex, netDiagram, prismPts, pyramidPts, regularPts, rotationDiagram, solidDiagram, type NetAsk, type NetKind } from './solidFigures';

/**
 * 第6章「空間図形」のテンプレート(台本 06_solid_mountain.md の敵に対応)。
 *   g1.solid.prism      角柱ゴーレム     角柱・円柱の体積(V = Sh)
 *   g1.solid.pyramid    円錐コウモリ     角錐・円錐の体積(V = ⅓Sh)
 *   g1.solid.sphere     球のスピリット   球・半球の体積と表面積
 *   g1.solid.surface    面のカメ         表面積(角柱・円柱・正四角錐・円錐)
 *   g1.solid.projection 投影図ワシ       投影図・展開図・回転体
 *   g1.solid.relation   位置関係クモ     多面体・正多面体、直線や平面の位置関係(直方体・三角柱の図)
 *
 * 教科書 6 章の 本文(2026-10-16。refs/prints/6章_honbun-features.md)に 合わせた。
 * 球は 半径 2〜4・10(体積が 分数の π も 例題)、円錐の 側面積は 展開図の おうぎ形(中心角 = 360° × 底面の半径 ÷ 母線)。
 * π を含む答えは式入力(`36π`・`32/3π`)
 */
const UNIT = '空間図形';

const third = (v: Rational): Rational => mul(v, rat(1, 3));

/** π の 答えの 問題 */
function piProblem(
  id: string,
  d: Difficulty,
  p: Pick<Problem, 'hint' | 'explanation' | 'tags' | 'key' | 'figure' | 'mistakes' | 'verify'> & { q: string; v: Rational; unit?: string },
): Problem {
  return {
    templateId: id,
    difficulty: d,
    prompt: text(`${p.q}(π を 使って 答える)`),
    promptText: `${p.q}(π を使って答える)`,
    answer: { kind: 'expression', expected: piExpr(p.v) },
    layout: 'prose',
    hint: p.hint,
    explanation: p.explanation,
    tags: p.tags,
    key: p.key,
    figure: p.figure,
    mistakes: p.mistakes,
    verify: p.verify,
    answerUnit: p.unit,
  };
}

function numProblem(
  id: string,
  d: Difficulty,
  p: Pick<Problem, 'hint' | 'explanation' | 'tags' | 'key' | 'figure' | 'mistakes' | 'verify'> & { q: string; v: Rational | number; unit?: string },
): Problem {
  return {
    templateId: id,
    difficulty: d,
    prompt: text(p.q),
    promptText: p.q,
    answer: { kind: 'number', value: typeof p.v === 'number' ? rat(p.v) : p.v },
    layout: 'prose',
    hint: p.hint,
    explanation: p.explanation,
    tags: p.tags,
    key: p.key,
    figure: p.figure,
    mistakes: p.mistakes,
    verify: p.verify,
    answerUnit: p.unit,
  };
}

// ---------------------------------------------------------------- 図(先生の 判定 2026-10-18「図を 提示して ください」)

/** 見取図の 向き(斜め 上から)。辺が 重なって 見えない 角度に してある */
const VIEW = { yaw: 18, pitch: 24 };

/** 立方体の 角を 切り取った 三角錐(切り口の 三角形と 三角錐の 辺を 赤く) */
function cubeCutFigure(edge: string): FigureSpec {
  const pts: [number, number, number][] = [0, 1].flatMap((x) => [0, 1].flatMap((y) => [0, 1].map((z) => [x, y, z] as [number, number, number])));
  const d = drawConvex(pts, VIEW);
  // 手前 右の 上の 頂点(1, 0, 1)を 切り取る(3 本の 辺が どれも 見える 角)
  const c = pts.findIndex((q) => q[0] === 1 && q[1] === 0 && q[2] === 1);
  const nb = pts.map((_, i) => i).filter((i) => pts[i].filter((v, k) => v !== pts[c][k]).length === 1);
  const tri = nb.map((i) => d.at[i]);
  d.items.push({ t: 'poly', pts: tri, tone: 'ask', fill: true });
  for (const i of nb) d.items.push({ t: 'seg', a: d.at[c], b: d.at[i], tone: 'ask' });
  // 1 辺の 長さは 手前の 下の 辺に 書く
  const bottom = d.frontEdges.find(([a, b]) => pts[a][2] === 0 && pts[b][2] === 0)!;
  const [p, q] = [d.at[bottom[0]], d.at[bottom[1]]];
  d.items.push({ t: 'text', p: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 0.2], s: edge });
  const spec = solidDiagram(d, '立方体から 切り取った 三角錐');
  spec.view = [spec.view[0], spec.view[1] - 0.2, spec.view[2], spec.view[3] + 0.2];
  return spec;
}

/** 正多面体の 見取図(正四面体は 真上に 近いと 平らな 三角形に 見えるので 向きを 変える) */
function regularFigure(name: string): FigureSpec {
  return solidDiagram(drawConvex(regularPts(name), name.startsWith('正四面体') ? { yaw: 30, pitch: 22 } : { yaw: 20, pitch: 18 }), name);
}

/** n 角柱・n 角錐の 見取図 */
function polyFigure(kind: 'prism' | 'pyramid', n: number): FigureSpec {
  return solidDiagram(drawConvex(kind === 'prism' ? prismPts(n) : pyramidPts(n), VIEW), `${n} 角${kind === 'prism' ? '柱' : '錐'}`);
}

/** 正 n 角柱で、問う 辺(側面の 辺 か 上の 底面の 辺)を 赤く */
function prismAskFigure(n: number, ofBase: boolean): FigureSpec {
  const pts = prismPts(n);
  const first = drawConvex(pts, VIEW);
  const e = first.frontEdges.find(([a, b]) => (ofBase ? a >= n && b >= n : Math.abs(a - b) === n))!;
  return solidDiagram(drawConvex(pts, { ...VIEW, ask: [e] }), `正${n}角柱`);
}

// ---------------------------------------------------------------- 柱の体積

function genPrism(rng: Rng, d: Difficulty): Problem {
  const ID = 'g1.solid.prism';
  const kind = d === 1 ? rng.pick(['box', 'box', 'tri'] as const) : d === 2 ? rng.pick(['tri', 'cyl', 'cyl'] as const) : rng.pick(['cyl_d', 'rot', 'tri'] as const);
  if (kind === 'box') {
    const a = rng.int(2, 8);
    const b = rng.int(2, 8);
    const h = rng.int(3, 10);
    const v = a * b * h;
    return numProblem(ID, d, {
      q: `底面が 縦 ${a} cm、横 ${b} cm の 長方形で、高さが ${h} cm の 四角柱の 体積は?(cm³)`,
      v,
      unit: 'cm³',
      hint: '角柱の 体積 = 底面積 × 高さ',
      explanation: [text('(角柱の 体積)=(底面積)×(高さ)'), `${text('底面積: ')} ${a} \\times ${b} = ${a * b}`, `${a * b} \\times ${h} = ${v}`, `${text('答え: ')} ${v} ${text('cm³')}`],
      tags: ['prism_volume'],
      key: `pri:box:${a}:${b}:${h}`,
      figure: { kind: 'solid', shape: 'prism4', labels: { base: `${a} cm`, base2: `${b} cm`, height: `${h} cm` } },
      mistakes: [mistakeNum(a * b, '底面積に 高さを かけよう'), mistakeNum(2 * (a * b + b * h + a * h), 'それは 表面積。体積は 底面積 × 高さ')],
      verify: `${a}*${b}*${h}`,
    });
  }
  if (kind === 'tri') {
    // 底面は 直角三角形(テントの 三角柱・章の問題)
    const p = rng.int(3, d === 3 ? 12 : 8);
    const q = rng.pick([2, 4, 6, 8]);
    const h = rng.int(3, d === 3 ? 15 : 10);
    const S = (p * q) / 2;
    const v = S * h;
    return numProblem(ID, d, {
      q: `底面が、直角を はさむ 2 辺が ${p} cm と ${q} cm の 直角三角形で、高さが ${h} cm の 三角柱の 体積は?(cm³)`,
      v,
      unit: 'cm³',
      hint: 'まず 底面の 三角形の 面積(÷ 2 を 忘れずに)',
      explanation: [text('(角柱の 体積)=(底面積)×(高さ)'), `${text('底面積: ')} ${p} \\times ${q} \\div 2 = ${S}`, `${S} \\times ${h} = ${v}`, `${text('答え: ')} ${v} ${text('cm³')}`],
      tags: ['prism_triangle'],
      key: `pri:tri:${p}:${q}:${h}`,
      figure: { kind: 'solid', shape: 'prism3', labels: { base: `${p} cm`, height: `${h} cm` } },
      mistakes: [mistakeNum(p * q * h, '三角形の 面積は 底辺 × 高さ ÷ 2。÷ 2 を 忘れずに'), mistakeNum(S, '底面積に 高さを かけよう')],
      verify: `${p}*${q}/2*${h}`,
    });
  }
  // 円柱
  const r = rng.int(2, d === 2 ? 6 : 8);
  const h = rng.int(3, 10);
  const v = rat(r * r * h);
  const byD = kind === 'cyl_d';
  const rot = kind === 'rot';
  const q = rot
    ? `縦 ${h} cm、横 ${r} cm の 長方形を、縦の 辺を 軸として 1 回転させて できる 立体の 体積は?`
    : byD
      ? `底面の 直径が ${2 * r} cm、高さが ${h} cm の 円柱の 体積は?`
      : `底面の 半径が ${r} cm、高さが ${h} cm の 円柱の 体積は?`;
  return piProblem(ID, d, {
    q,
    v,
    unit: 'cm³',
    hint: rot ? '長方形を 回すと 円柱。横の 辺が 底面の 半径、縦の 辺が 高さ' : byD ? 'まず 半径(直径の 半分)。底面積は πr²' : '底面積は πr²。それに 高さを かける',
    explanation: [
      ...(rot ? [text(`できる 立体は 底面の 半径 ${r} cm、高さ ${h} cm の 円柱`)] : []),
      ...(byD ? [text(`半径は ${2 * r} ÷ 2 = ${r}`)] : []),
      text('(円柱の 体積)=(底面積)×(高さ)'),
      `${text('底面積: ')} \\pi \\times ${r}^{2} = ${r * r}\\pi`,
      `${r * r}\\pi \\times ${h} = ${piTex(v)}`,
      `${text('答え: ')} ${piTex(v)} ${text('cm³')}`,
    ],
    tags: [rot ? 'cylinder_rotate' : 'cylinder_volume'],
    key: `pri:${kind}:${r}:${h}`,
    // 回転体は 回す 前の 長方形と 軸(先生の 判定 2026-10-18「軸と 回転前の 図を ください」)
    figure: rot ? rotationDiagram('rect', h, r, `${h} cm`, `${r} cm`) : { kind: 'solid', shape: 'cylinder', labels: { radius: byD ? undefined : `${r} cm`, height: `${h} cm` } },
    mistakes: [
      mistakePi(rat(2 * r * h), '2πr は 円周。底面積は πr²'),
      mistakePi(rat(r * r), '底面積に 高さを かけよう'),
      ...(byD || rot ? [mistakePi(rat(4 * r * r * h), byD ? '直径の 半分が 半径だよ' : '横の 辺が 半径。直径では ないよ')] : [mistakePi(rat(4 * r * r * h), '半径を 2 倍に しないで、そのまま 2 乗しよう')]),
      mistakePi(third(rat(r * r * h)), '円柱は ⅓ を かけないよ(⅓ は 円錐)'),
    ],
    verify: `${r}*${r}*${h}π`,
  });
}

// ---------------------------------------------------------------- 錐の体積

function genPyramid(rng: Rng, d: Difficulty): Problem {
  const ID = 'g1.solid.pyramid';
  const kind = d === 1 ? 'square' : d === 2 ? rng.pick(['rect', 'cone', 'cone'] as const) : rng.pick(['cone3', 'cut', 'rot', 'square3'] as const);
  if (kind === 'square' || kind === 'rect' || kind === 'square3') {
    const a = rng.int(2, kind === 'square3' ? 10 : 9);
    const b = kind === 'rect' ? rng.int(2, 9) : a;
    const h = kind === 'square3' ? rng.int(2, 10) : rng.pick([3, 6, 9, 12]);
    const S = a * b;
    const v = third(rat(S * h));
    if (kind !== 'square3' && !isInteger(v)) return genPyramid(rng, d);
    const shape = kind === 'rect' ? `縦 ${a} cm、横 ${b} cm の 長方形` : `1 辺 ${a} cm の 正方形`;
    return numProblem(ID, d, {
      q: `底面が ${shape}で、高さが ${h} cm の ${kind === 'rect' ? '四角錐' : '正四角錐'}の 体積は?(cm³)`,
      v,
      unit: 'cm³',
      hint: '錐の 体積は、底面積と 高さが 同じ 柱の ⅓',
      explanation: [text('(角錐の 体積)= ⅓ ×(底面積)×(高さ)'), `${text('底面積: ')} ${a} \\times ${b} = ${S}`, `\\frac{1}{3} \\times ${S} \\times ${h} = ${toTex(v)}`, `${text('答え: ')} ${toTex(v)} ${text('cm³')}`],
      tags: ['pyramid_volume'],
      key: `pyr:${kind}:${a}:${b}:${h}`,
      figure: { kind: 'solid', shape: 'pyramid4', labels: { base: `${a} cm`, height: `${h} cm` } },
      mistakes: [mistakeNum(S * h, '錐は 柱の ⅓。3 で わるのを 忘れずに'), mistakeNum(rat(S * h, 2), '⅓ だよ(½ では ない)'), mistakeNum(third(rat(S)), '底面積 × 高さ × ⅓。高さを かけ忘れて いないかな')],
      verify: `${a}*${b}*${h}/3`,
    });
  }
  if (kind === 'cut') {
    // 1 辺 a の 立方体の 角を 切り取った 三角錐(底面は 直角二等辺三角形、高さ a)
    const a = rng.pick([6, 12]);
    const v = (a * a * a) / 6;
    return numProblem(ID, d, {
      q: `1 辺 ${a} cm の 立方体から、1 つの 頂点に 集まる 3 本の 辺の はしを 結んで 三角錐を 切り取った。この 三角錐の 体積は?(cm³)`,
      v,
      unit: 'cm³',
      hint: '底面は 直角を はさむ 2 辺が それぞれ 1 辺の 長さの 三角形。高さも 1 辺の 長さ',
      explanation: [`${text('底面積: ')} ${a} \\times ${a} \\div 2 = ${(a * a) / 2}`, `\\frac{1}{3} \\times ${(a * a) / 2} \\times ${a} = ${v}`, `${text('答え: ')} ${v} ${text('cm³')}`],
      tags: ['pyramid_cut'],
      key: `pyr:cut:${a}`,
      figure: cubeCutFigure(`${a} cm`),
      mistakes: [mistakeNum(a ** 3 / 3, '底面の 三角形は ÷ 2 を 忘れずに'), mistakeNum(a ** 3 / 2, '錐だから ⅓ を かけよう'), mistakeNum(a ** 3, 'それは 立方体 全体の 体積')],
      verify: `${a}*${a}/2*${a}/3`,
    });
  }
  // 円錐
  const r = rng.int(2, kind === 'cone' ? 6 : 9);
  const h = kind === 'cone' ? rng.pick([3, 6, 9, 12]) : rng.int(2, 12);
  const v = third(rat(r * r * h));
  if (kind === 'cone' && !isInteger(v)) return genPyramid(rng, d);
  const rot = kind === 'rot';
  const q = rot
    ? `直角を はさむ 2 辺が ${h} cm と ${r} cm の 直角三角形を、${h} cm の 辺を 軸として 1 回転させて できる 立体の 体積は?`
    : `底面の 半径が ${r} cm、高さが ${h} cm の 円錐の 体積は?`;
  return piProblem(ID, d, {
    q,
    v,
    unit: 'cm³',
    hint: rot ? '直角三角形を 回すと 円錐。軸の 辺が 高さ、もう 1 つの 辺が 底面の 半径' : '円錐の 体積 = ⅓ × πr² × 高さ',
    explanation: [
      ...(rot ? [text(`できる 立体は 底面の 半径 ${r} cm、高さ ${h} cm の 円錐`)] : []),
      text('(円錐の 体積)= ⅓ ×(底面積)×(高さ)'),
      `\\frac{1}{3} \\times \\pi \\times ${r}^{2} \\times ${h} = ${piTex(v)}`,
      `${text('答え: ')} ${piTex(v)} ${text('cm³')}`,
    ],
    tags: [rot ? 'cone_rotate' : 'cone_volume'],
    key: `pyr:${kind}:${r}:${h}`,
    figure: rot ? rotationDiagram('tri', h, r, `${h} cm`, `${r} cm`) : { kind: 'solid', shape: 'cone', labels: { radius: `${r} cm`, height: `${h} cm` } },
    mistakes: [
      mistakePi(rat(r * r * h), '円錐は 円柱の ⅓。3 で わろう'),
      mistakePi(third(rat(2 * r * h)), '2πr は 円周。底面積は πr²'),
      ...(rot ? [mistakePi(third(rat(h * h * r)), '軸の 辺が 高さ、もう 1 つの 辺が 半径だよ')] : []),
    ],
    verify: `(${r}*${r}*${h}/3)π`,
  });
}

// ---------------------------------------------------------------- 球

function genSphere(rng: Rng, d: Difficulty): Problem {
  const ID = 'g1.solid.sphere';
  // 教科書: 例 半径 2(32/3π・16π)、問 半径 4・3、章の問題 半径 10。四分円を 回した 半球
  const kind = d === 1 ? rng.pick(['area', 'area', 'vol3'] as const) : d === 2 ? rng.pick(['area', 'vol', 'vol'] as const) : rng.pick(['vol', 'hemiV', 'hemiS', 'area'] as const);
  const r =
    kind === 'vol3'
      ? rng.pick([3, 6])
      : kind === 'area'
        ? rng.int(1, d === 1 ? 6 : 10)
        : kind === 'vol'
          ? rng.pick(d === 2 ? [2, 3, 4, 5, 6] : [2, 4, 5, 7, 8, 10])
          : rng.pick([2, 3, 4, 6]);
  // 半分は「直径」で 出して、半径を 求める 一手間を 入れる(★1 から)
  const byD = kind !== 'hemiV' && kind !== 'hemiS' && rng.bool();
  const given = byD ? `直径 ${2 * r} cm` : `半径 ${r} cm`;
  // 直径で 出す ときも 半径を 書く(先生の 判定 2026-10-18「半径も 書いてください」)
  const figure: SolidSpec = { kind: 'solid', shape: 'sphere', labels: byD ? { diameter: `${2 * r} cm`, radius: `${r} cm` } : { radius: `${r} cm` } };
  const radiusStep = byD ? [text(`半径は ${2 * r} ÷ 2 = ${r}`)] : [];
  const dMistake = (v: Rational): Mistake[] => (byD ? [mistakePi(v, '直径の 半分が 半径だよ')] : []);
  if (kind === 'area') {
    const v = rat(4 * r * r);
    return piProblem(ID, d, {
      q: `${given} の 球の 表面積は?`,
      v,
      unit: 'cm²',
      hint: byD ? 'まず 半径(直径の 半分)。球の 表面積は 4πr²' : '球の 表面積は 4πr²(「心配 ある事情」)',
      explanation: [...radiusStep, text('(球の 表面積)= 4πr²'), `4 \\times \\pi \\times ${r}^{2} = ${piTex(v)}`, `${text('答え: ')} ${piTex(v)} ${text('cm²')}`],
      tags: ['sphere_area'],
      key: `sph:a:${given}`,
      figure,
      mistakes: [mistakePi(rat(r * r), '球の 表面積は 円の 面積の 4 倍(4πr²)'), mistakePi(rat(4 * r), 'r は 2 乗しよう(r × r)'), mistakePi(rat(2 * r * r), '4 倍だよ'), ...dMistake(rat(16 * r * r))],
      verify: `4*${r}*${r}π`,
    });
  }
  if (kind === 'vol' || kind === 'vol3') {
    const v = mul(rat(4 * r ** 3), rat(1, 3));
    return piProblem(ID, d, {
      q: `${given} の 球の 体積は?`,
      v,
      unit: 'cm³',
      hint: byD ? 'まず 半径(直径の 半分)。球の 体積は ⁴⁄₃πr³' : '球の 体積は ⁴⁄₃πr³(「身の上に 心配 あるので 参上」)',
      explanation: [
        ...radiusStep,
        text('(球の 体積)= ⁴⁄₃πr³'),
        `\\frac{4}{3} \\times \\pi \\times ${r}^{3} = \\frac{4}{3} \\pi \\times ${r ** 3} = ${piTex(v)}`,
        `${text('答え: ')} ${piTex(v)} ${text('cm³')}`,
      ],
      tags: ['sphere_volume'],
      key: `sph:v:${given}`,
      figure,
      mistakes: [
        mistakePi(rat(r ** 3), '⁴⁄₃ を かけ忘れて いないかな'),
        mistakePi(mul(rat(4 * r * r), rat(1, 3)), '体積は r を 3 乗(r × r × r)'),
        mistakePi(rat(4 * r * r), 'それは 表面積。体積は ⁴⁄₃πr³'),
        ...dMistake(mul(rat(4 * (2 * r) ** 3), rat(1, 3))),
      ],
      verify: `(4*${r}*${r}*${r}/3)π`,
    });
  }
  // 半球(四分円を 半径を 軸に 回す)
  if (kind === 'hemiV') {
    const v = mul(rat(2 * r ** 3), rat(1, 3));
    return piProblem(ID, d, {
      q: `半径 ${r} cm の 半球の 体積は?`,
      v,
      unit: 'cm³',
      hint: '球の 体積 ⁴⁄₃πr³ の 半分',
      explanation: [`\\frac{4}{3} \\pi \\times ${r}^{3} \\div 2 = ${piTex(v)}`, `${text('答え: ')} ${piTex(v)} ${text('cm³')}`],
      tags: ['hemisphere_volume'],
      key: `sph:hv:${r}`,
      figure,
      mistakes: [mistakePi(mul(rat(4 * r ** 3), rat(1, 3)), 'それは 球 全体。半球は その 半分'), mistakePi(rat(2 * r * r), 'それは 曲面の 面積。体積は ⁴⁄₃πr³ の 半分')],
      verify: `(2*${r}*${r}*${r}/3)π`,
    });
  }
  const v = rat(3 * r * r);
  return piProblem(ID, d, {
    q: `半径 ${r} cm の 半球の 表面積は?(平らな 面も ふくむ)`,
    v,
    unit: 'cm²',
    hint: '曲面は 球の 表面積の 半分(2πr²)。平らな 面は 円(πr²)',
    explanation: [`${text('曲面: ')} 4\\pi \\times ${r}^{2} \\div 2 = ${2 * r * r}\\pi`, `${text('平らな 面: ')} \\pi \\times ${r}^{2} = ${r * r}\\pi`, `${2 * r * r}\\pi + ${r * r}\\pi = ${piTex(v)}`, `${text('答え: ')} ${piTex(v)} ${text('cm²')}`],
    tags: ['hemisphere_area'],
    key: `sph:hs:${r}`,
    figure,
    mistakes: [mistakePi(rat(2 * r * r), '平らな 面(円 πr²)も たそう'), mistakePi(rat(4 * r * r), 'それは 球 全体の 表面積'), mistakePi(rat(5 * r * r), '曲面は 球の 半分(2πr²)だよ')],
    verify: `3*${r}*${r}π`,
  });
}

// ---------------------------------------------------------------- 表面積

function genSurface(rng: Rng, d: Difficulty): Problem {
  const ID = 'g1.solid.surface';
  const kind = d === 1 ? rng.pick(['cube', 'box', 'cylSide'] as const) : d === 2 ? rng.pick(['cyl', 'cyl', 'pyr', 'triPrism'] as const) : rng.pick(['coneSide', 'coneSide', 'cone', 'rectRot'] as const);
  if (kind === 'cube' || kind === 'box') {
    const a = rng.int(2, kind === 'cube' ? 10 : 8);
    const b = kind === 'cube' ? a : rng.int(2, 8);
    const c = kind === 'cube' ? a : rng.int(2, 8);
    if (kind === 'box' && a === b && b === c) return genSurface(rng, d);
    const s = 2 * (a * b + b * c + a * c);
    return numProblem(ID, d, {
      q: kind === 'cube' ? `1 辺 ${a} cm の 立方体の 表面積は?(cm²)` : `縦 ${a} cm、横 ${b} cm、高さ ${c} cm の 直方体の 表面積は?(cm²)`,
      v: s,
      unit: 'cm²',
      hint: kind === 'cube' ? '合同な 正方形が 6 つ' : '向かい合う 面が 3 組。展開図を 思い出そう',
      explanation:
        kind === 'cube'
          ? [text('表面積は すべての 面の 面積の 和'), `${a} \\times ${a} \\times 6 = ${s}`, `${text('答え: ')} ${s} ${text('cm²')}`]
          : [text('表面積は すべての 面の 面積の 和'), `(${a} \\times ${b} + ${b} \\times ${c} + ${a} \\times ${c}) \\times 2 = ${s}`, `${text('答え: ')} ${s} ${text('cm²')}`],
      tags: [kind === 'cube' ? 'surface_cube' : 'surface_box'],
      key: `sur:${kind}:${a}:${b}:${c}`,
      figure: { kind: 'solid', shape: 'prism4', labels: { base: `${a} cm`, base2: `${b} cm`, height: `${c} cm` } },
      mistakes: kind === 'cube' ? [mistakeNum(a * a * a, 'それは 体積。表面積は 面の 面積の 和'), mistakeNum(4 * a * a, '面は 6 つ あるよ')] : [mistakeNum(a * b * c, 'それは 体積。表面積は 面の 面積の 和'), mistakeNum(a * b + b * c + a * c, '向かい合う 面が 2 つずつ。2 倍しよう')],
      verify: `2*(${a}*${b}+${b}*${c}+${a}*${c})`,
    });
  }
  if (kind === 'cylSide') {
    const r = rng.int(2, 10);
    const v = rat(2 * r);
    return piProblem(ID, d, {
      q: `底面の 半径が ${r} cm の 円柱の 展開図を かく。側面に なる 長方形の 横の 長さは 何 cm?`,
      v,
      unit: 'cm',
      hint: '側面の 長方形の 横は、底面の 円周と 同じ 長さ',
      explanation: [text('側面の 長方形の 横の 長さ = 底面の 円周'), `2\\pi \\times ${r} = ${piTex(v)}`, `${text('答え: ')} ${piTex(v)} ${text('cm')}`],
      tags: ['cylinder_net'],
      key: `sur:side:${r}`,
      figure: { kind: 'solid', shape: 'cylinder', labels: { radius: `${r} cm` } },
      mistakes: [mistakePi(rat(r * r), 'πr² は 底面の 面積。横の 長さは 円周 2πr'), mistakePi(rat(r), '円周は 2πr。2 を かけよう')],
      verify: `2*${r}π`,
    });
  }
  if (kind === 'cyl' || kind === 'rectRot') {
    const r = rng.int(2, kind === 'cyl' ? 6 : 8);
    const h = rng.int(3, 10);
    const side = 2 * r * h;
    const base = r * r;
    const v = rat(side + 2 * base);
    return piProblem(ID, d, {
      q: kind === 'cyl' ? `底面の 半径が ${r} cm、高さが ${h} cm の 円柱の 表面積は?` : `縦 ${h} cm、横 ${r} cm の 長方形を、縦の 辺を 軸として 1 回転させて できる 立体の 表面積は?`,
      v,
      unit: 'cm²',
      hint: '展開図: 側面の 長方形(縦は 高さ、横は 底面の 円周)と 底面の 円 2 つ',
      explanation: [
        ...(kind === 'rectRot' ? [text(`できる 立体は 底面の 半径 ${r} cm、高さ ${h} cm の 円柱`)] : []),
        `${text('側面積: ')} ${h} \\times (2\\pi \\times ${r}) = ${side}\\pi`,
        `${text('底面積: ')} \\pi \\times ${r}^{2} = ${base}\\pi`,
        `${side}\\pi + ${base}\\pi \\times 2 = ${piTex(v)}`,
        `${text('答え: ')} ${piTex(v)} ${text('cm²')}`,
      ],
      tags: [kind === 'cyl' ? 'surface_cylinder' : 'surface_rotate'],
      key: `sur:${kind}:${r}:${h}`,
      figure: kind === 'cyl' ? { kind: 'solid', shape: 'cylinder', labels: { radius: `${r} cm`, height: `${h} cm` } } : rotationDiagram('rect', h, r, `${h} cm`, `${r} cm`),
      mistakes: [
        mistakePi(rat(side + base), '底面は 上と 下の 2 つ あるよ'),
        mistakePi(rat(side), '側面だけでなく、底面の 円 2 つも たそう'),
        mistakePi(rat(r * h + 2 * base), '側面の 横は 円周 2πr。2 を かけよう'),
        mistakePi(rat(base * h), 'それは 体積。表面積は 面の 面積の 和'),
      ],
      verify: `(2*${r}*${h}+2*${r}*${r})π`,
    });
  }
  if (kind === 'pyr') {
    // 正四角錐: 底面の 1 辺 a、側面の 三角形の 高さ l
    const a = rng.pick([4, 6, 8, 10]);
    const l = rng.int(Math.max(4, a / 2 + 2), 12);
    const side = 4 * ((a * l) / 2);
    const s = a * a + side;
    return numProblem(ID, d, {
      q: `底面が 1 辺 ${a} cm の 正方形で、側面の 二等辺三角形の 高さが ${l} cm の 正四角錐の 表面積は?(cm²)`,
      v: s,
      unit: 'cm²',
      hint: '展開図: 底面の 正方形 1 つと、合同な 三角形 4 つ',
      explanation: [`${text('側面積: ')} ${a} \\times ${l} \\div 2 \\times 4 = ${side}`, `${text('底面積: ')} ${a} \\times ${a} = ${a * a}`, `${side} + ${a * a} = ${s}`, `${text('答え: ')} ${s} ${text('cm²')}`],
      tags: ['surface_pyramid'],
      key: `sur:pyr:${a}:${l}`,
      figure: { kind: 'solid', shape: 'pyramid4', labels: { base: `${a} cm` } },
      mistakes: [mistakeNum(side, '底面の 正方形も たそう'), mistakeNum(a * a + 4 * a * l, '三角形の 面積は ÷ 2 を 忘れずに'), mistakeNum(a * a + (a * l) / 2, '側面の 三角形は 4 つ あるよ')],
      verify: `${a}*${a}+4*${a}*${l}/2`,
    });
  }
  if (kind === 'triPrism') {
    // 底面が 直角三角形(3・4・5 の 形)の 三角柱
    const [p, q, hyp] = rng.pick([
      [3, 4, 5],
      [6, 8, 10],
      [5, 12, 13],
    ]);
    const h = rng.int(3, 10);
    const base = (p * q) / 2;
    const side = (p + q + hyp) * h;
    const s = side + base * 2;
    return numProblem(ID, d, {
      q: `底面が 3 辺 ${p} cm、${q} cm、${hyp} cm の 直角三角形(直角を はさむ 辺が ${p} cm と ${q} cm)で、高さが ${h} cm の 三角柱の 表面積は?(cm²)`,
      v: s,
      unit: 'cm²',
      hint: '側面は 縦が 高さ、横が 底面の 周の 長さの 長方形。それに 底面 2 つ',
      explanation: [
        `${text('側面積: ')} ${h} \\times (${p} + ${q} + ${hyp}) = ${side}`,
        `${text('底面積: ')} ${p} \\times ${q} \\div 2 = ${base}`,
        `${side} + ${base} \\times 2 = ${s}`,
        `${text('答え: ')} ${s} ${text('cm²')}`,
      ],
      tags: ['surface_tri_prism'],
      key: `sur:tri:${p}:${q}:${h}`,
      figure: { kind: 'solid', shape: 'prism3', labels: { height: `${h} cm` } },
      mistakes: [mistakeNum(side + base, '底面は 2 つ あるよ'), mistakeNum(side, '底面の 三角形 2 つも たそう'), mistakeNum(side + p * q * 2, '三角形の 面積は ÷ 2 を 忘れずに')],
      verify: `${h}*(${p}+${q}+${hyp})+${p}*${q}`,
    });
  }
  // 円錐: 側面積 = π × 母線 × 半径(展開図の おうぎ形: 中心角 = 360 × r ÷ 母線)
  const pairs: [number, number][] = [
    [2, 5],
    [2, 6],
    [3, 5],
    [3, 8],
    [3, 9],
    [4, 6],
    [4, 9],
    [4, 10],
    [5, 8],
    [5, 12],
    [6, 10],
    [2, 8],
  ];
  const [r, l] = rng.pick(pairs);
  const side = rat(l * r);
  const angle = rat(360 * r, l);
  const withBase = kind === 'cone';
  const v = withBase ? add(side, rat(r * r)) : side;
  return piProblem(ID, d, {
    q: `底面の 半径が ${r} cm、母線が ${l} cm の 円錐の ${withBase ? '表面積' : '側面積'}は?`,
    v,
    unit: 'cm²',
    hint: '展開図の 側面は おうぎ形(半径 = 母線、弧の長さ = 底面の 円周)。中心角を 先に 出そう',
    explanation: [
      `${text('中心角: ')} 360^\\circ \\times \\frac{2\\pi \\times ${r}}{2\\pi \\times ${l}} = ${toTex(angle)}^\\circ`,
      `${text('側面積: ')} \\pi \\times ${l}^{2} \\times \\frac{${toTex(angle)}}{360} = ${piTex(side)}`,
      ...(withBase ? [`${text('底面積: ')} \\pi \\times ${r}^{2} = ${r * r}\\pi`, `${piTex(side)} + ${r * r}\\pi = ${piTex(v)}`] : []),
      text('(側面積は π × 母線 × 半径 でも 求められる)'),
      `${text('答え: ')} ${piTex(v)} ${text('cm²')}`,
    ],
    tags: [withBase ? 'surface_cone' : 'cone_side'],
    key: `sur:${kind}:${r}:${l}`,
    figure: { kind: 'solid', shape: 'cone', labels: { radius: `${r} cm`, slant: `${l} cm` } },
    mistakes: [
      mistakePi(rat(l * l), '側面は 半径が 母線の 円の 一部(おうぎ形)。円 全体では ないよ'),
      mistakePi(rat(2 * r * l), '側面積は π × 母線 × 半径。2 は かけないよ'),
      ...(withBase ? [mistakePi(side, '底面の 円も たそう')] : [mistakePi(add(side, rat(r * r)), 'それは 表面積(底面も ふくむ)。側面だけ 答えよう')]),
      mistakePi(rat(r * r), 'それは 底面の 面積'),
    ],
    verify: withBase ? `(${l}*${r}+${r}*${r})π` : `${l}*${r}π`,
  });
}

// ---------------------------------------------------------------- 投影図・展開図・回転体

const PROJECTIONS: { top: 'circle' | 'square' | 'triangle'; front: 'rect' | 'triangle' | 'circle'; a: string; w: Wrong[] }[] = [
  { top: 'circle', front: 'rect', a: '円柱', w: [{ opt: '円錐', say: '正面から 見て 長方形なら 柱。三角形なら 錐' }, { opt: '球', say: '球は どこから 見ても 円' }, { opt: '四角柱', say: '真上から 見て 円なら 底面は 円' }] },
  { top: 'circle', front: 'triangle', a: '円錐', w: [{ opt: '円柱', say: '正面から 見て 三角形なら 錐' }, { opt: '三角錐', say: '真上から 見て 円なら 底面は 円' }, { opt: '球' }] },
  { top: 'circle', front: 'circle', a: '球', w: [{ opt: '円柱', say: '円柱を 正面から 見ると 長方形' }, { opt: '円錐', say: '円錐を 正面から 見ると 三角形' }, { opt: '半球' }] },
  { top: 'square', front: 'rect', a: '四角柱(直方体)', w: [{ opt: '四角錐', say: '正面から 見て 長方形なら 柱' }, { opt: '三角柱', say: '真上から 見て 四角形なら 底面は 四角形' }, { opt: '円柱', say: '真上から 見て 四角形なら 底面は 四角形' }] },
  { top: 'square', front: 'triangle', a: '四角錐', w: [{ opt: '三角錐', say: '真上から 見て 四角形なら 底面は 四角形' }, { opt: '四角柱', say: '正面から 見て 三角形なら 錐' }, { opt: '円錐' }] },
  { top: 'triangle', front: 'rect', a: '三角柱', w: [{ opt: '三角錐', say: '正面から 見て 長方形なら 柱' }, { opt: '四角柱', say: '真上から 見て 三角形なら 底面は 三角形' }, { opt: '円柱' }] },
  { top: 'triangle', front: 'triangle', a: '三角錐', w: [{ opt: '三角柱', say: '正面から 見て 三角形なら 錐' }, { opt: '四角錐', say: '真上から 見て 三角形なら 底面は 三角形' }, { opt: '円錐' }] },
];

interface Fact {
  q: string;
  a: string;
  w: Wrong[];
  tag: string;
  /** 添える 図(展開図・回転させる 図形。先生の 判定 2026-10-18「展開図を 提示して ください」) */
  fig?: () => FigureSpec;
}

const net = (k: NetKind, ask?: NetAsk) => () => netDiagram(k, ask);

const NET_FACTS: Fact[] = [
  { q: '長方形 3 枚と 三角形 2 枚の 展開図を 組み立てると?', a: '三角柱', w: [{ opt: '三角錐', say: '三角錐は 三角形 4 枚' }, { opt: '四角柱', say: '四角柱の 側面は 長方形 4 枚' }, { opt: '円柱' }], tag: 'net', fig: net('triPrism') },
  { q: '長方形 1 枚と 円 2 枚の 展開図を 組み立てると?', a: '円柱', w: [{ opt: '円錐', say: '円錐の 側面は おうぎ形' }, { opt: '球' }, { opt: '四角柱' }], tag: 'net', fig: net('cylinder') },
  { q: 'おうぎ形 1 枚と 円 1 枚の 展開図を 組み立てると?', a: '円錐', w: [{ opt: '円柱', say: '円柱の 側面は 長方形' }, { opt: '球' }, { opt: '三角錐' }], tag: 'net', fig: net('cone') },
  { q: '合同な 正方形 6 枚の 展開図を 組み立てると?', a: '立方体', w: [{ opt: '四角錐', say: '四角錐の 側面は 三角形' }, { opt: '正八面体' }, { opt: '六角柱' }], tag: 'net', fig: net('cube') },
  { q: '正方形 1 枚と 合同な 二等辺三角形 4 枚の 展開図を 組み立てると?', a: '正四角錐', w: [{ opt: '四角柱', say: '柱の 側面は 長方形' }, { opt: '三角錐' }, { opt: '正八面体' }], tag: 'net', fig: net('squarePyramid') },
  { q: '円錐の 展開図で、側面に なる おうぎ形の 弧の 長さと 等しいのは?', a: '底面の 円周', w: [{ opt: '母線の 長さ', say: '母線は おうぎ形の 半径に なるよ' }, { opt: '底面の 半径' }, { opt: '円錐の 高さ' }], tag: 'net_cone', fig: net('cone', 'arc') },
  { q: '円錐の 展開図で、側面に なる おうぎ形の 半径と 等しいのは?', a: '円錐の 母線', w: [{ opt: '円錐の 高さ', say: '高さは 頂点から 底面への 垂線の 長さ。おうぎ形の 半径は 母線' }, { opt: '底面の 半径' }, { opt: '底面の 円周' }], tag: 'net_cone', fig: net('cone', 'radius') },
  { q: '円柱の 展開図で、側面に なる 長方形の 横の 長さと 等しいのは?', a: '底面の 円周', w: [{ opt: '底面の 直径', say: '側面を 1 周 巻くので、円周と 同じ' }, { opt: '底面の 面積' }, { opt: '円柱の 高さ', say: '縦の 長さが 高さ。横は …' }], tag: 'net', fig: net('cylinder', 'sideWidth') },
];

const ROTATION_FACTS: Fact[] = [
  { q: '長方形を、1 つの 辺を 軸として 1 回転させると どんな 立体が できる?', a: '円柱', w: [{ opt: '円錐', say: '円錐は 直角三角形を 回すと できる' }, { opt: '球', say: '球は 半円を 回すと できる' }, { opt: '四角柱', say: '回して できる 立体の 底面は 円' }], tag: 'rotation', fig: () => rotationDiagram('rect', 3, 2) },
  { q: '直角三角形を、直角を はさむ 1 つの 辺を 軸として 1 回転させると どんな 立体が できる?', a: '円錐', w: [{ opt: '円柱', say: '円柱は 長方形を 回すと できる' }, { opt: '三角錐', say: '回して できる 立体の 底面は 円' }, { opt: '球' }], tag: 'rotation', fig: () => rotationDiagram('tri', 3, 2) },
  { q: '半円を、直径を 軸として 1 回転させると どんな 立体が できる?', a: '球', w: [{ opt: '円柱' }, { opt: '円錐' }, { opt: '半球', say: '半円を 1 回転させると、まるごと 球に なるよ' }], tag: 'rotation', fig: () => rotationDiagram('semi', 3, 1.5) },
  { q: '円柱や 円錐の 側面を えがく 線分を 何という?', a: '母線', w: [{ opt: '高さ', say: '高さは 底面に 垂直な 長さ。側面を えがく 線は 母線' }, { opt: '半径' }, { opt: '交線' }], tag: 'rotation' },
  { q: '回転体を、回転の 軸を ふくむ 平面で 切ると、切り口は どんな 図形?', a: '回転の 軸を 対称の軸と する 線対称な 図形', w: [{ opt: 'いつも 円', say: '円に なるのは 軸に 垂直な 平面で 切った とき' }, { opt: 'いつも 長方形', say: '円錐なら 二等辺三角形に なるよ' }, { opt: '点対称な 図形' }], tag: 'rotation' },
  { q: '回転体を、回転の 軸に 垂直な 平面で 切ると、切り口は どんな 図形?', a: '円', w: [{ opt: '長方形', say: '長方形は 軸を ふくむ 平面で 円柱を 切った とき' }, { opt: '三角形' }, { opt: 'おうぎ形' }], tag: 'rotation' },
  { q: '球を 平面で 切るとき、切り口が もっとも 大きく なるのは?', a: '球の 中心を 通る 平面で 切る とき', w: [{ opt: '球の はしを 切る とき', say: 'はしを 切ると 小さな 円に なるよ' }, { opt: 'どう 切っても 同じ', say: '中心から 遠いほど 切り口は 小さく なるよ' }, { opt: '切り口は 円に ならない' }], tag: 'rotation' },
  { q: '投影図で、真上から 見た 図を 何という?', a: '平面図', w: [{ opt: '立面図', say: '立面図は 正面から 見た 図' }, { opt: '見取図' }, { opt: '展開図' }], tag: 'projection_term' },
  { q: '投影図で、正面から 見た 図を 何という?', a: '立面図', w: [{ opt: '平面図', say: '平面図は 真上から 見た 図' }, { opt: '見取図' }, { opt: '展開図' }], tag: 'projection_term' },
  { q: '円錐の 高さを 投影図で 調べるには、どの 図を 見る?', a: '立面図(正面から 見た 図)', w: [{ opt: '平面図(真上から 見た 図)', say: '真上から 見ると 高さは 見えないよ' }, { opt: '展開図', say: '展開図の 半径は 母線。高さは 立面図で わかる' }, { opt: 'どの 図でも わからない' }], tag: 'projection_term' },
];

function genProjection(rng: Rng, d: Difficulty): Problem {
  const ID = 'g1.solid.projection';
  const mode = d === 1 ? rng.pick(['proj', 'proj', 'net'] as const) : d === 2 ? rng.pick(['proj', 'net', 'rot', 'coneArc'] as const) : rng.pick(['coneAngle', 'coneAngle', 'rot', 'net'] as const);
  if (mode === 'proj') {
    const c = rng.pick(PROJECTIONS);
    const { answer, mistakes } = choose(rng, c.a, c.w);
    return {
      templateId: ID,
      difficulty: d,
      prompt: text('この 投影図(上は 平面図、下は 立面図)が 表す 立体は?'),
      promptText: 'この投影図(上は平面図、下は立面図)が表す立体は?',
      answer,
      hint: '真上から 見た 形で 底面が、正面から 見た 形で 柱か 錐かが わかる',
      explanation: [text('平面図(真上から)で 底面の 形、立面図(正面から)が 長方形なら 柱、三角形なら 錐'), text(`答え: ${c.a}`)],
      tags: ['projection'],
      key: `prj:${c.top}:${c.front}`,
      figure: { kind: 'projection', top: c.top, front: c.front },
      mistakes,
      verify: String(answer.kind === 'choice' ? answer.correct : 0),
    };
  }
  if (mode === 'net' || mode === 'rot') {
    const pool = mode === 'net' ? NET_FACTS : ROTATION_FACTS;
    const c = rng.pick(pool);
    const { answer, mistakes } = choose(rng, c.a, c.w);
    return {
      templateId: ID,
      difficulty: d,
      prompt: text(c.q),
      promptText: c.q,
      answer,
      layout: 'prose',
      hint: mode === 'net' ? '面の 形と 数を 数えよう' : '回す 図形を 頭の 中で くるっと 回して みよう',
      explanation: [text(`答え: ${c.a}`)],
      tags: [c.tag],
      key: `prj:${c.q}`,
      figure: c.fig?.(),
      mistakes,
      verify: String(answer.kind === 'choice' ? answer.correct : 0),
    };
  }
  if (mode === 'coneArc') {
    const r = rng.int(2, 9);
    const v = rat(2 * r);
    return piProblem(ID, d, {
      q: `底面の 半径が ${r} cm の 円錐の 展開図で、側面に なる おうぎ形の 弧の 長さは?`,
      v,
      unit: 'cm',
      hint: 'おうぎ形の 弧の 長さは、底面の 円周と 等しい',
      explanation: [text('側面の おうぎ形の 弧の 長さ = 底面の 円周'), `2\\pi \\times ${r} = ${piTex(v)}`, `${text('答え: ')} ${piTex(v)} ${text('cm')}`],
      tags: ['net_cone_arc'],
      key: `prj:arc:${r}`,
      figure: { kind: 'solid', shape: 'cone', labels: { radius: `${r} cm` } },
      mistakes: [mistakePi(rat(r * r), 'πr² は 底面の 面積。弧の 長さは 円周 2πr'), mistakePi(rat(r), '円周は 2πr。2 を かけよう')],
      verify: `2*${r}π`,
    });
  }
  // 円錐の 展開図の 中心角 = 360° × (底面の 半径)÷(母線)
  const pairs: [number, number][] = [
    [3, 4],
    [3, 8],
    [2, 6],
    [4, 12],
    [5, 10],
    [3, 9],
    [2, 8],
    [6, 9],
    [1, 4],
    [3, 5],
    [4, 5],
    [5, 6],
    [2, 5],
    [4, 6],
    [5, 12],
    [4, 9],
  ];
  const [r, l] = rng.pick(pairs);
  const angle = rat(360 * r, l);
  return numProblem(ID, d, {
    // 「数だけ 答える」は 書かない(第5章の 判定と 同じ)。解答欄に ° を 出す
    q: `底面の 半径が ${r} cm、母線が ${l} cm の 円錐の 展開図で、側面に なる おうぎ形の 中心角は 何度?`,
    v: angle,
    unit: '°',
    hint: 'おうぎ形の 弧(底面の 円周 2π × 半径)は、半径が 母線の 円の 円周の 何分の いくつか',
    explanation: [
      text('おうぎ形の 弧の 長さ = 底面の 円周、おうぎ形の 半径 = 母線'),
      `\\frac{2\\pi \\times ${r}}{2\\pi \\times ${l}} = ${toTex(rat(r, l))}`,
      `360^\\circ \\times ${toTex(rat(r, l))} = ${toTex(angle)}^\\circ`,
      `${text('答え: ')} ${toTex(angle)}`,
    ],
    tags: ['net_cone_angle'],
    key: `prj:ang:${r}:${l}`,
    figure: { kind: 'solid', shape: 'cone', labels: { radius: `${r} cm`, slant: `${l} cm` } },
    mistakes: [mistakeNum(rat(360 * l, r), '母線 ÷ 半径 では なく、半径 ÷ 母線 だよ'), mistakeNum(rat(180 * r, l), '360° に かけよう'), mistakeNum(rat(360 * r * r, l * l), '弧の 長さは 半径に 比例。2 乗は しないよ')],
    verify: `360*${r}/${l}`,
  });
}

// ---------------------------------------------------------------- 位置関係

type V3 = [number, number, number];
interface Poly {
  names: string[];
  pos: Record<string, V3>;
  edges: [string, string][];
  faces: string[][];
}

/** 直方体(上の 面 ABCD・下の 面 EFGH。E は A の 真下) */
const BOX: Poly = (() => {
  const pos: Record<string, V3> = {
    A: [0, 1, 1],
    B: [0, 0, 1],
    C: [1, 0, 1],
    D: [1, 1, 1],
    E: [0, 1, 0],
    F: [0, 0, 0],
    G: [1, 0, 0],
    H: [1, 1, 0],
  };
  const edges: [string, string][] = [
    ['A', 'B'],
    ['B', 'C'],
    ['C', 'D'],
    ['D', 'A'],
    ['E', 'F'],
    ['F', 'G'],
    ['G', 'H'],
    ['H', 'E'],
    ['A', 'E'],
    ['B', 'F'],
    ['C', 'G'],
    ['D', 'H'],
  ];
  const faces = [
    ['A', 'B', 'C', 'D'],
    ['E', 'F', 'G', 'H'],
    ['A', 'B', 'F', 'E'],
    ['B', 'C', 'G', 'F'],
    ['C', 'D', 'H', 'G'],
    ['D', 'A', 'E', 'H'],
  ];
  return { names: Object.keys(pos), pos, edges, faces };
})();

/** 三角柱(底面 ABC・DEF。D は A の 真下。底面は 直角三角形 で 角 B が 直角) */
const TRI: Poly = (() => {
  const pos: Record<string, V3> = {
    A: [0, 1, 1],
    B: [0, 0, 1],
    C: [1, 0, 1],
    D: [0, 1, 0],
    E: [0, 0, 0],
    F: [1, 0, 0],
  };
  const edges: [string, string][] = [
    ['A', 'B'],
    ['B', 'C'],
    ['C', 'A'],
    ['D', 'E'],
    ['E', 'F'],
    ['F', 'D'],
    ['A', 'D'],
    ['B', 'E'],
    ['C', 'F'],
  ];
  const faces = [
    ['A', 'B', 'C'],
    ['D', 'E', 'F'],
    ['A', 'B', 'E', 'D'],
    ['B', 'C', 'F', 'E'],
    ['C', 'A', 'D', 'F'],
  ];
  return { names: Object.keys(pos), pos, edges, faces };
})();

const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const isZero3 = (a: V3): boolean => a.every((v) => v === 0);

/** 2 辺の 位置関係: 'meet'(交わる)・'parallel'(平行)・'skew'(ねじれの位置) */
function edgeRel(P: Poly, e: [string, string], f: [string, string]): 'meet' | 'parallel' | 'skew' {
  if (e.some((v) => f.includes(v))) return 'meet';
  const u = sub3(P.pos[e[1]], P.pos[e[0]]);
  const w = sub3(P.pos[f[1]], P.pos[f[0]]);
  if (isZero3(cross(u, w))) return 'parallel';
  // 同じ 平面上で 交わらない(のばすと 交わる)辺は 1 年の 立体(直方体・三角柱)には ない が、念のため 判定する
  const n = cross(u, w);
  return dot(n, sub3(P.pos[f[0]], P.pos[e[0]])) === 0 ? 'meet' : 'skew';
}

/** 辺と 面の 関係: 'in'(ふくまれる)・'parallel'・'perp'(垂直)・'meet'(交わるが 垂直でない) */
function edgeFace(P: Poly, e: [string, string], face: string[]): 'in' | 'parallel' | 'perp' | 'meet' {
  if (e.every((v) => face.includes(v))) return 'in';
  const n = cross(sub3(P.pos[face[1]], P.pos[face[0]]), sub3(P.pos[face[2]], P.pos[face[0]]));
  const u = sub3(P.pos[e[1]], P.pos[e[0]]);
  if (dot(n, u) === 0) return 'parallel';
  if (isZero3(cross(n, u))) return 'perp';
  return 'meet';
}

const eName = (e: [string, string]) => `辺 ${[...e].sort().join("")}`;
const fName = (f: string[]) => `面 ${f.join('')}`;

function relationOnFigure(rng: Rng, d: Difficulty): Problem {
  const ID = 'g1.solid.relation';
  const P = d === 3 && rng.bool() ? TRI : BOX;
  const shape = P === BOX ? 'prism4' : 'prism3';
  const solidName = P === BOX ? '直方体' : '三角柱(底面は ∠ABC = 90° の 直角三角形)';
  const figure: SolidSpec = { kind: 'solid', shape, labels: {}, vertices: true };
  const e = rng.pick(P.edges);
  const ask = rng.pick(d === 2 ? (['skew', 'parallel', 'skewPick', 'facePar'] as const) : (['skew', 'skewPick', 'facePerp', 'facePar'] as const));
  if (ask === 'skew' || ask === 'parallel') {
    const want = ask;
    const n = P.edges.filter((f) => f !== e && edgeRel(P, e, f) === want).length;
    const meet = P.edges.filter((f) => f !== e && edgeRel(P, e, f) === 'meet').length;
    const par = P.edges.filter((f) => f !== e && edgeRel(P, e, f) === 'parallel').length;
    const skew = P.edges.filter((f) => f !== e && edgeRel(P, e, f) === 'skew').length;
    const label = want === 'skew' ? 'ねじれの位置に ある' : '平行な';
    const mistakes: Mistake[] = [];
    if (want === 'skew') {
      mistakes.push(mistakeNum(skew + par, '平行な 辺は ねじれの位置では ないよ(同じ 平面上に ある)'), mistakeNum(meet, 'それは 交わる 辺の 数。交わらず、平行でも ない 辺を 数えよう'));
    } else mistakes.push(mistakeNum(par + skew, 'ねじれの位置の 辺は 平行では ないよ'), mistakeNum(par + 1, `${eName(e)} 自身は 数えないよ`));
    return numProblem(ID, d, {
      q: `図の ${solidName}で、${eName(e)} と ${label} 辺は 何本?`,
      v: n,
      hint: want === 'skew' ? '交わる 辺・平行な 辺を 先に 消して、残った 辺を 数えよう' : '同じ 向きに のびる 辺を さがそう',
      explanation: [
        text(`${eName(e)} と 交わる 辺: ${meet} 本、平行な 辺: ${par} 本、ねじれの位置: ${skew} 本`),
        text('ねじれの位置 = 平行でなく、交わらない 2 直線'),
        `${text('答え: ')} ${n}`,
      ],
      tags: [want === 'skew' ? 'relation_skew' : 'relation_parallel'],
      key: `rel:${solidName}:${want}:${e.join('')}`,
      figure,
      mistakes,
      verify: `${n}`,
    });
  }
  if (ask === 'skewPick') {
    const skews = P.edges.filter((f) => edgeRel(P, e, f) === 'skew');
    if (skews.length === 0) return relationOnFigure(rng, d);
    const correct = rng.pick(skews);
    const pars = P.edges.filter((f) => f !== e && edgeRel(P, e, f) === 'parallel');
    const meets = P.edges.filter((f) => f !== e && edgeRel(P, e, f) === 'meet');
    const wrongs: Wrong[] = [
      ...rng.shuffle(pars).slice(0, 1).map((f) => ({ opt: eName(f), say: `${eName(f)} は ${eName(e)} と 平行。ねじれの位置は 平行でなく 交わらない 辺` })),
      ...rng.shuffle(meets).slice(0, 3).map((f) => ({ opt: eName(f), say: `${eName(f)} は ${eName(e)} と 交わって いるよ(頂点を 共有)` })),
    ];
    const { answer, mistakes } = choose(rng, eName(correct), wrongs);
    return {
      templateId: ID,
      difficulty: d,
      prompt: text(`図の ${solidName}で、${eName(e)} と ねじれの位置に ある 辺は どれ?`),
      promptText: `図の${solidName}で、${eName(e)} とねじれの位置にある辺はどれ?`,
      answer,
      hint: '同じ 頂点を 通る 辺は 交わる。同じ 向きの 辺は 平行。どちらでも ない 辺が ねじれの位置',
      explanation: [text(`${eName(correct)} は ${eName(e)} と 平行でなく、交わらない`), text(`答え: ${eName(correct)}`)],
      tags: ['relation_skew'],
      key: `rel:${solidName}:pick:${e.join('')}:${correct.join('')}`,
      figure,
      mistakes,
      verify: String(answer.kind === 'choice' ? answer.correct : 0),
    };
  }
  // 面と 辺
  const face = rng.pick(P.faces);
  const want = ask === 'facePar' ? 'parallel' : 'perp';
  const n = P.edges.filter((f) => edgeFace(P, f, face) === want).length;
  if (n === 0) return relationOnFigure(rng, d);
  const inFace = P.edges.filter((f) => edgeFace(P, f, face) === 'in').length;
  return numProblem(ID, d, {
    q: `図の ${solidName}で、${fName(face)} と ${want === 'parallel' ? '平行な' : '垂直な'} 辺は 何本?`,
    v: n,
    hint: want === 'parallel' ? '面に ふくまれる 辺は 平行では ない。面と 出あわない 辺を 数えよう' : '面と 直角に 交わる 辺を さがそう',
    explanation: [text(`${fName(face)} に ふくまれる 辺は ${inFace} 本(これは 平行でも 垂直でも ない)`), `${text('答え: ')} ${n}`],
    tags: [want === 'parallel' ? 'relation_face_parallel' : 'relation_face_perp'],
    key: `rel:${solidName}:${want}:${face.join('')}`,
    figure,
    mistakes: [mistakeNum(inFace, '面に ふくまれる 辺は 数えないよ'), mistakeNum(n + inFace, '面に ふくまれる 辺は 平行・垂直に 入らないよ')],
    verify: `${n}`,
  });
}

/** 角柱(n 角柱)の 底面の 1 辺と ねじれの位置に ある 辺の 数 */
function prismSkewCount(n: number): { base: number; lateral: number } {
  // 底面の 辺: 側面の 辺のうち 両はしを 通らない n − 2 本 + もう 1 つの 底面の 辺で 平行でない もの
  const parallelOther = n % 2 === 0 ? 2 : 1; // 正 n 角形の 向かいの 辺(偶数のとき)と、真下の 辺
  const base = n - 2 + (n - parallelOther);
  // 側面の 辺: 2 つの 底面の 辺のうち、その 辺の 両はしを 通らない もの
  const lateral = 2 * (n - 2);
  return { base, lateral };
}

const POLYHEDRA: { name: string; F: number; E: number; V: number; face: string; meet: number }[] = [
  { name: '正四面体', F: 4, E: 6, V: 4, face: '正三角形', meet: 3 },
  { name: '正六面体(立方体)', F: 6, E: 12, V: 8, face: '正方形', meet: 3 },
  { name: '正八面体', F: 8, E: 12, V: 6, face: '正三角形', meet: 4 },
  { name: '正十二面体', F: 12, E: 30, V: 20, face: '正五角形', meet: 3 },
  { name: '正二十面体', F: 20, E: 30, V: 12, face: '正三角形', meet: 5 },
];

const RELATION_TERMS: Fact[] = [
  { q: '空間で、平行でなく 交わらない 2 直線の 位置関係を 何という?', a: 'ねじれの位置', w: [{ opt: '平行', say: '平行は 同じ 平面上に あって 交わらない 2 直線' }, { opt: '垂直', say: '垂直は 交わる 2 直線の 一つ' }, { opt: '交わる' }], tag: 'relation_term' },
  { q: '空間に ある 2 つの 平面の 位置関係は?', a: '交わるか、平行か', w: [{ opt: '交わるか、平行か、ねじれの位置', say: 'ねじれの位置は 2 直線の 関係。2 平面には ないよ' }, { opt: 'いつも 交わる' }, { opt: 'いつも 平行' }], tag: 'relation_term' },
  { q: '空間に ある 直線と 平面の 位置関係は?', a: 'ふくまれる・交わる・平行(出あわない)', w: [{ opt: '交わる・平行・ねじれの位置', say: 'ねじれの位置は 2 直線の 関係' }, { opt: '交わる・平行 だけ', say: '直線が 平面の 上に ある(ふくまれる)場合も あるよ' }, { opt: 'いつも 交わる' }], tag: 'relation_term' },
  { q: '2 つの 平面が 交わった ところに できる 直線を 何という?', a: '交線', w: [{ opt: '母線', say: '母線は 円柱や 円錐の 側面を えがく 線分' }, { opt: '交点', say: '交点は 点。平面どうしが 交わると 直線が できる' }, { opt: '垂線' }], tag: 'relation_term' },
  { q: '平面が 1 つに 決まるのは?', a: '一直線上に ない 3 点が あるとき', w: [{ opt: '2 点が あるとき', say: '2 点を 通る 平面は いくつも あるよ(直線の まわりに 回せる)' }, { opt: '一直線上に ある 3 点が あるとき', say: '一直線上の 3 点では、その 直線を ふくむ 平面が いくつも ある' }, { opt: '1 本の 直線が あるとき' }], tag: 'relation_term' },
  { q: '直線 ℓ が 平面 P と 点 O で 交わる。ℓ ⊥ P と いえるのは?', a: 'ℓ が O を 通る P 上の 2 つの 直線に 垂直な とき', w: [{ opt: 'ℓ が P 上の 1 つの 直線に 垂直な とき', say: '1 本だけでは 傾いて いる かも。2 本 確かめよう(三角定規 2 枚)' }, { opt: 'ℓ が P と 交わる とき' }, { opt: 'ℓ が P 上の 直線と 平行な とき' }], tag: 'relation_term' },
  { q: '角錐や 円錐の 高さとは?', a: '頂点と 底面との 距離(頂点から 底面への 垂線の 長さ)', w: [{ opt: '母線の 長さ', say: '母線は ななめ。高さは 底面に 垂直に はかる' }, { opt: '底面の 半径' }, { opt: '側面の 三角形の 高さ', say: 'それは 側面の 高さ。立体の 高さは 頂点から 底面への 垂線' }], tag: 'relation_term' },
  { q: '三角柱は 何面体?', a: '五面体', w: [{ opt: '三面体', say: '底面 2 つと 側面 3 つ。合わせて …' }, { opt: '四面体', say: '底面は 2 つ あるよ' }, { opt: '六面体' }], tag: 'polyhedron_name' },
  { q: '四角錐は 何面体?', a: '五面体', w: [{ opt: '四面体', say: '側面 4 つと 底面 1 つ' }, { opt: '六面体', say: '錐の 底面は 1 つだけ' }, { opt: '八面体' }], tag: 'polyhedron_name' },
  { q: '三角錐は 何面体?', a: '四面体', w: [{ opt: '三面体', say: '側面 3 つと 底面 1 つ' }, { opt: '五面体', say: '錐の 底面は 1 つだけ' }, { opt: '六面体' }], tag: 'polyhedron_name' },
  { q: '五角柱は 何面体?', a: '七面体', w: [{ opt: '五面体', say: '側面 5 つと 底面 2 つ' }, { opt: '六面体', say: '柱の 底面は 2 つ あるよ' }, { opt: '十面体' }], tag: 'polyhedron_name' },
  { q: '六角錐は 何面体?', a: '七面体', w: [{ opt: '六面体', say: '側面 6 つと 底面 1 つ' }, { opt: '八面体', say: '錐の 底面は 1 つだけ' }, { opt: '十二面体' }], tag: 'polyhedron_name' },
  { q: '平面だけで 囲まれた 立体を 何という?', a: '多面体', w: [{ opt: '回転体', say: '回転体は 平面図形を 回して できる 立体(曲面が ある)' }, { opt: '角柱', say: '角柱は 多面体の 一つ。ほかに 角錐なども ある' }, { opt: '正多角形' }], tag: 'polyhedron_name' },
  // 「正三角形の 六面体が 正多面体で ない 理由」は 授業で 出して いないので やめた(先生の 判定 2026-10-18)。かわりに 正多面体の 意味
  { q: 'すべての 面が 合同な 正多角形で、どの 頂点にも 面が 同じ 数だけ 集まる、へこみの ない 多面体を 何という?', a: '正多面体', w: [{ opt: '多面体', say: '多面体は 平面だけで 囲まれた 立体 全部。面が 合同な 正多角形の ものを …' }, { opt: '正多角形', say: '正多角形は 平面の 図形。立体なら …' }, { opt: '回転体' }], tag: 'polyhedron_regular' },
  { q: '正多面体は 全部で 何種類?', a: '5 種類', w: [{ opt: '3 種類' }, { opt: '4 種類' }, { opt: 'かぎりなく ある', say: '正多角形は かぎりなく あるが、正多面体は 5 種類だけ' }], tag: 'polyhedron_regular' },
];

function genRelation(rng: Rng, d: Difficulty): Problem {
  const ID = 'g1.solid.relation';
  if (d === 1) {
    const c = rng.pick(RELATION_TERMS);
    const { answer, mistakes } = choose(rng, c.a, c.w);
    return {
      templateId: ID,
      difficulty: d,
      prompt: text(c.q),
      promptText: c.q,
      answer,
      layout: 'prose',
      hint: '箱(直方体)を 思い浮かべて 指で なぞって みよう',
      explanation: [text(`答え: ${c.a}`)],
      tags: [c.tag],
      key: `rel:${c.q}`,
      mistakes,
      verify: String(answer.kind === 'choice' ? answer.correct : 0),
    };
  }
  if (d === 2) return relationOnFigure(rng, d);
  const mode = rng.pick(['fig', 'fig', 'prismN', 'regular', 'euler'] as const);
  if (mode === 'fig') return relationOnFigure(rng, d);
  if (mode === 'prismN') {
    const n = rng.pick([5, 6]);
    const name = n === 5 ? '正五角柱' : '正六角柱';
    const { base, lateral } = prismSkewCount(n);
    const ofBase = rng.bool();
    const v = ofBase ? base : lateral;
    return numProblem(ID, d, {
      // 問う 辺は 図で 赤く(先生の 判定 2026-10-18「指定の 辺は わかりやすく」)
      q: `図の ${name}で、赤い 辺(${ofBase ? '底面の 辺' : '側面の 辺'})と ねじれの位置に ある 辺は 何本?`,
      v,
      figure: prismAskFigure(n, ofBase),
      hint: '交わる 辺(同じ 頂点を 通る)と 平行な 辺を 先に 消そう',
      explanation: ofBase
        ? [text(`側面の 辺 ${n} 本の うち、両はしの 2 本は 交わる → ${n - 2} 本`), text(`もう 1 つの 底面の ${n} 本の うち、平行な ${n % 2 === 0 ? 2 : 1} 本を のぞく → ${n - (n % 2 === 0 ? 2 : 1)} 本`), `${text('答え: ')} ${v}`]
        : [text(`上と 下の 底面の 辺 ${n} 本ずつの うち、その 辺の はしを 通る 2 本ずつは 交わる`), `(${n} - 2) \\times 2 = ${v}`, `${text('答え: ')} ${v}`],
      tags: ['relation_prism_n'],
      key: `rel:pn:${n}:${ofBase}`,
      mistakes: ofBase ? [mistakeNum(n - 2, 'もう 1 つの 底面の 辺も ねじれの位置に あるよ'), mistakeNum(base + (n % 2 === 0 ? 2 : 1), '真下の 辺(平行)は のぞこう')] : [mistakeNum(n - 2, '上の 底面と 下の 底面の 両方を 数えよう'), mistakeNum(2 * n, 'はしを 通る 辺は 交わるので のぞこう')],
      verify: `${v}`,
    });
  }
  if (mode === 'regular') {
    const p = rng.pick(POLYHEDRA);
    const ask = rng.pick(['F', 'E', 'V', 'face', 'meet'] as const);
    if (ask === 'face' || ask === 'meet') {
      const correct = ask === 'face' ? p.face : `${p.meet} つ`;
      const wrongs: Wrong[] =
        ask === 'face'
          ? ['正三角形', '正方形', '正五角形', '正六角形'].filter((f) => f !== p.face).map((f) => ({ opt: f, say: `${p.name}の 面は ${p.face}` }))
          : [3, 4, 5, 6].filter((m) => m !== p.meet).map((m) => ({ opt: `${m} つ`, say: '1 つの 頂点の まわりの 面を 数えよう' }));
      const { answer, mistakes } = choose(rng, correct, wrongs);
      return {
        templateId: ID,
        difficulty: d,
        prompt: text(ask === 'face' ? `${p.name}の 面は どんな 形?` : `${p.name}で、1 つの 頂点に 集まる 面の 数は?`),
        promptText: ask === 'face' ? `${p.name}の面はどんな形?` : `${p.name}で、1つの頂点に集まる面の数は?`,
        answer,
        figure: regularFigure(p.name),
        hint: '正多面体の 表を 思い出そう',
        explanation: [text(`${p.name}: 面の 形 ${p.face}、1 つの 頂点に 集まる 面 ${p.meet} つ、面 ${p.F}・辺 ${p.E}・頂点 ${p.V}`)],
        tags: ['polyhedron_regular'],
        key: `rel:reg:${p.name}:${ask}`,
        mistakes,
        verify: String(answer.kind === 'choice' ? answer.correct : 0),
      };
    }
    const v = p[ask];
    const label = ask === 'F' ? '面' : ask === 'E' ? '辺' : '頂点';
    return numProblem(ID, d, {
      q: `${p.name}の ${label}の 数は?`,
      v,
      figure: regularFigure(p.name),
      hint: ask === 'E' ? '面の 形の 辺の 数 × 面の 数 ÷ 2(1 本の 辺を 2 つの 面が 共有)' : ask === 'V' ? '面の 形の 頂点の 数 × 面の 数 ÷(1 つの 頂点に 集まる 面の 数)' : '名前の 数字が 面の 数',
      explanation: [text(`${p.name}: 面 ${p.F}、辺 ${p.E}、頂点 ${p.V}`), text(`(面の 数)−(辺の 数)+(頂点の 数)= ${p.F} − ${p.E} + ${p.V} = 2`), `${text('答え: ')} ${v}`],
      tags: ['polyhedron_count'],
      key: `rel:reg:${p.name}:${ask}`,
      mistakes: ask === 'E' ? [mistakeNum(p.E * 2, '1 本の 辺は 2 つの 面が 共有するので 2 で わろう')] : ask === 'V' ? [mistakeNum(p.V * p.meet, '1 つの 頂点には いくつかの 面が 集まる。その 数で わろう')] : [],
      verify: `${v}`,
    });
  }
  // オイラーの 多面体定理(面 − 辺 + 頂点 = 2)を 使って 1 つを 求める
  const solids = [
    { name: '三角柱', F: 5, E: 9, V: 6, kind: 'prism', n: 3 },
    { name: '四角錐', F: 5, E: 8, V: 5, kind: 'pyramid', n: 4 },
    { name: '五角柱', F: 7, E: 15, V: 10, kind: 'prism', n: 5 },
    { name: '六角柱', F: 8, E: 18, V: 12, kind: 'prism', n: 6 },
    { name: '五角錐', F: 6, E: 10, V: 6, kind: 'pyramid', n: 5 },
    { name: '六角錐', F: 7, E: 12, V: 7, kind: 'pyramid', n: 6 },
  ] as const;
  const s = rng.pick(solids);
  const ask = rng.pick(['E', 'V'] as const);
  const v = s[ask];
  return numProblem(ID, d, {
    q: `${s.name}の ${ask === 'E' ? '辺' : '頂点'}の 数は?`,
    v,
    figure: polyFigure(s.kind, s.n),
    hint: ask === 'E' ? '底面の 辺と、側面の 辺(柱なら 底面 2 つ分)を 数えよう' : '底面の 頂点(柱なら 2 つ分)と、錐なら てっぺんの 1 つ',
    explanation: [text(`${s.name}: 面 ${s.F}、辺 ${s.E}、頂点 ${s.V}`), text(`(面の 数)−(辺の 数)+(頂点の 数)= ${s.F} − ${s.E} + ${s.V} = 2`), `${text('答え: ')} ${v}`],
    tags: ['polyhedron_count'],
    key: `rel:eu:${s.name}:${ask}`,
    mistakes: ask === 'E' ? [mistakeNum(s.V, 'それは 頂点の 数'), mistakeNum(s.F, 'それは 面の 数')] : [mistakeNum(s.E, 'それは 辺の 数'), mistakeNum(s.F, 'それは 面の 数')],
    verify: `${v}`,
  });
}

registerTemplate({ id: 'g1.solid.prism', unit: UNIT, title: '柱の体積', timeLimit: { 1: 50, 2: 60, 3: 70 }, generate: genPrism });
registerTemplate({ id: 'g1.solid.pyramid', unit: UNIT, title: '錐の体積', timeLimit: { 1: 55, 2: 60, 3: 75 }, generate: genPyramid });
registerTemplate({ id: 'g1.solid.sphere', unit: UNIT, title: '球', timeLimit: { 1: 50, 2: 65, 3: 75 }, generate: genSphere });
registerTemplate({ id: 'g1.solid.surface', unit: UNIT, title: '表面積', timeLimit: { 1: 50, 2: 75, 3: 90 }, generate: genSurface });
registerTemplate({ id: 'g1.solid.projection', unit: UNIT, title: '投影図・展開図・回転体', timeLimit: { 1: 40, 2: 50, 3: 70 }, generate: genProjection });
registerTemplate({ id: 'g1.solid.relation', unit: UNIT, title: '位置関係・多面体', timeLimit: { 1: 40, 2: 50, 3: 60 }, generate: genRelation });
