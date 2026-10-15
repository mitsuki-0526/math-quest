import { describe, it, expect } from 'vitest';
import '@/data/grade1/problems';
import { generateProblem, judge, type Difficulty, type Problem, type ProblemBasis } from '@/math/template';
import { toNumber } from '@/math/rational';
import { createRng } from '@/math/rng';
import { getEnemy } from '@/data/grade1/enemies';
import { nodeDifficulty } from '@/engine/adaptive';
import { grade1 } from '@/data/grade1/chapters';
import type { NumberLineSpec, TableSpec } from '@/math/figure';

/**
 * 問題の難易度の仕様(docs/difficulty.md)を固定する。
 * 教科書・大阪府チャレンジテストを基準に決めた範囲から、生成した問題がはみ出さないことを確かめる。
 * 仕様を変えるときは、docs/difficulty.md とこのテストを いっしょに直す
 */
const N = 400;

function each(templateId: string, d: Difficulty, check: (p: Problem) => void, basis: ProblemBasis = 'textbook') {
  // 乱数の種を毎回変える(省略すると現在時刻が種になり、同じ問題ばかりになる)
  for (let i = 0; i < N; i++) check(generateProblem(templateId, d, [], createRng(7919 * (i + 1)), basis));
}
/** 問題文に出てくる数(符号なし) */
const numbersIn = (p: Problem) => (p.promptText.match(/\d+(\.\d+)?/g) ?? []).map(Number);
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const answerOf = (p: Problem) => (p.answer.kind === 'number' ? toNumber(p.answer.value) : NaN);

