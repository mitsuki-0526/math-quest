import { useEffect, useState } from 'preact/hooks';
import { Sprite } from '@/ui/components/Sprite';
import { getAsset, assetUrl } from '@/assets/manifest';
import { Button, Panel } from '@/ui/components/Ui';
import { loadLocalSave, continueGame, startNewGame, saveStore, writeLocalSave, type SaveData } from '@/engine/save';
import { pushScene, resetScenes } from '@/engine/scenes';
import { hasServer, describeError, isNetworkError, ApiFailure, type AccountInfo, type Identity } from '@/engine/api';
import { bootstrap, getIdentity, login, ownerKey, resumeOffline, scheduleSync } from '@/engine/sync';
import { markEntered, sessionStore } from '@/engine/session';
import { useStore } from '@/engine/store';
import { DEFAULT_PLAYER_NAME, PLAYER_NAME_MAX, playerLooks } from '@/data/characters';
import type { PlayerLook } from '@/engine/save';

/**
 * タイトル / ログイン(要件 F1 F6)。
 * - 学校アカウント方式(本番の標準): GAS が開いた人のアカウントを確かめ、先生の名簿でクラス・番号が決まる。
 *   生徒は番号を選ばない(まちがい・なりすまし登録を起こさないため)。「○○ として 入ります」→「ぼうけんへ」だけ。
 *   ログインしたままの他人の Chromebook で気づけるよう、主人公の名前とレベルも出す
 * - 合言葉方式(予備): アカウントが取れない環境。クラス・出席番号・合言葉。
 *   合言葉は初回に自分で決める。忘れたら先生がシートで空にする → 次回入力したものが新しい合言葉になる
 * - サーバーなし(GitHub Pages を直接開いた体験版・開発): 端末内のセーブで「つづきから / はじめから」
 */
const TEACHER_CLASS = 'teacher';

type Stage = 'loading' | 'google' | 'login' | 'offline' | 'name' | 'local';

