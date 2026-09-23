import { config } from '@/data/config';
import type { Difficulty } from '@/math/template';
import type { SaveData, TemplateStats } from './save';

/**
 * 難易度の自動調整と苦手判定(要件 F45 F46)。
 * テンプレートごとに直近 N 問の正誤を持ち、よく正解していれば上げ、間違いが続けば下げる。
 */

function statsOf(save: SaveData, templateId: string): TemplateStats | undefined {
  return save.stats[templateId];
}

export function currentDifficulty(save: SaveData, templateId: string): Difficulty {
  return (statsOf(save, templateId)?.level ?? 1) as Difficulty;
}

/** 正誤を記録し、必要なら難易度を上下する。戻り値は変化(+1 / -1 / 0) */
export function recordAnswer(d: SaveData, templateId: string, correct: boolean, tags: string[]): -1 | 0 | 1 {
  const s = (d.stats[templateId] ??= { asked: 0, correct: 0, streakBest: 0 });
  s.asked++;
  if (correct) {
    s.correct++;
    // 今日のクエストの対象なら進捗を進める
    if (d.daily && d.daily.templateId === templateId && d.daily.date === today() && !d.daily.claimed) d.daily.correct++;
  } else {
    s.lastWrong = new Date().toISOString().slice(0, 10);
    s.weakTags = [...new Set([...(s.weakTags ?? []), ...tags])].slice(-8);
  }
  const recent = [...(s.recent ?? []), correct ? 1 : 0].slice(-config.adaptive.window) as (0 | 1)[];
  s.recent = recent;
  const level = (s.level ?? 1) as Difficulty;
  if (recent.length >= config.adaptive.window) {
    const ok = recent.reduce<number>((a, b) => a + b, 0);
    if (ok >= config.adaptive.upAt && level < 3) {
      s.level = (level + 1) as Difficulty;
      s.recent = [];
      return 1;
    }
    if (ok <= config.adaptive.downAt && level > 1) {
      s.level = (level - 1) as Difficulty;
      s.recent = [];
      return -1;
    }
  }
  return 0;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 今日のクエスト(要件 F14)。解放済みの章の出題タイプのうち、いちばん練習が少ないものを対象にする。
 * 同数なら日付で決める(同じ日に開き直しても変わらない)。
 */
export function ensureDailyQuest(d: SaveData, candidates: string[]): SaveData['daily'] {
  const date = today();
  if (d.daily && d.daily.date === date && candidates.includes(d.daily.templateId)) return d.daily;
  if (candidates.length === 0) return undefined;
  const sorted = [...candidates].sort((a, b) => (d.stats[a]?.asked ?? 0) - (d.stats[b]?.asked ?? 0));
  const minAsked = d.stats[sorted[0]]?.asked ?? 0;
  const ties = sorted.filter((t) => (d.stats[t]?.asked ?? 0) === minAsked);
  const seed = Number(date.replace(/-/g, '')) % ties.length;
  d.daily = { date, templateId: ties[seed], correct: 0, target: config.daily.target, claimed: false };
  return d.daily;
}

/** 苦手: 直近の正答率が半分以下、または最近間違えたことがある */
export function isWeak(save: SaveData, templateId: string): boolean {
  const s = statsOf(save, templateId);
  if (!s || s.asked === 0) return false;
  const recent = s.recent ?? [];
  if (recent.length >= 3) {
    const ok = recent.reduce<number>((a, b) => a + b, 0);
    return ok / recent.length <= 0.5;
  }
  return s.correct / s.asked <= 0.5;
}

/** 復習の泉で出す順: 苦手なテンプレートを先頭に、あとは最近やっていないもの */
export function reviewTemplates(save: SaveData, candidates: string[]): string[] {
  const weak = candidates.filter((t) => isWeak(save, t));
  const rest = candidates.filter((t) => !weak.includes(t) && (save.stats[t]?.asked ?? 0) > 0);
  return [...weak, ...rest];
}
