import type { Difficulty } from '../template';
import { REJECT_LABEL, type RejectReason } from './rejectReason';

/**
 * 問題生成の ログ(候補 1 つごとに 1 行)。個人情報(名前・クラス・答え)は 入れない。
 * 端末の メモリに 直近 LOG_MAX 件だけ 残す(開発中は window.__mqGenerationLog で 見られる)。
 * 品質レポート(npm run quality:report)が これを 数える。将来 良問/悪問の 分類に 使えるよう、形を そろえておく
 */
export interface GenerationLogEntry {
  time: string;
  templateId: string;
  difficulty: Difficulty;
  basis: string;
  /** 何回目の 候補か(1 から) */
  attempt: number;
  accepted: boolean;
  reason?: RejectReason;
  detail?: string;
  /** どれも 合格しなかったときの 代わり(重複を 許した / ★ を 下げた / 検査なし) */
  fallback?: 'allow_duplicate' | 'lower_star' | 'unvalidated';
  key?: string;
  question?: string;
  validatorVersion: string;
}

const LOG_MAX = 2000;
let entries: GenerationLogEntry[] = [];

export function logGeneration(e: GenerationLogEntry): void {
  entries.push(e);
  if (entries.length > LOG_MAX) entries = entries.slice(-LOG_MAX);
}

export function getGenerationLog(): readonly GenerationLogEntry[] {
  return entries;
}

export function clearGenerationLog(): void {
  entries = [];
}

export interface GenerationSummary {
  /** 作った 候補の 数 */
  candidates: number;
  /** ゲームに 渡した 問題の 数(合格 + 代わり) */
  delivered: number;
  /** 合格した 候補の 割合(合格 / 候補) */
  acceptanceRate: number;
  /** 代わり(fallback)で 渡した 数 */
  fallbacks: number;
  /** 不合格の 理由ごとの 数 */
  byReason: Partial<Record<RejectReason, number>>;
}

export function summarizeGeneration(log: readonly GenerationLogEntry[] = entries): GenerationSummary {
  const byReason: Partial<Record<RejectReason, number>> = {};
  let accepted = 0;
  let fallbacks = 0;
  let candidates = 0;
  for (const e of log) {
    if (e.fallback) {
      fallbacks++;
      continue;
    }
    candidates++;
    if (e.accepted) accepted++;
    else if (e.reason) byReason[e.reason] = (byReason[e.reason] ?? 0) + 1;
  }
  return { candidates, delivered: accepted + fallbacks, acceptanceRate: candidates ? accepted / candidates : 1, fallbacks, byReason };
}

/** 集計を 読める 文字に(品質レポート・開発中の コンソール用) */
/** 重複による 作り直し(問題の 質の 不合格ではない。問題の 種類が 少ないと 増える) */
const REPEAT_REASONS: RejectReason[] = ['DUPLICATE', 'SAME_FORM'];

export function formatSummary(s: GenerationSummary): string {
  const pct = (n: number) => `${((n / Math.max(1, s.candidates)) * 100).toFixed(1)}%`;
  const lines = [`候補 ${s.candidates} 件 → ゲームへ ${s.delivered} 問(代わり ${s.fallbacks})`, `採用率: ${(s.acceptanceRate * 100).toFixed(1)}%`];
  const reasons = Object.entries(s.byReason).sort((a, b) => b[1] - a[1]) as [RejectReason, number][];
  const quality = reasons.filter(([r]) => !REPEAT_REASONS.includes(r));
  const repeat = reasons.filter(([r]) => REPEAT_REASONS.includes(r));
  const row = ([r, n]: [RejectReason, number]) => `  ${r.padEnd(22)} ${pct(n).padStart(6)}  (${n})  ${REJECT_LABEL[r]}`;
  lines.push('品質の 不合格(直すべきもの):', ...(quality.length ? quality.map(row) : ['  なし']));
  lines.push('重複による 作り直し(問題の 種類が 少ないと 増える):', ...(repeat.length ? repeat.map(row) : ['  なし']));
  return lines.join('\n');
}

// 開発中は ブラウザの コンソールから 見られるように
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  (window as unknown as { __mqGenerationLog: () => string }).__mqGenerationLog = () => formatSummary(summarizeGeneration());
}
