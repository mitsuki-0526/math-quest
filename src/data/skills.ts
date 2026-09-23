/**
 * レベルアップで手に入る「学習に効く力」(要件 F30 F33)。
 * 攻撃力ではなく、ヒント・時間・報酬倍率など「問題に挑みやすくなる」方向の恩恵にする。
 * 経験値を積む動機が「敵を早く倒す」ではなく「もっと解ける」になるようにするため。
 */
export interface Perk {
  level: number;
  name: string;
  description: string;
  hintBonus?: number;
  timeBonus?: number;
  expMul?: number;
  goldMul?: number;
  /** 復習・修練での経験値倍率(ふだんの練習を後押し) */
  practiceMul?: number;
}

export const perks: Perk[] = [
  { level: 2, name: 'ピタのささやき +1', description: '1ノードで使える ヒントが 1回 増える', hintBonus: 1 },
  { level: 3, name: '集中', description: '制限時間が 5秒 のびる', timeBonus: 5 },
  { level: 4, name: '修練の心得', description: '修練の泉の 経験値 +25%', practiceMul: 1.25 },
  { level: 5, name: '商人の友', description: '手に入る ゴールド +20%', goldMul: 1.2 },
  { level: 7, name: 'ピタのささやき +2', description: 'ヒントが さらに 1回 増える', hintBonus: 1 },
  { level: 8, name: '深い集中', description: '制限時間が さらに 5秒 のびる', timeBonus: 5 },
  { level: 10, name: '碑守の弟子', description: '経験値 +10%', expMul: 1.1 },
  { level: 13, name: '修練の達人', description: '修練の泉の 経験値 +50%', practiceMul: 1.5 },
  { level: 15, name: 'ピタのささやき +3', description: 'ヒントが さらに 1回 増える', hintBonus: 1 },
  { level: 18, name: '碑守の心', description: '経験値 +20%', expMul: 1.2 },
];

export function perksUpTo(level: number): Perk[] {
  return perks.filter((p) => p.level <= level);
}

export function nextPerk(level: number): Perk | undefined {
  return perks.find((p) => p.level > level);
}

/** 指定レベルで新しく手に入った力 */
export function perksGainedBetween(from: number, to: number): Perk[] {
  return perks.filter((p) => p.level > from && p.level <= to);
}
