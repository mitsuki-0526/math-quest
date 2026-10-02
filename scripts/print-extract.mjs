// 授業の プリント(画像)を ローカル LLM で 読み取り、問題の「特徴」を 集計する(docs/print-import.md)。
//   npm run print:extract -- refs/prints/加減        (フォルダの 中の png / jpg を すべて)
//   npm run print:extract -- refs/prints/加減 --model qwen3-vl:8b --passes 2 --width 900
// ・画像も 読み取りも この パソコンの 中だけ(Ollama: http://127.0.0.1:11434)。外の サービスには 送らない
// ・LLM には 式を 書き写させる だけ。項の数・数の 範囲などは プログラムが 計算する(print-features.mjs)
// ・2 回 読ませて 食い違った 問題は「要確認」に(符号・数の 読み違いを 見つける)
// 出力(すべて refs/ の 中 = Git に 上げない):
//   <フォルダ>/extract/<画像>.json   読み取りの 生データ(式を ふくむ。この パソコンだけ)
//   <フォルダ>-check.md               要確認の 一覧(式を ふくむ。先生が プリントと 見比べる 用)
//   <フォルダ>-features.md            特徴の 集計(式・問題文は ふくまない。Claude に 渡してよい)
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { featuresOf, isMathExpr, normalizeExpr, sameReading, summarize } from './print-features.mjs';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--'));
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
// 考えない 版(instruct)。qwen3-vl:8b(考える 版)は 1 回 5〜15 分 かかり、長いと 落ちた
const MODEL = opt('model', 'qwen3-vl:8b-instruct');
const PASSES = Number(opt('passes', '2'));
// 読ませる 前に 幅を 縮める。150dpi の A4(幅 1240px)の まま だと、ない 式を でっち上げて 書き続けた(2026-10-01)。
// 900px で 12 問 すべて 正しく 1 回 約 100 秒、620px でも 正しく 約 60 秒(字の 大きい 試しの プリント)
const WIDTH = Number(opt('width', '900'));
const HOST = 'http://127.0.0.1:11434';
if (!dir || !existsSync(dir)) {
  console.error('使い方: npm run print:extract -- refs/prints/<単元のフォルダ> [--model qwen3-vl:8b] [--passes 2] [--width 900]');
  process.exit(1);
}

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    level: { type: 'string' },
    answerPage: { type: 'boolean' },
    problems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          kind: { type: 'string', enum: ['計算', '方程式', '文章題', '図', 'その他'] },
          task: { type: 'string' },
          expression: { type: 'string' },
        },
        required: ['label', 'kind', 'task', 'expression'],
      },
    },
  },
  required: ['title', 'level', 'answerPage', 'problems'],
};

const RULES = `規則:
- 式は 半角で 書く。足す +、引く・負の符号 -、かける *、わる ÷(÷ は そのまま)、累乗 ^(例: (-3)^2、-3^2)、分数 a/b、小数 1.5、等号 =
- かっこ・符号は 画像の とおりに。(+5) の + も 省略しない。-(-3) の かっこも 省略しない
- 文字式は 文字も そのまま(例: 3x+2-5x)。かけ算の 記号が 省略されていれば 省略したまま
- 文章題・図の 問題は kind を「文章題」「図」に し、expression は 式に できれば 式、できなければ 空文字
- 答え・解き方・途中式は 書かない。計算しない
- 「次の 数を 素因数分解しなさい (1) 60」のように 数だけの 問題は、expression に その 数だけ(60)。「5×5 を 累乗で 表しなさい」は 5*5。「2, 9, 15 のうち 素数は」は 2,9,15
- 用語の 説明の 枠・(例)・ヒントは 問題では ない。書き写さない
- expression には 数と 式だけ を 入れる。文章は 入れない(指示は task に)
- task は 問題の 指示を 短い 言葉で(例: 計算、素因数分解、累乗で表す、素数を選ぶ、約数、方程式を解く)
- 読めない 所は ? を 入れる
- label は 問題番号(例: 1(1)、2(3))
- title: プリントの 題名(ページ 上の 見出し。例: 素数と素因数分解)。level: 題名の 近くに ある 段階(例: 定着、標準、発展。なければ 空文字)
- answerPage: ページに「解答」と 書いてある、または 答えが 書き込まれて いれば true(そのときも 問題は 書き写す)`;

