import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * 引き継ぎ(先生の指摘 2026-10-17: 更新の あと key の 形式が 変わり、全員が はじめからに なった)。
 * セーブは 学校アカウント(email)に 結びつけ、key の 書き方の ちがい・進級での クラス替えでも 本人の 行を 使う。
 * 本物の gas/Code.gs の 関数を、シートの 偽物で 動かして 確かめる
 */
type Cell = unknown;
const cell = (v: Cell) => (typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v);

function fakeSheet(grid: Cell[][]) {
  return {
    grid,
    getLastRow: () => grid.length,
    getLastColumn: () => Math.max(...grid.map((r) => r.length)),
    getRange: (r: number, c: number, n = 1, w = 1) => ({
      getValues: () => grid.slice(r - 1, r - 1 + n).map((row) => Array.from({ length: w }, (_, j) => row[c - 1 + j] ?? '')),
      setValue: (v: Cell) => {
        while (grid.length < r) grid.push([]);
        grid[r - 1][c - 1] = cell(v);
      },
    }),
    appendRow: (row: Cell[]) => grid.push(row.map(cell)),
  };
}

const STUDENT_HEAD = ['key', 'class', 'number', 'pass_hash', 'salt', 'player_name', 'save_json', 'updated_at', 'last_seen', 'created_at', 'reset_at', 'email'];
const save = (name: string, level: number) => JSON.stringify({ player: { name, level }, updatedAt: '2026-10-01T00:00:00.000Z', createdAt: '2026-09-01T00:00:00.000Z' });
/** students の 1 行(key・class・number・save・email だけ 書く) */
const st = (k: string, s = '', email = ''): Cell[] => {
  const [c, n] = k.split('|');
  return [k, c, n, '', '', '', s, s ? '2026-10-01T00:00:00.000Z' : '', '', '', '', email];
};

function gas(students: Cell[][], roster: Cell[][] = [['承認', 'email', 'grade', 'class', 'number']]) {
  const sheets: Record<string, ReturnType<typeof fakeSheet>> = {
    students: fakeSheet([STUDENT_HEAD, ...students]),
    roster: fakeSheet(roster),
    log: fakeSheet([['time', 'action', 'class', 'number', 'note']]),
  };
  const app = { getActiveSpreadsheet: () => ({ getSheetByName: (n: string) => sheets[n] ?? null }) };
  const code = readFileSync(new URL('../gas/Code.gs', import.meta.url), 'utf8');
  const stub = `function logRow() {}
return { canonKey: canonKey, accountStudent: accountStudent, findStudent: findStudent, transferSave: transferSave, carryoverReport: carryoverReport, carryCandidates: carryCandidates, chooseCarry: chooseCarry };`;
  const mod = new Function('SpreadsheetApp', `${code}\n${stub}`)(app) as {
    canonKey: (k: string) => string;
    accountStudent: (email: string, cls: string, num: string, create: boolean, peek: boolean) => { rowIndex: number; key: string; save_json: string } | null;
    findStudent: (cls: string, num: string) => { rowIndex: number; key: string } | null;
    transferSave: (from: number, to: number) => { ok: boolean; error?: string; name?: string; level?: number };
    carryoverReport: () => { ok: number; carry: string[]; fresh: string[]; orphans: string[] };
    carryCandidates: (email: string, k: string, targetRow: number) => { id: number; name: string; level: number }[];
    chooseCarry: (email: string, cls: string, num: string, row: { rowIndex: number }, pick: number | 'keep') => { ok: boolean; error?: string; save?: { player: { name: string; level: number } } };
  };
  return { sheets, rows: () => sheets.students.grid.slice(1), ...mod };
}

describe('key の 書き方を そろえる', () => {
  it('番号の 0・全角・「1年2組」の 書き方の ちがいは 同じ key', () => {
    const g = gas([]);
    expect(g.canonKey('1-2|07')).toBe('1-2|7');
    expect(g.canonKey('１－２|７')).toBe('1-2|7');
    expect(g.canonKey('1年2組|7')).toBe('1-2|7');
    expect(g.canonKey('1 - 2|7.0')).toBe('1-2|7');
    expect(g.canonKey('teacher|t1a2b3')).toBe('teacher|t1a2b3');
  });

  it('合言葉方式も 書き方だけ ちがう 行を 見つける(key は 書き直さない)', () => {
    const g = gas([st('1-2|07', save('ゆう', 5))]);
    expect(g.findStudent('1-2', '7')?.rowIndex).toBe(2);
    expect(g.rows()[0][0]).toBe('1-2|07');
  });
});

