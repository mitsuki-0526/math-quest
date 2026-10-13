import { useEffect, useRef, useState } from 'preact/hooks';
import { judge, type AnswerSpec } from '@/math/template';
import { rat } from '@/math/rational';
import { characters } from '@/data/characters';
import { AnswerInput } from '@/ui/components/AnswerInput';
import { Button } from '@/ui/components/Ui';
import { Sprite } from '@/ui/components/Sprite';
import { Tex } from '@/ui/components/Tex';

/** はじめての 分数の 練習を 終えた 印(セーブの flags)。1 回だけ 出す */
export const FRACTION_PRACTICE_FLAG = 'tut:fraction';

const PRACTICE: AnswerSpec = { kind: 'number', value: rat(3, 4) };

/**
 * はじめて 分数で 答える 問題が 出たときの 練習(先生の要望 2026-10-04「/ で 分数を 入れることに 慣れていない 生徒が ほとんど」)。
 * 3/4 を 実際に 打たせて、「こう読みます」で 分数の 形に なるのを 見せる。まちがえても 何も 減らない
 */
export function FractionPractice({ expression, onDone }: { expression: boolean; onDone(): void }) {
  const [value, setValue] = useState('');
  const [said, setSaid] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const pita = characters.pita.name;
  const backRef = useRef<HTMLDivElement>(null);
  // できたら「問題に もどる」に フォーカス(Enter だけで 戻れるように。途中で 出る ボタンには autoFocus が 効かない ことが ある)
  useEffect(() => {
    if (done) backRef.current?.querySelector('button')?.focus();
  }, [done]);

  function submit(v: string) {
    // 言い直しやすいように 入力欄を 空に 戻す
    if (!(v.includes('/') && judge(PRACTICE, v).correct)) setValue('');
    if (!v.includes('/')) {
      setSaid(judge(PRACTICE, v).correct ? '小数でも 合ってる! でも 今回は「/」を 使って 分数で 入れてみよう' : '「3」→「/」→「4」の 順に 押してみよう');
      return;
    }
    if (judge(PRACTICE, v).correct) setDone(true);
    else setSaid('上が 分子、下が 分母。4分の3 なら「3」→「/」→「4」の 順だよ');
  }

  return (
    <div class="overlay" role="dialog" aria-label="分数の 入れ方の 練習">
      <div class="rpg-window overlay-box fraction-practice">
        <h3>
          <Sprite id="char_pita_icon" size={28} class="inline-icon" alt="" /> {pita}「この 問題は 答えが 分数に なるよ。入れ方を 練習しよう」
        </h3>
        {!done ? (
          <>
            <p>
              分数は <b>分子 → 「/」 → 分母</b> の 順に 押します。<Tex tex="\dfrac{3}{4}" />(4分の3)を 入れてみよう。
            </p>
            {said && <p class="warn">{pita}「{said}」</p>}
            <AnswerInput answer={PRACTICE} value={value} onChange={setValue} onSubmit={submit} submitLabel="入れてみる (Enter)" fraction />
          </>
        ) : (
          <>
            <p>
              {pita}「そう! 「こう読みます」が <Tex tex="\dfrac{3}{4}" /> に なったね。答えを 入れたら、ここで 形を 確かめてから こうげき しよう」
            </p>
            {expression && (
              <p>
                {pita}「x の 係数が 分数の ときは 2/3x と 入れるよ(<Tex tex="\dfrac{2}{3}x" />)。2x/3 と 入れても 正解」
              </p>
            )}
            <div ref={backRef}>
              <Button primary onClick={onDone}>
                ▶ 問題に もどる (Enter)
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
