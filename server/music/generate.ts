/**
 * Deterministic musical generators.
 *
 * Every function returns a `Patch` and never mutates its inputs. Patches only
 * ever cover cells that exist inside the input row, so `applyPatch` can never
 * grow a track.
 *
 * Bar indexes are 0-based and inclusive: `barStart: 0, barEnd: 1` is the first
 * two bars.
 */

import {
  romanToDegree,
  shiftRomanNumeral,
  simplifyRomanNumeral,
} from "./notes";
import { diffSteps } from "./patch";
import {
  clamp,
  clamp01,
  hashSeed,
  mulberry32,
  normalizeSeed,
  pickSome,
  pickWeighted,
  randomInt,
  type Weighted,
} from "./random";
import {
  STEPS_PER_BAR,
  type BarSelection,
  type BassSteps,
  type DrumSteps,
  type DrumTrackKind,
  type FillOptions,
  type FillStyle,
  type KeysSteps,
  type Patch,
  type StepsFor,
  type TrackKind,
  type TransformMode,
  type TransformOptions,
  type VaryOptions,
} from "./types";

const DEFAULT_SCALE_LENGTH = 7;

/** Major-ish roman numerals used when varying keys. */
const MAJOR_PALETTE = ["I", "ii", "iii", "IV", "V", "vi"] as const;
/** Minor-ish roman numerals used when varying keys. */
const MINOR_PALETTE = ["i", "III", "iv", "v", "VI", "VII"] as const;

const DEFAULT_FILL_TRACK: Record<FillStyle, DrumTrackKind> = {
  roll: "snare",
  stutter: "hat",
  drop: "kick",
};

const ROLL_FILL: ReadonlyArray<readonly [number, number]> = [
  [10, 1],
  [11, 1],
  [12, 2],
  [13, 2],
  [14, 3],
  [15, 3],
];

const STUTTER_FILL: ReadonlyArray<readonly [number, number]> = [
  [8, 1],
  [9, 2],
  [10, 1],
  [11, 2],
  [12, 1],
  [13, 2],
  [14, 1],
  [15, 3],
];

interface BarRange {
  start: number;
  end: number;
  bars: number;
}

/**
 * Vary a drum row. Adds, moves, and removes hits, preferring off-beats. The
 * kick's bar-start hit is always preserved (and re-anchored if missing).
 */
function varyDrums(
  track: DrumTrackKind,
  steps: DrumSteps,
  options: VaryOptions,
): Patch {
  const range = resolveBarRange(
    steps.length,
    false,
    options.barStart,
    options.barEnd,
  );
  if (!range) return [];

  const before = steps.slice();
  const after = steps.slice();
  const random = mulberry32(normalizeSeed(options.seed));
  const intensity = clamp01(options.intensity);
  if (intensity <= 0) return [];

  for (let bar = range.start; bar <= range.end; bar++) {
    const base = bar * STEPS_PER_BAR;

    if (track === "kick" && (after[base] ?? 0) <= 0) {
      after[base] = 1;
    }

    const changes = changeCount(random, intensity);
    for (let change = 0; change < changes; change++) {
      const hits: number[] = [];
      for (let offset = 0; offset < STEPS_PER_BAR; offset++) {
        const index = base + offset;
        if ((after[index] ?? 0) > 0) hits.push(index);
      }

      const canRemove = hits.filter((index) => {
        if (track === "kick" && index === base) return false;
        if (track === "snare" && (index === base + 4 || index === base + 12)) {
          return false;
        }
        return true;
      });
      const canMove = canRemove;

      const roll = random();
      if (canRemove.length === 0 || roll < 0.4) {
        addDrumHit(random, after, base, hits);
      } else if (roll < 0.72) {
        moveDrumHit(random, after, base, canMove);
      } else {
        const source = pickWeighted(
          random,
          canRemove.map((index) => ({
            value: index,
            weight: (index - base) % 2 === 0 ? 1.2 : 2,
          })),
        );
        if (source !== undefined) after[source] = 0;
      }
    }
  }

  return diffSteps(track, before, after);
}

