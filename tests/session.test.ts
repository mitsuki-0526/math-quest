import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * 授業の管理(先生の「全員をタイトルに戻す」「受付を停止する」)に従って、遊んでいる生徒がタイトルに戻るか。
 */
vi.mock('@/engine/api', async (orig) => {
  const real = await orig<typeof import('@/engine/api')>();
  return { ...real, hasServer: () => true, api: { ...real.api, ping: vi.fn(), save: vi.fn() } };
});

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const { createNewSave, saveStore } = await import('@/engine/save');
const { syncStore } = await import('@/engine/sync');
const { sceneStack, resetScenes } = await import('@/engine/scenes');
const { observeSession, markEntered, sessionStore } = await import('@/engine/session');

/** タイトルに戻る処理は保存を少し待つので、終わるまで進める */
async function settle() {
  await vi.advanceTimersByTimeAsync(9000);
}

function enterAsStudent(epoch: string, teacher = false) {
  syncStore.set((s) => ({ ...s, teacher }));
  observeSession({ open: true, epoch }); // タイトルで知った状態
  markEntered();
  saveStore.set(createNewSave('ミナ'));
  resetScenes({ kind: 'map' });
}

beforeEach(() => {
  vi.useFakeTimers();
  saveStore.set(null);
  sessionStore.set({ info: null, notice: null });
});

describe('session: 授業の管理', () => {
  it('先生が「全員をタイトルに戻す」を押すと、保存してタイトルに戻る', async () => {
    enterAsStudent('2026-09-24T01:00:00.000Z');
    observeSession({ open: true, epoch: '2026-09-24T02:00:00.000Z' });
    await settle();
    expect(saveStore.get()).toBeNull();
    expect(sceneStack.get().at(-1)?.kind).toBe('title');
    expect(sessionStore.get().notice).toContain('先生の 合図');
  });

  it('受付停止になると、タイトルに戻る', async () => {
    enterAsStudent('');
    observeSession({ open: false, epoch: '' });
    await settle();
    expect(saveStore.get()).toBeNull();
    expect(sessionStore.get().notice).toContain('遊べない 時間');
  });

  it('先生が初めて押したとき(入ったときは epoch が空)も、タイトルに戻る', async () => {
    enterAsStudent('');
    observeSession({ open: true, epoch: '2026-09-24T02:00:00.000Z' });
    await settle();
    expect(saveStore.get()).toBeNull();
  });

  it('状態が変わらなければ、そのまま遊べる', async () => {
    enterAsStudent('2026-09-24T01:00:00.000Z');
    observeSession({ open: true, epoch: '2026-09-24T01:00:00.000Z' });
    await settle();
    expect(saveStore.get()?.player.name).toBe('ミナ');
  });

  it('先生は対象外', async () => {
    enterAsStudent('2026-09-24T01:00:00.000Z', true);
    observeSession({ open: false, epoch: '2026-09-24T03:00:00.000Z' });
    await settle();
    expect(saveStore.get()?.player.name).toBe('ミナ');
  });

  it('入ったあとに初めて epoch を知った(オフラインで始めた)ときは、それを基準にする', async () => {
    syncStore.set((s) => ({ ...s, teacher: false }));
    markEntered(); // まだ状態を知らない
    saveStore.set(createNewSave('ミナ'));
    observeSession({ open: true, epoch: '2026-09-24T01:00:00.000Z' });
    await settle();
    expect(saveStore.get()?.player.name).toBe('ミナ');
  });
});
