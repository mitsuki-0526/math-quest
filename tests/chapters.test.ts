import { describe, it, expect } from 'vitest';
import '@/data/grade1/problems';
import { grade1 } from '@/data/grade1/chapters';
import { enemies, getEnemy } from '@/data/grade1/enemies';
import { towns } from '@/data/grade1/town';
import { items, getItem } from '@/data/grade1/items';
import { hasScene, getScene } from '@/engine/script';
import { getAsset, assetManifest } from '@/assets/manifest';
import { allTemplates, getTemplate } from '@/math/template';
import { characters } from '@/data/characters';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * 章データの整合性(要件 F11 F61 F91)。
 * データ(章・敵・アイテム・会話・素材)は手で書くので、参照ミスをここで検出する。
 */
describe('1年版の章データ', () => {
  const chapters = grade1.chapters;

  it('7章すべてにノードとテンプレートがある', () => {
    expect(chapters).toHaveLength(7);
    for (const c of chapters) {
      expect(c.nodes.length, `${c.id} のノード`).toBeGreaterThan(3);
      expect(c.templates?.length, `${c.id} のテンプレート`).toBeGreaterThan(0);
      expect(c.inscription.length).toBeGreaterThan(5);
    }
  });

  it('章のテンプレートはすべて登録済み', () => {
    for (const c of chapters) for (const t of c.templates ?? []) expect(() => getTemplate(t), `${c.id}: ${t}`).not.toThrow();
  });

  it('ノードの参照(next / revealAfter)が存在する', () => {
    for (const c of chapters) {
      const ids = new Set(c.nodes.map((n) => n.id));
      for (const n of c.nodes) {
        for (const to of n.next) expect(ids.has(to), `${c.id}.${n.id} → ${to}`).toBe(true);
        if (n.revealAfter) expect(ids.has(n.revealAfter), `${c.id}.${n.id} revealAfter ${n.revealAfter}`).toBe(true);
      }
      // 最初のノード(前提のないノード)がちょうど1つ
      const heads = c.nodes.filter((n) => !c.nodes.some((m) => m.next.includes(n.id)));
      expect(heads.length, `${c.id} の開始ノード`).toBe(1);
      // ボスが1つあり、章の終点になっている
      const bosses = c.nodes.filter((n) => n.type === 'boss');
      expect(bosses.length, `${c.id} のボス`).toBe(1);
      expect(bosses[0].next).toEqual([]);
    }
  });

  it('ノードが参照する敵・アイテム・会話・背景が存在する', () => {
    for (const c of chapters) {
      for (const n of c.nodes) {
        for (const wave of n.enemies ?? []) for (const e of wave) expect(() => getEnemy(e), `${c.id}.${n.id}: ${e}`).not.toThrow();
        if (n.reward) expect(() => getItem(n.reward!.item), `${c.id}.${n.id}: ${n.reward.item}`).not.toThrow();
        for (const sid of [n.script, n.intro, ...(n.before ? [n.before] : []), ...(n.after ? n.after.split(',') : [])]) {
          if (sid) expect(hasScene(sid), `${c.id}.${n.id}: シーン ${sid}`).toBe(true);
        }
        if (n.bg) expect(assetManifest[n.bg], `${c.id}.${n.id}: 背景 ${n.bg}`).toBeDefined();
      }
      if (c.intro) expect(hasScene(c.intro), `${c.id} の章冒頭 ${c.intro}`).toBe(true);
    }
  });

  it('戦闘ノードは 2〜3 回の戦闘を持つ', () => {
    for (const c of chapters)
      for (const n of c.nodes)
        if (n.type === 'battle' || n.type === 'secret') {
          expect(n.enemies?.length, `${c.id}.${n.id}`).toBeGreaterThanOrEqual(2);
          expect(n.enemies?.length).toBeLessThanOrEqual(3);
        }
  });

  it('各章に拠点があり、村人と店の品が正しい', () => {
    for (const c of chapters) {
      const town = Object.values(towns).find((t) => t.chapterId === c.id);
      expect(town, `${c.id} の拠点`).toBeDefined();
      expect(town!.villagers.length).toBeGreaterThanOrEqual(4);
      for (const id of [...town!.shop.tools, ...town!.shop.gear]) expect(() => getItem(id), `${town!.id}: ${id}`).not.toThrow();
      if (town!.afterClearScript) expect(hasScene(town!.afterClearScript.scriptId)).toBe(true);
      expect(assetManifest[town!.bg]).toBeDefined();
    }
  });

  it('敵のテンプレートと立ち絵が存在する。ボスのフェーズも正しい', () => {
    for (const e of Object.values(enemies)) {
      expect(() => getTemplate(e.template), `${e.id}: ${e.template}`).not.toThrow();
      expect(assetManifest[e.sprite], `${e.id}: ${e.sprite}`).toBeDefined();
      if (e.phases) {
        expect(e.boss).toBe(true);
        for (const p of e.phases) {
          expect(p.templates.length).toBeGreaterThan(0);
          for (const t of p.templates) expect(() => getTemplate(t), `${e.id}: ${t}`).not.toThrow();
          expect(p.line.length).toBeGreaterThan(5);
        }
        // HP 割合は降順
        const ratios = e.phases.map((p) => p.untilHpRatio);
        expect([...ratios].sort((a, b) => b - a)).toEqual(ratios);
      }
    }
  });

  it('会話の話者は、人物・敵・npc: のどれかで名前が引ける(ID が英語のまま出ないように)', () => {
    const dir = 'src/data/grade1/scripts';
    const unknown = new Set<string>();
    const check = (who: string) => {
      if (who === 'player' || who.startsWith('npc:') || who in characters || who in enemies) return;
      unknown.add(who);
    };
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (!o || typeof o !== 'object') return;
      for (const [k, v] of Object.entries(o)) {
        if (k === 'who' && typeof v === 'string') check(v);
        else if (k === 'actors' && Array.isArray(v)) v.forEach((a) => typeof a === 'string' && check(a));
        else walk(v);
      }
    };
    for (const f of readdirSync(dir).filter((f) => /^\d.*\.json$/.test(f))) walk(JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
    expect([...unknown]).toEqual([]);
  });

  it('すべての登録テンプレートが、どこかの章で出題される', () => {
    const used = new Set(chapters.flatMap((c) => c.templates ?? []));
    for (const t of allTemplates()) expect(used.has(t.id), `${t.id} がどの章にも入っていない`).toBe(true);
  });

  it('アイテムの絵文字・説明がそろっている', () => {
    for (const it of Object.values(items)) {
      expect(it.emoji.length).toBeGreaterThan(0);
      expect(it.description.length).toBeGreaterThan(2);
      if (it.kind === 'consumable') expect(it.use).toBeDefined();
      else expect(it.stat).toBeDefined();
    }
  });

  it('会話スクリプトの飛び先がすべて存在する(全章)', () => {
    const ids = new Set<string>();
    for (const c of chapters) {
      for (const n of c.nodes) for (const sid of [n.script, n.intro, n.before, ...(n.after?.split(',') ?? [])]) if (sid) ids.add(sid.split('#')[0]);
      if (c.intro) ids.add(c.intro);
    }
    for (const id of ids) {
      const scene = getScene(id);
      const labels = new Set(scene.lines.flatMap((l) => ('label' in l ? [l.label] : [])));
      for (const l of scene.lines) {
        if ('goto' in l) expect(labels.has(l.goto), `${id}: → ${l.goto}`).toBe(true);
        if ('choice' in l) for (const o of l.choice) expect(labels.has(o.goto), `${id}: 選択肢 → ${o.goto}`).toBe(true);
      }
    }
  });

  it('素材マニフェストは存在しないIDでも落ちない', () => {
    expect(getAsset('nope').emoji).toBe('❔');
  });
});
