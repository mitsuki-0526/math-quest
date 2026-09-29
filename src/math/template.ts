import type { Rng } from './rng';
import { createRng } from './rng';
import { eq, rat, parseRational, parseRationalList, normalizeInput, toString, type Rational } from './rational';
import { parseFactorization } from './factorization';
import { judgeExpression, parseExpression, polyToTex } from './expr';
import type { FigureSpec } from './figure';
import { validateMath, MATH_VALIDATOR_VERSION } from './quality/mathValidator';
import { judgeProblem } from './quality/judge';
import { validateSpec } from './quality/spec';
import { checkDuplicate } from './quality/duplicateChecker';
import { logGeneration } from './quality/generationLog';

/** 難易度 ★1〜★3(要件 F45) */
export type Difficulty = 1 | 2 | 3;

/**
 * 問題の基準。道中(ふつうの戦闘・ボス)は教科書の練習問題、修練の泉は 大阪府チャレンジテストに合わせる(先生の方針 2026-09-28)。
 * 違いがあるテンプレートだけ 見ればよい(ほとんどは同じ問題を出す)。docs/difficulty.md
 */
export type ProblemBasis = 'textbook' | 'challenge';

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

/** よくある まちがいの 答えと、それを 入れた子への 一言(ピタのせりふ) */
export interface Mistake {
  answer: AnswerSpec;
  say: string;
}

/** 数で答える問題の まちがい(value は 小数・分数も 可) */
export function mistakeNum(value: number | Rational, say: string): Mistake {
  return { answer: { kind: 'number', value: typeof value === 'number' ? numToRat(value) : value }, say };
}

function numToRat(v: number): Rational {
  if (Number.isInteger(v)) return rat(v);
  // 0.5 きざみ・小数第 1 位までの数(絶対値・平均で 使う)
  return rat(Math.round(v * 10), 10);
}

/** 誤答が どの「よくある まちがい」か。当てはまらなければ undefined */
export function diagnose(p: Problem, input: string): string | undefined {
  for (const m of p.mistakes ?? []) if (judge(m.answer, input).correct) return m.say;
  return undefined;
}

function sameAnswer(a: AnswerSpec, b: AnswerSpec): boolean {
  if (a.kind === 'number' && b.kind === 'number') return eq(a.value, b.value);
  if (a.kind === 'choice' && b.kind === 'choice') return a.correct === b.correct;
  if (a.kind === 'numbers' && b.kind === 'numbers') {
    const key = (xs: Rational[]) => xs.map(toString).sort().join(',');
    return key(a.values) === key(b.values);
  }
  return false;
}

/** 正解と 同じ答えになる「まちがい」、同じ答えの 2 つめ以降を 取り除く(数の組み合わせで たまたま 一致する) */
function cleanMistakes(p: Problem): Problem {
  if (!p.mistakes) return p;
  const kept: Mistake[] = [];
  for (const m of p.mistakes) if (!sameAnswer(m.answer, p.answer) && !kept.some((k) => sameAnswer(k.answer, m.answer))) kept.push(m);
  return { ...p, mistakes: kept };
}

export interface Problem {
  templateId: string;
  difficulty: Difficulty;
  /** 問題文(KaTeX)。文章題は日本語 + \text{} を使う */
  prompt: string;
  /** 読み上げ・ログ用の平文 */
  promptText: string;
  answer: AnswerSpec;
  /**
   * 正解の見せ方(TeX)。省略時は答えから作る(分数は分数の形)。
   * 小数の問題の答えを 5.2 のように 小数で見せたいときに使う(判定には 使わない。5.2 も 26/5 も 正解)
   */
  answerLabel?: string;
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
   * よくある まちがい。この答えを 入れた生徒には、正解と 解説の前に その子に合った 一言を 出す
   * (例: (−7) − (−2) に −9 → 「−(−2) は +2」)。正解と 同じ答えのものは 生成のあとで 取り除く
   */
  mistakes?: Mistake[];
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
  /** 道中の 1 戦(地点)で ★3 を出す上限。省略時は config.battle.hardPerBattle だけ。とくに難しいタイプは 1 にする */
  hardPerBattle?: number;
  /** basis を省略したら textbook */
  generate(rng: Rng, difficulty: Difficulty, basis?: ProblemBasis): Problem;
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

/** 1 問を 渡すまでに 作る 候補の 上限 */
export const MAX_GENERATION_ATTEMPTS = 8;

/**
 * 問題を 作って ゲームに 渡す(品質の 仕組み。docs/difficulty.md「問題の品質の 仕組み」):
 *   Generator(テンプレート)→ MathValidator(数学)→ ProblemSpec(仕様の 範囲)→ Judge(教育的な ルール)→ DuplicateChecker(重複)
 * 合格した 問題だけを 返す。不合格は 理由を ログに 残して 作り直す(最大 MAX_GENERATION_ATTEMPTS 回)。
 * どれも 合格しないとき(フォールバック): 重複だけが 理由の 候補が あれば それを(選べる問題が 少ない ★1 など)、
 * なければ ★ を 1 つ 下げて 作り直す。★1 でも だめなら 最後の 候補を 返し「検査なし」と 記録する(問題が 出ないよりは よい)
 * recentShapes: 直近の 問題の 形(数を # に した 問題文)。同じ形が 3 問 続かないように
 */
export function generateProblem(
  templateId: string,
  difficulty: Difficulty,
  recentKeys: readonly string[] = [],
  rng: Rng = createRng(),
  basis: ProblemBasis = 'textbook',
  recentShapes: readonly string[] = [],
): Problem {
  const t = getTemplate(templateId);
  const base = { templateId, difficulty, basis, validatorVersion: MATH_VALIDATOR_VERSION };
  let duplicateOnly: Problem | null = null;
  let last: Problem | null = null;
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    let p: Problem;
    try {
      p = cleanMistakes(t.generate(rng, difficulty, basis));
    } catch (e) {
      logGeneration({ ...base, time: new Date().toISOString(), attempt, accepted: false, reason: 'GENERATOR_ERROR', detail: String(e) });
      continue;
    }
    last = p;
    const r = validateMath(p) ?? validateSpec(p) ?? judgeProblem(p) ?? checkDuplicate(p, { keys: recentKeys, shapes: recentShapes });
    logGeneration({ ...base, time: new Date().toISOString(), attempt, accepted: !r, reason: r?.reason, detail: r?.detail, key: p.key, question: p.promptText });
    if (!r) return p;
    if ((r.reason === 'DUPLICATE' || r.reason === 'SAME_FORM') && !duplicateOnly) duplicateOnly = p;
  }
  const fallback = (p: Problem, kind: 'allow_duplicate' | 'unvalidated') => {
    logGeneration({ ...base, time: new Date().toISOString(), attempt: MAX_GENERATION_ATTEMPTS + 1, accepted: true, fallback: kind, key: p.key, question: p.promptText });
    return p;
  };
  if (duplicateOnly) return fallback(duplicateOnly, 'allow_duplicate');
  if (difficulty > 1) {
    logGeneration({ ...base, time: new Date().toISOString(), attempt: MAX_GENERATION_ATTEMPTS + 1, accepted: true, fallback: 'lower_star' });
    return generateProblem(templateId, (difficulty - 1) as Difficulty, recentKeys, rng, basis, recentShapes);
  }
  if (last) return fallback(last, 'unvalidated');
  throw new Error(`問題を 作れません: ${templateId} ★${difficulty}`);
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
