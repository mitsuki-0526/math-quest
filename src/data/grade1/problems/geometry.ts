import { registerTemplate, type Difficulty, type Problem } from '@/math/template';
import type { Rng } from '@/math/rng';
import { rat } from '@/math/rational';
import { text } from '@/math/format';

/**
 * 第5章「平面図形」のテンプレート(台本 05_circle_ruins.md の敵に対応)。
 *   g1.geo.angle     角度ガーゴイル   角の計算(図つき)
 *   g1.geo.symmetry  対称ミラー       線対称・点対称(選択式)
 *   g1.geo.sector    おうぎ形の門番   弧の長さ・面積・中心角(π を含む式入力)
 *   g1.geo.construct 作図ゴースト     作図で得られる線の性質(選択式)
 *   g1.geo.move      (ボス)           図形の移動・円と接線(選択式)
 * π を含む答えは式入力(`6π`)で受ける。判定は多項式エンジン(π を文字として扱う)。
 */
const UNIT = '平面図形';

// ---------------------------------------------------------------- 角

function genAngle(rng: Rng, d: Difficulty): Problem {
  if (d === 1) {
    // 一直線上の角: a + x = 180
    const a = rng.int(25, 155);
    const x = 180 - a;
    return {
      templateId: 'g1.geo.angle',
      difficulty: d,
      prompt: `${text('図の x の大きさは?(単位は度、数だけ答える)')}`,
      promptText: '図の x の大きさは?(単位は度、数だけ答える)',
      answer: { kind: 'number', value: rat(x) },
      hint: '一直線の 角は 180°',
      explanation: [`x = 180° - ${a}° = ${x}°`, `${text('答え: ')} ${x}`],
      tags: ['angle_straight'],
      key: `ang1:${a}`,
      figure: { kind: 'angles', rays: [0, a, 180], throughLines: false, marks: [{ from: 0, to: 1, label: `${a}°` }, { from: 1, to: 2, label: 'x' }] },
      verify: `180-${a}`,
    };
  }
  if (d === 2) {
    // 対頂角 / 交わる2直線
    const a = rng.int(25, 80);
    const askVertical = rng.bool();
    const x = askVertical ? a : 180 - a;
    return {
      templateId: 'g1.geo.angle',
      difficulty: d,
      prompt: `${text('2直線が 交わっている。x の大きさは?(度)')}`,
      promptText: '2直線が交わっている。x の大きさは?(度)',
      answer: { kind: 'number', value: rat(x) },
      hint: askVertical ? '向かい合う 角(対頂角)は 等しい' : '一直線の 角は 180°',
      explanation: [askVertical ? `${text('対頂角は 等しい')}` : `x = 180° - ${a}°`, `${text('答え: ')} ${x}`],
      tags: askVertical ? ['angle_vertical'] : ['angle_straight'],
      key: `ang2:${a}:${askVertical}`,
      // 2直線を 4本の半直線(0°, a°, 180°, 180+a°)として描き、x の位置を問題ごとに変える
      figure: {
        kind: 'angles',
        rays: [0, a, 180, 180 + a],
        throughLines: false,
        marks: askVertical
          ? [
              { from: 0, to: 1, label: `${a}°` },
              { from: 2, to: 3, label: 'x' },
            ]
          : [
              { from: 0, to: 1, label: `${a}°` },
              { from: 1, to: 2, label: 'x' },
            ],
      },
      verify: askVertical ? `${a}` : `180-${a}`,
    };
  }
  // ★3: 三角形の内角の和
  const a = rng.int(30, 90);
  const b = rng.int(30, 180 - a - 20);
  const x = 180 - a - b;
  return {
    templateId: 'g1.geo.angle',
    difficulty: d,
    prompt: `${text(`三角形の 2つの角が ${a}° と ${b}° のとき、残りの角 x は?(度)`)}`,
    promptText: `三角形の2つの角が ${a}° と ${b}° のとき、残りの角 x は?(度)`,
    answer: { kind: 'number', value: rat(x) },
    hint: '三角形の 内角の和は 180°',
    explanation: [`x = 180° - ${a}° - ${b}° = ${x}°`, `${text('答え: ')} ${x}`],
    tags: ['angle_triangle'],
    key: `ang3:${a}:${b}`,
    verify: `180-${a}-${b}`,
  };
}

