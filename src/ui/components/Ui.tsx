import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

/** 画面共通の小部品。見た目は styles.css の同名クラスで定義する。 */

export function Panel(props: { title?: string; class?: string; children: ComponentChildren }) {
  return (
    <section class={`panel ${props.class ?? ''}`}>
      {props.title && <h2 class="panel-title">{props.title}</h2>}
      {props.children}
    </section>
  );
}

type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean };

export function Button({ primary, class: cls, children, autoFocus, ...rest }: ButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  // autoFocus は ページを 開いたときにしか 効かない(あとから 出た ボタンには フォーカスが 移らない)。
  // 敵を 倒したあとの「つぎの 戦い」などで Enter が 効かなかったので、出たときに 自分で フォーカスする(先生の指摘 2026-10-16)
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return (
    <button ref={ref} type="button" class={`btn ${primary ? 'btn-primary' : ''} ${cls ?? ''}`} {...rest}>
      {children}
    </button>
  );
}

export function Bar(props: { value: number; max: number; color?: string; label?: string }) {
  const ratio = props.max > 0 ? Math.max(0, Math.min(1, props.value / props.max)) : 0;
  return (
    <div class="bar" role="progressbar" aria-valuenow={props.value} aria-valuemax={props.max} aria-label={props.label}>
      <i style={{ width: `${ratio * 100}%`, background: props.color ?? 'var(--ok)' }} />
    </div>
  );
}

export function Note(props: { children: ComponentChildren }) {
  return <p class="note">{props.children}</p>;
}
