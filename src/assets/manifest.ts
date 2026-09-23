/**
 * 素材マニフェスト(要件 F91)。素材ID → 画像パス と、画像がないときのプレースホルダ(絵文字)。
 * 画像は public/assets/ 以下に置き、ここに path を足すだけで差し替わる。
 * path が未設定/読み込み失敗なら <Sprite> が emoji を描く。
 */
export interface AssetEntry {
  /** 画像の相対パス(base からの相対)。未設定ならプレースホルダ */
  path?: string;
  /** プレースホルダ用の絵文字 */
  emoji: string;
  /** 表示上の説明(デバッグ用) */
  label: string;
}

export const assetManifest: Record<string, AssetEntry> = {
  // --- キャラ立ち絵 ---
  char_player: { emoji: '🧑', label: '主人公(きめない)' },
  char_player_boy: { emoji: '👦', label: '主人公(男の子)' },
  char_player_girl: { emoji: '👧', label: '主人公(女の子)' },
  char_pita: { emoji: '🦉', label: 'ピタ' },
  char_teo: { emoji: '🧔', label: 'テオ' },
  char_elder: { emoji: '👴', label: '村長' },
  char_rena: { emoji: '🛡️', label: 'レナ' },

  // --- 第1章の敵 ---
  enemy_minus_slime: { emoji: '👾', label: 'マイナススライム' },
  enemy_plusminus_bat: { emoji: '🦇', label: 'プラマイコウモリ' },
  enemy_abs_golem: { emoji: '🗿', label: 'ゼッタイチ・ゴーレム' },
  enemy_cross_hopper: { emoji: '🦗', label: 'クロスバッタ' },
  enemy_prime_bee: { emoji: '🐝', label: '素数バチ' },
  enemy_king_nega: { emoji: '👑', label: '符号王ネガ' },

  // --- 第2章の敵 ---
  enemy_letter_fairy: { emoji: '🧚', label: '文字の妖精エックス' },
  enemy_collect_goblin: { emoji: '👺', label: 'まとめ屋ゴブリン' },
  enemy_distribute_fox: { emoji: '🦊', label: '分配キツネ' },
  enemy_model_sheep: { emoji: '🐑', label: '表しヒツジ' },
  enemy_pattern_centipede: { emoji: '🐛', label: '規則ムカデ' },
  enemy_masked_scribe: { emoji: '🎭', label: '仮面の書記官' },

  // --- 第3章の敵 ---
  enemy_balance_slime: { emoji: '⚖️', label: 'てんびんスライム' },
  enemy_transpose_mouse: { emoji: '🐭', label: '移項ネズミ' },
  enemy_paren_troll: { emoji: '👹', label: 'かっこトロル' },
  enemy_fraction_ghost: { emoji: '👻', label: '分数ゴースト' },
  enemy_ratio_crab: { emoji: '🦀', label: '比のカニ' },
  enemy_shadow_x: { emoji: '🌑', label: '未知なる影 X' },

  // --- 第4章の敵 ---
  enemy_prop_master: { emoji: '🐟', label: '比例のヌシ' },
  enemy_invprop_strider: { emoji: '🦟', label: '反比例のアメンボ' },
  enemy_coord_jelly: { emoji: '🪼', label: '座標クラゲ' },
  enemy_graph_eel: { emoji: '🐍', label: 'グラフウナギ' },
  enemy_twin_dragons: { emoji: '🐉', label: '湖の双子竜' },

  // --- 第5章の敵 ---
  enemy_angle_gargoyle: { emoji: '🗿', label: '角度ガーゴイル' },
  enemy_mirror_spirit: { emoji: '🪞', label: '対称ミラー' },
  enemy_sector_guard: { emoji: '🛡️', label: 'おうぎ形の門番' },
  enemy_construct_ghost: { emoji: '📐', label: '作図ゴースト' },
  enemy_ring_guardian: { emoji: '💫', label: '円環の番人' },

  // --- 第6章の敵 ---
  enemy_prism_golem: { emoji: '🧱', label: '角柱ゴーレム' },
  enemy_cone_bat: { emoji: '🔺', label: '円錐コウモリ' },
  enemy_sphere_spirit: { emoji: '🔮', label: '球のスピリット' },
  enemy_face_turtle: { emoji: '🐢', label: '面のカメ' },
  enemy_projection_eagle: { emoji: '🦅', label: '投影図ワシ' },
  enemy_relation_spider: { emoji: '🕷️', label: '位置関係クモ' },
  enemy_king_poly: { emoji: '💠', label: '立体王ポリ' },

  // --- 第7章の敵 ---
  enemy_mean_ghost: { emoji: '📜', label: '平均ゴースト' },
  enemy_freq_bat: { emoji: '📊', label: '度数コウモリ' },
  enemy_median_librarian: { emoji: '🕵️', label: '中央値の司書' },
  enemy_approx_owl: { emoji: '🦉', label: '近似値フクロウ' },
  enemy_apostle: { emoji: '🕯️', label: '歪みの使徒' },

  // --- 背景 ---
  bg_title: { emoji: '🏰', label: 'タイトル' },
  bg_village_square: { emoji: '🏘️', label: 'はじまりの村' },
  bg_village_shop: { emoji: '🛒', label: 'テオ商店' },
  bg_village_bridge: { emoji: '🌉', label: '村はずれの橋' },
  bg_village_elder: { emoji: '🏠', label: '村長の家' },
  bg_forest_entrance: { emoji: '🌲', label: '森の入口' },
  bg_forest_road: { emoji: '🌳', label: '森の小道' },
  bg_forest_marsh: { emoji: '🌿', label: '符号の湿地' },
  bg_forest_cave: { emoji: '🕳️', label: '隠し洞窟' },
  bg_forest_stone: { emoji: '🪨', label: '絶対値の碑' },
  bg_forest_valley: { emoji: '🏞️', label: '乗除の谷' },
  bg_forest_cliff: { emoji: '⛰️', label: '累乗の崖' },
  bg_forest_shrine: { emoji: '🗿', label: '符号の碑' },

  // --- 第2章の背景 ---
  bg_plain_gate: { emoji: '🚪', label: '平原の関所' },
  bg_plain_village: { emoji: '🏡', label: '羊飼いの集落' },
  bg_plain_windmill: { emoji: '🌬️', label: '風車の丘' },
  bg_plain_sheepfold: { emoji: '🐑', label: '羊の囲い' },
  bg_plain_road: { emoji: '🌾', label: '草原の道' },
  bg_plain_well: { emoji: '🪣', label: '古い井戸' },
  bg_plain_stonewall: { emoji: '🧱', label: '石垣' },
  bg_plain_shrine: { emoji: '📜', label: '平原の碑' },

  // --- 第3章の背景 ---
  bg_cave_gate: { emoji: '🕳️', label: '洞窟の入口' },
  bg_cave_camp: { emoji: '🏕️', label: '野営地' },
  bg_cave_entrance: { emoji: '🔦', label: '洞窟の入口' },
  bg_cave_balance: { emoji: '⚖️', label: '第一の天秤' },
  bg_cave_corridor: { emoji: '🚇', label: '移項の回廊' },
  bg_cave_room: { emoji: '🏛️', label: 'かっこの部屋' },
  bg_cave_spring: { emoji: '💧', label: '分数の泉' },
  bg_cave_bridge: { emoji: '🌉', label: '比の橋' },
  bg_cave_shrine: { emoji: '🗿', label: '洞窟の碑' },

  // --- 第4章の背景 ---
  bg_lake_gate: { emoji: '⛰️', label: '湖への峠' },
  bg_lake_town: { emoji: '🏘️', label: '湖畔の町' },
  bg_lake_pier: { emoji: '🛶', label: '水位計の桟橋' },
  bg_lake_islands: { emoji: '🏝️', label: '座標の浮島' },
  bg_lake_mill: { emoji: '🎡', label: '水車小屋' },
  bg_lake_fog: { emoji: '🌫️', label: '霧の沖' },
  bg_lake_cape: { emoji: '🌊', label: '竜の岬' },
  bg_lake_shrine: { emoji: '🗿', label: '湖の碑' },

  // --- 第5章の背景 ---
  bg_ruins_gate: { emoji: '🏛️', label: '遺跡の門前' },
  bg_ruins_camp: { emoji: '⛺', label: '発掘隊のキャンプ' },
  bg_ruins_door: { emoji: '🚪', label: '遺跡の門' },
  bg_ruins_mural: { emoji: '🖼️', label: '壁画の間' },
  bg_ruins_corridor: { emoji: '🪞', label: '対称の回廊' },
  bg_ruins_plaza: { emoji: '⭕', label: 'おうぎ形の広場' },
  bg_ruins_altar: { emoji: '📐', label: '作図の祭壇' },
  bg_ruins_shrine_door: { emoji: '🔘', label: '遺跡の扉' },
  bg_ruins_shrine: { emoji: '🗿', label: '遺跡の碑' },

  // --- 第6章の背景 ---
  bg_mountain_gate: { emoji: '🏔️', label: '山の入口' },
  bg_mountain_village: { emoji: '🏚️', label: '石切り場の村' },
  bg_mountain_foot: { emoji: '🪨', label: '山の麓' },
  bg_mountain_cave: { emoji: '📦', label: '展開図の洞' },
  bg_mountain_ridge: { emoji: '🗻', label: '角柱の尾根' },
  bg_mountain_peak: { emoji: '⛰️', label: '円錐の峰' },
  bg_mountain_sphere: { emoji: '⛩️', label: '球の祠' },
  bg_mountain_rocks: { emoji: '🪨', label: '投影図の岩場' },
  bg_mountain_summit: { emoji: '🏔️', label: '山頂の碑' },

  // --- 第7章の背景 ---
  bg_tower_gate: { emoji: '🗼', label: '記録の塔の門' },
  bg_tower_inn: { emoji: '🏨', label: '塔守の宿' },
  bg_tower_entrance: { emoji: '🚪', label: '塔の入口' },
  bg_tower_records: { emoji: '📚', label: '記録の間' },
  bg_tower_stairs: { emoji: '🌀', label: '度数の階段' },
  bg_tower_archive: { emoji: '📜', label: '古文書の間' },
  bg_tower_corridor: { emoji: '🕯️', label: '代表値の回廊' },
  bg_tower_window: { emoji: '🪟', label: '近似値の窓' },
  bg_tower_top: { emoji: '🌌', label: '塔の最上階' },
  bg_black: { emoji: '⬛', label: '暗転' },
  bg_village_square_evening: { emoji: '🌇', label: 'はじまりの村(夕方)' },

  // --- アイコン ---
  icon_node_town: { emoji: '🏘️', label: '村' },
  icon_node_battle: { emoji: '⚔️', label: '戦闘' },
  icon_node_event: { emoji: '📖', label: 'イベント' },
  icon_node_secret: { emoji: '💎', label: '寄り道' },
  icon_node_boss: { emoji: '👑', label: 'ボス' },
  icon_locked: { emoji: '🔒', label: '未解放' },
};

export function getAsset(id: string): AssetEntry {
  return assetManifest[id] ?? { emoji: '❔', label: id };
}

/**
 * 素材の相対パスを URL にする。GAS の入口ページで動くときはページの URL が script.google.com 側なので、
 * boot.js が教えてくれる配信元(GitHub Pages)を基準にする
 */
export function assetUrl(path: string): string {
  const base = (typeof window !== 'undefined' && window.__MQ_BASE__) || (typeof document !== 'undefined' ? document.baseURI : '');
  try {
    return new URL(path, base).href;
  } catch {
    return path;
  }
}
