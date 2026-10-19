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
 *   students : key | class | number | pass_hash | salt | player_name | save_json | updated_at | last_seen | created_at | reset_at | email
 *              email = 学校アカウント(セーブを 本人に 結びつける。更新や 進級で クラス・番号が 変わっても 引き継ぐ)
 *   roster   : 承認 | email | name | grade | class | number | memo (先生の名簿。memo は自由記入でプログラムは読まない。
 *              列は 見出しで 探すので 並べ替えてもよい。grade = 学年(3)、class = 組(1)。ゲームの中の クラス名は「3-1」。
 *              前の版の 書き方(class に「1-2」、grade は 空でも可)も そのまま 読める。
 *              承認 = チェックの 入った 行だけが 有効。名簿に ない 生徒は ゲームから クラス・番号を 申請でき、承認なしの 行が 足される。
 *              先生が email・grade・class だけ 書いた 行は、生徒が 同じ 学年・組で 番号を 入れると 承認ずみに なる。
 *              name は Classroom から 取り込んだ 氏名(先生が 番号を 確かめるため。プログラムは 読まない))
 *   unlock   : class | g1c1 | g1c2 | ... (TRUE で解放。class="*" の行は全クラスの既定値)
 *   config   : key | value
 *   log      : time | action | class | number | note (エラーと主要イベントだけ)
 *   treasure : time | class | number | player_name | level | note (宝の地図を買った人。行を消すと、そのクラスで また売り出す)
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
 *   { action:'review', class, number, pass, marks:[{ node, template, star, rating, comment, flagged }] } → { ok, count }(先生だけ。問題の見本帳の印)
 *   { action:'apply', class, number }              → { ok, pending:{ class, number }, approved? }(学校アカウント方式で 名簿に ない 生徒が クラス・番号を 申請する。approved = 承認なしで 入れる)
 *   login の 応答の carry: [{ id, name, level, updatedAt }] = 前の セーブらしい 行(学校アカウント方式)。ゲームが 生徒に どちらで 続けるか 聞く
 *   { action:'carry', pick: 行の id | 'keep' }       → { ok, save }(前の セーブで 続ける / いまの セーブの まま)
 *        感想(体験版の試遊)。feedback シートに 1 行足す
 *   { action:'treasure', class, number, pass, buy } → { ok, treasure:{ onSale, soldOut, mine, opensAt? } }
 *        宝の地図(クラスに 1 枚だけ)。config の treasure_grade(学年)・treasure_class(組)で 売る クラスを 決める。buy=true なら早い者勝ちで買う
 *        売る期間は config の treasure_from / treasure_until(空なら いつでも)。始まる前は opensAt(「11/1」など)を返す
 *        config の treasure_open(チェックボックス)を FALSE にすると、期間に かかわらず 売らない
 */

var SHEETS = {
  // reset_at: 先生がセーブを消した日時。これより前に始めたセーブ(端末に残ったもの)は受け取らない
  students: ['key', 'class', 'number', 'pass_hash', 'salt', 'player_name', 'save_json', 'updated_at', 'last_seen', 'created_at', 'reset_at', 'email'],
  roster: ['承認', 'email', 'name', 'grade', 'class', 'number', 'memo'],
  feedback: ['time', 'class', 'number', 'fun', 'difficulty', 'comment', 'level', 'chapter', 'answered', 'correct'],
  review: ['time', 'node', 'template', 'star', 'rating', 'comment', 'flagged'],
  unlock: ['class', 'g1c1', 'g1c2', 'g1c3', 'g1c4', 'g1c5', 'g1c6', 'g1c7'],
  config: ['key', 'value'],
  log: ['time', 'action', 'class', 'number', 'note'],
  treasure: ['time', 'class', 'number', 'player_name', 'level', 'note'],
};

var TEACHER_CLASS = 'teacher';
var DEFAULT_APP_BASE = 'https://mitsuki-0526.github.io/math-quest/';

/** 初回セットアップ。エディタから手で実行する。 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // 何かを 変える 前に セーブを 写しておく(更新で 引き継ぎに 失敗しても 戻せるように。先生の指摘 2026-10-17)
  var bak = backupStudents();
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
  ensureConfig('treasure_grade', ''); // 宝の地図を売る学年(例: 3。複数なら 1,3)。空ならどこでも売らない
  ensureConfig('treasure_class', ''); // 宝の地図を売る組(例: 1。複数なら 1,2)。空なら その学年の 全部の組
  ensureConfig('treasure_open', false); // 宝の地図を売るか(TRUE / FALSE)。始めは止めておき、先生が TRUE にしたら売る
  ensureConfig('treasure_from', ''); // 宝の地図を売り始める日時(例: 2026-11-01 または 2026-11-01 08:30)。空ならすぐ
  ensureConfig('treasure_until', ''); // 売るのをやめる日(この日の終わりまで売る。時刻も書ける)。空ならずっと
  // 古い 版の students には 後から 足した 列(reset_at・email)の 見出しが ない
  var st = ss.getSheetByName('students');
  var head = st.getRange(1, 1, 1, SHEETS.students.length).getValues()[0];
  SHEETS.students.forEach(function (h, j) {
    if (!cellText(head[j])) st.getRange(1, j + 1).setValue(h);
  });
  var roster = ss.getSheetByName('roster');
  ensureRosterApprovedColumn(roster);
  ensureRosterGradeColumn(roster);
  // 「1-2」が日付に変わらないよう、クラス・番号の列は書式なしテキストにしておく
  var cols = rosterColumns(roster.getRange(1, 1, 1, Math.max(roster.getLastColumn(), 1)).getValues()[0]);
  roster.getRange(1, cols['class'], roster.getMaxRows(), 1).setNumberFormat('@');
  // 出席番号は 数に する(文字のままだと 並べ替えで 1, 10, 11, 2 … の 順に なる。先生の指摘 2026-10-16)
  numberColumn(roster, cols.number);
  numberColumn(ss.getSheetByName('students'), SHEETS.students.indexOf('number') + 1);
  var tsh = ss.getSheetByName('treasure');
  if (tsh) numberColumn(tsh, SHEETS.treasure.indexOf('number') + 1);
  ss.getSheetByName('unlock').getRange('A:A').setNumberFormat('@');
  // 学年・クラスで 絞り込めるように(見出しの ▼ から 選ぶ)
  ensureFilter(roster);
  ensureFilter(ss.getSheetByName('students'));
  checkboxConfig('treasure_open');
  if (roster.getLastRow() === 1) roster.getRange(1, roster.getLastColumn() + 1).setValue('← メニューの「Classroom から 名簿を 取り込む」か、生徒の 申請(承認に チェック)で 埋まる。手で 貼っても よい');
  var un = ss.getSheetByName('unlock');
  if (un.getLastRow() === 1) {
    un.appendRow(['*', true, false, false, false, false, false, false]);
    un.getRange(2, 2, 1, 7).insertCheckboxes();
  }
  Logger.log('セットアップ完了。' + (bak ? 'students シートを「' + bak + '」に 写しました。' : '') + 'デプロイして URL を生徒に配ってください。生徒が 開く 前に メニューの「引き継ぎを 点検する」を 押してください。');
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
    .addSeparator()
    .addItem('集計を更新する(summary シート)', 'menuSummary')
    .addSeparator()
    .addItem('Classroom から 名簿を 取り込む', 'menuImportClassroom')
    .addItem('名簿の 申請を すべて 承認する(承認待ちの 行)', 'menuApproveAll')
    .addSeparator()
    .addItem('引き継ぎを 点検する(更新の あと、生徒が 開く 前に)', 'menuCarryover')
    .addItem('セーブを 引き継ぐ(students シートで 2 行を 選ぶ)', 'menuTransfer')
    .addItem('いま バックアップを 取る', 'menuBackup')
    .addSeparator()
    .addItem('選んだ生徒のセーブを消す(students シートで行を選ぶ)', 'menuWipeSelected')
    .addItem('全員のセーブを消す', 'menuWipeAll')
    .addToUi();
}

// ------------------------------------------------------------------ 授業の集計(summary シート)

/** この回答数に満たない組は、判定を出さない(数問では 正答率が ぶれるため) */
var SUMMARY_MIN_ANSWERS = 20;
/** ★ ごとの 目標の正答率 [下限, 上限](docs/difficulty.md)。外れたら「むずかしめ」「やさしめ」 */
var SUMMARY_TARGETS = { 1: [0.9, 1.01], 2: [0.8, 0.9], 3: [0.5, 0.75] };

function menuSummary() {
  var r = writeSummary();
  SpreadsheetApp.getActiveSpreadsheet().toast('生徒 ' + r.students + ' 人ぶんを 集計しました(' + r.rows + ' 行)。判定が ついた行を 見てください', 'MathQuest');
}

