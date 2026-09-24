import { useState } from 'preact/hooks';
import { saveStore } from '@/engine/save';
import { useStore } from '@/engine/store';
import { popScene } from '@/engine/scenes';
import { Button, Panel } from '@/ui/components/Ui';
import { api, hasServer, describeError, type FeedbackInput } from '@/engine/api';
import { getIdentity } from '@/engine/sync';

/**
 * 感想を送る(体験版の試遊で、生徒の声を集める)。
 * 楽しさ(★1〜5)・難しさ(3 択)・自由記述。送った内容は先生のスプレッドシートの feedback シートに入る。
 * レベルや進み具合は自動で付けるので、生徒は書かなくてよい
 */
export const FEEDBACK_MAX = 200;

const DIFFICULTIES: { id: FeedbackInput['difficulty']; label: string }[] = [
  { id: 'easy', label: 'やさしい' },
  { id: 'ok', label: 'ちょうどいい' },
  { id: 'hard', label: 'むずかしい' },
];

export function FeedbackScene() {
  const save = useStore(saveStore);
  const [fun, setFun] = useState(0);
  const [difficulty, setDifficulty] = useState<FeedbackInput['difficulty'] | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!save) return null;
  const ready = fun > 0 && difficulty !== null;

  async function send() {
    const id = getIdentity();
    if (!ready || !id || !save) return;
    setBusy(true);
    setError(null);
    try {
      const stats = Object.values(save.stats);
      await api.feedback(id, {
        fun,
        difficulty: difficulty!,
        comment: comment.trim().slice(0, FEEDBACK_MAX),
        level: save.player.level,
        chapter: save.progress.chapter,
        answered: stats.reduce((n, s) => n + s.asked, 0),
        correct: stats.reduce((n, s) => n + s.correct, 0),
      });
      setSent(true);
    } catch (e) {
      // 書いた内容は消さない(つながってから、もう一度送れるように)
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div class="scene scene-feedback">
        <Panel title="✉ 感想を 送りました" class="feedback-panel">
          <p>ありがとう! 先生に 届いたよ。これからの ゲームづくりに 使わせてもらうね。</p>
          <div class="row center">
            <Button primary autoFocus onClick={popScene}>
              もどる
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div class="scene scene-feedback">
      <Panel title="✉ 感想を おしえて" class="feedback-panel">
        {!hasServer() && <p class="warn">この体験版は サーバーに つながっていないので、感想を 送れません</p>}

        <div class="field">
          <span>1. たのしかった?</span>
          <div class="star-picker" role="radiogroup" aria-label="たのしさ">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} role="radio" aria-checked={fun === n} aria-label={`${n}`} class={`star ${n <= fun ? 'on' : ''}`} onClick={() => setFun(n)}>
                ★
              </button>
            ))}
            <small>{fun === 0 ? '星を えらんでね' : ['', 'あまり…', 'ふつう より 下', 'ふつう', 'たのしい', 'とても たのしい!'][fun]}</small>
          </div>
        </div>

        <div class="field">
          <span>2. 問題の むずかしさは?</span>
          <div class="choice-row" role="radiogroup" aria-label="むずかしさ">
            {DIFFICULTIES.map((d) => (
              <button type="button" key={d.id} role="radio" aria-checked={difficulty === d.id} class={`btn ${difficulty === d.id ? 'btn-primary' : ''}`} onClick={() => setDifficulty(d.id)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <label class="field">
          <span>
            3. 自由に 書いてね <small>(よかったところ・こまったところ・こうしてほしい など。書かなくても OK)</small>
          </span>
          <textarea
            rows={4}
            maxLength={FEEDBACK_MAX}
            value={comment}
            onInput={(e) => setComment((e.target as HTMLTextAreaElement).value)}
          />
          <small class="counter">
            {comment.length} / {FEEDBACK_MAX}
          </small>
        </label>

        {error && <p class="warn">{error}</p>}
        <div class="row center">
          <Button onClick={popScene}>やめる</Button>
          <Button primary disabled={!ready || busy || !hasServer()} onClick={() => void send()}>
            {busy ? '送っています…' : '送る'}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
