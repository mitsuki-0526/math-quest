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
  mei: { name: 'ミオ', sprite: 'char_mei', emoji: '👧' },
  cat_x: { name: 'エックス', sprite: 'char_cat_x', emoji: '🐈‍⬛' },
  // 第4章のボス「湖の双子竜」は 1 体の敵だが、会話では 2 頭が別々に話す
  narabi: { name: 'ナラビ', sprite: 'enemy_twin_dragons', emoji: '🐉' },
  sakasa: { name: 'サカサ', sprite: 'enemy_twin_dragons', emoji: '🐲' },
  narrator: { name: '', emoji: '' },
} as const satisfies Record<string, Character>;

export type CharacterId = keyof typeof characters;

/**
 * 名前が まだ 分からない 話し手(台本の「npc:羊飼いの少女」など)のうち、登場人物と 同じ人の 立ち絵を 使うもの。
 * 羊飼いの少女は 名前を 思い出す前の ミオ(第2章)。名前の ない ほかの NPC は 立ち絵を 出さない
 */
export const npcLooks: Record<string, CharacterId> = {
  羊飼いの少女: 'mei',
  // 第3章の 未知なる影 X の 正体。名前(エックス)が つく前は「黒猫」
  黒猫: 'cat_x',
};

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

/** 主人公の名前として 使えるか(前後の 空白を 除いて 1〜PLAYER_NAME_MAX 文字)。はじめの 名前入力と 名前の 変更で 同じ 決まり */
export function playerNameOk(name: string): boolean {
  const t = name.trim();
  return t.length > 0 && t.length <= PLAYER_NAME_MAX;
}
