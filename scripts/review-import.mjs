// 先生が ○/× を 付けた 判定を 読んで、× を 出題タイプ × ★ と 理由ごとに まとめる。
//   npm run review:import -- refs/review/g1c1-review-done.csv   (一括判定の CSV)
//   npm run review:import -- refs/review/judge.txt              (ゲームの「1問ずつ ○×判定」の コピーを 貼った ファイル)
// 結果: 画面と refs/review/<元の名前>-summary.md。Claude は これを 見て、問題を 作る ルール・Judge の ルール・
// src/data/grade1/rejected.ts(1 問だけの ×)・テストに 書き直す(docs/difficulty.md「問題の品質の 仕組み」)
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('使い方: npm run review:import -- <判定済みの CSV か コピーを 貼った ファイル>');
  process.exit(1);
}

/** 引用符・改行・カンマを ふくむ CSV を 読む */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') row.push(cell), (cell = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell), rows.push(row), (row = []), (cell = '');
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows.filter((r) => r.some((x) => x.trim()));
}

const raw = readFileSync(file, 'utf8').replace(/^﻿/, '');
// ゲームの「1問ずつ ○×判定」で「文字で コピー」した 文は タブ区切り。1 行目の【…】は 見出しなので 飛ばす
const rows = raw.includes('\t')
  ? raw
      .split(/\r?\n/)
      .filter((l) => l.includes('\t'))
      .map((l) => l.split('\t'))
  : parseCsv(raw);
const head = rows[0];
const col = (name) => head.findIndex((h) => h.startsWith(name));
const [iId, iType, iStar, iQ, iAns, iJudge, iWhy] = ['ID', '出題タイプ', '★', '問題', '正解', '判定', '理由'].map(col);
const judged = rows.slice(1).filter((r) => (r[iJudge] ?? '').trim());
const isNg = (r) => /[×xXｘＸ✕✗]|ng|NG|だめ|ダメ/.test(r[iJudge]);
const ng = judged.filter(isNg);

const out = [`# 判定の まとめ(${file})`, '', `判定あり ${judged.length} 問 / × ${ng.length} 問(${judged.length ? ((ng.length / judged.length) * 100).toFixed(1) : 0}%)`, ''];
const groups = new Map();
for (const r of ng) {
  const k = `${r[iType]} ★${r[iStar]}`;
  groups.set(k, [...(groups.get(k) ?? []), r]);
}
out.push('| 出題タイプ ★ | × の数 | 理由(多い順) |', '|---|---|---|');
for (const [k, rs] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
  const why = new Map();
  for (const r of rs)
    for (const w of ((r[iWhy] ?? '').trim() || '(理由なし)').split(' / ')) why.set(w, (why.get(w) ?? 0) + 1);
  out.push(`| ${k} | ${rs.length} | ${[...why].sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w} ×${n}`).join(' / ')} |`);
}
out.push('', '## × の 問題', '');
for (const r of ng) out.push(`- \`${r[iId]}\` ${(r[iQ] ?? '').replace(/\n/g, ' ')} → ${r[iAns] ?? ''} ― ${(r[iWhy] ?? '').trim() || '(理由なし)'}`);
const dest = file.replace(/\.csv$/i, '') + '-summary.md';
writeFileSync(dest, out.join('\n'));
console.log(out.slice(0, 4 + groups.size + 2).join('\n'));
console.log(`→ ${dest}`);
