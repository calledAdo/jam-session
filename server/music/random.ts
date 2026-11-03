/**
 * Small deterministic PRNG helpers. No Math.random anywhere in this package.
 */

/** Mulberry32 — tiny, fast, good enough for musical choices. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Coerce an optional seed into a stable 32-bit integer. */
export function normalizeSeed(seed: number | undefined): number {
  if (seed === undefined || !Number.isFinite(seed)) return 1;
  return Math.trunc(seed) >>> 0;
}

/** FNV-1a hash used to derive a stable seed from content. */
export function hashSeed(parts: ReadonlyArray<string | number>): number {
  let hash = 0x811c9dc5;
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= 0x1f;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return clamp(value, 0, 1);
}

/** Inclusive integer range. */
export function randomInt(
  random: () => number,
  min: number,
  max: number,
): number {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return low + Math.floor(random() * (high - low + 1));
}

export interface Weighted<T> {
  value: T;
  weight: number;
}

/**
 * Pick one item with probability proportional to its weight. Returns
 * `undefined` for an empty list or when every weight is <= 0.
 */
export function pickWeighted<T>(
  random: () => number,
  items: ReadonlyArray<Weighted<T>>,
): T | undefined {
  let total = 0;
  for (const item of items) {
    if (Number.isFinite(item.weight) && item.weight > 0) total += item.weight;
  }
  if (total <= 0) return undefined;
  let roll = random() * total;
  for (const item of items) {
    if (!Number.isFinite(item.weight) || item.weight <= 0) continue;
    roll -= item.weight;
    if (roll <= 0) return item.value;
  }
  // Floating point fallback: return the last positive-weight item.
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item && item.weight > 0) return item.value;
  }
  return undefined;
}

/** Deterministic Fisher–Yates copy. */
export function shuffled<T>(random: () => number, items: readonly T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = copy[i] as T;
    copy[i] = copy[j] as T;
    copy[j] = tmp;
  }
  return copy;
}

/** Take up to `count` items in a deterministic order. */
export function pickSome<T>(
  random: () => number,
  items: readonly T[],
  count: number,
): T[] {
  if (count <= 0) return [];
  return shuffled(random, items).slice(0, Math.min(count, items.length));
}

/** Round to two decimals for stable, readable analysis numbers. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
