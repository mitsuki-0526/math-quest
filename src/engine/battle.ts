import { config } from '@/data/config';
import type { EnemyDef } from '@/data/grade1/enemies';
import { generateProblem, getTemplate, judge, type Difficulty, type Problem } from '@/math/template';
import type { Rng } from '@/math/rng';
import { createRng } from '@/math/rng';

/**
 * 戦闘のロジック(要件 F20〜F28)。UI を持たず、状態と操作だけを提供する。
 * 1ノード = 複数の「戦闘(encounter)」。1戦闘 = 複数の敵。
 * ターン: 敵の1体が問題を出す → 正解ならその敵にダメージ、誤答・時間切れならその敵の攻撃を受ける。
 */

export interface PlayerStats {
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  /** 装備の補正(秒) */
  timeBonus: number;
  /** 経験値倍率(装備) */
  expMul: number;
}

export interface Combatant {
  /** 同じ敵が複数いても区別するためのキー */
  key: string;
  def: EnemyDef;
  hp: number;
}

export type BattlePhase =
  | 'question' // 出題中(入力待ち)
  | 'explain' // 誤答・時間切れの解説表示中
  | 'victory' // この戦闘に勝った(次の戦闘 or ノードクリアへ)
  | 'nodeClear' // 全戦闘に勝った
  | 'defeat' // HP が 0
  | 'fled'; // 逃げた

export interface TurnResult {
  correct: boolean;
  timeout: boolean;
  /** 与えた or 受けたダメージ */
  damage: number;
  quick: boolean;
  streakMul: number;
  note?: string;
  targetKey: string;
  defeated: boolean;
  expGain: number;
}

export interface BattleState {
  encounters: string[][];
  encounterIndex: number;
  enemies: Combatant[];
  phase: BattlePhase;
  problem: Problem | null;
  /** 出題するたびに 1 増える番号。同じ問題(キー)が続けて出ても、画面側で「新しい問題」と分かるように */
  turn: number;
  /** 出題している敵の key */
  targetKey: string | null;
  /** この問題の制限時間(秒) */
  timeLimit: number;
  streak: number;
  hintsLeft: number;
  hintUsedForCurrent: boolean;
  player: PlayerStats;
  log: string[];
  last: TurnResult | null;
  totals: { asked: number; correct: number; exp: number; gold: number; streakBest: number };
  /** ボス戦の現在フェーズ(0 始まり)。雑魚戦は undefined */
  bossPhase?: number;
  isBoss: boolean;
  canFlee: boolean;
  /** 直近に出した問題のキー(重複回避) */
  recentKeys: string[];
  /** 答え合わせに使うため、テンプレートごとに出した問題の履歴(難易度調整用) */
  levelUps: number;
}

export interface BattleContext {
  encounters: string[][];
  getEnemy(id: string): EnemyDef;
  player: PlayerStats;
  /** テンプレートごとの現在の難易度(苦手・得意に応じて外で決める) */
  pickDifficulty(templateId: string): Difficulty;
  /** 苦手なテンプレートか(出題する敵を選ぶときに優先する) */
  isWeak?(templateId: string): boolean;
  hints: number;
  isBoss?: boolean;
  rng?: Rng;
  /** 修練の泉: 敵の種類に関係なく、このテンプレートを出題する */
  templateOverride?: string;
}

const LOG_MAX = 12;

function push(state: BattleState, ...lines: string[]): void {
  state.log = [...state.log, ...lines].slice(-LOG_MAX);
}

export function createBattle(ctx: BattleContext): BattleState {
  const state: BattleState = {
    encounters: ctx.encounters,
    encounterIndex: -1,
    enemies: [],
    phase: 'question',
    problem: null,
    turn: 0,
    targetKey: null,
    timeLimit: 60,
    streak: 0,
    hintsLeft: ctx.hints,
    hintUsedForCurrent: false,
    player: { ...ctx.player },
    log: [],
    last: null,
    totals: { asked: 0, correct: 0, exp: 0, gold: 0, streakBest: 0 },
    isBoss: !!ctx.isBoss,
    canFlee: !ctx.isBoss,
    recentKeys: [],
    levelUps: 0,
  };
  return nextEncounter(state, ctx);
}

/** 次の戦闘を始める。もう戦闘がなければ nodeClear */
export function nextEncounter(state: BattleState, ctx: BattleContext): BattleState {
  const s = { ...state };
  s.encounterIndex += 1;
  if (s.encounterIndex >= s.encounters.length) {
    s.phase = 'nodeClear';
    s.problem = null;
    return s;
  }
  const ids = s.encounters[s.encounterIndex];
  s.enemies = ids.map((id, i) => {
    const def = ctx.getEnemy(id);
    return { key: `${id}#${i}`, def, hp: def.hp };
  });
  s.bossPhase = s.isBoss ? 0 : undefined;
  s.log = [];
  const names = summarizeNames(s.enemies);
  push(s, s.enemies[0].def.lines.appear.replace(s.enemies[0].def.name, names));
  return ask(s, ctx);
}

