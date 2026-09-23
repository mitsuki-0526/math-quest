// 接続テスト: モジュール形式(type="module")のプログラムが動くか。ゲーム本体はこの形式で配信される
window.__probeModule = true;
const line = window.__probeLine;
if (line) line('モジュール形式のプログラムを読み込めた', true);