function addDrumHit(
  random: () => number,
  after: number[],
  base: number,
  hits: readonly number[],
): void {
  const candidates: Weighted<number>[] = [];
  for (let offset = 0; offset < STEPS_PER_BAR; offset++) {
    const index = base + offset;
    if ((after[index] ?? 0) > 0) continue;
    let weight =
      offset % 4 === 0 ? (offset === 0 ? 0.15 : 1) : offset % 2 === 0 ? 2 : 3;
    if (hits.some((hit) => Math.abs(hit - index) === 1)) weight += 1.5;
    candidates.push({ value: index, weight });
  }

  const target = pickWeighted(random, candidates);
  if (target === undefined) return;
  after[target] = random() < 0.35 ? 2 : 1;
}

function moveDrumHit(
  random: () => number,
  after: number[],
  base: number,
  movable: readonly number[],
): void {
  if (movable.length === 0) return;
  const source = pickWeighted(
    random,
    movable.map((index) => ({
      value: index,
      weight: (index - base) % 4 === 0 ? 1 : 2,
    })),
  );
  if (source === undefined) return;

  const offsets = [1, -1, 2, -2, 3, -3, 4, -4];
  const distances = new Map<number, number>();
  for (const offset of offsets) {
    const target = source + offset;
    if (target < base || target >= base + STEPS_PER_BAR) continue;
    if ((after[target] ?? 0) > 0) continue;
    distances.set(target, Math.abs(offset));
  }
  const target = pickWeighted(
    random,
    [...distances.entries()].map(([index, distance]) => ({
      value: index,
      weight: 1 / distance,
    })),
  );
  if (target === undefined) return;

  after[target] = after[source] ?? 1;
  after[source] = 0;
}

/**
 * Vary a bass row with neighbour-degree moves and rhythmic shifts. New degrees
 * stay within `1..scaleLength` and bar-start notes are treated as anchors.
 */
function varyBass(steps: BassSteps, options: VaryOptions): Patch {
  const range = resolveBarRange(
    steps.length,
    false,
    options.barStart,
    options.barEnd,
  );
  if (!range) return [];

  const scaleLength = normalizeScaleLength(options.scaleLength);
  const before = steps.slice();
  const after = steps.slice();
  const random = mulberry32(normalizeSeed(options.seed));
  const intensity = clamp01(options.intensity);
  if (intensity <= 0) return [];

  for (let bar = range.start; bar <= range.end; bar++) {
    const base = bar * STEPS_PER_BAR;
    const changes = changeCount(random, intensity * 0.7);

    for (let change = 0; change < changes; change++) {
      const notes: number[] = [];
      for (let offset = 0; offset < STEPS_PER_BAR; offset++) {
        if ((after[base + offset] ?? null) !== null) notes.push(base + offset);
      }
      const movable = notes.filter((index) => index !== base);

      const roll = random();
      if (movable.length === 0 || roll < 0.2) {
        addBassNote(random, after, base, scaleLength);
      } else if (roll < 0.65) {
        shiftBassDegree(random, after, movable, scaleLength);
      } else {
        moveBassNote(random, after, base, movable);
      }
    }
  }

  return diffSteps("bass", before, after);
}

function addBassNote(
  random: () => number,
  after: BassSteps,
  base: number,
  scaleLength: number,
): void {
  const candidates: Weighted<number>[] = [];
  const existing: number[] = [];
  for (let offset = 0; offset < STEPS_PER_BAR; offset++) {
    const degree = after[base + offset] ?? null;
    if (degree !== null) existing.push(degree);
    else {
      candidates.push({
        value: base + offset,
        weight:
          offset % 4 === 0
            ? offset === 0
              ? 0.2
              : 1
            : offset % 2 === 0
              ? 2
              : 3,
      });
    }
  }
  const target = pickWeighted(random, candidates);
  if (target === undefined) return;

  if (existing.length > 0) {
    const anchor = existing[randomInt(random, 0, existing.length - 1)] ?? 1;
    const step = random() < 0.5 ? -1 : 1;
    after[target] = clamp(anchor + step, 1, scaleLength);
  } else {
    after[target] = randomInt(random, 1, scaleLength);
  }
}

