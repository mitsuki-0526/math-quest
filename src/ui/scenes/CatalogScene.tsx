import { useMemo, useState } from 'preact/hooks';
import { popScene } from '@/engine/scenes';
import { useStore } from '@/engine/store';
import { grade1 } from '@/data/grade1/chapters';
import '@/data/grade1/problems';
import { getTemplate, type Difficulty, type Problem } from '@/math/template';
import {
  catalogNodes,
  sampleProblems,
  reviewStore,
  updateMark,
  markKey,
  markedList,
  marksToText,
  markSent,
  clearMarks,
  RATING_LABEL,
  type CatalogNode,
  type Rating,
} from '@/engine/catalog';
import { api, hasServer, describeError } from '@/engine/api';
import { getIdentity, syncStore } from '@/engine/sync';
import { Button, Panel } from '@/ui/components/Ui';
import { Tex } from '@/ui/components/Tex';
import { Figure } from '@/ui/components/Figure';
import { ProblemPrompt, answerTex } from '@/ui/components/ProblemView';

/**
 * 問題の見本帳(先生用)。地点を選ぶと、そこで実際に出る「出題タイプ × ★」の問題を 5 問ずつ並べる。
 * 遊ばずに難しさを確かめ、印(やさしい/ちょうど/むずかしい)・一言・「気になる」を付けて、
 * スプレッドシートの review シートへ送るか、文字でコピーしてチャットに貼る(docs/difficulty.md の流れ)
 */
const PER_GROUP = 5;

