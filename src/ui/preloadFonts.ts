/**
 * 数式と 図の 文字の フォントを 先に 読み込んでおく。
 *
 * KaTeX の フォントは font-display: block なので、ファイルが 届くまで その 文字は 見えない(場所だけ とる)。
 * はじめて π・≦・分数 などが 出た 問題で、問題の 窓が 一瞬 消えて、フォントが 届くと 一気に 大きく なった
 * (歪みの使徒の 第3段階で 図の 問題が 出たとき。先生の報告 2026-10-19)。
 * 図の 文字(DotGothic16)は 漢字が 細かく 分けて 配られるので、図に よく 出る 字だけ 先に 読む
 */

/** ゲームで 使う KaTeX の 書体(太字・筆記体・等幅などは 使わない) */
const KATEX_FONTS = [
  'normal 400 1em KaTeX_Main',
  'italic 400 1em KaTeX_Main',
  'normal 700 1em KaTeX_Main',
  'italic 400 1em KaTeX_Math',
  'normal 400 1em KaTeX_AMS',
  'normal 400 1em KaTeX_Size1',
  'normal 400 1em KaTeX_Size2',
  'normal 400 1em KaTeX_Size3',
  'normal 400 1em KaTeX_Size4',
];

/** 図(SVG)の 文字に よく 出る 字 */
const FIGURE_CHARS =
  '0123456789.,()+−×÷=°′ABCDEFGHOPQRxyℓcmL²³' +
  '度数人以上未満合計階級半径直径高さ底辺正面から見た図上平立投影展開回転軸母線弧中心角記録秒点走投げゲーム得点組平均値中央最小大範囲回向き表裏時計反移動';

export function preloadFonts(): void {
  if (typeof document === 'undefined' || !document.fonts) return;
  const run = () => {
    for (const f of KATEX_FONTS) document.fonts.load(f, 'x').catch(() => {});
    document.fonts.load('400 16px DotGothic16', FIGURE_CHARS).catch(() => {});
  };
  // 最初の 画面を 描く じゃまを しないように、手が すいたときに
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (idle) idle(run);
  else setTimeout(run, 500);
}
