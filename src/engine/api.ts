import type { SaveData } from './save';

/**
 * サーバーとの通信(要件 F2 F3)。経路は 2 つ:
 * - 本番: GAS の入口ページの中で動いているとき、google.script.run で GAS の rpc() を呼ぶ。
 *   学校ドメイン限定の同じ Web アプリの中の呼び出しなので、外部への通信やトークンは要らない
 * - 開発: VITE_GAS_URL(scripts/mock-server.mjs)へ fetch。POST は text/plain で送る
 * どちらもなければ「この端末だけ」モードで動く(GitHub Pages を直接開いたとき)
 */
export const API_URL: string = import.meta.env.VITE_GAS_URL ?? '';
const API_TOKEN: string = import.meta.env.VITE_API_TOKEN ?? '';
const TIMEOUT_MS = 12000;

/** google.script.run のうち使う部分だけの型 */
interface GasRunner {
  withSuccessHandler(fn: (result: unknown) => void): GasRunner;
  withFailureHandler(fn: (error: unknown) => void): GasRunner;
  rpc(body: string): void;
}

declare global {
  interface Window {
    google?: { script?: { run?: GasRunner } };
    /** boot.js が入れる、ゲーム本体の配信元(素材の相対パスの基準) */
    __MQ_BASE__?: string;
  }
}

function gasRunner(): GasRunner | null {
  return (typeof window !== 'undefined' && window.google?.script?.run) || null;
}

/** GAS の入口ページの中で動いているか */
export const inGas = (): boolean => gasRunner() !== null;

export const hasServer = (): boolean => inGas() || API_URL.length > 0;

export interface Identity {
  class: string;
  number: string;
  pass: string;
}

/**
 * だれとして入るか。
 * - google: 学校アカウントで本人確認できた(合言葉なし)。クラス・番号は先生の名簿で決まる。
 *   registered = 名簿のクラス・番号(先生は class='teacher'。名簿にないときは null)、player = 前回までの主人公(他人の端末で気づけるように表示する)、
 *   error = 名簿にない・名簿に重複がある
 * - pass: アカウントが取れない環境。クラス・番号・合言葉で入る
 */
export type AccountInfo =
  | {
      mode: 'google';
      teacher: boolean;
      registered: { class: string; number: string } | null;
      player: { name: string; level: number } | null;
      error?: string;
    }
  | { mode: 'pass' };

export interface BootstrapResult {
  ok: true;
  unlock: string[];
  classes: string[];
  config: Record<string, unknown>;
  serverTime: string;
  /** 古いサーバー(開発用モックなど)は返さない → 合言葉方式として扱う */
  account?: AccountInfo;
}
export interface LoginResult {
  ok: true;
  isNew: boolean;
  save: SaveData | null;
  unlock: string[];
  teacher: boolean;
  /** 学校アカウント方式: 名簿で決まったクラス・番号(送ったものではなくこちらが正) */
  account?: { class: string; number: string };
}
export interface SaveResult {
  ok: true;
  stored: boolean;
  save: SaveData | null;
}
export interface LoadResult {
  ok: true;
  save: SaveData | null;
}
export type ApiError = { ok: false; error: string; detail?: string };

export class ApiFailure extends Error {
  constructor(
    readonly code: string,
    readonly detail?: string,
  ) {
    super(code);
  }
}

/**
 * 通信 1 回分。タイムアウトは本文の受信まで含める(ヘッダーだけ届いて本文が止まることがあるため)。
 * 時間切れは fetch ごと中断し、回線の問題は 'timeout' / 'network' にそろえる。
 */
async function request<T>(url: string, init: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, redirect: 'follow', signal: ctrl.signal });
    return await parse<T>(res);
  } catch (e) {
    if (ctrl.signal.aborted) throw new ApiFailure('timeout');
    if (e instanceof ApiFailure) throw e;
    // fetch の失敗(オフライン・DNS など)は TypeError になる。ブラウザごとに文言が違うのでまとめる
    if (e instanceof TypeError) throw new ApiFailure('network', e.message);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/** GAS の rpc() を呼ぶ。引数・戻り値は JSON 文字列(google.script.run の変換の癖を避ける) */
function gasCall<T>(runner: GasRunner, body: Record<string, unknown>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false;
    const t = setTimeout(() => {
      done = true;
      reject(new ApiFailure('timeout'));
    }, TIMEOUT_MS);
    runner
      .withSuccessHandler((text) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        try {
          resolve(checkResult<T>(JSON.parse(String(text))));
        } catch (e) {
          reject(e instanceof ApiFailure ? e : new ApiFailure('bad_response'));
        }
      })
      .withFailureHandler((e) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        // サーバー側の例外は rpc() が JSON で返すので、ここに来るのはほぼ回線の問題
        reject(new ApiFailure('network', e instanceof Error ? e.message : String(e)));
      })
      .rpc(JSON.stringify(body));
  });
}