/** students シートの全員のセーブから 集計して、summary シートを 書き直す */
function writeSummary() {
  var sh = sheet('students');
  var last = sh.getLastRow();
  var values = last < 2 ? [] : sh.getRange(2, 1, last - 1, SHEETS.students.length).getValues();
  var ci = SHEETS.students.indexOf('class');
  var si = SHEETS.students.indexOf('save_json');
  var list = [];
  values.forEach(function (v) {
    var cls = cellText(v[ci]);
    if (!cls || cls === TEACHER_CLASS || !v[si]) return; // 先生の試し遊びは 数えない
    if (isRetiredKey(v[0])) return; // 退避・引き継ぎ済みの 行(同じ 生徒を 2 回 数えない)
    try {
      var save = JSON.parse(v[si]);
      if (save && save.tally) list.push({ cls: cls, tally: save.tally });
    } catch (e) {
      // 壊れた行は とばす
    }
  });
  var result = summarizeTallies(list, SUMMARY_TARGETS, SUMMARY_MIN_ANSWERS);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var out = ss.getSheetByName('summary') || ss.insertSheet('summary');
  out.clear();
  var table = [result.header].concat(result.rows);
  out.getRange(1, 1, table.length, result.header.length).setValues(table);
  out.setFrozenRows(1);
  out.setFrozenColumns(4);
  // 判定の列に 色を付ける(むずかしめ = 赤、やさしめ = 青)
  if (result.rows.length) {
    var col = result.header.indexOf('判定') + 1;
    var colors = result.rows.map(function (r) {
      var j = r[col - 1];
      return [j === 'むずかしめ' ? '#f8d7d3' : j === 'やさしめ' ? '#d6e6fb' : null];
    });
    out.getRange(2, col, colors.length, 1).setBackgrounds(colors);
  }
  out.getRange(table.length + 2, 1).setValue(
    '更新: ' + new Date().toLocaleString() + ' ・ 判定は 回答 ' + SUMMARY_MIN_ANSWERS + ' 問以上の組だけ。目標の正答率 ★1: 90% 以上 / ★2: 80〜90% / ★3: 50〜75%',
  );
  return { students: list.length, rows: result.rows.length };
}

/**
 * 生徒ごとの集計(save.tally)を 地点 × 出題タイプ × ★ で 合計する。シートに触らない(テストできるように)。
 *   list: [{ cls, tally: { c: { '章.地点|タイプ|★': [回答, 正解, 秒, ヒント, 時間切れ] }, names, order } }]
 * 戻り値: { header, rows }。rows は 章 → 地点の順番 → タイプ → ★ の順
 */
function summarizeTallies(list, targets, minAnswers) {
  var groups = {};
  var names = {};
  var order = {};
  var classes = {};
  list.forEach(function (s) {
    classes[s.cls] = true;
    var t = s.tally || {};
    Object.keys(t.names || {}).forEach(function (k) {
      names[k] = t.names[k];
    });
    Object.keys(t.order || {}).forEach(function (k) {
      order[k] = t.order[k];
    });
    Object.keys(t.c || {}).forEach(function (k) {
      var v = t.c[k];
      if (!Array.isArray(v) || !(v[0] > 0)) return;
      var g = (groups[k] = groups[k] || { n: 0, ok: 0, sec: 0, hint: 0, timeout: 0, students: 0, byClass: {} });
      g.n += v[0];
      g.ok += v[1];
      g.sec += v[2];
      g.hint += v[3];
      g.timeout += v[4];
      g.students++;
      var c = (g.byClass[s.cls] = g.byClass[s.cls] || { n: 0, ok: 0 });
      c.n += v[0];
      c.ok += v[1];
    });
  });
  var classList = Object.keys(classes).sort();
  var header = ['章', '地点', '出題タイプ', '★', '人数', '回答数', '正答率', '平均時間(秒)', 'ヒント率', '時間切れ率', '判定'].concat(
    classList.map(function (c) {
      return c + ' 正答率';
    }),
  );
  var keys = Object.keys(groups).sort(function (a, b) {
    var pa = a.split('|');
    var pb = b.split('|');
    var ca = chapterNumber(pa[0]);
    var cb = chapterNumber(pb[0]);
    if (ca !== cb) return ca - cb;
    var oa = order[pa[0]] == null ? 50 : order[pa[0]];
    var ob = order[pb[0]] == null ? 50 : order[pb[0]];
    if (oa !== ob) return oa - ob;
    if (pa[1] !== pb[1]) return pa[1] < pb[1] ? -1 : 1;
    return Number(pa[2]) - Number(pb[2]);
  });
  var pct = function (x, n) {
    return n > 0 ? Math.round((x / n) * 1000) / 10 + '%' : '';
  };
  var rows = keys.map(function (k) {
    var p = k.split('|');
    var g = groups[k];
    var rate = g.ok / g.n;
    var range = targets[p[2]] || [0, 1.01];
    var judge = g.n < minAnswers ? 'データ不足' : rate < range[0] ? 'むずかしめ' : rate > range[1] ? 'やさしめ' : 'ちょうど';
    return ['第' + chapterNumber(p[0]) + '章', names[p[0]] || p[0], names[p[1]] || p[1], '★' + p[2], g.students, g.n, pct(g.ok, g.n), Math.round((g.sec / g.n) * 10) / 10, pct(g.hint, g.n), pct(g.timeout, g.n), judge].concat(
      classList.map(function (c) {
        var cg = g.byClass[c];
        return cg ? pct(cg.ok, cg.n) + '(' + cg.n + ')' : '';
      }),
    );
  });
  return { header: header, rows: rows };
}

/** 'g1c3.pier' → 3 */
function chapterNumber(nodeId) {
  var m = /c(\d+)\./.exec(String(nodeId));
  return m ? Number(m[1]) : 0;
}

function menuResetSessions() {
  setConfig('session_epoch', literal(new Date().toISOString()));
  logRow('reset_sessions', '', '', '');
  SpreadsheetApp.getActiveSpreadsheet().toast('開いているゲームは 2分以内に 保存して タイトルに 戻ります', 'MathQuest');
}

// ------------------------------------------------------------------ セーブを消す(体験版のやり直し・テスト用アカウントの片づけ)

/**
 * students シートで選んだ行の生徒のセーブを消す。
 * 行を削除するだけだと、生徒の端末に残ったセーブが 次に開いたとき 送り直されて 元に戻ってしまう。
 * そこで 行は残して reset_at(消した日時)を書き、これより前に始めたセーブは 端末のものも 受け取らない(ゲーム側で 端末のセーブも消す)
 */
function menuWipeSelected() {
  var ui = SpreadsheetApp.getUi();
  var range = SpreadsheetApp.getActiveRange();
  if (!range || range.getSheet().getName() !== 'students') {
    ui.alert('students シートで、消したい生徒の行を選んでから もう一度 押してください(複数行も選べます)');
    return;
  }
  var first = Math.max(2, range.getRow());
  var last = range.getLastRow();
  if (last < first) {
    ui.alert('生徒の行(2 行目から下)を選んでください');
    return;
  }
  var keys = sheet('students')
    .getRange(first, 1, last - first + 1, 1)
    .getValues()
    .map(function (v) {
      return String(v[0]);
    })
    .filter(function (k) {
      return k;
    });
  var ans = ui.alert('セーブを消す', keys.length + ' 人(' + keys.slice(0, 10).join('、') + (keys.length > 10 ? ' …' : '') + ')のセーブを消します。元に戻せません。よろしいですか?', ui.ButtonSet.YES_NO);
  if (ans !== ui.Button.YES) return;
  wipeRows(first, last);
  ui.alert(keys.length + ' 人のセーブを消しました。開いているゲームは 2分以内に タイトルに戻り、次は はじめから 始まります');
}

function menuWipeAll() {
  var ui = SpreadsheetApp.getUi();
  var last = sheet('students').getLastRow();
  if (last < 2) {
    ui.alert('消すセーブは ありません');
    return;
  }
  var ans = ui.alert('全員のセーブを消す', '全員(' + (last - 1) + ' 行、先生用も ふくむ)のセーブを消します。元に戻せません。よろしいですか?', ui.ButtonSet.YES_NO);
  if (ans !== ui.Button.YES) return;
  wipeRows(2, last);
  ui.alert('全員のセーブを消しました。開いているゲームは 2分以内に タイトルに戻り、次は はじめから 始まります');
}

