import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { popScene, replaceScene, resetScenes, type TalkThen } from '@/engine/scenes';
import { saveStore, updateSave } from '@/engine/save';
import { useStore } from '@/engine/store';
import { ScriptRunner, getScene, type ScriptEffect, type Step } from '@/engine/script';
import { addItem, equip, clearChapter } from '@/engine/player';
import { characters, playerSprite, type CharacterId } from '@/data/characters';
import type { FigureSpec } from '@/math/figure';
import { getAsset, assetUrl } from '@/assets/manifest';
import { Button } from '@/ui/components/Ui';
import { Sprite } from '@/ui/components/Sprite';
import { Figure } from '@/ui/components/Figure';
import { keyFlag } from '@/ui/components/AnswerInput';

/**
 * 会話シーン(要件 F60〜F63)。スクリプト(JSON)を ScriptRunner で進め、ここは表示だけを行う。
 * クリック / Enter / Space で送り、選択肢はクリックか数字キー。⏩ で残りを早送り(効果は適用)。
 */
export function TalkScene({ scriptIds, then, doneFlag }: { scriptIds: string[]; then?: TalkThen; doneFlag?: string }) {
  const save = useStore(saveStore);
  const [index, setIndex] = useState(0);
  const [step, setStepRaw] = useState<Step | null>(null);
  const [typed, setTyped] = useState(0);
  // 行を切り替えるときは表示文字数も同時に 0 に戻す。別々に更新すると、新しい文が前の行の文字数ぶん一瞬見えてしまう
  const setStep = (next: Step | null) => {
    setTyped(0);
    setStepRaw(next);
  };
  const [bg, setBg] = useState<string | undefined>(undefined);
  const [figure, setFigure] = useState<FigureSpec | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const startBattle = useRef(false);
  const runnerRef = useRef<ScriptRunner | null>(null);
  const logRef = useRef<{ who: string; text: string }[]>([]);

  const scriptId = scriptIds[index];
  const [sceneId, startLabel] = scriptId.split('#');
  const scene = useMemo(() => getScene(sceneId), [sceneId]);

  function applyEffect(e: ScriptEffect) {
    switch (e.effect) {
      case 'item':
        updateSave((d) => {
          addItem(d, e.id, e.count);
          if (e.equip) equip(d, e.id);
        });
        break;
      case 'flag':
        updateSave((d) => (d.flags[e.key] = true));
        break;
      case 'party':
        updateSave((d) => {
          if (!d.party.includes(e.id)) d.party.push(e.id);
        });
        break;
      case 'chapterClear':
        updateSave((d) => clearChapter(d, e.id));
        break;
      case 'title':
        setBanner(e.text);
        break;
      case 'rename':
        updateSave((d) => ((d.renames ??= {})[e.from] = e.to));
        break;
      case 'startBattle':
        startBattle.current = true;
        break;
      case 'unlockKeys':
        updateSave((d) => {
          for (const k of e.keys) d.flags[keyFlag(k)] = true;
        });
        setBanner(`新しい力『${e.keys.join(' ')}』を 手に入れた!`);
        break;
      case 'nameInput':
        break;
    }
  }

  // シーンが変わったらランナーを作り直す
  useEffect(() => {
    const runner = new ScriptRunner(
      scene,
      {
        // 台本の分岐は必ず goto で終わるので、順に進んでラベルに着いたら「別パート」(戦闘後など)として止める
        stopAtLabel: !startLabel,
        onEffect: applyEffect,
        onBg: setBg,
        onFigure: setFigure,
      },
      startLabel,
    );
    runnerRef.current = runner;
    setBg(scene.bg);
    setFigure(null);
    setStep(runner.next());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, startLabel]);

  // 文字送り
  useEffect(() => {
    if (step?.type !== 'say') return;
    const total = step.text.length;
    const t = setInterval(() => {
      setTyped((n) => {
        if (n >= total) {
          clearInterval(t);
          return n;
        }
        return n + 1;
      });
    }, 22);
    return () => clearInterval(t);
  }, [step]);

  // キーボード: Enter/Space で送り、数字で選択
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        advance();
      } else if (step?.type === 'choice') {
        const n = Number(e.key);
        if (n >= 1 && n <= step.options.length) choose(step.options[n - 1].goto);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!save) return null;

  function finishScene() {
    const runner = runnerRef.current!;
    logRef.current = [...logRef.current, ...runner.history];
    if (index + 1 < scriptIds.length && !startBattle.current) {
      setIndex(index + 1);
      return;
    }
    // 会話列の終わり: 見終わった印を付けて、次の行き先へ
    if (doneFlag) updateSave((d) => (d.flags[doneFlag] = true));
    const t = then;
    if (!t || t.type === 'pop') return popScene();
    switch (t.type) {
      case 'map':
        return resetScenes({ kind: 'map' });
      case 'clearNode':
        updateSave((d) => {
          if (!d.progress.clearedNodes.includes(t.nodeId)) d.progress.clearedNodes.push(t.nodeId);
        });
        return popScene();
      case 'bossBattle':
      case 'battle':
        return replaceScene({ kind: 'battle', nodeId: t.nodeId });
      case 'tutorialBattle':
        return replaceScene({ kind: 'battle', nodeId: 'g1c1.tutorial', tutorial: true });
    }
  }

  function advance() {
    if (!step || step.type === 'choice') return;
    if (step.type === 'say' && typed < step.text.length) {
      setTyped(step.text.length); // 1回目のクリックで全文表示
      return;
    }
    if (step.type === 'end') return finishScene();
    const next = runnerRef.current!.next();
    setStep(next);
    if (next.type === 'end') finishScene();
  }

  function choose(goto: string) {
    runnerRef.current!.choose(goto);
    const next = runnerRef.current!.next();
    setStep(next);
    if (next.type === 'end') finishScene();
  }

  function skipAll() {
    runnerRef.current!.skip();
    setStep({ type: 'end' });
    finishScene();
  }

  const displayName = (who: string) => {
    if (who.startsWith('npc:')) {
      const raw = who.slice(4);
      return save!.renames?.[raw] ?? raw;
    }
    return who === 'player' ? save!.player.name : (characters[who as CharacterId]?.name ?? who);
  };
  const render = (t: string) => t.replaceAll('{player}', save!.player.name);
  const actorSprite = (who: string) =>
    who === 'player' ? playerSprite(save!.player.look) : ((characters[who as CharacterId] as { sprite?: string } | undefined)?.sprite ?? `char_${who}`);
  const speaker = step?.type === 'say' ? step.who : null;
  const [left, right] = pickActors(scene.actors, speaker);
  const bgAsset = getAsset(bg ?? scene.bg ?? 'bg_village_square');

  return (
    <div class="scene scene-talk" onClick={advance}>
      <div class="talk-stage">
        {bgAsset.path ? (
          // 背景画像: 全面に敷き、場所の名前は左上に小さく出す
          <div class="talk-bg has-image" style={{ backgroundImage: `url(${assetUrl(bgAsset.path)})` }}>
            {bgAsset.tint && <div class="talk-bg-tint" style={{ background: bgAsset.tint }} />}
            <span class="talk-place">{bgAsset.label}</span>
          </div>
        ) : (
          <div class="talk-bg" style={{ opacity: 1 }}>
            <span class="talk-bg-emoji">{bgAsset.emoji}</span>
            <small>{bgAsset.label}</small>
          </div>
        )}
        {figure && (
          <div class="talk-figure" onClick={(e) => e.stopPropagation()}>
            <Figure spec={figure} />
          </div>
        )}
        {left && (
          <div class={`talk-actor left ${speaker === left ? 'speaking' : ''}`}>
            <Sprite id={actorSprite(left)} size={130} />
          </div>
        )}
        {right && (
          <div class={`talk-actor right ${speaker === right ? 'speaking' : ''}`}>
            <Sprite id={actorSprite(right)} size={130} />
          </div>
        )}
        <div class="talk-tools" onClick={(e) => e.stopPropagation()}>
          <Button onClick={() => setShowLog((v) => !v)}>📜 ログ</Button>
          <Button onClick={skipAll}>⏩ スキップ</Button>
        </div>
        {banner && (
          <div class="chapter-banner" onAnimationEnd={() => setBanner(null)}>
            <span>{banner}</span>
          </div>
        )}
      </div>

      <div class="talk-box">
        {step?.type === 'say' && (
          <>
            {step.who !== 'narrator' && <span class="talk-name">{displayName(step.who)}</span>}
            <p>{render(step.text).slice(0, typed)}</p>
            {typed >= step.text.length && <span class="talk-next">▼</span>}
          </>
        )}
        {step?.type === 'choice' && (
          <div class="talk-choices" onClick={(e) => e.stopPropagation()}>
            {step.options.map((o, i) => (
              <button type="button" key={i} class="talk-choice" onClick={() => choose(o.goto)}>
                <span class="cursor">▶</span>
                {i + 1}. 「{render(o.text)}」{o.tag && <small> ({o.tag})</small>}
              </button>
            ))}
          </div>
        )}
        {step?.type === 'end' && <p class="muted">(クリックで つづける)</p>}
      </div>

      {showLog && (
        <div class="talk-log" onClick={(e) => e.stopPropagation()}>
          {[...logRef.current, ...(runnerRef.current?.history ?? [])].map((l, k) => (
            <div key={k}>
              <b>{displayName(l.who)}</b> {render(l.text)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 立ち絵の配置: 主人公は左、それ以外は右。話者以外を薄くする */
function pickActors(actors: string[], speaker: string | null): [string | null, string | null] {
  const left = actors.includes('player') ? 'player' : null;
  const others = actors.filter((a) => a !== 'player' && !a.startsWith('npc:'));
  let right = others[0] ?? null;
  if (speaker && speaker !== 'player' && others.includes(speaker)) right = speaker;
  return [left, right];
}
