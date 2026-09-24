#!/usr/bin/env node
/**
 * GAS(gas/Code.gs)と同じ API をメモリ上で再現する開発用サーバー。
 *   node scripts/mock-server.mjs            # http://127.0.0.1:8787
 *   .env.local に VITE_GAS_URL=http://127.0.0.1:8787 / VITE_API_TOKEN=dev-token を書いて npm run dev
 * unlock は環境変数 MOCK_UNLOCK=g1c1,g1c2 で変えられる。先生の合言葉は "sensei"。
 *
 * 学校アカウント方式の再現: MOCK_EMAIL=s1@school.example で起動すると、その人が開いている扱いになる
 * (リクエストに __email を付けると、その回だけ別の人になる。テスト用)。
 * 名簿は MOCK_ROSTER="s1@school.example=1-2/7,s2@school.example=1-1/3"、先生は MOCK_TEACHERS。
 */
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 8787);
const TOKEN = process.env.MOCK_TOKEN ?? 'dev-token';
const UNLOCK = (process.env.MOCK_UNLOCK ?? 'g1c1').split(',');
const ALL = ['g1c1', 'g1c2', 'g1c3', 'g1c4', 'g1c5', 'g1c6', 'g1c7'];
const TEACHER_PASS = 'sensei';
const CLASSES = ['1-1', '1-2', '1-3'];
const MOCK_EMAIL = (process.env.MOCK_EMAIL ?? '').toLowerCase();
const TEACHERS = (process.env.MOCK_TEACHERS ?? 'teacher@school.example').toLowerCase().split(',');
/** 名簿: アカウント → 「クラス|番号」(本物は roster シート) */
const ROSTER = new Map(
  (process.env.MOCK_ROSTER ?? 's1@school.example=1-2/7,s2@school.example=1-1/3')
    .split(',')
    .filter(Boolean)
    .map((e) => {
      const [mail, cn] = e.split('=');
      const [c, n] = cn.split('/');
      return [mail.toLowerCase(), `${c}|${Number(n)}`];
    }),
);

/** key → { passHash, salt, save, updatedAt } */
const students = new Map();
const hash = (pass, salt) => createHash('sha256').update(`${salt}:${pass}`).digest('hex');
const key = (c, n) => `${c}|${n}`;

function handle(action, p) {
  if (p.token !== TOKEN) return { ok: false, error: 'bad_token' };
  if (action === 'ping') return { ok: true, serverTime: new Date().toISOString() };
  const email = String(p.__email ?? MOCK_EMAIL).toLowerCase();
  if (action === 'bootstrap') {
    let account = { mode: 'pass' };
    if (email) {
      const k = entryKey(email);
      const row = k ? students.get(k) : null;
      account = k
        ? { mode: 'google', teacher: TEACHERS.includes(email), registered: { class: k.split('|')[0], number: k.split('|')[1] }, player: row?.save ? { name: row.save.player.name, level: row.save.player.level } : null }
        : { mode: 'google', teacher: false, registered: null, player: null, error: 'not_in_roster' };
    }
    return { ok: true, unlock: UNLOCK, classes: CLASSES, config: { 'battle.hintsPerNode': 3 }, serverTime: new Date().toISOString(), account };
  }
  if (email) return handleAccount(action, p, email);
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
  if (action === 'save') return storeSave(row, p.save);
  if (action === 'load') return { ok: true, save: row.save };
  return { ok: false, error: 'unknown_action' };
}

/** アカウントの行のキー。先生はアカウントから決まる記号、生徒は名簿(なければ null) */
function entryKey(email) {
  if (TEACHERS.includes(email)) return key('teacher', 't' + createHash('sha256').update(email).digest('hex').slice(0, 6));
  return ROSTER.get(email) ?? null;
}

/** 学校アカウント方式(gas/Code.gs の handleAccount と同じ流れ。送られたクラス・番号は見ない) */
function handleAccount(action, p, email) {
  const k = entryKey(email);
  if (!k) return { ok: false, error: 'not_in_roster' };
  const teacher = TEACHERS.includes(email);
  const [cls, num] = k.split('|');
  if (action === 'login') {
    if (!students.has(k)) students.set(k, { passHash: '', salt: '', save: null, updatedAt: '' });
    const row = students.get(k);
    return { ok: true, isNew: !row.save, save: row.save, unlock: teacher ? ALL : UNLOCK, teacher, account: { class: cls, number: num } };
  }
  const row = students.get(k);
  if (!row) return { ok: false, error: 'not_registered' };
  if (action === 'save') return storeSave(row, p.save);
  if (action === 'load') return { ok: true, save: row.save };
  return { ok: false, error: 'unknown_action' };
}

function storeSave(row, save) {
  if (!save || typeof save !== 'object') return { ok: false, error: 'bad_save' };
  const incoming = String(save.updatedAt ?? '');
  if (row.updatedAt && incoming && incoming < row.updatedAt) return { ok: true, stored: false, save: row.save };
  row.save = save;
  row.updatedAt = incoming || new Date().toISOString();
  return { ok: true, stored: true, save: null };
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
  console.log(`mock GAS server: http://127.0.0.1:${PORT}  token=${TOKEN}  unlock=${UNLOCK.join(',')}  teacher pass=${TEACHER_PASS}  account=${MOCK_EMAIL || '(合言葉方式)'}`);
});
