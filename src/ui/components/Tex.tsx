import katex from 'katex';
import { useMemo } from 'preact/hooks';

/** KaTeX で数式を描く。失敗しても例外にせず、赤字で元の文字列を出す(throwOnError: false)。 */
export function Tex({ tex, block = false, class: cls }: { tex: string; block?: boolean; class?: string }) {
  const html = useMemo(() => katex.renderToString(tex, { throwOnError: false, displayMode: block, strict: 'ignore' }), [tex, block]);
  return <span class={`tex ${cls ?? ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
