import { registerTemplate, mistakeNum, type Difficulty, type Mistake, type Problem } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat, mul, type Rational, isInteger, toTex } from '@/math/rational';
import { text } from '@/math/format';
import type { GridSpec } from '@/math/figure';
import { choose, piExpr, piTex, mistakePi, type Wrong } from './choice';

/**
 * 第5章「平面図形」のテンプレート(台本 05_circle_ruins.md の敵に対応)。
 *   g1.geo.angle     角度ガーゴイル   角の大きさ(図つき)
 *   g1.geo.symmetry  対称ミラー       線対称・点対称な図形と 対称移動(選択式)
 *   g1.geo.sector    おうぎ形の門番   中心角と 弧・面積の 割合、弧の長さ・面積・中心角(π を含む式入力)
 *   g1.geo.construct 作図ゴースト     基本の作図(何の作図か・線の上の点の性質・組み合わせ。選択式)
 *   g1.geo.move      (ボス)           方眼の図で 平行移動・回転移動・対称移動、記号と用語(選択式)
 *
 * 教科書 5 章の 本文(2026-10-16。refs/prints/5章_honbun-features.md)に 合わせた。
 * 1 年の 教科書の 角は「一直線は 180°」「角の二等分線は 半分」「回転の 角」「90° を 重ねた 角」「作図できる 角(75° = 45° + 30°)」。
 * 対頂角(2 年)・三角形の 内角の和(小学校)は 出さない。π を含む答えは式入力(`6π`・`5/3π`)で受ける
 */
const UNIT = '平面図形';

// ---------------------------------------------------------------- 角

