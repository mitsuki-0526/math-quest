import type { ChapterDef } from './types';
import { getEnemy } from '@/data/grade1/enemies';
import { generateProblem, type Difficulty, type Problem } from '@/math/template';
import { createRng } from '@/math/rng';
import { createStore } from './store';

/**
 * 問題の見本帳(先生用)。地点ごとに「実際に出る出題タイプ × ★」の問題を並べ、遊ばずに難しさを確かめられるようにする。
 * 印(やさしい/ちょうど/むずかしい)と一言は、端末に残しつつスプレッドシートの review シートへ送る。
 * 難易度の調整の流れは docs/difficulty.md
 */

export interface CatalogNode {
  /** 章ID.地点ID(修練の泉は 章ID.spring) */
  id: string;
  name: string;
  templates: string[];
  stars: Difficulty[];
}

const ALL_STARS: Difficulty[] = [1, 2, 3];

/** 章の戦闘地点(戦闘・寄り道・ボス)と修練の泉。戦闘と同じ規則(敵の出題タイプ・ボスの段階・★ の上限)で並べる */
export function catalogNodes(chapter: ChapterDef): CatalogNode[] {
  const out: CatalogNode[] = [];
  for (const n of chapter.nodes) {
    if (!n.enemies) continue;
    const templates = new Set<string>();
    for (const wave of n.enemies)
      for (const id of wave) {
        const e = getEnemy(id);
        if (n.type === 'boss' && e.phases) e.phases.forEach((p) => p.templates.forEach((t) => templates.add(t)));
        else templates.add(e.template);
      }
    out.push({ id: `${chapter.id}.${n.id}`, name: n.name, templates: [...templates], stars: ALL_STARS.filter((s) => s <= (n.maxStar ?? 3)) });
  }
  out.push({ id: `${chapter.id}.spring`, name: '修練の泉(全タイプ)', templates: chapter.templates ?? [], stars: ALL_STARS });
  return out;
}

/** 見本の問題。同じ種(seed)なら同じ問題が出る(印を付けた問題を あとで 特定できるように) */
export function sampleProblems(templateId: string, star: Difficulty, count: number, seed: number): Problem[] {
  const rng = createRng(seed * 7919 + hash(`${templateId}:${star}`));
  const keys: string[] = [];
  const out: Problem[] = [];
  for (let i = 0; i < count; i++) {
    const p = generateProblem(templateId, star, keys, rng);
    keys.push(p.key);
    out.push(p);
  }
  return out;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ---------------------------------------------------------------- 印

export type Rating = 'easy' | 'ok' | 'hard';
export const RATING_LABEL: Record<Rating, string> = { easy: 'やさしい', ok: 'ちょうど', hard: 'むずかしい' };

export interface ReviewMark {
  node: string;
  nodeName: string;
  template: string;
  star: Difficulty;
  rating?: Rating;
  comment: string;
  /** 「気になる」を付けた問題(問題文そのもの) */
  flagged: string[];
  /** スプレッドシートへ送ったあとに変えたか */
  dirty: boolean;
}

const STORAGE_KEY = 'mq-review-marks';

function loadMarks(): Record<string, ReviewMark> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ReviewMark>) : {};
  } catch {
    return {};
  }
}

export const reviewStore = createStore<Record<string, ReviewMark>>(loadMarks());
reviewStore.subscribe(() => {
  // 送る前に閉じても 印が消えないように、端末にも残す
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reviewStore.get()));
  } catch {
    /* 保存できない環境でも 画面は使える */
  }
});

export const markKey = (node: string, template: string, star: Difficulty) => `${node}|${template}|${star}`;

export function updateMark(base: Omit<ReviewMark, 'rating' | 'comment' | 'flagged' | 'dirty'>, change: (m: ReviewMark) => void): void {
  const k = markKey(base.node, base.template, base.star);
  const cur = reviewStore.get()[k] ?? { ...base, comment: '', flagged: [], dirty: false };
  const next = { ...cur, flagged: [...cur.flagged] };
  change(next);
  next.dirty = true;
  reviewStore.set({ ...reviewStore.get(), [k]: next });
}

/** 印の付いたもの(評価・一言・気になる のどれかがある) */
export function markedList(): ReviewMark[] {
  return Object.values(reviewStore.get()).filter((m) => m.rating || m.comment.trim() || m.flagged.length);
}

/** チャットに貼るための文字列(どの地点・タイプ・★ に、どんな印か) */
export function marksToText(marks: ReviewMark[], title: (templateId: string) => string): string {
  const lines = ['【問題の見本帳の印】'];
  for (const m of marks) {
    lines.push(`■ ${m.nodeName}(${m.node}) / ${title(m.template)}(${m.template}) / ★${m.star}: ${m.rating ? RATING_LABEL[m.rating] : '印なし'}`);
    if (m.comment.trim()) lines.push(`  一言: ${m.comment.trim()}`);
    for (const f of m.flagged) lines.push(`  気になる問題: ${f}`);
  }
  return lines.join('\n');
}

/** 送ったあと: 送った印は dirty を外す(端末には残す) */
export function markSent(keys: string[]): void {
  const cur = { ...reviewStore.get() };
  for (const k of keys) if (cur[k]) cur[k] = { ...cur[k], dirty: false };
  reviewStore.set(cur);
}

/** 印をすべて消す(送ったあとに 次の単元へ 進むとき) */
export function clearMarks(): void {
  reviewStore.set({});
}
