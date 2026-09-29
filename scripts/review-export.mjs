// 先生の 一括判定用に 問題を CSV に 書き出す(tests/tools/export-review.test.ts を 実行する)。
//   npm run review:export -- 1 20   → 第1章、出題タイプ × ★ ごとに 20 問 → refs/review/g1c1-review.csv
// Windows でも 動くよう、環境変数は ここで 付けて vitest を 呼ぶ
import { spawnSync } from 'node:child_process';

const [ch = '1', per = '20'] = process.argv.slice(2);
const r = spawnSync('npx', ['vitest', 'run', 'tests/tools/export-review.test.ts'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, MQ_EXPORT: `${ch},${per}` },
});
process.exit(r.status ?? 1);
