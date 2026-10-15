import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createNewSave, gradeOfClass, schoolInfo, migrate } from '@/engine/save';
import { grantTreasure, hasTreasure, treasureShortfall } from '@/engine/treasure';
import { unitTrophies } from '@/engine/trophy';
import { config } from '@/data/config';
import { grade1 } from '@/data/grade1/chapters';
import { TREASURE_MAP_ID, isEquipment } from '@/data/grade1/items';
import type { SaveData } from '@/engine/save';

/** 章の すべての 出題タイプに 正解数を 入れる */
function solveAll(d: SaveData, chapters: string[], correct: number): void {
  for (const c of grade1.chapters.filter((x) => chapters.includes(x.id)))
    for (const t of c.templates ?? []) d.stats[t] = { asked: correct, correct, streakBest: 0 };
}

/**
 * 宝の地図(クラスに 1 枚だけ。先生の ごほうびの 宝探し 2026-10-16)。
 * 早い者勝ちは サーバー(gas/Code.gs の treasure())で 決まるので、本物の 関数を シートの 偽物で 動かして 確かめる
 */
type Status = { onSale: boolean; soldOut: boolean; mine: boolean };
type Row = unknown[];

function gas(classes: unknown) {
  const code = readFileSync(new URL('../gas/Code.gs', import.meta.url), 'utf8');
  const rows: Row[] = [];
  // 後に 書いた 関数宣言が 勝つので、シートや 設定を 読む 関数だけ 差し替える
  const stub = `
    function readConfig() { return { treasure_classes: __classes }; }
    function parseSave(row) { return row.save; }
    function logRow() {}
    function treasureSheet() {
      return {
        getLastRow: function () { return __rows.length + 1; },
        getRange: function (r, c, n, w) { return { getValues: function () { return __rows.slice(r - 2, r - 2 + n).map(function (x) { return x.slice(c - 1, c - 1 + w); }); } }; },
        appendRow: function (v) { __rows.push(v.map(function (x) { return typeof x === 'string' && x.charAt(0) === "'" ? x.slice(1) : x; })); },
      };
    }
    return { treasure: treasure };`;
  const mod = new Function('__classes', '__rows', `${code}\n${stub}`)(classes, rows) as {
    treasure: (row: unknown, cls: string, num: string, teacher: boolean, buy: boolean) => { treasure: Status };
  };
  const row = { save: { player: { name: 'ゆうしゃ', level: 9 } } };
  return { rows, call: (cls: string, num: string, buy: boolean, teacher = false) => mod.treasure(row, cls, num, teacher, buy).treasure };
}

describe('宝の地図: サーバーの 早い者勝ち', () => {
  it('treasure_classes に ないクラスでは 売らない(ほかの学年で 使っても 出ない)', () => {
    const g = gas('1-2');
    expect(g.call('2-2', '1', true)).toEqual({ onSale: false, soldOut: false, mine: false });
    expect(g.rows).toHaveLength(0);
  });

  it('クラスで 1 人だけ 買える。2 人目には 売り切れ、買った人には mine', () => {
    const g = gas('1-2,2-3');
    expect(g.call('1-2', '7', false)).toEqual({ onSale: true, soldOut: false, mine: false });
    expect(g.call('1-2', '7', true)).toEqual({ onSale: true, soldOut: false, mine: true });
    expect(g.call('1-2', '3', true)).toEqual({ onSale: true, soldOut: true, mine: false });
    // 応答が 届かず 買い直しても 二重に 記録しない
    expect(g.call('1-2', '7', true).mine).toBe(true);
    expect(g.rows).toHaveLength(1);
    // 別の 売るクラスは 別に 1 枚
    expect(g.call('2-3', '3', true).mine).toBe(true);
    expect(g.rows).toHaveLength(2);
  });

  it('シートで 番号が 数(07 → 7)になっていても 同じ人', () => {
    const g = gas('1-2');
    g.rows.push(['t', '1-2', 7]);
    expect(g.call('1-2', '7', false).mine).toBe(true);
  });

  it('先生は 試しに 何度でも 買えて、生徒の クラスの 分は 減らない', () => {
    const g = gas('');
    expect(g.call('teacher', 't1', true, true).mine).toBe(true);
    expect(g.call('teacher', 't2', true, true).mine).toBe(true);
    expect(g.call('teacher', 't3', false, true).soldOut).toBe(false);
  });
});

