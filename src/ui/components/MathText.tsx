/**
 * 会話・メッセージの 窓の 文(ドット絵の 書体)の 中の 文字式を 見分けやすくする。
 * ドット絵の 書体では「×」と 小文字の「x」が ほとんど 同じ 形で、3×x が 3xx に 見えた(先生の指摘 2026-10-13)。
 * 文字式の 文字(x、a、n、xy など 小文字 1〜3 字)は 数式の 斜体、×・÷ は 本文の 書体で 描く(教科書と 同じ 見た目)
 */
// 4 字以上の 英語(URL など)は 文字式では ないので そのまま
const PIECE = /((?<![a-z])[a-z]{1,3}(?![a-z])|[×÷])/g;

export function MathText({ text }: { text: string }) {
  const parts = text.split(PIECE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 0 ? p : p === '×' || p === '÷' ? <span key={i} class="mt-op">{p}</span> : <i key={i} class="mt-var">{p}</i>,
      )}
    </>
  );
}
