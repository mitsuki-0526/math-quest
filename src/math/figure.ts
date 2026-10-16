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
  shape: 'prism3' | 'prism4' | 'cylinder' | 'pyramid4' | 'cone' | 'sphere';
  /** 寸法のラベル(底面の辺・半径・高さなど) */
  labels: { base?: string; base2?: string; height?: string; radius?: string; slant?: string };
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
  /** 階級の下限(histogram)または値(dot) */
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

export type FigureSpec = NumberLineSpec | PlaneSpec | AnglesSpec | SectorSpec | SolidSpec | ProjectionSpec | ChartSpec | TableSpec | GridSpec;
