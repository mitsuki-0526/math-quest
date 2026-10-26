import type { DiagramItem, DiagramPt, DiagramSpec, DiagramTone, FigureSpec, SolidSpec } from '@/math/figure';

/**
 * 会話の 上に 出す 図(台本の「※ 図[ID]: …」の ID → 図)。
 * 台本の「アニメ」の 指示は、動きの あとの 形を 1 枚の 図で 見せる(動かさなくても 何を 考えれば よいか 分かれば よい)。
 * 先生の報告 2026-10-26「図も なにも ないので 何を 考えたら いいのか わかりません」(壁画の間)
 */

// ---------------------------------------------------------------- 第5章 壁画の間(図形の移動)

/**
 * 三角形 A と、A を 右に ずらした B、A を 90° 回した C、A を 直線 x = −1 で 折り返した D。
 * A は 二等辺でも 直角でもない 三角形に する(裏返しと 回転の ちがいが 見える 形)
 */
const A: DiagramPt[] = [
  [0, 0],
  [3, 0],
  [1, 2],
];
const shift = (pts: DiagramPt[], dx: number): DiagramPt[] => pts.map(([x, y]) => [x + dx, y]);
const B = shift(A, 5);
const C = shift(
  A.map(([x, y]): DiagramPt => [-y, x]),
  12,
);
const D = A.map(([x, y]): DiagramPt => [-2 - x, y]);
/** 対称の軸(D と A の あいだ) */
const AXIS: DiagramItem = { t: 'seg', a: [-1, -0.6], b: [-1, 3.2], dash: true };
/** 名前を 書く 位置(三角形の 下) */
const NAME_AT: Record<'A' | 'B' | 'C' | 'D', DiagramPt> = { A: [1.5, -0.8], B: [6.5, -0.8], C: [11, -0.8], D: [-3.5, -0.8] };
const PTS = { A, B, C, D };

type Look = 'show' | 'mark' | 'faint';
/** 4 つの 三角形を 描く。show: 黒く 塗る / mark: 赤(答えに かかわる 方) / faint: 灰の 線だけ */
function mural(look: Record<'A' | 'B' | 'C' | 'D', Look>, extra: DiagramItem[] = [], names: Partial<Record<'B' | 'C' | 'D', string>> = {}): DiagramSpec {
  const tone = (l: Look): DiagramTone => (l === 'mark' ? 'ask' : l === 'faint' ? 'faint' : 'ink');
  const items: DiagramItem[] = [];
  for (const k of ['A', 'B', 'C', 'D'] as const) {
    items.push({ t: 'poly', pts: PTS[k], tone: tone(look[k]), fill: look[k] !== 'faint' });
    items.push({ t: 'text', p: NAME_AT[k], s: k, tone: tone(look[k]) });
  }
  for (const k of ['B', 'C', 'D'] as const) {
    const s = names[k];
    if (s) items.push({ t: 'text', p: [NAME_AT[k][0], NAME_AT[k][1] - 1.3], s, tone: tone(look[k]) });
  }
  return { kind: 'diagram', view: [-6, -3, 19.5, 6.6], width: 560, items: [...items, ...extra], label: '壁画の 三角形 A・B・C・D' };
}

/** 矢印(線と 先の 三角)。図の 部品に 矢印が ないので ここで 作る */
function arrow(a: DiagramPt, b: DiagramPt, tone: DiagramTone = 'ink', s = 0.35): DiagramItem[] {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const l = Math.hypot(dx, dy);
  const [ux, uy] = [dx / l, dy / l];
  return [
    { t: 'seg', a, b: [b[0] - ux * s, b[1] - uy * s], tone },
    { t: 'poly', pts: [b, [b[0] - ux * s * 2 - uy * s, b[1] - uy * s * 2 + ux * s], [b[0] - ux * s * 2 + uy * s, b[1] - uy * s * 2 - ux * s]], tone, fill: true },
  ];
}

/** 直角三角形と、3 つの 辺の 外側の 正方形(三平方の 定理の 伏線)。正方形の 中は 1 ます ずつの 目盛り */
function squaresMural(): DiagramSpec {
  const items: DiagramItem[] = [];
  const square = (p: DiagramPt, u: DiagramPt, n: DiagramPt, len: number) => {
    // p から u 向きに len、n 向きに len の 正方形。目盛りは 1 ずつ
    const at = (i: number, j: number): DiagramPt => [p[0] + u[0] * i + n[0] * j, p[1] + u[1] * i + n[1] * j];
    for (let i = 1; i < len; i++) {
      items.push({ t: 'seg', a: at(i, 0), b: at(i, len), tone: 'faint' });
      items.push({ t: 'seg', a: at(0, i), b: at(len, i), tone: 'faint' });
    }
    items.push({ t: 'poly', pts: [at(0, 0), at(len, 0), at(len, len), at(0, len)] });
  };
  square([0, 0], [1, 0], [0, -1], 4);
  square([0, 0], [0, 1], [-1, 0], 3);
  square([4, 0], [-0.8, 0.6], [0.6, 0.8], 5);
  items.push({ t: 'poly', pts: [[0, 0], [4, 0], [0, 3]], fill: true });
  items.push({ t: 'poly', pts: [[0, 0], [0.45, 0], [0.45, 0.45], [0, 0.45]] });
  return { kind: 'diagram', view: [-3.6, -4.6, 11.2, 12.2], width: 250, items, label: '直角三角形と 3 つの 正方形' };
}

