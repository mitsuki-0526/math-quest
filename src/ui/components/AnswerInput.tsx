import { useEffect, useRef } from 'preact/hooks';
import type { AnswerKind, AnswerSpec } from '@/math/template';
import { parseRational, parseRationalList, toTex, normalizeInput } from '@/math/rational';
import { parseFactorization } from '@/math/factorization';
import { parseExpression, polyToTex } from '@/math/expr';
import { saveStore } from '@/engine/save';
import { useStore } from '@/engine/store';
import { Button } from './Ui';
import { Tex } from './Tex';

/**
 * 物語で手に入れる入力キー(要件 F49 の拡張)。フラグ `key:<記号>` が立つまで 🔒 で押せない。
 * 最初から使えるのは 数字・−・/・.・,・⌫。答えるのに必須になる前に必ず手に入る配置にする(台本側の責任)。
 */
export const STORY_KEYS = ['×', '^', 'x', '(', ')', 'π', '√'] as const;
export const keyFlag = (k: string): string => `key:${k}`;
/** 文字キー(x, a, n …)はまとめて「文字」の力(key:x)で解放する */
const storyKeyFor = (label: string): string => (/^[a-z]$/.test(label) ? 'x' : label);
export function isKeyUnlocked(flags: Record<string, boolean>, k: string): boolean {
  const key = storyKeyFor(k);
  return !(STORY_KEYS as readonly string[]).includes(key) || !!flags[keyFlag(key)];
}

/**
 * 回答入力(要件 F42 F43 F49)。
 * - 数値/複数値/素因数分解: テキスト入力 + パレット(問題タイプに応じて使えるキーだけ有効)
 * - 選択式: 4つのボタン(キーボードの 1〜4 でも選べる)
 * - 入力中の内容を数式で「読み下し」表示する(² や ^ を知らなくても、打った結果がどう読まれるか分かる)
 * キーボードだけでも、マウスだけでも回答できる。
 */
interface Props {
  answer: AnswerSpec;
  value: string;
  onChange(v: string): void;
  /** Enter / こうげき / 選択肢クリックで呼ばれる。選択式では選んだ番号の文字列が value に入った状態で呼ぶ */
  onSubmit(v: string): void;
  disabled?: boolean;
  submitLabel?: string;
}

interface Key {
  label: string;
  /** キーの下に出す小さな説明。数字キーは省略 */
  caption?: string;
  /** 入力に挿入する文字。省略時は label */
  insert?: string;
  /** 使える答えの形式。省略時は全部 */
  kinds?: AnswerKind[];
  action?: 'backspace';
}

const TEXT_KINDS: AnswerKind[] = ['number', 'numbers', 'factorization', 'expression'];
const NUMERIC: AnswerKind[] = ['number', 'numbers'];
const WITH_EXPR: AnswerKind[] = ['number', 'numbers', 'expression'];

/** モック画面2のパレット配置。式入力(expression: x, √, かっこ)のキーは M5 で有効化する */
const KEYS: Key[][] = [
  [
    { label: '7' },
    { label: '8' },
    { label: '9' },
    { label: '−', caption: 'マイナス', insert: '-', kinds: WITH_EXPR },
    { label: '/', caption: '分数', kinds: WITH_EXPR },
    { label: '⌫', caption: '消す', action: 'backspace' },
  ],
  [
    { label: '4' },
    { label: '5' },
    { label: '6' },
    { label: '×', caption: 'かける', kinds: ['factorization'] },
    { label: '^', caption: '累乗 x^2', kinds: ['factorization', 'expression'] },
    { label: '√', caption: 'ルート', kinds: [] },
  ],
  [
    { label: '1' },
    { label: '2' },
    { label: '3' },
    { label: '+', caption: 'たす', kinds: ['expression'] },
    { label: '(', caption: 'かっこ', kinds: ['expression'] },
    { label: ')', caption: 'かっこ', kinds: ['expression'] },
  ],
  [
    { label: '0' },
    { label: '.', caption: '小数点', kinds: NUMERIC },
    { label: ',', caption: '答えを区切る', kinds: ['numbers'] },
  ],
];

/** 式入力のとき、その問題に出てくる文字だけをキーにする(問題ごとに変わる) */
function letterKeys(answer: AnswerSpec): Key[] {
  if (answer.kind !== 'expression') return [];
  const p = parseExpression(answer.expected);
  if (!p) return [];
  const vars = [...new Set(p.terms.flatMap((t) => Object.keys(t.vars)))].sort();
  return vars.slice(0, 3).map((v) => ({ label: v, caption: v === 'π' ? '円周率 π' : `文字 ${v}`, kinds: ['expression' as AnswerKind] }));
}

