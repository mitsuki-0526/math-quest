import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TALK_FIGURES } from '@/data/grade1/talkFigures';
import { ScriptRunner, getScene, hasScene, type ScriptEffect } from '@/engine/script';

function run(id: string, choose: 'first' | 'last' = 'first', startLabel?: string) {
  const effects: ScriptEffect[] = [];
  const shown: string[] = [];
  const runner = new ScriptRunner(getScene(id), { stopAtLabel: !startLabel, onEffect: (e) => effects.push(e) }, startLabel);
  for (let guard = 0; guard < 300; guard++) {
    const step = runner.next();
    if (step.type === 'end') break;
    if (step.type === 'say') shown.push(`${step.who}:${step.text}`);
    else runner.choose(step.options[choose === 'first' ? 0 : step.options.length - 1].goto);
  }
  return { effects, shown };
}

describe('会話スクリプト(台本から変換した JSON)', () => {
  it('プロローグの全シーンが存在する', () => {
    for (const id of ['P-1', 'P-2', 'P-3', 'P-4', 'P-5']) expect(hasScene(id)).toBe(true);
    expect(hasScene('P-5#撃破')).toBe(true);
    expect(hasScene('C1-3#クリア後')).toBe(true);
    expect(hasScene('nope')).toBe(false);
  });

  it('P-1: どの選択肢でも合流して最後まで進み、フラグが立つ', () => {
    for (const c of ['first', 'last'] as const) {
      const r = run('P-1', c);
      expect(r.shown[0]).toContain('teo:');
      expect(r.shown.at(-1)).toContain('橋も 変なんだ');
      expect(r.effects).toEqual([{ effect: 'flag', key: 'prologue_shop_done' }]);
    }
  });

  it('P-4: 木の剣と布の服を入手して自動装備、P-3 でピタが加入', () => {
    const r = run('P-4');
    expect(r.effects).toEqual(expect.arrayContaining([expect.objectContaining({ effect: 'item', id: 'wooden_sword', equip: true }), expect.objectContaining({ effect: 'item', id: 'cloth_armor', equip: true })]));
    expect(run('P-3').effects).toEqual([{ effect: 'party', id: 'pita' }]);
  });

  it('P-5: 戦闘前パートは最初のラベルで止まり、撃破パートはラベルから始まる', () => {
    const pre = run('P-5');
    expect(pre.shown.length).toBeGreaterThan(3);
    expect(pre.shown.some((s) => s.includes('元の姿に戻った'))).toBe(false);
    const post = run('P-5', 'first', '撃破');
    expect(post.shown[0]).toContain('元の姿に戻った');
    expect(post.effects).toEqual(expect.arrayContaining([expect.objectContaining({ effect: 'title' })]));
  });

  it('C1-4 絶対値の碑: 誤答の選択肢でも報酬は同じ(羽根 ×2)', () => {
    for (const c of ['first', 'last'] as const) {
      const r = run('C1-4', c);
      expect(r.effects).toEqual([{ effect: 'item', id: 'hint_feather', count: 2, equip: false }]);
    }
  });

  it('C1-7 ボス前は startBattle で終わり、C1-9 ボス後は章クリアの効果を持つ', () => {
    expect(run('C1-7').effects.at(-1)).toEqual({ effect: 'startBattle' });
    expect(run('C1-9').effects).toEqual(expect.arrayContaining([{ effect: 'chapterClear', id: 'g1c1' }]));
  });

  it('全シーンの goto / 選択肢の飛び先が存在する', () => {
    for (const id of ['P-1', 'P-2', 'P-3', 'P-4', 'P-5', 'C1-1', 'C1-2', 'C1-3', 'C1-4', 'C1-5', 'C1-6', 'C1-7', 'C1-9', 'C1-10']) {
      const scene = getScene(id);
      const labels = new Set(scene.lines.flatMap((l) => ('label' in l ? [l.label] : [])));
      for (const l of scene.lines) {
        if ('goto' in l) expect(labels.has(l.goto), `${id}: → ${l.goto}`).toBe(true);
        if ('choice' in l) for (const o of l.choice) expect(labels.has(o.goto), `${id}: 選択肢 → ${o.goto}`).toBe(true);
      }
    }
  });

  // 先生の報告 2026-10-26「図も なにも ないので 何を 考えたら いいのか」: 台本の 図の 指示が 図に ならずに 抜けていた
  it('台本の「※ 図」は すべて 図の ID を持ち、その 図が ある', () => {
    for (const ch of ['04_waterwheel_lake', '05_circle_ruins', '06_solid_mountain', '07_record_tower']) {
      const md = readFileSync(`docs/script/g1/${ch}.md`, 'utf8');
      for (const line of md.split(/\r?\n/)) if (line.trim().startsWith('※') && line.includes('※ 図')) expect(line, ch).toMatch(/※ 図\[[a-z0-9_]+\]:/);
    }
    for (const id of ['C5-2', 'C5-3', 'C6-3', 'C7-5'])
      for (const l of getScene(id).lines) if ('figure' in l) expect(TALK_FIGURES[l.figure], `${id}: ${l.figure}`).toBeDefined();
  });

  it('C5-3 壁画の間: 最初の 問いの 前に 図が 出る', () => {
    const figs: unknown[] = [];
    const runner = new ScriptRunner(getScene('C5-3'), { onEffect: () => {}, onFigure: (f) => figs.push(f) });
    let step = runner.next();
    while (step.type === 'say') step = runner.next();
    expect(step.type).toBe('choice');
    expect(figs.length).toBeGreaterThan(0);
  });
});
