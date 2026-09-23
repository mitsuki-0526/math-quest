import { createStore } from './store';
import { DEFAULT_PLAYER_NAME } from '@/data/characters';

/** セーブデータの版。構造を変えたら上げて migrate() に変換を書く。 */
export const SAVE_VERSION = 1 as const;

export type PlayerLook = 'boy' | 'girl' | 'neutral';

export interface TemplateStats {
  asked: number;
  correct: number;
  streakBest: number;
  /** 最後に間違えた日(ISO 日付) */
  lastWrong?: string;
  /** テンプレートが付ける「つまずきの種類」タグ */
  weakTags?: string[];
  /** 直近の正誤(1=正解)。難易度の自動調整に使う */
  recent?: (0 | 1)[];
  /** 現在の難易度(1〜3) */
  level?: 1 | 2 | 3;
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  player: {
    name: string;
    /** 見た目(最初に選ぶ)。セリフは見た目に依存しない */
    look: PlayerLook;
    level: number;
    exp: number;
    hp: number;
    maxHp: number;
    gold: number;
    attack: number;
    defense: number;
    equipment: { weapon?: string; armor?: string; accessory?: string };
  };
  /** 同行している仲間のキャラID */
  party: string[];
  /** アイテムID → 個数 */
  inventory: Record<string, number>;
  /** 会話・イベントのフラグ */
  flags: Record<string, boolean>;
  /** 会話の効果で変わった表示名(例: 羊飼いの少女 → メイ) */
  renames?: Record<string, string>;
  progress: {
    /** 現在の章ID(例: g1c1) */
    chapter: string;
    clearedNodes: string[];
    clearedChapters: string[];
  };
  /** テンプレートID → 集計(要件 §3 の「1生徒1行」に入る学習情報) */
  stats: Record<string, TemplateStats>;
  /** 今日のクエスト(要件 F14): 練習が少ない単元を毎日 1 つ提示する */
  daily?: { date: string; templateId: string; correct: number; target: number; claimed: boolean };
  settings: {
    sound: boolean;
    reduceMotion: boolean;
    /** 1 = 標準、1.15 = 大きめ */
    fontScale: number;
  };
  /** 最終更新(ISO)。サーバー同期の競合解決に使う */
  updatedAt: string;
}

export function createNewSave(name = DEFAULT_PLAYER_NAME, look: PlayerLook = 'neutral'): SaveData {
  return {
    version: SAVE_VERSION,
    player: {
      name,
      look,
      level: 1,
      exp: 0,
      hp: 40,
      maxHp: 40,
      gold: 0,
      attack: 5,
      defense: 2,
      equipment: {},
    },
    party: [],
    inventory: {},
    flags: {},
    progress: { chapter: 'g1c1', clearedNodes: [], clearedChapters: [] },
    stats: {},
    settings: { sound: false, reduceMotion: prefersReducedMotion(), fontScale: 1 },
    updatedAt: new Date().toISOString(),
  };
}

function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const STORAGE_KEY = 'mathquest.save.v1';

/**
 * 端末内セーブの持ち主(サーバーありのときは「クラス|番号」)。
 * 1台の Chromebook を複数の生徒が使うので、持ち主ごとに別のキーへ保存する。
 * null = 持ち主なし(サーバー未設定で、この端末だけで遊ぶとき)
 */
let saveOwner: string | null = null;

export function setSaveOwner(owner: string | null): void {
  saveOwner = owner;
}

function storageKey(owner: string | null): string {
  return owner ? `${STORAGE_KEY}:${owner}` : STORAGE_KEY;
}

/** 旧版のセーブを現行版に変換する。版を上げたらここに追記。 */
export function migrate(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<SaveData> & { version?: number };
  if (data.version !== SAVE_VERSION) return null;
  if (!data.player || !data.progress) return null;
  // 欠けた項目は既定値で埋める(将来の項目追加に備える)
  const base = createNewSave(data.player.name ?? DEFAULT_PLAYER_NAME);
  return {
    ...base,
    ...data,
    player: { ...base.player, ...data.player },
    progress: { ...base.progress, ...data.progress },
    settings: { ...base.settings, ...data.settings },
    version: SAVE_VERSION,
  };
}

/** 端末内のセーブを読む。owner を省略すると現在の持ち主のもの */
export function loadLocalSave(owner: string | null = saveOwner): SaveData | null {
  try {
    const text = localStorage.getItem(storageKey(owner));
    if (!text) return null;
    return migrate(JSON.parse(text));
  } catch {
    return null;
  }
}

export function writeLocalSave(data: SaveData): void {
  try {
    localStorage.setItem(storageKey(saveOwner), JSON.stringify(data));
  } catch {
    // 保存不可の環境でも遊べる(要件 F3)。M3 でサーバー保存を足す。
  }
}

export function clearLocalSave(): void {
  try {
    localStorage.removeItem(storageKey(saveOwner));
  } catch {
    /* noop */
  }
}

/** ゲーム全体で共有するセーブ状態。null = 未開始(タイトル画面)。 */
export const saveStore = createStore<SaveData | null>(null);

/** セーブが更新されたときに呼ばれる(サーバー同期が登録する)。save.ts が sync.ts に依存しないための口 */
export const saveChangedHooks: ((data: SaveData) => void)[] = [];

/** セーブ状態を更新し、localStorage にも書く。 */
export function updateSave(mutate: (draft: SaveData) => void): void {
  const current = saveStore.get();
  if (!current) return;
  const next: SaveData = structuredClone(current);
  mutate(next);
  next.updatedAt = new Date().toISOString();
  saveStore.set(next);
  writeLocalSave(next);
  for (const h of saveChangedHooks) h(next);
}

export function startNewGame(name: string, look: PlayerLook = 'neutral'): SaveData {
  const data = createNewSave(name, look);
  saveStore.set(data);
  writeLocalSave(data);
  return data;
}

export function continueGame(): SaveData | null {
  const data = loadLocalSave();
  if (data) saveStore.set(data);
  return data;
}
