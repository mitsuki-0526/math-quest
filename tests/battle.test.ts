import { describe, it, expect } from 'vitest';
import '@/data/grade1/problems';
import { createBattle, answer, timeout, continueAfterExplain, continueAfterVictory, useHint, flee, heal, type BattleContext } from '@/engine/battle';
import { getEnemy } from '@/data/grade1/enemies';
import { createRng } from '@/math/rng';
import { toString } from '@/math/rational';
import { primeFactors, factorsToText } from '@/math/factorization';
import type { AnswerSpec } from '@/math/template';

function correctInput(a: AnswerSpec): string {
  switch (a.kind) {
    case 'number':
      return toString(a.value);
    case 'numbers':
      return a.values.map(toString).join(',');
    case 'choice':
      return String(a.correct);
    case 'factorization':
      return factorsToText(primeFactors(a.n));
    case 'expression':
      return a.expected;
  }
}

function ctx(over: Partial<BattleContext> = {}): BattleContext {
  return {
    encounters: [['minus_slime', 'minus_slime'], ['plusminus_bat']],
    getEnemy,
    player: { name: 'テスト', hp: 40, maxHp: 40, attack: 5, defense: 2, timeBonus: 0, expMul: 1 },
    pickDifficulty: () => 1,
    hints: 3,
    rng: createRng(7),
    ...over,
  };
}