// ---------------------------------------------------------------- 第6章 展開図の洞窟

const PRISM: SolidSpec = { kind: 'solid', shape: 'prism3', labels: {} };

/**
 * 三角柱の 展開図: 長方形 3 枚が 横に 並び、まん中の 上下に 底面の 三角形。折り目は 点線。
 * 底面は 見取図(Figure の prism3)と 同じ 直角三角形に する(3・4・5。長方形の 横が 底面の 辺と そろう)
 */
function prismNet(): DiagramSpec {
  return {
    kind: 'diagram',
    view: [-0.6, -3.6, 13.2, 11.2],
    width: 270,
    label: '三角柱の 展開図',
    items: [
      { t: 'poly', pts: [[0, 0], [3, 0], [3, -3], [7, 0], [12, 0], [12, 4], [7, 4], [3, 7], [3, 4], [0, 4]], fill: true },
      { t: 'seg', a: [3, 0], b: [3, 4], dash: true },
      { t: 'seg', a: [7, 0], b: [7, 4], dash: true },
      { t: 'seg', a: [3, 4], b: [7, 4], dash: true },
      { t: 'seg', a: [3, 0], b: [7, 0], dash: true },
    ],
  };
}

/** 円柱の 展開図(半径 r = 1、長方形の 横は 2πr)。width は 長方形の 横に 書く 文字 */
function cylinderNet(width: string, tone: DiagramTone): DiagramSpec {
  const W = 2 * Math.PI;
  // 円は 長方形の 左寄りに つける。横の 長さは 長方形の 中に 両矢印で 書く(外に 弧で 書くと 円と 重なる)
  const cx = 1.3;
  return {
    kind: 'diagram',
    view: [-0.6, -2.4, 7.6, 7.9],
    width: 250,
    label: '円柱の 展開図',
    items: [
      { t: 'poly', pts: [[0, 0], [W, 0], [W, 3], [0, 3]], fill: true },
      { t: 'circle', c: [cx, 4], r: 1 },
      { t: 'circle', c: [cx, -1], r: 1 },
      { t: 'dot', p: [cx, 4] },
      { t: 'seg', a: [cx, 4], b: [cx + 1, 4] },
      { t: 'text', p: [cx + 0.5, 4.45], s: 'r', italic: true },
      ...arrow([W / 2, 0.9], [0.08, 0.9], tone, 0.2),
      ...arrow([W / 2, 0.9], [W - 0.08, 0.9], tone, 0.2),
      { t: 'text', p: [W / 2, 1.75], s: width, tone },
    ],
  };
}

// ---------------------------------------------------------------- 第7章 記録の塔(散らばり)

/** 10 年分の 収穫。どちらも 平均 100(台本: 東は 95〜105 に 密集、西は 60〜140 に 散らばる) */
const EAST = [95, 98, 98, 100, 100, 100, 100, 102, 102, 105];
const WEST = [60, 70, 85, 95, 100, 100, 105, 115, 130, 140];

/** ドットプロット 1 段(base の 高さに 軸)。同じ 値は 上に 積む */
function dotRow(data: number[], base: number, name: string, opts: { mean?: boolean; range?: { at: DiagramPt; s: string } }): DiagramItem[] {
  const items: DiagramItem[] = [{ t: 'seg', a: [58, base], b: [142, base] }];
  for (let v = 60; v <= 140; v += 10) {
    items.push({ t: 'seg', a: [v, base], b: [v, base - 0.9] });
    if (v % 20 === 0) items.push({ t: 'text', p: [v, base - 3], s: String(v) });
  }
  items.push({ t: 'text', p: [44, base + 1.5], s: name });
  const lo = Math.min(...data);
  const hi = Math.max(...data);
  const seen = new Map<number, number>();
  for (const v of data) {
    const k = seen.get(v) ?? 0;
    seen.set(v, k + 1);
    items.push({ t: 'dot', p: [v, base + 1.6 + k * 1.8], tone: opts.range && (v === lo || v === hi) ? 'ask' : 'ink' });
  }
  if (opts.mean) {
    items.push({ t: 'seg', a: [100, base], b: [100, base + 8.4], tone: 'faint', dash: true });
    items.push({ t: 'text', p: [100, base + 9.6], s: '平均 100', tone: 'faint' });
  }
  if (opts.range) items.push({ t: 'text', p: opts.range.at, s: opts.range.s, tone: 'ask' });
  return items;
}