/** rows first〜last のセーブを消し、reset_at を書く。開いているゲームは タイトルに戻す */
function wipeRows(first, last) {
  var sh = sheet('students');
  var col = function (name) {
    return SHEETS.students.indexOf(name) + 1;
  };
  // 古い版で作った students シートには reset_at の見出しがないので 足す
  sh.getRange(1, col('reset_at')).setValue('reset_at');
  var n = last - first + 1;
  var now = new Date().toISOString();
  var blank = [];
  var stamp = [];
  for (var i = 0; i < n; i++) {
    blank.push(['']);
    stamp.push(["'" + now]);
  }
  sh.getRange(first, col('player_name'), n, 1).setValues(blank);
  sh.getRange(first, col('save_json'), n, 1).setValues(blank);
  sh.getRange(first, col('updated_at'), n, 1).setValues(blank);
  sh.getRange(first, col('reset_at'), n, 1).setValues(stamp);
  setConfig('session_epoch', literal(now));
  logRow('wipe_saves', '', '', String(n));
}

/** 消したあとの 古いセーブか(reset_at より前に始めた。createdAt のない 古い版のセーブも 古い扱い) */
function isWipedSave(row, save) {
  var resetAt = String(row.reset_at || '');
  if (!resetAt) return false;
  var created = String((save && save.createdAt) || '');
  return !created || created < resetAt;
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
    else if (body.action === 'review') res = passReview(cls, num, pass, body.marks);
    else if (body.action === 'treasure') res = passTreasure(cls, num, pass, body.buy);
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
    classes: classList(cfg),
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
    sh.appendRow([literal(key(cls, num)), literal(cls), numberCell(num), hashPass(pass, salt), salt, '', '', '', now, now]);
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
  return { ok: true, isNew: false, save: save, unlock: unlockFor(cls, teacher), teacher: teacher, resetAt: String(row.reset_at || '') };
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
  // 先生が消したあと、端末に残っていた 古いセーブが 送られてきた → 受け取らない
  if (isWipedSave(row, save)) return { ok: false, error: 'save_reset' };
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

function passReview(cls, num, pass, marks) {
  if (cls !== TEACHER_CLASS) return { ok: false, error: 'not_teacher' };
  var row = findStudent(cls, num);
  if (!row) return { ok: false, error: 'not_found' };
  if (!authorize(row, cls, pass)) return { ok: false, error: 'bad_pass' };
  return writeReview(marks);
}

/**
 * 問題の見本帳の印(先生だけ)。1 行 = 地点 × 出題タイプ × ★。
 * 難易度の調整に使う(docs/difficulty.md)。文字は すべて asText で 式として動かないようにする
 */
function writeReview(marks) {
  if (!Array.isArray(marks) || marks.length === 0 || marks.length > 200) return { ok: false, error: 'bad_review' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('review');
  if (!sh) {
    sh = ss.insertSheet('review');
    sh.appendRow(SHEETS.review);
    sh.setFrozenRows(1);
  }
  var now = new Date().toISOString();
  var rows = marks.map(function (m) {
    var flagged = Array.isArray(m.flagged) ? m.flagged.slice(0, 10).map(function (f) { return String(f).slice(0, 200); }).join(' / ') : '';
    return [
      now,
      asText(String(m.node || '').slice(0, 40)),
      asText(String(m.template || '').slice(0, 40)),
      Number(m.star) || '',
      asText(String(m.rating || '').slice(0, 10)),
      asText(String(m.comment || '').slice(0, 300)),
      asText(flagged),
    ];
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, SHEETS.review.length).setValues(rows);
  return { ok: true, count: rows.length };
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
    numberCell(num),
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

// ------------------------------------------------------------------ 宝の地図(クラスに 1 枚だけ)

function passTreasure(cls, num, pass, buy) {
  var row = findStudent(cls, num);
  if (!row) return { ok: false, error: 'not_found' };
  if (!authorize(row, cls, pass)) return { ok: false, error: 'bad_pass' };
  return treasure(row, cls, num, cls === TEACHER_CLASS, buy === true);
}

/** 「1,3」「1、2」→ ['1', '3']。1 つだけ 書くと 数や 日付に なることが あるので cellText で 読む */
function listOf(v) {
  return cellText(v)
    .split(/[,、\s]+/)
    .map(function (x) {
      return x.trim();
    })
    .filter(Boolean);
}

/**
 * この クラス(「3-1」)で 宝の地図を 売るか。treasure_grade(学年)と treasure_class(組。空なら その学年の 全部の組)で 決める。
 * 前の版の treasure_classes(「1-2,2-3」)も 読む(書いてあれば そのクラスでも 売る)
 */
function treasureTarget(cls, gradeValue, classValue, oldValue) {
  var sc = splitClass(cls);
  var grades = listOf(gradeValue).map(function (g) {
    return String(rosterGrade(g));
  });
  var kumis = listOf(classValue).map(kumiText);
  if (sc.grade && grades.indexOf(String(sc.grade)) >= 0 && (!kumis.length || kumis.indexOf(sc.kumi) >= 0)) return true;
  return listOf(oldValue).indexOf(cls) >= 0;
}

/**
 * 売れ具合を返し、buy なら買う。呼び出し側がロックを持っているので、同じクラスの 2 人が同時に押しても 1 人だけが買える。
 * 先生は試しに買えるよう、いつでも売っていて売り切れにならない(生徒のクラスの分は減らない)。
 * 同じ人が もう一度 買うと mine=true が返るだけ(応答が届かなかったときの やり直しで 二重に 記録しない)
 */
function treasure(row, cls, num, teacher, buy) {
  var cfg0 = readConfig();
  var onSale = teacher || treasureTarget(cls, cfg0.treasure_grade, cfg0.treasure_class, cfg0.treasure_classes);
  if (!onSale) return { ok: true, treasure: { onSale: false, soldOut: false, mine: false } };
  // 先生は 売るのを 止めているときも、期間の 外でも 試せる
  if (!teacher && !treasureSwitchOn(readConfig().treasure_open)) return { ok: true, treasure: { onSale: false, soldOut: false, mine: false } };
  var period = teacher ? { open: true } : treasurePeriod(readConfig().treasure_from, readConfig().treasure_until, new Date());
  if (!period.open) return { ok: true, treasure: { onSale: false, soldOut: false, mine: false, opensAt: period.opensAt } };
  var sh = treasureSheet();
  var values = sh.getLastRow() > 1 ? sh.getRange(2, 2, sh.getLastRow() - 1, 2).getValues() : [];
  var mine = false;
  var soldOut = false;
  for (var i = 0; i < values.length; i++) {
    if (cellText(values[i][0]) !== cls) continue;
    var n = cellText(values[i][1]);
    if (/^\d+$/.test(n)) n = String(Number(n));
    if (n === num) mine = true;
    soldOut = true;
  }
  if (teacher) soldOut = false;
  if (buy && !mine && !soldOut) {
    var save = parseSave(row);
    var player = (save && save.player) || {};
    sh.appendRow([new Date().toISOString(), literal(cls), numberCell(num), asText(String(player.name || '').slice(0, 20)), Number(player.level || 0), teacher ? '先生(試し)' : '']);
    logRow('treasure', cls, num, '宝の地図を買った');
    mine = true;
    soldOut = !teacher;
  }
  return { ok: true, treasure: { onSale: true, soldOut: soldOut && !mine, mine: mine } };
}

/**
 * treasure_open が 売る 状態か。止めるのは はっきり FALSE のときだけ
 * (行が ない 古い シートでは、売るクラスと 期間だけで 決まる。open と 同じ 読み方)
 */
function treasureSwitchOn(v) {
  return !(v === false || String(v == null ? '' : v).trim().toUpperCase() === 'FALSE');
}

/**
 * 売る期間か。from / until は シートの 値(日付型にも 文字列にもなる)。
 * until が 日付だけなら その日の 終わりまで売る。書き方が 読めない値は 空と 同じ(打ちまちがいで 売れなくならない)
 * 戻り値: { open, opensAt? }。opensAt = 始まる前なら「11/1」「11/1 8:30」(道具屋に 発売予定として 出す)
 */
function treasurePeriod(fromValue, untilValue, now) {
  var from = periodDate(fromValue, false);
  var until = periodDate(untilValue, true);
  if (from && now < from.date) {
    var d = from.date;
    var label = d.getMonth() + 1 + '/' + d.getDate() + (from.hasTime ? ' ' + d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2) : '');
    return { open: false, opensAt: label };
  }
  if (until && now >= until.date) return { open: false };
  return { open: true };
}

/** 「2026-11-01」「2026/11/1 08:30」や 日付型を 日時にする。endOfDay なら 日付だけのとき 翌日 0 時(その日を ふくむ) */
function periodDate(v, endOfDay) {
  if (v instanceof Date) {
    var t = v.getHours() !== 0 || v.getMinutes() !== 0;
    var d0 = new Date(v.getTime());
    if (endOfDay && !t) d0.setDate(d0.getDate() + 1);
    return { date: d0, hasTime: t };
  }
  var m = String(v == null ? '' : v)
    .trim()
    .match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  var hasTime = m[4] !== undefined;
  var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hasTime ? Number(m[4]) : 0, hasTime ? Number(m[5]) : 0);
  if (endOfDay && !hasTime) d.setDate(d.getDate() + 1);
  return { date: d, hasTime: hasTime };
}

/** 古い版で作ったスプレッドシートには treasure シートがないので、初めて使うときに作る */
function treasureSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('treasure');
  if (!sh) {
    sh = ss.insertSheet('treasure');
    sh.appendRow(SHEETS.treasure);
    sh.setFrozenRows(1);
    sh.getRange('B:B').setNumberFormat('@');
  }
  return sh;
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
 * 戻り値: { class, number, grade? } / { error: 'not_in_roster' | 'roster_conflict' }
 */
/**
 * 名簿の 行を 読みそろえる(email の ある 行だけ)。クラスは ゲームの 中の 名前(「3-1」)、番号は「07」→「7」。
 * 戻り値: [{ email, class, number, grade, approved }]
 */
function rosterRows() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('roster');
  if (!sh || sh.getLastRow() < 2) return [];
  var width = Math.max(sh.getLastColumn(), 3);
  var cols = rosterColumns(sh.getRange(1, 1, 1, width).getValues()[0]);
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, width).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var e = cellText(values[i][cols.email - 1]).toLowerCase();
    if (!e) continue;
    var g = cols.grade ? rosterGrade(values[i][cols.grade - 1]) : 0;
    // ゲームの 中の クラス名は「学年-組」(「3-1」)。前の版の「1-2」と 書いた 行も そのまま
    var c = fullClass(g, values[i][cols['class'] - 1]);
    var n = cellText(values[i][cols.number - 1]);
    if (/^\d+$/.test(n)) n = String(Number(n)); // "07" → "7"
    // 承認の 列が あれば、チェックの 入った 行だけが 有効(生徒の 申請は 先生が 確かめてから)
    var approved = !cols.approved || isChecked(values[i][cols.approved - 1]);
    out.push({ email: e, class: c, number: n, grade: g, approved: approved });
  }
  return out;
}