function get<T>(params: Record<string, string>): Promise<T> {
  const runner = gasRunner();
  if (runner) return gasCall<T>(runner, params);
  const q = new URLSearchParams({ ...params, token: API_TOKEN });
  return request<T>(`${API_URL}?${q}`, { method: 'GET' });
}

function post<T>(body: Record<string, unknown>): Promise<T> {
  const runner = gasRunner();
  if (runner) return gasCall<T>(runner, body);
  return request<T>(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, token: API_TOKEN }),
  });
}

/** 回線の問題(=サーバーに届かなかった)か。合言葉ちがいなどサーバーが答えた失敗とは区別する */
export function isNetworkError(e: unknown): boolean {
  return e instanceof ApiFailure && (e.code === 'timeout' || e.code === 'network' || e.code.startsWith('http_5'));
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) throw new ApiFailure(`http_${res.status}`);
  let data: T | ApiError;
  try {
    data = (await res.json()) as T | ApiError;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiFailure('bad_response');
  }
  return checkResult<T>(data);
}

function checkResult<T>(data: unknown): T {
  if (!data || typeof data !== 'object') throw new ApiFailure('bad_response');
  if ((data as ApiError).ok === false) throw new ApiFailure((data as ApiError).error, (data as ApiError).detail);
  return data as T;
}

/** ページを閉じる直前など、応答を待てないときの送信(結果は見ない。届かなくても端末内に残っている) */
export function saveBeacon(id: Identity, save: SaveData): boolean {
  const runner = gasRunner();
  if (runner) {
    gasCall(runner, { action: 'save', class: id.class, number: id.number, pass: id.pass, save }).catch(() => {});
    return true;
  }
  if (!API_URL || typeof navigator === 'undefined' || !navigator.sendBeacon) return false;
  const body = JSON.stringify({ action: 'save', class: id.class, number: id.number, pass: id.pass, save, token: API_TOKEN });
  return navigator.sendBeacon(API_URL, new Blob([body], { type: 'text/plain;charset=utf-8' }));
}

export const api = {
  bootstrap: (cls: string) => get<BootstrapResult>({ action: 'bootstrap', class: cls }),
  login: (id: Identity) => post<LoginResult>({ action: 'login', class: id.class, number: id.number, pass: id.pass }),
  save: (id: Identity, save: SaveData) => post<SaveResult>({ action: 'save', class: id.class, number: id.number, pass: id.pass, save }),
  load: (id: Identity) => post<LoadResult>({ action: 'load', class: id.class, number: id.number, pass: id.pass }),
};

/** ユーザー向けの短い説明 */
export function describeError(e: unknown): string {
  const code = e instanceof ApiFailure ? e.code : e instanceof Error ? e.message : String(e);
  switch (code) {
    case 'bad_pass':
      return '合言葉が ちがいます。忘れたときは 先生に 聞いてください';
    case 'missing_pass':
      return '合言葉を 決めて 入れてください';
    case 'bad_token':
      return 'サーバーの設定が 合っていません(先生に 連絡)';
    case 'not_in_roster':
      return 'この アカウントは 名簿に ありません。先生に 知らせてください';
    case 'roster_conflict':
      return '名簿に まちがいが あるため 入れません。先生に 知らせてください';
    case 'not_registered':
      return 'まだ 登録が すんでいません。タイトルに もどって 入り直してください';
    case 'locked':
      return '合言葉の まちがいが 続いたので、10分ほど 待ってから もう一度 入ってください';
    case 'bad_identity':
      return 'クラス・出席番号・合言葉が 長すぎます';
    case 'server_error':
      return 'サーバーで エラーが 起きました。少し 待って もう一度(続くときは 先生に 連絡)';
    case 'timeout':
    case 'network':
      return 'サーバーに つながりません。通信を 確認してください';
    case 'save_too_large':
      return 'セーブデータが 大きすぎます(先生に 連絡)';
    default:
      return `エラー: ${code}`;
  }
}