describe('battle engine', () => {
  it('出題のたびに turn が増える(同じ問題キーが続いても画面が新しい問題と分かる)', () => {
    const c = ctx();
    let s = createBattle(c);
    expect(s.turn).toBe(1);
    const turns = [s.turn];
    for (let i = 0; i < 6 && s.phase !== 'nodeClear'; i++) {
      if (s.phase === 'question') s = timeout(s, c);
      else if (s.phase === 'explain') s = continueAfterExplain(s, c);
      else if (s.phase === 'victory') s = continueAfterVictory(s, c);
      if (s.phase === 'question') turns.push(s.turn);
    }
    expect(turns.length).toBeGreaterThan(1);
    for (let i = 1; i < turns.length; i++) expect(turns[i]).toBe(turns[i - 1] + 1);
  });

  it('開始時に最初の戦闘の敵が並び、問題が出ている', () => {
    const s = createBattle(ctx());
    expect(s.enemies).toHaveLength(2);
    expect(s.phase).toBe('question');
    expect(s.problem).not.toBeNull();
    expect(s.timeLimit).toBeGreaterThan(0);
    expect(s.log[0]).toContain('マイナススライム×2');
  });

  it('正解すると出題者にダメージ、全滅で victory、次の戦闘へ、最後は nodeClear', () => {
    const c = ctx();
    let s = createBattle(c);
    let guard = 0;
    while (s.phase !== 'nodeClear' && guard++ < 100) {
      if (s.phase === 'question') {
        const before = s.enemies.find((e) => e.key === s.targetKey)!.hp;
        s = answer(s, correctInput(s.problem!.answer), 1, c);
        const after = s.enemies.find((e) => e.key === s.last!.targetKey)!.hp;
        expect(after).toBeLessThan(before);
        expect(s.last!.correct).toBe(true);
      } else if (s.phase === 'victory') {
        s = continueAfterVictory(s, c);
      }
    }
    expect(s.phase).toBe('nodeClear');
    expect(s.totals.correct).toBe(s.totals.asked);
    expect(s.totals.exp).toBeGreaterThan(0);
    expect(s.totals.gold).toBe(5 + 5 + 6);
    expect(s.player.hp).toBe(40);
  });

  it('誤答すると被弾して explain、解説を閉じると次の問題', () => {
    const c = ctx();
    let s = createBattle(c);
    s = answer(s, '99999', 5, c);
    expect(s.phase).toBe('explain');
    expect(s.player.hp).toBe(40 - (6 - 2));
    expect(s.streak).toBe(0);
    expect(s.last!.correct).toBe(false);
    s = continueAfterExplain(s, c);
    expect(s.phase).toBe('question');
    expect(s.problem).not.toBeNull();
  });

  it('時間切れは誤答扱いで、メッセージが変わる', () => {
    const c = ctx();
    let s = createBattle(c);
    s = timeout(s, c);
    expect(s.phase).toBe('explain');
    expect(s.last!.timeout).toBe(true);
    expect(s.log.some((l) => l.includes('時間切れ'))).toBe(true);
  });

  it('連続正解でダメージ倍率が上がる', () => {
    const c = ctx({ encounters: [['king_nega']], isBoss: true });
    let s = createBattle(c);
    const damages: number[] = [];
    for (let i = 0; i < 5 && s.phase === 'question'; i++) {
      s = answer(s, correctInput(s.problem!.answer), 100, c); // ゆっくり答える(会心なし)
      damages.push(s.last!.damage);
    }
    expect(damages[0]).toBe(damages[1]);
    expect(damages[2]).toBeGreaterThan(damages[1]); // 3連続で ×1.5
    expect(damages[4]).toBeGreaterThan(damages[2]); // 5連続で ×2
  });

  it('速く答えると会心', () => {
    const c = ctx();
    let s = createBattle(c);
    s = answer(s, correctInput(s.problem!.answer), 1, c);
    expect(s.last!.quick).toBe(true);
  });

  it('HP が 0 になると defeat', () => {
    const c = ctx({ player: { name: 'T', hp: 3, maxHp: 40, attack: 5, defense: 0, timeBonus: 0, expMul: 1 } });
    let s = createBattle(c);
    s = answer(s, 'x', 1, c);
    expect(s.phase).toBe('defeat');
    expect(s.player.hp).toBe(0);
  });

  it('ヒントは回数を消費し、同じ問題では二重に消費しない。使った問題の経験値は半分', () => {
    const c = ctx();
    let s = createBattle(c);
    const r1 = useHint(s);
    expect(r1.hint).toBe(s.problem!.hint);
    expect(r1.state.hintsLeft).toBe(2);
    const r2 = useHint(r1.state);
    expect(r2.state.hintsLeft).toBe(2);
    s = answer(r2.state, correctInput(r2.state.problem!.answer), 100, c);
    expect(s.last!.expGain).toBe(5); // ★1 は 10 の半分
  });

  it('雑魚戦は逃げられ、ボス戦は逃げられない', () => {
    expect(flee(createBattle(ctx())).phase).toBe('fled');
    const boss = createBattle(ctx({ encounters: [['king_nega']], isBoss: true }));
    expect(flee(boss).phase).toBe('question');
  });

  it('ボスはフェーズで出題テンプレートが変わる', () => {
    const c = ctx({ encounters: [['king_nega']], isBoss: true, pickDifficulty: () => 3 });
    let s = createBattle(c);
    expect(s.problem!.templateId).toBe('g1.sign.addsub_big');
    // HP を直接 削って フェーズ3 相当に
    s = { ...s, enemies: [{ ...s.enemies[0], hp: 40 }] };
    const seen = new Set<string>();
    for (let i = 0; i < 12 && s.phase === 'question'; i++) {
      s = answer(s, 'wrong', 1, c);
      if (s.phase === 'explain') s = continueAfterExplain(s, c);
      if (s.problem) seen.add(s.problem.templateId);
      if (s.phase === 'defeat') break;
    }
    expect([...seen].every((t) => t === 'g1.sign.numberline' || t === 'g1.sign.mixed')).toBe(true);
  });

  it('回復は最大 HP を超えない', () => {
    const c = ctx();
    let s = createBattle(c);
    s = answer(s, 'x', 1, c);
    s = heal(s, 100, '薬草');
    expect(s.player.hp).toBe(40);
  });
});

describe('ボス戦の演出', () => {
  it('フェーズが進むと開始セリフが出て、3連続正解でうろたえる', () => {
    const c = ctx({ encounters: [['king_nega']], isBoss: true });
    let s = createBattle(c);
    const lines: string[] = [];
    for (let i = 0; i < 12 && s.phase === 'question'; i++) {
      s = answer(s, correctInput(s.problem!.answer), 100, c);
      lines.push(...s.log);
    }
    const all = lines.join('\n');
    expect(all).toContain('ならば かけ算だ');
    expect(all).toContain('な、なぜ 当たる');
  });
});
