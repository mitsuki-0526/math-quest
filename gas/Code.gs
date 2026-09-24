/**
 * MathQuest サーバー(Google Apps Script Web アプリ)。要件 F1 F2 F4 F6 F70。
 *
 * 構成: 生徒が開くのはこの Web アプリの URL。doGet は小さな入口ページだけを返し、
 * ゲーム本体(プログラム・画像)はブラウザが GitHub Pages から読み込む(boot.js)。
 * セーブ・ログインは入口ページの中から google.script.run で rpc() を呼ぶ。
 * 生徒のデータは Google の中(この GAS とスプレッドシート)だけを通り、GitHub には送らない。
 *
 * セットアップは docs/ops.md を参照。概要:
 *   1. 新しいスプレッドシートを作り、拡張機能 → Apps Script でこのファイルを貼る
 *   2. 一度 setup() を実行(シートとヘッダー、初期設定を作る)
 *   3. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
 *      次のユーザーとして実行「自分」、アクセスできるユーザー「(学校名)内の全員」
 *   4. 発行された URL を生徒に配る
 *
 * 本人確認:
 *   - 学校アカウント方式(標準): Session.getActiveUser() で開いた人のアカウントが分かる。
 *     アカウント → クラス・番号 は先生が roster シートに書いた名簿で決まる(生徒は番号を選ばない。
 *     まちがい・なりすまし登録を起こさないため)。名簿にない人は入れない。合言葉は要らない。
 *     先生 = スクリプトの持ち主 + config の teachers
 *   - 合言葉方式(予備): アカウントが取れない環境では、クラス・番号・合言葉で入る
 *
 * シート:
 *   students : key | class | number | pass_hash | salt | player_name | save_json | updated_at | last_seen | created_at
 *   roster   : email | class | number | memo (先生が貼る名簿。memo は自由記入でプログラムは読まない)
 *   unlock   : class | g1c1 | g1c2 | ... (TRUE で解放。class="*" の行は全クラスの既定値)
 *   config   : key | value
 *   log      : time | action | class | number | note (エラーと主要イベントだけ)
 *
 * 授業の管理(スプレッドシートの「MathQuest」メニュー):
 *   - 全員をタイトルに戻す: config の session_epoch を今の時刻にする。開いているゲームは保存してタイトルに戻る
 *   - 受付を停止/再開: config の open。停止中は生徒のログイン・保存を断る(先生は対象外)
 *   - open_days(例: 月火水木金)・open_hours(例: 08:30-15:40)を書くと、その曜日・時間だけ受付中になる
 *
 * rpc(JSON 文字列) → JSON 文字列(どの応答にも session: { open, epoch } が付く):
 *   { action:'bootstrap', class }                  → { ok, unlock, classes, config, serverTime, account }
 *        account = { mode:'google', teacher, registered: {class, number} | null(名簿にない), player: {name, level} | null, error? } または { mode:'pass' }
 *   { action:'login', class, number, pass }        → { ok, isNew, save, unlock, teacher, account? }
 *        学校アカウント方式では送られた class/number/pass は見ない(名簿で決まる)
 *   { action:'save',  class, number, pass, save }  → { ok, stored:boolean, save }  (サーバーの方が新しければ stored=false で返す)
 *   { action:'load',  class, number, pass }        → { ok, save }
 *   { action:'feedback', class, number, pass, feedback:{ fun, difficulty, comment, level, chapter, answered, correct } } → { ok }
 *        感想(体験版の試遊)。feedback シートに 1 行足す
 */

var SHEETS = {
  students: ['key', 'class', 'number', 'pass_hash', 'salt', 'player_name', 'save_json', 'updated_at', 'last_seen', 'created_at'],
  roster: ['email', 'class', 'number', 'memo'],
  feedback: ['time', 'class', 'number', 'fun', 'difficulty', 'comment', 'level', 'chapter', 'answered', 'correct'],
  unlock: ['class', 'g1c1', 'g1c2', 'g1c3', 'g1c4', 'g1c5', 'g1c6', 'g1c7'],
  config: ['key', 'value'],
  log: ['time', 'action', 'class', 'number', 'note'],
};

var TEACHER_CLASS = 'teacher';
var DEFAULT_APP_BASE = 'https://mitsuki-0526.github.io/math-quest/';