/** 生きている敵の中から出題者を選び、問題を生成する */
export function ask(state: BattleState, ctx: BattleContext): BattleState {
  const s = { ...state };
  const alive = s.enemies.filter((e) => e.hp > 0);
  if (alive.length === 0) return s;
  const rng = ctx.rng ?? createRng();
  // 苦手なテンプレートの敵を優先(要件 F46)。それ以外はランダム
  const weak = ctx.isWeak ? alive.filter((e) => ctx.isWeak!(templateFor(s, e))) : [];
  const target = weak.length > 0 && rng.bool(0.7) ? rng.pick(weak) : rng.pick(alive);
  const templateId = ctx.templateOverride ?? templateFor(s, target);
  const difficulty = ctx.pickDifficulty(templateId);
  const problem = generateProblem(templateId, difficulty, s.recentKeys, rng);
  const base = getTemplate(templateId).timeLimit[difficulty];
  s.problem = problem;
  s.turn = state.turn + 1;
  s.targetKey = target.key;
  s.timeLimit = Math.max(config.battle.timeMin, Math.min(config.battle.timeMax, base + s.player.timeBonus));
  s.hintUsedForCurrent = false;
  s.phase = 'question';
  s.recentKeys = [...s.recentKeys, problem.key].slice(-6);
  return s;
}

/** ボスはフェーズごとに出題テンプレートが変わる */
function templateFor(state: BattleState, enemy: Combatant): string {
  const phases = enemy.def.phases;
  if (state.isBoss && phases && phases.length > 0) {
    const idx = currentPhaseIndex(enemy, phases);
    const list = phases[idx].templates;
    return list[Math.floor(Math.random() * list.length)];
  }
  return enemy.def.template;
}

function currentPhaseIndex(enemy: Combatant, phases: NonNullable<EnemyDef['phases']>): number {
  const ratio = enemy.hp / enemy.def.hp;
  let idx = 0;
  for (let i = 0; i < phases.length; i++) if (ratio <= phases[i].untilHpRatio) idx = i;
  return idx;
}

/** 回答する。elapsedSec は出題からの経過秒 */
export function answer(state: BattleState, input: string, elapsedSec: number, ctx: BattleContext): BattleState {
  if (state.phase !== 'question' || !state.problem) return state;
  const s = { ...state, totals: { ...state.totals }, player: { ...state.player } };
  const result = judge(state.problem.answer, input);
  s.totals.asked += 1;
  return result.correct ? resolveCorrect(s, elapsedSec, ctx) : resolveWrong(s, false, result.note, ctx);
}

/** 時間切れ。誤答と同じ扱いだが、メッセージが変わる */
export function timeout(state: BattleState, ctx: BattleContext): BattleState {
  if (state.phase !== 'question') return state;
  const s = { ...state, totals: { ...state.totals }, player: { ...state.player } };
  s.totals.asked += 1;
  return resolveWrong(s, true, undefined, ctx);
}

function resolveCorrect(s: BattleState, elapsedSec: number, ctx: BattleContext): BattleState {
  const target = s.enemies.find((e) => e.key === s.targetKey)!;
  s.streak += 1;
  s.totals.correct += 1;
  s.totals.streakBest = Math.max(s.totals.streakBest, s.streak);
  const streakMul = config.battle.streakBonus.find((b) => s.streak >= b.streak)?.mul ?? 1;
  const quick = elapsedSec <= s.timeLimit * config.battle.quickRatio;
  const raw = config.battle.baseDamage + s.player.attack * config.battle.attackScale;
  const damage = Math.round(raw * streakMul * (quick ? config.battle.quickMul : 1));
  const enemies = s.enemies.map((e) => (e.key === target.key ? { ...e, hp: Math.max(0, e.hp - damage) } : e));
  const defeated = enemies.find((e) => e.key === target.key)!.hp === 0;
  const difficulty = s.problem!.difficulty;
  let expGain = config.battle.expPerCorrect[difficulty];
  if (s.hintUsedForCurrent) expGain = Math.round(expGain * config.battle.hintExpMul);
  expGain = Math.round(expGain * s.player.expMul);
  s.totals.exp += expGain;
  s.enemies = enemies;
  s.last = { correct: true, timeout: false, damage, quick, streakMul, targetKey: target.key, defeated, expGain };

  const bonus = [quick ? '会心!' : '', streakMul > 1 ? `${s.streak}連続!` : ''].filter(Boolean).join(' ');
  push(s, `${s.player.name}の こうげき! ${bonus} ${target.def.name}に ${damage}の ダメージ!`.replace(/\s+/g, ' '));
  if (defeated) {
    s.totals.gold += target.def.gold;
    s.totals.exp += Math.round(target.def.exp * s.player.expMul);
    push(s, `${target.def.name}を たおした! ${target.def.lines.defeat}`);
  } else {
    push(s, target.def.lines.hit);
    // ボス: フェーズが進んだら開始セリフ、3連続正解ならうろたえるセリフ(台本 C1-8)
    const phases = target.def.phases;
    if (s.isBoss && phases) {
      const before = currentPhaseIndex({ ...target, hp: target.hp }, phases);
      const after = currentPhaseIndex(enemies.find((e) => e.key === target.key)!, phases);
      if (after > before) {
        s.bossPhase = after;
        push(s, phases[after].line);
      }
    }
    if (s.streak === 3 && target.def.lines.streak) push(s, target.def.lines.streak);
  }

  if (s.enemies.every((e) => e.hp === 0)) {
    s.phase = 'victory';
    s.problem = null;
    return s;
  }
  return ask(s, ctx);
}

