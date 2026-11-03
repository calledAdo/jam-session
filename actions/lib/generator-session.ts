/**
 * Shared plumbing for actions that wrap the pure `server/music` generators.
 *
 * Reads come from `server/sessions/store.ts`; nothing here writes. Keeping the
 * step-array casts in one place makes the action bodies read like the DESIGN
 * table instead of a pile of `as unknown as`.
 */

import {
  applyPatch,
  emptyPattern,
  scaleLength,
  type BassSteps,
  type DrumSteps,
  type KeysSteps,
  type Patch,
  type Pattern,
  type StepsFor,
  type TrackKind,
} from "../../server/music/index.js";
import {
  getSession,
  type SessionDetail,
} from "../../server/sessions/store.js";
import type { StepValue } from "../../server/sessions/types.js";

export type SessionPattern = {
  detail: SessionDetail;
  pattern: Pattern;
  bars: number;
};

/** Load a session and shape its rows as the pure music library's `Pattern`. */
export async function loadSessionPattern(
  sessionId: string,
): Promise<SessionPattern> {
  const detail = await getSession(sessionId);
  const row = (kind: TrackKind): StepValue[] => {
    const track = detail.tracks.find((candidate) => candidate.kind === kind);
    if (!track) {
      throw new Error(`Session ${sessionId} is missing its ${kind} row.`);
    }
    return track.steps.slice();
  };

  const pattern: Pattern = {
    kick: row("kick") as unknown as DrumSteps,
    snare: row("snare") as unknown as DrumSteps,
    hat: row("hat") as unknown as DrumSteps,
    bass: row("bass") as unknown as BassSteps,
    keys: row("keys") as unknown as KeysSteps,
  };

  return {
    detail,
    pattern,
    bars: Math.max(1, Math.trunc(detail.session.bars)),
  };
}

/** The row cast the generic generators ask for. */
export function stepsFor(
  pattern: Pattern,
  track: TrackKind,
): StepsFor<TrackKind> {
  return pattern[track] as unknown as StepsFor<TrackKind>;
}

/** Scale degrees available for bass generators (5 for pentatonic, else 7). */
export function scaleLengthFor(scale: string): number {
  try {
    return scaleLength(scale);
  } catch {
    return 7;
  }
}

/**
 * Apply a single-track patch to a copy of that row. Used to compose generators
 * (for example: transform, then vary the transformed row) before diffing back
 * against the original steps.
 */
export function applyPatchToRow(
  track: TrackKind,
  steps: readonly StepValue[],
  patch: Patch,
  bars: number,
): StepValue[] {
  const base = emptyPattern(bars);
  const rows = base as unknown as Record<TrackKind, StepValue[]>;
  rows[track] = steps.slice();

  const applied = applyPatch(base, patch) as unknown as Record<
    TrackKind,
    StepValue[]
  >;
  return applied[track]!.slice();
}

/**
 * Normalize an inclusive, 0-based bar range against a session's bar count.
 * Reversed ranges swap; ranges that do not overlap the session throw.
 */
export function resolveBarRange(
  barStart: number,
  barEnd: number,
  bars: number,
): { barStart: number; barEnd: number } {
  if (!Number.isFinite(barStart) || !Number.isFinite(barEnd)) {
    throw new Error("barStart and barEnd must be numbers.");
  }

  let start = Math.trunc(barStart);
  let end = Math.trunc(barEnd);
  if (start > end) [start, end] = [end, start];

  const lastBar = Math.max(0, bars - 1);
  if (end < 0 || start > lastBar) {
    throw new Error(
      `Bars ${start + 1}–${end + 1} are outside this ${bars}-bar session.`,
    );
  }

  return {
    barStart: Math.max(0, start),
    barEnd: Math.min(lastBar, end),
  };
}
