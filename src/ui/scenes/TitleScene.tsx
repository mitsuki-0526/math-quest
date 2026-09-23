import { useEffect, useState } from 'preact/hooks';
import { Sprite } from '@/ui/components/Sprite';
import { Button, Panel } from '@/ui/components/Ui';
import { loadLocalSave, continueGame, startNewGame, saveStore, writeLocalSave, type SaveData } from '@/engine/save';
import { pushScene, resetScenes } from '@/engine/scenes';
import { hasServer, describeError, isNetworkError, type Identity } from '@/engine/api';
import { bootstrap, getIdentity, login, ownerKey, resumeOffline, scheduleSync } from '@/engine/sync';
import { DEFAULT_PLAYER_NAME, PLAYER_NAME_MAX, playerLooks } from '@/data/characters';
import type { PlayerLook } from '@/engine/save';

/**
 * タイトル / ログイン(要件 F1 F6)。
 * - サーバーあり: クラス・出席番号・合言葉 → サーバーのセーブがあれば続きから、なければ名前入力へ
 * - サーバーなし(開発・オフライン配布): 端末内のセーブで「つづきから / はじめから」
 * 合言葉は初回に自分で決める。忘れたら先生がシートで空にする → 次回入力したものが新しい合言葉になる。
 */
const TEACHER_CLASS = 'teacher';

