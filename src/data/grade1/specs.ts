import { registerSpecs, type ProblemSpec } from '@/math/quality/spec';
import type { Difficulty } from '@/math/template';

/**
 * 第1章「正の数と負の数」の 問題の 仕様(ProblemSpec)。docs/difficulty.md の ★ ごとの 表と 同じ 内容。
 * 問題を 作る プログラムは この範囲で 作る はずだが、MathValidator の あとで 確かめる(はみ出したら 作り直し)。
 * 仕様を 変えるときは docs/difficulty.md・tests/difficulty.test.ts・ここを いっしょに 直す
 */
const UNIT = '正の数と負の数';
const spec = (templateId: string, difficulty: Difficulty, s: Omit<ProblemSpec, 'templateId' | 'difficulty' | 'grade' | 'unit'>): ProblemSpec => ({
  templateId,
  difficulty,
  grade: 1,
  unit: UNIT,
  ...s,
});

export const grade1Specs: ProblemSpec[] = [
  // 加減(マイナススライム)。★1 は 1 けたの 2 項、★2 は 3 項まで・2 けたは 30 まで、★3 は 4 項まで・35 まで(小数・分数も)
  spec('g1.sign.addsub', 1, { maxNumber: 9, numberCount: [2, 2], integerAnswer: true, source: '教科書の問「加法」「減法」。先生の印「2けたは まだ早い」' }),
  spec('g1.sign.addsub', 2, { maxNumber: 30, numberCount: [2, 3], integerAnswer: true, source: '先生の印「数字 4 つは多い。かっこ付き 3 つを基本に」。授業の プリント(2 けたが 4〜5 割)と 先生の方針「★2 から 2 けたを 増やす」(2026-10-02)' }),
  spec('g1.sign.addsub', 3, { maxNumber: 35, numberCount: [2, 4], source: '教科書の問「加法と減法の混じった計算」、授業の プリント(35 まで・小数・分数)' }),
  // 大きな数の加減(ボス専用)
  spec('g1.sign.addsub_big', 1, { maxNumber: 50, numberCount: [3, 3], integerAnswer: true, source: '先生の試遊(2026-09-24)でボスは 50 まで' }),
  spec('g1.sign.addsub_big', 2, { maxNumber: 50, numberCount: [3, 4], integerAnswer: true, source: '同上' }),
  spec('g1.sign.addsub_big', 3, { maxNumber: 50, numberCount: [3, 4], integerAnswer: true, source: '同上' }),
  // 乗除(プラマイコウモリ)。★2 は わり算だけ(わられる数 81 まで)
  spec('g1.sign.muldiv', 1, { maxNumber: 9, numberCount: [2, 2], integerAnswer: true, source: '例題は 1けたの 2数の積' }),
  spec('g1.sign.muldiv', 2, {
    maxNumber: 81,
    numberCount: [2, 2],
    integerAnswer: true,
    // 逆数(5 回に 1 回): 数は 1 つ(分数なら 2 つ)、答えは 分数
    forms: { reciprocal: { numberCount: [1, 2], integerAnswer: false } },
    source: '先生の印「★2 は わり算のみ」。逆数は 授業の プリント(先生の方針 2026-10-02)',
  }),
  spec('g1.sign.muldiv', 3, { maxNumber: 54, numberCount: [2, 6], maxAnswer: 360, source: '×÷の混合(答えは整数)・4数の積(360 まで)・分数の乗除・符号の判断・小数と分数の 工夫する かけ算(授業の プリント)' }),
  // 絶対値・大小(ゼッタイチ・ゴーレム)。絶対値の記号は 使わない(Judge の ルールで 全体に)
  spec('g1.sign.abs', 1, { maxNumber: 20, numberCount: [1, 1], source: '「−7 の 絶対値は?」と文で聞く(20 まで)' }),
  spec('g1.sign.abs', 2, { maxNumber: 15, source: '4 数の大小・不等号・絶対値が a の数' }),
  spec('g1.sign.abs', 3, { maxNumber: 7, source: '「絶対値が 3 より小さい整数をすべて」の形' }),
  // 四則混合・累乗(クロスバッタ)。★1 は 累乗だけ
  spec('g1.sign.mixed', 1, {
    maxNumber: 6,
    numberCount: [1, 1],
    integerAnswer: true,
    // 累乗で 表す(4 回に 1 回、選択式): 3 × 3 × 7 × 7 × 7 のように 数が 並ぶ
    forms: { power_notation: { maxNumber: 7, numberCount: [2, 8] } },
    source: '(−1)³・−3²・−6² 程度。先生の方針「累乗の計算 単体なら そのまま」。累乗で 表す 形は 授業の プリント(2026-10-02)',
  }),
  spec('g1.sign.mixed', 2, { maxNumber: 10, numberCount: [3, 3], integerAnswer: true, maxAnswer: 54, source: '例題(6 × (−3) + 2 の形)' }),
  spec('g1.sign.mixed', 3, {
    maxNumber: 20,
    numberCount: [4, 5],
    integerAnswer: true,
    maxAnswer: 60,
    // 分配法則の 工夫(5 回に 1 回): (−6) × 58 + (−6) × 42 = −600 のように 2 けたを 使い、答えも 大きい
    forms: { distributive: { maxNumber: 99, maxAnswer: 900 } },
    source: 'チャレンジテストの四則混合(わられる数は 20 まで)。分配法則の 工夫は 授業の プリント(2026-10-02)',
  }),
  // 素因数分解(素数バチ)。★1 と ★2 は 数を 重ねない
  spec('g1.sign.primefactor', 1, { factorRange: [12, 40], source: '先生の方針「重なりを減らす」(2026-09-28)' }),
  spec('g1.sign.primefactor', 2, { factorRange: [42, 99], source: '先生の印「54(素因数 4 つ)・105(3 けた)は まだ」' }),
  spec('g1.sign.primefactor', 3, { factorRange: [60, 300], source: 'チャレンジテスト: 126・140・300' }),
  // 数直線(メモリシャクトリ)。目盛りは 1、−10〜10
  spec('g1.sign.numberline', 1, { numberCount: [0, 0], maxAnswer: 9, integerAnswer: true, source: '授業は 1 目盛り 1。点は 数の書いてない 目盛りに' }),
  spec('g1.sign.numberline', 2, { maxNumber: 9, maxAnswer: 20, integerAnswer: true, source: '2 点の距離・1 回進む' }),
  spec('g1.sign.numberline', 3, { maxNumber: 9, maxAnswer: 10, integerAnswer: true, source: '2 回進む・逆向き' }),
  // 基準との差・平均(ヘイキンタヌキ)。★2・★3 の 答えは 整数
  spec('g1.sign.average', 2, { integerAnswer: true, source: 'チャレンジテスト R4・R7' }),
  spec('g1.sign.average', 3, { integerAnswer: true, source: '学習プリントの仮平均、チャレンジテスト R6' }),
];

registerSpecs(grade1Specs);
