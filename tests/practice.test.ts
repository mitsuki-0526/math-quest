import { describe, it, expect } from 'vitest';
import '@/data/grade1/problems';
import { createNewSave } from '@/engine/save';
import { ensureDailyQuest, recordAnswer } from '@/engine/adaptive';
import { playerStats, gainExp, levelCap } from '@/engine/player';
import { unlockedChapters } from '@/engine/progress';
import { perksGainedBetween, nextPerk } from '@/data/skills';

describe('今日のクエスト', () => {
  it('練習が少ない出題タイプを選び、同じ日は変わらない', () => {
    const s = createNewSave();
    s.stats['a'] = { asked: 5, correct: 5, streakBest: 0 };
    const q = ensureDailyQuest(s, ['a', 'b', 'c'])!;
    expect(['b', 'c']).toContain(q.templateId);
    expect(ensureDailyQuest(s, ['a', 'b', 'c'])!.templateId).toBe(q.templateId);
  });
  it('対象の正解だけを数え、誤答は数えない', () => {
    const s = createNewSave();
    const q = ensureDailyQuest(s, ['g1.sign.addsub'])!;
    recordAnswer(s, 'g1.sign.addsub', true, []);
    recordAnswer(s, 'g1.sign.addsub', false, ['x']);
    recordAnswer(s, 'g1.sign.muldiv', true, []);
    expect(q.correct).toBe(1);
    expect(s.stats['g1.sign.addsub'].lastWrong).toBeDefined();
    expect(s.stats['g1.sign.muldiv'].lastWrong).toBeUndefined();
  });
});

describe('レベルの力', () => {
  it('レベルが上がるとヒント・時間・倍率が増える', () => {
    const s = createNewSave();
    const before = playerStats(s);
    gainExp(s, 100000, Infinity);
    const after = playerStats(s);
    expect(after.hintBonus).toBeGreaterThan(before.hintBonus);
    expect(after.timeBonus).toBeGreaterThan(before.timeBonus);
    expect(after.expMul).toBeGreaterThan(1);
    expect(after.goldMul).toBeGreaterThan(1);
  });
  it('間のレベルで得た力を列挙できる', () => {
    expect(perksGainedBetween(1, 3).map((p) => p.level)).toEqual([2, 3]);
    expect(nextPerk(3)?.level).toBe(4);
  });
});

describe('レベル上限(章ごと)', () => {
  it('上限で止まり、超えた経験値はゴールドになる', () => {
    const s = createNewSave();
    const r = gainExp(s, 100000, 6);
    expect(s.player.level).toBe(6);
    expect(r.levelUps).toBe(5);
    expect(r.overflowGold).toBeGreaterThan(0);
    expect(s.player.exp).toBe(0);
    // 上限のあとは、経験値をためずにゴールドへ
    const gold = s.player.gold;
    const r2 = gainExp(s, 200, 6);
    expect(s.player.level).toBe(6);
    expect(r2.overflowGold).toBe(100);
    expect(s.player.gold).toBe(gold + 100);
  });

  it('先の章が開くと上限が上がる(解放されている章の中で一番高い上限)', () => {
    unlockedChapters.set(['g1c1']);
    expect(levelCap()).toBe(6);
    unlockedChapters.set(['g1c1', 'g1c2', 'g1c3']);
    expect(levelCap()).toBe(12);
    unlockedChapters.set(['g1c1']);
  });

  it('第1章をふつうに進めるだけなら、上限の Lv6 に届くくらい(上限が早すぎない)', () => {
    // 1 章分の正解の経験値(試算: 全問正解で約 1270)では、Lv6 の手前か Lv6 ちょうど
    const s = createNewSave();
    gainExp(s, 1270, Infinity);
    expect(s.player.level).toBeGreaterThanOrEqual(5);
    expect(s.player.level).toBeLessThanOrEqual(6);
  });
});