/** 初回セットアップ。エディタから手で実行する。 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(SHEETS[name]);
      sh.setFrozenRows(1);
    }
  });
  var cfg = ss.getSheetByName('config');
  if (cfg.getLastRow() === 1) {
    cfg.appendRow(['app_base_url', DEFAULT_APP_BASE]); // ゲーム本体の配信元(GitHub Pages)。末尾は /
    // 先生用テストアカウントの合言葉。コードは公開されるので既定値は置かず、ランダムに作る
    cfg.appendRow(['teacher_pass', Utilities.getUuid().replace(/-/g, '').slice(0, 12)]);
    cfg.appendRow(['classes', '1-1,1-2,1-3,1-4']); // ログイン画面のクラス一覧
    cfg.appendRow(['teachers', '']); // 先生として扱う学校アカウント(カンマ区切り)。スクリプトの持ち主は書かなくても先生
    cfg.appendRow(['note', '数値の調整値(battle.baseDamage など)を key=値 で追加するとゲーム側の config を上書きします']);
  }
  // 後の版で足した設定。すでにあるキーは変えない
  ensureConfig('teachers', '');
  ensureConfig('open', true); // FALSE にすると生徒は入れない(メニューの「受付を停止する」)
  ensureConfig('open_days', ''); // 受付する曜日(例: 月火水木金)。空なら毎日
  ensureConfig('open_hours', ''); // 受付する時間(例: 08:30-12:30,13:20-15:40)。空なら一日中
  ensureConfig('session_epoch', ''); // メニューの「全員をタイトルに戻す」で書き換わる
  var roster = ss.getSheetByName('roster');
  // 「1-2」が日付に変わらないよう、クラス・番号の列は書式なしテキストにしておく
  roster.getRange('B:C').setNumberFormat('@');
  ss.getSheetByName('unlock').getRange('A:A').setNumberFormat('@');
  if (roster.getLastRow() === 1) roster.getRange(1, 5).setValue('← 生徒の学校アカウント・クラス・出席番号を 1 人 1 行で貼る(memo は自由。氏名は書かなくてよい)');
  var un = ss.getSheetByName('unlock');
  if (un.getLastRow() === 1) {
    un.appendRow(['*', true, false, false, false, false, false, false]);
    un.getRange(2, 2, 1, 7).insertCheckboxes();
  }
  Logger.log('セットアップ完了。デプロイして URL を生徒に配ってください。teacher_pass は先生用の合言葉です(好きな値に変えてよい)。');
}

// ------------------------------------------------------------------ 授業の管理(先生のメニュー)

/** スプレッドシートを開いたときに「MathQuest」メニューを出す */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('MathQuest')
    .addItem('全員をタイトルに戻す', 'menuResetSessions')
    .addSeparator()
    .addItem('受付を停止する(生徒は入れない)', 'menuClose')
    .addItem('受付を再開する', 'menuOpen')
    .addToUi();
}

function menuResetSessions() {
  setConfig('session_epoch', literal(new Date().toISOString()));
  logRow('reset_sessions', '', '', '');
  SpreadsheetApp.getActiveSpreadsheet().toast('開いているゲームは 2分以内に 保存して タイトルに 戻ります', 'MathQuest');
}

function menuClose() {
  setConfig('open', false);
  logRow('close', '', '', '');
  SpreadsheetApp.getActiveSpreadsheet().toast('受付を停止しました。開いているゲームは 2分以内に タイトルに 戻ります(先生は入れます)', 'MathQuest');
}

function menuOpen() {
  setConfig('open', true);
  logRow('open', '', '', '');
  var note = isOpenNow(readConfig()) ? '' : '(ただし open_days / open_hours の時間外なので、まだ入れません)';
  SpreadsheetApp.getActiveSpreadsheet().toast('受付を再開しました' + note, 'MathQuest');
}

