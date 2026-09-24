import { popScene } from '@/engine/scenes';
import { saveStore } from '@/engine/save';
import { useStore } from '@/engine/store';
import { playerStats, levelCap } from '@/engine/player';
import { expToNext } from '@/data/config';
import { getItem } from '@/data/grade1/items';
import { perks } from '@/data/skills';
import { grade1 } from '@/data/grade1/chapters';
import { characters, playerSprite } from '@/data/characters';
import '@/data/grade1/problems';
import { allTemplates } from '@/math/template';
import { Bar, Button, Panel } from '@/ui/components/Ui';
import { Sprite } from '@/ui/components/Sprite';

/** つまずきタグの日本語(テンプレートが付ける tags に対応) */
const TAG_LABEL: Record<string, string> = {
  minus_minus: '−(−)の符号',
  neg_plus_neg: '負+負',
  neg_times_neg: '負×負の符号',
  sign_of_product: '積の符号',
  sign_of_quotient: '商の符号',
  count_negatives: '負の数の個数',
  fraction_result: '答えが分数',
  abs_value: '絶対値',
  compare_negative: '負の数の大小',
  abs_two_values: '絶対値が同じ2数',
  count_integers: '範囲内の整数の個数',
  order_of_operations: '計算の順序',
  power_of_negative: '(−a)²',
  negative_of_power: '−a²',
  parentheses_first: 'かっこの中が先',
  prime_factorization: '素因数分解',
  numberline_read: '数直線の読み取り',
  numberline_distance: '数直線上の距離',
  numberline_add: '右へ進む',
  numberline_sub: '左へ進む',
};

/** ステータス・成績画面(要件 F80)。単元別の出題数・正答率・苦手タイプと、直した碑文。 */
export function StatusScene() {
  const save = useStore(saveStore);
  if (!save) return null;
  const p = save.player;
  const st = playerStats(save);
  const next = expToNext(p.level);
  const cap = levelCap();
  const templates = allTemplates();
  const rows = templates
    .map((t) => ({ t, s: save.stats[t.id] }))
    .filter((r) => r.s && r.s.asked > 0)
    .sort((a, b) => a.t.id.localeCompare(b.t.id));
  const units = [...new Set(rows.map((r) => r.t.unit))];

  return (
    <div class="scene scene-status">
      <div class="row wrap">
        <Panel title={`${p.name}  Lv${p.level}`} class="flex1">
          <div class="party-row">
            <Sprite id={playerSprite(save.player.look)} size={48} />
            <div style={{ flex: 1 }}>
              <div>
                HP {p.hp}/{p.maxHp}
              </div>
              <Bar value={p.hp} max={p.maxHp} label="HP" />
            </div>
          </div>
          <table class="table">
            <tbody>
              <tr>
                <td>こうげき</td>
                <td>
                  {st.attack} <small>(素 {p.attack})</small>
                </td>
                <td>ぼうぎょ</td>
                <td>
                  {st.defense} <small>(素 {p.defense})</small>
                </td>
              </tr>
              <tr>
                <td>ゴールド</td>
                <td>{p.gold} G</td>
                <td>ヒント回数</td>
                <td>3{st.hintBonus ? ` +${st.hintBonus}` : ''} / ノード</td>
              </tr>
              <tr>
                <td>ぶき</td>
                <td>{p.equipment.weapon ? `${getItem(p.equipment.weapon).emoji} ${getItem(p.equipment.weapon).name}` : '—'}</td>
                <td>ぼうぐ</td>
                <td>{p.equipment.armor ? `${getItem(p.equipment.armor).emoji} ${getItem(p.equipment.armor).name}` : '—'}</td>
              </tr>
              <tr>
                <td>そうしょく</td>
                <td colSpan={3}>{p.equipment.accessory ? `${getItem(p.equipment.accessory).emoji} ${getItem(p.equipment.accessory).name}` : '—'}</td>
              </tr>
              <tr>
                <td>次のLvまで</td>
                <td colSpan={3}>
                  {p.level >= cap ? (
                    <span class="muted">レベル上限(Lv{cap})。先の章が 開くと 上がる</span>
                  ) : (
                    <>
                      <Bar value={p.exp} max={next} color="var(--sky)" label="経験値" /> {p.exp}/{next}
                    </>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
          <h3 class="panel-title" style={{ marginTop: 14 }}>
            レベルの力(経験値で 手に入る)
          </h3>
          <ul class="perk-list">
            {perks.map((pk) => (
              <li key={pk.level} class={pk.level <= p.level ? 'got' : ''}>
                <b>Lv{pk.level}</b> {pk.name} <small>— {pk.description}</small>
              </li>
            ))}
          </ul>
          <h3 class="panel-title" style={{ marginTop: 14 }}>
            もちもの
          </h3>
          <div class="inventory">
            {Object.entries(save.inventory).filter(([, n]) => n > 0).length === 0 && <small>なにも 持っていない</small>}
            {Object.entries(save.inventory)
              .filter(([, n]) => n > 0)
              .map(([id, n]) => (
                <span key={id} class="inv-item" title={getItem(id).description}>
                  {getItem(id).emoji} {getItem(id).name} ×{n}
                </span>
              ))}
          </div>
          {save.party.length > 0 && (
            <>
              <h3 class="panel-title" style={{ marginTop: 14 }}>
                なかま
              </h3>
              <div class="party-row">
                <Sprite id={characters.pita.sprite!} size={36} /> {characters.pita.name} — ヒントと はげまし 担当
              </div>
            </>
          )}
        </Panel>

        <Panel title="📊 単元べつ 正答率" class="flex1">
          {rows.length === 0 ? (
            <p class="muted">まだ 記録が ありません。戦闘で 問題を 解くと ここに たまります。</p>
          ) : (
            units.map((unit) => (
              <div key={unit}>
                <h3 class="unit-head">{unit}</h3>
                <table class="table">
                  <thead>
                    <tr>
                      <th>出題タイプ</th>
                      <th>問題数</th>
                      <th>正答率</th>
                      <th>いまの★</th>
                      <th>苦手タイプ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows
                      .filter((r) => r.t.unit === unit)
                      .map(({ t, s }) => {
                        const rate = Math.round((100 * s!.correct) / s!.asked);
                        return (
                          <tr key={t.id}>
                            <td>{t.title}</td>
                            <td>{s!.asked}</td>
                            <td>
                              <span class={rate >= 80 ? 'rate-good' : rate < 50 ? 'rate-bad' : ''}>{rate}%</span>
                            </td>
                            <td>{'★'.repeat(s!.level ?? 1)}</td>
                            <td>
                              <small>{(s!.weakTags ?? []).map((tag) => TAG_LABEL[tag] ?? tag).join('、') || '—'}</small>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ))
          )}
          <h3 class="unit-head" style={{ marginTop: 16 }}>
            📜 直した 碑文
          </h3>
          {save.progress.clearedChapters.length === 0 ? (
            <p class="muted">碑を 直すと、その章の「一文」が ここに 刻まれる。</p>
          ) : (
            <ul class="inscriptions">
              {grade1.chapters
                .filter((c) => save.progress.clearedChapters.includes(c.id))
                .map((c) => (
                  <li key={c.id}>
                    <small>
                      第{c.number}章 {c.title}
                    </small>
                    <div>「{c.inscription}」</div>
                  </li>
                ))}
            </ul>
          )}
        </Panel>
      </div>
      <Button onClick={popScene}>◀ もどる (Esc)</Button>
    </div>
  );
}
