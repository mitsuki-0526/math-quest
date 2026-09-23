import { config, expToNext } from '@/data/config';
import { getItem } from '@/data/grade1/items';
import { grade1 } from '@/data/grade1/chapters';
import type { SaveData } from './save';
import type { PlayerStats } from './battle';
import { unlockedChapters } from './progress';
import { perksUpTo } from '@/data/skills';

/** 装備補正とレベルの力(perks)を含めた、戦闘に渡すプレイヤー能力 */
export function playerStats(save: SaveData): PlayerStats & { hintBonus: number; goldMul: number; practiceMul: number } {
  const p = save.player;
  let attack = p.attack;
  let defense = p.defense;
  let timeBonus = 0;
  let hintBonus = 0;
  let expMul = 1;
  let goldMul = 1;
  let practiceMul = 1;
  for (const perk of perksUpTo(p.level)) {
    hintBonus += perk.hintBonus ?? 0;
    timeBonus += perk.timeBonus ?? 0;
    expMul *= perk.expMul ?? 1;
    goldMul *= perk.goldMul ?? 1;
    practiceMul *= perk.practiceMul ?? 1;
  }
  for (const id of [p.equipment.weapon, p.equipment.armor, p.equipment.accessory]) {
    if (!id) continue;
    const st = getItem(id).stat ?? {};
    attack += st.attack ?? 0;
    defense += st.defense ?? 0;
    timeBonus += st.timeBonus ?? 0;
    hintBonus += st.hintBonus ?? 0;
    expMul *= st.expMul ?? 1;
  }
  return { name: p.name, hp: p.hp, maxHp: p.maxHp, attack, defense, timeBonus, expMul, hintBonus, goldMul, practiceMul };
}

/** 経験値を加え、レベルアップを処理する。上がったレベル数を返す */
export function gainExp(d: SaveData, exp: number): number {
  d.player.exp += exp;
  let ups = 0;
  while (d.player.exp >= expToNext(d.player.level)) {
    d.player.exp -= expToNext(d.player.level);
    d.player.level += 1;
    d.player.maxHp += config.level.hpPerLevel;
    d.player.attack += config.level.attackPerLevel;
    d.player.defense += config.level.defensePerLevel;
    d.player.hp = d.player.maxHp; // レベルアップで全回復(ごほうび)
    ups++;
  }
  return ups;
}

export function addItem(d: SaveData, id: string, count = 1): void {
  d.inventory[id] = (d.inventory[id] ?? 0) + count;
}

export function removeItem(d: SaveData, id: string, count = 1): boolean {
  const have = d.inventory[id] ?? 0;
  if (have < count) return false;
  if (have === count) delete d.inventory[id];
  else d.inventory[id] = have - count;
  return true;
}

/** 装備する。装備品は在庫から外さず「装備中」として扱う(売却は未実装) */
export function equip(d: SaveData, id: string): void {
  const it = getItem(id);
  if (it.kind === 'weapon') d.player.equipment.weapon = id;
  else if (it.kind === 'armor') d.player.equipment.armor = id;
  else if (it.kind === 'accessory') d.player.equipment.accessory = id;
}

/** 敗北: ゴールドの一部を失い、HP を半分にして村へ(要件 F27) */
export function applyDefeat(d: SaveData): { goldLost: number } {
  const goldLost = Math.floor(d.player.gold * config.defeat.goldLossRatio);
  d.player.gold -= goldLost;
  d.player.hp = Math.max(1, Math.floor(d.player.maxHp * config.defeat.hpRatio));
  return { goldLost };
}

/** 章クリア: 記録し、次章を「現在の章」にする(解放されていなくても、マップ上で🔒表示になる) */
export function clearChapter(d: SaveData, chapterId: string): void {
  if (!d.progress.clearedChapters.includes(chapterId)) d.progress.clearedChapters.push(chapterId);
  const ch = grade1.chapters.find((c) => c.id === chapterId);
  if (ch?.nextChapter) d.progress.chapter = ch.nextChapter;
}

export function isNextChapterUnlocked(chapterId: string): boolean {
  const ch = grade1.chapters.find((c) => c.id === chapterId);
  return !!ch?.nextChapter && unlockedChapters.get().includes(ch.nextChapter);
}
