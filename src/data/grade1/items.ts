/**
 * アイテムと装備(要件 F23 F31)。台本に登場する報酬・店の品はここで定義する。
 * 効果は種類(kind)で決まり、エンジンは kind と値だけを見る。
 */
export type ItemKind = 'consumable' | 'weapon' | 'armor' | 'accessory';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  emoji: string;
  /** 店での価格。undefined = 非売品 */
  price?: number;
  description: string;
  /** consumable: 使ったときの効果 */
  use?: { heal?: number; healFull?: boolean; hint?: number; time?: number };
  /** weapon/armor/accessory: 装備中の補正 */
  stat?: { attack?: number; defense?: number; timeBonus?: number; hintBonus?: number; expMul?: number };
}

export const items: Record<string, ItemDef> = {
  // --- 消耗品 ---
  potion: { id: 'potion', name: '薬草', kind: 'consumable', emoji: '🌿', price: 15, description: 'HP を 20 回復する', use: { heal: 20 } },
  hi_potion: { id: 'hi_potion', name: '大回復薬', kind: 'consumable', emoji: '🧪', price: 60, description: 'HP を 全回復する', use: { healFull: true } },
  hint_feather: {
    id: 'hint_feather',
    name: 'ヒントの羽根',
    kind: 'consumable',
    emoji: '🪶',
    price: 25,
    description: 'この戦いで 使える ヒントが 1回 増える',
    use: { hint: 1 },
  },
  time_sand: { id: 'time_sand', name: '砂時計の砂', kind: 'consumable', emoji: '⏳', price: 20, description: 'いまの問題の 残り時間を 15秒 のばす', use: { time: 15 } },

  // --- 武器(与ダメージ↑) ---
  wooden_sword: { id: 'wooden_sword', name: '木の剣', kind: 'weapon', emoji: '🗡️', price: 30, description: 'こうげき +4', stat: { attack: 4 } },
  iron_sword: { id: 'iron_sword', name: '鉄の剣', kind: 'weapon', emoji: '⚔️', price: 120, description: 'こうげき +9', stat: { attack: 9 } },
  silver_sword: { id: 'silver_sword', name: '銀の剣', kind: 'weapon', emoji: '🔪', price: 300, description: 'こうげき +15', stat: { attack: 15 } },

  // --- 防具(被ダメージ↓) ---
  cloth_armor: { id: 'cloth_armor', name: '布の服', kind: 'armor', emoji: '👕', price: 25, description: 'ぼうぎょ +2', stat: { defense: 2 } },
  leather_shield: { id: 'leather_shield', name: '革の盾', kind: 'armor', emoji: '🛡️', price: 90, description: 'ぼうぎょ +4', stat: { defense: 4 } },
  mirror_shield: { id: 'mirror_shield', name: '水鏡の盾', kind: 'armor', emoji: '🪞', description: 'ぼうぎょ +7', stat: { defense: 7 } },
  miner_helmet: { id: 'miner_helmet', name: '山師の兜', kind: 'armor', emoji: '⛑️', description: 'ぼうぎょ +6', stat: { defense: 6 } },

  // --- 装飾品 ---
  travel_boots: { id: 'travel_boots', name: '旅人のブーツ', kind: 'accessory', emoji: '👢', description: '制限時間 +5秒', stat: { timeBonus: 5 } },
  guardian_bracelet: { id: 'guardian_bracelet', name: '番人の腕輪', kind: 'accessory', emoji: '📿', description: 'ヒントの回数 +1', stat: { hintBonus: 1 } },
  recorder_pen: { id: 'recorder_pen', name: '記録者のペン', kind: 'accessory', emoji: '🖋️', description: '経験値 +10%', stat: { expMul: 1.1 } },
};

export function getItem(id: string): ItemDef {
  const it = items[id];
  if (!it) throw new Error(`アイテムが未定義: ${id}`);
  return it;
}

/** 第1章の村で売っている品 */
export const villageShop = {
  tools: ['potion', 'hint_feather', 'time_sand', 'hi_potion'],
  gear: ['wooden_sword', 'cloth_armor', 'iron_sword', 'leather_shield'],
};
