import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { schoolInfo } from '@/engine/save';

/**
 * 名簿(roster シート)の 学年の 列。先生が 名簿に 学年を 書けば それが セーブに 入る(先生の希望 2026-10-16)。
 * 本物の gas/Code.gs の 関数を、シートの 偽物で 動かして 確かめる
 */
type Cell = unknown;

/** 本物の シートは 先頭の ' を 文字列の しるしとして 外して 見せる */
const cell = (v: Cell) => (typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v);

function fakeSheet(grid: Cell[][]) {
  let filter = false;
  const width = () => Math.max(...grid.map((r) => r.length));
  return {
    grid,
    getLastRow: () => grid.length,
    getLastColumn: () => width(),
    getRange: (r: number, c: number, n = 1, w = 1) => ({
      getValues: () => grid.slice(r - 1, r - 1 + n).map((row) => Array.from({ length: w }, (_, j) => row[c - 1 + j] ?? '')),
      setValue: (v: Cell) => {
        while (grid.length < r) grid.push([]);
        grid[r - 1][c - 1] = cell(v);
      },
      setValues: (vs: Cell[][]) =>
        vs.forEach((row, i) => {
          while (grid.length < r + i) grid.push([]);
          row.forEach((v, j) => (grid[r - 1 + i][c - 1 + j] = cell(v)));
        }),
      insertCheckboxes: () => {},
      setNumberFormat: () => {},
      createFilter: () => (filter = true),
      getColumn: () => c,
    }),
    getMaxRows: () => 1000,
    getFilter: () => (filter ? {} : null),
    insertColumnAfter: (c: number) => grid.forEach((row) => row.splice(c, 0, '')),
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

type Entry = { class?: string; number?: string; grade?: number; error?: string; pending?: { class: string; number: string } };

function gas(grid: Cell[][], classes = '1-1,1-2') {
  const sh = fakeSheet(grid);
  const app = { getActiveSpreadsheet: () => ({ getSheetByName: () => sh }) };
  const code = readFileSync(new URL('../gas/Code.gs', import.meta.url), 'utf8');
  const stub = `function logRow() {}
function readConfig() { return { classes: __classes }; }
return { rosterEntry: rosterEntry, ensureRosterGradeColumn: ensureRosterGradeColumn, ensureRosterApprovedColumn: ensureRosterApprovedColumn, ensureFilter: ensureFilter, applyRoster: applyRoster, importRoster: importRoster, fullClass: fullClass, numberColumn: numberColumn, numberCell: numberCell, classList: classList };`;
  const mod = new Function('SpreadsheetApp', '__classes', `${code}\n${stub}`)(app, classes) as {
    rosterEntry: (email: string) => Entry;
    ensureRosterGradeColumn: (sheet: unknown) => void;
    ensureRosterApprovedColumn: (sheet: unknown) => void;
    ensureFilter: (sheet: unknown) => void;
    applyRoster: (email: string, cls: string, num: string) => { ok: boolean; error?: string; approved?: boolean; pending?: { class: string; number: string } };
    importRoster: (grade: unknown, kumi: unknown, list: { email: string; name: string }[]) => { added: number; skipped: number; noEmail: number };
    fullClass: (grade: number, kumi: unknown) => string;
    numberColumn: (sheet: unknown, col: number) => void;
    numberCell: (num: unknown) => unknown;
    classList: (cfg: { classes?: string }) => string[];
  };
  return { sh, ...mod };
}

/** シートに 書かれた 値から 先頭の ' を はずす(本物の シートは 文字列として 見せる) */
const plain = (grid: Cell[][]) => grid.map((r) => r.map((v) => (typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v)));

const HEADER = ['承認', 'email', 'name', 'grade', 'class', 'number', 'memo'];

describe('名簿の 申請と 承認(先生が メールを 打たなくて よいように)', () => {
  it('名簿に ない 生徒が 申請すると 承認なしの 行が 足され、承認に チェックが 入るまで 入れない', () => {
    const g = gas([HEADER]);
    expect(g.rosterEntry('new@s.jp')).toEqual({ error: 'not_in_roster' });
    expect(g.applyRoster('new@s.jp', '1-2', '07')).toEqual({ ok: true, pending: { class: '1-2', number: '7' } });
    // 学年と 組に 分けて 書く(grade 1・class 2)
    expect(plain(g.sh.grid)[1]).toEqual([false, 'new@s.jp', undefined, 1, '2', 7]);
    expect(g.rosterEntry('new@s.jp')).toEqual({ error: 'pending', pending: { class: '1-2', number: '7' } });
    // 先生が 承認に チェック
    g.sh.grid[1][0] = true;
    expect(g.rosterEntry('new@s.jp')).toEqual({ class: '1-2', number: '7', grade: 1 });
    expect(g.applyRoster('new@s.jp', '1-2', '8')).toEqual({ ok: false, error: 'already_registered' });
  });

  it('申請し直すと 同じ 行を 書きかえる(行は 増えない)', () => {
    const g = gas([HEADER]);
    g.applyRoster('a@s.jp', '1-2', '7');
    g.applyRoster('a@s.jp', '1-1', '3');
    expect(g.sh.grid).toHaveLength(2);
    expect(g.rosterEntry('a@s.jp').pending).toEqual({ class: '1-1', number: '3' });
  });

  it('ほかの 人が 使っている 番号・一覧に ない クラス・おかしな 番号は 断る', () => {
    const g = gas([HEADER, [true, 'b@s.jp', '', 1, '1-2', '7', '']]);
    expect(g.applyRoster('a@s.jp', '1-2', '7')).toEqual({ ok: false, error: 'number_taken' });
    expect(g.applyRoster('a@s.jp', '3-9', '1')).toEqual({ ok: false, error: 'bad_identity' });
    expect(g.applyRoster('a@s.jp', '1-2', '0')).toEqual({ ok: false, error: 'bad_identity' });
    expect(g.applyRoster('a@s.jp', '1-2', '=1+1')).toEqual({ ok: false, error: 'bad_identity' });
    expect(g.sh.grid).toHaveLength(2);
  });

  it('承認なしの 行は、ほかの 人の 番号と かぶっても 重複に 数えない', () => {
    const g = gas([HEADER, [true, 'b@s.jp', '', 1, '1-2', '7', ''], [false, 'c@s.jp', '', 1, '1-2', '7', '']]);
    expect(g.rosterEntry('b@s.jp')).toEqual({ class: '1-2', number: '7', grade: 1 });
  });

  it('setup は 承認の 列を 先頭に 足し、今までの 行は 承認ずみに する(入れなくならない)', () => {
    const g = gas([
      ['email', 'grade', 'class', 'number', 'memo'],
      ['a@s.jp', '1', '1-2', '7', ''],
    ]);
    g.ensureRosterApprovedColumn(g.sh);
    expect(g.sh.grid).toEqual([
      ['承認', 'email', 'grade', 'class', 'number', 'memo'],
      [true, 'a@s.jp', '1', '1-2', '7', ''],
    ]);
    expect(g.rosterEntry('a@s.jp')).toEqual({ class: '1-2', number: '7', grade: 1 });
  });

  it('setup は 絞り込みを 付ける(先生が 付けた ものは そのまま)', () => {
    const g = gas([HEADER]);
    expect(g.sh.getFilter()).toBeNull();
    g.ensureFilter(g.sh);
    expect(g.sh.getFilter()).not.toBeNull();
  });
});

describe('学年と 組を 分けて 書く 名簿(先生の希望 2026-10-16)', () => {
  it('grade 3・class 1 は ゲームの 中で「3-1」。前の版の「1-2」と 書いた 行も そのまま 読める', () => {
    const g = gas([
      HEADER,
      [true, 'a@s.jp', '', 3, 1, '5', ''],
      [true, 'b@s.jp', '', '3年', '2組', '6', ''],
      [true, 'c@s.jp', '', 1, '1-2', '7', ''],
      [true, 'd@s.jp', '', '', '1-3', '8', ''],
    ]);
    expect(g.rosterEntry('a@s.jp')).toEqual({ class: '3-1', number: '5', grade: 3 });
    expect(g.rosterEntry('b@s.jp')).toEqual({ class: '3-2', number: '6', grade: 3 });
    expect(g.rosterEntry('c@s.jp')).toEqual({ class: '1-2', number: '7', grade: 1 });
    expect(g.rosterEntry('d@s.jp')).toEqual({ class: '1-3', number: '8' });
  });

  it('ほかの 人の 番号は 書き方が ちがっても 同じ クラスとして 断る', () => {
    const g = gas([HEADER, [true, 'b@s.jp', '', 1, '1-2', '7', '']]);
    expect(g.applyRoster('a@s.jp', '1-2', '7')).toEqual({ ok: false, error: 'number_taken' });
    const h = gas([HEADER, [true, 'b@s.jp', '', 1, 2, '7', '']]);
    expect(h.applyRoster('a@s.jp', '1-2', '7')).toEqual({ ok: false, error: 'number_taken' });
  });

  it('Classroom から 3年1組として 取り込むと grade 3・class 1', () => {
    const g = gas([HEADER], '3-1');
    g.importRoster('3', '1', [{ email: 'a@s.jp', name: '山田 花子' }]);
    expect(plain(g.sh.grid)[1].slice(0, 6)).toEqual([true, 'a@s.jp', '山田 花子', 3, '1', '']);
    expect(g.rosterEntry('a@s.jp')).toEqual({ error: 'pending', pending: { class: '3-1', number: '' } });
  });
});

describe('えらべる クラスの 一覧(先生の報告 2026-10-19)', () => {
  it('config が 1年だけでも、名簿に 書いた 3年の クラスが 一覧に 入り、申請できる', () => {
    const g = gas([HEADER], '1-1,1-2');
    g.importRoster('3', '1', [{ email: 'a@s.jp', name: '山田 花子' }]);
    g.importRoster('3', '10', [{ email: 'b@s.jp', name: '' }]);
    g.importRoster('3', '2', [{ email: 'c@s.jp', name: '' }]);
    expect(g.classList({ classes: '1-1,1-2' })).toEqual(['1-1', '1-2', '3-1', '3-2', '3-10']);
    expect(g.applyRoster('a@s.jp', '3-1', '5')).toEqual({ ok: true, approved: true, pending: { class: '3-1', number: '5' } });
    // 一覧にも 名簿にも ない クラスは 今までどおり 断る
    expect(g.applyRoster('d@s.jp', '2-1', '1')).toEqual({ ok: false, error: 'bad_identity' });
  });
});

describe('先生が 学年・組を 書いた 生徒は 承認なしで 入れる(先生の希望 2026-10-19)', () => {
  it('同じ 学年・組で 番号を 入れると 承認ずみに なり、そのまま 入れる(承認の チェックが なかった 行でも)', () => {
    const g = gas([HEADER, ['', 'a@s.jp', '', 3, '1', '', ''], [true, 'b@s.jp', '', 3, '2', '', '']], '1-1');
    expect(g.applyRoster('a@s.jp', '3-1', '05')).toEqual({ ok: true, approved: true, pending: { class: '3-1', number: '5' } });
    expect(g.rosterEntry('a@s.jp')).toEqual({ class: '3-1', number: '5', grade: 3 });
    expect(g.applyRoster('b@s.jp', '3-2', '6')).toMatchObject({ ok: true, approved: true });
    expect(g.rosterEntry('b@s.jp')).toEqual({ class: '3-2', number: '6', grade: 3 });
    // 入ったあとは 申請し直せない(番号の 直しは 先生が 名簿で)
    expect(g.applyRoster('a@s.jp', '3-1', '7')).toEqual({ ok: false, error: 'already_registered' });
  });

  it('ほかの 人の 番号は 今までどおり 断る', () => {
    const g = gas([HEADER, ['', 'a@s.jp', '', 3, '1', '', ''], [true, 'b@s.jp', '', 3, '1', '5', '']], '');
    expect(g.applyRoster('a@s.jp', '3-1', '5')).toEqual({ ok: false, error: 'number_taken' });
    expect(g.rosterEntry('a@s.jp')).toEqual({ error: 'pending', pending: { class: '3-1', number: '' } });
  });

  it('ちがう 学年・組を えらんだとき・名簿に ない 生徒・自分で 申請した 行は 先生の 承認を 待つ', () => {
    const g = gas([HEADER, [true, 'a@s.jp', '', 3, '1', '', ''], [true, 'x@s.jp', '', 3, '2', '9', ''], [true, 'y@s.jp', '', 3, '1', '1', '']], '');
    expect(g.applyRoster('a@s.jp', '3-2', '5')).toEqual({ ok: true, pending: { class: '3-2', number: '5' } });
    expect(g.rosterEntry('a@s.jp').error).toBe('pending');
    expect(g.applyRoster('new@s.jp', '3-1', '8')).toEqual({ ok: true, pending: { class: '3-1', number: '8' } });
    // 自分で 申請した 行(番号が 入っている)を 同じ クラスで 出し直しても 承認待ちの まま
    expect(g.applyRoster('new@s.jp', '3-1', '9')).toEqual({ ok: true, pending: { class: '3-1', number: '9' } });
    expect(g.rosterEntry('new@s.jp').error).toBe('pending');
  });
});

describe('出席番号は 数(並べ替えが 1, 2, … 10 の 順に なるように。先生の指摘 2026-10-16)', () => {
  it('setup は 文字で 書かれた 番号を 数に 直す。数字で ない 値は そのまま', () => {
    const g = gas([HEADER, [true, 'a@s.jp', '', 1, '2', '10', ''], [true, 'b@s.jp', '', 1, '2', ' 2 ', ''], [true, 'c@s.jp', '', 1, '2', 3, ''], [true, 'd@s.jp', '', 1, '2', 't1a2b3', '']]);
    g.numberColumn(g.sh, 6);
    expect(g.sh.grid.slice(1).map((r) => r[5])).toEqual([10, 2, 3, 't1a2b3']);
    // 数に しても これまでどおり 入れる
    expect(g.rosterEntry('a@s.jp')).toEqual({ class: '1-2', number: '10', grade: 1 });
  });

  it('書く 値: 数字だけなら 数、先生用の 記号は 文字', () => {
    const g = gas([HEADER]);
    expect(g.numberCell('07')).toBe(7);
    expect(g.numberCell('t1a2b3')).toBe("'t1a2b3");
  });
});

describe('Classroom からの 取り込み', () => {
  it('メール・氏名・学年・クラスを 承認ずみで 足す。番号は 空で、生徒が 申請すると その行に 入る', () => {
    const g = gas([HEADER, [true, 'old@s.jp', '', 1, '1-2', '1', '']]);
    const r = g.importRoster('1', '2組', [
      { email: 'Old@s.jp', name: '前から いる' },
      { email: 'a@s.jp', name: '山田 花子' },
      { email: '', name: 'メールなし' },
    ]);
    expect(r).toEqual({ added: 1, skipped: 1, noEmail: 1 });
    expect(plain(g.sh.grid)[2]).toEqual([true, 'a@s.jp', '山田 花子', 1, '2', '', '']);
    // 番号が まだなので 入れない(申請の 欄に クラスが 入った 状態で 出る)
    expect(g.rosterEntry('a@s.jp')).toEqual({ error: 'pending', pending: { class: '1-2', number: '' } });
    // 生徒が 同じ クラスで 番号を 入れる → 同じ 行に 入り、そのまま 入れる(先生の希望 2026-10-19)
    expect(g.applyRoster('a@s.jp', '1-2', '9')).toMatchObject({ ok: true, approved: true });
    expect(g.sh.grid).toHaveLength(3);
    expect(plain(g.sh.grid)[2].slice(0, 6)).toEqual([true, 'a@s.jp', '山田 花子', 1, '2', 9]);
  });

  it('氏名の 列が ない 名簿には email の 右に 足す', () => {
    const g = gas([['承認', 'email', 'grade', 'class', 'number', 'memo']]);
    g.importRoster(1, 1, [{ email: 'a@s.jp', name: '山田 花子' }]);
    expect(g.sh.grid[0]).toEqual(['承認', 'email', 'name', 'grade', 'class', 'number', 'memo']);
    expect(plain(g.sh.grid)[1].slice(0, 5)).toEqual([true, 'a@s.jp', '山田 花子', 1, '1']);
  });
});

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
    expect(rosterEntry('a@s.jp')).toEqual({ class: '1-A', number: '7', grade: 1 });
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
