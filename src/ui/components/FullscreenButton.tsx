import { useEffect, useState } from 'preact/hooks';

/**
 * 全画面ボタン(上の HUD の右はし)。Chromebook は ブラウザの枠で 画面の 2 割ほどが 使えないため(先生の試遊 2026-09-28)。
 * ゲームは GAS のページの 枠(iframe)の中で動くので、ブラウザが 枠からの全画面を 許さないことがある。
 * そのときは キーボードの 全画面キーを 案内する(キーなら 枠に関係なく 全画面になる)
 */
export function FullscreenButton() {
  const [full, setFull] = useState(() => !!document.fullscreenElement);
  const [tip, setTip] = useState(false);

  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(() => setTip(false), 8000);
    return () => clearTimeout(t);
  }, [tip]);

  async function toggle() {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (!document.fullscreenEnabled) {
      setTip(true);
      return;
    }
    // 環境によっては 失敗も成功も 返ってこないことがある(アプリの中の ブラウザ など)。少し待って 全画面に なっていなければ 案内を出す
    const timer = setTimeout(() => !document.fullscreenElement && setTip(true), 1500);
    try {
      await document.documentElement.requestFullscreen();
      clearTimeout(timer);
    } catch {
      clearTimeout(timer);
      setTip(true);
    }
  }

  return (
    <span class="fullscreen-wrap">
      <button type="button" class="fullscreen-btn" onClick={toggle} title={full ? '全画面を やめる' : '全画面に する'}>
        {full ? '全画面を やめる' : '⛶ 全画面'}
      </button>
      {tip && (
        <span class="fullscreen-tip" role="status" onClick={() => setTip(false)}>
          キーボードの いちばん上の段にある <b>全画面キー</b>(□ の形。パソコンは F11)を 押してね。もどすときも 同じキー
        </span>
      )}
    </span>
  );
}
