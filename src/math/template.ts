import type { Rng } from './rng';
import { createRng } from './rng';
import { eq, parseRational, parseRationalList, normalizeInput, toString, type Rational } from './rational';
import { parseFactorization } from './factorization';
import { judgeExpression, parseExpression, polyToTex } from './expr';
import type { FigureSpec } from './figure';

/** 難易度 ★1〜★3(要件 F45) */
export type Difficulty = 1 | 2 | 3;

/**
 * 答えの形式。判定(judge)と入力UI(パレットのキー構成)はこれで決まる。
 * expression(式入力)は M5 で追加する。
 */
export type AnswerSpec =
  | { kind: 'number'; value: Rational }
  /** 複数の値。ordered なら入力の順番も一致が必要(座標など)。既定は順不同(絶対値の2解など) */
  | { kind: 'numbers'; values: Rational[]; ordered?: boolean }
  | { kind: 'choice'; options: string[]; correct: number }
  | { kind: 'factorization'; n: number }
  /** 式入力(要件 F44)。expected は正規形にして比較するので書き方は自由 */
  | { kind: 'expression'; expected: string };

export type AnswerKind = AnswerSpec['kind'];

export interface Problem {
  templateId: string;
  difficulty: Difficulty;
  /** 問題文(KaTeX)。文章題は日本語 + \text{} を使う */
  prompt: string;
  /** 読み上げ・ログ用の平文 */
  promptText: string;
  answer: AnswerSpec;
  /** ヒント(最初の一手だけ。答えは言わない) */
  hint: string;
  /** 解説(途中式)。1要素 = 1行。KaTeX */
  explanation: string[];
  /** つまずきの種類(苦手集計用)。誤答時に stats.weakTags に入る */
  tags: string[];
  /** 同じ問題の再出題を避けるためのキー */
  key: string;
  /** 図(数直線・座標平面など)。SVG で描く(要件 F48) */
  figure?: FigureSpec;
  /**
   * 検証用: 別の方法で答えを計算する JS 式(テスト専用、UI では使わない)。
   * number/numbers は数値(配列)、choice は正解選択肢の数値、factorization は n を返す式。
   */
  verify: string;
}

export interface ProblemTemplate {
  id: string;
  /** 単元(教科書の章名) */
  unit: string;
  /** 出題タイプの名前(敵の名前ではなく数学側の名前) */
  title: string;
  /** 難易度ごとの制限時間の目安(秒)。M2 で config に外出しする */
  timeLimit: Record<Difficulty, number>;
  generate(rng: Rng, difficulty: Difficulty): Problem;
}

/** 登録済みテンプレート。各学年のデータファイルが register() で追加する。 */
const registry = new Map<string, ProblemTemplate>();

export function registerTemplate(t: ProblemTemplate): void {
  // 開発時の HMR でモジュールが再評価されると同じ ID が来るので、上書きにする(本番では起きない)
  if (registry.has(t.id) && !import.meta.env?.DEV) throw new Error(`テンプレートIDが重複: ${t.id}`);
  registry.set(t.id, t);
}

export function getTemplate(id: string): ProblemTemplate {
  const t = registry.get(id);
  if (!t) throw new Error(`テンプレートが未登録: ${id}`);
  return t;
}

export function allTemplates(): ProblemTemplate[] {
  return [...registry.values()];
}

/**
 * 直近に出した問題のキーを避けて生成する(要件 F40)。
 * 何度試しても重複するテンプレート(選択肢が少ない ★1 など)は諦めて返す。
 */
export function generateProblem(
  templateId: string,
  difficulty: Difficulty,
  recentKeys: readonly string[] = [],
  rng: Rng = createRng(),
): Problem {
  const t = getTemplate(templateId);
  let p = t.generate(rng, difficulty);
  for (let i = 0; i < 8 && recentKeys.includes(p.key); i++) p = t.generate(rng, difficulty);
  return p;
}

export interface Judgement {
  correct: boolean;
  /** 不正解のときの短い補足(「書き方」の指摘など)。正解のときは undefined */
  note?: string;
}

/** 生徒の入力を答えの形式に合わせて判定する(要件 F41 F42 F43)。 */
export function judge(answer: AnswerSpec, input: string): Judgement {
  switch (answer.kind) {
    case 'number': {
      const r = parseRational(input);
      if (!r) return { correct: false, note: noteForUnparsable(input) };
      return { correct: eq(r, answer.value) };
    }
    case 'numbers': {
      const list = parseRationalList(input);
      if (!list) return { correct: false, note: '数を「,」で区切って入れよう' };
      if (list.length !== answer.values.length) {
        return { correct: false, note: `答えは ${answer.values.length} つあるよ` };
      }
      if (answer.ordered) {
        const ok = list.every((v, i) => eq(v, answer.values[i]));
        if (ok) return { correct: true };
        // 順番を逆にすれば合う場合は、そう伝える
        const swapped = list.length === 2 && eq(list[0], answer.values[1]) && eq(list[1], answer.values[0]);
        return { correct: false, note: swapped ? '数は 合ってる! でも 順番が 逆。x座標が 先だよ' : undefined };
      }
      const rest = [...answer.values];
      for (const v of list) {
        const i = rest.findIndex((x) => eq(x, v));
        if (i < 0) return { correct: false };
        rest.splice(i, 1);
      }
      return { correct: true };
    }
    case 'choice': {
      const idx = Number(normalizeInput(input));
      return { correct: Number.isInteger(idx) && idx === answer.correct };
    }
    case 'factorization': {
      const f = parseFactorization(input);
      if (!f) return { correct: false, note: '「2×2×3」や「2^2×3」の形で入れよう' };
      if (f.product !== answer.n) return { correct: false };
      if (!f.allPrime) return { correct: false, note: '積は合ってる! でも 素数まで 分けきろう' };
      return { correct: true };
    }
    case 'expression':
      return judgeExpression(answer.expected, input);
  }
}

function noteForUnparsable(input: string): string | undefined {
  const s = normalizeInput(input);
  if (!s) return '答えを 入れてから こうげき!';
  if (/[+*]/.test(s) || /\d-\d/.test(s)) return '式ではなく、計算した 答えを 入れよう';
  if (/\/0$/.test(s)) return '分母は 0 に できないよ';
  return undefined;
}

/** 答えを表示用の文字列にする(解説・ログ用) */
export function answerToText(answer: AnswerSpec): string {
  switch (answer.kind) {
    case 'number':
      return toString(answer.value);
    case 'numbers':
      return answer.values.map(toString).join(', ');
    case 'choice':
      return answer.options[answer.correct];
    case 'factorization':
      return String(answer.n);
    case 'expression': {
      const p = parseExpression(answer.expected);
      return p ? polyToTex(p) : answer.expected;
    }
  }
}