/**
 * 申請・ログインで えらべる クラスの 一覧。config の classes に、名簿に 書いてある クラスを 足す
 * (3年生を 名簿に 入れたのに config が 1年の ままで、3年が えらべなかった。先生の報告 2026-10-19)
 */
function classList(cfg) {
  var seen = {};
  var out = [];
  var add = function (c) {
    c = String(c == null ? '' : c).trim();
    if (!c || seen[c]) return;
    seen[c] = true;
    out.push(c);
  };
  String((cfg && cfg.classes) || '')
    .split(',')
    .forEach(add);
  rosterRows().forEach(function (r) {
    add(r['class']);
  });
  // 「1-2」「1-10」「3-1」を 学年・組の 数の 順に(文字の 順だと 1-10 が 1-2 の 前に なる)
  return out.sort(function (a, b) {
    var x = splitClass(a);
    var y = splitClass(b);
    if (x.grade !== y.grade) return x.grade - y.grade;
    var nx = Number(x.kumi);
    var ny = Number(y.kumi);
    if (!isNaN(nx) && !isNaN(ny) && nx !== ny) return nx - ny;
    return x.kumi < y.kumi ? -1 : x.kumi > y.kumi ? 1 : 0;
  });
}

function rosterEntry(email) {
  var rows = rosterRows();
  if (!rows.length) return { error: 'not_in_roster' };
  var mine = [];
  var pending = null;
  var byKey = {};
  rows.forEach(function (r) {
    if (!r.approved || !r['class'] || !r.number) {
      // 承認待ち・番号が まだの 行(Classroom から 取り込んだ 直後など)。本人には 申請の 状態として 知らせる
      if (r.email === email && !pending) pending = { class: r['class'], number: r.number };
      return;
    }
    var k = key(r['class'], r.number);
    byKey[k] = (byKey[k] || 0) + 1;
    if (r.email === email) {
      var entry = { class: r['class'], number: r.number };
      if (r.grade) entry.grade = r.grade;
      mine.push(entry);
    }
  });
  if (mine.length === 0) return pending ? { error: 'pending', pending: pending } : { error: 'not_in_roster' };
  if (mine.length > 1 || byKey[key(mine[0]['class'], mine[0].number)] > 1) {
    logRow('roster_conflict', mine[0]['class'], mine[0].number, '名簿に重複があります');
    return { error: 'roster_conflict' };
  }
  return mine[0];
}

/** チェックボックス・TRUE と 書いた セル */
function isChecked(v) {
  return v === true || String(v == null ? '' : v).trim().toUpperCase() === 'TRUE';
}

/**
 * 名簿に ない 生徒の 申請(学校アカウント方式)。メールアドレスは 本人の アカウントなので、先生は 打たなくてよい。
 * 承認なしの 行を 足し(すでに 自分の 行が あれば その行の クラス・番号を 書きかえ)、先生が 承認に チェックを 入れると 入れる。
 * ただし 先生が 学年・組を 書いた 行(番号だけ 空)で、同じ 学年・組を えらんだときは 承認なしで 入れる
 * (授業で 一斉に 始めるとき 全員の 承認を 待たなくて よいように。先生の希望 2026-10-19)。
 * 戻り値: { ok, pending } か、そのまま 入れるときは { ok, approved: true, pending }。呼び出し側が ロックを 持っている
 */
function applyRoster(email, clsIn, numIn) {
  var cls = String(clsIn || '').trim();
  var num = String(numIn || '').trim();
  if (/^\d+$/.test(num)) num = String(Number(num));
  if (!cls || cls.length > 20 || !/^\d{1,2}$/.test(num) || Number(num) < 1) return { ok: false, error: 'bad_identity' };
  var classes = classList(readConfig());
  if (classes.length && classes.indexOf(cls) < 0) return { ok: false, error: 'bad_identity' };
  var sh = sheet('roster');
  var width = Math.max(sh.getLastColumn(), 3);
  var cols = rosterColumns(sh.getRange(1, 1, 1, width).getValues()[0]);
  var values = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, width).getValues() : [];
  var own = 0;
  var ownClass = '';
  var ownNum = '';
  for (var i = 0; i < values.length; i++) {
    var e = cellText(values[i][cols.email - 1]).toLowerCase();
    var c = fullClass(cols.grade ? rosterGrade(values[i][cols.grade - 1]) : 0, values[i][cols['class'] - 1]);
    var n = cellText(values[i][cols.number - 1]);
    if (/^\d+$/.test(n)) n = String(Number(n));
    var approved = !cols.approved || isChecked(values[i][cols.approved - 1]);
    if (e === email) {
      if (approved && c && n) return { ok: false, error: 'already_registered' };
      if (!own) {
        own = i + 2;
        ownClass = c;
        ownNum = n;
      }
    } else if (e && approved && c === cls && n === num) {
      // ほかの 生徒の 番号を 選んだ(打ちまちがい)。先生が 気づく 前に 本人に 直してもらう
      return { ok: false, error: 'number_taken' };
    }
  }
  var row = own || sh.getLastRow() + 1;
  // 先生が 書いた 学年・組と 同じなら 番号を 書くだけで 入れる(生徒が 自分で 申請した 行は 番号が 入っているので ここに 来ない)
  var auto = !!(own && ownClass && !ownNum && ownClass === cls);
  // 学年の 列が あれば 学年と 組に 分けて 書く(「3-1」→ grade 3・class 1)
  var sc = splitClass(cls);
  var split = cols.grade && sc.grade;
  sh.getRange(row, cols.email).setValue(asText(email));
  if (split) sh.getRange(row, cols.grade).setValue(sc.grade);
  sh.getRange(row, cols['class']).setValue(literal(split ? sc.kumi : cls));
  sh.getRange(row, cols.number).setValue(numberCell(num));
  if (cols.approved) {
    sh.getRange(row, cols.approved).insertCheckboxes();
    sh.getRange(row, cols.approved).setValue(auto);
  }
  if (auto) {
    logRow('apply', cls, num, '名簿の 番号を 生徒が 書いた(学年・組が 名簿と 同じなので 承認ずみ)');
    return { ok: true, approved: true, pending: { class: cls, number: num } };
  }
  logRow('apply', cls, num, '名簿に 申請(承認待ち)');
  return { ok: true, pending: { class: cls, number: num } };
}

