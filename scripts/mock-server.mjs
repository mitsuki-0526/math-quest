#!/usr/bin/env node
/**
 * GAS(gas/Code.gs)と同じ API をメモリ上で再現する開発用サーバー。
 *   node scripts/mock-server.mjs            # http://127.0.0.1:8787
 *   .env.local に VITE_GAS_URL=http://127.0.0.1:8787 / VITE_API_TOKEN=dev-token を書いて npm run dev
 * unlock は環境変数 MOCK_UNLOCK=g1c1,g1c2 で変えられる。先生の合言葉は "sensei"。
 */
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 8787);
const TOKEN = process.env.MOCK_TOKEN ?? 'dev-token';
const UNLOCK = (process.env.MOCK_UNLOCK ?? 'g1c1').split(',');
const ALL = ['g1c1', 'g1c2', 'g1c3', 'g1c4', 'g1c5', 'g1c6', 'g1c7'];
const TEACHER_PASS = 'sensei';
const CLASSES = ['1-1', '1-2', '1-3'];

/** key → { passHash, salt, save, updatedAt } */
const students = new Map();
const hash = (pass, salt) => createHash('sha256').update(`${salt}:${pass}`).digest('hex');
const key = (c, n) => `${c}|${n}`;

function handle(action, p) {
  if (p.token !== TOKEN) return { ok: false, error: 'bad_token' };
  if (action === 'ping') return { ok: true, serverTime: new Date().toISOString() };
  if (action === 'bootstrap') return { ok: true, unlock: UNLOCK, classes: CLASSES, config: { 'battle.hintsPerNode': 3 }, serverTime: new Date().toISOString() };
  const cls = String(p.class ?? '').trim();
  const num = String(p.number ?? '').trim();
  const pass = String(p.pass ?? '');
  if (!cls || !num) return { ok: false, error: 'missing_identity' };
  const teacher = cls === 'teacher' && pass === TEACHER_PASS;
  if (cls === 'teacher' && !teacher) return { ok: false, error: 'bad_pass' };
  const k = key(cls, num);
  const row = students.get(k);
  const auth = (r) => teacher || (r.passHash && hash(pass, r.salt) === r.passHash);

  if (action === 'login') {
    if (!row) {
      if (!pass) return { ok: false, error: 'missing_pass' };
      const salt = randomUUID();
      students.set(k, { passHash: hash(pass, salt), salt, save: null, updatedAt: '' });
      return { ok: true, isNew: true, save: null, unlock: teacher ? ALL : UNLOCK, teacher };
    }
    if (!row.passHash) {
      row.salt = randomUUID();
      row.passHash = hash(pass, row.salt);
    } else if (!auth(row)) return { ok: false, error: 'bad_pass' };
    return { ok: true, isNew: false, save: row.save, unlock: teacher ? ALL : UNLOCK, teacher };
  }
  if (!row) return { ok: false, error: 'not_found' };
  if (!auth(row)) return { ok: false, error: 'bad_pass' };
  if (action === 'save') {
    const save = p.save;
    if (!save || typeof save !== 'object') return { ok: false, error: 'bad_save' };
    const incoming = String(save.updatedAt ?? '');
    if (row.updatedAt && incoming && incoming < row.updatedAt) return { ok: true, stored: false, save: row.save };
    row.save = save;
    row.updatedAt = incoming || new Date().toISOString();
    return { ok: true, stored: true, save: null };
  }
  if (action === 'load') return { ok: true, save: row.save };
  return { ok: false, error: 'unknown_action' };
}

const server = createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const reply = (obj) => {
    res.writeHead(200, cors);
    res.end(JSON.stringify(obj));
  };
  if (req.method === 'GET') {
    const p = Object.fromEntries(url.searchParams.entries());
    return reply(handle(p.action, p));
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      reply(handle(p.action, p));
    } catch {
      reply({ ok: false, error: 'bad_json' });
    }
  });
});

// 開発用の管理口: 合言葉リセットと一覧
server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock GAS server: http://127.0.0.1:${PORT}  token=${TOKEN}  unlock=${UNLOCK.join(',')}  teacher pass=${TEACHER_PASS}`);
});
