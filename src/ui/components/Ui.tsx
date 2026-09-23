import type { ComponentChildren, JSX } from 'preact';

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

export function Button({ primary, class: cls, children, ...rest }: ButtonProps) {
  return (
    <button type="button" class={`btn ${primary ? 'btn-primary' : ''} ${cls ?? ''}`} {...rest}>
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