/**
 * Classroom の 生徒を 名簿に 足す(メニューから)。番号は 空(先生が 書くか、生徒が 申請する)。
 * すでに 名簿に ある アカウントは 足さない。先生が 選んだ クラスなので 承認ずみに する
 * list: [{ email, name }]。戻り値: { added, skipped, noEmail }
 */
function importRoster(gradeIn, kumiIn, list) {
  var grade = rosterGrade(gradeIn);
  var kumi = kumiText(kumiIn);
  var cls = fullClass(grade, kumi);
  var sh = sheet('roster');
  ensureRosterNameColumn(sh);
  var width = Math.max(sh.getLastColumn(), 3);
  var cols = rosterColumns(sh.getRange(1, 1, 1, width).getValues()[0]);
  var existing = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(2, cols.email, sh.getLastRow() - 1, 1)
      .getValues()
      .forEach(function (r) {
        existing[cellText(r[0]).toLowerCase()] = true;
      });
  }
  var rows = [];
  var skipped = 0;
  var noEmail = 0;
  list.forEach(function (st) {
    var email = String(st.email || '').trim().toLowerCase();
    if (!email) {
      noEmail++;
      return;
    }
    if (existing[email]) {
      skipped++;
      return;
    }
    existing[email] = true;
    var row = [];
    for (var j = 0; j < width; j++) row.push('');
    if (cols.approved) row[cols.approved - 1] = true;
    row[cols.email - 1] = asText(email);
    if (cols.name) row[cols.name - 1] = asText(String(st.name || '').slice(0, 40));
    if (cols.grade && grade) row[cols.grade - 1] = grade;
    row[cols['class'] - 1] = literal(cols.grade && grade ? kumi : cls);
    rows.push(row);
  });
  if (rows.length) {
    var first = sh.getLastRow() + 1;
    sh.getRange(first, 1, rows.length, width).setValues(rows);
    if (cols.approved) sh.getRange(first, cols.approved, rows.length, 1).insertCheckboxes();
  }
  logRow('import_roster', cls, '', rows.length + ' 人');
  return { added: rows.length, skipped: skipped, noEmail: noEmail };
}

/** 名簿に 氏名の 列が なければ email の すぐ 右に 足す */
function ensureRosterNameColumn(sh) {
  var width = Math.max(sh.getLastColumn(), 1);
  var cols = rosterColumns(sh.getRange(1, 1, 1, width).getValues()[0]);
  if (cols.name) return;
  sh.insertColumnAfter(cols.email);
  sh.getRange(1, cols.email + 1).setValue('name');
}

/** メニュー: Classroom から 名簿を 取り込む。Apps Script の「サービス」に Google Classroom API を 足してあること */
function menuImportClassroom() {
  var ui = SpreadsheetApp.getUi();
  if (typeof Classroom === 'undefined') {
    ui.alert('Classroom API が 使えません。Apps Script の エディタで 左の「サービス」の ＋ → 「Google Classroom API」を 追加してから、もう一度 押してください');
    return;
  }
  var courses = [];
  var token;
  do {
    var res = Classroom.Courses.list({ teacherId: 'me', courseStates: ['ACTIVE'], pageToken: token });
    courses = courses.concat(res.courses || []);
    token = res.nextPageToken;
  } while (token);
  if (!courses.length) {
    ui.alert('先生として 担当している Classroom の クラスが 見つかりません');
    return;
  }
  var menu = courses
    .map(function (c, i) {
      return i + 1 + '. ' + c.name + (c.section ? '(' + c.section + ')' : '');
    })
    .join('\n');
  var pick = ui.prompt('Classroom から 名簿を 取り込む', menu + '\n\n取り込む クラスの 番号(左の 数字)を 入れてください', ui.ButtonSet.OK_CANCEL);
  if (pick.getSelectedButton() !== ui.Button.OK) return;
  var course = courses[Number(pick.getResponseText().trim()) - 1];
  if (!course) {
    ui.alert('番号が ちがいます');
    return;
  }
  var askGrade = ui.prompt('学年', '「' + course.name + '」の 生徒は 何年生ですか?(1〜3 の 数字)', ui.ButtonSet.OK_CANCEL);
  if (askGrade.getSelectedButton() !== ui.Button.OK) return;
  var grade = rosterGrade(askGrade.getResponseText());
  if (!grade) {
    ui.alert('学年は 1〜3 の 数字で 入れてください');
    return;
  }
  var askKumi = ui.prompt('組', '「' + course.name + '」の 生徒は 何組ですか?(例: 1)', ui.ButtonSet.OK_CANCEL);
  if (askKumi.getSelectedButton() !== ui.Button.OK) return;
  var kumi = kumiText(askKumi.getResponseText());
  if (!kumi || kumi.length > 10) {
    ui.alert('組を 入れてください');
    return;
  }
  var cls = fullClass(grade, kumi);
  var list = [];
  var t;
  do {
    var r = Classroom.Courses.Students.list(course.id, { pageToken: t });
    (r.students || []).forEach(function (st) {
      var p = st.profile || {};
      list.push({ email: p.emailAddress || '', name: (p.name && p.name.fullName) || '' });
    });
    t = r.nextPageToken;
  } while (t);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  var result;
  try {
    result = importRoster(grade, kumi, list);
  } finally {
    lock.releaseLock();
  }
  ui.alert(
    grade + '年 ' + kumi + '組(' + cls + ')に ' + result.added + ' 人を 追加しました。' +
      (result.skipped ? '\n(' + result.skipped + ' 人は すでに 名簿に いたので 足していません)' : '') +
      (result.noEmail ? '\n(' + result.noEmail + ' 人は メールアドレスが 取れませんでした。その生徒は ゲームから 申請してもらってください)' : '') +
      '\n\n出席番号(number)は 空です。先生が 書くか、生徒が ゲームを 開いて 番号を 申請し、先生が 承認に チェックを 入れます'
  );
}

/** メニュー: 承認待ちの 行(email・クラス・番号が そろっている もの)を まとめて 承認する */
function menuApproveAll() {
  var ui = SpreadsheetApp.getUi();
  var sh = sheet('roster');
  var width = Math.max(sh.getLastColumn(), 3);
  var cols = rosterColumns(sh.getRange(1, 1, 1, width).getValues()[0]);
  if (!cols.approved || sh.getLastRow() < 2) {
    ui.alert('承認待ちの 行は ありません');
    return;
  }
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, width).getValues();
  var rows = [];
  values.forEach(function (v, i) {
    if (!isChecked(v[cols.approved - 1]) && cellText(v[cols.email - 1]) && cellText(v[cols['class'] - 1]) && cellText(v[cols.number - 1])) rows.push(i + 2);
  });
  if (!rows.length) {
    ui.alert('承認待ちの 行は ありません');
    return;
  }
  var ans = ui.alert('申請を 承認する', rows.length + ' 人の 申請を 承認します。クラス・番号に まちがいが ないか 確かめましたか?(1 人ずつなら、承認の 列に チェックを 入れるだけで よい)', ui.ButtonSet.YES_NO);
  if (ans !== ui.Button.YES) return;
  rows.forEach(function (r) {
    sh.getRange(r, cols.approved).setValue(true);
  });
  ui.alert(rows.length + ' 人を 承認しました。生徒は「もう一度 つなぐ」で 入れます');
}

/**
 * 名簿の 列を 見出しで 探す(1 始まり。grade は ないと 0)。先生が 列を 並べ替えても 読めるように。
 * email・class・number の 見出しが 見つからないときは、最初の 版の 並び(A・B・C 列)とみなす
 */
function rosterColumns(header) {
  var cols = { email: 0, class: 0, number: 0, grade: 0, approved: 0, name: 0 };
  var names = {
    email: 'email',
    class: 'class',
    number: 'number',
    grade: 'grade',
    学年: 'grade',
    クラス: 'class',
    番号: 'number',
    承認: 'approved',
    approved: 'approved',
    name: 'name',
    氏名: 'name',
  };
  for (var j = 0; j < header.length; j++) {
    var k = names[cellText(header[j]).toLowerCase()];
    if (k && !cols[k]) cols[k] = j + 1;
  }
  if (!cols.email) cols.email = 1;
  if (!cols['class']) cols['class'] = 2;
  if (!cols.number) cols.number = 3;
  return cols;
}

/**
 * 名簿の 学年の 列を class の すぐ 左に 置く(なければ 列ごと 差し込み、別の 場所に あれば 中身ごと 移す)。
 * すでに 貼った email・class・number の 中身は そのまま(列が 1 つ 右に ずれるだけで、見出しで 探すので 読める)。
 * 前の版が 見出しの 右の 説明(「← 生徒の…」)の 位置に 足した grade も、ここで class の 左に 移る
 */
