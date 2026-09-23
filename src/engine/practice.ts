import { grade1 } from '@/data/grade1/chapters';
import { enemies } from '@/data/grade1/enemies';
import { unlockedChapters } from './progress';
import type { SaveData } from './save';

/**
 * 修練の泉・今日のクエストのための「練習できる出題タイプ」。
 * 解放済みの章のテンプレートをすべて候補にし、単元に偏りが出ないようにする(先生の方針)。
 */
export function practiceTemplates(_save: SaveData): string[] {
  const unlocked = new Set(unlockedChapters.get());
  return grade1.chapters.filter((c) => unlocked.has(c.id)).flatMap((c) => c.templates ?? []);
}

/** テンプレートを出題する敵(訓練相手)。ボスは除く。見つからなければ最初の雑魚 */
export function enemyForTemplate(templateId: string): string {
  const e = Object.values(enemies).find((x) => !x.boss && x.template === templateId);
  if (e) return e.id;
  // ボス専用テンプレート(数直線など)は、雑魚の姿を借りた「訓練用の像」として最初の敵を使う
  return Object.values(enemies).find((x) => !x.boss)!.id;
}