function angleProblem(d: Difficulty, p: Pick<Problem, 'hint' | 'explanation' | 'tags' | 'key' | 'figure' | 'mistakes' | 'verify'> & { q: string; x: number }): Problem {
  return {
    templateId: 'g1.geo.angle',
    difficulty: d,
    // 問題文は「何度?」まで(先生の指摘 2026-10-18。答えの 欄は 数だけ 入る)
    prompt: text(p.q),
    promptText: p.q,
    answer: { kind: 'number', value: rat(p.x) },
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

/** 一直線上の角(小学校の ふり返り。章の問題の ∠ECF の 土台) */
function angleStraight(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    const a = rng.pick([30, 40, 45, 50, 60, 70, 80, 100, 110, 120, 130, 135, 140, 150]);
    const x = 180 - a;
    return angleProblem(d, {
      q: `3 点 A、O、B は 一直線上に ある。∠AOC = ${a}° のとき、∠BOC は 何度?`,
      x,
      hint: '一直線の 角は 180°',
      explanation: [text('A、O、B は 一直線だから ∠AOB = 180°'), `\\angle BOC = 180^\\circ - ${a}^\\circ = ${x}^\\circ`, `${text('答え: ')} ${x}`],
      tags: ['angle_straight'],
      key: `ang:st:${a}`,
      figure: { kind: 'angles', rays: [180, 180 - a, 0], rayLabels: ['A', 'C', 'B'], center: 'O', marks: [{ from: 0, to: 1, label: `${a}°` }, { from: 1, to: 2, label: 'x' }] },
      mistakes: [mistakeNum(a, '∠AOC と ∠BOC は 同じ 大きさとは かぎらないよ。一直線の 180° から ひこう'), mistakeNum(360 - a, '一直線の 角は 360° では なく 180° だよ')],
      verify: `180-${a}`,
    });
  }
  // ★2: 3 つの 角が 一直線に 並ぶ(2 つが わかっている)
  const a = rng.pick([20, 30, 35, 40, 45, 50, 60, 70]);
  const b = rng.pick([25, 30, 40, 50, 55, 60, 75, 80]);
  const x = 180 - a - b;
  if (x < 20) return angleStraight(rng, d);
  return angleProblem(d, {
    q: `3 点 A、O、B は 一直線上に ある。∠AOC = ${a}°、∠DOB = ${b}° のとき、∠COD は 何度?`,
    x,
    hint: '一直線の 角 180° から、わかっている 角を ひく',
    explanation: [text('A、O、B は 一直線だから ∠AOB = 180°'), `\\angle COD = 180^\\circ - ${a}^\\circ - ${b}^\\circ = ${x}^\\circ`, `${text('答え: ')} ${x}`],
    tags: ['angle_straight'],
    key: `ang:st2:${a}:${b}`,
    figure: {
      kind: 'angles',
      rays: [180, 180 - a, b, 0],
      rayLabels: ['A', 'C', 'D', 'B'],
      center: 'O',
      marks: [
        { from: 0, to: 1, label: `${a}°` },
        { from: 1, to: 2, label: 'x' },
        { from: 2, to: 3, label: `${b}°` },
      ],
    },
    mistakes: [mistakeNum(180 - a, `∠DOB の ${b}° も ひこう`), mistakeNum(180 - b, `∠AOC の ${a}° も ひこう`), mistakeNum(a + b, 'たすのでは なく、180° から ひくよ')],
    verify: `180-${a}-${b}`,
  });
}

/** 角の二等分線(∠AOE = ∠BOE = ½∠AOB) */
function angleBisector(rng: Rng, d: Difficulty): Problem {
  const whole = rng.pick(d === 1 ? [60, 80, 90, 100, 120, 140, 160] : [50, 70, 110, 130, 150, 170]);
  const half = whole / 2;
  // ★2 は 半分の 角から もとの 角を 求める(逆向き)
  if (d >= 2 && rng.bool()) {
    return angleProblem(d, {
      q: `半直線 OE は ∠AOB の 二等分線で、∠AOE = ${half}° のとき、∠AOB は 何度?`,
      x: whole,
      hint: '二等分線は 角を ちょうど 半分に 分ける',
      explanation: [text('OE は ∠AOB の 二等分線だから ∠AOE = ½∠AOB'), `\\angle AOB = ${half}^\\circ \\times 2 = ${whole}^\\circ`, `${text('答え: ')} ${whole}`],
      tags: ['angle_bisector'],
      key: `ang:bis2:${whole}`,
      figure: { kind: 'angles', rays: [0, half, whole], rayLabels: ['A', 'E', 'B'], center: 'O', marks: [{ from: 0, to: 1, label: `${half}°` }, { from: 0, to: 2, label: 'x' }] },
      mistakes: [mistakeNum(half, 'その 角は ∠AOE。∠AOB は その 2 倍だよ'), mistakeNum(whole / 4, '二等分線の 角は もとの 角の 半分。もとの 角は 2 倍だよ')],
      verify: `${half}*2`,
    });
  }
  return angleProblem(d, {
    q: `半直線 OE は ∠AOB の 二等分線で、∠AOB = ${whole}° のとき、∠AOE は 何度?`,
    x: half,
    hint: '二等分線は 角を ちょうど 半分に 分ける',
    explanation: [text('OE は ∠AOB の 二等分線だから ∠AOE = ∠BOE = ½∠AOB'), `\\angle AOE = ${whole}^\\circ \\div 2 = ${half}^\\circ`, `${text('答え: ')} ${half}`],
    tags: ['angle_bisector'],
    key: `ang:bis:${whole}`,
    figure: { kind: 'angles', rays: [0, half, whole], rayLabels: ['A', 'E', 'B'], center: 'O', marks: [{ from: 0, to: 2, label: `${whole}°` }, { from: 0, to: 1, label: 'x' }] },
    mistakes: [mistakeNum(whole, '二等分線は 角を 半分に 分ける線。半分に しよう'), mistakeNum(whole * 2, '二等分は 2 倍では なく 半分だよ'), mistakeNum(180 - whole, '一直線の 角では ないよ。∠AOB を 半分に しよう')],
    verify: `${whole}/2`,
  });
}

/** 回転移動の 角(正六角形を 6 つの 合同な 正三角形に 分けた 図。章の問題 A) */
function angleRotation(rng: Rng, d: Difficulty): Problem {
  const names = ['A', 'B', 'C', 'D', 'E', 'F'];
  // 反時計回りに 60°〜180°(300° のように 大きく 回る 問題は 出さない)
  const k = rng.int(1, 3);
  const s = rng.int(0, 5);
  const from = `△O${names[s]}${names[(s + 1) % 6]}`;
  const to = `△O${names[(s + k) % 6]}${names[(s + k + 1) % 6]}`;
  const x = 60 * k;
  return angleProblem(d, {
    q: `正六角形 ABCDEF を、中心 O と 頂点を 結んで 6 つの 合同な 正三角形に 分けた。${from} を、点 O を 中心に 反時計回りに 回転移動して ${to} に 重ねる。何度 回転させる?`,
    x,
    hint: '正三角形 1 つぶんの 角は 60°。いくつぶん 回るかを 数えよう',
    explanation: [text('正三角形の 1 つの 角は 60° だから、1 つ となりへ 回すと 60°'), text(`${from} から ${to} までは 正三角形 ${k} つぶん`), `60^\\circ \\times ${k} = ${x}^\\circ`, `${text('答え: ')} ${x}`],
    tags: ['angle_rotation'],
    key: `ang:rot:${s}:${k}`,
    figure: { kind: 'angles', rays: [0, 60, 120, 180, 240, 300], throughLines: false, outline: true, rayLabels: names, center: 'O', marks: [] },
    mistakes: [mistakeNum(360 - x, '反時計回り(時計の 針と 反対)に 回すよ。その 角は 時計回りの 角'), mistakeNum(k, '何こ 分では なく、何度 回すかを 答えよう(1 つ分は 60°)'), mistakeNum(60 * (k + 1), '重なる 三角形の 数え方を 確かめよう')],
    verify: `60*${k}`,
  });
}

/** 90° を 重ねた 角(∠AOB = ∠COD = 90° なら ∠AOC = ∠BOD。章の問題 B) */
function angleRight(rng: Rng, d: Difficulty): Problem {
  const b = rng.pick([20, 25, 30, 35, 40, 50, 55, 60, 65, 70]);
  const c = 90 - b;
  const askBOD = rng.bool();
  return angleProblem(d, {
    q: `∠AOB = ∠COD = 90°、∠BOC = ${b}° のとき、${askBOD ? '∠BOD' : '∠AOC'} は 何度?`,
    x: c,
    hint: '90° の 角から、重なっている ∠BOC を ひく',
    explanation: [askBOD ? text('∠BOD = ∠COD − ∠BOC') : text('∠AOC = ∠AOB − ∠BOC'), `90^\\circ - ${b}^\\circ = ${c}^\\circ`, text('(∠AOC と ∠BOD は 等しい)'), `${text('答え: ')} ${c}`],
    tags: ['angle_right'],
    key: `ang:rt:${b}:${askBOD}`,
    figure: { kind: 'angles', rays: [0, c, 90, c + 90], rayLabels: ['A', 'C', 'B', 'D'], center: 'O', marks: [{ from: 1, to: 2, label: `${b}°` }, askBOD ? { from: 2, to: 3, label: 'x' } : { from: 0, to: 1, label: 'x' }] },
    mistakes: [mistakeNum(b, `∠BOC = ${b}° と 同じでは ないよ。90° から ひこう`), mistakeNum(90 + b, '90° に たすのでは なく、重なりの ∠BOC を ひくよ'), mistakeNum(180 - b, '一直線では なく 90° から ひこう')],
    verify: `90-${b}`,
  });
}

/** 一直線上の 2 つの 角の 二等分線(章の問題 A: ∠ECF は 何度) */
function angleTwoBisectors(rng: Rng, d: Difficulty): Problem {
  const a = rng.pick([40, 50, 60, 70, 80, 100, 110, 120, 130, 140]);
  const ask = rng.pick(['ECF', 'DCF', 'ECD'] as const);
  const b = 180 - a;
  const x = ask === 'ECF' ? 90 : ask === 'DCF' ? b / 2 : a / 2;
  const mistakes: Mistake[] =
    ask === 'ECF'
      ? [mistakeNum(a, '∠ECF は ∠ECD と ∠DCF を 合わせた 角。それぞれ 半分ずつ だよ'), mistakeNum(180, '∠ACB(180°)の 半分ずつを 合わせるから 90°'), mistakeNum(a / 2, '∠DCF(∠BCD の 半分)も 合わせよう')]
      : ask === 'DCF'
        ? [mistakeNum(b, '二等分線 CF は ∠BCD を 半分に 分けるよ'), mistakeNum(a / 2, 'それは ∠ECD。∠BCD = 180° − ∠ACD を 半分に しよう')]
        : [mistakeNum(a, '二等分線 CE は ∠ACD を 半分に 分けるよ'), mistakeNum(b / 2, 'それは ∠DCF。∠ACD を 半分に しよう')];
  return angleProblem(d, {
    q: `直線 AB 上の 点 C から 半直線 CD を ひいた。∠ACD = ${a}° で、CE は ∠ACD の、CF は ∠BCD の 二等分線。∠${ask} は 何度?`,
    x,
    hint: '∠ACD + ∠BCD = 180°。二等分線で それぞれ 半分',
    explanation: [
      `\\angle BCD = 180^\\circ - ${a}^\\circ = ${b}^\\circ`,
      ask === 'DCF' ? `\\angle DCF = ${b}^\\circ \\div 2 = ${x}^\\circ` : ask === 'ECD' ? `\\angle ECD = ${a}^\\circ \\div 2 = ${x}^\\circ` : `\\angle ECF = ${a}^\\circ \\div 2 + ${b}^\\circ \\div 2 = ${a / 2}^\\circ + ${b / 2}^\\circ = 90^\\circ`,
      ...(ask === 'ECF' ? [text('(∠ACD が 何度でも、180° の 半分で 90°)')] : []),
      `${text('答え: ')} ${x}`,
    ],
    tags: ['angle_two_bisectors'],
    key: `ang:2bis:${a}:${ask}`,
    figure: {
      kind: 'angles',
      rays: [180, 180 - a / 2, 180 - a, b / 2, 0],
      rayLabels: ['A', 'E', 'D', 'F', 'B'],
      center: 'C',
      marks:
        ask === 'ECF'
          ? [{ from: 0, to: 2, label: `${a}°` }, { from: 1, to: 3, label: 'x' }]
          : ask === 'DCF'
            ? [{ from: 0, to: 2, label: `${a}°` }, { from: 2, to: 3, label: 'x' }]
            : [{ from: 0, to: 2, label: `${a}°` }, { from: 1, to: 2, label: 'x' }],
    },
    mistakes,
    verify: `${x}`,
  });
}

/** 作図できる 角(90°・60° を もとに。75° = 45° + 30°) */
function angleConstructible(rng: Rng, d: Difficulty): Problem {
  const recipes: { q: string; x: number; steps: string; wrong: { v: number; say: string }[] }[] = [
    { q: '90° の 角を 二等分した 角と、60° の 角を 二等分した 角を 合わせる', x: 75, steps: '90^\\circ \\div 2 + 60^\\circ \\div 2 = 45^\\circ + 30^\\circ = 75^\\circ', wrong: [{ v: 150, say: '二等分(半分)に してから 合わせよう' }, { v: 105, say: '60° も 二等分して 30° に しよう' }, { v: 120, say: '90° も 二等分して 45° に しよう' }] },
    { q: '60° の 角から、90° の 角を 二等分した 角を ひく', x: 15, steps: '60^\\circ - 90^\\circ \\div 2 = 60^\\circ - 45^\\circ = 15^\\circ', wrong: [{ v: 30, say: '90° を 二等分すると 45° だよ' }, { v: 105, say: 'たすのでは なく ひくよ' }] },
    { q: '60° の 角に、90° の 角を 二等分した 角を 合わせる', x: 105, steps: '60^\\circ + 90^\\circ \\div 2 = 60^\\circ + 45^\\circ = 105^\\circ', wrong: [{ v: 150, say: '90° を 二等分して 45° に してから 合わせよう' }, { v: 15, say: '合わせる(たす)よ' }] },
    { q: '90° の 角に、90° の 角を 二等分した 角を 合わせる', x: 135, steps: '90^\\circ + 90^\\circ \\div 2 = 90^\\circ + 45^\\circ = 135^\\circ', wrong: [{ v: 180, say: '1 つは 二等分して 45° に しよう' }, { v: 45, say: '合わせる(たす)よ' }] },
    { q: '90° の 角に、60° の 角を 合わせる', x: 150, steps: '90^\\circ + 60^\\circ = 150^\\circ', wrong: [{ v: 30, say: '合わせる(たす)よ' }, { v: 75, say: '二等分は しないよ' }] },
    { q: '一直線(180°)から、60° の 角を 二等分した 角を ひいて、その 角を 二等分する', x: 75, steps: '(180^\\circ - 60^\\circ \\div 2) \\div 2 = (180^\\circ - 30^\\circ) \\div 2 = 75^\\circ', wrong: [{ v: 150, say: '最後に 二等分するのを わすれずに' }, { v: 60, say: '60° を 二等分して 30° に してから ひこう' }] },
    { q: '60° の 角を 二等分した 角を、さらに 二等分する', x: 15, steps: '60^\\circ \\div 2 \\div 2 = 15^\\circ', wrong: [{ v: 30, say: 'もう 1 回 二等分するよ' }, { v: 120, say: '二等分は 半分に すること' }] },
    { q: '一直線(180°)から、60° の 角を ひく', x: 120, steps: '180^\\circ - 60^\\circ = 120^\\circ', wrong: [{ v: 240, say: 'たすのでは なく ひくよ' }, { v: 60, say: '一直線は 180° だよ' }] },
  ];
  const r = rng.pick(d === 2 ? recipes.filter((r) => Number.isInteger(r.x) && r.x !== 105) : recipes);
  return angleProblem(d, {
    q: `次の ように 作図した 角は 何度?: ${r.q}`,
    x: r.x,
    hint: '90° と 60° は 作図できる。二等分は 半分',
    explanation: [r.steps, `${text('答え: ')} ${r.x}`],
    tags: ['angle_construct'],
    key: `ang:con:${r.q}`,
    mistakes: r.wrong.map((w) => mistakeNum(w.v, w.say)),
    verify: `${r.x}`,
  });
}

function genAngle(rng: Rng, d: Difficulty): Problem {
  // ★1: 一直線・二等分線 / ★2: 3 つの 角が 一直線・二等分線(逆)・90° を 重ねた 角・回転の 角 /
  // ★3: 2 つの 二等分線(章の問題 A)・作図できる 角(75°)・回転の 角
  if (d === 1) return rng.pick([angleStraight, angleBisector])(rng, d);
  if (d === 2) return rng.pick([angleStraight, angleBisector, angleRight, angleRotation, angleConstructible])(rng, d);
  return rng.pick([angleTwoBisectors, angleTwoBisectors, angleConstructible, angleRotation, angleRight])(rng, d);
}

// ---------------------------------------------------------------- 対称

const SHAPES: { name: string; line: boolean; point: boolean; axes: number; why?: string }[] = [
  { name: '正方形', line: true, point: true, axes: 4 },
  { name: '長方形', line: true, point: true, axes: 2 },
  { name: '正三角形', line: true, point: false, axes: 3, why: '正三角形は 180° 回すと 向きが 逆さに なって 重ならない' },
  { name: '二等辺三角形', line: true, point: false, axes: 1, why: '二等辺三角形は 180° 回すと 重ならない' },
  { name: '平行四辺形', line: false, point: true, axes: 0, why: '平行四辺形は 折っても 重ならない(ひし形・長方形は べつ)。180° 回すと 重なる' },
  { name: 'ひし形', line: true, point: true, axes: 2 },
  { name: '正五角形', line: true, point: false, axes: 5, why: '頂点が 奇数こ の 正多角形は 180° 回すと 重ならない' },
  { name: '正六角形', line: true, point: true, axes: 6 },
  { name: '正八角形', line: true, point: true, axes: 8 },
  { name: '台形(等脚台形)', line: true, point: false, axes: 1, why: '等脚台形は 180° 回すと 上下が 逆に なる' },
  { name: '円', line: true, point: true, axes: Infinity },
];

function genSymmetry(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    // 小学校の ふり返り: 線対称か・点対称か(はい・いいえ)
    const s = rng.pick(SHAPES);
    const askLine = rng.bool();
    const yes = askLine ? s.line : s.point;
    const kindName = askLine ? '線対称' : '点対称';
    const say = s.why ?? (askLine ? `${s.name}は 折り目で ぴったり 重なる` : `${s.name}は 中心で 180° 回すと 重なる`);
    // はい・いいえ の 順は いつも 同じに(選択肢を 毎回 読み直さなくて よいように)
    const options = [text('はい'), text('いいえ')];
    const answer = { kind: 'choice' as const, options, correct: yes ? 0 : 1 };
    const mistakes: Mistake[] = [{ answer: { kind: 'choice', options, correct: yes ? 1 : 0 }, say }];
    return {
      templateId: 'g1.geo.symmetry',
      difficulty: d,
      prompt: text(`${s.name}は ${kindName}な 図形ですか?`),
      promptText: `${s.name}は ${kindName}な図形ですか?`,
      answer,
      hint: askLine ? '1 本の 直線を 折り目に して 折ると、ぴったり 重なるか' : '1 つの 点を 中心に 180° 回すと、もとの 図形に 重なるか',
      explanation: [text(`${s.name}は ${kindName}${yes ? 'である' : 'ではない'}`), ...(s.why && !yes ? [text(s.why)] : [])],
      tags: [askLine ? 'symmetry_line' : 'symmetry_point'],
      key: `sym:${s.name}:${askLine}`,
      mistakes,
      verify: String(yes ? 0 : 1),
    };
  }
  if (d === 2) {
    const kind = rng.pick(['axes', 'axes', 'center', 'isoAxis', 'both'] as const);
    if (kind === 'axes') {
      const s = rng.pick(SHAPES.filter((s) => Number.isFinite(s.axes) && s.axes > 0 && s.axes <= 8));
      const n = s.axes;
      const wrongs: Wrong[] = [
        { opt: `${n * 2} 本`, say: '対角線と 辺の 真ん中を 通る 線を、それぞれ 1 本ずつ 数えよう(同じ 線を 2 回 数えないように)' },
        { opt: `${Math.max(1, n - 1)} 本`, say: '折って 重なる 線を もう一度 さがそう' },
        { opt: `${n + 1} 本`, say: '折って 重なる 線を 1 本ずつ 確かめよう' },
        { opt: `${n + 2} 本` },
      ];
      if (s.name === '長方形' || s.name === 'ひし形') wrongs.unshift({ opt: '4 本', say: s.name === '長方形' ? '長方形の 対角線では 折っても 重ならないよ' : 'ひし形は 辺の 真ん中を 通る 線では 重ならないよ' });
      const { answer, mistakes } = choose(rng, `${n} 本`, wrongs);
      return {
        templateId: 'g1.geo.symmetry',
        difficulty: d,
        prompt: text(`${s.name}の 対称の軸は 何本?`),
        promptText: `${s.name}の対称の軸は何本?`,
        answer,
        hint: '折って ぴったり 重なる 直線を 1 本ずつ 数えよう',
        explanation: [text(`${s.name}の 対称の軸は ${n} 本`), ...(s.name.startsWith('正') ? [text('正多角形の 対称の軸は 頂点の 数と 同じ')] : [])],
        tags: ['symmetry_axes'],
        key: `sym2:axes:${s.name}`,
        mistakes,
        verify: String(answer.kind === 'choice' ? answer.correct : 0),
      };
    }
    if (kind === 'center') {
      const s = rng.pick(['平行四辺形', 'ひし形', '長方形', '正方形']);
      const { answer, mistakes } = choose(rng, '2 本の 対角線の 交点', [
        { opt: '1 つの 頂点', say: '頂点を 中心に 回すと、図形が 大きく 動いて しまうよ' },
        { opt: '1 本の 辺の 中点', say: '辺の 中点で 180° 回すと、図形が 外に はみ出すよ' },
        { opt: '対角線の 上なら どこでも よい', say: '回転の 中心は 1 つに 決まるよ' },
      ]);
      return {
        templateId: 'g1.geo.symmetry',
        difficulty: d,
        prompt: text(`${s}は、ある 点を 中心に 180° 回転移動すると もとの 図形に 重なる(点対称)。回転の 中心は どこ?`),
        promptText: `${s}は、ある点を中心に 180° 回転移動するともとの図形に重なる。回転の中心はどこ?`,
        answer,
        layout: 'prose',
        hint: '対応する 2 つの 頂点を 結ぶ 線分の 真ん中が 回転の 中心',
        explanation: [text('点対称な 図形では、対応する 点を 結ぶ 線分は 回転の 中心を 通り、そこで 2 等分される'), text(`${s}の 向かい合う 頂点を 結ぶ 線は 対角線。答え: 2 本の 対角線の 交点`)],
        tags: ['symmetry_center'],
        key: `sym2:center:${s}`,
        mistakes,
        verify: String(answer.kind === 'choice' ? answer.correct : 0),
      };
    }
    if (kind === 'isoAxis') {
      const { answer, mistakes } = choose(rng, '頂角の 二等分線(底辺の 垂直二等分線)', [
        { opt: '底辺', say: '底辺で 折ると、三角形が 下に 折り返されて 重ならないよ' },
        { opt: '等しい 辺の 1 つ', say: '辺で 折っても 重ならない。真ん中で 折ろう' },
        { opt: '底角の 二等分線', say: '頂角(等しい 辺に はさまれた 角)の 二等分線だよ' },
      ]);
      return {
        templateId: 'g1.geo.symmetry',
        difficulty: d,
        prompt: text('二等辺三角形は 線対称な 図形。対称の軸は どれ?'),
        promptText: '二等辺三角形は線対称な図形。対称の軸はどれ?',
        answer,
        layout: 'prose',
        hint: '2 つの 等しい 辺が 重なるように 折ってみよう',
        explanation: [text('等しい 2 辺が 重なるように 折ると、折り目は 頂角を 2 等分し、底辺を 垂直に 2 等分する')],
        tags: ['symmetry_iso_axis'],
        key: 'sym2:iso',
        mistakes,
        verify: String(answer.kind === 'choice' ? answer.correct : 0),
      };
    }
    // 線対称で 点対称でもある 図形を 選ぶ
    const both = SHAPES.filter((s) => s.line && s.point && s.name !== '円');
    const lineOnly = SHAPES.filter((s) => s.line && !s.point);
    const pointOnly = SHAPES.filter((s) => !s.line && s.point);
    const c = rng.pick(both);
    const { answer, mistakes } = choose(rng, c.name, [
      ...rng.shuffle(lineOnly).slice(0, 2).map((s) => ({ opt: s.name, say: s.why ?? `${s.name}は 線対称だけ` })),
      ...pointOnly.map((s) => ({ opt: s.name, say: s.why ?? `${s.name}は 点対称だけ` })),
    ]);
    return {
      templateId: 'g1.geo.symmetry',
      difficulty: d,
      prompt: text('線対称でも あり、点対称でも ある 図形は どれ?'),
      promptText: '線対称でもあり、点対称でもある図形はどれ?',
      answer,
      hint: '折って 重なるか、180° 回して 重なるか、両方 確かめよう',
      explanation: [text(`${c.name}は 折っても(線対称)、180° 回しても(点対称)重なる`)],
      tags: ['symmetry_both'],
      key: `sym2:both:${c.name}`,
      mistakes,
      verify: String(answer.kind === 'choice' ? answer.correct : 0),
    };
  }
  // ★3: 対称移動・回転移動の 性質(教科書の まとめ)
  const facts: { q: string; a: string; w: Wrong[]; tag: string }[] = [
    {
      q: '△ABC を 直線 ℓ を 対称の軸として 対称移動した。点 A と、対応する 点 A′ を 結ぶ 線分 AA′ と ℓ の 関係は?',
      a: 'ℓ は AA′ を 垂直に 2 等分する',
      w: [{ opt: 'ℓ と AA′ は 平行', say: '折り返すと、A と A′ は ℓ を はさんで 向かい合うよ' }, { opt: 'ℓ は AA′ を 2 等分するが 垂直とは かぎらない', say: '対称移動では いつも 垂直に 2 等分するよ' }, { opt: 'AA′ は ℓ 上に ある', say: 'AA′ は ℓ を 横切る 線分だよ' }],
      tag: 'symmetry_reflect',
    },
    {
      q: '△ABC を 点 O を 中心に 回転移動して △A′B′C′ に した。正しいのは?',
      a: 'OA = OA′、∠AOA′ = ∠BOB′',
      w: [{ opt: 'AA′ // BB′、AA′ = BB′', say: 'それは 平行移動の 性質だよ' }, { opt: 'O は AA′ の 中点', say: 'それは 180° の 回転(点対称移動)の ときだけ' }, { opt: 'OA と OA′ は 垂直', say: '90° 回した ときだけ 垂直。いつも 等しいのは 長さ' }],
      tag: 'symmetry_rotate',
    },
    {
      q: '点対称な 図形で、対応する 2 点を 結ぶ 線分は どうなる?',
      a: '対称の 中心を 通り、中心で 2 等分される',
      w: [{ opt: '対称の軸と 垂直に 交わる', say: '対称の軸は 線対称の ことば。点対称は 中心で 考えよう' }, { opt: 'どれも 平行に なる', say: 'それは 平行移動の 性質だよ' }, { opt: '中心を 通らない', say: '180° 回すと、対応する 点は 中心を はさんで 反対側に くるよ' }],
      tag: 'symmetry_point_prop',
    },
    {
      q: '正多角形の うち、点対称な ものは?',
      a: '頂点の 数が 偶数の 正多角形',
      w: [{ opt: 'すべての 正多角形', say: '正三角形・正五角形は 180° 回すと 重ならないよ' }, { opt: '頂点の 数が 奇数の 正多角形', say: '正三角形で 確かめてみよう。180° 回すと 逆さに なるよ' }, { opt: '正方形だけ', say: '正六角形・正八角形も 点対称だよ' }],
      tag: 'symmetry_polygon',
    },
    {
      q: '円は 線対称な 図形。対称の軸は どれ?',
      a: 'どの 直径も 対称の軸',
      w: [{ opt: '1 本の 直径だけ', say: '円は どの 向きに 直径を ひいても 折り目に なるよ' }, { opt: '2 本(縦と 横の 直径)', say: 'ななめの 直径でも ぴったり 重なるよ' }, { opt: '円には 対称の軸が ない', say: '直径で 折ると ぴったり 重なるよ' }],
      tag: 'symmetry_circle',
    },
    {
      q: '半径が 等しい 2 つの 円が 2 点 P、Q で 交わる。中心を A、B と する とき、正しいのは?',
      a: '直線 PQ は 線分 AB の 垂直二等分線',
      w: [{ opt: 'PQ // AB', say: '2 つの 円の 交点を 結ぶ 線は、中心を 結ぶ 線と 垂直に 交わるよ' }, { opt: 'PQ = AB', say: '長さが 等しいとは かぎらないよ' }, { opt: 'A は 線分 PQ の 中点', say: 'PQ の 中点は 2 つの 中心の 真ん中に あるよ' }],
      tag: 'symmetry_two_circles',
    },
    {
      q: '△ABC を 点 O を 中心に 回転移動した。点 A の 動いた あとは どんな 線?',
      a: 'O を 中心とする 円の 弧',
      w: [{ opt: '線分', say: '回転移動では O から いつも 同じ 距離で 動くよ' }, { opt: '半直線' }, { opt: '折れ線' }],
      tag: 'symmetry_rotate_path',
    },
    {
      q: '対称移動すると、図形の 向きは どうなる?',
      a: '裏返しに なる(頂点の 並ぶ 向きが 逆に なる)',
      w: [{ opt: '向きは 変わらない', say: 'それは 平行移動。折り返すと 裏返しに なるよ' }, { opt: '90° 回った 向きに なる', say: 'それは 回転移動' }, { opt: '大きさが 変わる', say: '移動では 形も 大きさも 変わらないよ' }],
      tag: 'symmetry_reflect_orient',
    },
    {
      q: '平行四辺形 ABCD を、対角線の 交点 O を 中心に 180° 回転移動すると、頂点 A は どこに 重なる?',
      a: '頂点 C',
      w: [{ opt: '頂点 B', say: '180° 回すと、O を はさんで 反対側の 頂点に 重なるよ' }, { opt: '頂点 D', say: '180° 回すと、O を はさんで 反対側の 頂点に 重なるよ' }, { opt: '頂点 A(動かない)' }],
      tag: 'symmetry_parallelogram',
    },
    {
      q: '長方形の 対称の軸は どれ?',
      a: '向かい合う 辺の 中点を 結ぶ 2 本の 直線',
      w: [{ opt: '2 本の 対角線', say: '長方形を 対角線で 折っても 重ならないよ(正方形なら 重なる)' }, { opt: '対角線と、辺の 中点を 結ぶ 線の 4 本', say: '対角線では 重ならないので 2 本' }, { opt: '1 本の 対角線' }],
      tag: 'symmetry_rect',
    },
    {
      q: 'ひし形の 対称の軸は どれ?',
      a: '2 本の 対角線',
      w: [{ opt: '向かい合う 辺の 中点を 結ぶ 2 本の 直線', say: 'それは 長方形の 対称の軸。ひし形は 対角線で 折ると 重なるよ' }, { opt: '対角線と、辺の 中点を 結ぶ 線の 4 本', say: 'ひし形は 辺の 中点を 結ぶ 線では 重ならないよ' }, { opt: '1 本の 対角線' }],
      tag: 'symmetry_rhombus',
    },
    {
      q: '正方形を、中心の まわりに 回転移動する。もとの 正方形に 重なる いちばん 小さい 角は?',
      a: '90°',
      w: [{ opt: '180°', say: '180° でも 重なるが、もっと 小さい 角でも 重なるよ' }, { opt: '45°', say: '45° 回すと 頂点が 辺の 真ん中に くるよ' }, { opt: '360°' }],
      tag: 'symmetry_rot_angle',
    },
    {
      q: '正六角形を、中心の まわりに 回転移動する。もとの 正六角形に 重なる いちばん 小さい 角は?',
      a: '60°',
      w: [{ opt: '120°', say: '120° でも 重なるが、もっと 小さい 角でも 重なるよ' }, { opt: '30°', say: '30° 回すと 頂点が 辺の 真ん中に くるよ' }, { opt: '180°' }],
      tag: 'symmetry_rot_angle',
    },
    {
      q: '半径が ちがう 2 つの 円が 交わっている。この 図形の 対称の軸は?',
      a: '2 つの 円の 中心を 通る 直線 1 本',
      w: [{ opt: '2 つの 交点を 通る 直線', say: '交点を 通る 直線で 重なるのは 半径が 等しい ときだけ' }, { opt: '2 本(中心を 通る 線と 交点を 通る 線)', say: '交点を 通る 線で 重なるのは 半径が 等しい ときだけ' }, { opt: '対称の軸は ない' }],
      tag: 'symmetry_two_circles',
    },
    {
      q: '正三角形の 対称の軸は どれ?',
      a: '各 頂点と 向かい合う 辺の 中点を 結ぶ 3 本の 直線',
      w: [{ opt: '3 つの 辺', say: '辺で 折ると 三角形が 外に 折り返されるよ' }, { opt: '1 本だけ(底辺の 垂直二等分線)', say: 'それは 二等辺三角形。正三角形は どの 頂点からでも 折れるよ' }, { opt: '6 本' }],
      tag: 'symmetry_equilateral',
    },
  ];
  const f = rng.pick(facts);
  const { answer, mistakes } = choose(rng, f.a, f.w);
  return {
    templateId: 'g1.geo.symmetry',
    difficulty: d,
    prompt: text(f.q),
    promptText: f.q,
    answer,
    layout: 'prose',
    hint: '紙を 折る・180° 回す ところを 頭の 中で やってみよう',
    explanation: [text(`答え: ${f.a}`)],
    tags: [f.tag],
    key: `sym3:${f.q}`,
    mistakes,
    verify: String(answer.kind === 'choice' ? answer.correct : 0),
  };
}

