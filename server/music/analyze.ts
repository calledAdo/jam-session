/**
 * Groove analysis: compact numbers + short human hints for the agent's
 * "Unstick me" reasoning. Pure and deterministic.
 */

import { romanToDegree } from "./notes";
import { round2 } from "./random";
import {
  STEPS_PER_BAR,
  TRACK_KINDS,
  type Pattern,
  type TrackKind,
} from "./types";

export interface GrooveAnalysis {
  /** Active cells per bar for each row (keys counts one chord per bar). */
  density: Record<TrackKind, number>;
  /** Share of drum + bass hits that land on a quarter-note downbeat. */
  downbeatRatio: number;
  /** Rows with no content in the analysed range. */
  emptyRows: TrackKind[];
  /** 1 = every bar identical, 0 = every bar different. */
  repetitionScore: number;
  /** True when bass and keys sit in the same register (no separation). */
  registerGap: boolean;
  /** Short producer-language hints. */
  notes: string[];
}

const ROW_LABELS: Record<TrackKind, string> = {
  kick: "kick",
  snare: "snare",
  hat: "hats",
  bass: "bass",
  keys: "keys",
};

/** Analyse the first `bars` bars of a pattern. */
export function analyzeGroove(tracks: Pattern, bars: number): GrooveAnalysis {
  const barCount = normalizeBarCount(bars, tracks);
  const density = {} as Record<TrackKind, number>;
  const emptyRows: TrackKind[] = [];
  const tracksWithContent: TrackKind[] = [];

  for (const kind of TRACK_KINDS) {
    const limit = rowLimit(kind, barCount, tracks);
    const values = tracks[kind] as ReadonlyArray<number | string | null>;
    let active = 0;
    for (let index = 0; index < limit; index++) {
      if (isActive(values[index])) active++;
    }
    density[kind] = round2(active / barCount);
    if (active === 0) emptyRows.push(kind);
    else tracksWithContent.push(kind);
  }

  let hits = 0;
  let downbeatHits = 0;
  for (const kind of ["kick", "snare", "hat", "bass"] as const) {
    const limit = rowLimit(kind, barCount, tracks);
    const values = tracks[kind] as ReadonlyArray<number | string | null>;
    for (let index = 0; index < limit; index++) {
      if (!isActive(values[index])) continue;
      hits++;
      if (index % 4 === 0) downbeatHits++;
    }
  }
  const downbeatRatio = hits === 0 ? 0 : round2(downbeatHits / hits);

  const repetitionScore = scoreRepetition(tracks, barCount, tracksWithContent);
  const registerGap = hasRegisterGap(tracks, barCount);
  const notes = buildNotes({
    tracks,
    barCount,
    density,
    downbeatRatio,
    emptyRows,
    repetitionScore,
    registerGap,
    hits,
    tracksWithContent,
  });

  return {
    density,
    downbeatRatio,
    emptyRows,
    repetitionScore,
    registerGap,
    notes,
  };
}

interface NoteContext {
  tracks: Pattern;
  barCount: number;
  density: Record<TrackKind, number>;
  downbeatRatio: number;
  emptyRows: TrackKind[];
  repetitionScore: number;
  registerGap: boolean;
  hits: number;
  tracksWithContent: TrackKind[];
}

function buildNotes(context: NoteContext): string[] {
  const notes: string[] = [];
  const {
    tracks,
    barCount,
    density,
    downbeatRatio,
    emptyRows,
    repetitionScore,
    registerGap,
    hits,
    tracksWithContent,
  } = context;

  if (hits === 0 && density.keys === 0) {
    return ["the grid is empty — start with a kick and a chord"];
  }

  if (coversEveryBarStart(tracks.kick, barCount)) {
    notes.push("kick lands on every downbeat");
  }

  const firstFourIdentical = barsIdentical(tracks, tracksWithContent, 4);
  if (barCount >= 4 && firstFourIdentical) {
    notes.push("bars 1–4 identical");
  } else if (barCount >= 4 && repetitionScore >= 0.8) {
    notes.push("lots of repetition — a fill would open it up");
  } else if (barCount >= 2 && repetitionScore <= 0.1) {
    notes.push("every bar is different — anchor it with a repeated kick");
  }

  if (registerGap) {
    notes.push("bass and keys share a register — spread them out");
  }

  for (const kind of emptyRows) {
    const label = ROW_LABELS[kind];
    notes.push(
      kind === "bass" ? "no low end — add bass notes" : `no ${label} yet`,
    );
  }

  if (density.hat >= 8) {
    notes.push("hats are busy — leave some space");
  } else if (density.hat > 0 && density.hat <= 2) {
    notes.push("hats are sparse — try pushing them into 8ths");
  }

  if (density.bass > 0 && density.bass <= 1) {
    notes.push("bass is sparse — a couple more notes would glue it");
  }

  if (hits > 0 && downbeatRatio >= 0.75) {
    notes.push("very on-the-grid — push some hits off the beat");
  } else if (hits > 0 && downbeatRatio <= 0.25) {
    notes.push("almost nothing lands on the beat");
  }

  if (notes.length === 0) notes.push("groove looks balanced");
  return notes;
}