const PROMPTS = [
  `これは 日本の 中学校の 数学の プリント(1 ページ)の 画像です。ページに ある すべての 問題について、問題番号と 式を 書き写してください。\n${RULES}`,
  // 2 回目は 符号と かっこに 注意を 向けて 読み直させる(1 回目と 食い違えば 要確認)
  `中学校の 数学の プリントの 画像です。各問題の 式を、符号(+ と -)・かっこ・累乗の 指数・分数に 特に 注意して、一文字ずつ 正確に 書き写してください。\n${RULES}`,
];

async function serverUp() {
  try {
    return (await fetch(`${HOST}/api/tags`)).ok;
  } catch {
    return false;
  }
}

/**
 * Ollama が 動いていなければ、GPU(Intel Arc: Vulkan)を 使う 設定で 起動する。
 * Flash Attention は 切る: Vulkan で 入れたままだと 画像を 渡した ところで 落ちる(2026-10-01 に 確かめた。文字だけなら 落ちない)
 */
async function ensureServer() {
  if (await serverUp()) return;
  console.log('Ollama を 起動します(GPU を 使う 設定: OLLAMA_VULKAN=1、OLLAMA_FLASH_ATTENTION=0)');
  spawn('ollama serve', { env: { ...process.env, OLLAMA_VULKAN: '1', OLLAMA_FLASH_ATTENTION: '0' }, detached: true, stdio: 'ignore', shell: true }).unref();
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await serverUp()) return;
  }
  throw new Error('Ollama が 起動しません');
}

/**
 * 幅を WIDTH に 縮めた 画像を extract/ に 作る(Windows の 標準の 部品で。道具を 増やさない)。
 * 道筋は 環境変数で 渡す(日本語の フォルダ名を コマンドの 文字列に 埋めない)
 */
function resized(file) {
  const out = join(dir, 'extract', `${basename(file, extname(file))}-${WIDTH}.png`);
  if (existsSync(out)) return out;
  const ps = [
    'Add-Type -AssemblyName System.Drawing',
    '$s = [System.Drawing.Image]::FromFile($env:MQ_IN)',
    '$w = [Math]::Min([int]$env:MQ_W, $s.Width); $h = [int]($s.Height * $w / $s.Width)',
    '$b = New-Object System.Drawing.Bitmap $w, $h; $g = [System.Drawing.Graphics]::FromImage($b)',
    "$g.InterpolationMode = 'HighQualityBicubic'; $g.DrawImage($s, 0, 0, $w, $h)",
    '$b.Save($env:MQ_OUT, [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $b.Dispose(); $s.Dispose()',
  ].join('; ');
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { env: { ...process.env, MQ_IN: file, MQ_OUT: out, MQ_W: String(WIDTH) } });
  if (r.status !== 0) throw new Error(`画像を 縮められません(${file}): ${r.stderr}`);
  return out;
}

