#!/usr/bin/env node
/**
 * 台本(docs/script/<grade>/*.md)を会話スクリプトデータ(JSON)に変換する。
 *   node scripts/convert-script.mjs            # docs/script/g1 → src/data/grade1/scripts/*.json
 *
 * 変換するのは「## ID 名前」で始まるシーンのうち、セリフを含むもの。
 * 表(敵セリフ表・小ネタ)は対象外。ボス戦中のセリフは enemies.ts の phases に手で書く。
 * 書式は docs/script/README.md を参照。
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const SRC = process.argv[2] ?? 'docs/script/g1';
const OUT = process.argv[3] ?? 'src/data/grade1/scripts';

/** 台本の人物名 → キャラID(characters.ts)。無い名前は npc:<名前> として表示名をそのまま使う */
const NAME_TO_ID = {
  ユウ: 'player',
  ピタ: 'pita',
  テオ: 'teo',
  村長: 'elder',
  レナ: 'rena',
  ノア: 'noa',
  ゼノン: 'zenon',
  メイ: 'mei',
  エックス: 'cat_x',
  符号王ネガ: 'king_nega',
  仮面の書記官: 'masked_scribe',
  '未知なる影 X': 'shadow_x',
  ナラビ: 'narabi',
  サカサ: 'sakasa',
  円環の番人: 'ring_guardian',
  立体王ポリ: 'king_poly',
  歪みの使徒: 'apostle',
};

/** 台本の背景名 → 素材ID。台本は `village_shop` のように接頭辞なしで書く */
const bgId = (name) => (name.startsWith('bg_') ? name : `bg_${name}`);

const SKIP_KINDS = ['敵セリフ', '小ネタ', 'ボス戦中', 'システム'];

