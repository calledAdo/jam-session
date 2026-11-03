/**
 * Seed sessions: ready-to-play loops for new sessions and `daily-spark`.
 */

import { STEPS_PER_BAR, type Pattern } from "./types";

export type SeedStyle = "lofi" | "house" | "empty";

export const SEED_STYLES: readonly SeedStyle[] = ["lofi", "house", "empty"];

interface Hit {
  step: number;
  velocity: number;
}

interface SeedBar {
  kick: Hit[];
  snare: Hit[];
  hat: Hit[];
  bass: ReadonlyArray<readonly [number, number]>;
  chord: string;
}

const LOFI_BARS: SeedBar[] = [
  {
    kick: [
      { step: 0, velocity: 3 },
      { step: 7, velocity: 2 },
      { step: 10, velocity: 2 },
    ],
    snare: [
      { step: 4, velocity: 2 },
      { step: 12, velocity: 3 },
    ],
    hat: [
      { step: 0, velocity: 2 },
      { step: 2, velocity: 1 },
      { step: 4, velocity: 2 },
      { step: 6, velocity: 1 },
      { step: 8, velocity: 2 },
      { step: 10, velocity: 1 },
      { step: 12, velocity: 2 },
      { step: 14, velocity: 1 },
    ],
    bass: [
      [0, 1],
      [6, 3],
      [8, 1],
      [11, 5],
    ],
    chord: "i",
  },
  {
    kick: [
      { step: 0, velocity: 3 },
      { step: 7, velocity: 2 },
      { step: 10, velocity: 2 },
      { step: 14, velocity: 1 },
    ],
    snare: [
      { step: 4, velocity: 2 },
      { step: 12, velocity: 3 },
    ],
    hat: [
      { step: 0, velocity: 2 },
      { step: 2, velocity: 1 },
      { step: 4, velocity: 2 },
      { step: 6, velocity: 1 },
      { step: 8, velocity: 2 },
      { step: 10, velocity: 1 },
      { step: 12, velocity: 2 },
      { step: 15, velocity: 1 },
    ],
    bass: [
      [0, 1],
      [6, 3],
      [8, 5],
    ],
    chord: "VI",
  },
  {
    kick: [
      { step: 0, velocity: 3 },
      { step: 7, velocity: 2 },
      { step: 10, velocity: 2 },
    ],
    snare: [
      { step: 4, velocity: 2 },
      { step: 12, velocity: 3 },
    ],
    hat: [
      { step: 0, velocity: 2 },
      { step: 2, velocity: 1 },
      { step: 4, velocity: 2 },
      { step: 6, velocity: 1 },
      { step: 8, velocity: 2 },
      { step: 10, velocity: 1 },
      { step: 12, velocity: 2 },
      { step: 14, velocity: 1 },
    ],
    bass: [
      [0, 1],
      [6, 4],
      [8, 1],
      [11, 3],
    ],
    chord: "iv",
  },
  {
    kick: [
      { step: 0, velocity: 3 },
      { step: 7, velocity: 2 },
      { step: 10, velocity: 2 },
    ],
    snare: [
      { step: 4, velocity: 2 },
      { step: 12, velocity: 3 },
      { step: 15, velocity: 1 },
    ],
    hat: [
      { step: 0, velocity: 2 },
      { step: 2, velocity: 1 },
      { step: 4, velocity: 2 },
      { step: 6, velocity: 1 },
      { step: 8, velocity: 2 },
      { step: 10, velocity: 1 },
      { step: 12, velocity: 2 },
      { step: 14, velocity: 1 },
    ],
    bass: [
      [0, 5],
      [6, 4],
      [8, 5],
    ],
    chord: "v",
  },
];

