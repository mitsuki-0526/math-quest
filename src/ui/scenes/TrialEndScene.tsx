import { useEffect } from 'preact/hooks';
import { saveStore, updateSave } from '@/engine/save';
import { useStore } from '@/engine/store';
import { popScene, replaceScene } from '@/engine/scenes';
import { Button, Panel } from '@/ui/components/Ui';
import { findChapter } from '@/data/grade1/chapters';
import { config } from '@/data/config';

/**
 * 章をクリアしたが、次の章がまだ開いていないときに 1 回だけ出す画面。
 * 体験版(config.game.trialMode = 1)では「体験版はここまで」、本番では「次の章は先生が開くまで」。
 * 遊んだ記録を見せて、感想を送る入口にする。このあとも同じ章の戦闘や修練の泉では遊べる
 */
export function TrialEndScene({ chapterId }: { chapterId: string }) {
  const save = useStore(saveStore);
  const chapter = findChapter(chapterId);

  // 見たら印を付ける(次に地図に戻ったときに、また出さない)
  useEffect(() => {
    updateSave((d) => (d.flags[`chapterEnd:${chapterId}`] = true));
  }, [chapterId]);

  if (!save || !chapter) return null;
  const stats = Object.values(save.stats);
  const asked = stats.reduce((n, s) => n + s.asked, 0);
  const correct = stats.reduce((n, s) => n + s.correct, 0);
  const rate = asked ? Math.round((correct / asked) * 100) : 0;
  const trial = config.game.trialMode === 1;

  return (
    <div class="scene scene-trial-end">
      <Panel class="trial-end-panel">
        <p class="trial-end-kicker">第{chapter.number}章 クリア</p>
        <h1 class="trial-end-title">{trial ? '体験版は ここまで!' : `${chapter.title} を 取りもどした!`}</h1>
        <p class="muted">
          {trial
            ? '遊んでくれて ありがとう。続きの章は ただいま 準備中です。'
            : '次の章は、先生が 関所を 開けるまで 待っていてね。'}
        </p>

        <div class="trial-end-record rpg-window">
          <div>
            <span>レベル</span>
            <b>Lv{save.player.level}</b>
          </div>
          <div>
            <span>解いた 問題</span>
            <b>{asked} 問</b>
          </div>
          <div>
            <span>正解</span>
            <b>
              {correct} 問({rate}%)
            </b>
          </div>
          <div>
            <span>ゴールド</span>
            <b>{save.player.gold} G</b>
          </div>
        </div>

        <p class="note">このあとも、第{chapter.number}章の 戦闘や 修練の泉で 練習できるよ。</p>
        <div class="row center">
          <Button primary autoFocus onClick={() => replaceScene({ kind: 'feedback' })}>
            ✉ 感想を 送る
          </Button>
          <Button onClick={popScene}>地図に もどる</Button>
        </div>
      </Panel>
    </div>
  );
}