export function TitleScene() {
  const remembered = getIdentity();
  const [mode, setMode] = useState<'login' | 'name' | 'local'>(hasServer() ? 'login' : 'local');
  const [classes, setClasses] = useState<string[]>([]);
  // 前回が先生アカウントなら、生徒欄には引き継がない
  const [cls, setCls] = useState(remembered && remembered.class !== TEACHER_CLASS ? remembered.class : '');
  const [number, setNumber] = useState(remembered && remembered.class !== TEACHER_CLASS ? remembered.number : '');
  const [pass, setPass] = useState(remembered?.pass ?? '');
  const [teacherMode, setTeacherMode] = useState(remembered?.class === TEACHER_CLASS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(DEFAULT_PLAYER_NAME);
  const [look, setLook] = useState<PlayerLook>('neutral');
  const [pendingIdentity, setPendingIdentity] = useState<Identity | null>(null);
  // サーバーなしのときは持ち主なしの端末セーブだけを見る
  const localSave = hasServer() ? null : loadLocalSave(null);

  // クラス一覧と解放状態を取っておく(失敗してもログインは試せる)
  useEffect(() => {
    if (!hasServer()) return;
    void bootstrap(cls || '*').then((r) => {
      if (r?.classes.length) {
        setClasses(r.classes);
        setCls((c) => (c && r.classes.includes(c) ? c : r.classes[0]));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trimmedName = name.trim();
  const nameOk = trimmedName.length > 0 && trimmedName.length <= PLAYER_NAME_MAX;

  function enterGame(save: SaveData) {
    saveStore.set(save);
    writeLocalSave(save);
    resetScenes({ kind: 'map' });
  }

  function startPrologue(playerName: string) {
    startNewGame(playerName, look);
    scheduleSync(0);
    resetScenes({ kind: 'map' });
    pushScene({ kind: 'talk', scriptIds: ['P-1', 'P-2', 'P-3', 'P-4', 'P-5'], then: { type: 'tutorialBattle' } });
  }

  async function onLogin(e: Event) {
    e.preventDefault();
    const id: Identity = { class: teacherMode ? TEACHER_CLASS : cls.trim(), number: teacherMode ? '0' : number.trim(), pass: pass.trim() };
    if (!id.class || !id.number || !id.pass) {
      setError('クラス・出席番号・合言葉を 入れてください');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // 端末内のセーブは持ち主ごとに分かれているので、この人のものだけが候補になる
      const r = await login(id, loadLocalSave(ownerKey(id)));
      if (r.save) enterGame(r.save);
      else {
        setPendingIdentity(id);
        setMode('name');
      }
    } catch (err) {
      // 回線がないときは、前回この端末で入った本人(合言葉も一致)に限って端末内のセーブで続けられる
      const own = remembered && remembered.class === id.class && remembered.number === id.number && remembered.pass === id.pass;
      const offlineSave = own && isNetworkError(err) ? loadLocalSave(ownerKey(id)) : null;
      if (offlineSave) {
        resumeOffline();
        enterGame(offlineSave);
        return;
      }
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="scene scene-title">
      <Panel class="title-panel">
        <div class="title-logo">
          <Sprite id="bg_title" size={96} />
          <h1>MathQuest</h1>
          <p class="sub">はじまりの国 プリマ</p>
        </div>

        {mode === 'login' && (
          <form class="stack" onSubmit={onLogin}>
            {!teacherMode ? (
              <>
                <label class="field">
                  <span>クラス</span>
                  {classes.length > 0 ? (
                    <select value={cls} onChange={(e) => setCls((e.target as HTMLSelectElement).value)}>
                      {classes.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" value={cls} placeholder="例: 1-1" onInput={(e) => setCls((e.target as HTMLInputElement).value)} />
                  )}
                </label>
                <label class="field">
                  <span>出席番号</span>
                  <input type="number" min={1} max={50} value={number} onInput={(e) => setNumber((e.target as HTMLInputElement).value)} />
                </label>
              </>
            ) : (
              <p class="note">先生用アカウント(全章解放)。合言葉は config シートの teacher_pass</p>
            )}
            <label class="field">
              <span>合言葉 <small>(初回は 自分で 決める。忘れたら 先生に 聞く)</small></span>
              <input type="text" value={pass} autoComplete="off" onInput={(e) => setPass((e.target as HTMLInputElement).value)} />
            </label>
            {error && <p class="warn">{error}</p>}
            <Button primary type="submit" disabled={busy}>
              {busy ? 'つないでいます…' : 'ぼうけんへ'}
            </Button>
            <button type="button" class="linklike" onClick={() => setTeacherMode((v) => !v)}>
              {teacherMode ? '生徒として 入る' : '先生用'}
            </button>
          </form>
        )}

        {mode === 'local' && (
          <div class="stack">
            <p class="muted">サーバー未設定: この端末だけに 保存します</p>
            {/* GitHub Pages を直接開いたとき(本番は GAS の入口から開く) */}
            {import.meta.env.PROD && <p class="note">これは 体験版です。授業では 先生から 配られた URL で 開いてください</p>}
            {localSave && (
              <Button primary onClick={() => continueGame() && resetScenes({ kind: 'map' })}>
                つづきから({localSave.player.name} Lv{localSave.player.level})
              </Button>
            )}
            <Button primary={!localSave} onClick={() => setMode('name')}>
              はじめから
            </Button>
          </div>
        )}

        {mode === 'name' && (
          <form
            class="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (nameOk) startPrologue(trimmedName);
            }}
          >
            {pendingIdentity && <p class="note">はじめまして! {pendingIdentity.class === TEACHER_CLASS ? '先生' : `${pendingIdentity.class} ${pendingIdentity.number}番`}</p>}
            <div class="field">
              <span>主人公の 見た目</span>
              <div class="look-picker" role="radiogroup" aria-label="主人公の見た目">
                {(Object.keys(playerLooks) as PlayerLook[]).map((k) => (
                  <button
                    type="button"
                    key={k}
                    role="radio"
                    aria-checked={look === k}
                    class={`look-option ${look === k ? 'on' : ''}`}
                    onClick={() => setLook(k)}
                  >
                    <Sprite id={playerLooks[k].sprite} size={56} />
                    <span>{playerLooks[k].label}</span>
                  </button>
                ))}
              </div>
            </div>
            <label class="field">
              <span>主人公の名前(最大{PLAYER_NAME_MAX}文字)</span>
              <input type="text" value={name} maxLength={PLAYER_NAME_MAX} autoFocus onInput={(e) => setName((e.target as HTMLInputElement).value)} />
            </label>
            {mode === 'name' && !hasServer() && localSave && <p class="warn">※「はじめから」を選ぶと、いまの記録({localSave.player.name})は消えます</p>}
            <div class="row">
              <Button onClick={() => setMode(hasServer() ? 'login' : 'local')}>もどる</Button>
              <Button primary type="submit" disabled={!nameOk}>
                ぼうけんをはじめる
              </Button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  );
}
