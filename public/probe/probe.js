/**
 * 接続テスト(gas/probe/Probe.gs から読み込まれる)。
 * 「GAS の入口ページ + GitHub Pages のプログラム・画像」の構成が、学校の環境で動くかを確かめる。
 * ゲーム本体とは無関係。結果は画面に出すだけで、どこにも送らない。
 */
(function () {
  var VERSION = 'probe v2';
  var started = Date.now();
  var BASE = document.currentScript.src.replace(/probe\.js.*$/, '');
  var out = document.getElementById('probe-out');

  function line(label, ok, detail) {
    var li = document.createElement('li');
    li.textContent = (ok ? '✅ ' : '❌ ') + label + (detail ? ' — ' + detail : '');
    li.style.color = ok ? '' : '#c0392b';
    out.appendChild(li);
  }
  window.__probeLine = line;

  line('GitHub Pages のプログラムを読み込めた', true, VERSION);

  // 画像(敵や背景の絵をこの方法で読む)
  var img = new Image();
  img.alt = 'テスト画像';
  img.width = 128;
  img.height = 128;
  img.style.imageRendering = 'pixelated';
  img.onload = function () {
    line('GitHub Pages の画像を表示できた', true, img.naturalWidth + '×' + img.naturalHeight);
    document.getElementById('probe-img').appendChild(img);
  };
  img.onerror = function () {
    line('GitHub Pages の画像を表示できた', false, '読み込みに失敗');
  };
  img.src = BASE + 'probe.png';

  // フォント(数式の KaTeX フォントなど、別サイトからの読み込みには許可が要る)
  if (typeof FontFace === 'function') {
    new FontFace('ProbeFont', 'url(' + BASE + 'probe.woff2)')
      .load()
      .then(function () {
        line('GitHub Pages のフォントを読み込めた', true);
      })
      .catch(function (e) {
        line('GitHub Pages のフォントを読み込めた', false, String(e && e.message ? e.message : e));
      });
  }

  // 端末内の保存(オフライン時の控えに使う)
  // 前回の時刻が出れば、ログアウトや再起動をはさんでも端末内のデータが残っている
  try {
    var prev = localStorage.getItem('mathquest.probe');
    line(
      '前回開いたときの記録',
      !!prev,
      prev ? new Date(Number(prev)).toLocaleString('ja-JP') + '(残っている)' : 'なし(初めて開いた、または消えている)',
    );
    localStorage.setItem('mathquest.probe', String(started));
    line('端末内に保存できる', localStorage.getItem('mathquest.probe') === String(started));
  } catch (e) {
    line('端末内に保存できる', false, e.message);
  }

  // モジュール形式のプログラム(ゲーム本体はこの形式)。probe-module.js が動けば印が付く
  setTimeout(function () {
    if (!window.__probeModule) line('モジュール形式のプログラムを読み込めた', false, '3秒待っても動かなかった');
  }, 3000);

  // GAS のサーバー処理(セーブ・ログインをこれで行う)
  var hasGas = typeof google !== 'undefined' && google.script && google.script.run;
  if (!hasGas) {
    line('GAS のサーバー処理を呼べる', false, 'GAS のページの外で開いています(GitHub Pages で直接開いた場合はこれで正常)');
    return;
  }
  var t0 = Date.now();
  google.script.run
    .withSuccessHandler(function (r) {
      line('GAS のサーバー処理を呼べる', true, '応答 ' + (Date.now() - t0) + 'ms');
      line('学校アカウントを確認できた', !!(r && r.email), (r && r.email) || '取得できませんでした');
    })
    .withFailureHandler(function (e) {
      line('GAS のサーバー処理を呼べる', false, e && e.message ? e.message : String(e));
    })
    .ping();
})();
