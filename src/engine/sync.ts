import { createStore } from './store';
import { api, hasServer, saveBeacon, ApiFailure, type Identity } from './api';
import { saveStore, writeLocalSave, saveChangedHooks, setSaveOwner, type SaveData } from './save';
import { unlockedChapters } from './progress';
import { applyConfigOverrides } from '@/data/config';

/**
 * サーバー同期(要件 F2 F3 F97)。
 * - セーブが変わるたびに数秒まとめて 1 回だけ送る(GAS の実行回数を節約)
 * - 失敗したら「未同期」にして、次の変更時 or 復帰時に再送
 * - 競合は「更新時刻が新しい方」を採用する(サーバーが新しければサーバーのものに置き換える)
 * - 1台を複数の生徒が使うので、端末内セーブは持ち主(クラス|番号)ごとに分ける
 */
export type SyncStatus = 'local' | 'synced' | 'pending' | 'error' | 'offline';

export interface SyncState {
  status: SyncStatus;
  lastSyncAt?: string;
  lastError?: string;
  teacher: boolean;
}

export const syncStore = createStore<SyncState>({ status: hasServer() ? 'pending' : 'local', teacher: false });

const IDENTITY_KEY = 'mathquest.identity';
const UNLOCK_CACHE_KEY = 'mathquest.unlock';

/** 再送しても直らない失敗(合言葉ちがい・ロック中など)。送り続けるとロックを延ばすだけなので止める */
const FATAL_CODES = new Set(['bad_pass', 'locked', 'not_found', 'bad_token', 'bad_save', 'save_too_large', 'bad_identity']);

let identity: Identity | null = loadIdentity();
let timer: ReturnType<typeof setTimeout> | null = null;
let inflight = false;
let dirty = false;
/** ログイン・ログアウトのたびに増やす。古い通信の応答を、別の人のセーブに反映させないため */
let generation = 0;

setSaveOwner(hasServer() && identity ? ownerKey(identity) : null);

/** 端末内セーブの持ち主キー */
export function ownerKey(id: Identity): string {
  return `${id.class}|${id.number}`;
}

export function getIdentity(): Identity | null {
  return identity;
}

export function setIdentity(id: Identity | null): void {
  identity = id;
  setSaveOwner(id ? ownerKey(id) : null);
  try {
    if (id) localStorage.setItem(IDENTITY_KEY, JSON.stringify(id));
    else localStorage.removeItem(IDENTITY_KEY);
  } catch {
    /* noop */
  }
}

function loadIdentity(): Identity | null {
  try {
    const t = localStorage.getItem(IDENTITY_KEY);
    return t ? (JSON.parse(t) as Identity) : null;
  } catch {
    return null;
  }
}

