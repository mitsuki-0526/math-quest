/**
 * 登場人物の一元管理。台本(docs/script)と設定資料(docs/setting.md)の仮名はここで表示名に変換する。
 * 名前を変えるときはこのファイルだけを編集する。会話スクリプトはキャラID(キー)で人物を指す。
 */
export interface Character {
  /** 会話枠に出す表示名 */
  name: string;
  /** 立ち絵の素材ID(assets/manifest)。ない場合は絵文字プレースホルダ */
  sprite?: string;
  /** プレースホルダ用の絵文字 */
  emoji: string;
}

export const characters = {
  player: { name: 'ユウ', sprite: 'char_player', emoji: '🧑' },
  pita: { name: 'ピタ', sprite: 'char_pita', emoji: '🦉' },
  teo: { name: 'テオ', sprite: 'char_teo', emoji: '🧔' },
  elder: { name: '村長', sprite: 'char_elder', emoji: '👴' },
  rena: { name: 'レナ', sprite: 'char_rena', emoji: '🛡️' },
  noa: { name: 'ノア', emoji: '🧙' },
  zenon: { name: 'ゼノン', emoji: '🧙‍♂️' },
  mei: { name: 'メイ', emoji: '👧' },
  cat_x: { name: 'エックス', emoji: '🐈‍⬛' },
  // 第4章のボス「湖の双子竜」は 1 体の敵だが、会話では 2 頭が別々に話す
  narabi: { name: 'ナラビ', sprite: 'enemy_twin_dragons', emoji: '🐉' },
  sakasa: { name: 'サカサ', sprite: 'enemy_twin_dragons', emoji: '🐲' },
  narrator: { name: '', emoji: '' },
} as const satisfies Record<string, Character>;

export type CharacterId = keyof typeof characters;

/** 主人公の見た目(最初に選ぶ)。立ち絵の素材IDとプレースホルダ */
export const playerLooks = {
  boy: { label: '男の子', sprite: 'char_player_boy', emoji: '👦' },
  girl: { label: '女の子', sprite: 'char_player_girl', emoji: '👧' },
  neutral: { label: 'きめない', sprite: 'char_player', emoji: '🧑' },
} as const;

export function playerSprite(look: keyof typeof playerLooks | undefined): string {
  return playerLooks[look ?? 'neutral'].sprite;
}

/** 主人公の既定名(名前入力の初期値) */
export const DEFAULT_PLAYER_NAME: string = characters.player.name;
export const PLAYER_NAME_MAX = 6;
