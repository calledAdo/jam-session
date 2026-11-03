/**
 * Patch application / inversion and row helpers.
 *
 * Tracks are immutable here: `applyPatch` always returns a new `Pattern`.
 */

import {
  STEPS_PER_BAR,
  TRACK_KINDS,
  type Patch,
  type PatchStep,
  type Pattern,
  type TrackKind,
} from "./types";

/** Length (in steps) of a row for a session with `bars` bars. */
export function trackLength(kind: TrackKind, bars: number): number {
  const safeBars = Math.max(1, Math.trunc(bars));
  return kind === "keys" ? safeBars : safeBars * STEPS_PER_BAR;
}

export function clonePattern(tracks: Pattern): Pattern {
  return {
    kick: [...tracks.kick],
    snare: [...tracks.snare],
    hat: [...tracks.hat],
    bass: [...tracks.bass],
    keys: [...tracks.keys],
  };
}

/** All rows empty for a given number of bars. */
export function emptyPattern(bars: number): Pattern {
  const safeBars = Math.max(1, Math.trunc(bars));
  const steps = safeBars * STEPS_PER_BAR;
  return {
    kick: new Array<number>(steps).fill(0),
    snare: new Array<number>(steps).fill(0),
    hat: new Array<number>(steps).fill(0),
    bass: new Array<number | null>(steps).fill(null),
    keys: new Array<string>(safeBars).fill(""),
  };
}

function trackArray(tracks: Pattern, kind: TrackKind): PatchStep[] {
  return tracks[kind] as unknown as PatchStep[];
}

/** True when the value is a "hit" / held note / chord. */
export function isActiveStep(value: PatchStep | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return value > 0;
  return value.trim().length > 0;
}

/** Quarter-note positions (0, 4, 8, 12) are treated as the downbeats. */
export function isDownbeat(step: number): boolean {
  return step % 4 === 0;
}

/** Apply a patch to a copy of the tracks. Out-of-range entries are ignored. */
export function applyPatch(tracks: Pattern, patch: Patch): Pattern {
  const next = clonePattern(tracks);

  for (const entry of patch) {
    if (!isTrackKind(entry.track)) continue;
    const target = trackArray(next, entry.track);
    const from = normalizeFromStep(entry.fromStep);
    if (from === null) continue;
    for (let i = 0; i < entry.steps.length; i++) {
      const index = from + i;
      if (index < 0 || index >= target.length) continue;
      target[index] = entry.steps[i] as PatchStep;
    }
  }

  return next;
}

/**
 * Build the patch that undoes `patch`.
 *
 * Overlapping entries are handled by remembering the first original value for
 * each touched index, then returning one contiguous patch per run. Applying
 * the inverse after the original restores the exact input.
 */
export function invertPatch(tracks: Pattern, patch: Patch): Patch {
  const scratch = clonePattern(tracks);
  const originals = new Map<TrackKind, Map<number, PatchStep>>();

  for (const entry of patch) {
    if (!isTrackKind(entry.track)) continue;
    const target = trackArray(scratch, entry.track);
    const from = normalizeFromStep(entry.fromStep);
    if (from === null) continue;
    let perTrack = originals.get(entry.track);
    if (!perTrack) {
      perTrack = new Map<number, PatchStep>();
      originals.set(entry.track, perTrack);
    }
    for (let i = 0; i < entry.steps.length; i++) {
      const index = from + i;
      if (index < 0 || index >= target.length) continue;
      if (!perTrack.has(index)) {
        perTrack.set(index, target[index] as PatchStep);
      }
      target[index] = entry.steps[i] as PatchStep;
    }
  }

  const inverse: Patch = [];
  for (const [track, values] of originals) {
    const indices = [...values.keys()].sort((a, b) => a - b);
    let runStart: number | null = null;
    let runIndices: number[] = [];

    const flush = () => {
      if (runStart === null) return;
      inverse.push({
        track,
        fromStep: runStart,
        steps: runIndices.map((touched) => values.get(touched) as PatchStep),
      });
      runStart = null;
      runIndices = [];
    };

    for (const index of indices) {
      if (runStart === null) {
        runStart = index;
        runIndices = [index];
        continue;
      }
      const previous = runIndices[runIndices.length - 1] ?? -1;
      if (index === previous + 1) {
        runIndices.push(index);
      } else {
        flush();
        runStart = index;
        runIndices = [index];
      }
    }
    flush();
  }

  return inverse;
}

/**
 * Compare two rows and return a minimal patch of contiguous changed runs.
 * Useful for tests and for generators that mutate a working copy.
 */
export function diffSteps(
  track: TrackKind,
  before: readonly PatchStep[],
  after: readonly PatchStep[],
): Patch {
  const limit = Math.min(before.length, after.length);
  const patch: Patch = [];
  let runStart: number | null = null;

  const flush = (endExclusive: number) => {
    if (runStart === null) return;
    patch.push({
      track,
      fromStep: runStart,
      steps: after.slice(runStart, endExclusive) as PatchStep[],
    });
    runStart = null;
  };

  for (let index = 0; index < limit; index++) {
    const changed = before[index] !== after[index];
    if (changed && runStart === null) runStart = index;
    if (!changed && runStart !== null) flush(index);
  }
  flush(limit);

  return patch;
}

/** Number of cells a patch writes. */
export function patchCellCount(patch: Patch): number {
  return patch.reduce((total, entry) => total + entry.steps.length, 0);
}

function isTrackKind(value: string): value is TrackKind {
  return (TRACK_KINDS as readonly string[]).includes(value);
}

function normalizeFromStep(fromStep: number): number | null {
  if (!Number.isFinite(fromStep)) return null;
  const from = Math.trunc(fromStep);
  return from < 0 ? null : from;
}