function ensureRosterGradeColumn(roster) {
  var width = Math.max(roster.getLastColumn(), 1);
  var cols = rosterColumns(roster.getRange(1, 1, 1, width).getValues()[0]);
  if (!cols.grade) {
    roster.insertColumnBefore(cols['class']);
    roster.getRange(1, cols['class']).setValue('grade');
    return;
  }
  if (cols.grade === cols['class'] - 1) return;
  roster.moveColumns(roster.getRange(1, cols.grade), cols['class']);
}

/**
 * 名簿に 承認の 列が なければ 先頭に 足す。これまで 先生が 書いた 行は 承認ずみに する(入れなくならないように)
 */
function ensureRosterApprovedColumn(roster) {
  var width = Math.max(roster.getLastColumn(), 1);
  var cols = rosterColumns(roster.getRange(1, 1, 1, width).getValues()[0]);
  if (cols.approved) return;
  roster.insertColumnBefore(1);
  roster.getRange(1, 1).setValue('承認');
  var last = roster.getLastRow();
  if (last < 2) return;
  var emails = roster.getRange(2, cols.email + 1, last - 1, 1).getValues();
  var marks = emails.map(function (r) {
    return [cellText(r[0]) !== ''];
  });
  var range = roster.getRange(2, 1, last - 1, 1);
  range.insertCheckboxes();
  range.setValues(marks);
}

/** 見出しの ▼ で 絞り込めるように する(先生が 付けた 絞り込みが あれば そのまま) */
function ensureFilter(sh) {
  if (!sh || sh.getFilter()) return;
  sh.getRange(1, 1, sh.getMaxRows(), Math.max(sh.getLastColumn(), 1)).createFilter();
}

/**
 * 学年と 組から ゲームの クラス名(「3」「1」→「3-1」)。学年が ないとき・組に もう 学年が 付いているとき
 * (前の版の 名簿の「1-2」)は 組の 値の まま
 */
function fullClass(grade, kumiValue) {
  // 学年が ないときは 書いたまま(前の版の クラス名を 変えると、その生徒の セーブの 行が 別に なってしまう)
  if (!grade) return cellText(kumiValue);
  var k = kumiText(kumiValue);
  if (!k || splitClass(k).grade) return k;
  return grade + '-' + k;
}

/** 「3-1」→ { grade: 3, kumi: '1' }。学年が 読めなければ { grade: 0, kumi: そのまま } */
function splitClass(cls) {
  var c = String(cls == null ? '' : cls).trim();
  var m = /^([1-3])-(.+)$/.exec(c);
  return m ? { grade: Number(m[1]), kumi: m[2] } : { grade: 0, kumi: c };
}

/** 組の 値(「1」「1組」→「1」)。シートが 日付に 変えた「1-2」も 戻す */
function kumiText(v) {
  return cellText(v).replace(/組$/, '').trim();
}

/** 名簿の 学年の 値(「1」「1年」など)。1〜3 以外・空は 書いていない ものとする */
function rosterGrade(v) {
  var m = /^\s*([1-3])(?!\d)/.exec(cellText(v));
  return m ? Number(m[1]) : 0;
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
  if (entry.error) return { mode: 'google', teacher: false, registered: null, player: null, error: entry.error, pending: entry.pending };
  var row = accountStudent(email, entry['class'], entry.number, false, true);
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
  if (body.action === 'apply') {
    if (teacher || !entry.error) return { ok: false, error: 'already_registered' };
    if (entry.error !== 'not_in_roster' && entry.error !== 'pending') return { ok: false, error: entry.error };
    var applyLock = LockService.getScriptLock();
    applyLock.waitLock(10000);
    try {
      return applyRoster(email, body['class'], body.number);
    } finally {
      applyLock.releaseLock();
    }
  }
  if (entry.error) return { ok: false, error: entry.error };
  var cls = entry['class'];
  var num = entry.number;

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (body.action === 'feedback') return writeFeedback(cls, num, body.feedback);
    if (body.action === 'review') return teacher ? writeReview(body.marks) : { ok: false, error: 'not_teacher' };
    // 本人の 行(email → key → 書き方だけ ちがう key の 順に 探す。見つけた 行は 今の key に 書き直す)
    var row = accountStudent(email, cls, num, body.action === 'login', false);
    var now = new Date().toISOString();
    var account = { class: cls, number: num };
    // 名簿に 学年が 書いてあれば 知らせる(ゲームは これを セーブに 書く。なければ クラス名から 決める)
    if (entry.grade) account.grade = entry.grade;
    if (body.action === 'login') {
      setCell(row.rowIndex, 'last_seen', now);
      // 前の セーブらしい 行が あれば、どちらで 続けるか 生徒に 聞く(先生用の 行は 聞かない)
      var carry = teacher ? [] : carryCandidates(email, key(cls, num), row.rowIndex);
      if (carry.length)
        return { ok: true, isNew: !row.save_json, save: parseSave(row), unlock: unlockFor(cls, teacher), teacher: teacher, account: account, resetAt: String(row.reset_at || ''), carry: carry };
      return { ok: true, isNew: !row.save_json, save: parseSave(row), unlock: unlockFor(cls, teacher), teacher: teacher, account: account, resetAt: String(row.reset_at || '') };
    }
    if (!row) return { ok: false, error: 'not_registered' };
    if (body.action === 'save') return storeSave(row, body.save);
    if (body.action === 'load') return { ok: true, save: parseSave(row) };
    if (body.action === 'treasure') return treasure(row, cls, num, teacher, body.buy === true);
    if (body.action === 'carry') return teacher ? { ok: false, error: 'bad_carry' } : chooseCarry(email, cls, num, row, body.pick);
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

/** 設定の 値の セルを チェックボックスに する(TRUE / FALSE を 打ちまちがえないように) */
function checkboxConfig(k) {
  var sh = sheet('config');
  var keys = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (var i = 1; i < keys.length; i++) {
    if (String(keys[i][0]).trim() === k) {
      var cell = sh.getRange(i + 1, 2);
      var v = cell.getValue();
      cell.insertCheckboxes();
      cell.setValue(treasureSwitchOn(v) && v !== '');
      return;
    }
  }
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

// ------------------------------------------------------------------ 引き継ぎ(更新・進級で クラスや 番号の 書き方が 変わっても セーブを 失わない)

/**
 * 生徒の 行の 探し方(先生の指摘 2026-10-17: 更新の あと key の 形式が 変わり、全員が はじめからに なった)。
 *   1. 学校アカウント方式では students の email 列で 本人の 行を 探す(クラス・番号が 変わっても 見つかる。進級にも ついてくる)
 *   2. key(「1-2|7」)が 同じ 行
 *   3. key の 書き方だけ ちがう 行(「1年2組|07」と「1-2|7」など。canonKey で そろえて 比べる)
 * 見つけた 行の key が 今の 書き方と ちがえば 書き直す(次からは 1 で 見つかる)
 */
var MOVED_PREFIX = '退避|';
var DONE_PREFIX = '引継ぎ済|';
/** 生徒が「いまの セーブの まま」を 選んだ 前の 行(中身は 残す。先生の メニューで 戻せる) */
var KEPT_PREFIX = '見送り|';

/** 全角の 数字・記号を 半角に */
function halfWidth(s) {
  return String(s).replace(/[０-９]/g, function (c) {
    return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
  });
}

/** クラスの 書き方を そろえる(「1年2組」「１－２」「1 - 2」→「1-2」) */
function canonClass(v) {
  var c = halfWidth(cellText(v))
    .replace(/[\s　]+/g, '')
    .replace(/[‐－ー−–]/g, '-');
  var m = /^([1-3])年(.+?)組?$/.exec(c);
  if (m) return m[1] + '-' + m[2];
  return c.replace(/組$/, '');
}

/** 番号の 書き方を そろえる(「07」「7.0」「７」→「7」) */
function canonNumber(v) {
  var n = halfWidth(cellText(v)).trim();
  return /^\d+(\.0+)?$/.test(n) ? String(Number(n)) : n;
}

function canonKey(k) {
  var s = String(k == null ? '' : k);
  var i = s.lastIndexOf('|');
  if (i < 0) return s;
  return canonClass(s.slice(0, i)) + '|' + canonNumber(s.slice(i + 1));
}

/** 退避・引き継ぎ済みの 行(だれの 行としても 使わない。集計にも 入れない) */
function isRetiredKey(k) {
  var s = String(k);
  return s.indexOf(MOVED_PREFIX) === 0 || s.indexOf(DONE_PREFIX) === 0 || s.indexOf(KEPT_PREFIX) === 0;
}

/** 退避した 行の もとの key(「退避|1-2|07|2026-10-17」→「1-2|07」) */
function movedFrom(k) {
  var s = String(k);
  if (s.indexOf(MOVED_PREFIX) !== 0) return s;
  return s.slice(MOVED_PREFIX.length).replace(/\|\d{4}-\d{2}-\d{2}$/, '');
}

/**
 * 本人の 前の セーブらしい 行(いま 使う 行の ほかに)。生徒に どちらで 続けるか 聞く(先生の希望 2026-10-17)。
 *   - email 列が 本人の もの(先生が 古い 行に 書いた ときも)
 *   - email の ない 行で、key の 書き方だけ ちがう もの(退避した 行も もとの key で 比べる)
 * セーブの ない 行・引き継ぎ済み・見送りの 行は のぞく
 */
function carryCandidates(email, k, targetRow) {
  var idx = studentIndex();
  var n = idx.keys.length;
  if (!n || !email) return [];
  var ck = canonKey(k);
  var upd = sheet('students')
    .getRange(2, SHEETS.students.indexOf('updated_at') + 1, n, 1)
    .getValues();
  var out = [];
  for (var i = 0; i < n; i++) {
    var rowIndex = i + 2;
    var kk = idx.keys[i];
    if (rowIndex === targetRow || !cellText(upd[i][0])) continue;
    if (kk.indexOf(DONE_PREFIX) === 0 || kk.indexOf(KEPT_PREFIX) === 0) continue;
    var mine = idx.emails[i] === email || (!idx.emails[i] && canonKey(movedFrom(kk)) === ck);
    if (!mine) continue;
    var row = readStudent(rowIndex);
    var save = parseSave(row);
    if (!save || !save.player) continue;
    out.push({ id: rowIndex, name: String(save.player.name || ''), level: Number(save.player.level || 1), updatedAt: String(save.updatedAt || row.updated_at || '') });
  }
  return out;
}

/** 生徒の 選んだ ほうで 続ける。pick = 前の 行の id か 'keep'(いまの まま) */
function chooseCarry(email, cls, num, row, pick) {
  var cands = carryCandidates(email, key(cls, num), row.rowIndex);
  var now = new Date().toISOString();
  if (pick === 'keep') {
    cands.forEach(function (c) {
      var kk = String(readStudent(c.id).key);
      setCell(c.id, 'key', asText(KEPT_PREFIX + movedFrom(kk) + '|' + now.slice(0, 10)));
    });
    logRow('carry_keep', cls, num, cands.length + ' 行を 見送り');
    return { ok: true, save: parseSave(readStudent(row.rowIndex)) };
  }
  var hit = cands.filter(function (c) {
    return c.id === Number(pick);
  })[0];
  if (!hit) return { ok: false, error: 'bad_carry' };
  var r = transferSave(hit.id, row.rowIndex);
  if (!r.ok) return { ok: false, error: 'bad_carry' };
  // ほかの 候補は もう 聞かない
  cands.forEach(function (c) {
    if (c.id === hit.id) return;
    var kk = String(readStudent(c.id).key);
    setCell(c.id, 'key', asText(KEPT_PREFIX + movedFrom(kk) + '|' + now.slice(0, 10)));
  });
  return { ok: true, save: parseSave(readStudent(row.rowIndex)) };
}

/** students の key と email の 列だけ 読む(セーブの 中身は 大きいので 全部は 読まない) */
function studentIndex() {
  var sh = sheet('students');
  var last = sh.getLastRow();
  if (last < 2) return { keys: [], emails: [] };
  var emailCol = SHEETS.students.indexOf('email') + 1;
  var keys = sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) {
    return String(r[0]);
  });
  var emails = sh
    .getRange(2, emailCol, last - 1, 1)
    .getValues()
    .map(function (r) {
      return cellText(r[0]).toLowerCase();
    });
  return { keys: keys, emails: emails };
}

