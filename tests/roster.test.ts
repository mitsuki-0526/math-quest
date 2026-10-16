import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { schoolInfo } from '@/engine/save';

/**
 * 名簿(roster シート)の 学年の 列。先生が 名簿に 学年を 書けば それが セーブに 入る(先生の希望 2026-10-16)。
 * 本物の gas/Code.gs の 関数を、シートの 偽物で 動かして 確かめる
 */
type Cell = unknown;

function fakeSheet(grid: Cell[][]) {
  const width = () => Math.max(...grid.map((r) => r.length));
  return {
    grid,
    getLastRow: () => grid.length,
    getLastColumn: () => width(),
    getRange: (r: number, c: number, n = 1, w = 1) => ({
      getValues: () => grid.slice(r - 1, r - 1 + n).map((row) => Array.from({ length: w }, (_, j) => row[c - 1 + j] ?? '')),
      setValue: (v: Cell) => {
        while (grid.length < r) grid.push([]);
        grid[r - 1][c - 1] = v;
      },
      getColumn: () => c,
    }),
    // 本物と 同じく 行ごとに 列を 差し込む・移す(destination = 移す前の 何列目の 前に 置くか)
    insertColumnBefore: (c: number) => grid.forEach((row) => row.splice(c - 1, 0, '')),
    moveColumns: (range: { getColumn: () => number }, destination: number) => {
      const from = range.getColumn() - 1;
      for (const row of grid) {
        while (row.length < Math.max(from + 1, destination - 1)) row.push('');
        const [v] = row.splice(from, 1);
        row.splice(destination - 1 > from ? destination - 2 : destination - 1, 0, v);
      }
    },
  };
}

function gas(grid: Cell[][]) {
  const sh = fakeSheet(grid);
  const app = { getActiveSpreadsheet: () => ({ getSheetByName: () => sh }) };
  const code = readFileSync(new URL('../gas/Code.gs', import.meta.url), 'utf8');
  const mod = new Function('SpreadsheetApp', `${code}\nfunction logRow() {}\nreturn { rosterEntry: rosterEntry, ensureRosterGradeColumn: ensureRosterGradeColumn };`)(app) as {
    rosterEntry: (email: string) => { class?: string; number?: string; grade?: number; error?: string };
    ensureRosterGradeColumn: (sheet: unknown) => void;
  };
  return { sh, ...mod };
}

describe('名簿の 学年', () => {
  it('grade 列に 書いた 学年を 返す(「2」「2年」どちらも)。空なら 返さない', () => {
    const { rosterEntry } = gas([
      ['email', 'class', 'number', 'memo', 'grade'],
      ['a@s.jp', '1-2', '7', '', '2'],
      ['b@s.jp', '1-2', '8', '', '3年'],
      ['c@s.jp', '1-2', '9', '', ''],
    ]);
    expect(rosterEntry('a@s.jp')).toEqual({ class: '1-2', number: '7', grade: 2 });
    expect(rosterEntry('b@s.jp')).toEqual({ class: '1-2', number: '8', grade: 3 });
    expect(rosterEntry('c@s.jp')).toEqual({ class: '1-2', number: '9' });
  });

  it('見出しで 列を 探すので、学年の 列は どこでも・「学年」でもよい', () => {
    const { rosterEntry } = gas([
      ['email', 'class', 'number', 'memo', 'メモ2', '学年'],
      ['a@s.jp', 'A組', 7, '', '', 1],
    ]);
    expect(rosterEntry('a@s.jp')).toEqual({ class: 'A組', number: '7', grade: 1 });
  });

  it('学年の 列が ない 古い 名簿でも 今までどおり 入れる', () => {
    const { rosterEntry } = gas([
      ['email', 'class', 'number', 'memo'],
      ['a@s.jp', '1-2', '7', ''],
    ]);
    expect(rosterEntry('a@s.jp')).toEqual({ class: '1-2', number: '7' });
  });

  it('setup は 学年の 列を class の すぐ 左に 差し込む(貼った 中身は そのまま 読める)', () => {
    const old = gas([
      ['email', 'class', 'number', 'memo'],
      ['a@s.jp', '1-2', '7', 'メモ'],
    ]);
    old.ensureRosterGradeColumn(old.sh);
    expect(old.sh.grid).toEqual([
      ['email', 'grade', 'class', 'number', 'memo'],
      ['a@s.jp', '', '1-2', '7', 'メモ'],
    ]);
    expect(old.rosterEntry('a@s.jp')).toEqual({ class: '1-2', number: '7' });
  });

  it('memo の 右に ある 学年の 列は、中身ごと class の 左に 移す', () => {
    const right = gas([
      ['email', 'class', 'number', 'memo', 'grade'],
      ['a@s.jp', '1-2', '7', 'メモ', '2'],
      ['b@s.jp', '1-2', '8', '', '1'],
    ]);
    right.ensureRosterGradeColumn(right.sh);
    expect(right.sh.grid).toEqual([
      ['email', 'grade', 'class', 'number', 'memo'],
      ['a@s.jp', '2', '1-2', '7', 'メモ'],
      ['b@s.jp', '1', '1-2', '8', ''],
    ]);
    expect(right.rosterEntry('a@s.jp')).toEqual({ class: '1-2', number: '7', grade: 2 });
    // もう class の 左に ある ときは 何もしない
    right.ensureRosterGradeColumn(right.sh);
    expect(right.sh.grid[0]).toEqual(['email', 'grade', 'class', 'number', 'memo']);
  });

  it('class・number も 見出しで 探す(先生が 並べ替えても 読める)', () => {
    const { rosterEntry } = gas([
      ['email', 'grade', 'class', 'number', 'memo'],
      ['a@s.jp', '3', '3-1', '07', ''],
    ]);
    expect(rosterEntry('a@s.jp')).toEqual({ class: '3-1', number: '7', grade: 3 });
  });
});

describe('セーブの 学年', () => {
  it('名簿の 学年が あれば クラス名より 優先する', () => {
    expect(schoolInfo('1-2', '7', 2)).toEqual({ grade: 2, class: '1-2', number: '7' });
    expect(schoolInfo('A組', '7', 3)).toEqual({ grade: 3, class: 'A組', number: '7' });
    expect(schoolInfo('1-2', '7', undefined)).toEqual({ grade: 1, class: '1-2', number: '7' });
  });
});