// ---------------------------------------------------------------- 対称

const SHAPES: { name: string; line: boolean; point: boolean; axes: number }[] = [
  { name: '正方形', line: true, point: true, axes: 4 },
  { name: '長方形', line: true, point: true, axes: 2 },
  { name: '正三角形', line: true, point: false, axes: 3 },
  { name: '二等辺三角形', line: true, point: false, axes: 1 },
  { name: '平行四辺形', line: false, point: true, axes: 0 },
  { name: 'ひし形', line: true, point: true, axes: 2 },
  { name: '正五角形', line: true, point: false, axes: 5 },
  { name: '正六角形', line: true, point: true, axes: 6 },
  { name: '正八角形', line: true, point: true, axes: 8 },
  { name: '等脚台形', line: true, point: false, axes: 1 },
  { name: '直角三角形(3辺の長さがちがう)', line: false, point: false, axes: 0 },
  { name: 'たこ形', line: true, point: false, axes: 1 },
  { name: '正十二角形', line: true, point: true, axes: 12 },
  { name: '半円', line: true, point: false, axes: 1 },
];

function genSymmetry(rng: Rng, d: Difficulty): Problem {
  const s = rng.pick(SHAPES);
  const askLine = rng.bool();
  const yes = askLine ? s.line : s.point;
  const kindName = askLine ? '線対称' : '点対称';
  if (d <= 2) {
    const options = ['はい(対称である)', 'いいえ(対称ではない)'];
    return {
      templateId: 'g1.geo.symmetry',
      difficulty: d,
      prompt: `${text(`${s.name} は ${kindName}な 図形ですか?`)}`,
      promptText: `${s.name} は ${kindName}な図形ですか?`,
      answer: { kind: 'choice', options, correct: yes ? 0 : 1 },
      hint: askLine ? '1本の 直線で 折ると ぴったり 重なるか' : '1つの点を 中心に 180° 回すと 重なるか',
      explanation: [`${text(`${s.name} は ${kindName}${yes ? 'である' : 'ではない'}`)}`],
      tags: [askLine ? 'symmetry_line' : 'symmetry_point'],
      key: `sym:${s.name}:${askLine}`,
      verify: String(yes ? 0 : 1),
    };
  }
  // ★3: 対称の軸の本数、または 点対称かどうかも合わせて問う
  if (rng.bool()) {
    const yes2 = s.point;
    return {
      templateId: 'g1.geo.symmetry',
      difficulty: d,
      prompt: `${text(`${s.name} について 正しいのは?`)}`,
      promptText: `${s.name} について正しいのは?`,
      answer: {
        kind: 'choice',
        options: [
          text(`線対称${s.line ? 'である' : 'ではない'}`),
          text(`線対称${s.line ? 'ではない' : 'である'}`),
          text(`点対称${yes2 ? 'ではない' : 'である'}`),
          text(`対称の軸は ${s.axes + 2} 本`),
        ],
        correct: 0,
      },
      hint: '折って 重なるか(線対称)、180° 回して 重なるか(点対称)',
      explanation: [`${text(`${s.name}: 線対称${s.line ? 'である' : 'ではない'}、点対称${yes2 ? 'である' : 'ではない'}、対称の軸 ${s.axes} 本`)}`],
      tags: ['symmetry_mixed'],
      key: `sym3b:${s.name}`,
      verify: '0',
    };
  }
  const n = s.axes;
  const options = rng.shuffle([...new Set([n, n + 1, Math.max(0, n - 1), n + 2])]).slice(0, 4).map(String);
  const correct = options.indexOf(String(n));
  if (correct < 0) return genSymmetry(rng, d);
  return {
    templateId: 'g1.geo.symmetry',
    difficulty: d,
    prompt: `${text(`${s.name} の 対称の軸は 何本?`)}`,
    promptText: `${s.name} の対称の軸は何本?`,
    answer: { kind: 'choice', options, correct },
    hint: '折って ぴったり 重なる 直線を 数えよう',
    explanation: [`${text(`${s.name} の 対称の軸は ${n} 本`)}`],
    tags: ['symmetry_axes'],
    key: `sym3:${s.name}`,
    verify: String(correct),
  };
}