function scoreRepetition(
  tracks: Pattern,
  bars: number,
  tracksWithContent: readonly TrackKind[],
): number {
  if (bars <= 1 || tracksWithContent.length === 0) return bars <= 1 ? 1 : 0;

  let total = 0;
  for (const kind of tracksWithContent) {
    const signatures = barSignatures(tracks, kind, bars);
    const unique = new Set(signatures).size;
    total += 1 - (unique - 1) / (bars - 1);
  }
  return round2(total / tracksWithContent.length);
}

function hasRegisterGap(tracks: Pattern, bars: number): boolean {
  const bassLimit = rowLimit("bass", bars, tracks);
  const keysLimit = rowLimit("keys", bars, tracks);

  const bassDegrees: number[] = [];
  for (let index = 0; index < bassLimit; index++) {
    const degree = tracks.bass[index];
    if (typeof degree === "number") bassDegrees.push(degree);
  }
  const keysDegrees: number[] = [];
  for (let index = 0; index < keysLimit; index++) {
    const chord = tracks.keys[index];
    if (typeof chord !== "string" || chord.length === 0) continue;
    const degree = romanToDegree(chord);
    if (degree !== null) keysDegrees.push(degree);
  }

  if (bassDegrees.length === 0 || keysDegrees.length === 0) return false;
  const bassAverage = average(bassDegrees);
  const keysAverage = average(keysDegrees);
  return keysAverage - bassAverage < 1;
}

function barsIdentical(
  tracks: Pattern,
  kinds: readonly TrackKind[],
  count: number,
): boolean {
  if (kinds.length === 0) return false;
  for (const kind of kinds) {
    const signatures = barSignatures(tracks, kind, Math.max(count, 1));
    if (signatures.length < count) return false;
    const first = signatures[0];
    for (let bar = 1; bar < count; bar++) {
      if (signatures[bar] !== first) return false;
    }
  }
  return true;
}

function barSignatures(
  tracks: Pattern,
  kind: TrackKind,
  bars: number,
): string[] {
  const signatures: string[] = [];
  const values = tracks[kind] as ReadonlyArray<number | string | null>;
  for (let bar = 0; bar < bars; bar++) {
    if (kind === "keys") {
      signatures.push(String(values[bar] ?? ""));
    } else {
      const start = bar * STEPS_PER_BAR;
      signatures.push(values.slice(start, start + STEPS_PER_BAR).join(","));
    }
  }
  return signatures;
}

function coversEveryBarStart(steps: readonly number[], bars: number): boolean {
  if (bars <= 0) return false;
  let active = 0;
  for (let bar = 0; bar < bars; bar++) {
    if ((steps[bar * STEPS_PER_BAR] ?? 0) > 0) active++;
  }
  return active === bars;
}

function rowLimit(kind: TrackKind, bars: number, tracks: Pattern): number {
  const length = (tracks[kind] as readonly unknown[]).length;
  const wanted = kind === "keys" ? bars : bars * STEPS_PER_BAR;
  return Math.min(length, wanted);
}

function normalizeBarCount(bars: number, tracks: Pattern): number {
  if (Number.isFinite(bars) && bars >= 1) return Math.max(1, Math.trunc(bars));
  const keysLength = tracks.keys.length;
  return Math.max(1, keysLength);
}

function isActive(value: number | string | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return value > 0;
  return value.trim().length > 0;
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