export function CatalogScene() {
  const sync = useStore(syncStore);
  const marks = useStore(reviewStore);
  const [chapterIdx, setChapterIdx] = useState(0);
  const chapter = grade1.chapters[chapterIdx];
  const nodes = useMemo(() => catalogNodes(chapter), [chapter]);
  const [nodeId, setNodeId] = useState(nodes[0]?.id);
  const node = nodes.find((n) => n.id === nodeId) ?? nodes[0];
  const [seed, setSeed] = useState(1);
  const [showAnswers, setShowAnswers] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const marked = markedList();
  const unsent = marked.filter((m) => m.dirty);
  const canSend = hasServer() && sync.teacher;
  const countFor = (n: CatalogNode) => marked.filter((m) => m.node === n.id).length;

  function pickChapter(i: number) {
    setChapterIdx(i);
    setNodeId(catalogNodes(grade1.chapters[i])[0]?.id);
  }

  async function send() {
    const id = getIdentity();
    if (!id || unsent.length === 0) return;
    setBusy(true);
    setStatus(null);
    try {
      await api.review(
        id,
        unsent.map((m) => ({ node: m.node, template: m.template, star: m.star, rating: m.rating ? RATING_LABEL[m.rating] : '', comment: m.comment, flagged: m.flagged })),
      );
      markSent(unsent.map((m) => markKey(m.node, m.template, m.star)));
      setStatus(`${unsent.length} 件を スプレッドシートの review シートに 送りました`);
    } catch (e) {
      setStatus(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    const textOut = marksToText(marked, (t) => getTemplate(t).title);
    try {
      await navigator.clipboard.writeText(textOut);
      setStatus('印を 文字で コピーしました。チャットに 貼り付けてください');
    } catch {
      // クリップボードが使えない環境では、選んでコピーできる欄に出す
      setStatus(textOut);
    }
  }

  return (
    <div class="scene scene-catalog">
      <Panel title="📖 問題の見本帳(先生用)" class="catalog-head">
        <p class="muted">
          地点ごとに、実際に出る問題を ★ ごとに {PER_GROUP} 問ずつ 並べています。気になる所に 印を つけてください。印は この端末に 残ります。
        </p>
        <div class="catalog-chapters" role="tablist">
          {grade1.chapters.map((c, i) => (
            <button key={c.id} type="button" role="tab" aria-selected={i === chapterIdx} class={`btn ${i === chapterIdx ? 'btn-primary' : ''}`} onClick={() => pickChapter(i)}>
              第{c.number}章
            </button>
          ))}
        </div>
        <div class="row catalog-actions">
          <label class="row">
            <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers((e.target as HTMLInputElement).checked)} />
            <span>答えを 表示</span>
          </label>
          <Button onClick={() => setSeed((s) => s + 1)}>🔄 別の 問題を 見る</Button>
          <span class="muted">印: {marked.length} 件(未送信 {unsent.length})</span>
          {canSend && (
            <Button primary disabled={busy || unsent.length === 0} onClick={() => void send()}>
              {busy ? '送っています…' : 'スプレッドシートに 送る'}
            </Button>
          )}
          <Button disabled={marked.length === 0} onClick={() => void copy()}>
            📋 文字で コピー
          </Button>
          <Button disabled={marked.length === 0} onClick={() => confirm('印を すべて 消します。よろしいですか?') && clearMarks()}>
            印を 消す
          </Button>
          <Button onClick={popScene}>◀ もどる</Button>
        </div>
        {status && <pre class="catalog-status">{status}</pre>}
      </Panel>

      <div class="catalog-body">
        <nav class="catalog-nodes" aria-label="地点">
          {nodes.map((n) => (
            <button key={n.id} type="button" class={`catalog-node ${n.id === node?.id ? 'active' : ''}`} onClick={() => setNodeId(n.id)}>
              <span>{n.name}</span>
              <small>
                ★{n.stars.at(-1) === 1 ? '1' : `1〜${n.stars.at(-1)}`}
                {countFor(n) > 0 && ` ・ 印 ${countFor(n)}`}
              </small>
            </button>
          ))}
        </nav>
        <div class="catalog-groups">
          {node &&
            node.templates.map((t) =>
              node.stars.map((star) => <Group key={`${node.id}|${t}|${star}|${seed}`} node={node} templateId={t} star={star} seed={seed} showAnswers={showAnswers} mark={marks[markKey(node.id, t, star)]} />),
            )}
        </div>
      </div>
    </div>
  );
}

function Group({
  node,
  templateId,
  star,
  seed,
  showAnswers,
  mark,
}: {
  node: CatalogNode;
  templateId: string;
  star: Difficulty;
  seed: number;
  showAnswers: boolean;
  mark: ReturnType<typeof reviewStore.get>[string] | undefined;
}) {
  const problems = useMemo(() => sampleProblems(templateId, star, PER_GROUP, seed), [templateId, star, seed]);
  const base = { node: node.id, nodeName: node.name, template: templateId, star };
  const flagged = new Set(mark?.flagged ?? []);
  const setRating = (r: Rating) => updateMark(base, (m) => (m.rating = m.rating === r ? undefined : r));
  const toggleFlag = (p: Problem) =>
    updateMark(base, (m) => {
      m.flagged = m.flagged.includes(p.promptText) ? m.flagged.filter((f) => f !== p.promptText) : [...m.flagged, p.promptText];
    });

  return (
    <section class={`catalog-group rpg-window ${mark?.rating ? `rated-${mark.rating}` : ''}`}>
      <header class="catalog-group-head">
        <b>
          {getTemplate(templateId).title} ・ {'★'.repeat(star)}
          {'☆'.repeat(3 - star)}
        </b>
        <small class="muted">{templateId}</small>
      </header>
      <ol class="catalog-problems">
        {problems.map((p) => (
          <li key={p.key} class={flagged.has(p.promptText) ? 'flagged' : ''}>
            <div class="catalog-problem">
              {p.figure && (
                <div class="question-figure">
                  <Figure spec={p.figure} />
                </div>
              )}
              <ProblemPrompt problem={p} />
              {/* 選択式は 誤答の選択肢も 難しさを 左右するので 並べる */}
              {p.answer.kind === 'choice' && (
                <div class="catalog-options">
                  {p.answer.options.map((o, i) => (
                    <span key={i}>
                      <Tex tex={o} />
                    </span>
                  ))}
                </div>
              )}
              {showAnswers && (
                <span class="catalog-answer">
                  → <Tex tex={answerTex(p)} />
                </span>
              )}
            </div>
            <button type="button" class={`btn catalog-flag ${flagged.has(p.promptText) ? 'btn-primary' : ''}`} aria-pressed={flagged.has(p.promptText)} onClick={() => toggleFlag(p)}>
              気になる
            </button>
          </li>
        ))}
      </ol>
      <div class="row catalog-rate">
        {(['easy', 'ok', 'hard'] as Rating[]).map((r) => (
          <button key={r} type="button" class={`btn ${mark?.rating === r ? 'btn-primary' : ''}`} aria-pressed={mark?.rating === r} onClick={() => setRating(r)}>
            {RATING_LABEL[r]}
          </button>
        ))}
        <input
          class="catalog-comment"
          type="text"
          maxLength={200}
          placeholder="一言(例: 2けたは まだ早い)"
          value={mark?.comment ?? ''}
          onInput={(e) => updateMark(base, (m) => (m.comment = (e.target as HTMLInputElement).value))}
        />
      </div>
    </section>
  );
}