describe('学校アカウント方式の 引き継ぎ', () => {
  it('更新で key の 書き方が 変わっても 前の セーブを 使い、key を 今の 書き方に 直して email を 結ぶ', () => {
    const g = gas([st('1-2|07', save('ゆう', 5))]);
    const row = g.accountStudent('a@s.jp', '1-2', '7', true, false);
    expect(row?.rowIndex).toBe(2);
    expect(JSON.parse(row!.save_json).player.level).toBe(5);
    expect(g.rows()).toHaveLength(1);
    expect(g.rows()[0][0]).toBe('1-2|7');
    expect(g.rows()[0][11]).toBe('a@s.jp');
  });

  it('進級で クラス・番号が 変わっても email で 本人の 行を 見つけて 付け替える', () => {
    const g = gas([st('1-2|7', save('ゆう', 9), 'a@s.jp')]);
    const row = g.accountStudent('a@s.jp', '2-3', '5', true, false);
    expect(row?.rowIndex).toBe(2);
    expect(g.rows()[0].slice(0, 3)).toEqual(['2-3|5', '2-3', 5]);
    expect(g.rows()).toHaveLength(1);
  });

  it('同じ key の 行が ほかの 人の もの(email が ちがう)なら 使わず 退避し、その人は 次に email で 見つかる', () => {
    // 去年の 2-3 5番(b)の 行が 残っている。今年の 2-3 5番は a
    const g = gas([st('2-3|5', save('前の人', 12), 'b@s.jp')]);
    const a = g.accountStudent('a@s.jp', '2-3', '5', true, false);
    expect(a?.save_json).toBe('');
    expect(g.rows()).toHaveLength(2);
    expect(String(g.rows()[0][0]).startsWith('退避|2-3|5|')).toBe(true);
    // b は 3-1 2番に なって 入る → 退避した 行を 取り戻す
    const b = g.accountStudent('b@s.jp', '3-1', '2', true, false);
    expect(b?.rowIndex).toBe(2);
    expect(JSON.parse(b!.save_json).player.name).toBe('前の人');
    expect(g.rows()[0][0]).toBe('3-1|2');
  });

  it('今の key の 行(email なし)が あれば それを 使う。書き方だけ ちがう 古い 行は 触らない', () => {
    const g = gas([st('1-2|07', save('前の セーブ', 8)), st('1-2|7', save('今日の セーブ', 1))]);
    const row = g.accountStudent('a@s.jp', '1-2', '7', true, false);
    expect(row?.rowIndex).toBe(3);
    expect(g.rows()[0][0]).toBe('1-2|07');
  });

  it('タイトル画面の 表示(peek)では 何も 書かない', () => {
    const g = gas([st('1-2|07', save('ゆう', 5))]);
    expect(g.accountStudent('a@s.jp', '1-2', '7', false, true)?.rowIndex).toBe(2);
    expect(g.rows()[0][0]).toBe('1-2|07');
    expect(g.rows()[0][11]).toBe('');
  });

  it('行が なければ email つきで 作る(login のときだけ)', () => {
    const g = gas([]);
    expect(g.accountStudent('a@s.jp', '1-2', '7', false, false)).toBeNull();
    g.accountStudent('a@s.jp', '1-2', '7', true, false);
    expect(g.rows()[0][0]).toBe('1-2|7');
    expect(g.rows()[0][11]).toBe('a@s.jp');
  });
});

describe('セーブを 引き継ぐ(先生の メニュー)', () => {
  it('古い 行の セーブを 今の 行へ 移す。日時は 今に して、端末の 古い セーブに 上書きされない ように する', () => {
    const g = gas([st('1-2|07', save('前の セーブ', 8)), st('1-2|7', save('今日の セーブ', 1), 'a@s.jp')]);
    const r = g.transferSave(2, 3);
    expect(r).toEqual({ ok: true, name: '前の セーブ', level: 8 });
    const moved = JSON.parse(String(g.rows()[1][6]));
    expect(moved.player.level).toBe(8);
    expect(moved.updatedAt > '2026-10-01').toBe(true);
    expect(moved.createdAt).toBe(moved.updatedAt);
    // 移した 先に あった セーブ(今日の 分)は 消さずに 元の 行へ 入れかわる(まちがえても 戻せる)
    expect(JSON.parse(String(g.rows()[0][6])).player.name).toBe('今日の セーブ');
    expect(String(g.rows()[0][0]).startsWith('引継ぎ済|1-2|07|')).toBe(true);
    // 引き継ぎ済みの 行は もう だれの 行にも ならない
    expect(g.findStudent('1-2', '07')?.rowIndex).toBe(3);
  });

  it('セーブの ない 行からは 移さない', () => {
    const g = gas([st('1-2|07'), st('1-2|7', save('今日', 1))]);
    expect(g.transferSave(2, 3).ok).toBe(false);
  });
});