function shiftBassDegree(
  random: () => number,
  after: BassSteps,
  movable: readonly number[],
  scaleLength: number,
): void {
  const index = movable[randomInt(random, 0, movable.length - 1)];
  if (index === undefined) return;
  const degree = after[index] ?? 1;
  const interval = random() < 0.25 ? 2 : 1;
  const direction = random() < 0.5 ? -1 : 1;
  after[index] = clamp(degree + interval * direction, 1, scaleLength);
}

function moveBassNote(
  random: () => number,
  after: BassSteps,
  base: number,
  movable: readonly number[],
): void {
  if (movable.length === 0) return;
  const source = movable[randomInt(random, 0, movable.length - 1)];
  if (source === undefined) return;

  const targets: Weighted<number>[] = [];
  for (const offset of [1, -1, 2, -2, 3, -3]) {
    const target = source + offset;
    if (target < base || target >= base + STEPS_PER_BAR) continue;
    if ((after[target] ?? null) !== null) continue;
    targets.push({ value: target, weight: 1 / Math.abs(offset) });
  }
  const target = pickWeighted(random, targets);
  if (target === undefined) return;

  after[target] = after[source] ?? null;
  after[source] = null;
}

/** Vary a keys row by swapping chords for nearby diatonic alternatives. */
function varyKeys(steps: KeysSteps, options: VaryOptions): Patch {
  const range = resolveBarRange(
    steps.length,
    true,
    options.barStart,
    options.barEnd,
  );
  if (!range) return [];

  const before = steps.slice();
  const after = steps.slice();
  const random = mulberry32(normalizeSeed(options.seed));
  const intensity = clamp01(options.intensity);
  if (intensity <= 0) return [];

  const lowerCaseCount = steps.filter(
    (step) => step === step.toLowerCase() && /[iv]/.test(step),
  ).length;
  const palette =
    lowerCaseCount > steps.length / 2 ? MINOR_PALETTE : MAJOR_PALETTE;

  for (let bar = range.start; bar <= range.end; bar++) {
    const changes = 1 + Math.floor(intensity * 2 * random());
    for (let change = 0; change < changes; change++) {
      const current = after[bar] ?? "";
      const currentDegree = romanToDegree(current);
      const candidates: Weighted<string>[] = [];
      for (const numeral of palette) {
        if (numeral === current) continue;
        const degree = romanToDegree(numeral) ?? 1;
        const distance =
          currentDegree === null ? 1 : Math.abs(degree - currentDegree);
        candidates.push({ value: numeral, weight: distance <= 2 ? 3 : 1 });
      }
      const replacement = pickWeighted(random, candidates);
      if (replacement !== undefined) after[bar] = replacement;
    }
  }

  return diffSteps("keys", before, after);
}

/**
 * Vary the selected bars of one row.
 *
 * Determinism: the same `kind`, `steps`, bars, intensity, and seed always
 * produce an identical patch. Intensity 0.1 gives roughly 1–2 changes per bar;
 * 1.0 is heavy.
 */
export function varyPattern<K extends TrackKind>(
  kind: K,
  steps: StepsFor<K>,
  options: VaryOptions,
): Patch {
  if (kind === "kick" || kind === "snare" || kind === "hat") {
    return varyDrums(kind, steps as unknown as DrumSteps, options);
  }
  if (kind === "bass") {
    return varyBass(steps as unknown as BassSteps, options);
  }
  if (kind === "keys") {
    return varyKeys(steps as unknown as KeysSteps, options);
  }
  return [];
}

/**
 * Add a fill at the end of `bar`.
 *
 * Style → default row: `roll` → snare, `stutter` → hat, `drop` → kick.
 * Pass `options.track` to target another drum row. `bar` is 0-based.
 */
