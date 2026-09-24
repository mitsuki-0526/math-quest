import { useEffect, useRef, useState } from 'preact/hooks';
import { popScene, replaceScene, resetScenes } from '@/engine/scenes';
import { saveStore, updateSave } from '@/engine/save';
import { useStore } from '@/engine/store';
import {
  createBattle,
  answer as engineAnswer,
  timeout as engineTimeout,
  continueAfterExplain,
  continueAfterVictory,
  useHint as engineHint,
  heal,
  addHints,
  extendTime,
  flee,
  bossPhaseOf,
  type BattleContext,
  type BattleState,
} from '@/engine/battle';
import { playerStats, gainExp, addItem, removeItem, applyDefeat } from '@/engine/player';
import { currentDifficulty, isWeak, recordAnswer, reviewTemplates, ensureDailyQuest } from '@/engine/adaptive';
import { practiceTemplates, enemyForTemplate } from '@/engine/practice';
import { perksGainedBetween, nextPerk, type Perk } from '@/data/skills';
import { getTemplate } from '@/math/template';
import { config } from '@/data/config';
import { grade1 } from '@/data/grade1/chapters';
import { getEnemy } from '@/data/grade1/enemies';
import { getItem } from '@/data/grade1/items';
import { getAsset, assetUrl } from '@/assets/manifest';
import { characters, playerSprite } from '@/data/characters';
import { hasScene } from '@/engine/script';
import '@/data/grade1/problems';
import { answerToText, type Problem } from '@/math/template';
import { Bar, Button } from '@/ui/components/Ui';
import { Sprite } from '@/ui/components/Sprite';
import { Tex } from '@/ui/components/Tex';
import { Figure } from '@/ui/components/Figure';
import { AnswerInput } from '@/ui/components/AnswerInput';

/**
 * バトル画面(要件 F20〜F28)。ロジックは engine/battle.ts、ここは表示と入力と時間管理。
 * - 通常: ノードの encounters を順に戦う。全勝で報酬 → マップへ
 * - tutorial: 敵1体・制限時間なし・ヒント無料・HP は 1 未満にならない
 * - review(復習の泉): 苦手テンプレートの「訓練用の敵」と戦う。報酬は半分
 * - boss: フェーズあり。勝つとボス後の会話へ
 */

type Fx = { id: number; kind: 'enemy' | 'player'; amount: number; targetKey?: string };
type Cmd = 'attack' | 'hint' | 'item' | 'run';

