import type { FigureSpec } from '@/math/figure';
import prologue from '@/data/grade1/scripts/00_prologue.json';
import ch1 from '@/data/grade1/scripts/01_sign_forest.json';
import ch2 from '@/data/grade1/scripts/02_nameless_plain.json';
import ch3 from '@/data/grade1/scripts/03_unknown_cave.json';
import ch4 from '@/data/grade1/scripts/04_waterwheel_lake.json';
import ch5 from '@/data/grade1/scripts/05_circle_ruins.json';
import ch6 from '@/data/grade1/scripts/06_solid_mountain.json';
import ch7 from '@/data/grade1/scripts/07_record_tower.json';

/**
 * 会話スクリプト(要件 F60 F61)。データは scripts/convert-script.mjs が台本から生成する JSON。
 * ここでは型と、行を順に進める「ランナー」を提供する。UI(TalkScene)は表示だけを担当する。
 */

export type ScriptEffect =
  | { effect: 'item'; id: string; count: number; equip?: boolean }
  | { effect: 'flag'; key: string }
  | { effect: 'party'; id: string }
  | { effect: 'chapterClear'; id: string }
  | { effect: 'startBattle' }
  | { effect: 'title'; text: string }
  | { effect: 'rename'; from: string; to: string }
  | { effect: 'unlockKeys'; keys: string[] }
  | { effect: 'nameInput' };

export type ScriptLine =
  | { who: string; say: string; face?: string; voiceOnly?: boolean }
  | { choice: { text: string; goto: string; tag?: string }[] }
  | { label: string }
  | { goto: string }
  | { note: string; bg?: string }
  | { bg: string }
  | { figure: FigureSpec }
  | ScriptEffect;

export interface Scene {
  id: string;
  name: string;
  kind: string;
  bg?: string;
  actors: string[];
  lines: ScriptLine[];
}

const scenes = new Map<string, Scene>();
for (const list of [prologue, ch1, ch2, ch3, ch4, ch5, ch6, ch7] as unknown as Scene[][]) for (const s of list) scenes.set(s.id, s);

export function getScene(id: string): Scene {
  const base = id.split('#')[0];
  const s = scenes.get(base);
  if (!s) throw new Error(`シーンが未定義: ${id}`);
  return s;
}

export function hasScene(id: string): boolean {
  const [base, label] = id.split('#');
  const s = scenes.get(base);
  if (!s) return false;
  return !label || s.lines.some((l) => 'label' in l && l.label === label);
}

export const isSay = (l: ScriptLine): l is Extract<ScriptLine, { say: string }> => 'say' in l;
export const isChoice = (l: ScriptLine): l is Extract<ScriptLine, { choice: unknown }> => 'choice' in l;
export const isEffect = (l: ScriptLine): l is ScriptEffect => 'effect' in l;

/** ランナーが UI に返す「いま表示すべきもの」 */
export type Step =
  | { type: 'say'; who: string; text: string; face?: string; voiceOnly?: boolean }
  | { type: 'choice'; options: { text: string; goto: string; tag?: string }[] }
  | { type: 'end' };

export interface RunnerOptions {
  /** 順に進んで label に出会ったら止める(P-5 の戦闘前パートなど) */
  stopAtLabel?: boolean;
  /** 効果に出会ったときに呼ぶ(セーブに反映する)。'startBattle' が来たら end と同時に開始する */
  onEffect(e: ScriptEffect): void;
  onBg?(bg: string): void;
  onFigure?(f: FigureSpec): void;
}

/**
 * スクリプトを 1 行ずつ進める。表示すべき行(say/choice)に着いたら返し、
 * label / goto / effect / note は内部で処理して先へ進む。
 */
export class ScriptRunner {
  private pos = 0;
  private started = false;
  readonly history: { who: string; text: string }[] = [];

  constructor(
    readonly scene: Scene,
    private opts: RunnerOptions,
    startLabel?: string,
  ) {
    if (startLabel) this.pos = this.findLabel(startLabel) + 1;
  }

  private findLabel(label: string): number {
    const i = this.scene.lines.findIndex((l) => 'label' in l && l.label === label);
    if (i < 0) throw new Error(`ラベルが見つからない: ${this.scene.id} / ${label}`);
    return i;
  }

  /** 次に表示するものへ進む */
  next(): Step {
    const lines = this.scene.lines;
    while (this.pos < lines.length) {
      const l = lines[this.pos];
      if ('label' in l) {
        // goto で飛んできた直後(started=true で pos がラベル)は素通り。順に到達したときだけ止める設定を見る
        if (this.opts.stopAtLabel && this.started) return { type: 'end' };
        this.pos++;
        continue;
      }
      this.started = true;
      if ('goto' in l) {
        this.pos = this.findLabel(l.goto) + 1;
        continue;
      }
      if ('bg' in l && !('note' in l)) {
        this.opts.onBg?.(l.bg);
        this.pos++;
        continue;
      }
      if ('note' in l) {
        if (l.bg) this.opts.onBg?.(l.bg);
        this.pos++;
        continue;
      }
      if ('figure' in l) {
        this.opts.onFigure?.(l.figure);
        this.pos++;
        continue;
      }
      if (isEffect(l)) {
        this.pos++;
        this.opts.onEffect(l);
        if (l.effect === 'startBattle') return { type: 'end' };
        continue;
      }
      if (isChoice(l)) {
        this.pos++;
        return { type: 'choice', options: l.choice };
      }
      if (isSay(l)) {
        this.pos++;
        this.history.push({ who: l.who, text: l.say });
        return { type: 'say', who: l.who, text: l.say, face: l.face, voiceOnly: l.voiceOnly };
      }
      this.pos++;
    }
    return { type: 'end' };
  }

  /** 選択肢を選んで飛ぶ */
  choose(goto: string): void {
    this.pos = this.findLabel(goto) + 1;
  }

  /** 残りを早送りする。効果は適用し、選択肢は最初の項目を選ぶ */
  skip(): void {
    for (let guard = 0; guard < 500; guard++) {
      const step = this.next();
      if (step.type === 'end') return;
      if (step.type === 'choice') this.choose(step.options[0].goto);
    }
  }
}
