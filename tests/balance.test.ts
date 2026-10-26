import { describe, it, expect } from 'vitest';
import { config } from '@/data/config';
import { getEnemy } from '@/data/grade1/enemies';
import { getItem } from '@/data/grade1/items';

/**
 * 戦闘の 強さの 釣り合い(先生の印 2026-10-14)。
 * 「まとめ屋ゴブリンや 羊が 初めから 1 撃で 倒せて、村で 買い物を する 必要が ない」「規則ムカデは 難しいので 1 撃で」
 * 1 撃の ダメージ = baseDamage + 攻撃力(会心・連続正解の 倍率なし)。攻撃力 = 5 + 2 ×(Lv − 1)+ 武器
 */
const attackAt = (level: number, weapon?: string) => 5 + config.level.attackPerLevel * (level - 1) + (weapon ? getItem(weapon).stat?.attack ?? 0 : 0);
const hits = (enemy: string, level: number, weapon?: string) => Math.ceil(getEnemy(enemy).hp / (config.battle.baseDamage + attackAt(level, weapon) * config.battle.attackScale));

describe('第2章の 敵の 強さ', () => {
  it('ゴブリン・キツネ・ヒツジ: 木の剣(Lv6〜9)では ふつう 3 撃、村で 鉄の剣を 買うと Lv8〜9 で 2 撃', () => {
    for (const e of ['collect_goblin', 'distribute_fox', 'model_sheep']) {
      for (const lv of [6, 7, 8, 9]) expect(hits(e, lv, 'wooden_sword'), `${e} Lv${lv} 木の剣`).toBe(3);
      for (const lv of [8, 9]) expect(hits(e, lv, 'iron_sword'), `${e} Lv${lv} 鉄の剣`).toBe(2);
      // 会心と 5 連続正解が 重なれば 鉄の剣で 1 撃(がんばった ごほうび)
      const top = config.battle.streakBonus[0].mul * config.battle.quickMul;
      expect(Math.round((config.battle.baseDamage + attackAt(9, 'iron_sword')) * top), e).toBeGreaterThanOrEqual(getEnemy(e).hp);
    }
  });

  it('規則ムカデ: Lv1・武器なしでも 1 回 正解すれば 倒せる', () => {
    expect(hits('pattern_centipede', 1)).toBe(1);
  });
});

/**
 * ボスの 強さ(先生の報告 2026-10-26「全体的に ボスが 弱い。すぐ 体力が けずりきられる」)。
 * 以前は 連続正解の 倍率(3 連続 ×1.5・5 連続 ×2)を 数えずに HP を 決めていたので、レベル上限で 全問正解すると 5〜6 問で 倒れた(3 段階あるのに 1 段階 1〜2 問)。
 * 章の レベル上限・その章で 買える いちばん 強い 剣で、全問正解・会心なしのとき 10 問前後(1 段階 3〜4 問)に する。
 */
const correctToBeat = (enemy: string, level: number, weapon: string) => {
  const raw = config.battle.baseDamage + attackAt(level, weapon) * config.battle.attackScale;
  let hp = getEnemy(enemy).hp;
  for (let n = 1; ; n++) {
    const mul = config.battle.streakBonus.find((b) => n >= b.streak)?.mul ?? 1;
    hp -= Math.round(raw * mul);
    if (hp <= 0) return n;
  }
};

describe('ボスの 強さ', () => {
  const bosses: [string, number, string][] = [
    ['king_nega', 6, 'wooden_sword'],
    ['masked_scribe', 9, 'iron_sword'],
    ['shadow_x', 12, 'iron_sword'],
    ['twin_dragons', 15, 'silver_sword'],
    ['ring_guardian', 18, 'silver_sword'],
    ['king_poly', 21, 'silver_sword'],
    ['apostle', 24, 'silver_sword'],
  ];
  it.each(bosses)('%s: Lv%i・%s で 全問正解しても 9〜11 問 かかる', (boss, lv, weapon) => {
    const n = correctToBeat(boss, lv, weapon);
    expect(n).toBeGreaterThanOrEqual(9);
    expect(n).toBeLessThanOrEqual(11);
  });
});
