import type { SaveData } from './save';

/**
 * 授業の集計のための記録(要件 F71。難易度調整の ④)。
 * 地点 × 出題タイプ × ★ ごとに、回答数・正解数・かかった秒数・ヒントを使った数・時間切れの数を数える。
 * セーブといっしょに送られ、先生がスプレッドシートのメニュー「集計を更新する」を押すと summary シートにまとまる。
 * 名前(地点名・出題タイプ名)と地点の順番も持たせる(GAS はゲームのデータを知らないので、表に日本語で出すため)
 */
export interface TallyData {
  /** `章ID.地点ID|出題タイプ|★` → [回答数, 正解数, 秒数の合計, ヒントを使った数, 時間切れの数] */
  c: Record<string, [number, number, number, number, number]>;
  /** 地点ID・出題タイプID → 表示名 */
  names: Record<string, string>;
  /** 地点ID → 章の中での順番(表を 地図の順に 並べるため) */
  order: Record<string, number>;
}

/** 1 問の秒数の上限(席を離れていた時間などで 平均が 崩れないように) */
const MAX_SECONDS = 300;

export interface TallyAnswer {
  nodeId: string;
  nodeName: string;
  nodeOrder: number;
  templateId: string;
  templateTitle: string;
  star: number;
  correct: boolean;
  seconds: number;
  hinted: boolean;
  timedOut: boolean;
}

export function recordTally(d: SaveData, a: TallyAnswer): void {
  const t = (d.tally ??= { c: {}, names: {}, order: {} });
  const k = `${a.nodeId}|${a.templateId}|${a.star}`;
  const row = (t.c[k] ??= [0, 0, 0, 0, 0]);
  row[0]++;
  if (a.correct) row[1]++;
  row[2] += Math.round(Math.min(Math.max(a.seconds, 0), MAX_SECONDS));
  if (a.hinted) row[3]++;
  if (a.timedOut) row[4]++;
  t.names[a.nodeId] = a.nodeName;
  t.names[a.templateId] = a.templateTitle;
  t.order[a.nodeId] = a.nodeOrder;
}
