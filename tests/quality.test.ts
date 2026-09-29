import { describe, it, expect, beforeEach } from 'vitest';
import '@/data/grade1/problems';
import { allTemplates, generateProblem, registerTemplate, type Problem, type Difficulty } from '@/math/template';
import { rat } from '@/math/rational';
import { createRng } from '@/math/rng';
import { validateMath } from '@/math/quality/mathValidator';
import { judgeProblem, addTeacherRejected } from '@/math/quality/judge';
import { checkDuplicate, shapeOf } from '@/math/quality/duplicateChecker';
import { clearGenerationLog, getGenerationLog, summarizeGeneration, formatSummary } from '@/math/quality/generationLog';

/**
 * 問題の 品質の 仕組み(Generator → MathValidator → Judge → DuplicateChecker → ゲーム。不合格は ログへ)。
 * docs/difficulty.md「問題の品質の 仕組み」
 */

/** 正しい 問題の ひな形(1 か所ずつ 壊して、検査が 気づくかを 見る) */
const good = (over: Partial<Problem> = {}): Problem => ({
  templateId: 'test.good',
  difficulty: 1,
  prompt: '(-7) - (-2) = ?',
  promptText: '(−7) − (−2) = ?',
  answer: { kind: 'number', value: rat(-5) },
  hint: 'ひく数の 符号を 変えて たし算に',
  explanation: ['-7 + 2 = -5', '\\text{答え: } -5'],
  tags: [],
  key: 'good:1',
  verify: '(-7)-(-2)',
  ...over,
});

describe('MathValidator(数学の 検査)', () => {
  it('今の すべての テンプレートは 数学の 検査と Judge に 通る(★1〜3 各 300 問。重複だけは 除く)', () => {
    clearGenerationLog();
    for (const t of allTemplates()) {
      if (t.id.startsWith('test.')) continue;
      for (const d of [1, 2, 3] as const) for (let i = 0; i < 300; i++) generateProblem(t.id, d, [], createRng(13 * (i + 1) + d));
    }
    const bad = getGenerationLog().filter((e) => !e.accepted && e.reason !== 'DUPLICATE' && e.reason !== 'SAME_FORM');
    expect(bad.slice(0, 5).map((e) => `${e.templateId} ★${e.difficulty} ${e.reason}: ${e.detail}`)).toEqual([]);
  });

  it('壊れた 問題を 見つける', () => {
    expect(validateMath(good())).toBeNull();
    expect(validateMath(good({ explanation: ['\\text{答え: } -9'] }))?.reason).toBe('ANSWER_MISMATCH');
    expect(validateMath(good({ promptText: '(−7) − (NaN) = ?' }))?.reason).toBe('BROKEN_TEXT');
    expect(validateMath(good({ hint: 'x は undefined' }))?.reason).toBe('BROKEN_TEXT');
    // TS で '\\text' を '\text' と 書くと タブ文字に なる(実際に あった まちがい)
    expect(validateMath(good({ explanation: ['\text{答え: } -5'] }))?.reason).toBe('BROKEN_TEXT');
    expect(validateMath(good({ answer: { kind: 'choice', options: ['1', '1'], correct: 0 } }))?.reason).toBe('INVALID_CHOICE');
    expect(validateMath(good({ answer: { kind: 'choice', options: ['1', '2'], correct: 2 } }))?.reason).toBe('INVALID_CHOICE');
    expect(validateMath(good({ answer: { kind: 'expression', expected: '3x+(' } }))?.reason).toBe('INVALID_EXPRESSION');
    expect(validateMath(good({ mistakes: [{ answer: { kind: 'number', value: rat(-5) }, say: 'x' }] }))?.reason).toBe('MISTAKE_EQUALS_ANSWER');
    // 分数・小数の 答えの 行も 読める
    expect(validateMath(good({ answer: { kind: 'number', value: rat(-11, 12) }, explanation: ['\\text{答え: } -\\frac{11}{12}'] }))).toBeNull();
    expect(validateMath(good({ answer: { kind: 'number', value: rat(52, 10) }, explanation: ['\\text{答え: } 5.2'] }))).toBeNull();
  });
});