export function addFill(
  steps: DrumSteps,
  bar: number,
  style: FillStyle,
  options: FillOptions = {},
): Patch {
  const barIndex = Math.trunc(bar);
  const barCount = Math.floor(steps.length / STEPS_PER_BAR);
  if (
    !Number.isFinite(barIndex) ||
    barIndex < 0 ||
    barIndex >= barCount ||
    !(style in DEFAULT_FILL_TRACK)
  ) {
    return [];
  }

  const track = options.track ?? DEFAULT_FILL_TRACK[style];
  const base = barIndex * STEPS_PER_BAR;
  const before = steps.slice();
  const after = steps.slice();

  if (style === "roll" || style === "stutter") {
    const fill = style === "roll" ? ROLL_FILL : STUTTER_FILL;
    for (const [offset, velocity] of fill) {
      const index = base + offset;
      after[index] = Math.max(after[index] ?? 0, velocity);
    }
  } else {
    let removed = 0;
    for (let offset = 12; offset < STEPS_PER_BAR; offset++) {
      if ((after[base + offset] ?? 0) > 0) {
        after[base + offset] = 0;
        removed++;
      }
    }
    if (removed === 0) {
      for (
        let offset = STEPS_PER_BAR - 1;
        offset >= 1 && removed < 2;
        offset--
      ) {
        if ((after[base + offset] ?? 0) > 0) {
          after[base + offset] = 0;
          removed++;
        }
      }
    }
  }

  return diffSteps(track, before, after);
}

/**
 * Apply a directional edit to the selected bars.
 *
 * - `simplify`: remove ~40% of non-downbeat hits / notes, hold chords.
 * - `darker`: lower velocities, bass down a third, minor-leaning chords.
 * - `brighter`: raise velocities, bass up a third, major-leaning chords.
 */
export function transform<K extends TrackKind>(
  kind: K,
  steps: StepsFor<K>,
  selection: BarSelection,
  mode: TransformMode,
  options: TransformOptions = {},
): Patch {
  const values = steps as unknown as ReadonlyArray<number | string | null>;
  const seed = hashSeed([
    kind,
    mode,
    selection.barStart,
    selection.barEnd,
    ...values.map((value) => (value === null ? "null" : value)),
  ]);

  if (kind === "kick" || kind === "snare" || kind === "hat") {
    return transformDrums(
      kind,
      steps as unknown as DrumSteps,
      selection,
      mode,
      seed,
    );
  }
  if (kind === "bass") {
    return transformBass(
      steps as unknown as BassSteps,
      selection,
      mode,
      seed,
      normalizeScaleLength(options.scaleLength),
    );
  }
  if (kind === "keys") {
    return transformKeys(steps as unknown as KeysSteps, selection, mode, seed);
  }
  return [];
}

function transformDrums(
  track: DrumTrackKind,
  steps: DrumSteps,
  selection: BarSelection,
  mode: TransformMode,
  seed: number,
): Patch {
  const range = resolveBarRange(
    steps.length,
    false,
    selection.barStart,
    selection.barEnd,
  );
  if (!range) return [];

  const before = steps.slice();
  const after = steps.slice();
  const random = mulberry32(seed);
  const from = range.start * STEPS_PER_BAR;
  const to = (range.end + 1) * STEPS_PER_BAR;

  if (mode === "simplify") {
    const removable: number[] = [];
    for (let index = from; index < to; index++) {
      if ((after[index] ?? 0) > 0 && index % 4 !== 0) removable.push(index);
    }
    const removeCount = Math.round(removable.length * 0.4);
    for (const index of pickSome(random, removable, removeCount))
      after[index] = 0;
  } else if (mode === "darker") {
    for (let index = from; index < to; index++) {
      const value = after[index] ?? 0;
      if (value > 0) after[index] = Math.max(1, value - 1);
    }
  } else {
    for (let index = from; index < to; index++) {
      const value = after[index] ?? 0;
      if (value > 0) after[index] = Math.min(3, value + 1);
    }
    for (let index = from; index < to; index++) {
      if (index % 2 === 1 && (after[index] ?? 0) === 0 && random() < 0.3) {
        after[index] = 1;
      }
    }
  }

  return diffSteps(track, before, after);
}