export function TitleScene() {
  const remembered = getIdentity();
  const session = useStore(sessionStore);
  // 受付停止中(先生はそれでも入れるので、先生と分かっているときは止めない)
  const closed = session.info?.open === false;
  const [stage, setStage] = useState<Stage>(hasServer() ? 'loading' : 'local');
  const [account, setAccount] = useState<Extract<AccountInfo, { mode: 'google' }> | null>(null);
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
  // 回線がないときに続けられる、前回この端末で入った人の記録
  const offlineSave = hasServer() && remembered ? loadLocalSave(ownerKey(remembered)) : null;

  async function connect() {
    setStage('loading');
    setError(null);
    const r = await bootstrap(cls || '*');
    if (!r) {
      setStage('offline');
      return;
    }
    if (r.classes.length) {
      setClasses(r.classes);
      setCls((c) => (c && r.classes.includes(c) ? c : r.classes[0]));
    }
    if (r.account.mode === 'google') {
      setAccount(r.account);
      setStage('google');
    } else setStage('login');
  }

  // だれとして入るか・クラス一覧・解放状態を先に取る
  useEffect(() => {
    if (hasServer()) void connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trimmedName = name.trim();
  const nameOk = trimmedName.length > 0 && trimmedName.length <= PLAYER_NAME_MAX;

  function enterGame(save: SaveData) {
    markEntered();
    saveStore.set(save);
    writeLocalSave(save);
    resetScenes({ kind: 'map' });
  }

  function startPrologue(playerName: string) {
    markEntered();
    startNewGame(playerName, look);
    scheduleSync(0);
    resetScenes({ kind: 'map' });
    pushScene({ kind: 'talk', scriptIds: ['P-1', 'P-2', 'P-3', 'P-4', 'P-5'], then: { type: 'tutorialBattle' } });
  }

  function resumeFromDevice(save: SaveData) {
    resumeOffline();
    enterGame(save);
  }

  /** ログインして、セーブがあれば続きから、なければ名前入力へ */
  async function doLogin(id: Identity, back: Stage) {
    setBusy(true);
    setError(null);
    try {
      // 端末内のセーブは持ち主ごとに分かれているので、この人のものだけが候補になる
      const r = await login(id, loadLocalSave(ownerKey(id)));
      if (r.save) enterGame(r.save);
      else {
        setPendingIdentity(getIdentity());
        setStage('name');
      }
    } catch (err) {
      // 回線がないときは、前回この端末で入った本人に限って端末内のセーブで続けられる
      const own = remembered && remembered.class === id.class && remembered.number === id.number && remembered.pass === id.pass;
      const save = own && isNetworkError(err) ? loadLocalSave(ownerKey(id)) : null;
      if (save) return resumeFromDevice(save);
      setError(describeError(err));
      setStage(back);
    } finally {
      setBusy(false);
    }
  }

  function onPassLogin(e: Event) {
    e.preventDefault();
    const id: Identity = { class: teacherMode ? TEACHER_CLASS : cls.trim(), number: teacherMode ? '0' : number.trim(), pass: pass.trim() };
    if (!id.class || !id.number || !id.pass) {
      setError('クラス・出席番号・合言葉を 入れてください');
      return;
    }
    void doLogin(id, 'login');
  }

  /** 学校アカウント方式で入る。クラス・番号はサーバーが名簿で決めるので、送る値は端末内セーブを探すためだけに使う */
  function onAccountLogin() {
    if (!account?.registered) return;
    const { class: c, number: n } = account.registered;
    void doLogin({ class: c, number: n, pass: '' }, 'google');
  }

  const who = (id: { class: string; number: string }) => (id.class === TEACHER_CLASS ? '先生' : `${id.class} ${id.number}番`);

  // タイトルの一枚絵があれば画面の背景に敷く(なければ絵文字の紋章を出す)
  const titleArt = getAsset('bg_title').path;

  return (
    <div class="scene scene-title">
      {titleArt && <div class="title-backdrop" style={{ backgroundImage: `url(${assetUrl(titleArt)})` }} />}
      <Panel class="title-panel">
        <div class="title-logo">
          {!titleArt && <Sprite id="bg_title" size={96} />}
          <h1>MathQuest</h1>
          <p class="sub">はじまりの国 プリマ</p>
        </div>

        {session.notice && <p class="note">{session.notice}</p>}
        {closed &&
          stage !== 'local' &&
          (account?.teacher ? (
            <p class="note">受付停止中です(生徒は 入れません。先生は 入れます)</p>
          ) : (
            <p class="warn">いまは 受付停止中です(遊べない 時間)。先生の 合図を 待ってください</p>
          ))}

        {stage === 'loading' && <p class="muted">つないでいます…</p>}

        {stage === 'google' && account && (
          <div class="stack">
            {account.registered ? (
              <>
                <p class="note">
                  <b>{who(account.registered)}</b>
                  {account.player && `(${account.player.name} Lv${account.player.level})`} として 入ります
                  {account.teacher && '(全章 解放)'}
                </p>
                {!account.teacher && <p class="muted">自分では ない ときは、押さずに 先生に 知らせてください</p>}
                {error && <p class="warn">{error}</p>}
                {closed && !account.teacher ? (
                  <Button onClick={() => void connect()}>もう一度 つなぐ</Button>
                ) : (
                  <Button primary autoFocus disabled={busy} onClick={onAccountLogin}>
                    {busy ? 'つないでいます…' : 'ぼうけんへ'}
                  </Button>
                )}
              </>
            ) : (
              <>
                <p class="warn">{describeError(new ApiFailure(account.error ?? 'not_in_roster'))}</p>
                <Button onClick={() => void connect()}>もう一度 つなぐ</Button>
              </>
            )}
          </div>
        )}

        {stage === 'offline' && (
          <div class="stack">
            <p class="warn">サーバーに つながりません。通信を 確認してください</p>
            {offlineSave && (
              <Button primary onClick={() => resumeFromDevice(offlineSave)}>
                この端末の 記録で つづける({offlineSave.player.name} Lv{offlineSave.player.level})
              </Button>
            )}
            <Button primary={!offlineSave} onClick={() => void connect()}>
              もう一度 つなぐ
            </Button>
            {offlineSave && <p class="muted">端末の 記録で 遊んだ分は、つながったときに 送られます</p>}
          </div>
        )}

        {stage === 'login' && (
          <form class="stack" onSubmit={onPassLogin}>
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

        {stage === 'local' && (
          <div class="stack">
            <p class="muted">サーバー未設定: この端末だけに 保存します</p>
            {/* GitHub Pages を直接開いたとき(本番は GAS の入口から開く) */}
            {import.meta.env.PROD && <p class="note">これは 体験版です。授業では 先生から 配られた URL で 開いてください</p>}
            {localSave && (
              <Button primary onClick={() => continueGame() && resetScenes({ kind: 'map' })}>
                つづきから({localSave.player.name} Lv{localSave.player.level})
              </Button>
            )}
            <Button primary={!localSave} onClick={() => setStage('name')}>
              はじめから
            </Button>
          </div>
        )}

        {stage === 'name' && (
          <form
            class="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (nameOk) startPrologue(trimmedName);
            }}
          >
            {pendingIdentity && <p class="note">はじめまして! {who(pendingIdentity)}</p>}
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
            {!hasServer() && localSave && <p class="warn">※「はじめから」を選ぶと、いまの記録({localSave.player.name})は消えます</p>}
            <div class="row">
              {/* 学校アカウント方式では登録は済んでいるので、戻らずに名前を決める */}
              {!hasServer() && <Button onClick={() => setStage('local')}>もどる</Button>}
              {hasServer() && !account && <Button onClick={() => setStage('login')}>もどる</Button>}
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