async function readPage(file, prompt) {
  const images = [readFileSync(file).toString('base64')];
  const t0 = Date.now();
  // 少しずつ 受け取る(stream)。まとめて 待つと、遅い とき(GPU なし で 数分)に fetch が 5 分で 切れる
  const res = await fetch(`${HOST}/api/chat`, {
    method: 'POST',
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      // qwen3-vl:8b は 答える 前に 長く「考える」(1 回 5〜15 分、長いと 落ちた)。think: false でも
      // 本文に <think> を 書き続けた(2026-10-01)ので、考えない 版(qwen3-vl:8b-instruct)を 使うのが よい
      think: false,
      format: SCHEMA,
      options: { temperature: 0, num_ctx: 8192 },
      messages: [{ role: 'user', content: prompt, images }],
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  let content = '';
  let rest = '';
  const decoder = new TextDecoder();
  for await (const chunk of res.body) {
    rest += decoder.decode(chunk, { stream: true });
    const lines = rest.split('\n');
    rest = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      if (msg.error) throw new Error(`Ollama: ${msg.error}`);
      content += msg.message?.content ?? '';
    }
  }
  let parsed;
  try {
    // 「考える」文が 前に 付いても、JSON の 部分だけを 読む
    parsed = JSON.parse(content.slice(content.search(/\{\s*"(title|level|answerPage|problems)"/), content.lastIndexOf('}') + 1));
  } catch {
    parsed = { problems: [], error: '読み取りの 結果が JSON に ならなかった', raw: content };
  }
  return { seconds: (Date.now() - t0) / 1000, ...parsed };
}

async function gpuInUse() {
  try {
    const ps = await (await fetch(`${HOST}/api/ps`)).json();
    const m = ps.models?.find((x) => x.name.startsWith(MODEL.split(':')[0]));
    return m ? `${Math.round((m.size_vram / Math.max(1, m.size)) * 100)}% を GPU に 載せて 実行` : '不明';
  } catch {
    return '不明';
  }
}

/**
 * PDF が あれば 1 ページずつ 150dpi の png に する(pXX.png。すでに あれば しない)。
 * この パソコンの Python(pypdfium2)を 使う。なければ 画像に して 置いてもらう
 */
function pdfToImages() {
  for (const pdf of readdirSync(dir).filter((f) => /\.pdf$/i.test(f))) {
    const stem = basename(pdf, extname(pdf));
    if (readdirSync(dir).some((f) => f.startsWith(`${stem}-p`))) continue;
    const py = [
      'import os, pypdfium2 as pdfium',
      'pdf = pdfium.PdfDocument(os.environ["MQ_PDF"])',
      'for i, page in enumerate(pdf): page.render(scale=150/72).to_pil().save(os.path.join(os.environ["MQ_DIR"], f"{os.environ[\'MQ_STEM\']}-p{i+1:02d}.png"))',
    ].join('\n');
    const r = spawnSync('python', ['-c', py], { env: { ...process.env, MQ_PDF: join(dir, pdf), MQ_DIR: dir, MQ_STEM: stem } });
    if (r.status !== 0) throw new Error(`PDF を 画像に できません(${pdf})。Python と pypdfium2 が 要ります: ${r.stderr}`);
    console.log(`${pdf} を ページごとの 画像に しました`);
  }
}

/**
 * PDF に 埋め込まれた 文字(見出し)から、ページごとの 題名・段階・解答か・教科書の ページを 取る。
 * LLM の 読んだ 題名は ゆれる(章の 名前を 読む・読み違える。2026-10-02)ので、取れれば こちらを 使う。
 * 見出しの 形(段階 / 番号 / 解答 / 学校名 / 「1. 章の名前」/ 題名 / P.22～P.24)は この 問題集の もの。取れなければ LLM の 読み取りの まま
 */
function pdfMeta() {
  const meta = {};
  for (const pdf of readdirSync(dir).filter((f) => /\.pdf$/i.test(f))) {
    const stem = basename(pdf, extname(pdf));
    const py = [
      'import os, json, pypdfium2 as pdfium',
      'pdf = pdfium.PdfDocument(os.environ["MQ_PDF"])',
      'print(json.dumps([p.get_textpage().get_text_range() for p in pdf], ensure_ascii=True))',
    ].join('\n');
    const r = spawnSync('python', ['-c', py], { env: { ...process.env, MQ_PDF: join(dir, pdf) }, maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) continue;
    JSON.parse(r.stdout.toString()).forEach((text, i) => {
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const chapter = lines.findIndex((l) => /^\d+\.\s*\S/.test(l));
      const title = chapter >= 0 && lines[chapter + 1] && !/^P\./.test(lines[chapter + 1]) ? lines[chapter + 1].replace(/･/g, '・') : '';
      meta[`${stem}-p${String(i + 1).padStart(2, '0')}.png`] = {
        title,
        level: ['定着', '標準', '発展'].find((w) => lines.slice(0, 3).includes(w)) ?? '',
        answerPage: lines.slice(0, 4).includes('解答'),
        textbook: text.match(/P\.\d+～P\.\d+/)?.[0] ?? '',
      };
    });
  }
  return meta;
}

pdfToImages();
const pageMeta = pdfMeta();
const images = readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
if (images.length === 0) {
  console.error(`${dir} に 画像(png / jpg)か PDF が ありません`);
  process.exit(1);
}
mkdirSync(join(dir, 'extract'), { recursive: true });
const features = [];
const checks = [];
const answerPages = [];
const seen = new Set();
let duplicates = 0;
let totalSec = 0;
let readCount = 0;
for (const img of images) {
  const out = join(dir, 'extract', basename(img, extname(img)) + '.json');
  let passes;
  // 前に 読んだ 結果が あれば 使う(集計の しかたを 直した ときに 読み直さない)。--fresh で 読み直す
  if (existsSync(out) && !args.includes('--fresh')) {
    passes = JSON.parse(readFileSync(out, 'utf8')).passes;
  } else if (pageMeta[img]?.title && pageMeta[img].answerPage) {
    // PDF の 見出しで 解答・解説の ページと 分かれば 読まない(集計に 入れないので。84 ページで 約 45 分 かかっていた)
    passes = [{ seconds: 0, answerPage: true, problems: [] }];
  } else {
    if (readCount++ === 0) await ensureServer();
    const file = resized(join(dir, img));
    passes = [await readPage(file, PROMPTS[0])];
    // 解答の ページは 2 回目を 読まない(集計にも 入れない。同じ 問題を 2 回 数えないため)
    if (!passes[0].answerPage) for (let k = 1; k < PASSES; k++) passes.push(await readPage(file, PROMPTS[k % PROMPTS.length]));
    totalSec += passes.reduce((s, p) => s + p.seconds, 0);
    // 取り出せなかった 結果は 残さない(次に 流した ときに 読み直す)
    if (passes.some((p) => p.error)) console.warn(`${img}: 読み取りの 結果を 取り出せませんでした(${passes.find((p) => p.error).error})`);
    else writeFileSync(out, JSON.stringify({ model: MODEL, image: img, passes }, null, 2));
  }
  const [first0, ...others] = passes;
  // PDF の 見出しから 取れた 題名・段階・解答かを 優先する
  const m = pageMeta[img];
  const first = m?.title ? { ...first0, title: m.title, level: m.level || first0.level, answerPage: m.answerPage, textbook: m.textbook } : first0;
  if (m?.title && m.answerPage !== !!first0.answerPage) console.warn(`${img}: 解答の ページかの 判定が LLM と 見出しで ちがう(見出しを 使う)`);
  console.log(`${img}: ${first.title ?? ''}${first.level ? `(${first.level})` : ''} ${(first.problems ?? []).length} 問${first.answerPage ? '(解答の ページ → 集計しない)' : ''}(${passes.map((p) => `${p.seconds.toFixed(0)}秒`).join(' / ')})`);
  if (first.answerPage) {
    answerPages.push(img);
    continue;
  }
  for (const p of first.problems ?? []) {
    if (!p.expression || p.expression.includes('?') || !isMathExpr(p.expression)) {
      checks.push({ img, label: p.label, why: !p.expression ? '式に なっていない' : p.expression.includes('?') ? '読めない 所が ある' : '式の 欄に 文章が ある', a: p.expression ?? '', b: '' });
      continue;
    }
    // ほかの 回で 同じ 番号の 読み取りと 比べる
    const differ = others.map((o) => (o.problems ?? []).find((q) => q.label === p.label)).find((q) => !q || !sameReading(q.expression, p.expression));
    if (differ !== undefined) {
      checks.push({ img, label: p.label, why: differ ? '2 回の 読み取りが 食い違う' : '2 回目で 見つからない', a: p.expression, b: differ?.expression ?? '' });
      continue;
    }
    // 同じ 問題が 別の ページにも ある(同じ 単元の 別の プリント)ときは 1 回だけ 数える
    const title = (first.title ?? '').trim() || '(題名なし)';
    const key = `${title}|${p.task}|${normalizeExpr(p.expression)}`;
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    features.push({ img, title, level: (first.level ?? '').trim(), textbook: first.textbook ?? '', label: p.label, kind: p.kind, task: p.task, ...featuresOf(p.expression) });
  }
}
const gpu = readCount ? await gpuInUse() : '前の 読み取りを 使用';
// 先に 別の 設定で 動いていた Ollama(タスクトレイの アプリ など)を 使うと GPU に 載らず、1 ページ 数分 かかる
if (gpu.startsWith('0%')) console.warn('GPU を 使っていません。Ollama を いったん 終了(タスクトレイ → Quit)してから やり直すと、この 道具が GPU の 設定で 起動します');

// 要確認(式を ふくむ。この パソコンで 先生が 見る 用)
writeFileSync(
  `${dir}-check.md`,
  [`# 要確認(${dir})`, '', 'プリントと 見比べて、正しい 式を 教えてください。ここには 式が 入っているので、外には 出さない。', '', '| 画像 | 番号 | 理由 | 1 回目 | 2 回目 |', '|---|---|---|---|---|', ...checks.map((c) => `| ${c.img} | ${c.label} | ${c.why} | \`${c.a}\` | \`${c.b}\` |`)].join('\n'),
);

// 特徴の 集計(式・問題文は ふくまない)。プリントの 題名ごと(1 章を まとめた PDF でも 単元ごとに 分かる)
const all = summarize(features);
const titles = [...new Set(features.map((f) => f.title))];
const lines = [
  `# プリントの 特徴(${basename(dir)})`,
  '',
  `- モデル: ${MODEL}(${PASSES} 回 読み取り)、${images.length} ページ(うち 解答の ページ ${answerPages.length})、${readCount ? `1 ページ 平均 ${(totalSec / readCount).toFixed(0)} 秒、` : ''}${gpu}`,
  `- 読み取れた 問題 ${all.total} 問(要確認 ${checks.length} 問と、ほかの ページと 同じ 問題 ${duplicates} 問は 集計に 入れていない)`,
  `- プリントの 題名: ${titles.length}(下に 題名ごと)`,
  ...titles.flatMap((t) => {
    const fs = features.filter((f) => f.title === t);
    const levels = [...new Set(fs.map((f) => f.level).filter(Boolean))].join('・');
    const pages = [...new Set(fs.map((f) => f.textbook).filter(Boolean))].join('、');
    return ['', `## ${t}${levels ? `(${levels})` : ''}${pages ? ` 教科書 ${pages}` : ''}`, '', ...section(fs)];
  }),
];
function section(fs) {
  const s = summarize(fs);
  return [
    `- 問題 ${s.total} 問。段階ごと: ${list(countLevels(fs))}`,
    `- 問題の 指示: ${list(s.tasks)}`,
    `- 項の 数: ${Object.entries(s.terms).map(([k, v]) => `${k} 項 ${v}`).join('、')}`,
    `- いちばん 大きい 数: ${s.maxNumber}、2 けたの 数を ふくむ 問題: ${s.twoDigitShare}`,
    `- かっこ ${s.parenShare}、累乗 ${s.powerShare}、小数 ${s.decimalShare}、分数 ${s.fractionShare}`,
    `- 演算: ${list(s.ops)}`,
    ...(s.factor
      ? [
          `- 数 1 つの 問題 ${s.factor.total} 問: 範囲 ${s.factor.min}〜${s.factor.max}(${list(s.factor.digits, 'けた')})、素因数の 個数 ${list(s.factor.primeCount, '個')}、最大の 素因数 ${list(s.factor.largestPrime)}、最大の 指数 ${list(s.factor.maxExp)}、素数そのもの ${s.factor.primes}`,
        ]
      : []),
    '',
    '| 形(数を # に した 形) | 問題数 | 項の数 | いちばん大きい数 | 2 けたの 数(1 問の 最多) |',
    '|---|---|---|---|---|',
    ...s.shapes.slice(0, 12).map((g) => `| \`${g.shape}\` | ${g.count} | ${g.terms} | ${g.maxNumber} | ${g.twoDigitMax} |`),
    ...(s.shapes.length > 12 ? [`| ほか ${s.shapes.length - 12} 形 | ${s.shapes.slice(12).reduce((a, g) => a + g.count, 0)} | | | |`] : []),
  ];
}
function countLevels(fs) {
  const m = {};
  for (const f of fs) m[f.level || '不明'] = (m[f.level || '不明'] ?? 0) + 1;
  return m;
}
function list(counts, unit = '') {
  return Object.entries(counts)
    .map(([k, v]) => `${k || 'なし'}${unit} ${v}`)
    .join('、');
}
writeFileSync(`${dir}-features.md`, lines.join('\n'));
console.log(lines.slice(0, 6).join('\n'));
console.log(`→ ${dir}-features.md(Claude に 渡してよい)、${dir}-check.md(要確認 ${checks.length} 問。この パソコンだけ)`);