function transformBass(
  steps: BassSteps,
  selection: BarSelection,
  mode: TransformMode,
  seed: number,
  scaleLength: number,
): Patch {
  const range = resolveBarRange(
    steps.length,
    false,
    selection.barStart,
    selection.barEnd,
  );
  if (!range) return [];

  const before = steps.slice();
  const after = steps.slice();
  const random = mulberry32(seed);
  const from = range.start * STEPS_PER_BAR;
  const to = (range.end + 1) * STEPS_PER_BAR;

  if (mode === "simplify") {
    const removable: number[] = [];
    for (let index = from; index < to; index++) {
      if ((after[index] ?? null) !== null && index % 4 !== 0)
        removable.push(index);
    }
    const removeCount = Math.round(removable.length * 0.4);
    for (const index of pickSome(random, removable, removeCount))
      after[index] = null;
  } else {
    const delta = mode === "darker" ? -2 : 2;
    for (let index = from; index < to; index++) {
      const degree = after[index] ?? null;
      if (degree === null) continue;
      after[index] = clamp(degree + delta, 1, scaleLength);
    }
  }

  return diffSteps("bass", before, after);
}

function transformKeys(
  steps: KeysSteps,
  selection: BarSelection,
  mode: TransformMode,
  seed: number,
): Patch {
  const range = resolveBarRange(
    steps.length,
    true,
    selection.barStart,
    selection.barEnd,
  );
  if (!range) return [];

  const before = steps.slice();
  const after = steps.slice();
  const random = mulberry32(seed);

  if (mode === "simplify") {
    for (let bar = range.start; bar <= range.end; bar++) {
      after[bar] = simplifyRomanNumeral(after[bar] ?? "");
    }
    const holdable: number[] = [];
    for (let bar = range.start + 1; bar <= range.end; bar++) holdable.push(bar);
    const holdCount = Math.round(holdable.length * 0.4);
    for (const bar of pickSome(random, holdable, holdCount)) {
      const previous = after[bar - 1];
      if (previous !== undefined) after[bar] = previous;
    }
  } else {
    const delta = mode === "darker" ? -2 : 2;
    const caseMode = mode === "darker" ? "lower" : "upper";
    for (let bar = range.start; bar <= range.end; bar++) {
      const chord = after[bar] ?? "";
      if (chord.trim().length === 0) continue;
      after[bar] = shiftRomanNumeral(chord, delta, caseMode);
    }
  }

  return diffSteps("keys", before, after);
}

/** Change count for one bar, scaled by intensity. */
function changeCount(random: () => number, intensity: number): number {
  const safeIntensity = clamp01(intensity);
  const low = safeIntensity <= 0.15 ? 1 : 2;
  const high = Math.max(low, 1 + Math.round(safeIntensity * 6));
  return randomInt(random, low, high);
}

function normalizeScaleLength(scaleLength: number | undefined): number {
  if (scaleLength === undefined || !Number.isFinite(scaleLength)) {
    return DEFAULT_SCALE_LENGTH;
  }
  return clamp(Math.trunc(scaleLength), 1, 12);
}

function resolveBarRange(
  rowLength: number,
  isKeys: boolean,
  barStart: number,
  barEnd: number,
): BarRange | null {
  const bars = isKeys ? rowLength : Math.floor(rowLength / STEPS_PER_BAR);
  if (bars <= 0) return null;
  if (!Number.isFinite(barStart) || !Number.isFinite(barEnd)) return null;

  let start = Math.trunc(barStart);
  let end = Math.trunc(barEnd);
  if (start > end) [start, end] = [end, start];
  if (end < 0 || start > bars - 1) return null;
  start = clamp(start, 0, bars - 1);
  end = clamp(end, 0, bars - 1);
  return { start, end, bars };
}

/**
 * Convenience export: how many bar-start hits a kick has (used by analysis
 * and by tests that check the kick anchor rule).
 */
export function kickDownbeatCount(steps: DrumSteps, bars: number): number {
  let count = 0;
  for (let bar = 0; bar < bars; bar++) {
    if ((steps[bar * STEPS_PER_BAR] ?? 0) > 0) count++;
  }
  return count;
}
