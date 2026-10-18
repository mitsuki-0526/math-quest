import type { DiagramItem, DiagramPt, DiagramSpec } from '@/math/figure';

/**
 * 第6章の 図のうち、見取図(Figure の 'solid')に ない 形を 点・線の 図(diagram)で 作る。
 *   - 角柱・角錐・正多面体の 見取図(凸な 立体を 斜め上から 見て、見えない 辺は 点線)
 *   - 展開図(立方体・三角柱・円柱・円錐・正四角錐)
 *   - 回転体の もとの 図形と 軸
 * 先生の 判定(2026-10-18)「図を 提示して ください」「展開図を 提示して ください」「軸と 回転前の 図を ください」
 */

type V3 = [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

interface Hull {
  pts: V3[];
  /** 面(頂点の 番号。外から 見て 反時計回り)と 外向きの 法線 */
  faces: { vs: number[]; n: V3 }[];
  /** 辺(両はしの 番号)と、となりあう 2 つの 面の 番号 */
  edges: { a: number; b: number; faces: number[] }[];
}

/** 頂点の 集まりから 凸な 立体の 面と 辺を 求める(頂点は 20 個まで なので 3 つ組を 全部 調べて よい) */
function hull(pts: V3[]): Hull {
  const eps = 1e-6;
  const faces: { vs: number[]; n: V3 }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      for (let k = j + 1; k < pts.length; k++) {
        let n = cross(sub(pts[j], pts[i]), sub(pts[k], pts[i]));
        if (Math.hypot(...n) < eps) continue;
        n = norm(n);
        const d = dot(n, pts[i]);
        const side = pts.map((p) => dot(n, p) - d);
        const pos = side.some((v) => v > eps);
        const neg = side.some((v) => v < -eps);
        if (pos && neg) continue;
        if (pos) n = [-n[0], -n[1], -n[2]];
        const on = side.map((v, idx) => (Math.abs(v) <= eps ? idx : -1)).filter((idx) => idx >= 0);
        const key = on.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        // 面の 中心の まわりに 反時計回り(外から 見て)に 並べる
        const c = on.reduce<V3>((s, idx) => [s[0] + pts[idx][0] / on.length, s[1] + pts[idx][1] / on.length, s[2] + pts[idx][2] / on.length], [0, 0, 0]);
        const u = norm(sub(pts[on[0]], c));
        const v = cross(n, u);
        const vs = [...on].sort((p, q) => {
          const ap = Math.atan2(dot(sub(pts[p], c), v), dot(sub(pts[p], c), u));
          const aq = Math.atan2(dot(sub(pts[q], c), v), dot(sub(pts[q], c), u));
          return ap - aq;
        });
        faces.push({ vs, n });
      }
  const edges: Hull['edges'] = [];
  faces.forEach((f, fi) =>
    f.vs.forEach((a, t) => {
      const b = f.vs[(t + 1) % f.vs.length];
      const e = edges.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
      if (e) e.faces.push(fi);
      else edges.push({ a, b, faces: [fi] });
    }),
  );
  return { pts, faces, edges };
}

/** 斜め上から 見た 向き(yaw: 縦の 軸の まわり、pitch: 見下ろす 角度。度)。z が 上 */
function view(p: V3, yaw: number, pitch: number): V3 {
  const t = (yaw * Math.PI) / 180;
  const f = (pitch * Math.PI) / 180;
  const x1 = p[0] * Math.cos(t) - p[1] * Math.sin(t);
  const y1 = p[0] * Math.sin(t) + p[1] * Math.cos(t);
  // Y は 奥行き(小さいほど 手前)。画面は (X, Z)
  return [x1, y1 * Math.cos(f) - p[2] * Math.sin(f), y1 * Math.sin(f) + p[2] * Math.cos(f)];
}

export interface Drawn {
  items: DiagramItem[];
  /** 画面での 頂点の 位置 */
  at: DiagramPt[];
  /** 手前に 見える 辺(赤く する 辺を 選ぶのに 使う)。奥行きが 小さい(手前)順 */
  frontEdges: [number, number][];
  hullOf: Hull;
}

/** 凸な 立体の 見取図。見えない 辺は 点線、ask の 辺は 赤 */
export function drawConvex(pts: V3[], opt: { yaw: number; pitch: number; ask?: [number, number][] }): Drawn {
  const h = hull(pts);
  const vp = pts.map((p) => view(p, opt.yaw, opt.pitch));
  const at: DiagramPt[] = vp.map((p) => [p[0], p[2]]);
  // 面の 法線も 同じ 向きに 回す(平行移動は ないので 点と 同じ 式で よい)
  const front = h.faces.map((f) => view(f.n, opt.yaw, opt.pitch)[1] < -1e-6);
  const isAsk = (a: number, b: number) => (opt.ask ?? []).some(([p, q]) => (p === a && q === b) || (p === b && q === a));
  const items: DiagramItem[] = [];
  h.faces.forEach((f, fi) => {
    if (front[fi]) items.push({ t: 'poly', pts: f.vs.map((v) => at[v]), tone: 'ink', fill: true });
  });
  const visible = (e: Hull['edges'][number]) => e.faces.some((fi) => front[fi]);
  for (const e of h.edges) if (!visible(e)) items.push({ t: 'seg', a: at[e.a], b: at[e.b], tone: 'faint', dash: true });
  for (const e of h.edges) if (isAsk(e.a, e.b)) items.push({ t: 'seg', a: at[e.a], b: at[e.b], tone: 'ask', dash: !visible(e) });
  const frontEdges = h.edges
    .filter(visible)
    .sort((p, q) => vp[p.a][1] + vp[p.b][1] - (vp[q.a][1] + vp[q.b][1]))
    .map((e) => [e.a, e.b] as [number, number]);
  return { items, at, frontEdges, hullOf: h };
}

/** 描いた 点が 収まる 範囲(まわりに pad の 余白) */
export function fit(at: DiagramPt[], pad: number): DiagramSpec['view'] {
  const xs = at.map((p) => p[0]);
  const ys = at.map((p) => p[1]);
  const x0 = Math.min(...xs) - pad;
  const y0 = Math.min(...ys) - pad;
  return [x0, y0, Math.max(...xs) + pad - x0, Math.max(...ys) + pad - y0];
}

/** 正 n 角形(半径 1、z の 高さ) */
const ngon = (n: number, z: number, rot = 0): V3[] =>
  Array.from({ length: n }, (_, i) => {
    const a = ((rot + (360 * i) / n) * Math.PI) / 180;
    return [Math.cos(a), Math.sin(a), z] as V3;
  });

/** n 角柱の 頂点(下の 底面 0..n−1、上の 底面 n..2n−1) */
export const prismPts = (n: number, h = 1.5): V3[] => [...ngon(n, 0, 90), ...ngon(n, h, 90)];
/** n 角錐の 頂点(底面 0..n−1、頂点 n) */
export const pyramidPts = (n: number, h = 1.7): V3[] => [...ngon(n, 0, 90), [0, 0, h]];

const PHI = (1 + Math.sqrt(5)) / 2;
const signs = (...xs: number[]): number[][] =>
  xs.reduce<number[][]>((acc, x) => acc.flatMap((a) => (x === 0 ? [[...a, 0]] : [[...a, x], [...a, -x]])), [[]]);

/** 正多面体の 頂点 */
export function regularPts(name: string): V3[] {
  // 正四面体は 教科書と 同じく 底面を 下に 置く(底面の 外接円の 半径 1 → 1 辺 √3、高さ √2)
  if (name.startsWith('正四面体')) return pyramidPts(3, Math.SQRT2);
  if (name.startsWith('正六面体')) return signs(1, 1, 1) as V3[];
  if (name.startsWith('正八面体')) return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  if (name.startsWith('正十二面体'))
    return [...signs(1, 1, 1), ...signs(0, 1 / PHI, PHI), ...signs(1 / PHI, PHI, 0).map(([a, b]) => [a, b, 0]), ...signs(PHI, 0, 1 / PHI).map(([a, , c]) => [a, 0, c])] as V3[];
  // 正二十面体
  return [...signs(0, 1, PHI), ...signs(1, PHI, 0).map(([a, b]) => [a, b, 0]), ...signs(PHI, 0, 1).map(([a, , c]) => [a, 0, c])] as V3[];
}

/** 立体の 見取図を 図に する(width は 描く 幅 px) */
export function solidDiagram(d: Drawn, label: string, width = 230): DiagramSpec {
  return { kind: 'diagram', view: fit(d.at, 0.15), items: d.items, width, label };
}

// ---------------------------------------------------------------- 展開図

export type NetKind = 'cube' | 'triPrism' | 'cylinder' | 'cone' | 'squarePyramid';
/** 赤く する 所(円錐: 弧・半径、円柱: 側面の 横の 辺) */
export type NetAsk = 'arc' | 'radius' | 'sideWidth';

export function netDiagram(kind: NetKind, ask?: NetAsk): DiagramSpec {
  const items: DiagramItem[] = [];
  const sq = (x: number, y: number, s = 1): DiagramPt[] => [
    [x, y],
    [x + s, y],
    [x + s, y + s],
    [x, y + s],
  ];
  if (kind === 'cube') {
    // 十字の 形(教科書の いちばん 多い 形)
    for (const [x, y] of [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]]) items.push({ t: 'poly', pts: sq(x, y), tone: 'ink', fill: true });
    return { kind: 'diagram', view: [-0.2, -0.2, 4.4, 3.4], items, width: 260, label: '立方体の 展開図' };
  }
  if (kind === 'triPrism') {
    // 底面は 3・4・5 の 直角三角形。側面の 長方形 3 つを 横に、底面を 上と 下に
    const h = 2;
    const w = [1.2, 1.6, 2];
    let x = 0;
    for (const wi of w) {
      items.push({ t: 'poly', pts: [[x, 0], [x + wi, 0], [x + wi, h], [x, h]], tone: 'ink', fill: true });
      x += wi;
    }
    items.push({ t: 'poly', pts: [[0, h], [1.2, h], [0, h + 1.6]], tone: 'ink', fill: true });
    items.push({ t: 'poly', pts: [[0, 0], [1.2, 0], [0, -1.6]], tone: 'ink', fill: true });
    return { kind: 'diagram', view: [-0.2, -1.8, 5.2, 5.6], items, width: 240, label: '三角柱の 展開図' };
  }
  if (kind === 'cylinder') {
    const r = 0.55;
    const W = 2 * Math.PI * r;
    const h = 1.6;
    items.push({ t: 'poly', pts: [[0, 0], [W, 0], [W, h], [0, h]], tone: 'ink', fill: true });
    items.push({ t: 'circle', c: [W / 2, h + r], r, tone: 'ink' });
    items.push({ t: 'circle', c: [W / 2, -r], r, tone: 'ink' });
    if (ask === 'sideWidth') items.push({ t: 'seg', a: [0, 0], b: [W, 0], tone: 'ask' });
    return { kind: 'diagram', view: [-0.2, -2 * r - 0.2, W + 0.4, h + 4 * r + 0.4], items, width: 240, label: '円柱の 展開図' };
  }
  if (kind === 'cone') {
    // 母線 2.4、底面の 半径 0.8 → 中心角 120°。おうぎ形は 下向きに 開き、円は 弧の まん中に 接する
    const l = 2.4;
    const r = 0.8;
    const from = 210;
    const to = 330;
    const P = (deg: number): DiagramPt => [l * Math.cos((deg * Math.PI) / 180), l * Math.sin((deg * Math.PI) / 180)];
    const arcPts: DiagramPt[] = Array.from({ length: 25 }, (_, i) => P(from + ((to - from) * i) / 24));
    items.push({ t: 'poly', pts: [[0, 0], ...arcPts], tone: 'ink', fill: true });
    items.push({ t: 'circle', c: [0, -l - r], r, tone: 'ink' });
    if (ask === 'arc') items.push({ t: 'arc', c: [0, 0], r: l, from, to, tone: 'ask' });
    if (ask === 'radius') {
      items.push({ t: 'seg', a: [0, 0], b: P(from), tone: 'ask' });
      items.push({ t: 'seg', a: [0, 0], b: P(to), tone: 'ask' });
    }
    return { kind: 'diagram', view: [-2.3, -l - 2 * r - 0.2, 4.6, l + 2 * r + 0.4], items, width: 220, label: '円錐の 展開図' };
  }
  // 正四角錐: 正方形の まわりに 二等辺三角形 4 つ
  const s = 1.2;
  const t = 1.3;
  items.push({ t: 'poly', pts: sq(0, 0, s), tone: 'ink', fill: true });
  items.push({ t: 'poly', pts: [[0, s], [s, s], [s / 2, s + t]], tone: 'ink', fill: true });
  items.push({ t: 'poly', pts: [[0, 0], [s, 0], [s / 2, -t]], tone: 'ink', fill: true });
  items.push({ t: 'poly', pts: [[0, 0], [0, s], [-t, s / 2]], tone: 'ink', fill: true });
  items.push({ t: 'poly', pts: [[s, 0], [s, s], [s + t, s / 2]], tone: 'ink', fill: true });
  return { kind: 'diagram', view: [-t - 0.2, -t - 0.2, s + 2 * t + 0.4, s + 2 * t + 0.4], items, width: 220, label: '正四角錐の 展開図' };
}

