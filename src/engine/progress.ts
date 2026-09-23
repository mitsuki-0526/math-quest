import { createStore } from './store';
import type { ChapterDef, NodeDef } from './types';
import type { SaveData } from './save';

/**
 * 章の解放状態(教師の unlock シート由来。M3 でサーバーから取得)。
 * M0〜M2 はローカルの既定値: 第1章のみ解放。
 */
export const unlockedChapters = createStore<string[]>(['g1c1']);

export function isChapterUnlocked(chapterId: string): boolean {
  return unlockedChapters.get().includes(chapterId);
}

export type NodeState = 'cleared' | 'available' | 'locked' | 'hidden';

/** ノードの到達状態。先頭ノード(前提なし)は常に available。 */
export function nodeState(chapter: ChapterDef, node: NodeDef, save: SaveData): NodeState {
  const cleared = new Set(save.progress.clearedNodes);
  if (cleared.has(qualify(chapter, node))) return 'cleared';
  if (node.revealAfter && !cleared.has(`${chapter.id}.${node.revealAfter}`)) return 'hidden';
  const predecessors = chapter.nodes.filter((n) => n.next.includes(node.id));
  if (predecessors.length === 0) return 'available';
  const reachable = predecessors.some((p) => cleared.has(qualify(chapter, p)) || (p.type === 'town' && nodeState(chapter, p, save) !== 'locked'));
  return reachable ? 'available' : 'locked';
}

/** セーブに記録するノードの完全ID(章ID.ノードID) */
export function qualify(chapter: ChapterDef, node: NodeDef): string {
  return `${chapter.id}.${node.id}`;
}