function parseFile(path) {
  const text = readFileSync(path, 'utf8');
  const lines = text.split(/\r?\n/);
  const scenes = [];
  let cur = null;
  let inTable = false;
  let face = {};

  const flush = () => {
    if (cur && cur.lines.length) scenes.push(cur);
    cur = null;
  };

  for (let raw of lines) {
    const line = raw.replace(/\s+$/, '');
    // シーン見出し
    const h = /^## ([A-Z]+\d*-\d+|E-\d+|[A-Z]\d*-\d+)\s+(.+)$/.exec(line);
    if (h) {
      flush();
      cur = { id: h[1], name: h[2].trim(), kind: '', bg: undefined, actors: [], lines: [], source: basename(path) };
      face = {};
      inTable = false;
      continue;
    }
    if (!cur) continue;
    if (/^## /.test(line)) {
      flush();
      continue;
    }
    if (/^### /.test(line)) continue; // 設計 / 台本 の小見出し
    if (/^\|/.test(line)) {
      inTable = true;
      continue;
    }
    if (inTable && line.trim() === '') {
      inTable = false;
      continue;
    }
    if (inTable) continue;

    // メタ情報
    let m;
    if ((m = /^- 種類:\s*(.+)$/.exec(line))) {
      cur.kind = m[1].trim();
      continue;
    }
    if ((m = /^- 背景:\s*(\S+)/.exec(line))) {
      cur.bg = bgId(m[1]);
      continue;
    }
    if ((m = /^- 登場:\s*(.+)$/.exec(line))) {
      cur.actors = m[1]
        .split(/[、,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((n) => NAME_TO_ID[n.replace(/\(.*?\)/g, '').trim()] ?? `npc:${n}`);
      continue;
    }
    if (/^- /.test(line)) continue; // 発生・所要・戦闘・概念 など

    // 本文
    if ((m = /^\[(.+)\]$/.exec(line.trim()))) {
      cur.lines.push({ label: m[1] });
      continue;
    }
    if ((m = /^→\s*(\S+)/.exec(line.trim()))) {
      cur.lines.push({ goto: m[1] });
      continue;
    }
    if (/^▶ 選択肢/.test(line.trim())) {
      cur.lines.push({ choice: [] });
      continue;
    }
    if ((m = /^\s+\d+\.\s*「(.+?)」\s*(?:\((.+?)\))?\s*→\s*(\S+)/.exec(line))) {
      const last = cur.lines[cur.lines.length - 1];
      if (last && last.choice) last.choice.push({ text: m[1], goto: m[3], tag: m[2] });
      continue;
    }
    if ((m = /^※ 表情:\s*(\S+)\s+(\S+)/.exec(line.trim()))) {
      const id = NAME_TO_ID[m[1]] ?? `npc:${m[1]}`;
      face[id] = m[2];
      continue;
    }
    if ((m = /^※ 効果:\s*(.+)$/.exec(line.trim()))) {
      for (const e of parseEffects(m[1])) cur.lines.push(e);
      continue;
    }
    if ((m = /^※ (演出|図):\s*(.+)$/.exec(line.trim()))) {
      const note = m[2];
      const bgm = /場面転換[、,]\s*(\S+)/.exec(note);
      cur.lines.push({ note, ...(bgm ? { bg: bgId(guessBg(bgm[1])) } : {}) });
      continue;
    }
    // セリフ: 人物「本文」 / 人物(声)「本文」
    if ((m = /^([^\s「」]+?)(?:\((声のみ|声)\))?「(.+)」$/.exec(line.trim()))) {
      const nameRaw = m[1];
      const id = NAME_TO_ID[nameRaw] ?? `npc:${nameRaw}`;
      const entry = { who: id, say: m[3] };
      if (face[id]) entry.face = face[id];
      if (m[2]) entry.voiceOnly = true;
      cur.lines.push(entry);
      continue;
    }
    // 二人同時「「…」」
    if ((m = /^(.+?)「「(.+)」」$/.exec(line.trim()))) {
      cur.lines.push({ who: `npc:${m[1]}`, say: m[2] });
      continue;
    }
  }
  flush();
  const kept = scenes.filter((s) => !SKIP_KINDS.some((k) => s.kind.includes(k)));
  // 飛び先の検査: 台本の書き間違いをここで見つける
  for (const sc of kept) {
    const labels = new Set(sc.lines.filter((l) => l.label).map((l) => l.label));
    for (const l of sc.lines) {
      if (l.goto && !labels.has(l.goto)) console.warn(`  [警告] ${basename(path)} ${sc.id}: 飛び先「${l.goto}」が見つかりません`);
      for (const o of l.choice ?? []) if (!labels.has(o.goto)) console.warn(`  [警告] ${basename(path)} ${sc.id}: 選択肢の飛び先「${o.goto}」が見つかりません`);
    }
  }
  return kept;
}

/** 「※ 効果: …」を効果オブジェクトに分解する。読めないものは note として残す */
function parseEffects(text) {
  const out = [];
  for (const part of text.split(/[。]/).map((s) => s.trim()).filter(Boolean)) {
    let m;
    if ((m = /アイテム入手\s+(.+)/.exec(part))) {
      const auto = /自動装備/.test(m[1]);
      for (const it of m[1].replace(/\(自動装備\)/, '').split(/[,、]/)) {
        const mm = /^\s*([a-z_0-9]+)(?:\s*×(\d+))?/.exec(it);
        if (mm) out.push({ effect: 'item', id: mm[1], count: Number(mm[2] ?? 1), equip: auto });
      }
      continue;
    }
    if ((m = /フラグ\s+([a-z_0-9]+)/.exec(part))) {
      out.push({ effect: 'flag', key: m[1] });
      continue;
    }
    if ((m = /仲間加入\s+([a-z_]+)/.exec(part))) {
      out.push({ effect: 'party', id: m[1] });
      continue;
    }
    if ((m = /章クリア\s+([a-z0-9]+)/.exec(part))) {
      out.push({ effect: 'chapterClear', id: m[1] });
      continue;
    }
    if ((m = /入力キー解放\s+(.+)/.exec(part))) {
      const keys = m[1].split(/[\s,、]+/).filter(Boolean);
      out.push({ effect: 'unlockKeys', keys });
      continue;
    }
    if (/ボス戦開始/.test(part)) {
      out.push({ effect: 'startBattle' });
      continue;
    }
    if ((m = /章タイトル「(.+?)」/.exec(part))) {
      out.push({ effect: 'title', text: m[1] });
      continue;
    }
    if ((m = /表示名を「(.+?)」→「(.+?)」/.exec(part))) {
      out.push({ effect: 'rename', from: m[1], to: m[2] });
      continue;
    }
    if (/`\{player\}` を設定/.test(part) || /名前を入力/.test(part)) {
      out.push({ effect: 'nameInput' });
      continue;
    }
    out.push({ note: `効果: ${part}` });
  }
  return out;
}

function guessBg(s) {
  const map = { テオ商店: 'village_shop', はじまりの村: 'village_square', 村はずれの橋: 'village_bridge' };
  return map[s] ?? s;
}

mkdirSync(OUT, { recursive: true });
const files = readdirSync(SRC).filter((f) => /^\d+_.*\.md$/.test(f));
const index = [];
for (const f of files) {
  const scenes = parseFile(join(SRC, f));
  const outName = f.replace(/\.md$/, '.json');
  writeFileSync(join(OUT, outName), JSON.stringify(scenes, null, 2) + '\n', 'utf8');
  index.push({ file: outName, scenes: scenes.map((s) => ({ id: s.id, name: s.name, kind: s.kind, lines: s.lines.length })) });
  console.log(`${f}: ${scenes.length} scenes, ${scenes.reduce((a, s) => a + s.lines.length, 0)} lines`);
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');
