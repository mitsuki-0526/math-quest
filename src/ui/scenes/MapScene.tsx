import { useEffect, useState } from 'preact/hooks';
import { grade1, findChapter } from '@/data/grade1/chapters';
import { saveStore, updateSave } from '@/engine/save';
import { useStore } from '@/engine/store';
import { pushScene, sceneStack } from '@/engine/scenes';
import { isChapterUnlocked, nodeState, qualify, unlockedChapters, type NodeState } from '@/engine/progress';
import type { NodeDef } from '@/engine/types';
import { Bar, Button, Panel } from '@/ui/components/Ui';
import { Sprite } from '@/ui/components/Sprite';
import { characters, playerSprite } from '@/data/characters';
import { hasScene } from '@/engine/script';
import { syncStore } from '@/engine/sync';
import { practiceTemplates } from '@/engine/practice';
import { ensureDailyQuest } from '@/engine/adaptive';
import { nextPerk } from '@/data/skills';
import '@/data/grade1/problems';
import { getTemplate } from '@/math/template';

const NODE_ICON: Record<NodeDef['type'], string> = {
  town: 'icon_node_town',
  battle: 'icon_node_battle',
  event: 'icon_node_event',
  secret: 'icon_node_secret',
  boss: 'icon_node_boss',
};

const STATE_COLOR: Record<NodeState, string> = {
  cleared: 'var(--ok)',
  available: 'var(--acc)',
  locked: 'var(--lock)',
  hidden: 'transparent',
};

