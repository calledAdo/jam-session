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

export type PatchPreviewRow = {
  track: TrackKind;
  bar: number;
  before: StepValue[];
  after: StepValue[];
  changed: number[];
};

/** Groups the changed cells in a patch into small, bar-sized preview rows. */
export function patchPreviewRows(
  tracks: readonly TrackData[],
  patch: readonly PatchEntry[],
): PatchPreviewRow[] {
  const changedByRow = new Map<
    string,
    { track: TrackKind; bar: number; changed: number[] }
  >();
  const afterTracks = applyPatchToTracks(tracks, patch);
  for (const beforeTrack of tracks) {
    const afterTrack = afterTracks.find(
      (item) => item.kind === beforeTrack.kind,
    );
    if (!afterTrack) continue;
    beforeTrack.steps.forEach((before, index) => {
      const after = afterTrack.steps[index];
      if ((before ?? null) === (after ?? null)) return;
      const track = beforeTrack.kind;
      const bar = track === "keys" ? index : Math.floor(index / STEPS_PER_BAR);
      const start = track === "keys" ? bar : bar * STEPS_PER_BAR;
      const rowKey = `${track}:${bar}`;
      const row = changedByRow.get(rowKey) ?? { track, bar, changed: [] };
      row.changed.push(index - start);
      changedByRow.set(rowKey, row);
    });
  }

  return [...changedByRow.values()]
    .sort(
      (a, b) =>
        TRACK_ORDER.indexOf(a.track) - TRACK_ORDER.indexOf(b.track) ||
        a.bar - b.bar,
    )
    .flatMap(({ track, bar, changed }) => {
      const beforeTrack = tracks.find((item) => item.kind === track);
      const afterTrack = afterTracks.find((item) => item.kind === track);
      if (!beforeTrack || !afterTrack) return [];
      const start = track === "keys" ? bar : bar * STEPS_PER_BAR;
      const length = track === "keys" ? 1 : STEPS_PER_BAR;
      return [
        {
          track,
          bar,
          before: beforeTrack.steps.slice(start, start + length),
          after: afterTrack.steps.slice(start, start + length),
          changed,
        },
      ];
    });
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

/** Ratio of active numeric steps, used by the Hat Energy percent control. */
export function activeStepRatio(steps: readonly StepValue[]): number {
  if (steps.length === 0) return 0;
  const active = steps.filter(
    (value) => typeof value === "number" && value > 0,
  ).length;
  return active / steps.length;
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
export const CELL_W = 18;
export const CELL_PITCH = 20;
export const GROUP_PITCH = 4 * CELL_PITCH + 4;
export const BAR_PITCH = 4 * GROUP_PITCH + 12;
export const MIN_CELL_W = 9;
/** Below this width the spacing stops scaling and sits at its floor. */
const GAP_BASE_CELL_W = 12;

export type GridMetrics = {
  cellW: number;
  cellPitch: number;
  groupPitch: number;
  barPitch: number;
  stepGap: number;
  groupPadding: number;
  barGap: number;
  bodyWidth: number;
};

function metricsForCellWidth(cellW: number, bars: number): GridMetrics {
  const scale = Math.max(0, cellW - GAP_BASE_CELL_W);
  // Floors keep beats and bars visually grouped even at the smallest size.
  const stepGap = Math.max(1, scale / 3);
  const groupPadding = Math.max(3, scale);
  const barGap = Math.max(6, scale * 2);
  const cellPitch = cellW + stepGap;
  const groupPitch = 4 * cellW + 3 * stepGap + groupPadding;
  const barPitch = 4 * groupPitch + barGap;
  return {
    cellW,
    cellPitch,
    groupPitch,
    barPitch,
    stepGap,
    groupPadding,
    barGap,
    bodyWidth: bars * barPitch,
  };
}

/** Fits the grid to available width: the largest cell size whose loop fits. */
export function gridMetricsForWidth(
  availableWidth: number,
  bars: number,
): GridMetrics {
  if (bars <= 0) return metricsForCellWidth(MIN_CELL_W, 0);
  if (metricsForCellWidth(CELL_W, bars).bodyWidth <= availableWidth) {
    return metricsForCellWidth(CELL_W, bars);
  }
  let lo = MIN_CELL_W;
  let hi = CELL_W;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (metricsForCellWidth(mid, bars).bodyWidth <= availableWidth) lo = mid;
    else hi = mid;
  }
  return metricsForCellWidth(lo, bars);
}

const DEFAULT_GRID_METRICS = metricsForCellWidth(CELL_W, 1);

export function barLeft(bar: number, metrics = DEFAULT_GRID_METRICS): number {
  return bar * metrics.barPitch;
}

export function barWidth(metrics = DEFAULT_GRID_METRICS): number {
  return metrics.barPitch - metrics.barGap;
}

export function selectionBounds(
  barStart: number,
  barEnd: number,
  metrics = DEFAULT_GRID_METRICS,
): { left: number; width: number } {
  return {
    left: barLeft(barStart, metrics),
    width: (barEnd - barStart + 1) * metrics.barPitch - metrics.barGap,
  };
}

/** Left offset (px) of a step inside the grid body. */
export function stepX(step: number, metrics = DEFAULT_GRID_METRICS): number {
  const bar = Math.floor(step / STEPS_PER_BAR);
  const inBar = step % STEPS_PER_BAR;
  const group = Math.floor(inBar / 4);
  return (
    bar * metrics.barPitch +
    group * metrics.groupPitch +
    (inBar % 4) * metrics.cellPitch
  );
}
