import { describe, it, expect } from 'vitest';
import '@/data/grade1/problems';
import { createNewSave } from '@/engine/save';
import { ensureDailyQuest, recordAnswer } from '@/engine/adaptive';
import { playerStats, gainExp } from '@/engine/player';
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
    gainExp(s, 100000);
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