// ---------------------------------------------------------------- 回転体の もとの 図形

/**
 * 軸(縦の 点線)と、軸に 1 辺(半円は 直径)を つけた 図形。
 * a は 軸の 上の 長さ、b は 横の 長さ(半円は 半径)。aLabel・bLabel は 辺に 書く 長さ
 */
export function rotationDiagram(shape: 'rect' | 'tri' | 'semi', a: number, b: number, aLabel?: string, bLabel?: string): DiagramSpec {
  // 長さの 比は そのまま、図の 大きさを そろえる(大きい ほうを 3 に)
  const k = 3 / Math.max(a, b, 1);
  const A = shape === 'semi' ? 2 * b * k : a * k;
  const B = b * k;
  const y0 = shape === 'semi' ? -A / 2 : 0;
  const items: DiagramItem[] = [];
  const pad = 0.5;
  const top = y0 + A + 0.7;
  const bottom = y0 - 0.5;
  items.push({ t: 'seg', a: [0, bottom], b: [0, top], tone: 'faint', dash: true });
  items.push({ t: 'text', p: [0, top + 0.28], s: '軸' });
  if (shape === 'rect') items.push({ t: 'poly', pts: [[0, 0], [B, 0], [B, A], [0, A]], tone: 'ink', fill: true });
  if (shape === 'tri') items.push({ t: 'poly', pts: [[0, 0], [B, 0], [0, A]], tone: 'ink', fill: true });
  if (shape === 'semi') {
    const arc: DiagramPt[] = Array.from({ length: 25 }, (_, i) => {
      const t = -90 + (180 * i) / 24;
      return [B * Math.cos((t * Math.PI) / 180), B * Math.sin((t * Math.PI) / 180)];
    });
    items.push({ t: 'poly', pts: arc, tone: 'ink', fill: true });
  }
  // 直角の 印(長方形・直角三角形の 軸の 下の 角)
  if (shape !== 'semi') {
    const m = 0.22;
    items.push({ t: 'poly', pts: [[0, 0], [m, 0], [m, m], [0, m]], tone: 'ink' });
  }
  // 長さは 教科書と 同じ 切れ目の ある 弧で(軸の 上の 辺は 左へ、下の 辺は 下へ ふくらむ)
  const inside: DiagramPt = [B / 3, y0 + A / 3];
  if (aLabel) items.push({ t: 'len', a: [0, y0], b: [0, y0 + A], s: aLabel, inside });
  if (bLabel) items.push({ t: 'len', a: [0, 0], b: [B, 0], s: bLabel, inside });
  const left = aLabel ? -1.3 : -0.6;
  const v0 = bottom - (bLabel ? 0.45 : 0);
  const vw = Math.max(B, 0.6) + pad - left;
  const vh = top + 0.6 - v0;
  // 縦長の 図形(縦 7・横 2 など)でも 高さを 220px ほどに おさえる(低い 画面で 問題窓から はみ出さない)
  const width = Math.round(Math.min(240, (220 * vw) / vh));
  return { kind: 'diagram', view: [left, v0, vw, vh], items, width, label: '回転させる 図形と 軸' };
}