/** 解放状態を反映し、オフライン時のためにキャッシュする */
export function applyUnlock(list: string[]): void {
  unlockedChapters.set(list);
  try {
    localStorage.setItem(UNLOCK_CACHE_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

export function loadCachedUnlock(): void {
  try {
    const t = localStorage.getItem(UNLOCK_CACHE_KEY);
    if (t) unlockedChapters.set(JSON.parse(t) as string[]);
  } catch {
    /* noop */
  }
}

function setStatus(patch: Partial<SyncState>): void {
  syncStore.set((s) => ({ ...s, ...patch }));
}

function clearTimer(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}

/** 起動時: 解放状態と調整値をサーバーから取る。失敗したらキャッシュで続行 */
export async function bootstrap(cls: string): Promise<{ classes: string[] } | null> {
  if (!hasServer()) return null;
  try {
    const r = await api.bootstrap(cls);
    applyUnlock(r.unlock);
    applyConfigOverrides(r.config);
    return { classes: r.classes };
  } catch (e) {
    setStatus({ status: 'offline', lastError: String(e) });
    loadCachedUnlock();
    return null;
  }
}

/**
 * ログイン。サーバーのセーブとローカルのセーブがあれば新しい方を採用して返す。
 * local は「この人の」端末内セーブ(持ち主キーで読んだもの)を渡す。
 * 戻り値: 採用したセーブ(null = 新規)
 */
export async function login(id: Identity, local: SaveData | null): Promise<{ save: SaveData | null; isNew: boolean; teacher: boolean }> {
  const r = await api.login(id);
  generation++;
  clearTimer();
  dirty = false;
  setIdentity(id);
  applyUnlock(r.unlock);
  setStatus({ status: 'synced', lastSyncAt: new Date().toISOString(), teacher: r.teacher, lastError: undefined });
  const server = r.save;
  // ローカルセーブがサーバーより新しければローカルを採用して押し上げる
  if (local && (!server || local.updatedAt > server.updatedAt)) {
    if (server || !r.isNew) scheduleSync(0);
    return { save: local, isNew: false, teacher: r.teacher };
  }
  return { save: server, isNew: r.isNew && !server, teacher: r.teacher };
}

/**
 * 回線がないときに、前回と同じ人として端末内のセーブで続ける。
 * サーバーには届いていないので、つながったら自動で送る。
 */
export function resumeOffline(): void {
  generation++;
  clearTimer();
  setStatus({ status: 'offline', lastError: undefined });
  dirty = true;
}

/**
 * ログアウト。持ち主の情報とセーブ状態はすぐに消し(次の人の画面に前の人が出ないように)、
 * 未送信のセーブは持ち主の情報を控えておいて最後に 1 回送る。失敗しても端末内には持ち主別に残るので、
 * 次にその人がログインしたとき押し上げられる。
 */
export async function logout(): Promise<void> {
  const id = identity;
  const save = saveStore.get();
  const needSend = dirty;
  generation++;
  clearTimer();
  dirty = false;
  setIdentity(null);
  saveStore.set(null);
  setStatus({ status: hasServer() ? 'pending' : 'local', teacher: false, lastError: undefined });
  if (!hasServer() || !id || !save || !needSend) return;
  try {
    await api.save(id, save);
  } catch {
    /* 端末内に残っている */
  }
}

/** セーブが変わったら呼ぶ。数秒待ってまとめて送る */
export function scheduleSync(delayMs = 3000): void {
  if (!hasServer() || !identity) return;
  dirty = true;
  setStatus({ status: 'pending' });
  clearTimer();
  timer = setTimeout(() => void flush(), delayMs);
}

/** いま送る(ノード完了やページを閉じる前など) */
export async function flush(): Promise<void> {
  if (!hasServer() || !identity || inflight || !dirty) return;
  const save = saveStore.get();
  if (!save) return;
  const gen = generation;
  const id = identity;
  inflight = true;
  dirty = false;
  /** 次に送るまでの待ち時間。null = 自動では送らない */
  let retryMs: number | null = 3000;
  try {
    const r = await api.save(id, save);
    // 送っている間にログアウト・別の人がログインした → この応答は捨てる
    if (gen !== generation) return;
    if (!r.stored && r.save) {
      // サーバーの方が新しい(別端末で進めた)。ただし送信中にこの端末でさらに進めていれば、そちらが新しい
      const current = saveStore.get();
      if (!current || r.save.updatedAt > current.updatedAt) {
        saveStore.set(r.save);
        writeLocalSave(r.save);
      } else {
        dirty = true;
      }
    }
    setStatus({ status: 'synced', lastSyncAt: new Date().toISOString(), lastError: undefined });
  } catch (e) {
    if (gen !== generation) return;
    const fatal = e instanceof ApiFailure && FATAL_CODES.has(e.code);
    // 直らない失敗は再送しない(次の変更・ログインし直しで送る)。回線の問題は少し待って再送
    dirty = true;
    retryMs = fatal ? null : 15000;
    setStatus({ status: 'error', lastError: String(e) });
  } finally {
    inflight = false;
    // 送信中に変わった分・失敗した分を送り直す。
    // 人が入れ替わっていたら、送信中で止められていた新しい人の分を送る
    if (gen !== generation) {
      if (dirty) scheduleSync();
    } else if (dirty && retryMs !== null) scheduleSync(retryMs);
  }
}

/** 通信が戻ったら再送、閉じる前に送る */
export function installSyncHooks(): void {
  saveChangedHooks.push(() => scheduleSync());
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => {
    if (dirty) scheduleSync(500);
  });
  window.addEventListener('offline', () => setStatus({ status: 'offline' }));
  // 画面を閉じる・裏に回すときは応答を待てないので beacon で投げる。
  // 届いたか分からないので「同期済み」にはしない(戻ってきたら通常の送信で確かめる)
  const beacon = () => {
    const save = saveStore.get();
    if (dirty && identity && save) saveBeacon(identity, save);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') beacon();
    else if (dirty) scheduleSync(500);
  });
  window.addEventListener('pagehide', beacon);
}
