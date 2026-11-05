/**
 * Seed sessions: ready-to-play loops for new sessions and `daily-spark`.
 */

import { STEPS_PER_BAR, type Pattern } from "./types";

export const SEED_STYLES = [
  "lofi",
  "boombap",
  "trap",
  "house",
  "empty",
] as const;
export type SeedStyle = (typeof SEED_STYLES)[number];

export const SEED_DEFAULTS = {
  lofi: { bpm: 82, root: "C", scale: "minor", swing: 0.25, kit: "dusty" },
  boombap: { bpm: 90, root: "D", scale: "minor", swing: 0.3, kit: "boombap" },
  trap: { bpm: 140, root: "F", scale: "minor", swing: 0, kit: "808" },
  house: { bpm: 124, root: "A", scale: "minor", swing: 0, kit: "clean" },
  empty: { bpm: 90, root: "C", scale: "minor", swing: 0, kit: "clean" },
} as const;

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

// Two head-nod cells: kick-led bass and an i7–iv7 conversation.
const BOOMBAP_BARS: SeedBar[] = [
  {
    kick: [
      { step: 0, velocity: 3 },
      { step: 6, velocity: 3 },
      { step: 10, velocity: 2 },
    ],
    snare: [
      { step: 4, velocity: 3 },
      { step: 11, velocity: 1 },
      { step: 12, velocity: 3 },
    ],
    hat: Array.from({ length: 8 }, (_, i) => ({
      step: i * 2,
      velocity: i % 2 ? 1 : 2,
    })),
    bass: [
      [0, 1],
      [6, 1],
      [10, 5],
    ],
    chord: "i7",
  },
  {
    kick: [
      { step: 0, velocity: 3 },
      { step: 7, velocity: 2 },
      { step: 14, velocity: 3 },
    ],
    snare: [
      { step: 4, velocity: 3 },
      { step: 12, velocity: 3 },
      { step: 15, velocity: 1 },
    ],
    hat: [
      { step: 0, velocity: 2 },
      { step: 2, velocity: 1 },
      { step: 4, velocity: 2 },
      { step: 6, velocity: 1 },
      { step: 8, velocity: 3 },
      { step: 10, velocity: 1 },
      { step: 12, velocity: 2 },
      { step: 15, velocity: 1 },
    ],
    bass: [
      [0, 4],
      [7, 4],
      [14, 1],
    ],
    chord: "iv7",
  },
];

// Half-time backbeat; accents suggest rolls without leaving the 16th grid.
const TRAP_BARS: SeedBar[] = [
  {
    kick: [
      { step: 0, velocity: 3 },
      { step: 7, velocity: 2 },
    ],
    snare: [{ step: 8, velocity: 3 }],
    hat: Array.from({ length: 16 }, (_, i) => ({
      step: i,
      velocity: i >= 12 ? [3, 1, 2, 1][i % 4]! : i % 2 ? 1 : 2,
    })),
    bass: [
      [0, 1],
      [7, 1],
    ],
    chord: "i",
  },
  {
    kick: [
      { step: 0, velocity: 3 },
      { step: 6, velocity: 2 },
      { step: 14, velocity: 3 },
    ],
    snare: [{ step: 8, velocity: 3 }],
    hat: Array.from({ length: 16 }, (_, i) => ({
      step: i,
      velocity: i < 4 || i >= 14 ? [3, 1, 3, 1][i % 4]! : i % 2 ? 1 : 2,
    })),
    bass: [
      [0, 6],
      [6, 6],
      [14, 5],
    ],
    chord: "VI",
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
  const source = {
    lofi: LOFI_BARS,
    boombap: BOOMBAP_BARS,
    trap: TRAP_BARS,
    house: HOUSE_BARS,
    empty: null,
  }[style];
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