/** いま生徒を受け付けるか(open と、曜日・時間の設定) */
function isOpenNow(cfg) {
  if (cfg.open === false || String(cfg.open).trim().toUpperCase() === 'FALSE') return false;
  var tz = Session.getScriptTimeZone();
  var now = new Date();
  var days = String(cfg.open_days || '').trim();
  if (days) {
    var d = Number(Utilities.formatDate(now, tz, 'u')); // 1=月 … 7=日
    if (days.indexOf('月火水木金土日'.charAt(d - 1)) < 0) return false;
  }
  var ranges = parseHours(cfg.open_hours);
  // 書き方をまちがえた範囲は無視する(打ちまちがいで一日中閉まらないように)
  if (ranges.length) {
    var hm = Utilities.formatDate(now, tz, 'HH:mm');
    var inside = ranges.some(function (r) {
      return hm >= r[0] && hm < r[1];
    });
    if (!inside) return false;
  }
  return true;
}

/** "08:30-12:30,13:20-15:40" → [['08:30','12:30'], ['13:20','15:40']] */
function parseHours(v) {
  var out = [];
  String(v || '')
    .split(/[,、]/)
    .forEach(function (part) {
      var m = part.trim().match(/^(\d{1,2}):(\d{2})\s*[-~〜ー]\s*(\d{1,2}):(\d{2})$/);
      if (!m) return;
      var pad = function (h) {
        return (h.length === 1 ? '0' : '') + h;
      };
      out.push([pad(m[1]) + ':' + m[2], pad(m[3]) + ':' + m[4]]);
    });
  return out;
}

/** ゲームに知らせる授業の状態。epoch が変わったら、開いているゲームはタイトルに戻る */
function sessionInfo() {
  var cfg = readConfig();
  var e = cfg.session_epoch;
  return { open: isOpenNow(cfg), epoch: e instanceof Date ? e.toISOString() : String(e || '') };
}

// ------------------------------------------------------------------ 入口

