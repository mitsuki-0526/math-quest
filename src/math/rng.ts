/** シード付き乱数(mulberry32)。テストで再現でき、同じ問題の連続出題を避ける用途にも使う。 */
export interface Rng {
  /** [0, 1) の一様乱数 */
  next(): number;
  /** min 以上 max 以下の整数 */
  int(min: number, max: number): number;
  /** 0 を除く -max〜max の整数 */
  nonZero(max: number, min?: number): number;
  pick<T>(items: readonly T[]): T;
  bool(p?: number): boolean;
  shuffle<T>(items: readonly T[]): T[];
}

export function createRng(seed: number = Date.now()): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    nonZero(max, min = 1) {
      const mag = rng.int(min, max);
      return next() < 0.5 ? -mag : mag;
    },
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
    bool(p = 0.5) {
      return next() < p;
    },
    shuffle(items) {
      const arr = [...items];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
  return rng;
}
