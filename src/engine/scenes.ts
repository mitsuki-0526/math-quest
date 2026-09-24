import { createStore } from './store';

/**
 * シーン = 画面の1枚。スタックで管理し、push で重ね、pop で戻る。
 * 「戦闘中に会話 → 戻る」「どこからでも設定 → 戻る」をスタックで自然に表す。
 * F15(タイルマップ探索)は将来 `dungeon` を追加する予約枠(要件 §7.5)。
 */
/** 会話が終わったあとに何をするか */
export type TalkThen =
  | { type: 'clearNode'; nodeId: string }
  | { type: 'bossBattle'; nodeId: string }
  | { type: 'battle'; nodeId: string }
  | { type: 'tutorialBattle' }
  | { type: 'map' }
  | { type: 'pop' };

export type Scene =
  | { kind: 'title' }
  | { kind: 'name' }
  | { kind: 'map' }
  | { kind: 'town'; townId: string }
  | { kind: 'battle'; nodeId: string; tutorial?: boolean; review?: boolean; templateId?: string }
  /** doneFlag: 会話を最後まで見たときに立てるフラグ(途中で閉じたら次にまた見せる) */
  | { kind: 'talk'; scriptIds: string[]; then?: TalkThen; doneFlag?: string }
  | { kind: 'status' }
  | { kind: 'settings' }
  /** 章をクリアしたが次の章がまだ開いていないとき(体験版の終わり) */
  | { kind: 'trialEnd'; chapterId: string }
  | { kind: 'feedback' };

export type SceneKind = Scene['kind'];

export const sceneStack = createStore<Scene[]>([{ kind: 'title' }]);

export function currentScene(): Scene {
  const stack = sceneStack.get();
  return stack[stack.length - 1];
}

export function pushScene(scene: Scene): void {
  sceneStack.set((s) => [...s, scene]);
}

export function popScene(): void {
  sceneStack.set((s) => (s.length > 1 ? s.slice(0, -1) : s));
}

/** 現在のシーンを差し替える(戻り先を残さない遷移)。 */
export function replaceScene(scene: Scene): void {
  sceneStack.set((s) => [...s.slice(0, -1), scene]);
}

/** スタックを捨ててこのシーンだけにする(タイトルへ戻る、章クリア後にマップへ、など)。 */
export function resetScenes(scene: Scene): void {
  sceneStack.set([scene]);
}
