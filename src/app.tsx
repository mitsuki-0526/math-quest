import { useEffect } from 'preact/hooks';
import { sceneStack, popScene, pushScene, type Scene } from '@/engine/scenes';
import { saveStore } from '@/engine/save';
import { useStore } from '@/engine/store';
import { syncStore } from '@/engine/sync';
import { hasServer } from '@/engine/api';
import { TitleScene } from '@/ui/scenes/TitleScene';
import { MapScene } from '@/ui/scenes/MapScene';
import { TownScene } from '@/ui/scenes/TownScene';
import { BattleScene } from '@/ui/scenes/BattleScene';
import { TalkScene } from '@/ui/scenes/TalkScene';
import { StatusScene } from '@/ui/scenes/StatusScene';
import { SettingsScene } from '@/ui/scenes/SettingsScene';
import { TrialEndScene } from '@/ui/scenes/TrialEndScene';
import { FeedbackScene } from '@/ui/scenes/FeedbackScene';

const SYNC_LABEL: Record<string, string> = {
  local: 'この端末に保存',
  synced: '同期済み',
  pending: '同期待ち…',
  error: '未同期(再試行中)',
  offline: 'オフライン',
};

function renderScene(scene: Scene) {
  switch (scene.kind) {
    case 'title':
    case 'name':
      return <TitleScene />;
    case 'map':
      return <MapScene />;
    case 'town':
      return <TownScene townId={scene.townId} />;
    case 'battle':
      return <BattleScene key={scene.nodeId + String(scene.review) + (scene.templateId ?? '')} nodeId={scene.nodeId} tutorial={scene.tutorial} review={scene.review} templateId={scene.templateId} />;
    case 'talk':
      return <TalkScene key={scene.scriptIds.join('|')} scriptIds={scene.scriptIds} then={scene.then} doneFlag={scene.doneFlag} />;
    case 'status':
      return <StatusScene />;
    case 'settings':
      return <SettingsScene />;
    case 'trialEnd':
      return <TrialEndScene chapterId={scene.chapterId} />;
    case 'feedback':
      return <FeedbackScene />;
  }
}

export function App() {
  const stack = useStore(sceneStack);
  const save = useStore(saveStore);
  const sync = useStore(syncStore);
  const scene = stack[stack.length - 1];

  // 設定をルート要素に反映(文字サイズ・動きを減らす)
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--font-scale', String(save?.settings.fontScale ?? 1));
    root.classList.toggle('reduce-motion', !!save?.settings.reduceMotion);
  }, [save?.settings.fontScale, save?.settings.reduceMotion]);

  // Esc で戻る / 設定を開く(キーボードだけで操作できるように)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      const top = sceneStack.get();
      const cur = top[top.length - 1];
      if (cur.kind === 'title') return;
      if (top.length > 1) popScene();
      else pushScene({ kind: 'settings' });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div class="app" data-scene={scene.kind}>
      <header class="topbar">
        <span class="brand">MathQuest</span>
        {save && (
          <span class="topbar-info">
            {save.player.name} Lv{save.player.level} ・ {save.player.gold} G
          </span>
        )}
        {hasServer() && save && (
          <span class={`sync-badge ${sync.status}`} title={sync.lastError ?? ''}>
            {SYNC_LABEL[sync.status]}
            {sync.teacher ? '・先生' : ''}
          </span>
        )}
        <span class="topbar-crumbs">{stack.map((s) => s.kind).join(' › ')}</span>
      </header>
      <main class="stage">{renderScene(scene)}</main>
    </div>
  );
}