/** ノード式ワールドマップ(要件 F10 F11)。章データだけから描画する。 */
export function MapScene() {
  const save = useStore(saveStore);
  useStore(unlockedChapters);
  const sync = useStore(syncStore);
  // 現在の章がまだ解放されていない(関所待ち)か未実装なら、最後にクリアした章を開く
  const [chapterId, setChapterId] = useState(() => {
    const cur = save?.progress.chapter ?? 'g1c1';
    const def = findChapter(cur);
    if (def && def.nodes.length > 0) return cur;
    // 未実装の章(第4章以降)が現在章なら、最後にクリアした章を開く
    return save?.progress.clearedChapters.at(-1) ?? 'g1c1';
  });
  const [selected, setSelected] = useState<string | null>(null);
  const chapter = findChapter(chapterId);
  // 今日のクエストを用意(日付が変わっていれば新しく)
  useEffect(() => {
    updateSave((d) => void ensureDailyQuest(d, practiceTemplates(d)));
  }, []);
  // 解放された章に初めて来たら、章の冒頭イベント(関所を抜ける場面)を再生する
  useEffect(() => {
    if (!chapter?.intro || !save) return;
    const flag = `chapterIntro:${chapter.id}`;
    if (save.flags[flag] || !isChapterUnlocked(chapter.id) || !hasScene(chapter.intro)) return;
    // 既読の印は会話を見終わってから付くので、その前に二重に積まないよう、地図がいちばん上のときだけ
    if (sceneStack.get().at(-1)?.kind !== 'map') return;
    pushScene({ kind: 'talk', scriptIds: [chapter.intro], then: { type: 'pop' }, doneFlag: flag });
  }, [chapterId, save?.flags]);
  if (!save || !chapter) return null;
  const daily = save.daily;
  const perk = nextPerk(save.player.level);

  const selectedNode = chapter.nodes.find((n) => n.id === selected) ?? null;
  const selectedState = selectedNode ? nodeState(chapter, selectedNode, save) : null;
  const unlocked = isChapterUnlocked(chapter.id);
  const idx = grade1.chapters.findIndex((c) => c.id === chapter.id);
  const prev = grade1.chapters[idx - 1];
  const next = grade1.chapters[idx + 1];

  /** 表示する章を変える。会話などで画面が入れ替わっても戻れるよう、セーブに覚えておく */
  function viewChapter(id: string) {
    setChapterId(id);
    setSelected(null);
    updateSave((d) => (d.progress.chapter = id));
  }

  function enter(node: NodeDef) {
    const id = qualify(chapter!, node);
    switch (node.type) {
      case 'town':
        pushScene({ kind: 'town', townId: node.id });
        break;
      case 'event':
        pushScene({ kind: 'talk', scriptIds: [node.script ?? node.id], then: { type: 'clearNode', nodeId: id } });
        break;
      case 'boss':
        if (node.before) pushScene({ kind: 'talk', scriptIds: [node.before], then: { type: 'bossBattle', nodeId: id } });
        else pushScene({ kind: 'battle', nodeId: id });
        break;
      case 'battle':
      case 'secret': {
        // 導入会話は初回だけ(要件 F63)。スキップ可
        const introFlag = `intro:${id}`;
        if (node.intro && !save!.flags[introFlag] && hasScene(node.intro)) {
          pushScene({ kind: 'talk', scriptIds: [node.intro], then: { type: 'battle', nodeId: id }, doneFlag: introFlag });
        } else pushScene({ kind: 'battle', nodeId: id });
        break;
      }
    }
  }

  /** 先生用(要件 F6): ノードをクリア済みにして任意の場所へ進めるようにする */
  function devClear(node: NodeDef) {
    updateSave((d) => {
      const id = qualify(chapter!, node);
      if (!d.progress.clearedNodes.includes(id)) d.progress.clearedNodes.push(id);
    });
  }

  return (
    <div class="scene scene-map">
      <div class="map-main">
        <Panel>
          <div class="map-header">
            <h2>
              第{chapter.number}章 {chapter.title} <small>({chapter.unit})</small>
            </h2>
            <div class="row">
              <Button disabled={!prev} onClick={() => prev && viewChapter(prev.id)}>
                ◀ 前の章
              </Button>
              <Button disabled={!next} onClick={() => next && viewChapter(next.id)}>
                次の章 ▶ {next && !isChapterUnlocked(next.id) ? '🔒' : ''}
              </Button>
            </div>
          </div>

          {!unlocked && (
            <p class="note">
              <Sprite id="icon_locked" size={18} /> 関所は まだ 閉まっている。先生の許可が出るまで待とう。
            </p>
          )}

          {chapter.nodes.length === 0 ? (
            <div class="map-empty">この章は まだ 開拓中(実装予定)</div>
          ) : (
            <svg class="map-svg" viewBox="0 0 100 90" preserveAspectRatio="xMidYMid meet">
              {chapter.nodes.map((n) =>
                n.next.map((toId) => {
                  const to = chapter.nodes.find((m) => m.id === toId);
                  if (!to) return null;
                  const hidden = nodeState(chapter, n, save) === 'hidden' || nodeState(chapter, to, save) === 'hidden';
                  return (
                    <line key={`${n.id}-${toId}`} x1={n.x} y1={n.y} x2={to.x} y2={to.y} class="map-path" opacity={hidden ? 0 : 1} />
                  );
                }),
              )}
              {chapter.nodes.map((n) => {
                const st = nodeState(chapter, n, save);
                if (st === 'hidden') return null;
                const isSel = selected === n.id;
                const r = n.type === 'boss' ? 6 : 5;
                return (
                  <g
                    key={n.id}
                    class={`map-node ${st}`}
                    transform={`translate(${n.x} ${n.y})`}
                    onClick={() => setSelected(n.id)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${n.name}(${st})`}
                    onKeyDown={(e) => e.key === 'Enter' && setSelected(n.id)}
                  >
                    <circle r={r} fill={STATE_COLOR[st]} stroke={isSel ? '#fff' : 'rgba(0,0,0,.35)'} stroke-width={isSel ? 1.2 : 0.5} />
                    <text y={1.6} class="map-node-icon">
                      {iconEmoji(n)}
                    </text>
                    <text y={r + 4.5} class="map-node-label">
                      {n.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          <div class="map-actions">
            {selectedNode && selectedState ? (
              <>
                <span class="map-selected">
                  <Sprite id={NODE_ICON[selectedNode.type]} size={20} /> {selectedNode.name}
                  <small> — {stateLabel(selectedState)}</small>
                </span>
                <Button primary disabled={!unlocked || selectedState === 'locked'} onClick={() => enter(selectedNode)}>
                  ▶{' '}
                  {selectedNode.type === 'town'
                    ? '村に入る'
                    : selectedNode.type === 'event'
                      ? selectedState === 'cleared'
                        ? 'もう一度 見る'
                        : '調べる'
                      : selectedState === 'cleared'
                        ? 'もう一度 出発(経験値稼ぎ)'
                        : '出発'}
                </Button>
                {(import.meta.env.DEV || sync.teacher) && selectedState !== 'cleared' && (
                  <Button onClick={() => devClear(selectedNode)} title="先生用: 動作確認のためにクリア扱いにする">
                    [先生] クリア扱い
                  </Button>
                )}
              </>
            ) : (
              <span class="map-selected muted">地点を えらんでください</span>
            )}
          </div>
          <p class="legend">
            凡例: <b style={{ color: 'var(--ok)' }}>●</b> クリア済(再挑戦OK) <b style={{ color: 'var(--acc)' }}>●</b> 行ける{' '}
            <b style={{ color: 'var(--lock)' }}>●</b> まだ行けない 🔒 先生が未解放
          </p>
        </Panel>
      </div>

      <aside class="map-side">
        <Panel title="パーティ">
          <div class="party-row">
            <Sprite id={playerSprite(save.player.look)} size={28} />
            <span>
              {save.player.name} Lv{save.player.level}
            </span>
          </div>
          <Bar value={save.player.hp} max={save.player.maxHp} label="HP" />
          <small>
            HP {save.player.hp}/{save.player.maxHp} ・ {save.player.gold} G
          </small>
          {save.party.includes('pita') && (
            <div class="party-row">
              <Sprite id={characters.pita.sprite!} size={28} />
              <span>{characters.pita.name}</span>
            </div>
          )}
        </Panel>
        <Panel title="章の進み">
          <table class="table">
            <tbody>
              {grade1.chapters.map((c) => {
                // 寄り道(secret)は任意なので進み具合の分母に入れない
                const main = c.nodes.filter((n) => n.type !== 'secret');
                const total = main.length;
                const done = main.filter((n) => save.progress.clearedNodes.includes(`${c.id}.${n.id}`)).length;
                const open = isChapterUnlocked(c.id);
                return (
                  <tr key={c.id} class={c.id === chapter.id ? 'current' : ''} onClick={() => viewChapter(c.id)}>
                    <td>{c.number}</td>
                    <td>{c.unit}</td>
                    <td>{!open ? '🔒' : save.progress.clearedChapters.includes(c.id) ? '✔' : total ? `${done}/${total}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
        <Panel title="📜 今日のクエスト">
          {daily ? (
            daily.claimed ? (
              <small>達成ずみ! 明日 また 新しい単元が 出る</small>
            ) : (
              <>
                <div>
                  「{getTemplate(daily.templateId).title}」を {daily.target}問 正解
                </div>
                <Bar value={daily.correct} max={daily.target} color="var(--sky)" label="クエスト進捗" />
                <small>
                  {daily.correct}/{daily.target} ・ 村の修練の泉で 練習できる
                </small>
              </>
            )
          ) : (
            <small>—</small>
          )}
          {perk && (
            <small style={{ display: 'block', marginTop: 6 }}>
              ✨ 次の力: Lv{perk.level}「{perk.name}」
            </small>
          )}
        </Panel>
        <div class="stack">
          <Button onClick={() => pushScene({ kind: 'status' })}>📊 ステータス・成績</Button>
          <Button onClick={() => pushScene({ kind: 'settings' })}>⚙️ 設定</Button>
        </div>
      </aside>
    </div>
  );
}

function iconEmoji(n: NodeDef): string {
  return { town: '🏘️', battle: '⚔️', event: '📖', secret: '💎', boss: '👑' }[n.type];
}

function stateLabel(s: NodeState): string {
  return { cleared: 'クリア済み', available: '行ける', locked: 'まだ行けない', hidden: '' }[s];
}
