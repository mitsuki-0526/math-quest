import { grade1 } from '@/data/grade1/chapters';
import '@/data/grade1/problems';
import { getTemplate } from '@/math/template';
import { config } from '@/data/config';
import { unlockedChapters } from './progress';
import type { SaveData } from './save';

/**
 * 単元トロフィー。すべての単元を まんべんなく 解いてほしい(先生の方針 2026-10-16)ので、
 * 続けた日数ではなく「単元の中の どの出題タイプも 解いたか」で 決める。
 * 段階は 単元の中で いちばん 正解の 少ない 出題タイプで 決まる(得意な タイプだけ 解いても 上がらない)
 */
export type TrophyTier = 0 | 1 | 2 | 3;

export const TROPHY_NAMES: Record<TrophyTier, string> = { 0: 'なし', 1: '銅', 2: '銀', 3: '金' };
export const TROPHY_EMOJI: Record<TrophyTier, string> = { 0: '▫️', 1: '🥉', 2: '🥈', 3: '🥇' };

export interface UnitTrophy {
  chapterId: string;
  unit: string;
  templates: string[];
  tier: TrophyTier;
  /** いちばん 正解の 少ない 出題タイプと その正解数(次に 解くと よいもの) */
  weakest: string;
  weakestCorrect: number;
  /** 次の 段階に 要る 正解数(金なら null) */
  nextAt: number | null;
}

/** 段階ごとに 要る 正解数(出題タイプ ごと) */
export function tierThreshold(tier: 1 | 2 | 3): number {
  return tier === 1 ? config.trophy.bronze : tier === 2 ? config.trophy.silver : config.trophy.gold;
}

function tierOf(correct: number): TrophyTier {
  if (correct >= config.trophy.gold) return 3;
  if (correct >= config.trophy.silver) return 2;
  if (correct >= config.trophy.bronze) return 1;
  return 0;
}

/** 解放ずみの 章の 単元トロフィー(まだ 開いていない 単元は 数えない) */
export function unitTrophies(save: SaveData, unlocked: string[] = unlockedChapters.get()): UnitTrophy[] {
  const open = new Set(unlocked);
  return grade1.chapters
    .filter((c) => open.has(c.id) && (c.templates ?? []).length > 0)
    .map((c) => {
      const templates = c.templates ?? [];
      const counts = templates.map((t) => save.stats[t]?.correct ?? 0);
      const min = Math.min(...counts);
      const tier = tierOf(min);
      return {
        chapterId: c.id,
        unit: getTemplate(templates[0]).unit,
        templates,
        tier,
        weakest: templates[counts.indexOf(min)],
        weakestCorrect: min,
        nextAt: tier === 3 ? null : tierThreshold((tier + 1) as 1 | 2 | 3),
      };
    });
}