/** 入口ページ。ゲーム本体は GitHub Pages の boot.js が読み込む */
function doGet() {
  var base = appBase();
  var html =
    '<!doctype html><html lang="ja"><head><meta charset="utf-8"></head><body>' +
    '<div id="app"><p style="font-family:sans-serif;padding:24px">読み込み中…</p></div>' +
    '<script src="' + base + 'boot.js"></script>' +
    '</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('MathQuest')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** 本体の配信元。config で変えられるが、https の URL 以外は受け付けない(任意のスクリプトを読ませないため) */
function appBase() {
  var v = String(readConfig().app_base_url || '').trim();
  if (!/^https:\/\/[^\s"'<>]+\/$/.test(v)) v = DEFAULT_APP_BASE;
  return v;
}

/**
 * 入口ページから google.script.run で呼ばれる唯一の窓口。
 * 引数・戻り値は JSON 文字列(google.script.run の変換の癖を避けるため)。
 * 学校ドメイン限定で公開するので、外部から直接は呼べない。
 */
function rpc(text) {
  var body = {};
  try {
    body = JSON.parse(String(text || '{}'));
  } catch (err) {
    return JSON.stringify({ ok: false, error: 'bad_json' });
  }
  try {
    var res = handle(body);
    res.session = sessionInfo();
    return JSON.stringify(res);
  } catch (err) {
    logRow('error', body['class'], body.number, String(err));
    return JSON.stringify({ ok: false, error: 'server_error' });
  }
}

function handle(body) {
  if (body.action === 'bootstrap') return bootstrap(String(body['class'] || ''));
  if (body.action === 'ping') return { ok: true, serverTime: new Date().toISOString() };

  var email = currentEmail();
  if (email) {
    if (!isTeacherEmail(email) && !isOpenNow(readConfig())) return { ok: false, error: 'closed' };
    return handleAccount(email, body);
  }

  // ここから合言葉方式(アカウントが取れない環境のための予備)
  var cls = String(body['class'] || '').trim();
  var num = String(body.number || '').trim();
  var pass = String(body.pass || '');
  if (!cls || !num) return { ok: false, error: 'missing_identity' };
  // クラス・番号は短い文字列だけを受け付ける(シートに書くので、長文や数式を持ち込ませない)
  if (cls.length > 20 || num.length > 10 || pass.length > 64) return { ok: false, error: 'bad_identity' };
  if (cls !== TEACHER_CLASS && !isOpenNow(readConfig())) return { ok: false, error: 'closed' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // 合言葉の総当たり対策: 同じアカウントで続けて失敗したら、しばらく受け付けない
    if (isLocked(cls, num)) return { ok: false, error: 'locked' };
    var res;
    if (body.action === 'login') res = login(cls, num, pass);
    else if (body.action === 'save') res = saveGame(cls, num, pass, body.save);
    else if (body.action === 'load') res = loadGame(cls, num, pass);
    else if (body.action === 'feedback') res = passFeedback(cls, num, pass, body.feedback);
    else return { ok: false, error: 'unknown_action' };
    if (res.error === 'bad_pass') recordFailure(cls, num);
    else if (res.ok) clearFailures(cls, num);
    return res;
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------ 処理

function bootstrap(cls) {
  var cfg = readConfig();
  return {
    ok: true,
    unlock: unlockFor(cls),
    classes: String(cfg.classes || '')
      .split(',')
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean),
    config: gameConfigOverrides(cfg),
    serverTime: new Date().toISOString(),
    account: accountInfo(),
  };
}

function login(cls, num, pass) {
  var cfg = readConfig();
  // 先生用テストアカウント: 全章解放、セーブはサーバーに残す(生徒と同じ扱い)
  var teacher = cls === TEACHER_CLASS && pass === String(cfg.teacher_pass || '');
  if (cls === TEACHER_CLASS && !teacher) return { ok: false, error: 'bad_pass' };

  var row = findStudent(cls, num);
  var now = new Date().toISOString();
  if (!row) {
    if (!pass) return { ok: false, error: 'missing_pass' };
    var salt = Utilities.getUuid();
    var sh = sheet('students');
    sh.appendRow([literal(key(cls, num)), literal(cls), literal(num), hashPass(pass, salt), salt, '', '', '', now, now]);
    logRow('register', cls, num, '');
    return { ok: true, isNew: true, save: null, unlock: unlockFor(cls, teacher), teacher: teacher };
  }
  // 合言葉が空(先生がリセット)なら、今回の入力を新しい合言葉にする
  if (!row.pass_hash) {
    if (!pass) return { ok: false, error: 'missing_pass' };
    var salt2 = Utilities.getUuid();
    setCell(row.rowIndex, 'pass_hash', hashPass(pass, salt2));
    setCell(row.rowIndex, 'salt', salt2);
    logRow('reset_pass', cls, num, '');
  } else if (!teacher && hashPass(pass, row.salt) !== row.pass_hash) {
    return { ok: false, error: 'bad_pass' };
  }
  setCell(row.rowIndex, 'last_seen', now);
  var save = row.save_json ? JSON.parse(row.save_json) : null;
  return { ok: true, isNew: false, save: save, unlock: unlockFor(cls, teacher), teacher: teacher };
}

function saveGame(cls, num, pass, save) {
  var row = findStudent(cls, num);
  if (!row) return { ok: false, error: 'not_found' };
  if (!authorize(row, cls, pass)) return { ok: false, error: 'bad_pass' };
  return storeSave(row, save);
}

/** 行にセーブを書く。サーバーの方が新しければ書かずにそちらを返す */
function storeSave(row, save) {
  if (!save || typeof save !== 'object') return { ok: false, error: 'bad_save' };
  var incoming = String(save.updatedAt || '');
  if (incoming && !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(incoming)) return { ok: false, error: 'bad_save' };
  var stored = String(row.updated_at || '');
  // 競合: サーバーの方が新しければ上書きせず、サーバー側を返す(要件 F3「新しい方を採用」)
  if (stored && incoming && incoming < stored) {
    return { ok: true, stored: false, save: parseSave(row) };
  }
  var text = JSON.stringify(save);
  if (text.length > 45000) return { ok: false, error: 'save_too_large' }; // セルの上限は 50,000 文字
  setCell(row.rowIndex, 'save_json', asText(text));
  // 日時の文字列はシートが自動で日付型に変えてしまい、文字列比較が壊れるので ' を付けて文字列のまま保存する
  setCell(row.rowIndex, 'updated_at', "'" + (incoming || new Date().toISOString()));
  setCell(row.rowIndex, 'player_name', asText(String((save.player && save.player.name) || '').slice(0, 20)));
  setCell(row.rowIndex, 'last_seen', new Date().toISOString());
  return { ok: true, stored: true, save: null };
}

function loadGame(cls, num, pass) {
  var row = findStudent(cls, num);
  if (!row) return { ok: false, error: 'not_found' };
  if (!authorize(row, cls, pass)) return { ok: false, error: 'bad_pass' };
  return { ok: true, save: parseSave(row) };
}

// ------------------------------------------------------------------ 感想(体験版の試遊)

var FEEDBACK_PER_HOUR = 5; // いたずらで大量に送られないように
var FEEDBACK_MAX = 200;

function passFeedback(cls, num, pass, f) {
  var row = findStudent(cls, num);
  if (!row) return { ok: false, error: 'not_found' };
  if (!authorize(row, cls, pass)) return { ok: false, error: 'bad_pass' };
  return writeFeedback(cls, num, f);
}

function writeFeedback(cls, num, f) {
  if (!f || typeof f !== 'object') return { ok: false, error: 'bad_feedback' };
  var fun = Number(f.fun);
  var difficulty = String(f.difficulty || '');
  if (!(fun >= 1 && fun <= 5) || ['easy', 'ok', 'hard'].indexOf(difficulty) < 0) return { ok: false, error: 'bad_feedback' };
  var cache = CacheService.getScriptCache();
  var k = 'fb:' + key(cls, num);
  var n = Number(cache.get(k) || 0);
  if (n >= FEEDBACK_PER_HOUR) return { ok: false, error: 'too_many' };
  cache.put(k, String(n + 1), 3600);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // setup をやり直していなくても使えるように、なければ作る
  var sh = ss.getSheetByName('feedback');
  if (!sh) {
    sh = ss.insertSheet('feedback');
    sh.appendRow(SHEETS.feedback);
    sh.setFrozenRows(1);
  }
  var label = { easy: 'やさしい', ok: 'ちょうどいい', hard: 'むずかしい' }[difficulty];
  sh.appendRow([
    new Date().toISOString(),
    literal(cls),
    literal(num),
    Math.round(fun),
    label,
    asText(String(f.comment || '').slice(0, FEEDBACK_MAX)),
    Number(f.level) || '',
    asText(String(f.chapter || '').slice(0, 20)),
    Number(f.answered) || 0,
    Number(f.correct) || 0,
  ]);
  return { ok: true };
}

function parseSave(row) {
  return row.save_json ? JSON.parse(row.save_json) : null;
}

// ------------------------------------------------------------------ 学校アカウント方式

/** 開いている人の学校アカウント。取れなければ ''(合言葉方式になる) */
function currentEmail() {
  try {
    return String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  } catch (e) {
    return '';
  }
}

/** 先生か: スクリプトの持ち主(この Web アプリを作った先生)か、config の teachers に書かれた人 */
function isTeacherEmail(email) {
  var owner = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (email === owner) return true;
  var list = String(readConfig().teachers || '')
    .toLowerCase()
    .split(',')
    .map(function (s) {
      return s.trim();
    });
  return list.indexOf(email) >= 0;
}

/**
 * 名簿からクラス・番号を引く。
 * 名簿のまちがい(同じアカウントが2行・同じクラス番号に2人)は、別の人のデータに触れてしまうので入れずに知らせる
 * 戻り値: { class, number } / { error: 'not_in_roster' | 'roster_conflict' }
 */
function rosterEntry(email) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('roster');
  if (!sh || sh.getLastRow() < 2) return { error: 'not_in_roster' };
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  var mine = [];
  var byKey = {};
  for (var i = 0; i < values.length; i++) {
    var e = cellText(values[i][0]).toLowerCase();
    var c = cellText(values[i][1]);
    var n = cellText(values[i][2]);
    if (!e || !c || !n) continue;
    if (/^\d+$/.test(n)) n = String(Number(n)); // "07" → "7"
    var k = key(c, n);
    byKey[k] = (byKey[k] || 0) + 1;
    if (e === email) mine.push({ class: c, number: n });
  }
  if (mine.length === 0) return { error: 'not_in_roster' };
  if (mine.length > 1 || byKey[key(mine[0]['class'], mine[0].number)] > 1) {
    logRow('roster_conflict', mine[0]['class'], mine[0].number, '名簿に重複があります');
    return { error: 'roster_conflict' };
  }
  return mine[0];
}

/** 先生の行のクラス・番号(番号は選ばないので、アカウントから決まる短い記号にする) */
function teacherEntry(email) {
  return { class: TEACHER_CLASS, number: 't' + hashPass(email, 'teacher').slice(0, 6) };
}

/** タイトル画面に「だれとして入るか」を知らせる(名前とレベルも出して、他人の端末で気づけるように) */
function accountInfo() {
  var email = currentEmail();
  if (!email) return { mode: 'pass' };
  var teacher = isTeacherEmail(email);
  var entry = teacher ? teacherEntry(email) : rosterEntry(email);
  if (entry.error) return { mode: 'google', teacher: false, registered: null, player: null, error: entry.error };
  var row = findStudent(entry['class'], entry.number);
  var save = row ? parseSave(row) : null;
  return {
    mode: 'google',
    teacher: teacher,
    registered: { class: entry['class'], number: entry.number },
    player: save && save.player ? { name: String(save.player.name || ''), level: Number(save.player.level || 1) } : null,
  };
}

/** 保存・読み込みは、送られてきたクラス・番号ではなく、アカウントと名簿で行を決める(ほかの人の行には触れない) */
function handleAccount(email, body) {
  var teacher = isTeacherEmail(email);
  var entry = teacher ? teacherEntry(email) : rosterEntry(email);
  if (entry.error) return { ok: false, error: entry.error };
  var cls = entry['class'];
  var num = entry.number;

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (body.action === 'feedback') return writeFeedback(cls, num, body.feedback);
    var row = findStudent(cls, num);
    var now = new Date().toISOString();
    var account = { class: cls, number: num };
    if (body.action === 'login') {
      if (!row) {
        sheet('students').appendRow([literal(key(cls, num)), literal(cls), literal(num), '', '', '', '', '', now, now]);
        logRow('register', cls, num, '');
        return { ok: true, isNew: true, save: null, unlock: unlockFor(cls, teacher), teacher: teacher, account: account };
      }
      setCell(row.rowIndex, 'last_seen', now);
      return { ok: true, isNew: !row.save_json, save: parseSave(row), unlock: unlockFor(cls, teacher), teacher: teacher, account: account };
    }
    if (!row) return { ok: false, error: 'not_registered' };
    if (body.action === 'save') return storeSave(row, body.save);
    if (body.action === 'load') return { ok: true, save: parseSave(row) };
    return { ok: false, error: 'unknown_action' };
  } finally {
    lock.releaseLock();
  }
}

function authorize(row, cls, pass) {
  if (cls === TEACHER_CLASS) return pass === String(readConfig().teacher_pass || '');
  if (!row.pass_hash) return false;
  return hashPass(pass, row.salt) === row.pass_hash;
}

// ------------------------------------------------------------------ 総当たり対策

var MAX_FAILURES = 8; // 打ちまちがいは許しつつ、総当たりは現実的でなくする
var LOCK_SECONDS = 600;

/** 先生用アカウントは番号を変えて試せるので、クラス単位でまとめて数える */
function failureKey(cls, num) {
  return 'fail:' + (cls === TEACHER_CLASS ? TEACHER_CLASS : key(cls, num));
}

function isLocked(cls, num) {
  return Number(CacheService.getScriptCache().get(failureKey(cls, num)) || 0) >= MAX_FAILURES;
}

function recordFailure(cls, num) {
  var cache = CacheService.getScriptCache();
  var k = failureKey(cls, num);
  var n = Number(cache.get(k) || 0) + 1;
  cache.put(k, String(n), LOCK_SECONDS);
  if (n === MAX_FAILURES) logRow('locked', cls, num, '合言葉の失敗が続いたため ' + LOCK_SECONDS / 60 + ' 分ロック');
}

function clearFailures(cls, num) {
  // 先生用はクラス単位で数えているので、成功しても消さない(ほかの番号の失敗を帳消しにしない)
  if (cls === TEACHER_CLASS) return;
  CacheService.getScriptCache().remove(failureKey(cls, num));
}

// ------------------------------------------------------------------ 解放・設定

/** クラスの解放章。class の行がなければ "*" の行を使う。先生は全解放 */
function unlockFor(cls, teacher) {
  var sh = sheet('unlock');
  var values = sh.getDataRange().getValues();
  var header = values[0];
  if (teacher) return header.slice(1).map(String);
  var pick = null;
  var fallback = null;
  for (var i = 1; i < values.length; i++) {
    var c = cellText(values[i][0]);
    if (c === cls) pick = values[i];
    if (c === '*') fallback = values[i];
  }
  var row = pick || fallback;
  if (!row) return ['g1c1'];
  var out = [];
  for (var j = 1; j < header.length; j++) if (row[j] === true || String(row[j]).toUpperCase() === 'TRUE') out.push(String(header[j]));
  return out;
}

/** 1 回の実行(= 1 回の通信)の中では設定を読み直さない。シートの読み取りは遅いので */
var configCache = null;

function readConfig() {
  if (configCache) return configCache;
  var values = sheet('config').getDataRange().getValues();
  var cfg = {};
  for (var i = 1; i < values.length; i++) if (values[i][0]) cfg[String(values[i][0]).trim()] = values[i][1];
  configCache = cfg;
  return cfg;
}

/** 設定を書く(キーがなければ行を足す) */
function setConfig(k, v) {
  var sh = sheet('config');
  var keys = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  configCache = null;
  for (var i = 1; i < keys.length; i++) {
    if (String(keys[i][0]).trim() === k) {
      sh.getRange(i + 1, 2).setValue(v);
      return;
    }
  }
  sh.appendRow([k, v]);
}

/** 設定のキーがなければ既定値で足す */
function ensureConfig(k, v) {
  if (!(k in readConfig())) setConfig(k, v);
}

/** config シートのうち "battle.xxx" のようにドットを含むキーをゲームの調整値として返す */
function gameConfigOverrides(cfg) {
  var out = {};
  Object.keys(cfg).forEach(function (k) {
    if (k.indexOf('.') > 0) {
      var v = cfg[k];
      out[k] = typeof v === 'number' ? v : isNaN(Number(v)) ? v : Number(v);
    }
  });
  return out;
}

// ------------------------------------------------------------------ シート操作

function sheet(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('シートがありません: ' + name + '(setup() を実行してください)');
  return sh;
}

function key(cls, num) {
  return cls + '|' + num;
}

function findStudent(cls, num) {
  var sh = sheet('students');
  var last = sh.getLastRow();
  if (last < 2) return null;
  var keys = sh.getRange(2, 1, last - 1, 1).getValues();
  var k = key(cls, num);
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === k) {
      var values = sh.getRange(i + 2, 1, 1, SHEETS.students.length).getValues()[0];
      var row = { rowIndex: i + 2 };
      SHEETS.students.forEach(function (h, j) {
        row[h] = values[j];
      });
      return row;
    }
  }
  return null;
}

