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
      /** 名簿に 申請中(error = 'pending')。number が 空なら 番号が まだ(Classroom から 取り込んだ 直後など) */
      pending?: { class: string; number: string };
    }
  | { mode: 'pass' };

/** 授業の状態(サーバーの応答すべてに付く)。open=受付中か、epoch=先生が「全員をタイトルに戻す」を押した時刻 */
export interface SessionInfo {
  open: boolean;
  epoch: string;
}

/** サーバーの応答を受け取るたびに呼ばれる(授業の状態を見張る session.ts が登録する)。api.ts が上位に依存しないための口 */
export const responseHooks: ((data: { session?: SessionInfo }) => void)[] = [];

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
  account?: { class: string; number: string; grade?: number };
  /** 先生が この人の セーブを消した日時(ISO)。これより前に はじめた 端末内のセーブは 捨てる */
  resetAt?: string;
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
/**
 * 宝の地図(クラスに 1 枚だけ)の 売れ具合。決めるのは サーバー(早い者勝ちを 1 か所で 判定するため)。
 * onSale = この人の クラスで 売っている、soldOut = クラスの だれかが 買った、mine = 買ったのは この人、
 * opensAt = 売る期間の 前(「11/1」など。先生が 決めた 発売日を 道具屋に 出して、ためる 目あてにする)
 */
export interface TreasureStatus {
  onSale: boolean;
  soldOut: boolean;
  mine: boolean;
  opensAt?: string;
}
export interface TreasureResult {
  ok: true;
  treasure: TreasureStatus;
}
export type ApiError = { ok: false; error: string; detail?: string };

/** 感想(体験版の試遊)。レベルや進み具合は画面側で自動で付ける */
export interface FeedbackInput {
  fun: number;
  difficulty: 'easy' | 'ok' | 'hard';
  comment: string;
  level: number;
  chapter: string;
  answered: number;
  correct: number;
}

/** 問題の見本帳の印(先生だけが送れる)。1 行 = 地点 × 出題タイプ × ★ */
export interface ReviewInput {
  node: string;
  template: string;
  star: number;
  rating: string;
  comment: string;
  flagged: string[];
}

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
  // 失敗の応答にも授業の状態は付いてくる(受付停止など)ので、判定より先に知らせる
  for (const h of responseHooks) h(data as { session?: SessionInfo });
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
  /** 授業の状態を確かめるだけ(遊んでいる間、ときどき呼ぶ) */
  ping: () => get<{ ok: true; serverTime: string }>({ action: 'ping' }),
  login: (id: Identity) => post<LoginResult>({ action: 'login', class: id.class, number: id.number, pass: id.pass }),
  save: (id: Identity, save: SaveData) => post<SaveResult>({ action: 'save', class: id.class, number: id.number, pass: id.pass, save }),
  load: (id: Identity) => post<LoadResult>({ action: 'load', class: id.class, number: id.number, pass: id.pass }),
  feedback: (id: Identity, feedback: FeedbackInput) =>
    post<{ ok: true }>({ action: 'feedback', class: id.class, number: id.number, pass: id.pass, feedback }),
  /** 名簿に ない 生徒が クラス・番号を 申請する(学校アカウント方式だけ。先生が 承認すると 入れる) */
  apply: (cls: string, number: string) => post<{ ok: true; pending: { class: string; number: string } }>({ action: 'apply', class: cls, number }),
  /** 宝の地図の 売れ具合を 聞く(buy=true なら 買う。売り切れなら 買えずに 状態だけ 返る) */
  treasure: (id: Identity, buy: boolean) =>
    post<TreasureResult>({ action: 'treasure', class: id.class, number: id.number, pass: id.pass, buy }),
  review: (id: Identity, marks: ReviewInput[]) =>
    post<{ ok: true; count: number }>({ action: 'review', class: id.class, number: id.number, pass: id.pass, marks }),
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
    case 'too_many':
      return '感想は 少し 時間を あけてから 送ってね';
    case 'not_teacher':
      return '先生の アカウントで 入ったときだけ 送れます';
    case 'bad_review':
      return '見本帳の 印を 送れませんでした。内容を 確かめてください';
    case 'bad_feedback':
      return '感想の 内容を 確かめて、もう一度 送ってね';
    case 'closed':
      return 'いまは 遊べない 時間です。先生の 合図を 待ってください';
    case 'not_in_roster':
      return 'この アカウントは 名簿に ありません。先生に 知らせてください';
    case 'roster_conflict':
      return '名簿に まちがいが あるため 入れません。先生に 知らせてください';
    case 'pending':
      return '先生の 確認を 待っています。確認が すんだら「もう一度 つなぐ」を 押してください';
    case 'number_taken':
      return 'その クラス・番号は もう ほかの 人が 使っています。番号を 確かめてください';
    case 'already_registered':
      return 'もう 名簿に 入っています。「もう一度 つなぐ」を 押してください';
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
