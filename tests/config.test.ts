import { describe, it, expect } from 'vitest';
import { config, applyConfigOverrides, expToNext } from '@/data/config';

describe('config の上書き(スプレッドシートの config シート)', () => {
  it('ドット区切りのキーで数値を上書きし、存在しないキーや型違いは無視する', () => {
    const before = config.battle.baseDamage;
    const applied = applyConfigOverrides({ 'battle.baseDamage': 12, 'battle.nope': 1, 'nope.x': 2, 'battle.baseDamage2': 'x', 'battle.streakBonus': 5 });
    expect(applied).toEqual(['battle.baseDamage']);
    expect(config.battle.baseDamage).toBe(12);
    config.battle.baseDamage = before;
  });
  it('レベルごとの必要経験値は単調増加', () => {
    expect(expToNext(2)).toBeGreaterThan(expToNext(1));
    expect(expToNext(10)).toBeGreaterThan(expToNext(5));
  });
});