// ---------------------------------------------------------------- おうぎ形

/** 中心角 a° の 割合 a/360 */
const share = (a: number): Rational => rat(a, 360);

function sectorRatio(rng: Rng, d: Difficulty): Problem {
  // 教科書: 90°・180°・60°・150°・1° の 割合を 求める(問 1)
  const a = rng.pick([90, 180, 60, 120, 45, 30, 150, 270, 72]);
  const v = share(a);
  const askArc = rng.bool();
  const what = askArc ? '弧の長さ' : '面積';
  const whole = askArc ? '周の長さ' : '面積';
  return {
    templateId: 'g1.geo.sector',
    difficulty: d,
    prompt: text(`中心角が ${a}° の おうぎ形の ${what}は、半径が 等しい 円の ${whole}の 何倍?(分数で 答える)`),
    promptText: `中心角が ${a}° のおうぎ形の${what}は、半径が等しい円の${whole}の何倍?(分数で答える)`,
    answer: { kind: 'number', value: v },
    layout: 'prose',
    hint: '円の 中心角は 360°。おうぎ形は その 何分の いくつか',
    explanation: [text(`おうぎ形の ${what}は 中心角に 比例する`), `\\frac{${a}}{360} = ${toTex(v)}`, `${text('答え: ')} ${toTex(v)} ${text('倍')}`],
    tags: ['sector_ratio'],
    key: `sec:ratio:${a}:${askArc}`,
    figure: { kind: 'sector', radius: 6, angle: a, radiusLabel: 'r' },
    mistakes: [mistakeNum(rat(360, a), '360 ÷ 中心角 では なく、中心角 ÷ 360 だよ'), mistakeNum(rat(a, 180), '円 1 周の 中心角は 360° だよ'), mistakeNum(rat(a, 100), '100 では なく 360 で わろう')],
    verify: `${a}/360`,
  };
}