function dotPlots(range: boolean): DiagramSpec {
  return {
    kind: 'diagram',
    view: [33, -5.5, 115, 37.5],
    width: 560,
    label: '東の村と 西の村の 収穫(ドットプロット)',
    items: [
      ...dotRow(EAST, 21, '東の村', range ? { range: { at: [127, 24], s: '範囲 105−95=10' } } : { mean: true }),
      ...dotRow(WEST, 0, '西の村', range ? { range: { at: [100, 7.6], s: '範囲 140−60=80' } } : { mean: true }),
    ],
  };
}

/** 2 つの 村の ヒストグラム(階級の 幅 20)。同じ 目盛りで 横に 並べる(形を くらべる ため) */
function histograms(): DiagramSpec {
  const edges = [60, 80, 100, 120, 140, 160];
  const count = (data: number[]) => edges.slice(0, -1).map((lo) => data.filter((v) => v >= lo && v < lo + 20).length);
  const bw = 10;
  const unit = 3.6;
  const one = (data: number[], x0: number, name: string): DiagramItem[] => {
    const items: DiagramItem[] = [];
    count(data).forEach((c, i) => {
      const x = x0 + i * bw;
      if (c > 0) {
        items.push({ t: 'poly', pts: [[x, 0], [x + bw, 0], [x + bw, c * unit], [x, c * unit]], fill: true });
        items.push({ t: 'text', p: [x + bw / 2, c * unit + 2.2], s: String(c) });
      }
    });
    items.push({ t: 'seg', a: [x0 - 1, 0], b: [x0 + bw * 5 + 1, 0] });
    edges.forEach((e, i) => items.push({ t: 'text', p: [x0 + i * bw, -3.6], s: String(e) }));
    items.push({ t: 'text', p: [x0 + bw * 2.5, 32], s: name });
    return items;
  };
  return {
    kind: 'diagram',
    view: [-6, -6.5, 128, 41.5],
    width: 560,
    label: '東の村と 西の村の 収穫(ヒストグラム)',
    items: [...one(EAST, 0, '東の村'), ...one(WEST, 66, '西の村')],
  };
}

// ---------------------------------------------------------------- 一覧

export const TALK_FIGURES: Record<string, FigureSpec | FigureSpec[]> = {
  c5_angle_line: { kind: 'angles', rays: [180, 140, 0], rayLabels: ['A', 'C', 'B'], center: 'O', marks: [{ from: 0, to: 1, label: '40°' }, { from: 1, to: 2, label: 'x' }] },
  c5_mural_all: mural({ A: 'show', B: 'show', C: 'show', D: 'show' }),
  c5_mural_ab: mural({ A: 'show', B: 'mark', C: 'faint', D: 'faint' }),
  c5_mural_slide: mural({ A: 'show', B: 'mark', C: 'faint', D: 'faint' }, arrow([1, 2.5], [6, 2.5])),
  // まちがえた 動かし方: その 形を B の 上に 点線で 重ねて、向きが 合わない ことを 見せる
  c5_mural_turn: mural({ A: 'show', B: 'mark', C: 'faint', D: 'faint' }, [{ t: 'poly', pts: shift(A.map(([x, y]): DiagramPt => [-y, x]), 8), dash: true }]),
  c5_mural_flip: mural({ A: 'show', B: 'mark', C: 'faint', D: 'faint' }, [{ t: 'poly', pts: shift(A.map(([x, y]): DiagramPt => [-x, y]), 8), dash: true }]),
  c5_mural_moves: mural({ A: 'show', B: 'mark', C: 'mark', D: 'mark' }, [AXIS], { B: '平行移動', C: '回転移動', D: '対称移動' }),
  c5_mural_ad: mural({ A: 'show', B: 'faint', C: 'faint', D: 'mark' }, [AXIS]),
  // 折り返しで 重なる 点どうしを 結ぶ(軸と 垂直に 交わり、軸で 2 等分される)
  c5_mural_fold: mural({ A: 'show', B: 'faint', C: 'faint', D: 'mark' }, [AXIS, ...A.map((p, i): DiagramItem => ({ t: 'seg', a: p, b: D[i], tone: 'faint', dash: true }))], { D: '対称移動' }),
  c5_mural_squares: squaresMural(),

  c6_net_prism: prismNet(),
  c6_prism: PRISM,
  c6_prism_both: [PRISM, prismNet()],
  c6_net_cylinder: cylinderNet('?', 'ask'),
  c6_cylinder_wrap: [{ kind: 'solid', shape: 'cylinder', labels: { radius: 'r' } }, cylinderNet('2πr', 'ink')],

  c7_dots: dotPlots(false),
  c7_dots_range: dotPlots(true),
  c7_hist: histograms(),
};
