import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { popScene } from '@/engine/scenes';
import { useStore } from '@/engine/store';
import { grade1 } from '@/data/grade1/chapters';
import '@/data/grade1/problems';
import { answerToText, getTemplate } from '@/math/template';
import { texToPlain } from '@/math/texPlain';
import {
  buildJudgeQueue,
  judgeStore,
  setJudgment,
  clearJudgment,
  clearAllJudgments,
  markJudgmentsSent,
  judgmentsToText,
  NG_REASONS,
  type JudgeItem,
} from '@/engine/judging';
import { api, hasServer, describeError } from '@/engine/api';
import { getIdentity, syncStore } from '@/engine/sync';
import { Button } from '@/ui/components/Ui';
import { Tex } from '@/ui/components/Tex';
import { Figure } from '@/ui/components/Figure';
import { ProblemPrompt, answerTex } from '@/ui/components/ProblemView';

/**
 * 1 問ずつ ○/× を 付ける 判定画面(先生用)。キーボード: ○ = → か O、× = ← か X(理由は 1〜8、Enter で 決定)、
 * とばす = ↓、1 つ もどる = Z。タッチでも 大きな ボタンで 同じことが できる。
 * 判定は この端末に 残り、スプレッドシートの review シートへ 送るか、文字で コピーして チャットに 貼る
 */
const PER_OPTIONS = [5, 10, 20];

