/** 章・ノード・敵などのデータ定義(scenario.md §8 に対応)。エンジンはこの型だけを見る。 */

export type NodeType = 'town' | 'battle' | 'event' | 'secret' | 'boss';

export interface NodeDef {
  id: string;
  type: NodeType;
  /** マップ上の表示名 */
  name: string;
  /** マップ上の座標(0〜100 の相対値) */
  x: number;
  y: number;
  /** 進める先のノードID */
  next: string[];
  /** battle / secret / boss: 出現する敵ID(戦闘ごとの組み合わせ) */
  enemies?: string[][];
  /** event: 再生する会話スクリプトID */
  script?: string;
  /** battle/secret: 初めて入るときに再生する導入会話(1回だけ) */
  intro?: string;
  /** boss: 戦闘前後のスクリプトID */
  before?: string;
  after?: string;
  /** secret: 出現条件となるノードID(クリア後に出現) */
  revealAfter?: string;
  /** 報酬(アイテムID) */
  reward?: { item: string; count?: number };
  /** 背景の素材ID */
  bg?: string;
}

export interface ChapterDef {
  id: string;
  /** 章番号(表示用) */
  number: number;
  title: string;
  /** 単元名(教科書の章名) */
  unit: string;
  /** 碑文(章の一文) */
  inscription: string;
  nodes: NodeDef[];
  /** この章で出る問題テンプレート(修練の泉・今日のクエストの候補) */
  templates?: string[];
  /** 章に初めて入ったときに再生する会話(1回だけ) */
  intro?: string;
  /** 章クリア時に解放候補となる次章ID */
  nextChapter?: string;
}

export interface GradeDef {
  id: string;
  title: string;
  chapters: ChapterDef[];
}
