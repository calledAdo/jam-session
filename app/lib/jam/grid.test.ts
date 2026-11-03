import { describe, expect, it } from "vitest";

import {
  applyPatchToTracks,
  BAR_PITCH,
  cycleVelocity,
  describeSelection,
  diffCells,
  patchCells,
  selectionFromCorners,
  shiftBassDegree,
  stepX,
  toggleBass,
  toggleDrum,
  type TrackData,
} from "./grid";

const tracks = (): TrackData[] => [
  { kind: "kick", steps: [1, 0, 0, 0] },
  { kind: "bass", steps: [null, 3, null, null] },
];

describe("grid helpers", () => {
  it("applies a patch without mutating the input", () => {
    const base = tracks();
    const next = applyPatchToTracks(base, [
      { track: "kick", fromStep: 2, steps: [3, 3, 3] },
    ]);
    expect(next[0]!.steps).toEqual([1, 0, 3, 3]);
    expect(base[0]!.steps).toEqual([1, 0, 0, 0]);
  });

  it("diffs and reports patch cells", () => {
    const base = tracks();
    const patch = [{ track: "bass" as const, fromStep: 0, steps: [2, 3] }];
    expect(patchCells(base, patch)).toEqual(["bass:0"]);
    expect(diffCells(base, applyPatchToTracks(base, patch))).toEqual(["bass:0"]);
  });

  it("cycles velocity and toggles", () => {
    expect([0, 1, 2, 3].map(cycleVelocity)).toEqual([1, 2, 3, 1]);
    expect(toggleDrum(0)).toBe(2);
    expect(toggleDrum(3)).toBe(0);
    expect(toggleBass(null)).toBe(1);
    expect(toggleBass(4)).toBeNull();
  });

  it("clamps bass degrees", () => {
    expect(shiftBassDegree(1, -1)).toBe(1);
    expect(shiftBassDegree(10, 1)).toBe(10);
    expect(shiftBassDegree(3, 2)).toBe(5);
  });

  it("orders selection corners and labels bars 1-based", () => {
    const sel = selectionFromCorners({ row: 3, bar: 3 }, { row: 2, bar: 2 });
    expect(sel).toEqual({ tracks: ["hat", "bass"], barStart: 2, barEnd: 3 });
    expect(describeSelection(sel)).toBe("hat+bass bars 3-4");
  });

  it("computes step x offsets", () => {
    expect(stepX(0)).toBe(0);
    expect(stepX(16)).toBe(BAR_PITCH);
    expect(stepX(5)).toBeGreaterThan(stepX(4));
  });
});