function readStudent(rowIndex) {
  var values = sheet('students').getRange(rowIndex, 1, 1, SHEETS.students.length).getValues()[0];
  var row = { rowIndex: rowIndex };
  SHEETS.students.forEach(function (h, j) {
    row[h] = values[j];
  });
  return row;
}

/** key が 同じ 行 → なければ 書き方だけ ちがう 行(0 始まりの 番号。なければ −1) */
function keyIndex(idx, k) {
  var exact = idx.keys.indexOf(k);
  if (exact >= 0) return exact;
  var ck = canonKey(k);
  for (var i = 0; i < idx.keys.length; i++) if (!isRetiredKey(idx.keys[i]) && canonKey(idx.keys[i]) === ck) return i;
  return -1;
}

/** 行の key・クラス・番号を 今の 書き方に 書き直す */
function rekeyStudent(row, cls, num) {
  var k = key(cls, num);
  if (String(row.key) === k) return;
  setCell(row.rowIndex, 'key', literal(k));
  setCell(row.rowIndex, 'class', literal(cls));
  setCell(row.rowIndex, 'number', numberCell(num));
  logRow('rekey', cls, num, '引き継ぎ: ' + String(row.key) + ' → ' + k);
  row.key = k;
}

/** だれの 行でも なくなった 行を 退避する(中身は 残す。持ち主は 次に 入ったとき email で 見つかる) */
function moveAside(rowIndex, oldKey) {
  setCell(rowIndex, 'key', asText(MOVED_PREFIX + oldKey + '|' + new Date().toISOString().slice(0, 10)));
  logRow('move_aside', '', '', String(oldKey));
}

/**
 * 学校アカウント方式の 生徒の 行。create なら なければ 作る、peek なら 何も 書かない(タイトル画面の 表示用)。
 * key の 行が ほかの アカウントの もの(email が ちがう)なら 退避して、その人には email で 見つけてもらう
 */
function accountStudent(email, cls, num, create, peek) {
  var idx = studentIndex();
  var k = key(cls, num);
  // 退避した 行も email が 残っていれば 本人の 行(来たら 今の key に 戻す)
  var byEmail = email ? idx.emails.indexOf(email) : -1;
  var byKey = keyIndex(idx, k);
  var other = byKey >= 0 && idx.emails[byKey] && idx.emails[byKey] !== email;
  if (peek) {
    var at = byEmail >= 0 ? byEmail : other ? -1 : byKey;
    return at < 0 ? null : readStudent(at + 2);
  }
  if (other) {
    moveAside(byKey + 2, idx.keys[byKey]);
    byKey = -1;
  }
  if (byEmail >= 0 && byKey >= 0 && byKey !== byEmail) {
    // 本人の 行(email)と、email の ない 古い 行が 両方 ある: 本人の 行を 使い、古い 行は 退避(中身は 残す。「セーブを 引き継ぐ」で 戻せる)
    moveAside(byKey + 2, idx.keys[byKey]);
    byKey = -1;
  }
  var target = byEmail >= 0 ? byEmail : byKey;
  if (target < 0) {
    if (!create) return null;
    var now = new Date().toISOString();
    var rowValues = [literal(k), literal(cls), numberCell(num), '', '', '', '', '', now, now, ''];
    rowValues[SHEETS.students.indexOf('email')] = asText(email);
    sheet('students').appendRow(rowValues);
    logRow('register', cls, num, '');
    return readStudent(sheet('students').getLastRow());
  }
  var row = readStudent(target + 2);
  rekeyStudent(row, cls, num);
  if (email && cellText(row.email).toLowerCase() !== email) {
    setCell(row.rowIndex, 'email', asText(email));
    row.email = email;
  }
  return row;
}

/**
 * セーブを 別の 行へ 移す(メニュー「セーブを 引き継ぐ」)。移した セーブの 日時を 今に するので、
 * 生徒の 端末に 残った 古い セーブ(今日 はじめからに なった 分)に 上書きされない
 */
function transferSave(fromRow, toRow) {
  var from = readStudent(fromRow);
  var to = readStudent(toRow);
  if (!from.save_json) return { ok: false, error: '移す セーブが ありません(' + from.key + ')' };
  var save;
  try {
    save = JSON.parse(from.save_json);
  } catch (e) {
    return { ok: false, error: 'セーブが 壊れていて 読めません(' + from.key + ')' };
  }
  var now = new Date().toISOString();
  save.updatedAt = now;
  // 先生が 消した 日時(reset_at)より 前に はじめた セーブは 受け取らない しくみなので、はじめた 日時も 今に する
  save.createdAt = now;
  setCell(toRow, 'save_json', asText(JSON.stringify(save)));
  setCell(toRow, 'updated_at', "'" + now);
  setCell(toRow, 'player_name', asText(String((save.player && save.player.name) || '').slice(0, 20)));
  if (!cellText(to.email) && cellText(from.email)) setCell(toRow, 'email', asText(cellText(from.email)));
  // 移した 先に あった セーブは 消さずに 元の 行へ(入れかえ。まちがえて 移しても「セーブを 引き継ぐ」で 戻せる)
  setCell(fromRow, 'save_json', to.save_json ? asText(String(to.save_json)) : '');
  setCell(fromRow, 'updated_at', to.save_json ? "'" + String(to.updated_at || '') : '');
  setCell(fromRow, 'player_name', to.save_json ? asText(String(to.player_name || '')) : '');
  setCell(fromRow, 'email', '');
  setCell(fromRow, 'key', asText(DONE_PREFIX + String(from.key) + '|' + now.slice(0, 10)));
  logRow('transfer', cellText(to['class']), cellText(to.number), String(from.key) + ' → ' + String(to.key));
  return { ok: true, name: String((save.player && save.player.name) || ''), level: Number((save.player && save.player.level) || 1) };
}