/** 弧の長さ・面積(π を 使う) */
function sectorArcArea(d: Difficulty, r: number, a: number, asArc: boolean): Problem {
  const v = asArc ? mul(rat(2 * r), share(a)) : mul(rat(r * r), share(a));
  const label = asArc ? '弧の長さ' : '面積';
  const mistakes: Mistake[] = asArc
    ? [
        mistakePi(mul(rat(r * r), share(a)), 'それは 面積の 式。弧の長さは 2πr × 中心角/360'),
        mistakePi(rat(2 * r), `円周 2π × ${r} の ${a}/360 倍に しよう`),
        mistakePi(mul(rat(r), share(a)), '円周は 2πr。2 を かけ わすれて いないかな'),
      ]
    : [
        mistakePi(mul(rat(2 * r), share(a)), 'それは 弧の長さの 式。面積は πr² × 中心角/360'),
        mistakePi(rat(r * r), `円の 面積 π × ${r}² の ${a}/360 倍に しよう`),
        mistakePi(mul(rat(r), share(a)), '半径を 2 乗しよう(r × r)'),
      ];
  return {
    templateId: 'g1.geo.sector',
    difficulty: d,
    prompt: text(`半径 ${r} cm、中心角 ${a}° の おうぎ形の ${label}は?(π を 使って 答える)`),
    promptText: `半径 ${r} cm、中心角 ${a}° のおうぎ形の${label}は?(π を使って答える)`,
    answer: { kind: 'expression', expected: piExpr(v) },
    layout: 'prose',
    hint: asArc ? `円周 2πr の ${a}/360 倍` : `円の 面積 πr² の ${a}/360 倍`,
    explanation: asArc
      ? [text('(弧の長さ)= 2πr × 中心角/360'), `2\\pi \\times ${r} = ${2 * r}\\pi`, `${2 * r}\\pi \\times \\frac{${a}}{360} = ${piTex(v)}`, `${text('答え: ')} ${piTex(v)} ${text('cm')}`]
      : [text('(面積)= πr² × 中心角/360'), `\\pi \\times ${r}^{2} = ${r * r}\\pi`, `${r * r}\\pi \\times \\frac{${a}}{360} = ${piTex(v)}`, `${text('答え: ')} ${piTex(v)} ${text('cm²')}`],
    tags: [asArc ? 'sector_arc' : 'sector_area'],
    key: `sec:${r}:${a}:${asArc}`,
    figure: { kind: 'sector', radius: r, angle: a, radiusLabel: `${r} cm` },
    mistakes,
    verify: asArc ? `(2*${r}*${a}/360)π` : `(${r}*${r}*${a}/360)π`,
  };
}

/** 弧の長さ・面積から 中心角 */
function sectorAngle(rng: Rng, d: Difficulty): Problem {
  const r = rng.pick([3, 4, 6, 8, 9, 10, 12]);
  const a = rng.pick([30, 40, 45, 60, 72, 80, 90, 100, 120, 135, 150, 160, 200, 240, 270]);
  const byArea = rng.bool();
  const v = byArea ? mul(rat(r * r), share(a)) : mul(rat(2 * r), share(a));
  if (!isInteger(v) && Number(v.d) > 4) return sectorAngle(rng, d);
  const whole = byArea ? r * r : 2 * r;
  const given = byArea ? `面積が ${toTexPlain(v)}π cm²` : `弧の長さが ${toTexPlain(v)}π cm`;
  return {
    templateId: 'g1.geo.sector',
    difficulty: d,
    prompt: text(`半径 ${r} cm の おうぎ形で、${given} のとき、中心角は 何度?(数だけ 答える)`),
    promptText: `半径 ${r} cm のおうぎ形で、${given} のとき、中心角は何度?`,
    answer: { kind: 'number', value: rat(a) },
    layout: 'prose',
    hint: byArea ? '円の 面積 πr² の 何分の いくつかを 考えて、360° に かける' : '円周 2πr の 何分の いくつかを 考えて、360° に かける',
    explanation: [
      byArea ? `${text('円の 面積: ')} \\pi \\times ${r}^{2} = ${whole}\\pi` : `${text('円周: ')} 2\\pi \\times ${r} = ${whole}\\pi`,
      `${text('割合: ')} ${piTex(v)} \\div ${whole}\\pi = ${toTex(mul(v, rat(1, whole)))}`,
      `360^\\circ \\times ${toTex(mul(v, rat(1, whole)))} = ${a}^\\circ`,
      `${text('答え: ')} ${a}`,
    ],
    tags: ['sector_angle'],
    key: `sec:ang:${r}:${a}:${byArea}`,
    figure: { kind: 'sector', radius: r, angle: null, radiusLabel: `${r} cm`, note: byArea ? `面積 ${toTexPlain(v)}π cm²` : `弧の長さ ${toTexPlain(v)}π cm` },
    mistakes: [
      ...(byArea ? [mistakeNum(mul(rat(360), mul(v, rat(1, 2 * r))), '面積は 円の 面積 πr² と くらべよう(円周と くらべない)')] : [mistakeNum(mul(rat(360), mul(v, rat(1, r * r))), '弧の長さは 円周 2πr と くらべよう(面積と くらべない)')]),
      mistakeNum(mul(rat(360), mul(v, rat(1, r))), byArea ? '半径を 2 乗した πr² と くらべよう' : '円周は 2πr。2 を かけ わすれて いないかな'),
    ],
    verify: `${a}`,
  };
}

/** 問題文に 書く 分数(5/3) */
const toTexPlain = (v: Rational): string => (isInteger(v) ? String(v.n) : `${v.n}/${v.d}`);