function setCell(rowIndex, column, value) {
  var col = SHEETS.students.indexOf(column) + 1;
  sheet('students').getRange(rowIndex, col).setValue(value);
}

/**
 * 利用者が入力した値をセルに書くときに通す。= + - @ で始まる値は数式として解釈され、
 * 先生がシートを開いたときに実行されうる(CSV/数式インジェクション)。先頭に ' を付けて文字列に固定する。
 */
/**
 * セルの値を文字列として読む。シートは「1-2」と打つと 1月2日 の日付に変えてしまうので、日付なら「月-日」に戻す
 * (クラス名が日付に化けても照合できるように)
 */
function cellText(v) {
  if (v instanceof Date) return v.getMonth() + 1 + '-' + v.getDate();
  return String(v == null ? '' : v).trim();
}

/** クラス・番号をシートに書くときは ' を付けて文字列に固定する(「1-2」が日付に、「07」が 7 に変わらないように) */
function literal(v) {
  return "'" + String(v);
}

function asText(value) {
  var s = String(value == null ? '' : value);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function hashPass(pass, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pass, Utilities.Charset.UTF_8);
  return bytes
    .map(function (b) {
      var s = (b < 0 ? b + 256 : b).toString(16);
      return s.length === 1 ? '0' + s : s;
    })
    .join('');
}

function logRow(action, cls, num, note) {
  try {
    sheet('log').appendRow([new Date().toISOString(), action, asText(cls || ''), asText(num || ''), asText(note || '')]);
  } catch (e) {
    /* ログに失敗しても本処理は止めない */
  }
}