describe('単元トロフィー(まんべんなく 解いたか)', () => {
  it('段階は 単元の中で いちばん 正解の 少ない 出題タイプで 決まる', () => {
    const d = createNewSave('ゆう');
    solveAll(d, ['g1c1'], config.trophy.gold);
    const [u] = unitTrophies(d, ['g1c1']);
    expect(u.unit).toBe('正の数と負の数');
    expect(u.tier).toBe(3);
    // 1 つの 出題タイプだけ 少ないと、そこで 止まる(得意な タイプだけ 解いても 上がらない)
    const weak = u.templates[2];
    d.stats[weak].correct = config.trophy.bronze;
    const [v] = unitTrophies(d, ['g1c1']);
    expect(v.tier).toBe(1);
    expect(v.weakest).toBe(weak);
    expect(v.nextAt).toBe(config.trophy.silver);
  });

  it('解放ずみの 単元だけを 数える', () => {
    const d = createNewSave('ゆう');
    expect(unitTrophies(d, ['g1c1', 'g1c3']).map((u) => u.chapterId)).toEqual(['g1c1', 'g1c3']);
    expect(unitTrophies(d, ['g1c1', 'g1c3']).every((u) => u.tier === 0)).toBe(true);
  });
});

describe('宝の地図: 端末側', () => {
  it('ゴールドと、解放ずみの 全単元の トロフィーが そろうまで 買えない', () => {
    const d = createNewSave('ゆう');
    const open = ['g1c1', 'g1c2'];
    expect(treasureShortfall(d, open).gold).toBe(config.treasure.price);
    expect(treasureShortfall(d, open).units.map((u) => u.chapterId)).toEqual(open);
    d.player.gold = config.treasure.price + 10;
    solveAll(d, ['g1c1'], config.trophy.silver);
    expect(treasureShortfall(d, open).units.map((u) => u.chapterId)).toEqual(['g1c2']);
    solveAll(d, ['g1c2'], config.trophy.silver);
    expect(treasureShortfall(d, open)).toEqual({ gold: 0, units: [] });
  });

  it('受け取ると 代金を 引く。2 回 呼んでも 二重には 引かない', () => {
    const d = createNewSave('ゆう');
    d.player.gold = config.treasure.price + 10;
    grantTreasure(d);
    grantTreasure(d);
    expect(hasTreasure(d)).toBe(true);
    expect(d.player.gold).toBe(10);
    expect(d.inventory[TREASURE_MAP_ID]).toBe(1);
  });

  it('だいじなものは 装備の 一覧に 出ない', () => {
    expect(isEquipment(TREASURE_MAP_ID)).toBe(false);
    expect(isEquipment('iron_sword')).toBe(true);
  });
});

describe('セーブの 学年', () => {
  it('クラス名から 学年を 読む', () => {
    expect(gradeOfClass('1-2')).toBe(1);
    expect(gradeOfClass('2年3組')).toBe(2);
    expect(gradeOfClass('3A')).toBe(3);
    expect(gradeOfClass('A組')).toBeUndefined();
    expect(gradeOfClass('12')).toBeUndefined();
    expect(gradeOfClass('4-1')).toBeUndefined();
    expect(schoolInfo('2-1', '5')).toEqual({ grade: 2, class: '2-1', number: '5' });
    expect(schoolInfo('A組', '5')).toEqual({ class: 'A組', number: '5' });
  });

  it('学年を 書いた セーブも 読み直せる(古いセーブには ない)', () => {
    const d = createNewSave('ゆう');
    d.school = schoolInfo('1-2', '7');
    expect(migrate(JSON.parse(JSON.stringify(d)))?.school).toEqual({ grade: 1, class: '1-2', number: '7' });
    expect(migrate(JSON.parse(JSON.stringify(createNewSave('ゆう'))))?.school).toBeUndefined();
  });
});