function genSector(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    // ★1: 割合(問 1)・弧の長さ(答えが 整数の π)
    if (rng.int(0, 2) === 0) return sectorRatio(rng, d);
    const r = rng.pick([3, 4, 6, 8, 12]);
    const a = rng.pick([30, 45, 60, 90, 120]);
    if (!isInteger(mul(rat(2 * r), share(a)))) return genSector(rng, d);
    return sectorArcArea(d, r, a, true);
  }
  if (d === 2) {
    // ★2: 教科書の 問 3(半径 4・45°、10・72°、6・240°、12・150°)の 範囲。答えは 整数の π
    if (rng.int(0, 4) === 0) return sectorRatio(rng, d);
    const r = rng.pick([4, 6, 8, 9, 10, 12]);
    const a = rng.pick([45, 60, 72, 90, 120, 135, 150, 240, 270]);
    const asArc = rng.bool();
    const v = asArc ? mul(rat(2 * r), share(a)) : mul(rat(r * r), share(a));
    if (!isInteger(v)) return genSector(rng, d);
    return sectorArcArea(d, r, a, asArc);
  }
  // ★3: 中心角を 求める / 答えが 分数の π(教科書の 例: 半径 6・50° → 5/3π)
  if (rng.bool()) return sectorAngle(rng, d);
  const r = rng.pick([3, 4, 5, 6, 8, 9, 10, 12]);
  const a = rng.pick([20, 40, 50, 80, 100, 135, 140, 160, 200, 210, 225, 300]);
  const asArc = rng.bool();
  const v = asArc ? mul(rat(2 * r), share(a)) : mul(rat(r * r), share(a));
  if (Number(v.d) > 9) return genSector(rng, d);
  return sectorArcArea(d, r, a, asArc);
}

// ---------------------------------------------------------------- 作図

interface Fact {
  q: string;
  a: string;
  w: Wrong[];
  tag: string;
}

/** ★1: 何の 作図か・用語 */
const CONSTRUCT_1: Fact[] = [
  { q: '線分の 中点を 通り、その 線分に 垂直な 直線を 何という?', a: '垂直二等分線', w: [{ opt: '角の二等分線', say: '角を 2 等分するのが 角の二等分線。線分を 2 等分して 垂直なのは …' }, { opt: '垂線', say: '垂線は 垂直な 線の こと。中点を 通る ことまで 言うと …' }, { opt: '接線' }], tag: 'construct_term' },
  { q: '1 つの 角を 2 等分する 半直線を 何という?', a: '角の二等分線', w: [{ opt: '垂直二等分線', say: '垂直二等分線は 線分を 2 等分する 直線だよ' }, { opt: '対称の軸' }, { opt: '中線' }], tag: 'construct_term' },
  { q: '2 直線が 垂直に 交わるとき、一方の 直線を 他方の 直線の 何という?', a: '垂線', w: [{ opt: '平行線', say: '平行線は 交わらない 2 直線だよ' }, { opt: '接線' }, { opt: '弦' }], tag: 'construct_term' },
  { q: '線分を 2 等分する 点を 何という?', a: '中点', w: [{ opt: '交点', say: '交点は 線が 交わる 点。2 等分する 点は …' }, { opt: '接点' }, { opt: '頂点' }], tag: 'construct_term' },
  { q: '作図で 使う 道具は?', a: '定規と コンパスだけ', w: [{ opt: '定規・コンパス・分度器', say: '作図では 分度器を 使わない。角は コンパスで つくるよ' }, { opt: '目もりの ある ものさしと 分度器', say: '作図では 長さも 角度も はからないよ' }, { opt: '三角定規 2 枚' }], tag: 'construct_term' },
  { q: '円周上の 2 点 A、B を 結ぶ 線分を 何という?', a: '弦 AB', w: [{ opt: '弧 AB', say: '弧は 円周の 一部(曲がった 線)。まっすぐ 結ぶ 線分は …' }, { opt: '直径' }, { opt: '半径' }], tag: 'construct_term' },
  { q: '円周の A から B までの 部分を 何という?', a: '弧 AB', w: [{ opt: '弦 AB', say: '弦は A と B を まっすぐ 結ぶ 線分。円周の 一部は …' }, { opt: '中心角' }, { opt: 'おうぎ形' }], tag: 'construct_term' },
  { q: '直線が 円と 1 点だけで 出あうとき、その 直線を 何という?', a: '円の 接線', w: [{ opt: '弦', say: '弦は 円周上の 2 点を 結ぶ 線分だよ' }, { opt: '垂線' }, { opt: '直径' }], tag: 'construct_term' },
  { q: '中心が O である 円を 何という?', a: '円 O', w: [{ opt: '弧 O', say: '弧は 円周の 一部。中心が O の 円は …' }, { opt: '点 O', say: '点 O は 中心。円全体の よび方は …' }, { opt: '弦 O' }], tag: 'construct_term' },
  { q: '作図で 定規は 何のために 使う?', a: '直線を ひくため(長さは はからない)', w: [{ opt: '長さを はかるため', say: '作図では 目もりを 使わない。長さを うつすのは コンパス' }, { opt: '円を かくため', say: '円を かくのは コンパスだよ' }, { opt: '角度を はかるため' }], tag: 'construct_term' },
  { q: '作図で コンパスは 何のために 使う?', a: '円を かいたり、等しい 長さを うつしたり するため', w: [{ opt: '直線を ひくため', say: '直線は 定規で ひくよ' }, { opt: '角度を はかるため', say: '角度は はからない。コンパスで 円を かくよ' }, { opt: '目もりで 長さを 読むため' }], tag: 'construct_term' },
  { q: '円と 接線が 接する 点を 何という?', a: '接点', w: [{ opt: '中点', say: '中点は 線分を 2 等分する 点' }, { opt: '交点' }, { opt: '中心' }], tag: 'construct_term' },
  { q: '2 点 A、B を 通る 直線は 何本 ひける?', a: '1 本だけ', w: [{ opt: '2 本', say: '2 点を 通る 直線は 1 本に 決まるよ' }, { opt: '何本でも', say: '1 点を 通る 直線なら 何本でも。2 点なら …' }, { opt: '0 本' }], tag: 'construct_term' },
  { q: '2 点 A、B 間の 距離とは?', a: '線分 AB の 長さ', w: [{ opt: '直線 AB の 長さ', say: '直線は かぎりなく のびるので 長さは 決まらないよ' }, { opt: 'A から B まで 曲がって 行く 道の 長さ', say: '2 点を 結ぶ 線の うち いちばん 短い 線分の 長さ' }, { opt: '半直線 AB の 長さ' }], tag: 'construct_term' },
  { q: '∠AOB の 頂点は どれ?', a: '点 O', w: [{ opt: '点 A', say: '∠AOB は 真ん中の 文字が 頂点だよ' }, { opt: '点 B', say: '∠AOB は 真ん中の 文字が 頂点だよ' }, { opt: '線分 AB' }], tag: 'construct_term' },
  { q: '線分 AB の 垂直二等分線は、AB に 対して どんな 線?', a: '線分 AB の 対称の軸', w: [{ opt: 'AB と 平行な 線', say: '垂直二等分線は AB と 垂直に 交わるよ' }, { opt: 'AB を 3 等分する 線' }, { opt: 'A を 通る 線', say: 'A と B の 真ん中(中点)を 通るよ' }], tag: 'construct_term' },
];

/** ★2: 線の 上の 点の 性質・基本の 角 */
const CONSTRUCT_2: Fact[] = [
  { q: '線分 AB の 垂直二等分線 上の 点 P について、正しいのは?', a: 'PA = PB', w: [{ opt: 'PA と PB は 垂直', say: '垂直なのは 垂直二等分線と AB。P は A と B から 等しい 距離に あるよ' }, { opt: 'P は いつも AB の 中点', say: '中点は 垂直二等分線上の 1 点だけ。どの 点でも 言えるのは …' }, { opt: 'PA = AB' }], tag: 'construct_prop' },
  { q: '∠AOB の 二等分線 上の 点 P について、正しいのは?', a: 'P から 辺 OA、OB までの 距離は 等しい', w: [{ opt: 'PO = PA', say: '等しいのは 2 つの 辺までの 距離(垂線の 長さ)だよ' }, { opt: 'P は O から 等しい 距離に ある', say: 'O からの 距離では なく、2 辺までの 距離が 等しい' }, { opt: 'P から A、B までの 距離が 等しい', say: 'それは 垂直二等分線の 性質だよ' }], tag: 'construct_prop' },
  { q: '2 点 A、B から 等しい 距離に ある 点は、どこに ある?', a: '線分 AB の 垂直二等分線上', w: [{ opt: '∠A の 二等分線上', say: '2 点からの 距離は 垂直二等分線、2 辺からの 距離は 角の二等分線' }, { opt: '線分 AB 上だけ', say: 'AB の 外にも たくさん あるよ。折り目の 線を 思い出そう' }, { opt: 'A を 中心とする 円の 上' }], tag: 'construct_prop' },
  { q: '角の 内部で、その 角の 2 辺から 等しい 距離に ある 点は、どこに ある?', a: 'その 角の 二等分線上', w: [{ opt: '2 辺の 垂直二等分線上', say: '2 辺からの 距離は 角の二等分線だよ' }, { opt: '角の 頂点を 中心とする 円の 上', say: '頂点からの 距離が 等しい 点の 集まりは 円。2 辺からの 距離は …' }, { opt: 'どこにも ない' }], tag: 'construct_prop' },
  { q: '円の 接線と、接点を 通る 半径の 関係は?', a: '垂直に 交わる', w: [{ opt: '平行', say: '接線は 接点で 半径と 90° に 交わるよ' }, { opt: '45° で 交わる' }, { opt: '重なる' }], tag: 'construct_prop' },
  { q: '点 P と 直線 ℓ との 距離とは?', a: 'P から ℓ に ひいた 垂線の 長さ', w: [{ opt: 'P と ℓ 上の どの 点までの 長さでも よい', say: 'ℓ 上の 点までの 長さは いろいろ。もっとも 短い 垂線の 長さが 距離だよ' }, { opt: 'P と ℓ の はしまでの 長さ', say: '直線には はしが ないよ' }, { opt: 'ℓ に 平行に はかった 長さ' }], tag: 'construct_prop' },
  { q: '線分 AB の 中点を 作図で 求めるには?', a: 'AB の 垂直二等分線と AB の 交点を とる', w: [{ opt: 'ものさしで はかって 半分の 位置に 印を つける', say: '作図では 目もりを 使わない。垂直二等分線を 使うよ' }, { opt: 'A を 中心に AB を 半径と する 円を かく' }, { opt: '∠A の 二等分線を ひく', say: '角の二等分線では 線分の 真ん中は 出ないよ' }], tag: 'construct_prop' },
  { q: '60° の 角を 作図するには?', a: '正三角形を 作図して 1 つの 角を 使う', w: [{ opt: '直角を 3 等分する', say: '作図で 角を 3 等分は できないよ。正三角形の 角は 60°' }, { opt: '分度器で はかる', say: '作図では 分度器を 使わないよ' }, { opt: '直角を 二等分する', say: '直角の 二等分は 45° だよ' }], tag: 'construct_angle' },
  { q: '45° の 角を 作図するには?', a: '垂線で 90° を つくり、二等分する', w: [{ opt: '正三角形の 角を 二等分する', say: '正三角形の 角(60°)の 二等分は 30° だよ' }, { opt: '90° から 60° を ひく', say: '90° − 60° = 30° だよ' }, { opt: '分度器で はかる' }], tag: 'construct_angle' },
  { q: '30° の 角を 作図するには?', a: '正三角形の 角(60°)を 二等分する', w: [{ opt: '90° を 二等分する', say: '90° の 二等分は 45° だよ' }, { opt: '60° を 3 等分する' }, { opt: '分度器で はかる' }], tag: 'construct_angle' },
  { q: '直線 AB 上の 点 O を 通る、AB の 垂線を 作図するには?', a: '一直線の 角 ∠AOB(180°)の 二等分線を ひく', w: [{ opt: 'O を 中心とする 円を 1 つ かく だけ', say: '円を かいた あと、交点から 二等分線を ひくよ' }, { opt: 'AB の 垂直二等分線を ひく', say: 'O が AB の 中点とは かぎらないよ' }, { opt: 'O から 平行線を ひく' }], tag: 'construct_prop' },
  { q: '平行な 2 直線 ℓ、m の 距離とは?', a: 'ℓ 上の 点から m に ひいた 垂線の 長さ', w: [{ opt: 'ℓ 上の 点と m 上の 点を 結ぶ どの 線分の 長さでも よい', say: 'ななめの 線分は 長く なるよ。垂線の 長さで はかる' }, { opt: 'ℓ の 長さ' }, { opt: '決まらない', say: 'ℓ 上の どこから はかっても 同じ 長さ(一定)に なるよ' }], tag: 'construct_prop' },
  { q: '直線 ℓ 上に ない 点 P と、ℓ 上の 点を 結ぶ 線分の うち、もっとも 短いのは?', a: 'P から ℓ に ひいた 垂線', w: [{ opt: 'ℓ と 45° に 交わる 線分', say: 'ななめの 線分は 垂線より 長く なるよ' }, { opt: 'どれも 同じ 長さ' }, { opt: 'ℓ と 平行な 線分', say: '平行な 線は ℓ と 交わらないよ' }], tag: 'construct_prop' },
  { q: '中心 A、B の 2 つの 円が 2 点 P、Q で 交わる。直線 AB と 直線 PQ の 関係は?', a: 'AB ⊥ PQ', w: [{ opt: 'AB // PQ', say: '2 つの 円の 交点を 結ぶ 線は、中心を 結ぶ 線と 垂直だよ' }, { opt: 'AB = PQ' }, { opt: '関係は ない' }], tag: 'construct_prop' },
  { q: '線分 AB の 垂直二等分線を 作図するとき、A と B を 中心に かく 2 つの 円の 半径は?', a: '等しく する', w: [{ opt: 'A の 円を 大きく する', say: '半径が ちがうと、交点を 結ぶ 線は 中点を 通らないよ' }, { opt: 'どちらも AB の 半分に する', say: 'AB の 半分では 2 つの 円が 1 点でしか 出あわない。半分より 大きく' }, { opt: 'ちがう 長さに する' }], tag: 'construct_prop' },
  { q: '∠AOB の 二等分線の 作図で、O を 中心に 円を かいて 辺との 交点 C、D を とった。次に する ことは?', a: 'C、D を 中心に 等しい 半径の 円を かき、交点 E を とる', w: [{ opt: 'C と D を 結ぶ 線分を ひく', say: 'まだ 手順が いるよ。C、D から 等しい 半径の 円を かこう' }, { opt: 'O を 中心に もう 1 つ 円を かく' }, { opt: '分度器で ∠AOB を はかる', say: '作図では 分度器を 使わないよ' }], tag: 'construct_prop' },
];

