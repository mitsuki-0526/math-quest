import { createStore } from './store';
import { api, hasServer, responseHooks, type SessionInfo } from './api';
import { saveStore } from './save';
import { flush, syncStore } from './sync';
import { resetScenes } from './scenes';

/**
 * 授業の管理(先生のスプレッドシートのメニュー)に従う。
 * - 「全員をタイトルに戻す」: ゲームに入ったときと epoch が変わっていたら、保存してタイトルに戻る
 * - 「受付を停止する」・時間外: 保存を試みてタイトルに戻る(サーバーは生徒の保存を断るので、端末内に残り、次に入ったとき送られる)
 * 先生は対象外。サーバーのどの応答にも状態が付くので、保存のたびに気づける。
 * 何も保存しない間(問題を読んでいるだけなど)も気づけるよう、遊んでいる間はときどき確かめる。
 */
export interface SessionState {
  /** 最後に知った授業の状態 */
  info: SessionInfo | null;
  /** タイトルに出すお知らせ(タイトルに戻された理由) */
  notice: string | null;
}

export const sessionStore = createStore<SessionState>({ info: null, notice: null });

const POLL_MS = 90_000;
const FLUSH_WAIT_MS = 8000;

/** ゲームに入ったときの epoch。null = まだ入っていない */
let entryEpoch: string | null = null;
/** 入ったときに授業の状態を知っていたか(オフラインで始めたときは知らない) */
let epochKnown = false;
let leaving = false;

/** ゲームに入ったときに呼ぶ(ここからの epoch の変化で戻す) */
export function markEntered(): void {
  const info = sessionStore.get().info;
  entryEpoch = info?.epoch ?? '';
  epochKnown = info !== null;
  sessionStore.set((s) => ({ ...s, notice: null }));
}

function inGameAsStudent(): boolean {
  return hasServer() && entryEpoch !== null && saveStore.get() !== null && !syncStore.get().teacher;
}

export function observeSession(info: SessionInfo): void {
  sessionStore.set((s) => ({ ...s, info }));
  if (!inGameAsStudent()) return;
  if (!info.open) {
    void leaveToTitle('いまは 遊べない 時間に なりました。記録は 保存して あります');
  } else if (!epochKnown) {
    // 入る前に状態を知らなかった(オフラインで始めた)ときは、はじめて知った値を基準にする
    entryEpoch = info.epoch;
    epochKnown = true;
  } else if (info.epoch !== entryEpoch) {
    void leaveToTitle('先生の 合図で タイトルに もどりました。記録は 保存して あります');
  }
}

/** 未送信の分を送ってから(待つのは数秒まで)、タイトルに戻る */
async function leaveToTitle(notice: string): Promise<void> {
  if (leaving) return;
  leaving = true;
  entryEpoch = null;
  try {
    await Promise.race([flush().catch(() => {}), new Promise((r) => setTimeout(r, FLUSH_WAIT_MS))]);
  } finally {
    resetScenes({ kind: 'title' });
    saveStore.set(null);
    sessionStore.set((s) => ({ ...s, notice }));
    leaving = false;
  }
}

/** 応答を見張り、遊んでいる間はときどき確かめる */
export function installSessionWatch(): void {
  responseHooks.push((data) => {
    if (data.session) observeSession(data.session);
  });
  if (typeof window === 'undefined') return;
  const check = () => {
    if (inGameAsStudent() && document.visibilityState === 'visible') void api.ping().catch(() => {});
  };
  setInterval(check, POLL_MS);
  // 画面に戻ってきたとき(ふたを開けた・タブを戻した)はすぐ確かめる
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}
