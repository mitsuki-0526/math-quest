import { useEffect, useReducer } from 'preact/hooks';

/** 依存なしの最小ストア。状態は1つのオブジェクトで持ち、set で置き換えて購読者に通知する。 */
export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next) {
      state = typeof next === 'function' ? (next as (prev: T) => T)(state) : next;
      for (const l of listeners) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** コンポーネントからストアを購読する。変更のたびに再描画する。 */
export function useStore<T>(store: Store<T>): T {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => store.subscribe(() => force(0)), [store]);
  return store.get();
}