describe('第1章 正の数と負の数', () => {
  it('加減(先生の印 2026-09-27、2 けたは 授業の プリントで 2026-10-02): ★1 は 1 けたの 2 項、★2 は かっこつき 3 項が基本・2 けたは 半分ほど(30 まで)、★3 は 3〜4 項(35 まで)', () => {
    const spec = { 1: { terms: [2], max: 9, bigs: 0 }, 2: { terms: [2, 3], max: 30, bigs: 1 }, 3: { terms: [3, 4], max: 35, bigs: 2 } } as const;
    for (const d of [1, 2, 3] as const) {
      let zero = 0;
      let paren = 0;
      let withBig = 0;
      let total = 0;
      each('g1.sign.addsub', d, (p) => {
        if (p.tags.some((t) => t.startsWith('decimal') || t.startsWith('fraction'))) return;
        const nums = numbersIn(p);
        expect(spec[d].terms, p.promptText).toContain(nums.length);
        expect(Math.max(...nums), p.promptText).toBeLessThanOrEqual(spec[d].max);
        expect(nums.filter((n) => n >= 10).length, p.promptText).toBeLessThanOrEqual(spec[d].bigs);
        if (nums.includes(0)) zero++;
        if (p.promptText.startsWith('(')) paren++;
        if (nums.some((n) => n >= 10)) withBig++;
        total++;
      });
      // 0 を含む式も出る(教科書の (−4) + 0、0 − (−3))
      expect(zero, `★${d}`).toBeGreaterThan(0);
      // ★2 は かっこつき 3 項が基本
      if (d === 2) expect(paren, '★2 の かっこつき').toBeGreaterThan(N / 2);
      // ★2 は 2 けたを ふくむ 問題が 4〜6 割(授業の プリントは 4〜5 割)
      if (d === 2) {
        expect(withBig / total, '★2 の 2 けた').toBeGreaterThan(0.4);
        expect(withBig / total, '★2 の 2 けた').toBeLessThan(0.6);
      }
    }
    // ★1・★2 の かっこの中の 正の数は (+7) と符号つき
    for (const d of [1, 2] as const) {
      each('g1.sign.addsub', d, (p) => {
        if (/\(\d/.test(p.promptText)) throw new Error(`符号のない かっこ: ${p.promptText}`);
      });
    }
    expect(getEnemy('king_nega').phases![0].templates).toEqual(['g1.sign.addsub_big']);
  });

  it('乗除: ★2 は わり算だけ(わられる数 81 まで。5 回に 1 回は 逆数)。★3 は答えが整数(分数の乗除を除く)', () => {
    let reciprocals = 0;
    each('g1.sign.muldiv', 2, (p) => {
      if (p.tags.includes('reciprocal')) {
        // 逆数: かけて 1。符号は そのまま
        reciprocals++;
        const x = p.promptText.replace(/ の 逆数は\?$/, '').replace('−', '-');
        const [n, dd] = x.includes('/') ? x.split('/').map(Number) : [Number(x), 1];
        expect(Math.abs((n / dd) * answerOf(p) - 1), p.promptText).toBeLessThan(1e-9);
        return;
      }
      expect(p.promptText, p.promptText).toContain('÷');
      expect(p.promptText, p.promptText).not.toContain('×');
      expect(numbersIn(p)[0], p.promptText).toBeLessThanOrEqual(81);
    });
    expect(reciprocals).toBeGreaterThan(N / 10);
    expect(reciprocals).toBeLessThan(N / 3);
    let fractions = 0;
    let laws = 0;
    each('g1.sign.muldiv', 3, (p) => {
      if (p.tags.includes('mul_law')) {
        // 工夫する かけ算: 3 数(組を 入れかえると 整数)。答えは 整数
        laws++;
        expect(p.promptText.split('×'), p.promptText).toHaveLength(3);
        expect(Number.isInteger(answerOf(p)), p.promptText).toBe(true);
        return;
      }
      if (p.tags.includes('fraction_muldiv')) {
        // 分数の乗除: 答えは 約分して 分子・分母とも 20 以下
        fractions++;
        const v = (p.answer as { value: { n: bigint; d: bigint } }).value;
        expect(Math.abs(Number(v.n)), p.promptText).toBeLessThanOrEqual(20);
        expect(Number(v.d), p.promptText).toBeLessThanOrEqual(20);
        return;
      }
      // 符号だけを 判断する 選択問題(負の数は 2〜4 個。数えて 決める)
      if (p.tags.includes('sign_judge')) {
        const negs = (p.promptText.match(/−\d/g) ?? []).length;
        expect(negs, p.promptText).toBeGreaterThanOrEqual(2);
        return;
      }
      expect(Number.isInteger(answerOf(p)), p.promptText).toBe(true);
      expect(Math.abs(answerOf(p)), p.promptText).toBeLessThanOrEqual(360);
    });
    expect(fractions).toBeGreaterThan(N / 8);
    expect(laws).toBeGreaterThan(N / 20);
  });

  it('各章の 最初の戦闘は ★1 まで、2 つめは ★2 まで', () => {
    for (const c of grade1.chapters) {
      const battles = c.nodes.filter((n) => n.type === 'battle');
      if (battles.length === 0) continue;
      expect(battles[0].maxStar, `${c.id}.${battles[0].id}`).toBe(1);
      if (battles[1]) expect(battles[1].maxStar, `${c.id}.${battles[1].id}`).toBe(2);
    }
  });

  it('地点の ★: 上限(maxStar)と 出題タイプごとの 下限(minStars)。草原の道では 代入を ★2 から 出す(先生の要望 2026-10-13)', () => {
    const road = grade1.chapters.find((c) => c.id === 'g1c2')!.nodes.find((n) => n.id === 'road2')!;
    expect(nodeDifficulty(1, road, 'g1.expr.subst')).toBe(2);
    expect(nodeDifficulty(3, road, 'g1.expr.subst')).toBe(2);
    // ほかの 出題タイプは 生徒の ★ の まま(上限は 2)
    expect(nodeDifficulty(1, road, 'g1.expr.collect')).toBe(1);
    // 下限は 上限を こえない
    expect(nodeDifficulty(1, { maxStar: 1, minStars: { t: 3 } }, 't')).toBe(1);
    expect(nodeDifficulty(2, undefined, 't')).toBe(2);
    // 草原の道に 代入の 敵(文字の妖精エックス)が いる
    expect(road.enemies!.flat().map((e) => getEnemy(e).template)).toContain('g1.expr.subst');
  });

  it('絶対値: 記号 |−7| は使わず 文で聞く(中学校では 教えない)。★3 の「絶対値が a」は 10 まで', () => {
    for (const d of [1, 2, 3] as const) each('g1.sign.abs', d, (p) => expect(p.promptText, p.promptText).not.toContain('|'));
    each('g1.sign.abs', 3, (p) => {
      const m = p.promptText.match(/絶対値が (\d+)/);
      if (m) expect(Number(m[1]), p.promptText).toBeLessThanOrEqual(10);
    });
  });

  it('四則混合: ★1 は 累乗だけ(3 乗は 3 まで。4 回に 1 回は 累乗で 表す 選択式)、★2 は ×が先・かっこが先(1けた、答えは 54 まで)。★3 は 20 までの数で、答えは整数(分配法則の 工夫を 除く)', () => {
    let notations = 0;
    each('g1.sign.mixed', 1, (p) => {
      expect(p.tags, p.promptText).toHaveLength(1);
      expect(p.tags[0], p.promptText).toMatch(/power/);
      if (p.tags[0] === 'power_notation') {
        notations++;
        expect(p.answer.kind, p.promptText).toBe('choice');
        return;
      }
      if (p.promptText.includes('³')) expect(Math.max(...numbersIn(p)), p.promptText).toBeLessThanOrEqual(3);
    });
    expect(notations).toBeGreaterThan(N / 8);
    expect(notations).toBeLessThan(N / 2.5);
    const tags2 = new Set<string>();
    each('g1.sign.mixed', 2, (p) => {
      p.tags.forEach((t) => tags2.add(t));
      expect(Math.max(...numbersIn(p)), p.promptText).toBeLessThanOrEqual(10);
      expect(Math.abs(answerOf(p)), p.promptText).toBeLessThanOrEqual(54);
    });
    expect([...tags2].sort()).toEqual(['order_of_operations', 'parentheses_first']);
    let dists = 0;
    each('g1.sign.mixed', 3, (p) => {
      expect(Number.isInteger(answerOf(p)), p.promptText).toBe(true);
      if (p.tags.includes('distributive')) {
        // 分配法則の 工夫: 分数は 分母の 公倍数を かける / まとめると 100・10・20 に なる
        dists++;
        return;
      }
      expect(Math.max(...numbersIn(p)), p.promptText).toBeLessThanOrEqual(20);
    });
    expect(dists).toBeGreaterThan(N / 10);
  });

  it('素因数分解: ★1 は 40 まで、★2 は 42〜99 で 素因数 3 つまで(11・13 も。★1 と重ならない)、★3 は 300 まで', () => {
    const factorCount = (n: number) => {
      let c = 0;
      for (let q = 2, m = n; m > 1; ) if (m % q === 0) (m /= q), c++;
      else q++;
      return c;
    };
    for (const d of [1, 2, 3] as const) {
      each('g1.sign.primefactor', d, (p) => {
        const n = (p.answer as { n: number }).n;
        expect(n).toBeLessThanOrEqual(d === 1 ? 40 : d === 2 ? 99 : 300);
        if (d === 2) {
          expect(n, `${n}`).toBeGreaterThanOrEqual(42);
          expect(factorCount(n), `${n}`).toBeLessThanOrEqual(3);
        }
        let m = n;
        for (const q of [2, 3, 5, 7]) while (m % q === 0) m /= q;
        expect(d === 1 ? [1] : [1, 11, 13], `${n}`).toContain(m);
      });
    }
  });

  it('数直線: −10〜10 で、図の点は 数が書いてある目盛り(0・±5・±10)に 置かない(先生の試遊 2026-09-28)', () => {
    for (const d of [1, 2, 3] as const)
      each('g1.sign.numberline', d, (p) => {
        const f = p.figure as NumberLineSpec;
        expect([f.min, f.max]).toEqual([-10, 10]);
        for (const pt of f.points) expect(pt.value % 5, `${p.promptText} ${pt.label}=${pt.value}`).not.toBe(0);
      });
  });

  it('数直線: 目盛りは 1 だけ。★2 は 距離・1 回進む、★3 は 2 回進む・逆向き(★2 と ★3 の逆転を直した)', () => {
    for (const d of [1, 2, 3] as const) each('g1.sign.numberline', d, (p) => expect((p.figure as NumberLineSpec).step ?? 1, p.promptText).toBe(1));
    const tags = (d: Difficulty) => {
      const set = new Set<string>();
      each('g1.sign.numberline', d, (p) => p.tags.forEach((t) => set.add(t)));
      return [...set].sort();
    };
    expect(tags(2)).toEqual(['numberline_add', 'numberline_distance', 'numberline_sub']);
    expect(tags(3)).toEqual(['numberline_reverse', 'numberline_two_moves']);
  });

  it('絶対値 ★2: 半分は 負の数どうしの比較(符号だけで 選べないように)。「絶対値が a の数」は ★2、★3 には 出さない', () => {
    let negOnly = 0;
    let both = 0;
    each('g1.sign.abs', 2, (p) => {
      if (p.tags.includes('abs_two_values')) return void both++;
      const opts = (p.answer as { options: string[] }).options;
      if (opts.every((o) => o.startsWith('−'))) negOnly++;
    });
    expect(negOnly).toBeGreaterThan(N / 5);
    expect(both).toBeGreaterThan(N / 5);
    each('g1.sign.abs', 3, (p) => expect(p.tags, p.promptText).not.toContain('abs_two_values'));
  });

  it('加減 ★2 の かっこなしの式は、先頭が負か 答えが負(「7 − 6」のような式は出さない)。ボスの式も 項に直すと 負の項がある', () => {
    each('g1.sign.addsub', 2, (p) => {
      if (p.promptText.includes('(')) return; // かっこつきの式は 対象外
      expect(p.promptText.startsWith('−') || answerOf(p) < 0, p.promptText).toBe(true);
    });
    for (const d of [1, 2, 3] as const)
      each('g1.sign.addsub_big', d, (p) => {
        // 「31 + 46 + 40」のような 正の数だけの 項だけの式は ない
        expect(/^\d[\d +]*= \?$/.test(p.promptText), p.promptText).toBe(false);
      });
  });

  it('ボスの加減 ★2・★3 は 2 けたの数が 2 つだけ(★2 は 30 まで)。先生の判定「2桁が多すぎて計算しにくい」', () => {
    for (const d of [2, 3] as const)
      each('g1.sign.addsub_big', d, (p) => {
        const nums = (p.promptText.match(/\d+/g) ?? []).map(Number);
        expect(nums.filter((n) => n >= 10).length, p.promptText).toBe(2);
        expect(Math.max(...nums), p.promptText).toBeLessThanOrEqual(d === 2 ? 30 : 50);
      });
  });

  it('小数の問題の正解は 小数で 見せる(26/5 ではなく 5.2)', () => {
    each('g1.sign.addsub', 3, (p) => {
      if (p.tags.includes('decimal_addsub')) expect(p.answerLabel, p.promptText).toMatch(/^-?\d+(\.\d)?$/);
    });
  });

  it('平均から ? を求める問題の ヒントは 符号つきの差(平均 − 目標)で 案内する。? は「目標との差」と 明記', () => {
    each('g1.sign.average', 3, (p) => {
      if (!p.tags.includes('base_average_missing')) return;
      expect(p.hint, p.hint).toMatch(/平均 − (目標|基準) = .*(符号つき)/);
      expect(p.promptText, p.promptText).toMatch(/(目標|基準)との差は\?$/);
    });
  });

  it('基準との差・平均: 表の数は 道中(教科書)で ★2 が 3〜4・★3 が 4〜5、修練の泉(チャレンジテスト)で ★2 が 5・★3 が 5〜6', () => {
    const spec = { textbook: { 2: [3, 4], 3: [4, 5] }, challenge: { 2: [5], 3: [5, 6] } } as const;
    for (const basis of ['textbook', 'challenge'] as const)
      for (const d of [2, 3] as const) {
        const seen = new Set<number>();
        each('g1.sign.average', d, (p) => seen.add((p.figure as TableSpec).rows[0].length - 1), basis);
        expect([...seen].sort(), `${basis} ★${d}`).toEqual([...spec[basis][d]]);
      }
  });

  it('基準との差・平均: 差は ±15 まで。★2・★3 は表つき、★3 の平均は整数', () => {
    for (const d of [2, 3] as const) {
      each('g1.sign.average', d, (p) => {
        const t = p.figure as TableSpec;
        expect(t.kind).toBe('table');
        for (const c of t.rows[0].slice(1)) if (c !== '?') expect(Math.abs(Number(c.replace('−', '-'))), c).toBeLessThanOrEqual(15);
        expect(Number.isInteger(answerOf(p)), p.promptText).toBe(true);
      });
    }
  });
});

describe('第2章 文字と式', () => {
  /** ★ ごとに 出る tag の集まり */
  const tagsOf = (id: string, d: Difficulty) => {
    const set = new Set<string>();
    each(id, d, (p) => p.tags.forEach((t) => set.add(t)));
    return [...set].sort();
  };
  /** 問題文に出てくる 係数・数(符号なし)の最大 */
  const maxNum = (p: Problem) => Math.max(...numbersIn(p));

  it('同類項(教科書の順 2026-09-28): ★1 は 2 項をまとめる、★2 は 4 項と 一次式の加減、★3 は 約分した分数の係数。2 文字は 2 年なので出さない', () => {
    expect(tagsOf('g1.expr.collect', 1)).toEqual(['collect_two_terms']);
    each('g1.expr.collect', 1, (p) => expect(maxNum(p), p.promptText).toBeLessThanOrEqual(9));
    expect(tagsOf('g1.expr.collect', 2)).toEqual(['add_expression', 'collect_like_terms', 'subtract_expression']);
    for (const d of [1, 2, 3] as const) each('g1.expr.collect', d, (p) => expect(p.promptText, p.promptText).not.toMatch(/[ab]/));
    // 「左の式から 右の式を ひけ」は 分かりにくいので 出さない(先生の印 2026-10-14)
    each('g1.expr.collect', 2, (p) => expect(p.promptText, p.promptText).not.toMatch(/左の式/));
    each('g1.expr.collect', 3, (p) => {
      // 4/4x・3/3x・1x のような 約分していない係数を 出さない
      for (const [, n, q] of p.promptText.matchAll(/(\d+)\/(\d+)x/g)) {
        expect(Number(n), p.promptText).toBeLessThan(Number(q));
        expect(gcd(Number(n), Number(q)), p.promptText).toBe(1);
      }
      expect(p.promptText, p.promptText).not.toMatch(/(^|[^\d/])1x/);
    });
  });

  it('かっこ(教科書の順): ★1 は 項と数の乗除・小さい数の k(ax + b)(積は 25 まで)、★2 は ÷ 数が中心、★3 は かっこ 2 つ・分数', () => {
    expect(tagsOf('g1.expr.distribute', 1)).toEqual(['distribute', 'term_div_number', 'term_times_number']);
    each('g1.expr.distribute', 1, (p) => {
      if (p.tags[0] === 'distribute') expect(maxNum(p), p.promptText).toBeLessThanOrEqual(5);
    });
    // 項 × 分数(★2)・整数 × 分数の係数の式(★3)は 授業の プリント(2026-10-02)
    expect(tagsOf('g1.expr.distribute', 2)).toEqual(['distribute', 'divide_expression', 'term_times_fraction']);
    expect(tagsOf('g1.expr.distribute', 3)).toEqual(['distribute_fraction', 'distribute_fraction_form', 'distribute_int_fraction', 'distribute_two']);
    // 一次式 ÷ 数の わられる式の 数は 36 まで
    each('g1.expr.distribute', 2, (p) => {
      if (p.tags[0] === 'divide_expression') expect(maxNum(p), p.promptText).toBeLessThanOrEqual(36);
    });
    // ★3 の かっこの前の 整数は 30 まで(整数 × 分数の係数の式)
    each('g1.expr.distribute', 3, (p) => {
      if (p.tags[0] === 'distribute_int_fraction') expect(maxNum(p), p.promptText).toBeLessThanOrEqual(30);
    });
    // 負の数を かっこの前に書くときは −3(2x − 5)。(−3)(2x − 5) とは書かない
    for (const d of [1, 2, 3] as const) each('g1.expr.distribute', d, (p) => expect(p.promptText, p.promptText).not.toMatch(/\)\(/));
  });

  it('代入(先生の印 2026-10-13 で 1 段ずつ 上げた): ★1 は 1 つの項 ax に 正の数、★2 は ax + b に 正の数・1 つの項に 負の数、★3 は 負の数の代入', () => {
    each('g1.expr.subst', 1, (p) => {
      expect(p.promptText, p.promptText).toMatch(/^x = [2-9] のとき、\dx の値は\?$/);
      expect(p.tags).toEqual(['substitute_one_term']);
    });
    each('g1.expr.subst', 2, (p) => {
      if (p.tags[0] === 'substitute') expect(Number(p.promptText.match(/x = (\d+)/)?.[1]), p.promptText).toBeLessThanOrEqual(6);
      else expect(p.promptText, p.promptText).toMatch(/^x = −[1-6] のとき、\dx の値は/);
    });
    each('g1.expr.subst', 3, (p) => expect(p.promptText, p.promptText).toMatch(/^x = −?\d/));
    // 累乗の 式(5x³ など)は 道中には 出さない(修練の泉の ★3 だけ)
    each('g1.expr.subst', 3, (p) => expect(p.promptText, p.promptText).not.toMatch(/³/));
  });

  it('係数の問題(同類項・かっこ・代入・規則性)では 分母に 文字が来る式を 出さない(先生の方針 2026-09-28。文字式で表す問題の 4/x と、式の値の 12/x(2026-10-02)は よい)', () => {
    const letterDen = /\\frac\{[^{}]*\}\{[^{}]*[a-z][^{}]*\}|\/\s*\(?[a-z]/;
    for (const id of ['g1.expr.subst', 'g1.expr.collect', 'g1.expr.distribute', 'g1.expr.pattern'])
      for (const d of [1, 2, 3] as const)
        each(id, d, (p) => {
          if (p.answer.kind === 'number') return;
          const all = [p.prompt, p.promptText, ...p.explanation, ...(p.answer.kind === 'choice' ? p.answer.options : []), p.answer.kind === 'expression' ? p.answer.expected : ''];
          for (const t of all) expect(t, `${p.promptText} / ${t}`).not.toMatch(letterDen);
        });
  });

  it('分数の係数の答えは、解説で もう一方の 書き方(2/3 x ↔ 2x/3、x/4 ↔ 1/4 x)も 見せる。どちらの 入力も 正解', () => {
    each('g1.expr.collect', 3, (p) => {
      expect(p.explanation.at(-1), p.promptText).toMatch(/どちらも 正解/);
      const exp = p.answer.kind === 'expression' ? p.answer.expected : '';
      const m = p.explanation.at(-1)!.match(/(-?)\\frac\{(\d*)x\}\{(\d+)\}/)!;
      // 2x/3 の形で 入れても 正解になる
      expect(judge({ kind: 'expression', expected: exp }, `${m[1]}${m[2]}x/${m[3]}`).correct, `${p.promptText} / ${m[0]}`).toBe(true);
    });
    let seen = 0;
    each('g1.expr.model', 1, (p) => {
      if (!p.explanation.some((e) => e.includes('どちらも 正解'))) return;
      seen++;
      expect(p.explanation.at(-1), p.promptText).toMatch(/\\frac\{x\}\{\d+\}.*\\frac\{1\}\{\d+\}x/);
    });
    expect(seen).toBeGreaterThan(0);
  });

  it('規則性: どの ★ でも「並びの 5〜8 番目の数」と「n 番目を表す式を 4 択で 選ぶ」だけ(先生の印 2026-10-14)。問題文の 見せ方は いつも 文章', () => {
    for (const d of [1, 2, 3] as const) {
      expect(tagsOf('g1.expr.pattern', d)).toEqual(['pattern_choice', 'pattern_value']);
      each('g1.expr.pattern', d, (p) => {
        expect(p.layout, p.promptText).toBe('prose');
        if (p.answer.kind !== 'choice') return expect(p.answer.kind).toBe('number');
        // 正解の 式は n = 1〜4 で 並びの 数に なる。ほかの 選択肢は ならない
        const terms = p.promptText.split(',').slice(0, 4).map(Number);
        const evalAt = (tex: string, n: number) => Function('n', `return ${tex.replace(/(\d)n/g, '$1*n').replace(/^-n/, '-1*n')}`)(n) as number;
        p.answer.options.forEach((o, i) => {
          const fits = terms.every((t, k) => evalAt(o, k + 1) === t);
          expect(fits, `${p.promptText} / ${o}`).toBe(i === (p.answer as { correct: number }).correct);
        });
        expect(new Set(p.answer.options).size).toBe(4);
      });
    }
  });

  it('修練の泉(チャレンジテスト基準)の 代入 ★3 に 負の数を 累乗の式に 代入する形がある(x は −2 か −3)', () => {
    let power = 0;
    each('g1.expr.subst', 3, (p) => {
      if (!p.tags.includes('substitute_power')) return;
      power++;
      expect(p.promptText, p.promptText).toMatch(/x = −[23] /);
    }, 'challenge');
    expect(power).toBeGreaterThan(N / 4);
  });

  it('表しヒツジ: ×÷ をはぶく表し方が ★1〜★3、不等式が ★3 に出る', () => {
    for (const d of [1, 2, 3] as const) {
      const tags = new Set<string>();
      each('g1.expr.model', d, (p) => p.tags.forEach((t) => tags.add(t)));
      expect(tags.has('notation'), `★${d}`).toBe(true);
      expect(tags.has('inequality'), `★${d}`).toBe(d === 3);
      // 式の 意味(ごく小問。先生 2026-10-04)は ★2・★3 に 少しだけ
      expect(tags.has('expression_meaning'), `★${d}`).toBe(d >= 2);
    }
    let meaning = 0;
    each('g1.expr.model', 3, (p) => void (p.tags.includes('expression_meaning') && meaning++));
    expect(meaning / N).toBeLessThan(0.2);
  });

  it('仮面の書記官(ボス)の 発展の形(授業の 発展プリント 2026-10-02): 各段階に 1 つずつ まざり、道中には 出ない', () => {
    const phases = getEnemy('masked_scribe').phases!.map((ph) => ph.templates);
    expect(phases).toEqual([
      ['g1.expr.subst', 'g1.expr.boss_subst'],
      ['g1.expr.collect', 'g1.expr.distribute', 'g1.expr.boss_calc'],
      ['g1.expr.model', 'g1.expr.pattern', 'g1.expr.boss_relation'],
    ]);
    const tagsOf = (id: string, d: Difficulty) => {
      const tags = new Set<string>();
      each(id, d, (p) => p.tags.forEach((t) => tags.add(t)));
      return [...tags].sort();
    };
    expect(tagsOf('g1.expr.boss_calc', 1)).toEqual(['boss_decimal', 'boss_div_fraction']);
    expect(tagsOf('g1.expr.boss_calc', 3)).toEqual(['boss_decimal_subtract', 'boss_div_fraction', 'boss_fraction_form', 'boss_fraction_two', 'boss_int_times_fraction']);
    for (const d of [1, 2, 3] as const) {
      // 2 文字の 式の 計算(2 年)は 出さない。数は 20 まで
      each('g1.expr.boss_calc', d, (p) => {
        expect(p.promptText, p.promptText).not.toMatch(/[a-wyz]/);
        expect(Math.max(...numbersIn(p)), p.promptText).toBeLessThanOrEqual(20);
      });
      // 式の値は 整数、負の数を 代入する
      each('g1.expr.boss_subst', d, (p) => {
        // 正の数に なる 式を 選ぶ 問題(教科書の 章の問題 B)は 選択式
        if (p.tags.includes('boss_sign_choice')) return expect(d).toBeGreaterThan(1);
        expect(Number.isInteger(answerOf(p)), p.promptText).toBe(true);
        expect(p.promptText, p.promptText).toMatch(/^x = −/);
      });
    }
    // 発展の 式の値 ★1 は 負の数を 1 次式に(累乗は ★2 から。先生の指摘 2026-10-14)
    each('g1.expr.boss_subst', 1, (p) => expect(p.promptText, p.promptText).not.toMatch(/[²³]/));
    // 不等式は ★2 から
    expect(tagsOf('g1.expr.boss_relation', 1)).toEqual(['boss_relation_eq']);
    expect(tagsOf('g1.expr.boss_relation', 3)).toContain('boss_relation_ineq');
  });
});

describe('第2章 教科書の 本文から 足した形(2026-10-13)', () => {
  const tagsOf = (id: string, d: Difficulty) => {
    const tags = new Set<string>();
    each(id, d, (p) => p.tags.forEach((t) => tags.add(t)));
    return tags;
  };
  it('修練の泉の 代入 ★3 に 2 文字で 累乗を ふくむ 式、表しヒツジ ★3 に 数の 表し方(★2 には 出ない)', () => {
    const challenge = new Set<string>();
    each('g1.expr.subst', 3, (p) => p.tags.forEach((t) => challenge.add(t)), 'challenge');
    expect(challenge.has('substitute_two_power')).toBe(true);
    expect(tagsOf('g1.expr.model', 3).has('number_form')).toBe(true);
    expect(tagsOf('g1.expr.model', 2).has('number_form')).toBe(false);
  });
  it('正の数に なる 式を 選ぶ: 正解は a = −2 で 正、ほかは 負', () => {
    // 累乗の 前の − は 累乗の あと(−a² = −(a²))。JS の ** に 直すときに かっこを 付ける
    const val = (t: string) =>
      Function(`return ${t.replace(/(\(-a\)|a)\^\{(\d)\}/g, '(($1)**$2)').replace(/a/g, '(-2)')}`)() as number;
    let n = 0;
    each('g1.expr.boss_subst', 3, (p) => {
      if (p.answer.kind !== 'choice') return;
      n++;
      p.answer.options.forEach((o, i) => expect(val(o) > 0, o).toBe(i === (p.answer as { correct: number }).correct));
    });
    expect(n).toBeGreaterThan(20);
  });
  it('文章の 問題は 本文の 書体で、文中の 文字は \\text の 外(数式の 斜体)。先生の判定「フォントが違う」「a が教科書と違う」', () => {
    const loneVar = /\\text\{[^}]*(?<![A-Za-z])[abcnxy](?![A-Za-z])[^}]*\}/;
    for (const id of ['g1.expr.model', 'g1.expr.boss_subst', 'g1.expr.boss_relation'])
      for (const d of [1, 2, 3] as const)
        each(id, d, (p) => {
          expect(p.prompt, p.promptText).not.toMatch(loneVar);
          // 文章で 聞く 問題は 本文の 書体(式を 見せて 聞く x × 2 ÷ 9 や 代入は 数式の 書体の まま)
          const sentence = ['model_expression', 'number_form', 'expression_meaning', 'inequality', 'boss_sign_choice'];
          if (id === 'g1.expr.boss_relation' || p.tags.some((t) => sentence.includes(t))) expect(p.layout, p.promptText).toBe('prose');
        });
  });
  it('どの 章の 問題文でも \\text の 中に 文字(x・y・a…)を 入れない(方程式の「x を求めよ」、比例の「y を x の式で」も)', () => {
    const loneVar = /\\text\{[^}]*(?<![A-Za-z])[abcnxy](?![A-Za-z])[^}]*\}/;
    const ids = ['basic', 'linear', 'paren', 'fraction', 'ratio', 'word'].map((s) => `g1.eq.${s}`).concat(['g1.func.prop', 'g1.func.invprop', 'g1.func.coord', 'g1.func.graph']);
    for (const id of ids) for (const d of [1, 2, 3] as const) each(id, d, (p) => expect(p.prompt, p.promptText).not.toMatch(loneVar));
  });
  it('同類項 ★2 に「2 つの式 … の 和を 求めよ」は 出ない(先生の判定「試験でも 見かけない」)', () => {
    each('g1.expr.collect', 2, (p) => expect(p.promptText, p.promptText).not.toMatch(/和を|2 つの式/));
  });
  it('分数の形の式の加減: 答えは 約分した形(分母は 1 でない)', () => {
    each('g1.expr.boss_calc', 3, (p) => {
      if (!p.tags.includes('boss_fraction_form') || p.answer.kind !== 'expression') return;
      const m = p.answer.expected.match(/^\((-?\d*)x([+-]\d+)\)\/(\d+)$/);
      expect(m, p.answer.expected).not.toBeNull();
      const [n1, c, q] = [Number(m![1] === '' ? 1 : m![1] === '-' ? -1 : m![1]), Number(m![2]), Number(m![3])];
      expect(q).toBeGreaterThan(1);
      expect(gcd(gcd(Math.abs(n1), Math.abs(c)), q), p.answer.expected).toBe(1);
    });
  });
});