export function JudgeScene() {
  const sync = useStore(syncStore);
  const judgments = useStore(judgeStore);
  const [chapterIdx, setChapterIdx] = useState(0);
  const [per, setPer] = useState(10);
  const chapter = grade1.chapters[chapterIdx];
  const queue = useMemo(() => buildJudgeQueue(chapter, per), [chapter, per]);
  const firstOpen = () => Math.max(0, queue.findIndex((q) => !judgeStore.get()[q.id]));
  // 位置・履歴・× の 理由は ref に 持つ。キーを 速く 続けて 押しても、いつも 最新の 状態で 動くように
  // (state だと 次の 描画まで 古い 問題を 指していて、2 回目の ○ が 前の 問題を 判定しなおしていた)
  const live = useRef({ cursor: firstOpen(), history: [] as number[], ngOpen: false, picked: [] as string[], note: '' });
  const [, rerender] = useState(0);
  const update = (patch: Partial<typeof live.current>) => {
    Object.assign(live.current, patch);
    rerender((n) => n + 1);
  };
  const { cursor, history, ngOpen, picked, note } = live.current;
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const noteRef = useRef<HTMLInputElement>(null);

  // 章・問題数を 変えたら、まだ 判定していない 問題から
  useEffect(() => {
    update({ cursor: firstOpen(), history: [], ngOpen: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  const item: JudgeItem | undefined = queue[cursor];
  const inQueue = queue.filter((q) => judgments[q.id]);
  const okCount = inQueue.filter((q) => judgments[q.id].verdict === 'ok').length;
  const ngCount = inQueue.length - okCount;
  const all = Object.values(judgments);
  const unsent = all.filter((j) => !j.sent);
  const canSend = hasServer() && sync.teacher;

  /** 次の まだ 判定していない 問題(最後まで 行ったら 先頭から さがす。ぜんぶ 判定したら queue.length) */
  function nextOpen(from: number): number {
    const js = judgeStore.get();
    for (let k = 1; k <= queue.length; k++) {
      const i = (from + k) % queue.length;
      if (!js[queue[i].id]) return i;
    }
    return queue.length;
  }

  function decide(verdict: 'ok' | 'ng', reason = '') {
    const s = live.current;
    const it = queue[s.cursor];
    if (!it) return;
    setJudgment(it, verdict, reason, texToPlain(answerTex(it.problem)));
    update({ history: [...s.history, s.cursor], ngOpen: false, picked: [], note: '', cursor: nextOpen(s.cursor) });
  }

  function confirmNg() {
    const s = live.current;
    decide('ng', [...s.picked, s.note.trim()].filter(Boolean).join(' / '));
  }

  function skip() {
    const s = live.current;
    if (!queue[s.cursor]) return;
    update({ history: [...s.history, s.cursor], cursor: (s.cursor + 1) % queue.length });
  }

  function undo() {
    const s = live.current;
    const prev = s.history.at(-1);
    if (prev === undefined) return;
    clearJudgment(queue[prev].id);
    update({ history: s.history.slice(0, -1), ngOpen: false, cursor: prev });
  }

  // キーボードだけで どんどん 判定できるように
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = (e.target as HTMLElement | null)?.closest('input, textarea, select');
      if (live.current.ngOpen) {
        if (e.key === 'Enter') confirmNg();
        else if (e.key === 'Escape') update({ ngOpen: false });
        else if (!typing && /^[1-8]$/.test(e.key)) togglePick(NG_REASONS[Number(e.key) - 1]);
        else return;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (typing) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowright' || k === 'o') decide('ok');
      else if (k === 'arrowleft' || k === 'x') openNg();
      else if (k === 'arrowdown' || k === 's') skip();
      else if (k === 'z') undo();
      else return;
      e.preventDefault();
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  function openNg() {
    if (!queue[live.current.cursor]) return;
    update({ ngOpen: true, picked: [], note: '' });
    setTimeout(() => noteRef.current?.blur(), 0);
  }

  function togglePick(r: string) {
    const p = live.current.picked;
    update({ picked: p.includes(r) ? p.filter((x) => x !== r) : [...p, r] });
  }

  async function send() {
    const id = getIdentity();
    if (!id || unsent.length === 0) return;
    setBusy(true);
    setStatus(null);
    try {
      // 見本帳の 印と 同じ review シートへ(地点の 列は「judge」)。GAS を 更新しなくて よい
      for (let i = 0; i < unsent.length; i += 150) {
        const chunk = unsent.slice(i, i + 150);
        await api.review(
          id,
          chunk.map((j) => ({ node: 'judge', template: j.templateId, star: j.star, rating: j.verdict === 'ok' ? '○' : '×', comment: j.reason, flagged: [`${j.id} ${j.question} → ${j.answer}`] })),
        );
        markJudgmentsSent(chunk.map((j) => j.id));
      }
      setStatus(`${unsent.length} 件を スプレッドシートの review シートに 送りました(地点の 列が「judge」の 行)`);
    } catch (e) {
      setStatus(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    const t = judgmentsToText(all);
    try {
      await navigator.clipboard.writeText(t);
      setStatus(`${all.length} 件を 文字で コピーしました。チャットに 貼り付けてください`);
    } catch {
      setStatus(t);
    }
  }

  const done = cursor >= queue.length;
  const p = item?.problem;
  const mine = item ? judgments[item.id] : undefined;

  return (
    <div class="scene scene-judge">
      <div class="judge-top rpg-window">
        <div class="row judge-tabs">
          {grade1.chapters.map((c, i) => (
            <button key={c.id} type="button" class={`btn btn-small ${i === chapterIdx ? 'btn-primary' : ''}`} onClick={() => setChapterIdx(i)}>
              第{c.number}章
            </button>
          ))}
          <label class="row">
            <span class="muted">1 種類</span>
            <select value={per} onChange={(e) => setPer(Number((e.target as HTMLSelectElement).value))}>
              {PER_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} 問
                </option>
              ))}
            </select>
          </label>
        </div>
        <div class="row judge-tabs">
          <span class="judge-progress">
            {inQueue.length} / {queue.length} 問 ・ ○ {okCount} ・ × {ngCount}
          </span>
          {canSend && (
            <Button primary disabled={busy || unsent.length === 0} onClick={() => void send()}>
              {busy ? '送っています…' : `スプレッドシートに 送る(${unsent.length})`}
            </Button>
          )}
          <Button disabled={all.length === 0} onClick={() => void copy()}>
            📋 文字で コピー
          </Button>
          <Button disabled={all.length === 0} onClick={() => confirm('判定を すべて 消します。よろしいですか?') && clearAllJudgments()}>
            消す
          </Button>
          <Button onClick={popScene}>◀ もどる</Button>
        </div>
        <div class="judge-bar">
          <i style={{ width: `${(inQueue.length / Math.max(1, queue.length)) * 100}%` }} />
        </div>
        {status && <pre class="catalog-status">{status}</pre>}
      </div>

      {done || !item || !p ? (
        <div class="rpg-window judge-card judge-done">
          <p>この章の 問題は ぜんぶ 判定しました(○ {okCount} ・ × {ngCount})。</p>
          <p class="muted">「スプレッドシートに 送る」か「文字で コピー」で 知らせてください。問題数を 増やすと 続きを 判定できます。</p>
        </div>
      ) : (
        <div class="rpg-window judge-card">
          <div class="question-meta">
            <span>
              {getTemplate(item.templateId).title} ・ {'★'.repeat(item.star)}
              {'☆'.repeat(3 - item.star)}
            </span>
            <span class="muted">
              {cursor + 1} 問目 {mine ? `(判定ずみ: ${mine.verdict === 'ok' ? '○' : '×'})` : ''}
            </span>
          </div>
          {p.figure && (
            <div class="question-figure">
              <Figure spec={p.figure} />
            </div>
          )}
          <div class="judge-question">
            <ProblemPrompt problem={p} />
          </div>
          {p.answer.kind === 'choice' && (
            <ol class="judge-options">
              {p.answer.options.map((o, i) => (
                <li key={i} class={i === (p.answer as { correct: number }).correct ? 'correct' : ''}>
                  <Tex tex={o} />
                </li>
              ))}
            </ol>
          )}
          <p class="judge-answer">
            <b>正解:</b> <Tex tex={answerTex(p)} />
          </p>
          <div class="judge-detail">
            <ol class="explain-steps">
              {p.explanation.map((line, i) => (
                <li key={i}>
                  <Tex tex={line} />
                </li>
              ))}
            </ol>
            {(p.mistakes?.length ?? 0) > 0 && (
              <ul class="judge-mistakes">
                {p.mistakes!.map((m, i) => (
                  <li key={i}>
                    誤答 <Tex tex={m.answer.kind === 'choice' ? m.answer.options[m.answer.correct] : answerToText(m.answer)} /> → 「{m.say}」
                  </li>
                ))}
              </ul>
            )}
          </div>

          {ngOpen ? (
            <div class="judge-ng">
              <div class="judge-reasons">
                {NG_REASONS.map((r, i) => (
                  <button key={r} type="button" class={`btn btn-small ${picked.includes(r) ? 'btn-primary' : ''}`} onClick={() => togglePick(r)}>
                    {i + 1}. {r}
                  </button>
                ))}
              </div>
              <div class="row">
                <input ref={noteRef} class="judge-note" placeholder="一言(なくても よい)" value={note} onInput={(e) => update({ note: (e.target as HTMLInputElement).value })} />
                <Button primary onClick={confirmNg}>
                  × で 決定 (Enter)
                </Button>
                <Button onClick={() => update({ ngOpen: false })}>やめる (Esc)</Button>
              </div>
            </div>
          ) : (
            <div class="judge-actions">
              <button type="button" class="judge-btn judge-ng-btn" onClick={openNg}>
                × <small>← / X</small>
              </button>
              <button type="button" class="judge-btn judge-skip" onClick={skip}>
                とばす <small>↓</small>
              </button>
              <button type="button" class="judge-btn judge-ok-btn" onClick={() => decide('ok')}>
                ○ <small>→ / O</small>
              </button>
              <button type="button" class="judge-btn judge-undo" disabled={history.length === 0} onClick={undo}>
                ↶ 1 つ もどる <small>Z</small>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
