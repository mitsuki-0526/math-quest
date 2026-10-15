import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createNewSave, gradeOfClass, schoolInfo, migrate } from '@/engine/save';
import { grantTreasure, hasTreasure, treasureShortfall } from '@/engine/treasure';
import { config } from '@/data/config';
import { STAR_SHARD_ID, TREASURE_MAP_ID, isEquipment } from '@/data/grade1/items';

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

describe('宝の地図: 端末側', () => {
  it('ゴールドと 星のかけらが 足りるまで 買えない', () => {
    const d = createNewSave('ゆう');
    expect(treasureShortfall(d)).toEqual({ gold: config.treasure.price, shards: config.treasure.shards });
    d.player.gold = config.treasure.price + 10;
    d.inventory[STAR_SHARD_ID] = config.treasure.shards + 1;
    expect(treasureShortfall(d)).toEqual({ gold: 0, shards: 0 });
  });

  it('受け取ると 代金を 引く。2 回 呼んでも 二重には 引かない', () => {
    const d = createNewSave('ゆう');
    d.player.gold = config.treasure.price + 10;
    d.inventory[STAR_SHARD_ID] = config.treasure.shards + 1;
    grantTreasure(d);
    grantTreasure(d);
    expect(hasTreasure(d)).toBe(true);
    expect(d.player.gold).toBe(10);
    expect(d.inventory[STAR_SHARD_ID]).toBe(1);
    expect(d.inventory[TREASURE_MAP_ID]).toBe(1);
  });

  it('だいじなものは 装備の 一覧に 出ない', () => {
    expect(isEquipment(TREASURE_MAP_ID)).toBe(false);
    expect(isEquipment(STAR_SHARD_ID)).toBe(false);
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
