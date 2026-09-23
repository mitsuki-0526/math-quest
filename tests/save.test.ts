import { describe, it, expect } from 'vitest';
import { createNewSave, migrate, SAVE_VERSION } from '@/engine/save';
import { createStore } from '@/engine/store';
import { nodeState } from '@/engine/progress';
import { grade1 } from '@/data/grade1/chapters';

describe('save', () => {
  it('新規セーブは現行版で、名前を持つ', () => {
    const s = createNewSave('テスト');
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.player.name).toBe('テスト');
    expect(s.progress.chapter).toBe('g1c1');
  });

  it('migrate は欠けた項目を既定値で埋める', () => {
    const partial = { version: SAVE_VERSION, player: { name: 'A' }, progress: { chapter: 'g1c1' } };
    const s = migrate(partial);
    expect(s).not.toBeNull();
    expect(s!.player.level).toBe(1);
    expect(s!.progress.clearedNodes).toEqual([]);
    expect(s!.settings.fontScale).toBe(1);
  });

  it('migrate は版が違う・壊れたデータを null にする', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate({ version: 999 })).toBeNull();
    expect(migrate('text')).toBeNull();
  });
});

describe('store', () => {
  it('set で購読者に通知し、get で最新を返す', () => {
    const st = createStore(1);
    let seen = 0;
    const off = st.subscribe(() => (seen = st.get()));
    st.set(2);
    st.set((v) => v + 1);
    expect(seen).toBe(3);
    off();
    st.set(10);
    expect(seen).toBe(3);
  });
});

describe('progress.nodeState', () => {
  const ch = grade1.chapters[0];
  const byId = (id: string) => ch.nodes.find((n) => n.id === id)!;

  it('先頭の村は最初から行ける、先のノードはまだ行けない', () => {
    const s = createNewSave();
    expect(nodeState(ch, byId('village'), s)).toBe('available');
    expect(nodeState(ch, byId('road'), s)).toBe('available'); // 村(town)からは直接行ける
    expect(nodeState(ch, byId('marsh'), s)).toBe('locked');
    expect(nodeState(ch, byId('boss'), s)).toBe('locked');
  });

  it('前のノードをクリアすると次が行ける。寄り道は条件ノードのクリア後に現れる', () => {
    const s = createNewSave();
    expect(nodeState(ch, byId('secret_cave'), s)).toBe('hidden');
    s.progress.clearedNodes.push('g1c1.road');
    expect(nodeState(ch, byId('marsh'), s)).toBe('available');
    s.progress.clearedNodes.push('g1c1.marsh');
    expect(nodeState(ch, byId('secret_cave'), s)).toBe('available');
    expect(nodeState(ch, byId('abs_stone'), s)).toBe('available');
    expect(nodeState(ch, byId('marsh'), s)).toBe('cleared');
  });
});
