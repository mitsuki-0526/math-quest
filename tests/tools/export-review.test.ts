import { describe, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import '@/data/grade1/problems';
import { grade1 } from '@/data/grade1/chapters';
import { generateProblem, getTemplate, answerToText, type Difficulty, type Problem } from '@/math/template';
import { primeFactors, factorsToText } from '@/math/factorization';
import { createRng } from '@/math/rng';
import { texToPlain } from '@/math/texPlain';

/**
 * 先生の 一括判定用に、問題を まとめて CSV に 書き出す(先生の要望 2026-09-29「大量に出して 成否を 決めたい」)。
 * ふつうの テストでは 走らない。`npm run review:export -- 1 20`(第1章、出題タイプ × ★ ごとに 20 問)で 実行する。
 * 書き出し先: refs/review/(Git に 上げない)。Google スプレッドシートに 読み込んで「判定」「理由」の 列を 埋めてもらう。
 * ID(テンプレート|★|種)から 同じ問題を 作り直せるので、× の問題を あとで 特定できる
 */
const arg = process.env.MQ_EXPORT;

const csvCell = (s: string) => `"${s.replace(/"/g, '""')}"`;
const answerText = (p: Problem) =>
  p.answerLabel ? texToPlain(p.answerLabel) : p.answer.kind === 'factorization' ? factorsToText(primeFactors(p.answer.n)) : p.answer.kind === 'choice' ? texToPlain(p.answer.options[p.answer.correct]) : texToPlain(answerToText(p.answer));

describe.skipIf(!arg)('問題の一括書き出し', () => {
  it('CSV', () => {
    const [ch, per] = (arg ?? '1,20').split(',').map(Number);
    const chapter = grade1.chapters[ch - 1];
    const rows: string[][] = [['ID', '章', '出題タイプ', '★', '問題', '選択肢', '正解', '解説', 'よくある まちがい(誤答 → ピタの一言)', '判定(○/×)', '理由']];
    for (const id of chapter.templates ?? [])
      for (const star of [1, 2, 3] as Difficulty[]) {
        const keys: string[] = [];
        for (let i = 0, made = 0; made < per && i < per * 5; i++) {
          const seed = 1000 * ch + i + 1;
          const p = generateProblem(id, star, keys, createRng(seed * 7919 + star));
          // 同じ問題は 1 回だけ(判定の 手間を へらす)
          if (keys.includes(p.key)) continue;
          keys.push(p.key);
          made++;
          const table = p.figure?.kind === 'table' ? ` [表: ${p.figure.head.join(' | ')} / ${p.figure.rows.map((r) => r.join(' | ')).join(' / ')}]` : '';
          const line = p.figure?.kind === 'numberline' ? ` [数直線 ${p.figure.min}〜${p.figure.max}、点 ${p.figure.points.map((q) => `${q.label}=${q.value}`).join('、')}]` : '';
          rows.push([
            `${id}|${star}|${seed}`,
            String(ch),
            getTemplate(id).title,
            String(star),
            p.promptText + table + line,
            p.answer.kind === 'choice' ? p.answer.options.map(texToPlain).join(' / ') : '',
            answerText(p),
            p.explanation.map(texToPlain).join('\n'),
            (p.mistakes ?? []).map((m) => `${m.answer.kind === 'choice' ? texToPlain(m.answer.options[m.answer.correct]) : texToPlain(answerToText(m.answer))} → ${m.say}`).join('\n'),
            '',
            '',
          ]);
        }
      }
    mkdirSync('refs/review', { recursive: true });
    const file = `refs/review/g1c${ch}-review.csv`;
    // Excel でも 文字化けしないよう BOM を 付ける
    writeFileSync(file, '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'));
    console.log(`${rows.length - 1} 問を ${file} に 書き出しました`);
  });
});
