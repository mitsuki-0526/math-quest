"""
素材の加工スクリプト(T4-4)。画風は「A. ドット絵風」(docs/assets.md §2)。

  python scripts/process_assets.py          # assets-src/ の元画像をすべて書き出す
  python scripts/process_assets.py enemy_minus_slime   # 1 枚だけ

ChatGPT の画像は「ドット絵風」でも、ドットの大きさが不ぞろいで、色もなめらかに混ざっている。
そこで、決めたドット数(敵なら 64×64)に縮めてから色数を減らし、整数倍に拡大して本物のドット絵にする。
こうすると、画風が 1 枚ごとにずれても、ドットの細かさと色数はそろう。

書き出し先: public/assets/<種類>/<ID>.png と src/assets/paths.json(ID → パス。manifest.ts が読む)
"""
import json
import os
import sys

from PIL import Image, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src')
OUT = os.path.join(ROOT, 'public', 'assets')
PATHS_JSON = os.path.join(ROOT, 'src', 'assets', 'paths.json')

SCALE = 4  # ドット 1 つを 4×4 ピクセルで書き出す(ブラウザは pixelated で拡大するので、くっきりしたまま)

# 種類ごとの決まり: ドット数(幅, 高さ)・色数・透過するか
KINDS = {
    'enemies': {'grid': (64, 64), 'colors': 16, 'alpha': True},
    'characters': {'grid': (64, 96), 'colors': 24, 'alpha': True},
    'backgrounds': {'grid': (240, 160), 'colors': 32, 'alpha': False},
}
# ボスは大きく表示するので、ドットも細かくする
BOSSES = {
    'enemy_king_nega', 'enemy_masked_scribe', 'enemy_shadow_x', 'enemy_twin_dragons',
    'enemy_ring_guardian', 'enemy_king_poly', 'enemy_apostle',
}
BOSS_GRID = (96, 96)
MARGIN = 0.06  # 透過素材のまわりの余白(割合)
# 枠の高さのうち、その素材が占める割合(既定 1)。小さい生き物を人と並べたときに大きく見えすぎないように
FILL = {
    'char_pita': 0.55,  # 手のひらサイズのフクロウ
}


def fit_transparent(im, grid, fill=1.0):
    """透明な余白を切り、決めた縦横比の画面に、足元を下にそろえて置く"""
    box = im.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
    if box:
        im = im.crop(box)
    gw, gh = grid
    w, h = im.size
    # 余白を含めて収まる大きさ(縦横比は grid に合わせる)。fill < 1 なら小さく置く
    s = max(w / (gw * (1 - MARGIN * 2)), h / (gh * (1 - MARGIN * 2))) / fill
    cw, ch = int(round(gw * s)), int(round(gh * s))
    canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    canvas.paste(im, ((cw - w) // 2, ch - h - int(ch * MARGIN)))
    return canvas


def fit_cover(im, grid):
    """背景: 縦横比を合わせて中央を切り出す"""
    gw, gh = grid
    w, h = im.size
    target = gw / gh
    if w / h > target:
        nw = int(h * target)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(w / target)
        im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    return im


def pixelate(im, grid, colors, alpha):
    small = im.resize(grid, Image.BOX)
    if alpha:
        a = small.getchannel('A').point(lambda v: 255 if v > 128 else 0)
        rgb = small.convert('RGB')
        # 透明な部分の色が減色の色選びに混ざらないよう、見えている部分の平均色でうめる
        if a.getbbox():
            avg = tuple(int(v) for v in ImageStat.Stat(rgb, mask=a).mean)
            bg = Image.new('RGB', grid, avg)
            bg.paste(rgb, (0, 0), a)
            rgb = bg
        q = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT).convert('RGBA')
        q.putalpha(a)
    else:
        q = small.convert('RGB').quantize(colors=colors, method=Image.Quantize.MEDIANCUT).convert('RGB')
    return q.resize((grid[0] * SCALE, grid[1] * SCALE), Image.NEAREST)


def process(kind, filename):
    spec = KINDS[kind]
    asset_id = os.path.splitext(filename)[0]
    grid = BOSS_GRID if asset_id in BOSSES else spec['grid']
    im = Image.open(os.path.join(SRC, kind, filename))
    if spec['alpha']:
        im = fit_transparent(im.convert('RGBA'), grid, FILL.get(asset_id, 1.0))
    else:
        im = fit_cover(im.convert('RGB'), grid)
    out = pixelate(im, grid, spec['colors'], spec['alpha'])
    os.makedirs(os.path.join(OUT, kind), exist_ok=True)
    dest = os.path.join(OUT, kind, asset_id + '.png')
    out.save(dest, optimize=True)
    return asset_id, f'assets/{kind}/{asset_id}.png', os.path.getsize(dest)


def main():
    # Windows のコンソールでも日本語が化けないように
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    only = set(sys.argv[1:])
    done = 0
    for kind in KINDS:
        folder = os.path.join(SRC, kind)
        if not os.path.isdir(folder):
            continue
        for f in sorted(os.listdir(folder)):
            if not f.lower().endswith('.png') or (only and os.path.splitext(f)[0] not in only):
                continue
            asset_id, path, size = process(kind, f)
            print(f'{asset_id:32} {path:45} {size // 1024:4} KB')
            done += 1
    # 書き出し済みの画像をすべて並べ直す(1 枚だけ加工したときも、ほかの分は残す)
    paths = {}
    for kind in KINDS:
        folder = os.path.join(OUT, kind)
        if os.path.isdir(folder):
            for f in sorted(os.listdir(folder)):
                if f.endswith('.png'):
                    paths[os.path.splitext(f)[0]] = f'assets/{kind}/{f}'
    with open(PATHS_JSON, 'w', encoding='utf-8', newline='\n') as fp:
        json.dump(paths, fp, ensure_ascii=False, indent=2)
        fp.write('\n')
    print(f'{done} 枚を書き出しました。src/assets/paths.json: {len(paths)} 件')


if __name__ == '__main__':
    main()