describe('第3章 方程式', () => {
  const rightSide = (p: Problem) => p.promptText.replace(/ の x を求めよ$/, '').split('=')[1];
  const tagsOf = (id: string, d: Difficulty) => {
    const seen = new Set<string>();
    each(id, d, (p) => p.tags.forEach((t) => seen.add(t)));
    return seen;
  };

  it('解は 整数が 基本(教科書の 本文 2026-10-15)。分数の解は 基本の ★2・★3 と 移項の ★3 だけ。解の 大きさは 教科書の 範囲', () => {
    for (const id of ['g1.eq.basic', 'g1.eq.linear', 'g1.eq.paren', 'g1.eq.fraction', 'g1.eq.ratio'])
      for (const d of [1, 2, 3] as const)
        each(id, d, (p) => {
          if (p.answer.kind !== 'number') return;
          const x = answerOf(p);
          if (p.tags.includes('eq_fraction_answer')) {
            expect(id === 'g1.eq.basic' ? d >= 2 : id === 'g1.eq.linear' && d === 3, `${id} ★${d} ${p.promptText}`).toBe(true);
            return;
          }
          expect(Number.isInteger(x), p.promptText).toBe(true);
          // x/k = b は 両辺に k を かけるので 36 まで。分数は ⅓x − 4 = ⅕x(解 30)まで。比例式は 60 まで
          const max = id === 'g1.eq.fraction' ? 36 : id === 'g1.eq.ratio' ? 60 : p.tags.includes('eq_div') ? 36 : 12;
          expect(Math.abs(x), p.promptText).toBeLessThanOrEqual(max);
        });
  });

  it('基本: ★1 は 等式の性質と 解を選ぶ、★2 に k が 解の 式を選ぶ・−x・x/k・(p/q)x・分数の 解、★3 に 分数の 解', () => {
    each('g1.eq.basic', 1, (p) => expect(Math.max(...numbersIn(p)), p.promptText).toBeLessThanOrEqual(81));
    expect(tagsOf('g1.eq.basic', 1)).toEqual(new Set(['eq_add', 'eq_mul', 'eq_solution']));
    const t2 = tagsOf('g1.eq.basic', 2);
    for (const t of ['eq_which_solution', 'eq_minus_x', 'eq_div', 'eq_frac_coef', 'eq_fraction_answer']) expect(t2).toContain(t);
    expect(tagsOf('g1.eq.basic', 3)).toContain('eq_fraction_answer');
    // k が 解の 式を 選ぶ: 正解の 式だけが 成り立つ(選択肢は 3 つとも ちがう)
    each('g1.eq.basic', 2, (p) => {
      if (p.answer.kind === 'choice' && p.tags.includes('eq_which_solution')) expect(new Set(p.answer.options).size).toBe(3);
    });
  });

  it('移項: ★1 に ax + b = c・b − ax = c(数の項が 先)・ax = cx + e、★2・★3 は 両辺に x で 右辺が 数から 始まる 形も', () => {
    let constFirst = 0;
    let bothSides = 0;
    each('g1.eq.linear', 1, (p) => {
      if (/^\d+ − \d?x/.test(p.promptText)) constFirst++;
      if (rightSide(p).includes('x')) bothSides++;
    });
    expect(constFirst).toBeGreaterThan(N / 10);
    expect(bothSides).toBeGreaterThan(N / 5);
    let rightConst = 0;
    each('g1.eq.linear', 2, (p) => void (/^ −?\d+ [+−] \d*x/.test(rightSide(p)) && rightConst++));
    expect(rightConst).toBeGreaterThan(N / 5);
  });

  it('かっこ: ★1 は k(x + a) = c と k(x + a) ± mx = c、★2 に かっこが 右辺・中が 数から(2 − x)、★3 に かっこ 2 つ。−2(x − 3) と 書く', () => {
    each('g1.eq.paren', 1, (p) => expect(p.promptText, p.promptText).toMatch(/^[2-5]\(x [+−] \d\)( [+−] \d?x)? = −?\d+ の/));
    const t2 = tagsOf('g1.eq.paren', 2);
    expect(t2).toContain('eq_paren_right');
    let rev = 0;
    each('g1.eq.paren', 2, (p) => void (/\(\d+ − x\)/.test(p.promptText) && rev++));
    expect(rev).toBeGreaterThan(N / 10);
    expect(tagsOf('g1.eq.paren', 3)).toContain('eq_paren_two');
    for (const d of [2, 3] as const) each('g1.eq.paren', d, (p) => expect(p.promptText, p.promptText).not.toMatch(/\(−\d\)\(/));
  });

  it('小数・分数: ★1 は 片方の辺だけ x、★2 に 小数第 2 位、★3 に 数の項も 分数・(ax + b)/p の 形', () => {
    each('g1.eq.fraction', 1, (p) => expect(rightSide(p), p.promptText).not.toContain('x'));
    let hundredths = 0;
    each('g1.eq.fraction', 2, (p) => void (/\d\.\d\d/.test(p.promptText) && hundredths++));
    expect(hundredths).toBeGreaterThan(N / 10);
    const t3 = tagsOf('g1.eq.fraction', 3);
    for (const t of ['eq_fraction_paren', 'eq_fraction_const', 'eq_decimal']) expect(t3).toContain(t);
  });

  it('比例式: ★1 は 40 まで、★2 に (x ± m) が 1 か所、★3 は 両方の 項に x', () => {
    each('g1.eq.ratio', 1, (p) => expect(Math.max(...numbersIn(p)), p.promptText).toBeLessThanOrEqual(40));
    expect(tagsOf('g1.eq.ratio', 2)).toContain('eq_ratio_expr');
    each('g1.eq.ratio', 3, (p) => {
      expect(Number.isInteger(answerOf(p)), p.promptText).toBe(true);
      expect(p.tags, p.promptText).toContain('eq_ratio_both');
    });
  });

  it('文章題: 解は 整数、選択肢は 4 つとも ちがう', () => {
    for (const d of [1, 2, 3] as const)
      each('g1.eq.word', d, (p) => {
        if (p.answer.kind === 'number') expect(Number.isInteger(answerOf(p)), p.promptText).toBe(true);
        if (p.answer.kind === 'choice') expect(new Set(p.answer.options).size, p.promptText).toBe(4);
      });
  });

  it('ほとんどの 計算の問題に よくある まちがいの 一言がある', () => {
    for (const id of ['g1.eq.basic', 'g1.eq.linear', 'g1.eq.paren', 'g1.eq.fraction', 'g1.eq.ratio'])
      for (const d of [1, 2, 3] as const) {
        let n = 0;
        let total = 0;
        each(id, d, (p) => {
          if (p.answer.kind !== 'number') return;
          total++;
          if ((p.mistakes?.length ?? 0) > 0) n++;
        });
        expect(n / total, `${id} ★${d}`).toBeGreaterThan(0.8);
      }
  });
});

describe('第4章 比例と反比例', () => {
  // 教科書 4 章の 本文(2026-10-15。refs/prints/4章_honbun-features.md)に 合わせた 範囲
  const ids = ['g1.func.prop', 'g1.func.invprop', 'g1.func.coord', 'g1.func.graph'];
  const tagsOf = (id: string, d: Difficulty) => {
    const seen = new Set<string>();
    each(id, d, (p) => p.tags.forEach((t) => seen.add(t)));
    return [...seen].sort();
  };
  const denOf = (p: Problem): number => {
    if (p.answer.kind === 'number') return Number(p.answer.value.d);
    if (p.answer.kind === 'expression') return Number(p.answer.expected.match(/\/(\d+)x$/)?.[1] ?? 1);
    return 1;
  };
  const numOfExpr = (p: Problem): number => Number(p.answer.kind === 'expression' ? (p.answer.expected.match(/^(-?\d*)\//)?.[1] ?? 'NaN') : NaN);

  it('変域: ★2 は 言葉 → 不等号(4 未満 → x < 4)と 場面、★3 は y = ax の y の 変域。★1 には 出ない', () => {
    for (const d of [1, 2, 3] as const) {
      let n = 0;
      each('g1.func.prop', d, (p) => {
        if (!p.tags.includes('prop_domain') && !p.tags.includes('domain_words')) return;
        n++;
        if (p.tags.includes('domain_words') && p.answer.kind === 'choice') {
          const c = p.answer.options[p.answer.correct];
          if (/未満/.test(p.promptText)) expect(c, p.promptText).toMatch(/< \d+$/);
          if (/以下/.test(p.promptText)) expect(c, p.promptText).toMatch(/leqq \d+$/);
          if (/以上/.test(p.promptText)) expect(c, p.promptText).toMatch(/^-?\d+ \\leqq x/);
        }
        if (d === 3) expect(p.tags, p.promptText).toContain('prop_domain');
      });
      if (d === 1) expect(n).toBe(0);
      else expect(n).toBeGreaterThan(N / 8);
    }
  });

  it('教科書の 順: 2 段の 問題・分数の 比例定数(−½)は 基本の問題なので ★2 から。★3 は 分数の 比例定数・y から x・利用', () => {
    expect(tagsOf('g1.func.prop', 1)).toEqual(['prop_constant', 'prop_model', 'prop_value']);
    expect(tagsOf('g1.func.prop', 2)).toEqual(['domain_words', 'prop_constant', 'prop_domain', 'prop_find_a', 'prop_find_a_frac', 'prop_table', 'prop_two_step', 'prop_value']);
    expect(tagsOf('g1.func.prop', 3)).toEqual(['prop_domain', 'prop_find_a_frac', 'prop_find_x', 'prop_fraction', 'prop_two_step']);
    expect(tagsOf('g1.func.invprop', 1)).toEqual(['invprop_constant', 'invprop_model', 'invprop_value']);
    expect(tagsOf('g1.func.invprop', 2)).toEqual(['invprop_find_a', 'invprop_table', 'invprop_two_step', 'invprop_value']);
    expect(tagsOf('g1.func.invprop', 3)).toEqual(['invprop_find_x', 'invprop_two_step', 'invprop_use']);
    expect(tagsOf('g1.func.graph', 1)).toEqual(['graph_pick', 'graph_prop']);
    expect(tagsOf('g1.func.graph', 2)).toEqual(['graph_invprop', 'graph_prop', 'graph_prop_frac', 'graph_trend']);
    expect(tagsOf('g1.func.graph', 3)).toEqual(['graph_invprop', 'graph_prop_frac']);
  });

  it('★ を 下げて 作り直した 問題が まぎれない。負の数は \\text の 外(− が ハイフンに ならない)', () => {
    for (const id of ids)
      for (const d of [1, 2, 3] as const)
        each(id, d, (p) => {
          expect(p.difficulty, `${id} ${p.promptText}`).toBe(d);
          expect(p.prompt, p.promptText).not.toMatch(/\\text\{[^}]*-\d/);
          // \\; を \; と 書くと「;」が そのまま 出る(増加・減少の 問題で あった)
          for (const s of [p.prompt, ...p.explanation]) expect(s, p.promptText).not.toMatch(/(^|[^\\]);/);
        });
  });

  it('比例: ★1 の 比例定数は 整数(2〜9 か 場面の 数)、1 組の x, y は x が 8 まで・y が 30 まで、★2 の 分数は ½・⅓・¼ だけ', () => {
    each('g1.func.prop', 1, (p) => {
      if (p.tags.includes('prop_constant')) expect(Number.isInteger(answerOf(p)), p.promptText).toBe(true);
      if (p.tags.includes('prop_value')) expect(Number(p.promptText.match(/^y = (\d+)x/)?.[1]), p.promptText).toBeGreaterThanOrEqual(2);
    });
    for (const d of [2, 3] as const)
      each('g1.func.prop', d, (p) => {
        // y = x の 比例定数(1)・約分すると 整数に なる 分数は 出さない
        if (p.tags.includes('prop_constant')) expect(Math.abs(answerOf(p)), p.promptText).not.toBe(1);
        if (p.tags.includes('prop_find_a_frac')) expect(denOf(p), p.promptText).toBeGreaterThan(1);
        if (p.tags.includes('prop_fraction')) expect(p.promptText, p.promptText).toMatch(/^y = −?\d\/\dx/);
        if (d === 2 && p.tags.some((t) => t.startsWith('prop_find_a'))) {
          const [x, y] = numbersIn(p);
          expect(x, p.promptText).toBeLessThanOrEqual(8);
          expect(y, p.promptText).toBeLessThanOrEqual(30);
          if (p.tags.includes('prop_find_a_frac')) expect(Math.abs(numOfExpr(p)), p.promptText).toBe(1);
        }
        if (d === 3 && p.tags.includes('prop_find_a_frac')) expect(Math.abs(numOfExpr(p)), p.promptText).toBeGreaterThan(1);
      });
  });

  it('反比例: 比例定数は 教科書の 6〜24(★3 の 2 段・y から x は 48 まで)、1 組の x は 5 まで', () => {
    const basic = [6, 8, 12, 16, 18, 20, 24];
    for (const d of [1, 2, 3] as const)
      each('g1.func.invprop', d, (p) => {
        const a = Number(p.promptText.match(/y = −?(\d+)\/x/)?.[1] ?? NaN);
        if (!Number.isNaN(a)) expect(d === 3 ? [...basic, 30, 36, 48] : basic, p.promptText).toContain(a);
        if (d === 1 && p.tags.includes('invprop_value')) expect(Number.isInteger(answerOf(p)), p.promptText).toBe(true);
        if (d === 2 && (p.tags.includes('invprop_find_a') || p.tags.includes('invprop_two_step'))) {
          const [x, y] = numbersIn(p);
          expect(x, p.promptText).toBeLessThanOrEqual(5);
          expect(x * y, p.promptText).toBeLessThanOrEqual(30);
        }
        if (p.tags.includes('invprop_use')) expect(Number.isInteger(answerOf(p)), p.promptText).toBe(true);
      });
  });

  it('座標: 点は ±5(★1 は ±4)、移動した 先も ±5。軸の 上の 点も 読む', () => {
    for (const d of [1, 2, 3] as const) {
      let axis = 0;
      each('g1.func.coord', d, (p) => {
        const lim = d === 1 ? 4 : 5;
        for (const q of p.figure?.kind === 'plane' ? (p.figure.points ?? []) : []) expect(Math.max(Math.abs(q.x), Math.abs(q.y)), p.promptText).toBeLessThanOrEqual(lim);
        if (p.answer.kind === 'numbers') {
          const [x, y] = p.answer.values.map(toNumber);
          expect(Math.max(Math.abs(x), Math.abs(y)), p.promptText).toBeLessThanOrEqual(lim);
        }
        if (p.tags.includes('coord_axis')) axis++;
      });
      if (d < 3) expect(axis, `★${d}`).toBeGreaterThan(N / 10);
    }
  });

  it('グラフ: ★1 は 比例定数 ±3 までの 直線、★2 の 分数は 真分数(½x・⅔x・−⅓x・¾x)、★3 は 分数の 比例定数', () => {
    each('g1.func.graph', 1, (p) => {
      const graphs = p.figure?.kind === 'plane' ? (p.figure.graphs ?? []) : [];
      expect(graphs.every((g) => g.type === 'prop' && Number.isInteger(g.a) && Math.abs(g.a) <= 3), p.promptText).toBe(true);
    });
    each('g1.func.graph', 2, (p) => {
      if (!p.tags.includes('graph_prop_frac')) return;
      expect(denOf(p), p.promptText).toBeLessThanOrEqual(4);
      expect(Math.abs(numOfExpr(p)), p.promptText).toBeLessThan(denOf(p));
    });
    each('g1.func.graph', 3, (p) => {
      if (p.tags.includes('graph_prop_frac')) expect(denOf(p), p.answer.kind === 'expression' ? p.answer.expected : '').toBeGreaterThan(1);
    });
  });

  it('ほとんどの 問題に よくある まちがいの 一言がある', () => {
    for (const id of ids)
      for (const d of [1, 2, 3] as const) {
        let n = 0;
        each(id, d, (p) => void ((p.mistakes?.length ?? 0) > 0 && n++));
        expect(n / N, `${id} ★${d}`).toBeGreaterThan(0.9);
      }
  });
});

describe('第5章・第6章 図形', () => {
  it('おうぎ形 ★1: 半径は 3・4・6・8・12、中心角は 120° まで', () => {
    each('g1.geo.sector', 1, (p) => {
      const [r, angle] = numbersIn(p);
      expect([3, 4, 6, 8, 12]).toContain(r);
      expect(angle).toBeLessThanOrEqual(120);
    });
  });

  it('球: 半径は 10 まで(直径なら 20 まで)、体積は 半径 3・6・9', () => {
    for (const d of [1, 2, 3] as const) {
      each('g1.solid.sphere', d, (p) => {
        const n = numbersIn(p)[0];
        const r = p.promptText.startsWith('直径') ? n / 2 : n;
        if (p.tags.includes('sphere_volume')) expect([3, 6, 9]).toContain(r);
        else expect(r).toBeLessThanOrEqual(10);
      });
    }
  });
});

describe('第7章 データの活用', () => {
  it('確率(多数回の試行): 相対度数は 小数第 2 位まで、★2 は表つき、★3 の予想は整数', () => {
    each('g1.data.prob', 1, (p) => expect(Math.abs(answerOf(p) * 100 - Math.round(answerOf(p) * 100)), p.promptText).toBeLessThan(1e-9));
    each('g1.data.prob', 2, (p) => expect(p.figure?.kind).toBe('table'));
    each('g1.data.prob', 3, (p) => expect(Number.isInteger(answerOf(p)), p.promptText).toBe(true));
  });
});
