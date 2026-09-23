import { useState } from 'preact/hooks';
import { getAsset, assetUrl } from '@/assets/manifest';

interface Props {
  id: string;
  /** 描画サイズ(px)。省略時は親の CSS に従う */
  size?: number;
  class?: string;
  /** 画像の alt / 読み上げ */
  alt?: string;
}

/**
 * 素材ID で画像を描く。画像がない・読めないときは絵文字プレースホルダ(要件 F90 F91)。
 * 見た目の切り替えはここだけで済むように、画面側は常に <Sprite id> を使う。
 */
export function Sprite({ id, size, class: cls, alt }: Props) {
  const asset = getAsset(id);
  const [failed, setFailed] = useState(false);
  const style = size ? { width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.7}px` } : undefined;

  if (asset.path && !failed) {
    return (
      <img
        class={`sprite ${cls ?? ''}`}
        src={assetUrl(asset.path)}
        alt={alt ?? asset.label}
        style={style}
        onError={() => setFailed(true)}
        draggable={false}
      />
    );
  }
  return (
    <span class={`sprite sprite-placeholder ${cls ?? ''}`} style={style} role="img" aria-label={alt ?? asset.label} title={asset.label}>
      {asset.emoji}
    </span>
  );
}
