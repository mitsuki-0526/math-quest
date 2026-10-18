import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import paths from '@/assets/paths.json';
import { assetManifest, getAsset } from '@/assets/manifest';

/** 加工スクリプト(scripts/process_assets.py)が書き出した画像の一覧が、ゲームの素材 ID と実際のファイルに合っているか */
describe('素材', () => {
  const entries = Object.entries(paths as Record<string, string>);

  it('一覧の ID はすべて manifest にある(ファイル名の打ちまちがいを見つける)', () => {
    for (const [id] of entries) expect(assetManifest, `manifest にない ID: ${id}`).toHaveProperty(id);
  });

  it('一覧の画像はすべて public/ にある', () => {
    for (const [id, path] of entries) expect(existsSync(resolve('public', path)), `${id}: ${path} がない`).toBe(true);
  });

  it('背景の使い回し先はすべて manifest にあり、使い回し先の絵で描かれる', () => {
    for (const [id, entry] of Object.entries(assetManifest)) {
      if (!entry.alias) continue;
      expect(assetManifest, `${id} の使い回し先がない: ${entry.alias}`).toHaveProperty(entry.alias);
      expect(assetManifest[entry.alias].alias, `${id}: 使い回しの使い回しはしない`).toBeUndefined();
    }
    // 第1章: テオ商店・夕方の村は、はじまりの村の絵を使う(夕方は色を重ねる)
    const village = (paths as Record<string, string>).bg_village_square;
    if (village) {
      expect(getAsset('bg_village_shop').path).toBe(village);
      expect(getAsset('bg_village_square_evening').tint).toBeDefined();
    }
  });

  it('一覧にある素材は画像で、ない素材は絵文字で描かれる', () => {
    for (const [id, path] of entries) expect(getAsset(id).path).toBe(path);
    const noImage = Object.keys(assetManifest).find((id) => !(id in paths) && !assetManifest[id].path && !assetManifest[id].alias);
    if (noImage) expect(getAsset(noImage).path).toBeUndefined();
  });

  it('会話の背景はすべて、絵か塗りつぶしで描かれる(台本の背景名の書き方で 素材待ちの表示にならない)', () => {
    const dir = 'src/data/grade1/scripts';
    const ids = new Set<string>();
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      JSON.parse(readFileSync(resolve(dir, f), 'utf8'), (k, v: unknown) => {
        if (k === 'bg' && typeof v === 'string') ids.add(v);
        return v;
      });
    }
    expect(ids.size).toBeGreaterThan(0);
    for (const id of ids) {
      const a = getAsset(id);
      expect(Boolean(a.path || a.fill), `${id}(${a.label})に 絵がない`).toBe(true);
    }
  });
});