export function AnswerInput({ answer, value, onChange, onSubmit, disabled, submitLabel = 'こうげき (Enter)' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const save = useStore(saveStore);
  const flags = save?.flags ?? {};

  // 出題が変わったら入力欄にフォーカスを戻す(キーボード操作を止めない)
  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [answer, disabled]);

  // 選択式: 1〜4 キーで回答
  useEffect(() => {
    if (answer.kind !== 'choice' || disabled) return;
    const count = answer.options.length;
    function onKey(e: KeyboardEvent) {
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= count) {
        e.preventDefault();
        onSubmit(String(n - 1));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, disabled, onSubmit]);

  if (answer.kind === 'choice') {
    return (
      <div class="choice-grid" role="group" aria-label="選択肢">
        {answer.options.map((opt, i) => (
          <Button key={i} class="choice-btn" disabled={disabled} onClick={() => onSubmit(String(i))}>
            <span class="choice-num">{i + 1}</span> <Tex tex={opt} />
          </Button>
        ))}
      </div>
    );
  }

  function press(k: Key) {
    if (k.action === 'backspace') onChange(value.slice(0, -1));
    else onChange(value + (k.insert ?? k.label));
    inputRef.current?.focus();
  }
  const usable = (k: Key) => (k.kinds ? k.kinds.includes(answer.kind) : TEXT_KINDS.includes(answer.kind));
  const locked = (k: Key) => !isKeyUnlocked(flags, k.label);
  const preview = previewTex(answer, value);
  const help = helpFor(answer, isKeyUnlocked(flags, '^'));

  return (
    <form
      class="answer-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && value.trim()) onSubmit(value);
      }}
    >
      <div class="row">
        <input
          ref={inputRef}
          class="answer-input"
          value={value}
          disabled={disabled}
          autoComplete="off"
          inputMode={answer.kind === 'factorization' ? 'text' : 'decimal'}
          placeholder={placeholderFor(answer)}
          aria-label="答え"
          onInput={(e) => onChange((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            // フォームの暗黙送信に頼らず、Enter を明示的に処理する(IME 確定の Enter は isComposing で除外)
            if (e.key === 'Enter' && !e.isComposing) {
              e.preventDefault();
              if (!disabled && value.trim()) onSubmit(value);
            }
          }}
        />
        <Button primary type="submit" disabled={disabled || !value.trim()}>
          {submitLabel}
        </Button>
      </div>
      <div class="answer-preview" aria-live="polite">
        {preview ? (
          <>
            こう読みます: <Tex tex={preview} />
          </>
        ) : value.trim() ? (
          <span class="warn">まだ 数として 読めません</span>
        ) : (
          <span class="answer-help">{help}</span>
        )}
      </div>
      <div class="keypad" aria-label="入力パレット">
        {[...KEYS.flat(), ...letterKeys(answer)].map((k) => (
          <button
            type="button"
            key={k.label}
            class={`key ${locked(k) ? 'locked' : ''}`}
            disabled={disabled || !usable(k) || locked(k)}
            tabIndex={-1}
            title={locked(k) ? 'まだ 手に入れていない 力' : k.caption}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => press(k)}
          >
            <span>{locked(k) ? '🔒' : k.label}</span>
            {k.caption && <span class="key-cap">{locked(k) ? '???' : k.caption}</span>}
          </button>
        ))}
      </div>
    </form>
  );
}

/** 入力中の文字列を、判定と同じ解釈で KaTeX にする。読めなければ null */
function previewTex(answer: AnswerSpec, value: string): string | null {
  if (!value.trim()) return null;
  switch (answer.kind) {
    case 'number': {
      const r = parseRational(value);
      return r ? toTex(r) : null;
    }
    case 'numbers': {
      const list = parseRationalList(value);
      return list ? list.map(toTex).join(',\\ ') : null;
    }
    case 'expression': {
      const p = parseExpression(value);
      return p ? polyToTex(p) : null;
    }
    case 'factorization': {
      const f = parseFactorization(value);
      if (!f) return null;
      // 打った形(2^3 や 2²)をそのまま数式にして見せる。累乗の書き方が正しく読まれているかを確認できるように
      const typed = normalizeInput(value)
        .toLowerCase()
        .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => '^' + [...m].map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join(''))
        .replace(/x/g, '*')
        .split('*')
        .filter(Boolean)
        .map((part) => part.replace(/^(\d+)\^(\d+)$/, '$1^{$2}'))
        .join(' \\times ');
      return `${typed} = ${f.product}`;
    }
    default:
      return null;
  }
}

function placeholderFor(a: AnswerSpec): string {
  switch (a.kind) {
    case 'number':
      return '答えを 入力';
    case 'numbers':
      return '例: 4, -4';
    case 'factorization':
      return '例: 2×2×3';
    case 'expression':
      return '例: 3x+2';
    default:
      return '';
  }
}

function helpFor(a: AnswerSpec, hasPower: boolean): string {
  switch (a.kind) {
    case 'number':
      return '分数は 3/4、小数は 0.5、負の数は −3 のように 入れます';
    case 'numbers':
      return '答えが 2つ以上のときは「,」で 区切ります(順番は 自由)';
    case 'expression':
      return '文字の式で 答えます。× は 省いて 3x、同じ文字の かけ算は x^2 と 書きます';
    case 'factorization':
      return hasPower ? '同じ数は × で くり返して OK(2×2×3)。累乗なら 2^2×3(「^」の後ろに 何乗かを 書く)' : '同じ数は × で くり返して 書きます(例: 2×2×3)';
    default:
      return '';
  }
}