function resolveWrong(s: BattleState, isTimeout: boolean, note: string | undefined, _ctx: BattleContext): BattleState {
  const target = s.enemies.find((e) => e.key === s.targetKey)!;
  s.streak = 0;
  const damage = Math.max(config.battle.minDamage, target.def.attack - s.player.defense);
  s.player.hp = Math.max(0, s.player.hp - damage);
  s.last = { correct: false, timeout: isTimeout, damage, quick: false, streakMul: 1, note, targetKey: target.key, defeated: false, expGain: 0 };
  push(s, isTimeout ? `時間切れ! ${target.def.name}の こうげき!` : `${target.def.name}の こうげき!`, `${s.player.name}は ${damage}の ダメージを 受けた ${target.def.lines.miss}`);
  s.phase = s.player.hp === 0 ? 'defeat' : 'explain';
  if (s.phase === 'defeat') push(s, `${s.player.name}は 目の前が 暗くなった…`);
  return s;
}

/** 解説を閉じて次の問題へ */
export function continueAfterExplain(state: BattleState, ctx: BattleContext): BattleState {
  if (state.phase !== 'explain') return state;
  return ask({ ...state }, ctx);
}

/** 勝利画面から次の戦闘へ */
export function continueAfterVictory(state: BattleState, ctx: BattleContext): BattleState {
  if (state.phase !== 'victory') return state;
  return nextEncounter(state, ctx);
}

export function useHint(state: BattleState): { state: BattleState; hint: string | null } {
  if (state.phase !== 'question' || !state.problem) return { state, hint: null };
  if (state.hintUsedForCurrent) return { state, hint: state.problem.hint };
  if (state.hintsLeft <= 0) return { state, hint: null };
  const s = { ...state, hintsLeft: state.hintsLeft - 1, hintUsedForCurrent: true };
  push(s, `ピタの ささやき: 「${state.problem.hint}」`);
  return { state: s, hint: state.problem.hint };
}

export function heal(state: BattleState, amount: number | 'full', label: string): BattleState {
  const s = { ...state, player: { ...state.player } };
  const before = s.player.hp;
  s.player.hp = amount === 'full' ? s.player.maxHp : Math.min(s.player.maxHp, s.player.hp + amount);
  push(s, `${label}を 使った! HP が ${s.player.hp - before} 回復した`);
  return s;
}

export function addHints(state: BattleState, n: number, label: string): BattleState {
  const s = { ...state, hintsLeft: state.hintsLeft + n };
  push(s, `${label}を 使った! ヒントが ${n}回 増えた`);
  return s;
}

export function extendTime(state: BattleState, sec: number, label: string): BattleState {
  const s = { ...state, timeLimit: state.timeLimit + sec };
  push(s, `${label}を 使った! 残り時間が ${sec}秒 のびた`);
  return s;
}

export function flee(state: BattleState): BattleState {
  if (!state.canFlee) return state;
  const s = { ...state, phase: 'fled' as BattlePhase };
  push(s, `${s.player.name}は にげだした!`);
  return s;
}

function summarizeNames(enemies: Combatant[]): string {
  const counts = new Map<string, number>();
  for (const e of enemies) counts.set(e.def.name, (counts.get(e.def.name) ?? 0) + 1);
  return [...counts.entries()].map(([n, c]) => (c > 1 ? `${n}×${c}` : n)).join('と ');
}

/** 現在のボスフェーズ(表示用) */
export function bossPhaseOf(state: BattleState): { index: number; total: number; line?: string } | null {
  if (!state.isBoss) return null;
  const boss = state.enemies[0];
  const phases = boss?.def.phases;
  if (!boss || !phases) return null;
  const index = currentPhaseIndex(boss, phases);
  return { index, total: phases.length, line: phases[index].line };
}