export function BattleScene({ nodeId, tutorial, review, templateId }: { nodeId: string; tutorial?: boolean; review?: boolean; templateId?: string }) {
  const save = useStore(saveStore);
  const [chapterId, nodeKey] = nodeId.split('.');
  const chapter = grade1.chapters.find((c) => c.id === chapterId);
  const node = chapter?.nodes.find((n) => n.id === nodeKey);
  const isBoss = node?.type === 'boss';
  const bg = getAsset(node?.bg ?? 'bg_forest_road');

  // 戦闘コンテキスト(セーブから 1 回だけ作る)
  const ctxRef = useRef<BattleContext | null>(null);
  const [state, setState] = useState<BattleState | null>(null);
  const [input, setInput] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [fx, setFx] = useState<Fx[]>([]);
  const [shake, setShake] = useState(0);
  const [cmd, setCmd] = useState<Cmd>('attack');
  const [menu, setMenu] = useState<'none' | 'item'>('none');
  const [hintText, setHintText] = useState<string | null>(null);
  const [explain, setExplain] = useState<{ problem: Problem; note?: string; timeout: boolean } | null>(null);
  const [result, setResult] = useState<{ exp: number; gold: number; levelUps: number; overflowGold?: number; cap?: number; item?: string; goldLost?: number; perks?: Perk[]; next?: Perk; quest?: { done: boolean; exp: number; gold: number } } | null>(null);
  const [tutorialSaid, setTutorialSaid] = useState<{ correct: boolean; wrong: boolean }>({ correct: false, wrong: false });
  const askedAt = useRef<number>(Date.now());
  /** タイマーから呼ぶ時間切れ処理。毎回の描画で最新のものに差し替える */
  const onTimeoutRef = useRef<() => void>(() => {});
  const reviewTemplate = useRef<string | null>(null);

  useEffect(() => {
    if (!save) return;
    const ps = playerStats(save);
    let encounters: string[][];
    if (tutorial) encounters = [['minus_slime']];
    else if (review) {
      // 修練の泉(要件 F46): 選んだ出題タイプで 3 戦。未指定なら苦手なものを優先して選ぶ
      const candidates = practiceTemplates(save);
      const chosen = templateId ?? reviewTemplates(save, candidates)[0] ?? candidates[0] ?? 'g1.sign.addsub';
      const enemyId = enemyForTemplate(chosen);
      encounters = [[enemyId], [enemyId], [enemyId, enemyId]];
      reviewTemplate.current = chosen;
    } else encounters = node?.enemies ?? [['minus_slime']];

    const ctx: BattleContext = {
      encounters,
      getEnemy,
      player: { name: ps.name, hp: ps.hp, maxHp: ps.maxHp, attack: ps.attack, defense: ps.defense, timeBonus: ps.timeBonus, expMul: ps.expMul },
      pickDifficulty: (t) => (tutorial ? 1 : currentDifficulty(saveStore.get()!, t)),
      isWeak: (t) => isWeak(saveStore.get()!, t),
      hints: tutorial ? 99 : config.battle.hintsPerNode + ps.hintBonus,
      isBoss,
      templateOverride: reviewTemplate.current ?? undefined,
    };
    ctxRef.current = ctx;
    updateSave((d) => void ensureDailyQuest(d, practiceTemplates(d)));
    const s = createBattle(ctx);
    setState(s);
    askedAt.current = Date.now();
    setRemaining(s.timeLimit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 制限時間(チュートリアルは無し)。
  // タイマーは問題ごとに張り直す。時間切れの処理は最新の状態で行う(ヒントやアイテムを使った後の状態を巻き戻さないため)
  useEffect(() => {
    if (!state || state.phase !== 'question' || tutorial) return;
    const limit = state.timeLimit;
    const t = setInterval(() => {
      const left = limit - (Date.now() - askedAt.current) / 1000;
      setRemaining(Math.max(0, left));
      if (left <= 0) {
        clearInterval(t);
        onTimeoutRef.current();
      }
    }, 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.turn, state?.phase, state?.timeLimit]);

  // ダメージ数字は 900ms で消す
  useEffect(() => {
    if (fx.length === 0) return;
    const t = setTimeout(() => setFx((f) => f.slice(1)), 900);
    return () => clearTimeout(t);
  }, [fx]);

  // ↑↓ でコマンド、Esc でアイテム窓を閉じる
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!state || state.phase !== 'question' || explain) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const ids: Cmd[] = state.canFlee ? ['attack', 'hint', 'item', 'run'] : ['attack', 'hint', 'item'];
        const i = ids.indexOf(cmd);
        setCmd(ids[(i + (e.key === 'ArrowDown' ? 1 : ids.length - 1)) % ids.length]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cmd, state, explain]);

  if (!save || !state || !ctxRef.current) return null;
  const ctx = ctxRef.current;
  const problem = state.problem;
  const target = state.enemies.find((e) => e.key === state.targetKey) ?? null;
  const phaseInfo = bossPhaseOf(state);

  /** エンジンの状態をセーブ(HP)に反映しつつ置き換える */
  function commit(next: BattleState) {
    setState(next);
    updateSave((d) => {
      d.player.hp = next.player.hp;
    });
    // 新しい問題になったら(同じ問題キーが続いても turn で分かる)、時間・入力・ヒントを戻す
    if (next.phase === 'question' && next.turn !== state?.turn) {
      askedAt.current = Date.now();
      setRemaining(next.timeLimit);
      setInput('');
      setHintText(null);
    }
  }

  function submit(value: string) {
    if (!state || state.phase !== 'question' || !problem) return;
    const elapsed = (Date.now() - askedAt.current) / 1000;
    const before = state;
    let next = engineAnswer(state, value, elapsed, ctx);
    // チュートリアルでは HP が 0 にならない(要件: 操作説明中に負けない)
    if (tutorial && next.player.hp < 1) next = { ...next, player: { ...next.player, hp: 1 }, phase: 'explain' };
    const last = next.last!;
    updateSave((d) => {
      const change = recordAnswer(d, problem.templateId, last.correct, problem.tags);
      if (change !== 0) next = { ...next, log: [...next.log, change > 0 ? `${characters.pita.name}「調子いいね! 問題が 少し 難しくなるよ」` : `${characters.pita.name}「少し やさしい 問題に するね。ゆっくり いこう」`] };
    });
    if (last.correct) {
      setFx((f) => [...f, { id: Date.now(), kind: 'enemy', amount: last.damage, targetKey: last.targetKey }]);
      if (tutorial && !tutorialSaid.correct) {
        next = { ...next, log: [...next.log, `${characters.pita.name}「ホホッ、やった! 見て、スライムが 小さくなった。もう一回!」`] };
        setTutorialSaid((t) => ({ ...t, correct: true }));
      }
    } else {
      setFx((f) => [...f, { id: Date.now(), kind: 'player', amount: last.damage }]);
      setShake((n) => n + 1);
      setExplain({ problem: before.problem!, note: last.note, timeout: false });
    }
    commit(next);
  }

  onTimeoutRef.current = onTimeout;
  function onTimeout() {
    if (!state || state.phase !== 'question') return;
    const before = state;
    const next = engineTimeout(state, ctx);
    setFx((f) => [...f, { id: Date.now(), kind: 'player', amount: next.last!.damage }]);
    setShake((n) => n + 1);
    updateSave((d) => recordAnswer(d, before.problem!.templateId, false, before.problem!.tags));
    setExplain({ problem: before.problem!, note: undefined, timeout: true });
    commit(next);
  }

  function closeExplain() {
    setExplain(null);
    if (!state) return;
    if (state.phase === 'defeat') return onDefeat();
    commit(continueAfterExplain(state, ctx));
  }

  function onDefeat() {
    let goldLost = 0;
    updateSave((d) => {
      goldLost = applyDefeat(d).goldLost;
    });
    setResult({ exp: 0, gold: 0, levelUps: 0, goldLost });
  }

  function onVictoryContinue() {
    if (!state) return;
    const next = continueAfterVictory(state, ctx);
    if (next.phase === 'nodeClear') return onNodeClear(next);
    commit(next);
  }

  function onNodeClear(final: BattleState) {
    const ps = playerStats(save!);
    // 修練の泉は経験値そのまま(+レベルの力)、ゴールドは半分。ふだんの戦闘はゴールドにレベルの力
    const exp = Math.round(final.totals.exp * (review ? config.review.expMul * ps.practiceMul : 1));
    const gold = Math.round(final.totals.gold * (review ? config.review.goldMul : ps.goldMul));
    let levelUps = 0;
    let overflowGold = 0;
    let cap = Infinity;
    let firstClear = false;
    let perksGained: Perk[] = [];
    let quest: { done: boolean; exp: number; gold: number } | undefined;
    updateSave((d) => {
      const before = d.player.level;
      // 今日のクエストが達成されていたら報酬を渡す
      const daily = d.daily;
      if (daily && !daily.claimed && daily.correct >= daily.target) {
        daily.claimed = true;
        quest = { done: true, exp: config.daily.rewardExp, gold: config.daily.rewardGold };
        d.player.gold += quest.gold;
      }
      ({ levelUps, overflowGold, cap } = gainExp(d, exp + (quest?.exp ?? 0)));
      perksGained = perksGainedBetween(before, d.player.level);
      d.player.gold += gold;
      firstClear = !tutorial && !review && !d.progress.clearedNodes.includes(nodeId);
      if (firstClear) d.progress.clearedNodes.push(nodeId);
      // 宝(装備など)は初回だけ。再挑戦は経験値とゴールドの稼ぎ場(要件 F30)
      if (node?.reward && firstClear) addItem(d, node.reward.item, node.reward.count ?? 1);
    });
    setState(final);
    const after = saveStore.get()!;
    const next = nextPerk(after.player.level);
    setResult({
      exp,
      gold,
      levelUps,
      overflowGold,
      cap,
      item: firstClear ? node?.reward?.item : undefined,
      perks: perksGained,
      // 上限より先の力は、今は取れないので出さない(代わりに上限の案内を出す)
      next: next && next.level <= cap ? next : undefined,
      quest,
    });
  }

  function leaveAfterResult() {
    if (result?.goldLost !== undefined) {
      // 敗北: 村へ戻される(マップの先頭に戻す)
      resetScenes({ kind: 'map' });
      return;
    }
    if (tutorial) return replaceScene({ kind: 'talk', scriptIds: ['P-5#撃破'], then: { type: 'map' } });
    // ボス後は複数シーンを続けて流せる(章クリア → エピローグ など)
    if (isBoss && node?.after) return replaceScene({ kind: 'talk', scriptIds: node.after.split(','), then: { type: 'map' } });
    // 寄り道などで「[クリア後]」の会話がある場合はそれを流してから戻る
    const after = node?.intro ? `${node.intro}#クリア後` : null;
    if (after && hasScene(after)) return replaceScene({ kind: 'talk', scriptIds: [after], then: { type: 'pop' } });
    popScene();
  }

  function useItem(id: string) {
    if (!state || state.phase !== 'question') return;
    const it = getItem(id);
    let next = state;
    if (it.use?.heal) next = heal(next, it.use.heal, it.name);
    else if (it.use?.healFull) next = heal(next, 'full', it.name);
    else if (it.use?.hint) next = addHints(next, it.use.hint, it.name);
    else if (it.use?.time) next = extendTime(next, it.use.time, it.name);
    else return;
    updateSave((d) => removeItem(d, id, 1));
    setMenu('none');
    commit(next);
  }

  function runCommand(c: Cmd) {
    setCmd(c);
    if (!state || state.phase !== 'question') return;
    if (c === 'attack') {
      commit({ ...state, log: [...state.log, '問題に 正しく 答えると こうげきできる!'] });
    } else if (c === 'hint') {
      const r = engineHint(state);
      if (r.hint) {
        setHintText(r.hint);
        commit(r.state);
      } else commit({ ...state, log: [...state.log, 'ヒントは もう 使えない…。羽根が あれば 増やせる'] });
    } else if (c === 'item') {
      setMenu((m) => (m === 'item' ? 'none' : 'item'));
    } else if (c === 'run') {
      const next = flee(state);
      if (next.phase === 'fled') {
        commit(next);
        setTimeout(() => popScene(), 600);
      }
    }
  }

  const consumables = Object.entries(save.inventory).filter(([id, n]) => n > 0 && getItem(id).kind === 'consumable');
  const timeRatio = state.timeLimit > 0 ? remaining / state.timeLimit : 1;
  const commands: { id: Cmd; label: string; enabled: boolean; extra?: string }[] = [
    { id: 'attack', label: 'たたかう', enabled: true },
    { id: 'hint', label: 'ヒント', enabled: state.hintsLeft > 0 || state.hintUsedForCurrent, extra: tutorial ? '' : `${state.hintsLeft}` },
    { id: 'item', label: 'アイテム', enabled: consumables.length > 0 },
    { id: 'run', label: 'にげる', enabled: state.canFlee },
  ];

  return (
    <div class="scene rpg-battle">
      <div class={`battlefield ${shake ? 'shake' : ''}`} key={`field-${shake}`}>
        {bg.path ? (
          // 道中の背景画像。少し暗くして、敵と窓を目立たせる
          <div
            class="battlefield-bg has-image"
            aria-hidden="true"
            style={{ backgroundImage: `linear-gradient(180deg, rgba(8, 10, 20, 0.2), rgba(8, 10, 20, 0.55)), url(${assetUrl(bg.path)})` }}
          />
        ) : (
          <div class="battlefield-bg" aria-hidden="true">
            <span class="battlefield-bg-emoji">{bg.emoji}</span>
          </div>
        )}

        <div class="rpg-window msg-window" aria-live="polite">
          {state.log.slice(-3).map((line, i, arr) => (
            <p key={`${state.encounterIndex}-${state.log.length - arr.length + i}`} class={i === arr.length - 1 ? 'latest' : ''}>
              {line}
            </p>
          ))}
        </div>

        {phaseInfo && (
          <div class="boss-phase">
            {Array.from({ length: phaseInfo.total }, (_, i) => (
              <span key={i} class={i <= phaseInfo.index ? 'on' : ''} />
            ))}
          </div>
        )}

        <div class="enemy-group">
          {state.enemies.map((e) => (
            <div key={e.key} class={`enemy ${e.hp === 0 ? 'defeated' : ''} ${e.key === state.targetKey ? 'asking' : ''}`}>
              <div class="enemy-plate">
                <span class="enemy-name">{e.def.name}</span>
                <Bar value={e.hp} max={e.def.hp} color="var(--ember)" label="敵HP" />
                <span class="enemy-hp">
                  {e.hp}/{e.def.hp}
                </span>
              </div>
              <div class={`enemy-sprite ${fx.some((f) => f.kind === 'enemy' && f.targetKey === e.key) ? 'hit' : ''}`} key={`sp-${fx.find((f) => f.targetKey === e.key)?.id ?? 0}`}>
                <Sprite id={e.def.sprite} size={isBoss ? 170 : state.enemies.length > 2 ? 100 : 130} />
              </div>
              {e.key === state.targetKey && state.phase === 'question' && <span class="asking-mark">?</span>}
              {fx
                .filter((f) => f.kind === 'enemy' && f.targetKey === e.key)
                .map((f) => (
                  <span key={f.id} class="dmg-pop">
                    {f.amount}
                  </span>
                ))}
            </div>
          ))}
        </div>
      </div>

      <div class="battle-bottom">
        <div class="rpg-window cmd-window" role="menu" aria-label="コマンド">
          {commands.map((c) => (
            <button
              type="button"
              key={c.id}
              role="menuitem"
              class={`cmd-item ${cmd === c.id ? 'selected' : ''}`}
              disabled={!c.enabled || state.phase !== 'question'}
              onMouseEnter={() => c.enabled && setCmd(c.id)}
              onClick={() => runCommand(c.id)}
            >
              <span class="cursor">▶</span>
              {c.label}
              {c.extra !== undefined && c.extra !== '' && <small> ×{c.extra}</small>}
            </button>
          ))}
          {menu === 'item' && (
            <div class="item-menu">
              {consumables.map(([id, n]) => (
                <button type="button" key={id} class="cmd-item" onClick={() => useItem(id)}>
                  <span class="cursor">▶</span>
                  {getItem(id).emoji} {getItem(id).name} <small>×{n}</small>
                </button>
              ))}
            </div>
          )}
        </div>

        <div class="rpg-window question-window" key={problem?.key ?? state.phase}>
          {state.phase === 'question' && problem && target && (
            <>
              <div class="question-meta">
                <span>
                  {target.def.name}の 問い ・ {'★'.repeat(problem.difficulty)}
                  {'☆'.repeat(3 - problem.difficulty)}
                </span>
                <span>
                  {tutorial ? '時間制限なし' : `⏱ ${Math.ceil(remaining)}秒`} ・ 正解 {state.totals.correct}/{state.totals.asked}
                </span>
              </div>
              {!tutorial && (
                <div class="time-bar">
                  <i style={{ width: `${timeRatio * 100}%`, background: timeRatio < 0.25 ? 'var(--ember)' : 'var(--gold)' }} />
                </div>
              )}
              {problem.figure && (
                <div class="question-figure">
                  <Figure spec={problem.figure} />
                </div>
              )}
              <div class="question-text">
                <Tex tex={problem.prompt} />
              </div>
              {hintText && (
                <p class="hint-line">
                  🦉 {characters.pita.name}「{hintText}」
                </p>
              )}
              <AnswerInput answer={problem.answer} value={input} onChange={setInput} onSubmit={submit} disabled={!!explain} />
            </>
          )}
          {state.phase === 'victory' && (
            <div class="victory-box">
              <p>
                {state.enemies.map((e) => e.def.name).join('と ')}を たおした!
              </p>
              <Button primary onClick={onVictoryContinue} autoFocus>
                ▶ {state.encounterIndex + 1 < state.encounters.length ? `つぎの 戦い(${state.encounterIndex + 2}/${state.encounters.length})` : 'けっか を 見る'} (Enter)
              </Button>
            </div>
          )}
          {state.phase === 'fled' && <p>にげだした…</p>}
        </div>

        <div class="rpg-window party-window">
          <div class="party-name">
            <Sprite id={playerSprite(save.player.look)} size={26} /> {save.player.name}
          </div>
          <div class="party-stat">
            <span>HP</span>
            <span class="num">
              {state.player.hp}
              <small>/{state.player.maxHp}</small>
            </span>
          </div>
          <Bar value={state.player.hp} max={state.player.maxHp} label="HP" color={state.player.hp / state.player.maxHp < 0.3 ? 'var(--ember)' : 'var(--verdigris)'} />
          <div class="party-stat">
            <span>Lv</span>
            <span class="num">{save.player.level}</span>
          </div>
          {state.streak >= 2 && <div class="party-sub">🔥 {state.streak}連続 正解中</div>}
          {save.party.includes('pita') && <div class="party-sub">🦉 {characters.pita.name} ・ ヒント {tutorial ? '∞' : state.hintsLeft}</div>}
          {fx
            .filter((f) => f.kind === 'player')
            .map((f) => (
              <span key={f.id} class="dmg-pop player">
                -{f.amount}
              </span>
            ))}
        </div>
      </div>

      {explain && (
        <div class="overlay" role="dialog" aria-label="解説">
          <div class="rpg-window overlay-box">
            <h3>
              {characters.pita.name}
              {explain.timeout ? '「あっ、時間…。次は ゆっくりでいいから、確実に!」' : '「まちがえたら、言い直せばいい」'}
            </h3>
            {tutorial && !tutorialSaid.wrong && <p class="muted">下に 解き方が 出てるよ。読んだら「つぎへ」</p>}
            {explain.note && <p class="warn">{explain.note}</p>}
            <p>
              <b>問題:</b> <Tex tex={explain.problem.prompt} /> <b>正解:</b> <Tex tex={answerTex(explain.problem)} />
            </p>
            <ol class="explain-steps">
              {explain.problem.explanation.map((line, i) => (
                <li key={i}>
                  <Tex tex={line} />
                </li>
              ))}
            </ol>
            <Button
              primary
              onClick={() => {
                if (tutorial) setTutorialSaid((t) => ({ ...t, wrong: true }));
                closeExplain();
              }}
              autoFocus
            >
              ▶ {state.phase === 'defeat' ? '…' : 'つぎへ'} (Enter)
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div class="overlay" role="dialog" aria-label="結果">
          <div class="rpg-window overlay-box result-box">
            {result.goldLost !== undefined ? (
              <>
                <h3>{save.player.name}は 目の前が 暗くなった…</h3>
                <p>{characters.pita.name}「いったん 村に戻ろう。歪みは 逃げないし、ボクらも あきらめない」</p>
                <p class="muted">
                  {result.goldLost} G を 落とした。HP は 半分まで 回復して、村で 目を 覚ました。
                </p>
              </>
            ) : (
              <>
                <h3>
                  {tutorial
                    ? '練習おわり!'
                    : review
                      ? `修練おわり!(${reviewTemplate.current ? getTemplate(reviewTemplate.current).title : ''})`
                      : isBoss
                        ? `${state.enemies[0].def.name}を たおした!`
                        : 'この場所の 歪みは 晴れた!'}
                </h3>
                <p>
                  けいけんち <b>{result.exp}</b> ・ <b>{result.gold}</b> G を 手に入れた
                </p>
                <p class="muted">
                  正解 {state.totals.correct}/{state.totals.asked} ・ 最大 {state.totals.streakBest}連続
                </p>
                {result.item && (
                  <p>
                    {getItem(result.item).emoji} <b>{getItem(result.item).name}</b> を 見つけた!
                  </p>
                )}
                {result.quest?.done && (
                  <p class="levelup">
                    📜 今日のクエスト 達成! +{result.quest.exp} 経験値 ・ +{result.quest.gold} G
                  </p>
                )}
                {result.levelUps > 0 && (
                  <p class="levelup">
                    ✨ レベルが {result.levelUps} 上がって Lv{save.player.level} になった! HP が 全回復した
                  </p>
                )}
                {!!result.overflowGold && (
                  <p class="muted">
                    この章の レベル上限(Lv{result.cap})に 達しているので、けいけんちは <b>{result.overflowGold}</b> G に なった。先の章が 開くと、もっと 強くなれる
                  </p>
                )}
                {result.perks?.map((pk) => (
                  <p key={pk.level} class="perk-line">
                    🔓 新しい力「{pk.name}」— {pk.description}
                  </p>
                ))}
                {result.next && (
                  <p class="muted">
                    次は Lv{result.next.level} で「{result.next.name}」({result.next.description})
                  </p>
                )}
              </>
            )}
            <Button primary onClick={leaveAfterResult} autoFocus>
              ▶ つづける (Enter)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function answerTex(p: Problem): string {
  const a = p.answer;
  if (a.kind === 'choice') return a.options[a.correct];
  if (a.kind === 'factorization') return p.explanation[p.explanation.length - 1].replace(/^\\text\{答え: \}\s*/, '');
  return answerToText(a).replace(/(-?\d+)\/(\d+)/g, '\\frac{$1}{$2}');
}