// ---------------------------------------------------------------- おうぎ形

function genSector(rng: Rng, d: Difficulty): Problem {
  // 学習プリントの例は 半径 3〜8、中心角 30°〜120°。★1 はその範囲、★2 から 大きい半径・角を 加える(docs/difficulty.md)
  const r = rng.pick(d === 1 ? [3, 4, 6, 8, 12] : [3, 4, 6, 8, 9, 10, 12]);
  const angle = rng.pick(d === 1 ? [30, 45, 60, 90, 120] : d === 2 ? [30, 45, 60, 90, 120, 135, 150, 180] : [30, 45, 60, 90, 120, 135, 150, 180, 270]);
  const arcNum = (2 * r * angle) / 360;
  const areaNum = (r * r * angle) / 360;
  const asArc = d === 1 ? true : d === 2 ? false : rng.bool();
  if (d <= 2) {
    const value = asArc ? arcNum : areaNum;
    if (!Number.isInteger(value * 2)) return genSector(rng, d);
    const label = asArc ? '弧の長さ' : '面積';
    return {
      templateId: 'g1.geo.sector',
      difficulty: d,
      prompt: `${text(`半径 ${r}、中心角 ${angle}° の おうぎ形の ${label}は?(π を使って答える)`)}`,
      promptText: `半径 ${r}、中心角 ${angle}° のおうぎ形の${label}は?(π を使って答える)`,
      answer: { kind: 'expression', expected: `${value}π` },
      hint: asArc ? `円周 2πr の ${angle}/360 倍` : `円の面積 πr² の ${angle}/360 倍`,
      explanation: [
        asArc ? `2 \\times \\pi \\times ${r} \\times \\frac{${angle}}{360}` : `\\pi \\times ${r}^{2} \\times \\frac{${angle}}{360}`,
        `${text('答え: ')} ${value}\\pi`,
      ],
      tags: [asArc ? 'sector_arc' : 'sector_area'],
      key: `sec:${r}:${angle}:${asArc}`,
      figure: { kind: 'sector', radius: r, angle, radiusLabel: String(r) },
      verify: `${value}π`,
    };
  }
  // ★3: 中心角を求める(数値)
  if (!Number.isInteger(arcNum)) return genSector(rng, d);
  return {
    templateId: 'g1.geo.sector',
    difficulty: d,
    prompt: `${text(`半径 ${r} の おうぎ形の 弧の長さが ${arcNum}π のとき、中心角は?(度)`)}`,
    promptText: `半径 ${r} のおうぎ形の弧の長さが ${arcNum}π のとき、中心角は?(度)`,
    answer: { kind: 'number', value: rat(angle) },
    hint: '円周 2πr の うち どれだけか を 考えよう',
    explanation: [`${text('円周: ')} 2\\pi \\times ${r} = ${2 * r}\\pi`, `\\frac{${arcNum}\\pi}{${2 * r}\\pi} = \\frac{${angle}}{360}`, `${text('答え: ')} ${angle}`],
    tags: ['sector_angle'],
    key: `sec3:${r}:${angle}`,
    figure: { kind: 'sector', radius: r, angle: null, radiusLabel: String(r), note: `弧の長さ ${arcNum}π` },
    verify: `${angle}`,
  };
}

// ---------------------------------------------------------------- 作図