/**
 * 引き継ぎの 点検(メニュー)。名簿の 全員に ついて、次に 入ったとき どの 行が 使われるかを 調べる。
 * 戻り値: { ok: 件数, carry: [引き継がれる 人], fresh: [はじめからに なる 人], orphans: [どの 名簿の 人にも 使われない セーブ] }
 */
function carryoverReport() {
  var idx = studentIndex();
  var used = {};
  var res = { ok: 0, carry: [], fresh: [], orphans: [] };
  rosterRows().forEach(function (r) {
    if (!r.approved || !r.email || !r['class'] || !r.number) return;
    var k = key(r['class'], r.number);
    var byEmail = idx.emails.indexOf(r.email);
    var byKey = keyIndex(idx, k);
    if (byKey >= 0 && idx.emails[byKey] && idx.emails[byKey] !== r.email) byKey = -1;
    var at = byEmail >= 0 ? byEmail : byKey;
    var label = r['class'] + ' ' + r.number + '番';
    if (at < 0) res.fresh.push(label);
    else {
      used[at] = true;
      if (idx.keys[at] === k) res.ok++;
      else res.carry.push(label + '(' + idx.keys[at] + ' → ' + k + ')');
    }
  });
  if (idx.keys.length) {
    var saves = sheet('students')
      .getRange(2, SHEETS.students.indexOf('save_json') + 1, idx.keys.length, 1)
      .getValues();
    idx.keys.forEach(function (k, i) {
      if (used[i] || !saves[i][0] || String(k).indexOf(TEACHER_CLASS + '|') === 0) return;
      // 引き継ぎ済み・見送り(生徒が 選んだ あとの 残り)は 数えない。退避は 持ち主が まだ 来ていない ので 数える
      if (String(k).indexOf(DONE_PREFIX) === 0 || String(k).indexOf(KEPT_PREFIX) === 0) return;
      res.orphans.push(k);
    });
  }
  return res;
}

/** setup の たびに students を 写しておく(新しい 3 つだけ 残す)。更新で 何か あっても 戻せるように */
function backupStudents() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var src = ss.getSheetByName('students');
  if (!src || src.getLastRow() < 2) return '';
  var name = 'students_bak_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmm');
  if (ss.getSheetByName(name)) return name;
  src.copyTo(ss).setName(name);
  var olds = ss
    .getSheets()
    .map(function (s) {
      return s.getName();
    })
    .filter(function (n) {
      return n.indexOf('students_bak_') === 0;
    })
    .sort();
  olds.slice(0, Math.max(0, olds.length - 3)).forEach(function (n) {
    ss.deleteSheet(ss.getSheetByName(n));
  });
  return name;
}

/** メニュー: students シートで 2 つの 行を 選び、片方の セーブを もう片方へ 移す */
function menuTransfer() {
  var ui = SpreadsheetApp.getUi();
  var list = SpreadsheetApp.getActiveRangeList();
  var rows = [];
  (list ? list.getRanges() : []).forEach(function (r) {
    if (r.getSheet().getName() !== 'students') return;
    for (var i = r.getRow(); i <= r.getLastRow(); i++) if (i >= 2 && rows.indexOf(i) < 0) rows.push(i);
  });
  if (rows.length !== 2) {
    ui.alert('students シートで、セーブを 移したい 2 つの 行を 選んでから 押してください(Ctrl を 押しながら クリックで 2 行 選べます)');
    return;
  }
  var a = readStudent(rows[0]);
  var b = readStudent(rows[1]);
  var info = function (r) {
    var s = r.save_json ? JSON.parse(r.save_json) : null;
    var p = (s && s.player) || {};
    return r.key + ' … ' + (s ? (p.name || '') + ' Lv' + (p.level || 1) + '(最後に 保存: ' + String(r.updated_at || '').slice(0, 10) + ')' : 'セーブなし');
  };
  var ans = ui.alert(
    'セーブを 引き継ぐ',
    'A: ' + info(a) + '\nB: ' + info(b) + '\n\n「はい」= A の セーブを B へ 移す\n「いいえ」= B の セーブを A へ 移す\n\n移した 先に あった セーブは 元の 行へ 入れかわります(消えません)。元の 行は「' + DONE_PREFIX + '…」に なります',
    ui.ButtonSet.YES_NO_CANCEL,
  );
  if (ans === ui.Button.CANCEL || ans === ui.Button.CLOSE) return;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  var r;
  try {
    r = ans === ui.Button.YES ? transferSave(rows[0], rows[1]) : transferSave(rows[1], rows[0]);
  } finally {
    lock.releaseLock();
  }
  if (!r.ok) {
    ui.alert(r.error);
    return;
  }
  // 開いている ゲームを タイトルに 戻して、次に 入ったとき 移した セーブを 読ませる
  setConfig('session_epoch', literal(new Date().toISOString()));
  ui.alert(r.name + '(Lv' + r.level + ')の セーブを 移しました。開いている ゲームは 2分以内に タイトルに 戻ります');
}

/** メニュー: 引き継ぎを 点検する(更新の あと、生徒が 開く 前に 押す) */
function menuCarryover() {
  var r = carryoverReport();
  var lines = ['名簿の 生徒 ' + (r.ok + r.carry.length + r.fresh.length) + ' 人を 調べました。', '', '✅ そのまま 続きから: ' + r.ok + ' 人'];
  if (r.carry.length) lines.push('', '🔁 次に 入ったとき 引き継ぐ(書き方が 変わった・クラスが 変わった): ' + r.carry.length + ' 人', r.carry.slice(0, 15).join('\n') + (r.carry.length > 15 ? '\n…' : ''));
  if (r.fresh.length) lines.push('', '🆕 はじめからに なる(セーブが 見つからない): ' + r.fresh.length + ' 人', r.fresh.slice(0, 15).join('、') + (r.fresh.length > 15 ? ' …' : ''));
  if (r.orphans.length)
    lines.push('', '⚠️ 名簿の だれにも 使われない セーブ: ' + r.orphans.length + ' 行', r.orphans.slice(0, 15).join('、') + (r.orphans.length > 15 ? ' …' : ''), '→ 上の「はじめからに なる」人の ものなら、students シートで 2 行を 選んで「セーブを 引き継ぐ」');
  SpreadsheetApp.getUi().alert('引き継ぎの 点検', lines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

/** メニュー: いま バックアップを 取る */
function menuBackup() {
  var name = backupStudents();
  SpreadsheetApp.getUi().alert(name ? 'students シートを「' + name + '」に 写しました(新しい 3 つだけ 残します)' : '写す セーブが ありません');
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
  var i = keyIndex(studentIndex(), key(cls, num));
  if (i < 0) return null;
  // 書き方だけ ちがう 行も 見つける(key は 書き直さない: 合言葉方式は 生徒が 打った 番号なので、「07」と「7」で 行き来する)
  return readStudent(i + 2);
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

/** 出席番号を シートに 書く 値。数字だけなら 数(並べ替えが 1, 2, … 10 の 順に なる)、先生用の「t1a2b3」などは 文字 */
function numberCell(num) {
  var n = String(num == null ? '' : num).trim();
  return /^\d{1,6}$/.test(n) ? Number(n) : literal(n);
}

/**
 * 番号の 列を 数に する。前の版が 文字(「'7」)で 書いた 番号も 数に 直す(行の 対応は 変わらない。
 * 名簿・students の 照合は どちらも 文字に そろえてから 比べるので、数に しても 読める)
 */
function numberColumn(sh, col) {
  if (!sh || col < 1) return;
  var last = sh.getLastRow();
  sh.getRange(2, col, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('0');
  if (last < 2) return;
  var range = sh.getRange(2, col, last - 1, 1);
  var values = range.getValues();
  var changed = false;
  var out = values.map(function (r) {
    var v = r[0];
    if (typeof v === 'string' && /^\s*\d{1,6}\s*$/.test(v)) {
      changed = true;
      return [Number(v)];
    }
    return [v];
  });
  if (changed) range.setValues(out);
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