describe('Judge(教育的な ルール)', () => {
  it('未習の 記号・係数の 分母の 文字・先生の × を 見つける', () => {
    expect(judgeProblem(good({ promptText: '|−7| = ?' }))?.reason).toBe('OUT_OF_SCOPE');
    expect(judgeProblem(good({ templateId: 'g1.expr.collect', explanation: ['\\frac{3}{x} + 1'] }))?.reason).toBe('OUT_OF_SCOPE');
    // 文字式で 表す 問題(model)は 4/x で よい(先生の方針 2026-09-28)
    expect(judgeProblem(good({ templateId: 'g1.expr.model', explanation: ['\\frac{4}{x}'] }))).toBeNull();
    addTeacherRejected({ 'good:bad-one': '文が 不自然' });
    expect(judgeProblem(good({ key: 'good:bad-one' }))?.reason).toBe('TEACHER_REJECTED');
  });
});

describe('DuplicateChecker(重複)', () => {
  it('直近の 同じ問題、同じ形の 3 連続を 見つける', () => {
    const p = good();
    expect(checkDuplicate(p, { keys: ['good:1'], shapes: [] })?.reason).toBe('DUPLICATE');
    expect(shapeOf(p)).toBe('(#) − (#) = ?');
    // 形が 1 つしかない テンプレートでは 見ない(「N を 素因数分解せよ」は 同じ形で 当たり前)
    expect(checkDuplicate(p, { keys: [], shapes: [shapeOf(p), shapeOf(p)] })).toBeNull();
    // 別の 形も 作れる テンプレートなら、同じ形の 3 連続を 見つける
    checkDuplicate(good({ promptText: '(−7) + (−2) + (−1) = ?' }), { keys: [], shapes: [] });
    expect(checkDuplicate(p, { keys: [], shapes: [shapeOf(p), shapeOf(p)] })?.reason).toBe('SAME_FORM');
    expect(checkDuplicate(p, { keys: [], shapes: [shapeOf(p)] })).toBeNull();
  });
});

describe('生成の 流れ(作り直し・代わり・ログ)', () => {
  // 流れを 確かめるための テンプレート: ★3 は 必ず 文字化け、★2 は 正しい、★1 は 解説の 答えが 食い違う
  registerTemplate({
    id: 'test.flaky',
    unit: 'テスト',
    title: 'テスト',
    timeLimit: { 1: 30, 2: 30, 3: 30 },
    generate: (rng, d: Difficulty) => {
      const n = rng.int(1, 999);
      if (d === 3) return good({ templateId: 'test.flaky', difficulty: d, promptText: `${n} NaN`, key: `f:${n}` });
      if (d === 1) return good({ templateId: 'test.flaky', difficulty: d, explanation: ['\\text{答え: } 1'], key: `f:${n}` });
      return good({ templateId: 'test.flaky', difficulty: d, promptText: `(−${n}) − (−2) = ?`, key: `f:${n}` });
    },
  });
  beforeEach(() => clearGenerationLog());

  it('どれも 合格しなければ ★ を 下げて 作り直し、理由を ログに 残す', () => {
    const p = generateProblem('test.flaky', 3, [], createRng(1));
    expect(p.difficulty).toBe(2);
    const s = summarizeGeneration(getGenerationLog());
    expect(s.byReason.BROKEN_TEXT).toBe(8);
    expect(getGenerationLog().some((e) => e.fallback === 'lower_star')).toBe(true);
    expect(formatSummary(s)).toMatch(/BROKEN_TEXT/);
  });

  it('★1 でも 合格しなければ 最後の 候補を「検査なし」として 返す(問題が 出ないよりは よい)', () => {
    const p = generateProblem('test.flaky', 1, [], createRng(2));
    expect(p).toBeTruthy();
    expect(getGenerationLog().at(-1)?.fallback).toBe('unvalidated');
    expect(summarizeGeneration().byReason.ANSWER_MISMATCH).toBe(8);
  });

  it('ログには 個人情報を 入れない(問題と 理由だけ)', () => {
    generateProblem('g1.sign.addsub', 2, [], createRng(3));
    const keys = new Set(getGenerationLog().flatMap((e) => Object.keys(e)));
    for (const k of keys) expect(['time', 'templateId', 'difficulty', 'basis', 'attempt', 'accepted', 'reason', 'detail', 'fallback', 'key', 'question', 'validatorVersion']).toContain(k);
  });
});
