/**
 * MathQuest 接続テスト(本番では使わない)。
 * 「GAS の入口ページ + GitHub Pages のプログラム・画像」の構成が学校の環境で動くかを確かめる。
 *
 * 使い方:
 *   1. script.google.com で新しいプロジェクトを作り、このファイルの中身を貼る
 *   2. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
 *      次のユーザーとして実行: 自分 / アクセスできるユーザー: (学校名)内の全員
 *   3. 発行された URL を開く(先生のアカウント → 生徒のアカウントの順に)
 */
var PROBE_BASE = 'https://mitsuki-0526.github.io/math-quest/probe/';

function doGet() {
  var html =
    '<!doctype html><html lang="ja"><head><meta charset="utf-8"></head>' +
    '<body style="font-family:sans-serif;padding:16px;line-height:1.8">' +
    '<h2>MathQuest 接続テスト</h2>' +
    '<ul id="probe-out"></ul><div id="probe-img"></div>' +
    '<script src="' + PROBE_BASE + 'probe.js"></script>' +
    '<script type="module" src="' + PROBE_BASE + 'probe-module.js"></script>' +
    // GitHub Pages の読み込み自体が止められた場合は、何も表示されないのでここで知らせる
    '<script>setTimeout(function(){var o=document.getElementById("probe-out");' +
    'if(!o.children.length){o.innerHTML="<li style=\\"color:#c0392b\\">❌ GitHub Pages のプログラムを読み込めませんでした(フィルタ等で止められた可能性)</li>";}},6000);</script>' +
    '</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('MathQuest 接続テスト')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** 開いた人のアカウントだけを返す(先生のアドレスなどは返さない) */
function ping() {
  return { email: Session.getActiveUser().getEmail() };
}
