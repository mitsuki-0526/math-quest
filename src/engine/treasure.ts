import { api, hasServer, type TreasureStatus } from './api';
import { getIdentity } from './sync';
import { addItem, removeItem } from './player';
import type { SaveData } from './save';
import { config } from '@/data/config';
import { STAR_SHARD_ID, TREASURE_MAP_ID } from '@/data/grade1/items';

/**
 * 宝の地図(クラスに 1 枚だけ)。ごほうびの「数学の授業で 1 回 遊べる券」を 宝探しに するための 品。
 * 売るクラスと 早い者勝ちは サーバーが 決める(端末ごとに 判定すると、同じクラスで 何人も 買えてしまう)。
 * サーバーが ないとき(この端末だけで 遊ぶとき)は 売らない
 */

/** あと いくら・いくつ 足りないか(0 なら 買える) */
export function treasureShortfall(save: SaveData): { gold: number; shards: number } {
  return {
    gold: Math.max(0, config.treasure.price - save.player.gold),
    shards: Math.max(0, config.treasure.shards - (save.inventory[STAR_SHARD_ID] ?? 0)),
  };
}

export function hasTreasure(save: SaveData): boolean {
  return (save.inventory[TREASURE_MAP_ID] ?? 0) > 0;
}

/** サーバーで 買えたあとに 渡す。代金は ここで 引く(サーバーは ゴールドを 知らない) */
export function grantTreasure(d: SaveData): void {
  if (hasTreasure(d)) return;
  d.player.gold = Math.max(0, d.player.gold - config.treasure.price);
  removeItem(d, STAR_SHARD_ID, Math.min(config.treasure.shards, d.inventory[STAR_SHARD_ID] ?? 0));
  addItem(d, TREASURE_MAP_ID, 1);
}

/** 売れ具合を 聞く(buy=true なら 買う)。サーバーが ない・まだ 入っていないときは null */
export async function requestTreasure(buy: boolean): Promise<TreasureStatus | null> {
  const id = getIdentity();
  if (!hasServer() || !id) return null;
  return (await api.treasure(id, buy)).treasure;
}
