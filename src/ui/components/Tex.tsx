import katex from 'katex';
import { useMemo } from 'preact/hooks';

/** KaTeX で数式を描く。失敗しても例外にせず、赤字で元の文字列を出す(throwOnError: false)。 */
export function Tex({ tex, block = false, class: cls }: { tex: string; block?: boolean; class?: string }) {
  const html = useMemo(() => katex.renderToString(tex, { throwOnError: false, displayMode: block, strict: 'ignore' }), [tex, block]);
  return <span class={`tex ${cls ?? ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * 文章の多い問題文を描く。\text{…} の部分は本文の文字として、残りは KaTeX で描く。
 * KaTeX は 1 つの式を折り返さないので、文章題を丸ごと KaTeX にすると画面の横にはみ出す。
 * 文章の部分を HTML にすれば、ふつうの文と同じように折り返せる(長文は本文書体で読みやすく)
 */
export function ProseTex({ tex, class: cls }: { tex: string; class?: string }) {
  const parts = useMemo(() => splitText(tex), [tex]);
  return (
    <span class={`tex prose-tex ${cls ?? ''}`}>
      {parts.map((p, i) =>
        p.text ? (
          <span key={i}>{p.value}</span>
        ) : (
          <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(p.value, { throwOnError: false, strict: 'ignore' }) }} />
        ),
      )}
    </span>
  );
}

/** 「\text{…}」と それ以外(数式)に分ける。中かっこの対応を数えるので、\text の中の {} にも対応する */
export function splitText(tex: string): { text: boolean; value: string }[] {
  const out: { text: boolean; value: string }[] = [];
  let i = 0;
  let math = '';
  const flushMath = () => {
    if (math.trim()) out.push({ text: false, value: math.trim() });
    math = '';
  };
  while (i < tex.length) {
    if (tex.startsWith('\\text{', i)) {
      let depth = 1;
      let j = i + 6;
      while (j < tex.length && depth > 0) {
        if (tex[j] === '{') depth++;
        else if (tex[j] === '}') depth--;
        j++;
      }
      flushMath();
      out.push({ text: true, value: tex.slice(i + 6, j - 1) });
      i = j;
    } else {
      math += tex[i];
      i++;
    }
  }
  flushMath();
  return out;
}
