/** Pure grid helpers shared by the Jam Session UI and its audio engine. */

export const TRACK_ORDER = ["kick", "snare", "hat", "bass", "keys"] as const;
export type TrackKind = (typeof TRACK_ORDER)[number];
export type StepValue = number | string | null;

export type PatchEntry = {
  track: TrackKind;
  fromStep: number;
  steps: StepValue[];
};

export type TrackData = {
  id?: string;
  kind: TrackKind;
  steps: StepValue[];
  muted?: boolean;
};

export type SessionData = {
  session: {
    id: string;
    name: string;
    bpm: number;
    root: string;
    scale: string;
    swing: number;
    bars: number;
  };
  tracks: TrackData[];
  ideas: IdeaData[];
};

export type IdeaData = {
  id: string;
  sessionId: string;
  author: string;
  label: string;
  rationale: string;
  status: string;
  patch: PatchEntry[];
};

export const STEPS_PER_BAR = 16;
export const DRUM_KINDS: readonly TrackKind[] = ["kick", "snare", "hat"];
export const MAX_BASS_DEGREE = 10;

export function isDrum(kind: TrackKind): boolean {
  return DRUM_KINDS.includes(kind);
}

export function cellKey(kind: TrackKind, index: number): string {
  return `${kind}:${index}`;
}

/** Returns a copy of `tracks` with the patch written in (out-of-range cells are ignored). */
export function applyPatchToTracks(
  tracks: readonly TrackData[],
  patch: readonly PatchEntry[],
): TrackData[] {
  const next = tracks.map((track) => ({ ...track, steps: [...track.steps] }));
  for (const entry of patch) {
    const track = next.find((t) => t.kind === entry.track);
    if (!track) continue;
    entry.steps.forEach((value, offset) => {
      const index = entry.fromStep + offset;
      if (index >= 0 && index < track.steps.length) track.steps[index] = value;
    });
  }
  return next;
}

/** Cells whose value differs between two track sets, as `kind:index` keys. */
export function diffCells(
  prev: readonly TrackData[],
  next: readonly TrackData[],
): string[] {
  const changed: string[] = [];
  for (const track of next) {
    const before = prev.find((t) => t.kind === track.kind);
    if (!before) continue;
    track.steps.forEach((value, index) => {
      if ((before.steps[index] ?? null) !== (value ?? null)) {
        changed.push(cellKey(track.kind, index));
      }
    });
  }
  return changed;
}

/** Cells a patch would change relative to the given tracks (for audition ghosts). */
export function patchCells(
  tracks: readonly TrackData[],
  patch: readonly PatchEntry[],
): string[] {
  return diffCells(tracks, applyPatchToTracks(tracks, patch));
}

/** Shift-click on a lit drum cell cycles velocity 1 -> 2 -> 3 -> 1. */
export function cycleVelocity(current: number): number {
  if (current < 1) return 1;
  return current >= 3 ? 1 : current + 1;
}

export const DEFAULT_VELOCITY = 2;

export function toggleDrum(current: StepValue): number {
  return typeof current === "number" && current > 0 ? 0 : DEFAULT_VELOCITY;
}

export function toggleBass(current: StepValue): number | null {
  return typeof current === "number" && current > 0 ? null : 1;
}

/** Moves a bass degree by `delta`, clamped to 1..MAX_BASS_DEGREE. */
export function shiftBassDegree(current: StepValue, delta: number): number {
  const base = typeof current === "number" && current > 0 ? current : 1;
  return Math.min(MAX_BASS_DEGREE, Math.max(1, base + delta));
}

export type Selection = {
  tracks: TrackKind[];
  barStart: number;
  barEnd: number;
};

/** Builds an ordered, inclusive selection rectangle from two corner cells. */
export function selectionFromCorners(
  a: { row: number; bar: number },
  b: { row: number; bar: number },
): Selection {
  const rowStart = Math.min(a.row, b.row);
  const rowEnd = Math.max(a.row, b.row);
  return {
    tracks: TRACK_ORDER.slice(rowStart, rowEnd + 1),
    barStart: Math.min(a.bar, b.bar),
    barEnd: Math.max(a.bar, b.bar),
  };
}

/** Human description used for "Ask bandmate" messages (bars shown 1-based). */
export function describeSelection(selection: Selection): string {
  const bars =
    selection.barStart === selection.barEnd
      ? `bar ${selection.barStart + 1}`
      : `bars ${selection.barStart + 1}-${selection.barEnd + 1}`;
  return `${selection.tracks.join("+")} ${bars}`;
}

const NUMERALS: Record<string, string[]> = {
  major: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
  minor: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
  dorian: ["i", "ii", "III", "IV", "v", "vi°", "VII"],
  "pentatonic minor": ["i", "ii°", "III", "iv", "v", "VI", "VII"],
};

/** Numerals offered in the keys picker for a scale. */
export function numeralChoices(scale: string): string[] {
  return NUMERALS[scale] ?? NUMERALS.minor!;
}

// --- Layout math shared by the grid and playhead -----------------------------
export const CELL_W = 26;
export const CELL_PITCH = 28;
export const GROUP_PITCH = 4 * CELL_PITCH + 6;
export const BAR_PITCH = 4 * GROUP_PITCH + 10;

/** Left offset (px) of a step inside the grid body. */
export function stepX(step: number): number {
  const bar = Math.floor(step / STEPS_PER_BAR);
  const inBar = step % STEPS_PER_BAR;
  const group = Math.floor(inBar / 4);
  return bar * BAR_PITCH + group * GROUP_PITCH + (inBar % 4) * CELL_PITCH;
}