/** ★3: 組み合わせ・利用 */
const CONSTRUCT_3: Fact[] = [
  { q: '円の 一部(弧)だけが 残っている。もとの 円の 中心を 作図で 求めるには?', a: '弧の 上に 3 点を とり、2 本の 弦の 垂直二等分線の 交点を とる', w: [{ opt: '1 本の 弦の 中点を とる', say: '中心は 弦の 中点では なく、垂直二等分線の 上に あるよ。2 本で 1 点に 決まる' }, { opt: '弧の 両はしを 結ぶ 弦の 角の 二等分線を ひく' }, { opt: '弧の 両はしで 接線を ひく', say: '接線どうしの 交点は 中心では ないよ' }], tag: 'construct_use' },
  { q: '3 つの 地点 P、Q、R から 等しい 距離に ある 地点を 作図で 求めるには?', a: 'PQ と QR の 垂直二等分線の 交点', w: [{ opt: '∠PQR の 二等分線と PR の 交点', say: '2 点からの 距離が 等しいのは 垂直二等分線。2 本 使おう' }, { opt: 'PQ の 中点', say: 'PQ の 中点は R からの 距離が ちがうよ' }, { opt: '3 つの 角の 二等分線の 交点', say: 'それは 3 つの 辺からの 距離が 等しい 点だよ' }], tag: 'construct_use' },
  { q: '2 つの 地点 P、Q に AED が ある。どちらの AED が 近いかで 地図を 2 つに 分ける 線は?', a: '線分 PQ の 垂直二等分線', w: [{ opt: '線分 PQ', say: 'PQ の 上でも、P に 近い 所と Q に 近い 所が あるよ' }, { opt: 'P を 中心とする 円', say: '境目は P と Q から 等しい 距離の 点の 集まり' }, { opt: '∠P の 二等分線' }], tag: 'construct_use' },
  { q: '線分 AB と、半直線 AC、BD がある。AC、AB、BD までの 距離が 等しい 点 P を 求めるには?', a: '∠CAB の 二等分線と ∠ABD の 二等分線の 交点', w: [{ opt: 'AB の 垂直二等分線と AC の 交点', say: '2 つの 線までの 距離は 角の二等分線。2 本 使おう' }, { opt: 'A と B から 等しい 距離の 点', say: '点からの 距離では なく、直線までの 距離だよ' }, { opt: 'AB の 中点' }], tag: 'construct_use' },
  { q: '円 O の 周上の 点 A を 通る 接線を 作図するには?', a: '直線 OA を ひき、A を 通る OA の 垂線を ひく', w: [{ opt: 'OA の 垂直二等分線を ひく', say: '垂直二等分線は OA の 中点を 通る。接線は A を 通るよ' }, { opt: '∠OA の 二等分線を ひく' }, { opt: 'A を 中心に 半径 OA の 円を かく' }], tag: 'construct_use' },
  { q: '△ABC で、辺 BC を 底辺と したときの 高さを 作図するには?', a: '頂点 A から 直線 BC への 垂線を ひく', w: [{ opt: 'BC の 垂直二等分線を ひく', say: '垂直二等分線は A を 通るとは かぎらないよ' }, { opt: '∠A の 二等分線を ひく', say: '二等分線は BC に 垂直とは かぎらないよ' }, { opt: 'A と BC の 中点を 結ぶ' }], tag: 'construct_use' },
  { q: '75° の 角を 作図する 方法として 正しいのは?', a: '90° の 二等分(45°)と 60° の 二等分(30°)を 合わせる', w: [{ opt: '90° と 60° を 合わせて 二等分しない', say: '90° + 60° = 150° だよ' }, { opt: '60° に 90° の 二等分(45°)を 合わせる', say: '60° + 45° = 105° だよ' }, { opt: '60° から 90° の 二等分(45°)を ひく', say: '60° − 45° = 15° だよ' }], tag: 'construct_angle' },
  { q: '線分 AB を 1 辺と する 正方形を 作図するとき、まず 使う 作図は?', a: 'A を 通る AB の 垂線', w: [{ opt: 'AB の 垂直二等分線', say: '正方形の 辺は A から 垂直に 立てるよ。中点では ない' }, { opt: '∠A の 二等分線' }, { opt: '60° の 角' }], tag: 'construct_use' },
  { q: '直線 ℓ 上に あって、2 点 A、B から 等しい 距離に ある 点を 求めるには?', a: '線分 AB の 垂直二等分線と ℓ の 交点', w: [{ opt: '線分 AB の 中点', say: '中点は ℓ 上に あるとは かぎらないよ' }, { opt: 'A から ℓ への 垂線と ℓ の 交点', say: 'それは A に いちばん 近い 点。A と B から 等しい 点は …' }, { opt: 'A と B を 結ぶ 直線と ℓ の 交点' }], tag: 'construct_use' },
  { q: '∠AOB の 辺 OB 上の 点 C で OB に 接し、辺 OA にも 接する 円の 中心を 求めるには?', a: 'C を 通る OB の 垂線と、∠AOB の 二等分線の 交点', w: [{ opt: 'OC の 垂直二等分線と ∠AOB の 二等分線の 交点', say: '接線は 接点を 通る 半径に 垂直。C を 通る 垂線を ひこう' }, { opt: 'C を 通る OB の 垂線と OA の 交点', say: '中心は 2 つの 辺から 等しい 距離 → 角の二等分線の 上にも あるよ' }, { opt: 'O と C の 中点' }], tag: 'construct_use' },
  { q: '正方形 ABCD の 紙を、頂点 A が 辺 CD の 中点 M に 重なるように 折った。折り目の 線は?', a: '線分 AM の 垂直二等分線', w: [{ opt: '∠A の 二等分線', say: '2 つの 点が 重なる 折り目は、その 2 点を 結ぶ 線分の 対称の軸' }, { opt: '線分 AM', say: '折り目は AM と 垂直に 交わるよ' }, { opt: '対角線 AC' }], tag: 'construct_use' },
  { q: '点 P を、直線 ℓ を 対称の軸として 対称移動した 点 P′ を 作図するには?', a: 'P から ℓ への 垂線を ひき、ℓ を はさんで P と 等しい 距離に とる', w: [{ opt: 'P を 通る ℓ の 平行線の 上に とる', say: 'P と P′ を 結ぶ 線は ℓ と 垂直に 交わるよ' }, { opt: 'ℓ 上の 好きな 点を 中心に P を 180° 回す', say: 'それは 回転移動。対称移動は 折り返し' }, { opt: 'P から ℓ への 垂線と ℓ の 交点' }], tag: 'construct_use' },
  { q: '15° の 角を 作図する 方法として 正しいのは?', a: '60° と、90° の 二等分(45°)の 差を とる', w: [{ opt: '60° を 3 等分する', say: '作図で 3 等分は できないよ' }, { opt: '90° の 二等分(45°)と 60° を 合わせる', say: '合わせると 105° だよ' }, { opt: '60° を 二等分する', say: '60° の 二等分は 30° だよ' }], tag: 'construct_angle' },
  { q: '120° の 角を 作図する 方法として 正しいのは?', a: '一直線(180°)から 60° の 角を とった 残り', w: [{ opt: '90° と 45° を 合わせる', say: '90° + 45° = 135° だよ' }, { opt: '60° を 二等分して 合わせる', say: '60° + 30° = 90° だよ' }, { opt: '90° を 二等分する' }], tag: 'construct_angle' },
  { q: '車いすの 左の 車輪(線分と 考える)の 中点 P を 作図するには?', a: '車輪の 線分の 垂直二等分線を ひく', w: [{ opt: '車輪の 線分を ものさしで はかる', say: '作図では 目もりを 使わない。垂直二等分線で 中点が 出るよ' }, { opt: '車輪の はしを 中心に 円を 1 つ かく' }, { opt: '角の二等分線を ひく' }], tag: 'construct_use' },
];

