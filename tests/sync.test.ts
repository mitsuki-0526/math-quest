import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SaveData } from '@/engine/save';

/**
 * 同期の「人の取りちがえ」を防ぐ仕組みのテスト(Codex レビュー 2026-09-23)。
 * api はモックにして、応答の順番をテストから操る。
 */
const mock = vi.hoisted(() => ({
  save: vi.fn(),
  login: vi.fn(),
}));

vi.mock('@/engine/api', async (orig) => {
  const real = await orig<typeof import('@/engine/api')>();
  return {
    ...real,
    hasServer: () => true,
    saveBeacon: () => true,
    api: { login: mock.login, save: mock.save, bootstrap: vi.fn(), load: vi.fn() },
  };
});

// node 環境には localStorage がないので、最小のものを用意する
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const { createNewSave, saveStore, loadLocalSave, writeLocalSave } = await import('@/engine/save');
const { login, logout, flush, scheduleSync, ownerKey, setIdentity } = await import('@/engine/sync');

const A = { class: '1-1', number: '1', pass: 'aaa' };
const B = { class: '1-1', number: '2', pass: 'bbb' };

function saveOf(name: string, updatedAt: string): SaveData {
  return { ...createNewSave(name), updatedAt };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(async () => {
  vi.useFakeTimers();
  store.clear();
  mock.save.mockReset();
  mock.login.mockReset();
  await logout();
});

describe('sync: アカウントの分離', () => {
  it('端末内のセーブは持ち主ごとに分かれる', () => {
    setIdentity(A);
    writeLocalSave(saveOf('Aさん', '2026-09-23T01:00:00.000Z'));
    setIdentity(B);
    expect(loadLocalSave()).toBeNull();
    expect(loadLocalSave(ownerKey(A))?.player.name).toBe('Aさん');
  });

  it('ログアウト後に届いた前の人の応答は、次の人のセーブに反映しない', async () => {
    mock.login.mockResolvedValueOnce({ ok: true, isNew: false, save: saveOf('Aさん', '2026-09-23T01:00:00.000Z'), unlock: ['g1c1'], teacher: false });
    const a = await login(A, null);
    saveStore.set(a.save);
    const pending = deferred<unknown>();
    mock.save.mockReturnValueOnce(pending.promise);
    scheduleSync(60_000);
    const sending = flush();

    await logout();
    mock.login.mockResolvedValueOnce({ ok: true, isNew: false, save: saveOf('Bさん', '2026-09-23T02:00:00.000Z'), unlock: ['g1c1'], teacher: false });
    const b = await login(B, null);
    saveStore.set(b.save);

    // A の送信に「サーバーの方が新しい」と返ってきても、いまは B なので捨てる
    pending.resolve({ ok: true, stored: false, save: saveOf('Aさん(サーバー)', '2026-09-23T09:00:00.000Z') });
    await sending;
    expect(saveStore.get()?.player.name).toBe('Bさん');
    expect(loadLocalSave(ownerKey(B))).toBeNull(); // B の端末セーブを A の内容で上書きしていない
  });

  it('競合の応答より、送信中にこの端末で進めた分が新しければ、そちらを残す', async () => {
    mock.login.mockResolvedValueOnce({ ok: true, isNew: false, save: saveOf('Aさん', '2026-09-23T01:00:00.000Z'), unlock: ['g1c1'], teacher: false });
    const a = await login(A, null);
    saveStore.set(a.save);
    const pending = deferred<unknown>();
    mock.save.mockReturnValueOnce(pending.promise);
    scheduleSync(60_000);
    const sending = flush();
    saveStore.set(saveOf('Aさん(最新)', '2026-09-23T03:00:00.000Z'));
    pending.resolve({ ok: true, stored: false, save: saveOf('Aさん(別端末)', '2026-09-23T02:00:00.000Z') });
    await sending;
    expect(saveStore.get()?.player.name).toBe('Aさん(最新)');
  });
});
