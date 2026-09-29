// 開発用の 品質レポート(tests/tools/quality-report.test.ts を 実行する)。
//   npm run quality:report -- 1 200   → 第1章、出題タイプ × ★ ごとに 200 問 → refs/review/quality-report-g1c1.md
//   npm run quality:report -- 0 100   → 全章
import { spawnSync } from 'node:child_process';

const [ch = '1', per = '200'] = process.argv.slice(2);
const r = spawnSync('npx', ['vitest', 'run', 'tests/tools/quality-report.test.ts', '--silent=false'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, MQ_QUALITY: `${ch},${per}` },
});
process.exit(r.status ?? 1);