function genConstruct(rng: Rng, d: Difficulty): Problem {
  const pool = d === 1 ? CONSTRUCT_1 : d === 2 ? CONSTRUCT_2 : CONSTRUCT_3;
  const c = rng.pick(pool);
  const { answer, mistakes } = choose(rng, c.a, c.w);
  return {
    templateId: 'g1.geo.construct',
    difficulty: d,
    prompt: text(c.q),
    promptText: c.q,
    answer,
    layout: 'prose',
    hint: d === 1 ? '作図の ことばを 思い出そう' : '2 点からの 距離は 垂直二等分線、2 辺からの 距離は 角の二等分線',
    explanation: [text(`答え: ${c.a}`), ...(c.tag === 'construct_prop' || c.tag === 'construct_use' ? [text('垂直二等分線は 線分の 対称の軸、角の二等分線は 角の 対称の軸')] : [])],
    tags: [c.tag],
    key: `con:${c.q}`,
    mistakes,
    verify: String(answer.kind === 'choice' ? answer.correct : 0),
  };
}

// ---------------------------------------------------------------- 図形の移動(方眼の図)

type Pt = [number, number];
type MoveKind = 'translate' | 'rotate' | 'reflect';

/** 辺の 長さが すべて ちがう 三角形(線対称でも 点対称でも ない ので、移動の しかたが 1 通りに 決まる) */
function scaleneTriangle(rng: Rng): Pt[] {
  for (let t = 0; t < 50; t++) {
    const pts: Pt[] = [
      [0, 0],
      [rng.int(2, 4), rng.int(0, 1)],
      [rng.int(0, 3), rng.int(2, 3)],
    ];
    const d2 = (a: Pt, b: Pt) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
    const s = [d2(pts[0], pts[1]), d2(pts[1], pts[2]), d2(pts[2], pts[0])];
    const area2 = Math.abs((pts[1][0] - pts[0][0]) * (pts[2][1] - pts[0][1]) - (pts[2][0] - pts[0][0]) * (pts[1][1] - pts[0][1]));
    // 内接円の 半径(面積 × 2 ÷ 周)が 0.55 ます 以上。細い 三角形だと 中に 書く ㋐ が 辺に かかる
    const per = s.reduce((a, v) => a + Math.sqrt(v), 0);
    if (area2 > 0 && new Set(s).size === 3 && area2 / per >= 0.55) return pts;
  }
  return [
    [0, 0],
    [3, 0],
    [1, 2],
  ];
}

interface MoveFig {
  kind: MoveKind;
  from: Pt[];
  to: Pt[];
  dx?: number;
  dy?: number;
  center?: Pt;
  angle?: 90 | -90 | 180;
  axis?: { x?: number; y?: number };
}

const W = 14;
const H = 9;
const inside = (ps: Pt[]) => ps.every(([x, y]) => x >= 0 && x <= W && y >= 0 && y <= H);

/** 方眼に おさまる 移動を 1 つ 作る */
function makeMove(rng: Rng, kind: MoveKind): MoveFig {
  for (let t = 0; t < 200; t++) {
    const base = scaleneTriangle(rng);
    // 向きを 変えて いろいろな 形に
    const flip = rng.bool();
    const tri = base.map(([x, y]) => (flip ? [y, x] : [x, y]) as Pt);
    const ox = rng.int(1, W - 5);
    const oy = rng.int(1, H - 4);
    const from = tri.map(([x, y]) => [x + ox, y + oy] as Pt);
    let fig: MoveFig;
    if (kind === 'translate') {
      const dx = rng.pick([-7, -6, -5, -4, 4, 5, 6, 7]);
      const dy = rng.int(-3, 3);
      fig = { kind, from, to: from.map(([x, y]) => [x + dx, y + dy] as Pt), dx, dy };
    } else if (kind === 'rotate') {
      const angle = rng.pick([90, -90, 180] as const);
      const c: Pt = [from[0][0] + rng.pick([3, 4, -3]), from[0][1] + rng.int(-1, 1)];
      const rot = ([x, y]: Pt): Pt => {
        const vx = x - c[0];
        const vy = y - c[1];
        if (angle === 180) return [c[0] - vx, c[1] - vy];
        if (angle === 90) return [c[0] - vy, c[1] + vx];
        return [c[0] + vy, c[1] - vx];
      };
      fig = { kind, from, to: from.map(rot), center: c, angle };
    } else {
      const vertical = rng.bool();
      const minX = Math.min(...from.map((p) => p[0]));
      const maxX = Math.max(...from.map((p) => p[0]));
      const minY = Math.min(...from.map((p) => p[1]));
      const maxY = Math.max(...from.map((p) => p[1]));
      // 軸は 三角形から 2 ます 以上 はなす(ア〜ウの 候補の 線が 三角形の 辺に 重ならないように)
      if (vertical) {
        const k = rng.bool() ? maxX + rng.int(2, 3) : minX - rng.int(2, 3);
        fig = { kind, from, to: from.map(([x, y]) => [2 * k - x, y] as Pt), axis: { x: k } };
      } else {
        const k = rng.bool() ? maxY + 2 : minY - 2;
        fig = { kind, from, to: from.map(([x, y]) => [x, 2 * k - y] as Pt), axis: { y: k } };
      }
    }
    if (!inside(fig.from) || !inside(fig.to) || !inside(fig.center ? [fig.center] : [])) continue;
    // 2 つの 三角形が 重ならない(はなれて いる)
    const box = (ps: Pt[]) => [Math.min(...ps.map((p) => p[0])), Math.max(...ps.map((p) => p[0])), Math.min(...ps.map((p) => p[1])), Math.max(...ps.map((p) => p[1]))];
    const [a0, a1, b0, b1] = box(fig.from);
    const [c0, c1, d0, d1] = box(fig.to);
    if (a1 > c0 && c1 > a0 && b1 > d0 && d1 > b0) continue;
    // 頂点どうし・回転の 中心と 頂点は 2 ます 以上 はなす(B と B′、頂点と O の 名前が 重ならないように)
    const far = (p: Pt, q: Pt) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= 2;
    if (!fig.from.every((p) => fig.to.every((q) => far(p, q)))) continue;
    if (fig.center && ![...fig.from, ...fig.to].every((p) => far(p, fig.center!))) continue;
    return fig;
  }
  return makeMove(rng, 'translate');
}

function gridOf(fig: MoveFig, opts: { showCenter?: boolean; showAxis?: boolean; decoyAxis?: boolean; letters?: boolean }): GridSpec {
  const lines: NonNullable<GridSpec['lines']> = [];
  if (opts.showAxis && fig.axis) {
    if (fig.axis.x !== undefined) lines.push({ x1: fig.axis.x, y1: 0, x2: fig.axis.x, y2: H, label: 'ℓ' });
    else lines.push({ x1: 0, y1: fig.axis.y!, x2: W, y2: fig.axis.y!, label: 'ℓ' });
  }
  return {
    kind: 'grid',
    w: W,
    h: H,
    shapes: [
      { points: fig.from, label: '㋐', tone: 'from', vertexLabels: opts.letters ? ['A', 'B', 'C'] : undefined },
      { points: fig.to, label: '㋑', tone: 'to', vertexLabels: opts.letters ? ['A′', 'B′', 'C′'] : undefined },
    ],
    points: opts.showCenter && fig.center ? [{ x: fig.center[0], y: fig.center[1], label: 'O' }] : undefined,
    lines,
  };
}

const MOVE_NAME: Record<MoveKind, string> = { translate: '平行移動', rotate: '回転移動', reflect: '対称移動' };

function moveByFigure(rng: Rng, d: Difficulty): Problem {
  const kind = rng.pick(['translate', 'rotate', 'reflect'] as const);
  const fig = makeMove(rng, kind);
  const say: Record<MoveKind, string> = {
    translate: '平行移動は 向きを 変えずに ずらす 移動。㋑は 向きが 変わって いるかな',
    rotate: '回転移動は 向きが 変わるが 裏返らない。頂点 A → B → C を 回る 向きが ㋐と ㋑で 同じか 見てみよう',
    reflect: '対称移動は 折り返し(裏返し)。A → B → C を 回る 向きが ㋐と ㋑で 逆に なるよ',
  };
  const { answer, mistakes } = choose(
    rng,
    MOVE_NAME[kind],
    (['translate', 'rotate', 'reflect'] as const).filter((k) => k !== kind).map((k) => ({ opt: MOVE_NAME[k], say: say[kind] })),
  );
  const why =
    kind === 'translate'
      ? text('㋐を 向きを 変えずに ずらすと ㋑に 重なる')
      : kind === 'rotate'
        ? text('㋐を ある 点を 中心に 回すと ㋑に 重なる(裏返しでは ない)')
        : text('㋐を ある 直線で 折り返すと ㋑に 重なる(裏返しに なって いる)');
  return {
    templateId: 'g1.geo.move',
    difficulty: d,
    prompt: text('三角形 ㋐ を 1 回 移動させて、三角形 ㋑ に 重ねる。どの 移動?'),
    promptText: '三角形㋐を1回移動させて、三角形㋑に重ねる。どの移動?',
    answer,
    hint: '向きは 同じ? 回って いる? 裏返って いる? 頂点 A、B、C を たどって みよう',
    explanation: [why, text(`答え: ${MOVE_NAME[kind]}`)],
    tags: ['move_kind'],
    key: `mov:kind:${JSON.stringify(fig.from)}:${JSON.stringify(fig.to)}`,
    figure: gridOf(fig, { letters: true }),
    mistakes,
    verify: String(answer.kind === 'choice' ? answer.correct : 0),
  };
}

const dirText = (dx: number, dy: number): string => {
  const h = dx > 0 ? `右に ${dx}` : dx < 0 ? `左に ${-dx}` : '';
  const v = dy > 0 ? `上に ${dy}` : dy < 0 ? `下に ${-dy}` : '';
  return [h, v].filter(Boolean).join('、') + ' ます';
};

