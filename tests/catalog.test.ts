import { describe, it, expect, beforeEach } from 'vitest';
import '@/data/grade1/problems';
import { grade1 } from '@/data/grade1/chapters';
import { catalogNodes, sampleProblems, updateMark, markedList, marksToText, markSent, clearMarks, markKey, reviewStore } from '@/engine/catalog';

/** 問題の見本帳(先生用): 戦闘と同じ規則で 地点ごとの出題タイプ・★ を並べ、印を 文字にできる */
describe('問題の見本帳', () => {
  const c1 = grade1.chapters[0];

  it('地点ごとに、戦闘で出る出題タイプと ★ の上限を 並べる', () => {
    const nodes = catalogNodes(c1);
    const road = nodes.find((n) => n.id === 'g1c1.road')!;
    expect(road.templates).toEqual(['g1.sign.addsub']);
    expect(road.stars).toEqual([1]);
    expect(nodes.find((n) => n.id === 'g1c1.marsh')!.stars).toEqual([1, 2]);
    // ボスは 段階ごとの出題タイプを すべて
    const boss = nodes.find((n) => n.id === 'g1c1.boss')!;
    expect(boss.templates).toEqual(expect.arrayContaining(['g1.sign.addsub_big', 'g1.sign.muldiv', 'g1.sign.numberline']));
    expect(boss.stars).toEqual([1, 2, 3]);
    // 修練の泉は 章の 全タイプ
    expect(nodes.at(-1)!.templates).toEqual(c1.templates);
    // 町・会話だけの地点は 出さない
    expect(nodes.some((n) => n.id === 'g1c1.village' || n.id === 'g1c1.abs_stone')).toBe(false);
  });

  it('すべての章で 見本を作れる(戦闘のある地点は 出題タイプが 1 つ以上)', () => {
    for (const c of grade1.chapters) for (const n of catalogNodes(c)) if (!n.id.endsWith('.spring')) expect(n.templates.length, n.id).toBeGreaterThan(0);
  });

  it('見本の問題は 同じ種なら 同じ問題、種を変えると 変わる。1 組の中で 重ならない', () => {
    const a = sampleProblems('g1.sign.addsub', 1, 5, 1).map((p) => p.key);
    expect(sampleProblems('g1.sign.addsub', 1, 5, 1).map((p) => p.key)).toEqual(a);
    expect(sampleProblems('g1.sign.addsub', 1, 5, 2).map((p) => p.key)).not.toEqual(a);
    expect(new Set(a).size).toBe(5);
  });

  describe('印', () => {
    beforeEach(() => clearMarks());
    const base = { node: 'g1c1.road', nodeName: '森の小道', template: 'g1.sign.addsub', star: 1 as const };

    it('評価・一言・気になる を 付けると 文字にできる。送ったら 未送信から 外れる', () => {
      updateMark(base, (m) => (m.rating = 'hard'));
      updateMark(base, (m) => (m.comment = '2けたは まだ早い'));
      updateMark(base, (m) => (m.flagged = ['(−12) + 7 = ?']));
      const list = markedList();
      expect(list).toHaveLength(1);
      const text = marksToText(list, () => '正負の数の加減');
      expect(text).toContain('森の小道(g1c1.road) / 正負の数の加減(g1.sign.addsub) / ★1: むずかしい');
      expect(text).toContain('一言: 2けたは まだ早い');
      expect(text).toContain('気になる問題: (−12) + 7 = ?');
      expect(list[0].dirty).toBe(true);
      markSent([markKey(base.node, base.template, base.star)]);
      expect(reviewStore.get()[markKey(base.node, base.template, base.star)].dirty).toBe(false);
    });

    it('何も付けていない組は 数えない', () => {
      updateMark(base, (m) => (m.comment = '   '));
      expect(markedList()).toHaveLength(0);
    });
  });
});
