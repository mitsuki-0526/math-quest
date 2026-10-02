// プリントから 読み取った 式の「特徴」を 計算する(LLM には 計算させない。読み取りだけ)。
// 特徴だけを 集計に 使い、問題文や 式そのものは リポジトリに 入れない(市販教材のため。docs/print-import.md)

/** 全角・各種マイナス・× を そろえる。÷ は わり算、/ は 分数(a/b)として 分けて 残す */
export function normalizeExpr(s) {
  return String(s ?? '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[−－‐―ー–—]/g, '-')
    .replace(/[＋]/g, '+')
    .replace(/[×✕＊]/g, '*')
    .replace(/[／]/g, '/')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[＝]/g, '=')
    .replace(/\s+/g, '');
}

/**
 * 数と 式だけか。LLM が 説明の 枠や 問題文を 式の 欄に 入れることが ある(2026-10-01)ので、
 * 文章が まじった ものは 集計に 入れない(集計は 外に 出してよい ファイル。プリントの 文章を 入れない)
 */
export function isMathExpr(expr) {
  const s = normalizeExpr(expr);
  return s.length > 0 && s.length <= 60 && /^[0-9a-z+\-*/÷^().,=〜~□]+$/i.test(s);
}

/** 式に 出てくる 数(符号なしの 大きさ) */
export function numbersOf(expr) {
  return (normalizeExpr(expr).match(/\d+(\.\d+)?/g) ?? []).map(Number);
}

/**
 * 加減の 項の 数(かっこの 外の + − で 区切る)。(−3)+(+5)−(−2) → 3、−2−6+5 → 3
 */
export function termCount(expr) {
  const s = normalizeExpr(expr).split('=')[0];
  let depth = 0;
  let terms = 1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if ((c === '+' || c === '-') && depth === 0 && i > 0 && !'*/÷^('.includes(s[i - 1])) terms++;
  }
  return terms;
}

/**
 * 使っている 演算(加・減・乗・除・累乗)。符号の + −(先頭・かっこや 演算の 直後)は 演算に 数えない。
 * 分数の / も 数えない(わり算は ÷)
 */
export function opsOf(expr) {
  const s = normalizeExpr(expr);
  const names = { '+': '加', '-': '減', '*': '乗', '÷': '除', '^': '累乗' };
  const found = new Set();
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (!(c in names)) continue;
    if ((c === '+' || c === '-') && (i === 0 || '(*÷^=+-'.includes(s[i - 1]))) continue;
    found.add(names[c]);
  }
  return [...found].sort().join('');
}

/** 形: 数を # に した 式(同じ 形の 問題を まとめるため)。(−3)+(+5) → (-#)+(+#) */
export function shapeOfExpr(expr) {
  return normalizeExpr(expr).replace(/\d+(\.\d+)?/g, '#');
}

/** 素因数分解: 60 → [[2, 2], [3, 1], [5, 1]](素因数と 指数) */
export function factorize(n) {
  const out = [];
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    let e = 0;
    while (m % p === 0) {
      m /= p;
      e++;
    }
    if (e) out.push([p, e]);
  }
  if (m > 1) out.push([m, 1]);
  return out;
}

/**
 * 1 つの 自然数だけの 問題(「30 を 素因数分解しなさい」など)の 特徴。
 * 素因数の 個数(重複を 数える)・種類・いちばん 大きい 素因数・いちばん 大きい 指数
 */
export function factorFeatures(expr) {
  const s = normalizeExpr(expr);
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (n < 2) return null;
  const f = factorize(n);
  return {
    n,
    digits: s.length,
    primeCount: f.reduce((a, [, e]) => a + e, 0),
    distinct: f.length,
    largestPrime: f[f.length - 1][0],
    maxExp: Math.max(...f.map(([, e]) => e)),
    isPrime: f.length === 1 && f[0][1] === 1,
  };
}

/** 特徴(集計に 使う。式そのものは 入れない) */
export function featuresOf(expr) {
  const s = normalizeExpr(expr);
  const nums = numbersOf(s);
  return {
    factor: factorFeatures(s),
    shape: shapeOfExpr(s),
    terms: termCount(s),
    numbers: nums.length,
    maxNumber: nums.length ? Math.max(...nums) : 0,
    twoDigit: nums.filter((n) => n >= 10).length,
    hasDecimal: /\d\.\d/.test(s),
    hasFraction: /\d\/\d/.test(s) && !/[a-z]/i.test(s),
    hasParen: s.includes('('),
    hasPower: s.includes('^'),
    ops: opsOf(s),
    letters: [...new Set(s.match(/[a-z]/gi) ?? [])].sort().join(''),
    isEquation: s.includes('='),
  };
}

/** 2 回の 読み取りが 同じか(符号・数の 読み違いを 見つける)。空白・全角の 違いは 無視 */
export function sameReading(a, b) {
  return normalizeExpr(a) === normalizeExpr(b);
}

/** 特徴を 形ごとに まとめる(件数・数の 範囲・2 けたの 数 など) */
export function summarize(featureList) {
  const byShape = new Map();
  for (const f of featureList) {
    const g = byShape.get(f.shape) ?? { shape: f.shape, count: 0, maxNumber: 0, terms: f.terms, twoDigitMax: 0 };
    g.count++;
    g.maxNumber = Math.max(g.maxNumber, f.maxNumber);
    g.twoDigitMax = Math.max(g.twoDigitMax, f.twoDigit);
    byShape.set(f.shape, g);
  }
  const all = featureList;
  const pct = (n) => (all.length ? `${Math.round((n / all.length) * 100)}%` : '—');
  return {
    total: all.length,
    terms: countBy(all.map((f) => f.terms)),
    maxNumber: all.length ? Math.max(...all.map((f) => f.maxNumber)) : 0,
    twoDigitShare: pct(all.filter((f) => f.twoDigit > 0).length),
    decimalShare: pct(all.filter((f) => f.hasDecimal).length),
    fractionShare: pct(all.filter((f) => f.hasFraction).length),
    parenShare: pct(all.filter((f) => f.hasParen).length),
    powerShare: pct(all.filter((f) => f.hasPower).length),
    ops: countBy(all.map((f) => f.ops)),
    tasks: countBy(all.map((f) => f.task ?? '')),
    shapes: [...byShape.values()].sort((a, b) => b.count - a.count),
    factor: summarizeFactors(all.map((f) => f.factor).filter(Boolean)),
  };
}

/** 1 つの 自然数の 問題(素因数分解 など)の 集計。なければ null */
export function summarizeFactors(list) {
  if (list.length === 0) return null;
  const ns = list.map((f) => f.n);
  return {
    total: list.length,
    min: Math.min(...ns),
    max: Math.max(...ns),
    digits: countBy(list.map((f) => f.digits)),
    primeCount: countBy(list.map((f) => f.primeCount)),
    distinct: countBy(list.map((f) => f.distinct)),
    largestPrime: countBy(list.map((f) => f.largestPrime)),
    maxExp: countBy(list.map((f) => f.maxExp)),
    primes: list.filter((f) => f.isPrime).length,
  };
}

function countBy(xs) {
  const m = {};
  for (const x of xs) m[x] = (m[x] ?? 0) + 1;
  return m;
}
