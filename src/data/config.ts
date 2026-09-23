/**
 * ゲームの調整値(要件 Q5)。M3 でスプレッドシートの config から上書きできるようにする。
 * 数値は仮。試遊(T2-10)で調整する。
 */
export const config = {
  battle: {
    /** 基礎ダメージ = base + 攻撃力 × 倍率 */
    baseDamage: 8,
    attackScale: 1.0,
    /** 連続正解ボーナス: 3連続で ×1.5、5連続で ×2 */
    streakBonus: [
      { streak: 5, mul: 2.0 },
      { streak: 3, mul: 1.5 },
    ],
    /** 制限時間の最初の 1/3 以内に正解すると会心(×1.3) */
    quickRatio: 1 / 3,
    quickMul: 1.3,
    /** 敵の攻撃 = 敵の attack − 防御。最低 1 */
    minDamage: 1,
    /** 正解 1 問の経験値(難易度別) */
    expPerCorrect: { 1: 10, 2: 18, 3: 30 } as Record<1 | 2 | 3, number>,
    /** ヒントを使った問題の経験値倍率 */
    hintExpMul: 0.5,
    /** 制限時間の下限・上限(秒) */
    timeMin: 15,
    timeMax: 120,
    /** 1ノードの戦闘数(章データに enemies が3組あれば3戦) */
    hintsPerNode: 3,
  },
  defeat: {
    /** 敗北時に失うゴールドの割合 */
    goldLossRatio: 0.1,
    /** 村に戻ったときの HP(最大 HP に対する割合) */
    hpRatio: 0.5,
  },
  level: {
    /** 次のレベルに必要な経験値 = base × level^growth */
    base: 50,
    growth: 1.4,
    hpPerLevel: 8,
    attackPerLevel: 2,
    defensePerLevel: 1,
  },
  review: {
    /** 修練の泉の経験値倍率(練習を後押しするので 1.0。ゴールドだけ半分) */
    expMul: 1.0,
    goldMul: 0.5,
  },
  daily: {
    /** 今日のクエストで正解する問題数 */
    target: 10,
    /** 達成報酬 */
    rewardExp: 60,
    rewardGold: 40,
  },
  adaptive: {
    /** 直近何問で判定するか */
    window: 6,
    /** 正答数がこれ以上なら難易度を上げる */
    upAt: 5,
    /** 正答数がこれ以下なら難易度を下げる */
    downAt: 2,
  },
};

export type GameConfig = typeof config;

/**
 * スプレッドシートの config から "battle.baseDamage" のようなドット区切りのキーで上書きする。
 * 存在しないキーや型が違う値は無視する(シートの入力ミスでゲームを壊さない)。
 */
export function applyConfigOverrides(overrides: Record<string, unknown>): string[] {
  const applied: string[] = [];
  for (const [path, value] of Object.entries(overrides)) {
    const parts = path.split('.');
    let node: Record<string, unknown> = config as unknown as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      const next = node[parts[i]];
      if (!next || typeof next !== 'object') {
        node = {};
        break;
      }
      node = next as Record<string, unknown>;
    }
    const leaf = parts[parts.length - 1];
    if (leaf in node && typeof node[leaf] === typeof value && typeof value !== 'object') {
      node[leaf] = value;
      applied.push(path);
    }
  }
  return applied;
}

/** 次のレベルに必要な累計ではない「このレベルで必要な」経験値 */
export function expToNext(level: number): number {
  return Math.round(config.level.base * Math.pow(level, config.level.growth));
}