const CONSTRUCTS = [
  { q: '線分 AB の 垂直二等分線 の上の 点は、どんな 点?', a: 'A と B から 等しい 距離にある 点', w: ['A に 近い 点', 'AB の 真ん中の 点だけ', 'A と B を 通る 点'] },
  { q: '∠AOB の 二等分線 の上の 点は、どんな 点?', a: '2つの 辺 OA と OB から 等しい 距離にある 点', w: ['O から 等しい 距離にある 点', '辺 OA 上の 点', '∠AOB の 外にある 点'] },
  { q: '円の 接線と、接点を 通る 半径 の関係は?', a: '垂直に 交わる', w: ['平行になる', '45° で 交わる', '重なる'] },
  { q: '2点 A、B から 等しい 距離にある 点 の集まりは?', a: '線分 AB の 垂直二等分線', w: ['線分 AB', 'A を 中心とする 円', '∠A の 二等分線'] },
  { q: '点 O を 中心とする 円の 弦 AB に、O から 垂線を 引くと?', a: '弦 AB を 2等分する', w: ['弦 AB を 3等分する', '弦 AB と 平行になる', '円の 接線になる'] },
  { q: '直線 ℓ 上の 点 P を 通る、ℓ の 垂線を 作図する道具は?', a: 'コンパスと 定規(目もりは 使わない)', w: ['分度器', '三角定規だけ', 'ものさしの 目もり'] },
  { q: '正三角形を 作図するとき、使う 性質は?', a: '3つの 辺の 長さが 等しい', w: ['3つの 角が すべて 直角', '2つの 辺が 平行', '対角線が 等しい'] },
  { q: '60° の 角を 作図するには?', a: '正三角形を 作図して その 1つの角を 使う', w: ['直角を 3等分する', '分度器で 測る', '円を 6等分する 弦を 引く'] },
  { q: '45° の 角を 作図するには?', a: '直角を 二等分する', w: ['正三角形の 角を 使う', '90° から 60° を 引く', '円周を 8等分する'] },
  { q: '円の 中心を 作図で 見つけるには?', a: '2本の 弦の 垂直二等分線の 交点を とる', w: ['1本の 弦の 真ん中を とる', '接線を 2本 引く', '直径を 測る'] },
  { q: '三角形の 3辺から 等しい 距離にある 点は、何の 交点?', a: '3つの 角の 二等分線', w: ['3辺の 垂直二等分線', '3つの 中線', '3つの 高さ'] },
  { q: '三角形の 3つの頂点から 等しい 距離にある 点は、何の 交点?', a: '3辺の 垂直二等分線', w: ['3つの 角の 二等分線', '3つの 中線', '3つの 高さ'] },
  { q: '点 P から 直線 ℓ への 距離とは?', a: 'P から ℓ に 引いた 垂線の 長さ', w: ['P と ℓ 上の どの 点までの 長さでも よい', 'P と ℓ の 端までの 長さ', 'ℓ の 長さ'] },
  { q: '円の 接線は、接点で 半径と どう 交わる?', a: '90° で 交わる', w: ['60° で 交わる', '交わらない', '接点で 重なる'] },
  { q: 'おうぎ形の 中心角を 2等分すると、弧の 長さは?', a: '半分になる', w: ['変わらない', '2倍になる', '4分の1になる'] },
];

function genConstruct(rng: Rng, d: Difficulty): Problem {
  const c = rng.pick(CONSTRUCTS);
  const options = rng.shuffle([c.a, ...c.w]);
  const correct = options.indexOf(c.a);
  return {
    templateId: 'g1.geo.construct',
    difficulty: d,
    prompt: `${text(c.q)}`,
    promptText: c.q,
    answer: { kind: 'choice', options: options.map((o) => text(o)), correct },
    hint: '「等しい」に なるものは 何かを 考えよう',
    explanation: [`${text('答え: ')} ${text(c.a)}`],
    tags: ['construct'],
    key: `con:${c.q}`,
    verify: String(correct),
  };
}

// ---------------------------------------------------------------- 図形の移動(ボス)

