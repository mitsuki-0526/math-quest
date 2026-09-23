import { popScene, resetScenes } from '@/engine/scenes';
import { saveStore, updateSave } from '@/engine/save';
import { useStore } from '@/engine/store';
import { Button, Panel } from '@/ui/components/Ui';
import { syncStore, logout, flush, getIdentity } from '@/engine/sync';
import { hasServer } from '@/engine/api';

/** 設定(要件 F95)。音・動きを減らす・文字サイズ。同期状態の表示は M3。 */
export function SettingsScene() {
  const save = useStore(saveStore);
  const sync = useStore(syncStore);
  if (!save) return null;
  const s = save.settings;
  const id = getIdentity();

  return (
    <div class="scene scene-settings">
      <Panel title="⚙️ 設定">
        <label class="field row">
          <input type="checkbox" checked={s.sound} onChange={(e) => updateSave((d) => (d.settings.sound = (e.target as HTMLInputElement).checked))} />
          <span>音を鳴らす(効果音は未実装)</span>
        </label>
        <label class="field row">
          <input
            type="checkbox"
            checked={s.reduceMotion}
            onChange={(e) => updateSave((d) => (d.settings.reduceMotion = (e.target as HTMLInputElement).checked))}
          />
          <span>動きを減らす(揺れ・点滅を止める)</span>
        </label>
        <label class="field">
          <span>文字の大きさ</span>
          <select value={String(s.fontScale)} onChange={(e) => updateSave((d) => (d.settings.fontScale = Number((e.target as HTMLSelectElement).value)))}>
            <option value="1">ふつう</option>
            <option value="1.15">大きめ</option>
            <option value="1.3">とても大きい</option>
          </select>
        </label>
        <div class="sync-box">
          {hasServer() ? (
            <>
              <p>
                <b>保存先:</b> 先生のスプレッドシート ・ <b>状態:</b> {sync.status === 'synced' ? '同期済み' : sync.status === 'pending' ? '同期待ち' : sync.status === 'offline' ? 'オフライン(端末に保存中)' : '未同期(再試行中)'}
                {sync.lastSyncAt && <small> ・ 最終同期 {new Date(sync.lastSyncAt).toLocaleTimeString()}</small>}
              </p>
              {id && (
                <p class="muted">
                  ログイン中: {id.class === 'teacher' ? '先生' : `${id.class} ${id.number}番`}
                </p>
              )}
              {sync.lastError && <p class="warn">{sync.lastError}</p>}
              <div class="row">
                <Button onClick={() => void flush()}>いま同期する</Button>
                <Button
                  onClick={() => {
                    // 先にタイトルへ戻してから消す(セーブが空になった画面を描かないように)。未送信分は logout が送る
                    resetScenes({ kind: 'title' });
                    void logout();
                  }}
                >
                  ログアウト(別の人に代わる)
                </Button>
              </div>
            </>
          ) : (
            <p class="muted">保存先: この端末(サーバー未設定)</p>
          )}
        </div>
        <div class="row">
          <Button onClick={popScene}>◀ もどる</Button>
          <Button onClick={() => resetScenes({ kind: 'title' })}>タイトルへ</Button>
        </div>
      </Panel>
    </div>
  );
}
