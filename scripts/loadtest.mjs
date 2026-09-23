#!/usr/bin/env node
/**
 * 同時接続の簡易負荷試験(要件 §6.2: 授業で 35 人が同時に起動)。
 *   node scripts/loadtest.mjs <URL> <TOKEN> [人数=35] [クラス=loadtest]
 * 各「生徒」が login → save ×3 → load を行い、成功率と所要時間を出す。
 * 本番シートに loadtest クラスの行が増えるので、終わったら students シートから削除する。
 */
const [url, token, nStr = '35', cls = 'loadtest'] = process.argv.slice(2);
if (!url || !token) {
  console.error('使い方: node scripts/loadtest.mjs <URL> <TOKEN> [人数] [クラス]');
  process.exit(1);
}
const N = Number(nStr);

async function post(body) {
  const t0 = Date.now();
  const res = await fetch(url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, token }) });
  const json = await res.json();
  return { json, ms: Date.now() - t0 };
}

async function student(i) {
  const id = { class: cls, number: String(i), pass: `p${i}` };
  const times = [];
  const errors = [];
  const step = async (label, body) => {
    try {
      const { json, ms } = await post(body);
      times.push(ms);
      if (!json.ok) errors.push(`${label}: ${json.error}`);
    } catch (e) {
      errors.push(`${label}: ${e.message}`);
    }
  };
  await step('login', { action: 'login', ...id });
  for (let k = 0; k < 3; k++) {
    const save = { version: 1, player: { name: `T${i}`, level: k + 1 }, progress: { chapter: 'g1c1' }, stats: {}, updatedAt: new Date(Date.now() + k).toISOString() };
    await step(`save${k}`, { action: 'save', ...id, save });
  }
  await step('load', { action: 'load', ...id });
  return { times, errors };
}

const t0 = Date.now();
const results = await Promise.all(Array.from({ length: N }, (_, i) => student(i + 1)));
const all = results.flatMap((r) => r.times).sort((a, b) => a - b);
const errors = results.flatMap((r) => r.errors);
const pct = (p) => all[Math.min(all.length - 1, Math.floor(all.length * p))];
console.log(`人数 ${N} / リクエスト ${all.length} / 失敗 ${errors.length} / 全体 ${((Date.now() - t0) / 1000).toFixed(1)} 秒`);
console.log(`応答時間: 中央値 ${pct(0.5)}ms / 90% ${pct(0.9)}ms / 最大 ${all[all.length - 1]}ms`);
if (errors.length) console.log('失敗の内訳:', [...new Set(errors)].slice(0, 10));
