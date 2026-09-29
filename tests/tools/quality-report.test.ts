import { describe, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import '@/data/grade1/problems';
import { grade1 } from '@/data/grade1/chapters';
import { generateProblem, getTemplate, type Difficulty } from '@/math/template';
import { createRng } from '@/math/rng';
import { shapeOf } from '@/math/quality/duplicateChecker';
import { clearGenerationLog, getGenerationLog, summarizeGeneration, formatSummary, type GenerationLogEntry } from '@/math/quality/generationLog';
import { REJECT_LABEL, type RejectReason } from '@/math/quality/rejectReason';

/**
 * 開発用の 品質レポート(docs/difficulty.md「問題の品質の 仕組み」)。
 * 戦闘と 同じように 直近の 問題を 覚えながら 大量に 作り、採用率と 不合格の 理由を 数える。
 * ふつうの テストでは 走らない。`npm run quality:report -- 1 200`(第1章、出題タイプ × ★ ごとに 200 問)。
 * 結果は refs/review/quality-report-g1c1.md と 画面に 出す
 */
const arg = process.env.MQ_QUALITY;

describe.skipIf(!arg)('品質レポート', () => {
  it('report', () => {
    const [ch, per] = (arg ?? '1,200').split(',').map(Number);
    const chapters = ch === 0 ? grade1.chapters : [grade1.chapters[ch - 1]];
    const out: string[] = [`# 問題の品質レポート(${ch === 0 ? '全章' : `第${ch}章`}、出題タイプ × ★ ごとに ${per} 問)`, '', `作成: ${new Date().toISOString()}`, ''];
    const all: GenerationLogEntry[] = [];
    const rows: string[] = ['| 出題タイプ | ★ | 候補 | 採用率 | 代わり | 多い理由 |', '|---|---|---|---|---|---|'];
    for (const c of chapters)
      for (const id of c.templates ?? [])
        for (const star of [1, 2, 3] as Difficulty[]) {
          clearGenerationLog();
          const keys: string[] = [];
          const shapes: string[] = [];
          for (let i = 0; i < per; i++) {
            const p = generateProblem(id, star, keys, createRng(97 * (i + 1) + star), 'textbook', shapes);
            keys.push(p.key);
            shapes.push(shapeOf(p));
            keys.splice(0, keys.length - 6);
            shapes.splice(0, shapes.length - 6);
          }
          const log = [...getGenerationLog()];
          all.push(...log);
          const s = summarizeGeneration(log);
          const top = (Object.entries(s.byReason) as [RejectReason, number][]).sort((a, b) => b[1] - a[1]).slice(0, 2);
          rows.push(`| ${getTemplate(id).title} | ${star} | ${s.candidates} | ${(s.acceptanceRate * 100).toFixed(1)}% | ${s.fallbacks} | ${top.map(([r, n]) => `${REJECT_LABEL[r]} ${n}`).join('、') || '—'} |`);
        }
    const total = summarizeGeneration(all);
    out.push('## 全体', '', '```', formatSummary(total), '```', '', '## 出題タイプ × ★', '', ...rows, '');
    // 不合格の 例(理由ごとに 3 つ。直すときの 手がかり)
    out.push('## 不合格の例', '');
    const byReason = new Map<string, GenerationLogEntry[]>();
    for (const e of all) if (!e.accepted && e.reason) byReason.set(e.reason, [...(byReason.get(e.reason) ?? []), e]);
    for (const [r, es] of byReason) {
      out.push(`### ${r}(${REJECT_LABEL[r as RejectReason]})`, '');
      for (const e of es.slice(0, 3)) out.push(`- ${e.templateId} ★${e.difficulty}: ${e.question ?? ''} — ${e.detail ?? ''}`);
      out.push('');
    }
    mkdirSync('refs/review', { recursive: true });
    const file = `refs/review/quality-report-${ch === 0 ? 'all' : `g1c${ch}`}.md`;
    writeFileSync(file, out.join('\n'));
    console.log(formatSummary(total));
    console.log(`→ ${file}`);
  });
});
