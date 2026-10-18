/**
 * 問題に添える図の指定(要件 F48)。描画は ui/components/Figure.tsx が行う。
 * テンプレートは座標やラベルだけを書き、見た目(色・線の太さ)は描画側に任せる。
 */

/** 数直線(第1章) */
export interface NumberLineSpec {
  kind: 'numberline';
  min: number;
  max: number;
  step?: number;
  labels?: number[];
  points: { value: number; label: string }[];
  arrows?: { from: number; to: number; label?: string }[];
}

/** 座標平面とグラフ(第4章) */
export interface PlaneSpec {
  kind: 'plane';
  /** 表示範囲(±range)。既定 6 */
  range?: number;
  /** 比例 y=ax / 反比例 y=a/x のグラフ */
  graphs?: { type: 'prop' | 'invprop'; a: number; label?: string }[];
  points?: { x: number; y: number; label: string }[];
  /** 破線の補助線を引く点 */
  guides?: { x: number; y: number }[];
}

/** 角の図(第5章)。中心から伸びる半直線と、そのあいだの角 */
export interface AnglesSpec {
  kind: 'angles';
  /** 交わる2直線 or 中心から出る半直線の角度(度)。0 が右、反時計回り */
  rays: number[];
  /** 直線(反対側にも伸ばす)にするか */
  throughLines?: boolean;
  /** 角の表示: 2本の ray の番号と、ラベル(数値 or "x") */
  marks: { from: number; to: number; label: string }[];
  /** 半直線の 先の 点の 名前(A・B・C …)と 中心の 名前(O)。∠AOB の 形で 問う ときに 使う(教科書の 書き方) */
  rayLabels?: string[];
  center?: string;
  /** 半直線の 先を 順に 結ぶ(正六角形の 外わく) */
  outline?: boolean;
  /**
   * 中心と 2 本の 半直線の 先で できる 三角形を 塗る(回転移動で 動かす 三角形 'ink' と 重ねる 先 'ask'。
   * 先生の指摘 2026-10-18「移動する 三角形が どれか 分かりやすく」)
   */
  fills?: { from: number; to: number; tone: 'ink' | 'ask' }[];
  /** 直角の 記号(小さな 四角)を 付ける 2 本の 半直線の 番号(先生の指摘 2026-10-18「90° は 直角の 記号だけで」) */
  rights?: [number, number][];
}

/** おうぎ形(第5章) */
export interface SectorSpec {
  kind: 'sector';
  radius: number;
  /** 中心角(度)。unknown なら「?」で表示 */
  angle: number | null;
  radiusLabel?: string;
  angleLabel?: string;
  /** 弧の長さ・面積の表示(分かっている方) */
  note?: string;
}

/** 立体の見取図(第6章) */
export interface SolidSpec {
  kind: 'solid';
  shape: 'prism3' | 'prism4' | 'cylinder' | 'pyramid4' | 'cone' | 'sphere' | 'hemisphere';
  /** 寸法のラベル(底面の辺・半径・高さなど) */
  labels: { base?: string; base2?: string; height?: string; radius?: string; slant?: string; diameter?: string; hyp?: string; faceHeight?: string };
  /** 頂点の 名前を 書く(直方体 A〜H・三角柱 A〜F)。辺や 面の 位置関係を 問う ときに 使う */
  vertices?: boolean;
}

/**
 * 方眼に かいた 多角形(第5章 図形の移動)。座標は 方眼の ます目(左下が 0, 0、上が +)。
 * 移動の 前を 'from'、後を 'to' で 塗り分ける。回転の 中心(点)・対称の軸(線)・矢印も 描ける
 */
export interface GridSpec {
  kind: 'grid';
  w: number;
  h: number;
  shapes: { points: [number, number][]; label: string; tone: 'from' | 'to' | 'other'; vertexLabels?: string[] }[];
  points?: { x: number; y: number; label: string }[];
  lines?: { x1: number; y1: number; x2: number; y2: number; label?: string; arrow?: boolean }[];
}

/**
 * 点・線分・直線・円・多角形を 組み合わせた 図(第5章 対称・作図の 状況の 図など)。
 * 座標は 好きな 単位で(y は 上が +)、view の 範囲を 幅 width px に 描く。
 * 色は 'ink'(黒)・'ask'(赤: 答えに かかわる 所)・'faint'(灰: 補助)の 3 つだけ
 */
export type DiagramTone = 'ink' | 'ask' | 'faint';
export type DiagramPt = [number, number];
export type DiagramItem =
  | { t: 'seg'; a: DiagramPt; b: DiagramPt; tone?: DiagramTone; dash?: boolean }
  /** 両方へ 図の はしまで のばす 直線 */
  | { t: 'line'; a: DiagramPt; b: DiagramPt; tone?: DiagramTone; dash?: boolean }
  | { t: 'poly'; pts: DiagramPt[]; tone?: DiagramTone; fill?: boolean; dash?: boolean }
  | { t: 'circle'; c: DiagramPt; r: number; tone?: DiagramTone; dash?: boolean }
  /** 弧(from° から to° へ 反時計回り。0° が 右) */
  | { t: 'arc'; c: DiagramPt; r: number; from: number; to: number; tone?: DiagramTone }
  /** 点と 名前。at は 名前を 置く 向き(度。0 が 右、90 が 上) */
  | { t: 'dot'; p: DiagramPt; label?: string; at?: number; tone?: DiagramTone }
  | { t: 'text'; p: DiagramPt; s: string; tone?: DiagramTone; italic?: boolean }
  /** 辺 a–b の 長さ(教科書の 切れ目の ある 弧)。inside は 図形の 内側の 点(弧は そこから 離れる 向きに ふくらむ) */
  | { t: 'len'; a: DiagramPt; b: DiagramPt; s: string; inside: DiagramPt };

export interface DiagramSpec {
  kind: 'diagram';
  /** 描く 範囲 [左, 下, 幅, 高さ] */
  view: [number, number, number, number];
  items: DiagramItem[];
  /** 描く 幅(px)。既定 300 */
  width?: number;
  /** 読み上げ用の 名前 */
  label?: string;
}

/** 投影図(第6章): 上から見た図と正面から見た図 */
export interface ProjectionSpec {
  kind: 'projection';
  top: 'circle' | 'square' | 'triangle';
  front: 'rect' | 'triangle' | 'circle';
}

/** ヒストグラム・ドットプロット(第7章) */
export interface ChartSpec {
  kind: 'chart';
  type: 'histogram' | 'dot';
  /** 階級の 境目(histogram。values より 1 こ 多い)または値(dot) */
  labels: string[];
  values: number[];
  xTitle?: string;
  yTitle?: string;
  /** 強調する階級(答えの確認用。出題時は使わない) */
  highlight?: number;
}

/** 表(第1章「基準との差」)。1 行目が見出し、各行の先頭が行の名前 */
export interface TableSpec {
  kind: 'table';
  head: string[];
  rows: string[][];
  /** 表の下に添える一言(単位など) */
  caption?: string;
}

export type FigureSpec = NumberLineSpec | PlaneSpec | AnglesSpec | SectorSpec | SolidSpec | ProjectionSpec | ChartSpec | TableSpec | GridSpec | DiagramSpec;
