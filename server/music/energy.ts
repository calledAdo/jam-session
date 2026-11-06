/**
 * Energy knob for drum rows.
 *
 * `setEnergy` rewrites a drum row so its density tracks a single 0–1 control:
 *
 * - `0`   → only the quarter-note beats (offsets 0, 4, 8, 12) play.
 * - `1/3` → the eighth notes join in.
 * - `2/3` → every 16th plays.
 * - `1`   → every 16th, with the beats accented.
 *
 * The function is pure: it never mutates `steps`, only the first `bars` bars
 * are touched, and the caller gets a fresh array back. Velocities are fixed by
 * position so the result is deterministic (beats = 3, eighth off-beats = 2,
 * sixteenth off-beats = 1).
 */

import { degreeToNote, noteToMidi, romanToChord, scaleNotes } from "./notes";
import { clamp } from "./random";
import {
  STEPS_PER_BAR,
  type BassSteps,
  type DrumSteps,
  type KeysSteps,
} from "./types";

/** Level at which eighth notes start playing. */
export const ENERGY_EIGHTH_THRESHOLD = 1 / 3;

/** Level at which every 16th starts playing. */
export const ENERGY_SIXTEENTH_THRESHOLD = 2 / 3;

const BEAT_VELOCITY = 3;
const OFFBEAT_EIGHTH_VELOCITY = 2;
const OFFBEAT_SIXTEENTH_VELOCITY = 1;

/**
 * Rewrite the first `bars` bars of a drum row for an energy level from 0 to 1.
 * Values outside 0..1 clamp; invalid levels read as 0 and invalid bar counts as
 * "touch nothing". Cells after the requested bars are left untouched.
 */
export function setEnergy(
  steps: DrumSteps,
  level: number,
  bars: number,
): DrumSteps {
  const next = steps.slice();
  const safeLevel = Number.isFinite(level) ? clamp(level, 0, 1) : 0;
  const requestedBars = Number.isFinite(bars) ? Math.trunc(bars) : 0;
  const barCount = Math.min(
    Math.max(0, requestedBars),
    Math.floor(steps.length / STEPS_PER_BAR),
  );

  if (barCount === 0) return next;

  const limit = barCount * STEPS_PER_BAR;
  for (let index = 0; index < limit; index++) {
    const offset = index % STEPS_PER_BAR;
    const onBeat = offset % 4 === 0;
    const onEighth = offset % 2 === 0;

    const active =
      onBeat ||
      (onEighth && safeLevel >= ENERGY_EIGHTH_THRESHOLD) ||
      safeLevel >= ENERGY_SIXTEENTH_THRESHOLD;

    if (!active) {
      next[index] = 0;
    } else if (onBeat) {
      next[index] = BEAT_VELOCITY;
    } else if (onEighth) {
      next[index] = OFFBEAT_EIGHTH_VELOCITY;
    } else {
      next[index] = OFFBEAT_SIXTEENTH_VELOCITY;
    }
  }

  return next;
}

/** How many cells per bar play at a given energy level (4, 8, or 16). */
export function energyHitsPerBar(level: number): number {
  const safeLevel = Number.isFinite(level) ? clamp(level, 0, 1) : 0;
  if (safeLevel >= ENERGY_SIXTEENTH_THRESHOLD) return STEPS_PER_BAR;
  if (safeLevel >= ENERGY_EIGHTH_THRESHOLD) return STEPS_PER_BAR / 2;
  return STEPS_PER_BAR / 4;
}

/**
 * Bass energy: below 1/3, chord roots on bar downbeats; from 1/3, roots
 * follow the kick (keeping the bar anchor); from 2/3, add eighths with octave
 * and fifth movement; from 5/6, add sixteenths. Keys have one chord per bar.
 * Missing/invalid chords use the tonic. Chromatic or pentatonic chord roots
 * and fifths use the nearest available scale tone, so every stored degree is
 * playable in the session key. Inputs and cells after `bars` stay untouched.
 */
export function setBassEnergy(
  steps: BassSteps,
  level: number,
  bars: number,
  harmony: { kick: DrumSteps; keys: KeysSteps; root: string; scale: string },
): BassSteps {
  const next = steps.slice();
  const safeLevel = Number.isFinite(level) ? clamp(level, 0, 1) : 0;
  const barCount = Math.min(
    Math.max(0, Number.isFinite(bars) ? Math.trunc(bars) : 0),
    Math.floor(steps.length / STEPS_PER_BAR),
  );
  if (barCount === 0) return next;

  const notes = scaleNotes(harmony.root, harmony.scale, 2).map(noteToMidi);
  for (let bar = 0; bar < barCount; bar++) {
    let rootDegree = 1;
    const numeral = harmony.keys[bar]?.trim();
    if (numeral) {
      // Stored chord labels can be invalid; an unusable chord means tonic.
      let chordRoot: string | undefined;
      try {
        chordRoot = romanToChord(harmony.root, harmony.scale, numeral, 2)[0];
      } catch {
        chordRoot = undefined;
      }
      if (chordRoot) {
        const pitch = noteToMidi(chordRoot);
        const distances = notes.map((note) => {
          const distance = (((note - pitch) % 12) + 12) % 12;
          return Math.min(distance, 12 - distance);
        });
        rootDegree = distances.indexOf(Math.min(...distances)) + 1;
      }
    }

    const rootMidi = notes[rootDegree - 1]!;
    const candidates = Array.from(
      { length: notes.length + 1 },
      (_, i) => rootDegree + i,
    );
    const fifthDegree = candidates.reduce((best, degree) => {
      const distance = (value: number) =>
        Math.abs(
          noteToMidi(degreeToNote(harmony.root, harmony.scale, value, 2)) -
            (rootMidi + 7),
        );
      return distance(degree) < distance(best) ? degree : best;
    });

    for (let offset = 0; offset < STEPS_PER_BAR; offset++) {
      const index = bar * STEPS_PER_BAR + offset;
      const active =
        offset === 0 ||
        (safeLevel >= ENERGY_EIGHTH_THRESHOLD &&
          (harmony.kick[index] ?? 0) > 0) ||
        (safeLevel >= ENERGY_SIXTEENTH_THRESHOLD && offset % 2 === 0) ||
        safeLevel >= 5 / 6;
      if (!active) next[index] = null;
      else if (safeLevel < ENERGY_SIXTEENTH_THRESHOLD || offset % 4 === 0)
        next[index] = rootDegree;
      else
        next[index] =
          offset % 8 === 2 ? rootDegree + notes.length : fifthDegree;
    }
  }
  return next;
}
