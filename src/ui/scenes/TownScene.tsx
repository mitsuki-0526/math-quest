import { useEffect, useState } from 'preact/hooks';
import { popScene, pushScene } from '@/engine/scenes';
import { saveStore, updateSave } from '@/engine/save';
import { useStore } from '@/engine/store';
import { addItem, equip, playerStats } from '@/engine/player';
import { getTown } from '@/data/grade1/town';
import { getItem } from '@/data/grade1/items';
import { getAsset, assetUrl } from '@/assets/manifest';
import { characters, playerSprite } from '@/data/characters';
import { hasScene } from '@/engine/script';
import { practiceTemplates } from '@/engine/practice';
import { isWeak, ensureDailyQuest } from '@/engine/adaptive';
import { config } from '@/data/config';
import '@/data/grade1/problems';
import { getTemplate } from '@/math/template';
import { Bar, Button } from '@/ui/components/Ui';
import { Sprite } from '@/ui/components/Sprite';

/** 拠点(要件 F12 F31 F32 F46)。道具屋・武具屋・宿屋・村人・復習の泉。 */
type Tab = 'menu' | 'tools' | 'gear' | 'talk' | 'spring';

export function TownScene({ townId }: { townId: string }) {
  const save = useStore(saveStore);
  const town = getTown(townId);
  const [tab, setTab] = useState<Tab>('menu');
  const [msg, setMsg] = useState<string>(`${town.name}に ついた。`);
  const [talkIndex, setTalkIndex] = useState(0);

  // 章クリア後、最初に入ったときの会話(C1-10 など)。今日のクエストもここで用意する
  useEffect(() => {
    if (!save) return;
    updateSave((d) => void ensureDailyQuest(d, practiceTemplates(d)));
    const ev = town.afterClearScript;
    if (ev && save.progress.clearedChapters.includes(town.chapterId) && !save.flags[ev.flag] && hasScene(ev.scriptId)) {
      pushScene({ kind: 'talk', scriptIds: [ev.scriptId], then: { type: 'pop' } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!save) return null;
  const cleared = save.progress.clearedChapters.includes(town.chapterId);
  const stats = playerStats(save);
  const bg = getAsset(town.bg);

  function rest() {
    updateSave((d) => (d.player.hp = d.player.maxHp));
    setMsg('ぐっすり 眠って、HP が 全回復した。宿代は いらないよ、と 女将さん。');
  }

  function buy(id: string) {
    const it = getItem(id);
    if (!it.price) return;
    if (save!.player.gold < it.price) {
      setMsg(`${characters.teo.name}「損は させねえが、ツケも やらねえ。あと ${it.price - save!.player.gold} G 足りないぜ」`);
      return;
    }
    updateSave((d) => {
      d.player.gold -= it.price!;
      addItem(d, id, 1);
      if (it.kind !== 'consumable') equip(d, id);
    });
    setMsg(`${characters.teo.name}「毎度! ${it.name}、得したろ?」${it.kind !== 'consumable' ? ' さっそく 装備した。' : ''}`);
  }

  function equipOwned(id: string) {
    updateSave((d) => equip(d, id));
    setMsg(`${getItem(id).name}を 装備した。`);
  }

  const owned = Object.keys(save.inventory).filter((id) => getItem(id).kind !== 'consumable');
  const practice = practiceTemplates(save);
  const daily = save.daily;
  function startPractice(templateId?: string) {
    pushScene({ kind: 'battle', nodeId: `${town.chapterId}.spring`, review: true, templateId });
  }
  const equipped = new Set(Object.values(save.player.equipment).filter(Boolean));

  return (
    <div class="scene scene-town">
      <div class="town-stage">
        {bg.path ? (
          <div class="town-bg has-image" style={{ backgroundImage: `url(${assetUrl(bg.path)})` }}>
            {bg.tint && <div class="talk-bg-tint" style={{ background: bg.tint }} />}
            <h2>{town.name}</h2>
          </div>
        ) : (
          <div class="town-bg">
            <span class="town-bg-emoji">{bg.emoji}</span>
            <h2>{town.name}</h2>
          </div>
        )}
        <div class="rpg-window town-msg">
          <p>▶ {msg}</p>
        </div>
      </div>

      <div class="town-bottom">
        <div class="rpg-window cmd-window town-cmd">
          {[
            ['tools', '🛒 道具屋'],
            ['gear', '⚒️ 武具屋'],
            ['inn', '🛏️ 宿屋'],
            ['talk', '💬 村人と話す'],
            ['spring', `📚 ${town.springName}`],
            ['leave', '◀ マップへ'],
          ].map(([id, label]) => (
            <button
              type="button"
              key={id}
              class={`cmd-item ${tab === id ? 'selected' : ''}`}
              onClick={() => {
                if (id === 'inn') rest();
                else if (id === 'leave') popScene();
                else setTab(id as Tab);
              }}
            >
              <span class="cursor">▶</span>
              {label}
            </button>
          ))}
        </div>

        <div class="rpg-window town-panel">
          {tab === 'menu' && (
            <div class="town-intro">
              <p>{characters.teo.name}「よう {save.player.name}! 商売は 足で稼ぐんだぜ。何か 買ってくか?」</p>
              <p class="muted">
                {town.springName}では、学んだ 出題タイプを えらんで 何度でも 練習できる(経験値は そのまま)。宿屋は 無料で HP 全回復。
              </p>
            </div>
          )}
          {(tab === 'tools' || tab === 'gear') && (
            <div class="shop">
              <div class="shop-head">
                <span>{tab === 'tools' ? '道具屋' : '武具屋'}</span>
                <span class="gold">{save.player.gold} G</span>
              </div>
              {(tab === 'tools' ? town.shop.tools : town.shop.gear).map((id) => {
                const it = getItem(id);
                const have = save.inventory[id] ?? 0;
                return (
                  <div key={id} class="shop-row">
                    <span class="shop-item">
                      {it.emoji} {it.name} <small>{it.description}</small>
                    </span>
                    <span class="shop-price">{it.price} G</span>
                    <Button disabled={have > 0 && it.kind !== 'consumable'} onClick={() => buy(id)}>
                      {have > 0 && it.kind !== 'consumable' ? '持っている' : 'かう'}
                    </Button>
                  </div>
                );
              })}
              {tab === 'gear' && owned.length > 0 && (
                <>
                  <div class="shop-head">
                    <span>持っている 装備</span>
                  </div>
                  {owned.map((id) => (
                    <div key={id} class="shop-row">
                      <span class="shop-item">
                        {getItem(id).emoji} {getItem(id).name} <small>{getItem(id).description}</small>
                      </span>
                      <span />
                      <Button disabled={equipped.has(id)} onClick={() => equipOwned(id)}>
                        {equipped.has(id) ? '装備中' : 'そうび'}
                      </Button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
          {tab === 'spring' && (
            <div class="spring">
              <div class="shop-head">
                <span>{town.springName} — 練習したい 出題タイプを えらぶ(経験値は そのまま、ゴールドは 半分)</span>
              </div>
              {daily && !daily.claimed && (
                <p class="note">
                  📜 今日のクエスト: 「{getTemplate(daily.templateId).title}」を {daily.target}問 正解する({daily.correct}/{daily.target})— 達成で +{config.daily.rewardGold}G +{config.daily.rewardExp}経験値
                </p>
              )}
              {daily?.claimed && <p class="muted">📜 今日のクエストは 達成ずみ。明日 また 新しい単元が 出る</p>}
              <div class="spring-list">
                {practice.map((tid) => {
                  const t = getTemplate(tid);
                  const st = save.stats[tid];
                  const rate = st && st.asked ? Math.round((100 * st.correct) / st.asked) : null;
                  const weak = isWeak(save, tid);
                  const isQuest = daily?.templateId === tid && !daily.claimed;
                  return (
                    <button type="button" key={tid} class={`spring-item ${weak ? 'weak' : ''} ${isQuest ? 'quest' : ''}`} onClick={() => startPractice(tid)}>
                      <span class="spring-title">
                        {isQuest ? '📜 ' : ''}
                        {t.title}
                      </span>
                      <span class="spring-meta">
                        {t.unit} ・ {'★'.repeat(st?.level ?? 1)}
                        {'☆'.repeat(3 - (st?.level ?? 1))} ・ {st?.asked ?? 0}問 {rate !== null ? `${rate}%` : '未挑戦'}
                        {weak ? ' ・ 苦手' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div class="row" style={{ marginTop: 10 }}>
                <Button primary onClick={() => startPractice(undefined)}>
                  🦉 ピタに おまかせ(苦手を 優先)
                </Button>
              </div>
            </div>
          )}
          {tab === 'talk' && (
            <div class="villagers">
              {town.villagers.map((v, i) => (
                <button type="button" key={v.name} class={`villager ${talkIndex === i ? 'on' : ''}`} onClick={() => setTalkIndex(i)}>
                  <span class="villager-emoji">{v.emoji}</span>
                  <span class="villager-name">{v.name}</span>
                </button>
              ))}
              <div class="villager-line">
                <b>{town.villagers[talkIndex].name}</b>「{cleared ? town.villagers[talkIndex].after : town.villagers[talkIndex].before}」
              </div>
            </div>
          )}
        </div>

        <div class="rpg-window party-window">
          <div class="party-name">
            <Sprite id={playerSprite(save.player.look)} size={26} /> {save.player.name}
          </div>
          <div class="party-stat">
            <span>HP</span>
            <span class="num">
              {save.player.hp}
              <small>/{save.player.maxHp}</small>
            </span>
          </div>
          <Bar value={save.player.hp} max={save.player.maxHp} label="HP" />
          <div class="party-stat">
            <span>こうげき</span>
            <span class="num">{stats.attack}</span>
          </div>
          <div class="party-stat">
            <span>ぼうぎょ</span>
            <span class="num">{stats.defense}</span>
          </div>
          <div class="party-stat">
            <span>ゴールド</span>
            <span class="num">{save.player.gold}</span>
          </div>
          <div class="party-sub">
            {getItem(save.player.equipment.weapon ?? 'wooden_sword').emoji} {save.player.equipment.weapon ? getItem(save.player.equipment.weapon).name : 'すで'} /{' '}
            {save.player.equipment.armor ? getItem(save.player.equipment.armor).name : 'ふだんぎ'}
          </div>
        </div>
      </div>
    </div>
  );
}