function moveDetail(rng: Rng, d: Difficulty): Problem {
  const kind = rng.pick(['translate', 'rotate', 'reflect'] as const);
  const fig = makeMove(rng, kind);
  if (kind === 'translate') {
    const { dx = 0, dy = 0 } = fig;
    const wrongs: Wrong[] = [
      { opt: dirText(-dx, -dy), say: '㋐ から ㋑ への 向きだよ。A から A′ へ 矢印を かいて みよう' },
      ...(dy !== 0 ? [{ opt: dirText(dx, -dy), say: '上下の 向きを 確かめよう' }] : [{ opt: dirText(dx + Math.sign(dx), 0), say: '対応する 頂点(A と A′)どうしで ます目を 数えよう' }]),
      ...(dy !== 0 && Math.abs(dy) !== Math.abs(dx) ? [{ opt: dirText(dy * Math.sign(dx) || dx, dx * Math.sign(dy) || dy), say: '横と 縦の ます目を 入れかえて いないかな' }] : []),
      { opt: dirText(dx - Math.sign(dx), dy), say: '対応する 頂点(A と A′)どうしで ます目を 数えよう' },
    ];
    const { answer, mistakes } = choose(rng, dirText(dx, dy), wrongs);
    return {
      templateId: 'g1.geo.move',
      difficulty: d,
      prompt: text('三角形 ㋐ を 平行移動して ㋑ に 重ねる。どの 向きに 何ます 動かす?'),
      promptText: '三角形㋐を平行移動して㋑に重ねる。どの向きに何ます動かす?',
      answer,
      hint: '対応する 頂点 A と A′ の ます目の ちがいを 数えよう',
      explanation: [text('平行移動では、対応する 点を 結ぶ 線分は 平行で 長さが 等しい(AA′ // BB′、AA′ = BB′)'), text(`A から A′ へ: ${dirText(dx, dy)}`)],
      tags: ['move_translate'],
      key: `mov:tr:${JSON.stringify(fig.from)}:${dx}:${dy}`,
      figure: gridOf(fig, { letters: true }),
      mistakes,
      verify: String(answer.kind === 'choice' ? answer.correct : 0),
    };
  }
  if (kind === 'rotate') {
    const a = fig.angle!;
    const label = a === 180 ? '180°(点対称移動)' : a === 90 ? '反時計回りに 90°' : '時計回りに 90°';
    const { answer, mistakes } = choose(rng, label, [
      ...(a === 180 ? [] : [{ opt: a === 90 ? '時計回りに 90°' : '反時計回りに 90°', say: '回る 向きを 確かめよう。時計の 針と 同じ 向きが 時計回り' }]),
      ...(a === 180 ? [{ opt: '反時計回りに 90°', say: 'O と A、O と A′ を 結んで みよう。一直線に なれば 180°' }, { opt: '時計回りに 90°', say: 'O と A、O と A′ を 結んで みよう。一直線に なれば 180°' }] : [{ opt: '180°(点対称移動)', say: 'O と A、O と A′ を 結ぶと 直角に なるよ' }]),
      { opt: '360°', say: '360° 回すと もとの 位置に もどるよ' },
    ]);
    return {
      templateId: 'g1.geo.move',
      difficulty: d,
      prompt: text('三角形 ㋐ を、点 O を 中心に 回転移動して ㋑ に 重ねる。どの 向きに 何度 回す?'),
      promptText: '三角形㋐を、点Oを中心に回転移動して㋑に重ねる。どの向きに何度回す?',
      answer,
      hint: 'O と A、O と A′ を 結んだ 2 本の 線の 角を 見よう',
      explanation: [text('回転移動では OA = OA′ で、∠AOA′ が 回した 角'), text(`答え: ${label}`)],
      tags: ['move_rotate'],
      key: `mov:rot:${JSON.stringify(fig.from)}:${a}`,
      figure: gridOf(fig, { letters: true, showCenter: true }),
      mistakes,
      verify: String(answer.kind === 'choice' ? answer.correct : 0),
    };
  }
  // 対称移動: 対称の軸を ア〜エ の 直線から 選ぶ
  const ax = fig.axis!;
  const vertical = ax.x !== undefined;
  const k = (vertical ? ax.x : ax.y)!;
  // 候補は 2 つの 三角形の あいだの 3 本(軸と その となり)。真ん中が いつも 正解に ならないよう、名前の 順は ばらばらに
  const shown = [k - 1, k, k + 1];
  const names = rng.shuffle(['ア', 'イ', 'ウ']);
  const lines = shown.map((v, i) => (vertical ? { x1: v, y1: 0, x2: v, y2: H, label: names[i] } : { x1: 0, y1: v, x2: W, y2: v, label: names[i] }));
  const correctName = names[shown.indexOf(k)];
  const { answer, mistakes } = choose(
    rng,
    `直線 ${correctName}`,
    names.filter((n) => n !== correctName).map((n) => ({ opt: `直線 ${n}`, say: '対応する 点 A と A′ の ちょうど 真ん中を 通る 線が 対称の軸。ます目を 数えよう' })),
  );
  const grid = gridOf(fig, { letters: true });
  grid.lines = lines;
  return {
    templateId: 'g1.geo.move',
    difficulty: d,
    prompt: text('三角形 ㋐ を 対称移動して ㋑ に 重ねる。対称の軸は どれ?'),
    promptText: '三角形㋐を対称移動して㋑に重ねる。対称の軸はどれ?',
    answer,
    hint: '対称移動では、対応する 点を 結ぶ 線分は 対称の軸で 垂直に 2 等分される',
    explanation: [text('A と A′ を 結ぶ 線分の 中点を 通り、垂直な 直線が 対称の軸'), text(`答え: 直線 ${correctName}`)],
    tags: ['move_reflect'],
    key: `mov:ref:${JSON.stringify(fig.from)}:${k}:${vertical}`,
    figure: grid,
    mistakes,
    verify: String(answer.kind === 'choice' ? answer.correct : 0),
  };
}

/** 記号と 用語(1 節 基本の問題の 空らん) */
const MOVE_TERMS: Fact[] = [
  { q: '2 直線 AB、CD が 平行で ある ことを 記号で 表すと?', a: 'AB // CD', w: [{ opt: 'AB ⊥ CD', say: '⊥ は 垂直の 記号。平行は //' }, { opt: 'AB = CD', say: '= は 長さが 等しい ことを 表すよ' }, { opt: '∠AB = ∠CD' }], tag: 'move_symbol' },
  { q: '直線 AB と 直線 ℓ が 垂直で ある ことを 記号で 表すと?', a: 'AB ⊥ ℓ', w: [{ opt: 'AB // ℓ', say: '// は 平行の 記号。垂直は ⊥' }, { opt: 'AB = ℓ' }, { opt: '∠AB ℓ' }], tag: 'move_symbol' },
  { q: '直線 AB の うち、A から B までの 部分を 何という?', a: '線分 AB', w: [{ opt: '半直線 AB', say: '半直線は B の ほうへ かぎりなく のびる 線。A から B までなら …' }, { opt: '直線 AB', say: '直線は 両方に かぎりなく のびるよ' }, { opt: '弧 AB' }], tag: 'move_symbol' },
  { q: '線分 AB を、B の ほうへ まっすぐ かぎりなく のばした ものを 何という?', a: '半直線 AB', w: [{ opt: '線分 AB', say: '線分は A から B までの 部分だけ' }, { opt: '直線 AB', say: '直線は A の ほうにも のびるよ' }, { opt: '半直線 BA', say: '半直線 BA は B から A の ほうへ のびる 線。始まりの 点を 先に 書くよ' }], tag: 'move_symbol' },
  { q: '図形を、一定の 方向に 一定の 距離だけ 動かす 移動を 何という?', a: '平行移動', w: [{ opt: '回転移動', say: '回転移動は 点を 中心に 回す 移動' }, { opt: '対称移動', say: '対称移動は 直線で 折り返す 移動' }, { opt: '点対称移動' }], tag: 'move_term' },
  { q: '図形を、ある 点を 中心として 一定の 角度だけ 回す 移動を 何という?', a: '回転移動', w: [{ opt: '平行移動', say: '平行移動は 向きを 変えずに ずらす 移動' }, { opt: '対称移動', say: '対称移動は 直線で 折り返す 移動' }, { opt: '拡大' }], tag: 'move_term' },
  { q: '図形を、ある 直線を 折り目と して 折り返す 移動を 何という?', a: '対称移動', w: [{ opt: '回転移動', say: '回転移動は 点を 中心に 回す 移動' }, { opt: '平行移動', say: '平行移動は 向きを 変えずに ずらす 移動' }, { opt: '点対称移動', say: '点対称移動は 180° の 回転移動' }], tag: 'move_term' },
  { q: '図形を 180° だけ 回転移動する ことを 何という?', a: '点対称移動', w: [{ opt: '対称移動', say: '対称移動は 折り返し。180° 回すのは 点対称移動' }, { opt: '平行移動' }, { opt: '線対称' }], tag: 'move_term' },
  { q: '平行移動で、対応する 点を 結ぶ 線分は どうなる?', a: '平行で、長さが 等しい', w: [{ opt: '1 点で 交わる', say: 'それは 回転移動の 中心の ようす。平行移動では …' }, { opt: '対称の軸で 垂直に 2 等分される', say: 'それは 対称移動の 性質' }, { opt: '長さが ばらばら' }], tag: 'move_prop' },
  { q: '移動しても 変わらない ものは?', a: '形と 大きさ', w: [{ opt: '位置', say: '移動は 位置を 変える こと。変わらないのは 形と 大きさ' }, { opt: '向き', say: '回転移動・対称移動では 向きが 変わるよ' }, { opt: '何も 変わらない' }], tag: 'move_prop' },
  { q: '一方を 移動させて 他方に ぴったり 重ね合わせる ことが できる 2 つの 図形の 関係を 何という?', a: '合同', w: [{ opt: '対称', say: '対称は 1 つの 図形の 性質。2 つの 図形が 重なるのは …' }, { opt: '平行' }, { opt: '相似' }], tag: 'move_term' },
];

function genMove(rng: Rng, d: Difficulty): Problem {
  // ★1: 図で 移動の 種類 / ★2: 図で くわしく(何ます・何度・どの 軸)/ ★3: 記号・用語・性質と 図の くわしい 問題
  if (d === 1) return rng.int(0, 2) === 0 ? termProblem(rng, d) : moveByFigure(rng, d);
  if (d === 2) return rng.int(0, 3) === 0 ? moveByFigure(rng, d) : moveDetail(rng, d);
  return rng.bool() ? termProblem(rng, d) : moveDetail(rng, d);
}

function termProblem(rng: Rng, d: Difficulty): Problem {
  const pool = d === 1 ? MOVE_TERMS.filter((f) => f.tag === 'move_term') : MOVE_TERMS;
  const c = rng.pick(pool);
  const { answer, mistakes } = choose(rng, c.a, c.w);
  return {
    templateId: 'g1.geo.move',
    difficulty: d,
    prompt: text(c.q),
    promptText: c.q,
    answer,
    layout: 'prose',
    hint: '壁画の 三角形を 思い出そう。ずらす・回す・折り返す',
    explanation: [text(`答え: ${c.a}`)],
    tags: [c.tag],
    key: `mov:${c.q}`,
    mistakes,
    verify: String(answer.kind === 'choice' ? answer.correct : 0),
  };
}

registerTemplate({ id: 'g1.geo.angle', unit: UNIT, title: '角の大きさ', timeLimit: { 1: 35, 2: 45, 3: 60 }, generate: genAngle });
registerTemplate({ id: 'g1.geo.symmetry', unit: UNIT, title: '線対称・点対称', timeLimit: { 1: 30, 2: 40, 3: 50 }, generate: genSymmetry });
registerTemplate({ id: 'g1.geo.sector', unit: UNIT, title: 'おうぎ形', timeLimit: { 1: 55, 2: 70, 3: 90 }, generate: genSector });
registerTemplate({ id: 'g1.geo.construct', unit: UNIT, title: '作図', timeLimit: { 1: 40, 2: 50, 3: 60 }, generate: genConstruct });
registerTemplate({ id: 'g1.geo.move', unit: UNIT, title: '図形の移動', timeLimit: { 1: 45, 2: 55, 3: 60 }, generate: genMove });