const MOVES = [
  { q: '図形を 向きを 変えずに ずらす 移動を 何という?', a: '平行移動', w: ['回転移動', '対称移動', '拡大'] },
  { q: '1つの点を 中心に、一定の 角度だけ 回す 移動を 何という?', a: '回転移動', w: ['平行移動', '対称移動', '縮小'] },
  { q: '1つの直線を 折り目にして 折り返す 移動を 何という?', a: '対称移動', w: ['平行移動', '回転移動', '拡大'] },
  { q: '図形を 移動しても 変わらないものは?', a: '形と 大きさ', w: ['向きだけ', '位置だけ', '何も 変わらない'] },
  { q: '点 O を 中心に 180° 回転移動することを 何という?', a: '点対称移動', w: ['線対称移動', '平行移動', '対称の軸'] },
  { q: '平行移動で、対応する 点を 結んだ 線分は どうなる?', a: 'すべて 平行で、長さも 等しい', w: ['1点で 交わる', '垂直に 交わる', '長さが ばらばら'] },
  { q: '対称移動で、対応する 2点を 結んだ 線分と 対称の軸の 関係は?', a: '軸は その 線分の 垂直二等分線になる', w: ['軸と 平行になる', '軸と 重なる', '関係はない'] },
  { q: '回転移動で、回転の 中心から 対応する 2点までの 距離は?', a: '等しい', w: ['回転した ぶんだけ 長くなる', '半分になる', '決まらない'] },
  { q: '平行移動を 2回 続けて 行うと、全体では?', a: '1回の 平行移動と 同じ', w: ['回転移動に なる', '対称移動に なる', '元に 戻る'] },
  { q: '対称移動を 同じ軸で 2回 行うと?', a: '元の 図形に 戻る', w: ['平行移動に なる', '回転移動に なる', '大きさが 変わる'] },
  { q: '円 O と 直線 ℓ が 1点だけを 共有するとき、ℓ を 何という?', a: '接線', w: ['弦', '直径', '弧'] },
  { q: '円の 2点を 結ぶ 線分を 何という?', a: '弦', w: ['弧', '接線', '半径'] },
  { q: '円周の 一部分を 何という?', a: '弧', w: ['弦', '接線', '中心角'] },
  { q: '中心 O と 弦 AB が つくる 角を 何という?', a: '中心角', w: ['円周角', '接線角', '内角'] },
  { q: 'おうぎ形の 弧の 長さは 何に 比例する?', a: '中心角', w: ['半径の 2乗', '面積の 2乗', '円周率'] },
  { q: '図形を 平行移動しても 変わらないのは?', a: '辺の 長さと 角の 大きさ', w: ['位置', '向きだけ', '面積だけ'] },
];

function genMove(rng: Rng, d: Difficulty): Problem {
  const c = rng.pick(MOVES);
  const options = rng.shuffle([c.a, ...c.w]);
  const correct = options.indexOf(c.a);
  return {
    templateId: 'g1.geo.move',
    difficulty: d,
    prompt: `${text(c.q)}`,
    promptText: c.q,
    answer: { kind: 'choice', options: options.map((o) => text(o)), correct },
    hint: '壁画の 三角形を 思い出そう。ずらす・回す・裏返す',
    explanation: [`${text('答え: ')} ${text(c.a)}`],
    tags: ['figure_move'],
    key: `mov:${c.q}`,
    verify: String(correct),
  };
}

registerTemplate({ id: 'g1.geo.angle', unit: UNIT, title: '角の大きさ', timeLimit: { 1: 30, 2: 40, 3: 45 }, generate: genAngle });
registerTemplate({ id: 'g1.geo.symmetry', unit: UNIT, title: '線対称・点対称', timeLimit: { 1: 30, 2: 35, 3: 45 }, generate: genSymmetry });
registerTemplate({ id: 'g1.geo.sector', unit: UNIT, title: 'おうぎ形', timeLimit: { 1: 55, 2: 60, 3: 70 }, generate: genSector });
registerTemplate({ id: 'g1.geo.construct', unit: UNIT, title: '作図の性質', timeLimit: { 1: 40, 2: 45, 3: 50 }, generate: genConstruct });
registerTemplate({ id: 'g1.geo.move', unit: UNIT, title: '図形の移動', timeLimit: { 1: 35, 2: 40, 3: 45 }, generate: genMove });