describe('生徒に 聞いて 引き継ぐ(先生の希望 2026-10-17)', () => {
  it('書き方だけ ちがう key の 前の セーブを 候補に 出す。セーブの ない 行・ほかの 人の 行は 出さない', () => {
    const g = gas([st('1-2|07', save('前', 8)), st('1-2|7', save('今日', 1), 'a@s.jp'), st('1年2組|7'), st('1-2|7x', save('ちがう', 3)), st('1-3|7', save('別の人', 4))]);
    expect(g.carryCandidates('a@s.jp', '1-2|7', 3).map((c) => [c.id, c.name, c.level])).toEqual([[2, '前', 8]]);
  });

  it('先生が 古い 行に email を 書けば、key が 似ていなくても 候補に なる', () => {
    const g = gas([st('2-1|30', save('前', 8), 'a@s.jp'), st('1-2|7', save('今日', 1), 'a@s.jp')]);
    expect(g.carryCandidates('a@s.jp', '1-2|7', 3).map((c) => c.id)).toEqual([2]);
  });

  it('前の セーブを 選ぶと 入れかわり、もう 聞かれない', () => {
    const g = gas([st('1-2|07', save('前', 8)), st('1-2|7', save('今日', 1), 'a@s.jp')]);
    const r = g.chooseCarry('a@s.jp', '1-2', '7', { rowIndex: 3 }, 2);
    expect(r.ok).toBe(true);
    expect(r.save?.player.level).toBe(8);
    expect(g.carryCandidates('a@s.jp', '1-2|7', 3)).toEqual([]);
  });

  it('いまの セーブの ままを 選ぶと 前の 行は 見送り(中身は 残る)で、もう 聞かれない', () => {
    const g = gas([st('1-2|07', save('前', 8)), st('1-2|7', save('今日', 1), 'a@s.jp')]);
    const r = g.chooseCarry('a@s.jp', '1-2', '7', { rowIndex: 3 }, 'keep');
    expect(r.save?.player.name).toBe('今日');
    expect(String(g.rows()[0][0]).startsWith('見送り|1-2|07|')).toBe(true);
    expect(JSON.parse(String(g.rows()[0][6])).player.name).toBe('前');
    expect(g.carryCandidates('a@s.jp', '1-2|7', 3)).toEqual([]);
    // 点検でも 数えない
    expect(g.carryoverReport().orphans.some((k) => k.startsWith('見送り|'))).toBe(false);
  });

  it('候補で ない 行の id は 受け付けない', () => {
    const g = gas([st('1-3|7', save('別の人', 4)), st('1-2|7', save('今日', 1), 'a@s.jp')]);
    expect(g.chooseCarry('a@s.jp', '1-2', '7', { rowIndex: 3 }, 2)).toEqual({ ok: false, error: 'bad_carry' });
  });
});

describe('引き継ぎの 点検', () => {
  it('そのまま・引き継ぐ・はじめから・だれにも 使われない セーブを 数える', () => {
    const g = gas(
      [st('1-2|1', save('A', 3), 'a@s.jp'), st('1-2|02', save('B', 4)), st('1-9|9', save('迷子', 6))],
      [
        ['承認', 'email', 'grade', 'class', 'number'],
        [true, 'a@s.jp', 1, '2', 1],
        [true, 'b@s.jp', 1, '2', 2],
        [true, 'c@s.jp', 1, '2', 3],
        [false, 'd@s.jp', 1, '2', 4],
      ],
    );
    const r = g.carryoverReport();
    expect(r.ok).toBe(1);
    expect(r.carry).toEqual(['1-2 2番(1-2|02 → 1-2|2)']);
    expect(r.fresh).toEqual(['1-2 3番']);
    expect(r.orphans).toEqual(['1-9|9']);
  });
});
