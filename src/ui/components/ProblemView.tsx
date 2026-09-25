import { answerToText, type Problem } from '@/math/template';
import { Tex, ProseTex } from './Tex';

/** 文章の多い問題(文章題・表の問題など)は、折り返せるように本文の文字で描く */
export function isProse(p: Problem): boolean {
  return p.promptText.length > 30;
}

/** 問題文(戦闘画面・見本帳で共通) */
export function ProblemPrompt({ problem }: { problem: Problem }) {
  return isProse(problem) ? <ProseTex tex={problem.prompt} /> : <Tex tex={problem.prompt} />;
}

/** 答えを TeX で(選択式は正解の選択肢、素因数分解は解説の最後の行) */
export function answerTex(p: Problem): string {
  const a = p.answer;
  if (a.kind === 'choice') return a.options[a.correct];
  if (a.kind === 'factorization') return p.explanation[p.explanation.length - 1].replace(/^\\text\{答え: \}\s*/, '');
  return answerToText(a).replace(/(-?\d+)\/(\d+)/g, '\\frac{$1}{$2}');
}
