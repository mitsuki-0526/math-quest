/**
 * GAS の入口ページから読み込まれる起動スクリプト(ファイル名は固定)。
 * ビルドのたびに名前が変わる本体(assets/index-xxxx.js / .css)を、最新の index.html から探して読み込む。
 * これで GitHub に push するだけで更新でき、GAS 側の入口は書き換えずに済む。
 */
(function () {
  var base = document.currentScript.src.replace(/boot\.js.*$/, '');
  // 画像など、本体が相対パスで参照する素材の基準(GAS のページの URL ではなく GitHub Pages)
  window.__MQ_BASE__ = base;

  var root = document.getElementById('app');
  if (!root) {
    root = document.createElement('div');
    root.id = 'app';
    document.body.appendChild(root);
  }

  function fail(detail) {
    root.innerHTML = '';
    var p = document.createElement('p');
    p.style.cssText = 'font-family:sans-serif;padding:24px;line-height:1.8';
    p.textContent = 'ゲームを 読み込めませんでした。ページを 読み込み直してください。続くときは 先生に 知らせてください。(' + detail + ')';
    root.appendChild(p);
  }

  // index.html は毎回確かめる(古い版を開き続けないように)。本体のファイルは名前に版が入るのでキャッシュしてよい
  fetch(base + 'index.html', { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var styles = doc.querySelectorAll('link[rel="stylesheet"][href]');
      var scripts = doc.querySelectorAll('script[type="module"][src]');
      if (!scripts.length) throw new Error('本体が見つからない');
      Array.prototype.forEach.call(styles, function (el) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.crossOrigin = 'anonymous';
        link.href = new URL(el.getAttribute('href'), base).href;
        document.head.appendChild(link);
      });
      Array.prototype.forEach.call(scripts, function (el) {
        var s = document.createElement('script');
        s.type = 'module';
        s.crossOrigin = 'anonymous';
        s.src = new URL(el.getAttribute('src'), base).href;
        s.onerror = function () {
          fail('本体の読み込みに失敗');
        };
        document.head.appendChild(s);
      });
    })
    .catch(function (e) {
      fail(e && e.message ? e.message : String(e));
    });
})();