const HOUSE_BARS: SeedBar[] = [
  {
    kick: [
      { step: 0, velocity: 3 },
      { step: 4, velocity: 3 },
      { step: 8, velocity: 3 },
      { step: 12, velocity: 3 },
    ],
    snare: [
      { step: 4, velocity: 2 },
      { step: 12, velocity: 2 },
    ],
    hat: [
      { step: 2, velocity: 2 },
      { step: 6, velocity: 2 },
      { step: 10, velocity: 2 },
      { step: 14, velocity: 3 },
    ],
    bass: [
      [2, 1],
      [6, 1],
      [10, 3],
      [14, 5],
    ],
    chord: "i",
  },
  {
    kick: [
      { step: 0, velocity: 3 },
      { step: 4, velocity: 3 },
      { step: 8, velocity: 3 },
      { step: 12, velocity: 3 },
    ],
    snare: [
      { step: 4, velocity: 2 },
      { step: 12, velocity: 2 },
    ],
    hat: [
      { step: 2, velocity: 2 },
      { step: 6, velocity: 2 },
      { step: 10, velocity: 2 },
      { step: 14, velocity: 3 },
    ],
    bass: [
      [2, 1],
      [6, 1],
      [10, 5],
      [14, 3],
    ],
    chord: "VI",
  },
  {
    kick: [
      { step: 0, velocity: 3 },
      { step: 4, velocity: 3 },
      { step: 8, velocity: 3 },
      { step: 12, velocity: 3 },
    ],
    snare: [
      { step: 4, velocity: 2 },
      { step: 12, velocity: 2 },
    ],
    hat: [
      { step: 2, velocity: 2 },
      { step: 6, velocity: 2 },
      { step: 10, velocity: 2 },
      { step: 14, velocity: 3 },
    ],
    bass: [
      [2, 1],
      [6, 3],
      [10, 1],
      [14, 3],
    ],
    chord: "III",
  },
  {
    kick: [
      { step: 0, velocity: 3 },
      { step: 4, velocity: 3 },
      { step: 8, velocity: 3 },
      { step: 12, velocity: 3 },
    ],
    snare: [
      { step: 4, velocity: 2 },
      { step: 12, velocity: 2 },
    ],
    hat: [
      { step: 2, velocity: 2 },
      { step: 6, velocity: 2 },
      { step: 10, velocity: 2 },
      { step: 14, velocity: 3 },
    ],
    bass: [
      [2, 1],
      [6, 1],
      [10, 5],
      [14, 3],
    ],
    chord: "VII",
  },
];

function normalizeSeedBars(bars: number): number {
  if (!Number.isFinite(bars)) return 4;
  return Math.max(1, Math.min(32, Math.trunc(bars)));
}

/**
 * Build a playable seed pattern.
 *
 * The loop is built from one-bar cells, repeated for `bars`; styles never
 * change between calls (deterministic).
 */
export function seedSession(style: SeedStyle, bars: number): Pattern {
  const barCount = normalizeSeedBars(bars);
  const source =
    style === "lofi" ? LOFI_BARS : style === "house" ? HOUSE_BARS : null;
  const steps = barCount * STEPS_PER_BAR;

  const pattern: Pattern = {
    kick: new Array<number>(steps).fill(0),
    snare: new Array<number>(steps).fill(0),
    hat: new Array<number>(steps).fill(0),
    bass: new Array<number | null>(steps).fill(null),
    keys: new Array<string>(barCount).fill(""),
  };

  if (!source) return pattern;

  for (let bar = 0; bar < barCount; bar++) {
    const cell = source[bar % source.length];
    if (!cell) continue;
    const base = bar * STEPS_PER_BAR;

    for (const hit of cell.kick) pattern.kick[base + hit.step] = hit.velocity;
    for (const hit of cell.snare) pattern.snare[base + hit.step] = hit.velocity;
    for (const hit of cell.hat) pattern.hat[base + hit.step] = hit.velocity;
    for (const [step, degree] of cell.bass) {
      pattern.bass[base + step] = degree;
    }
    pattern.keys[bar] = cell.chord;
  }

  return pattern;
}
