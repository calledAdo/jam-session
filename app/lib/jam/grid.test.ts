import { describe, expect, it } from "vitest";

import { activeStepRatio, patchPreviewRows, type TrackData } from "./grid";

describe("activeStepRatio", () => {
  it("returns the proportion of active numeric steps", () => {
    expect(activeStepRatio([0, 1, null, 2, "i"])).toBe(0.4);
  });

  it("returns zero for an empty track", () => {
    expect(activeStepRatio([])).toBe(0);
  });
});

describe("patchPreviewRows", () => {
  it("groups changed cells by track and zero-based bar", () => {
    const tracks: TrackData[] = [
      {
        kind: "kick",
        steps: Array.from({ length: 32 }, (_, index) => (index === 17 ? 1 : 0)),
      },
      { kind: "keys", steps: ["i", "VI"] },
    ];

    expect(
      patchPreviewRows(tracks, [
        { track: "kick", fromStep: 17, steps: [2, 1] },
        { track: "keys", fromStep: 1, steps: ["VII"] },
      ]),
    ).toEqual([
      {
        track: "kick",
        bar: 1,
        before: Array.from({ length: 16 }, (_, index) => (index === 1 ? 1 : 0)),
        after: Array.from({ length: 16 }, (_, index) =>
          index === 1 ? 2 : index === 2 ? 1 : 0,
        ),
        changed: [1, 2],
      },
      {
        track: "keys",
        bar: 1,
        before: ["VI"],
        after: ["VII"],
        changed: [0],
      },
    ]);
  });

  it("omits no-op and out-of-range patch cells", () => {
    const tracks: TrackData[] = [{ kind: "hat", steps: [0, 1] }];

    expect(
      patchPreviewRows(tracks, [
        { track: "hat", fromStep: 0, steps: [0, 2, 1] },
      ]),
    ).toEqual([
      {
        track: "hat",
        bar: 0,
        before: [0, 1],
        after: [0, 2],
        changed: [1],
      },
    ]);
  });
});
