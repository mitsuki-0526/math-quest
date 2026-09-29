/**
 * 問題を 採用しなかった 理由の 分類(品質の 仕組み。docs/difficulty.md「問題の品質の 仕組み」)。
 * ログと 品質レポートで 数えて、どこを 直せば よいかを 見つける。あとで 良問/悪問の 分類に 使えるよう、コードで 残す
 */
export type RejectReason =
  /** 問題を 作る プログラムが 例外を 出した */
  | 'GENERATOR_ERROR'
  /** 答えが 数として 成り立たない(未定義・無限・空の 答え) */
  | 'INVALID_ANSWER'
  /** 解説の「答え」と 正解が 食い違う */
  | 'ANSWER_MISMATCH'
  /** 選択肢が 重複している・正解の 番号が 範囲外 */
  | 'INVALID_CHOICE'
  /** 式の 答えが 式として 読めない */
  | 'INVALID_EXPRESSION'
  /** 文字化け(NaN・undefined・タブ文字 など) */
  | 'BROKEN_TEXT'
  /** 「よくある まちがい」が 正解と 同じ */
  | 'MISTAKE_EQUALS_ANSWER'
  /** 仕様(ProblemSpec)の 数の 範囲・形から はみ出した */
  | 'SPEC_VIOLATION'
  /** 未習の 記号・内容を 使っている(絶対値の記号、係数の分母に文字 など) */
  | 'OUT_OF_SCOPE'
  /** 先生の 一括判定で × になった 問題と 同じ */
  | 'TEACHER_REJECTED'
  /** 直近に 出した 問題と 同じ */
  | 'DUPLICATE'
  /** 数だけ ちがう 同じ形の 問題が 続く(3 問 連続) */
  | 'SAME_FORM'
  | 'OTHER';

export const REJECT_LABEL: Record<RejectReason, string> = {
  GENERATOR_ERROR: '生成の例外',
  INVALID_ANSWER: '答えが成り立たない',
  ANSWER_MISMATCH: '解説と答えの食い違い',
  INVALID_CHOICE: '選択肢の不備',
  INVALID_EXPRESSION: '式が読めない',
  BROKEN_TEXT: '文字化け',
  MISTAKE_EQUALS_ANSWER: 'まちがい例が正解と同じ',
  SPEC_VIOLATION: '仕様の範囲外',
  OUT_OF_SCOPE: '未習の内容',
  TEACHER_REJECTED: '先生の判定で ×',
  DUPLICATE: '重複',
  SAME_FORM: '同じ形が続く',
  OTHER: 'その他',
};

/** 検査の 結果(不合格なら 理由と くわしい 説明) */
export interface Rejection {
  reason: RejectReason;
  detail: string;
}

export const reject = (reason: RejectReason, detail: string): Rejection => ({ reason, detail });
