import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 持っていける 部品(src/math/)は、ゲームの コード(データ・画面・進行)に 頼らない。
 * 次の ゲームに そのまま 持っていけるように(docs/quality-kit.md)
 */
function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? filesUnder(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('部品の 境界', () => {
  it('src/math/ は @/data・@/engine・@/ui・@/assets を import しない', () => {
    const bad: string[] = [];
    for (const f of filesUnder('src/math')) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/from '(@\/(?:data|engine|ui|assets)[^']*)'/g)) bad.push(`${f}: ${m[1]}`);
    }
    expect(bad).toEqual([]);
  });

  it('学年・単元の 決まりは 出題タイプの 名前(g1.…)でなく 単元で 当てる(ほかの ゲームでも 使えるように)', () => {
    const src = readFileSync('src/math/quality/rules/curriculum.ts', 'utf8');
    expect(src).not.toMatch(/'g\d\./);
  });
});
