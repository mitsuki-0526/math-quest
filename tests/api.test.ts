import { describe, it, expect, vi, afterEach } from 'vitest';
import { api, inGas, hasServer, ApiFailure } from '@/engine/api';

/**
 * GAS の入口ページの中での通信(google.script.run → rpc)。
 * 本物の google.script.run と同じ「ハンドラを付けてから関数名で呼ぶ」形の偽物を置いて確かめる。
 */
type Handler = (v: unknown) => void;

function fakeRun(server: (body: Record<string, unknown>) => { reply?: unknown; fail?: unknown; never?: boolean }) {
  const calls: Record<string, unknown>[] = [];
  const make = (ok: Handler = () => {}, ng: Handler = () => {}) => ({
    withSuccessHandler: (fn: Handler) => make(fn, ng),
    withFailureHandler: (fn: Handler) => make(ok, fn),
    rpc: (text: string) => {
      const body = JSON.parse(text) as Record<string, unknown>;
      calls.push(body);
      const r = server(body);
      if (r.never) return;
      // 本物と同じく非同期で返す
      setTimeout(() => (r.fail !== undefined ? ng(r.fail) : ok(JSON.stringify(r.reply))), 0);
    },
  });
  vi.stubGlobal('window', { google: { script: { run: make() } } });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('api: GAS の入口ページの中', () => {
  it('google.script.run があれば GAS 経由になり、トークンは送らない', async () => {
    const calls = fakeRun(() => ({ reply: { ok: true, isNew: true, save: null, unlock: ['g1c1'], teacher: false } }));
    expect(inGas()).toBe(true);
    expect(hasServer()).toBe(true);
    const r = await api.login({ class: '1-1', number: '3', pass: 'abc' });
    expect(r.isNew).toBe(true);
    expect(calls[0]).toEqual({ action: 'login', class: '1-1', number: '3', pass: 'abc' });
    expect(calls[0]).not.toHaveProperty('token');
  });

  it('サーバーが ok:false を返したら、そのエラーコードで失敗する', async () => {
    fakeRun(() => ({ reply: { ok: false, error: 'bad_pass' } }));
    await expect(api.login({ class: '1-1', number: '3', pass: 'x' })).rejects.toMatchObject({ code: 'bad_pass' });
  });

  it('google.script.run 自体の失敗は回線の問題(network)として扱う', async () => {
    fakeRun(() => ({ fail: new Error('NetworkError: Connection failure due to HTTP 0') }));
    const e = await api.load({ class: '1-1', number: '3', pass: 'x' }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiFailure);
    expect((e as ApiFailure).code).toBe('network');
  });

  it('応答がなければ時間切れにする', async () => {
    vi.useFakeTimers();
    fakeRun(() => ({ never: true }));
    const p = api.bootstrap('1-1').catch((x: unknown) => x);
    await vi.advanceTimersByTimeAsync(13000);
    expect(((await p) as ApiFailure).code).toBe('timeout');
  });

  it('入口ページの外(google.script.run なし)では GAS 経由にならない', () => {
    vi.stubGlobal('window', {});
    expect(inGas()).toBe(false);
  });
});
