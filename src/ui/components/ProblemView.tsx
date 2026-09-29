import { answerToText, type Problem } from '@/math/template';
import { parseRational, parseRationalList, toTex } from '@/math/rational';
import { parseExpression, polyToTex } from '@/math/expr';
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
  if (p.answerLabel) return p.answerLabel;
  const a = p.answer;
  if (a.kind === 'choice') return a.options[a.correct];
  if (a.kind === 'factorization') return p.explanation[p.explanation.length - 1].replace(/^\\text\{答え: \}\s*/, '');
  return answerToText(a).replace(/(-?\d+)\/(\d+)/g, '\\frac{$1}{$2}');
}

/** 生徒が 入れた答えを TeX で(解説で 正解と 並べる)。読めない入力は そのまま 文字で */
export function givenTex(p: Problem, input: string): string {
  const raw = input.trim();
  if (!raw) return '\\text{(空らん)}';
  const a = p.answer;
  if (a.kind === 'choice') return a.options[Number(raw)] ?? `\\text{${raw}}`;
  if (a.kind === 'number') {
    const r = parseRational(raw);
    if (r) return toTex(r);
  }
  if (a.kind === 'numbers') {
    const rs = parseRationalList(raw);
    if (rs) return rs.map(toTex).join(',\\ ');
  }
  if (a.kind === 'expression') {
    const e = parseExpression(raw);
    if (e) return polyToTex(e);
  }
  return `\\text{${raw.replace(/[{}\\]/g, '')}}`;
}
