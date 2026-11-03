import { describe, expect, it } from "vitest";

import {
  applyPatch,
  diffSteps,
  emptyPattern,
  invertPatch,
  isActiveStep,
  isDownbeat,
  patchCellCount,
  trackLength,
} from "./patch";
import type { Pattern } from "./types";

function pattern(): Pattern {
  return {
    kick: [3, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0],
    hat: [2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0],
    bass: [
      1,
      null,
      3,
      null,
      null,
      null,
      5,
      null,
      1,
      null,
      null,
      4,
      null,
      null,
      2,
      null,
    ],
    keys: ["i", "VI"],
  };
}

describe("trackLength / emptyPattern", () => {
  it("uses bars*16 for rhythmic rows and bars for keys", () => {
    expect(trackLength("kick", 2)).toBe(32);
    expect(trackLength("bass", 4)).toBe(64);
    expect(trackLength("keys", 4)).toBe(4);
  });

  it("builds silent rows", () => {
    const empty = emptyPattern(2);
    expect(empty.kick).toHaveLength(32);
    expect(empty.bass.every((value) => value === null)).toBe(true);
    expect(empty.keys).toEqual(["", ""]);
  });
});

describe("applyPatch", () => {
  it("writes row slices without mutating the input", () => {
    const before = pattern();
    const next = applyPatch(before, [
      { track: "kick", fromStep: 1, steps: [1, 2] },
      { track: "keys", fromStep: 0, steps: ["iv"] },
    ]);

    expect(next.kick.slice(0, 4)).toEqual([3, 1, 2, 0]);
    expect(next.keys).toEqual(["iv", "VI"]);
    expect(before.kick.slice(0, 4)).toEqual([3, 0, 0, 0]);
    expect(before.keys).toEqual(["i", "VI"]);
  });

  it("ignores cells outside the row", () => {
    const before = pattern();
    const next = applyPatch(before, [
      { track: "keys", fromStep: 1, steps: ["IV", "V"] },
      { track: "kick", fromStep: 15, steps: [1, 1, 1] },
    ]);
    expect(next.keys).toEqual(["i", "IV"]);
    expect(next.kick[15]).toBe(1);
    expect(next.kick).toHaveLength(16);
  });

  it("ignores negative and non-finite start positions", () => {
    const before = pattern();
    const next = applyPatch(before, [
      { track: "kick", fromStep: -2, steps: [1, 1] },
      { track: "kick", fromStep: Number.NaN, steps: [1] },
    ]);
    expect(next).toEqual(before);
  });
});

describe("invertPatch", () => {
  it("round-trips drum patches", () => {
    const before = pattern();
    const patch = [
      { track: "kick" as const, fromStep: 4, steps: [0, 1, 0, 2] },
    ];
    const applied = applyPatch(before, patch);
    const restored = applyPatch(applied, invertPatch(before, patch));
    expect(restored).toEqual(before);
  });

  it("round-trips bass patches containing nulls", () => {
    const before = pattern();
    const patch = [
      {
        track: "bass" as const,
        fromStep: 4,
        steps: [null, 2, 7, null],
      },
    ];
    const applied = applyPatch(before, patch);
    expect(applied.bass.slice(4, 8)).toEqual([null, 2, 7, null]);
    expect(applyPatch(applied, invertPatch(before, patch))).toEqual(before);
  });

  it("round-trips keys patches", () => {
    const before = pattern();
    const patch = [
      { track: "keys" as const, fromStep: 0, steps: ["i", "VII"] },
    ];
    const applied = applyPatch(before, patch);
    expect(applyPatch(applied, invertPatch(before, patch))).toEqual(before);
  });

  it("round-trips overlapping entries", () => {
    const before = pattern();
    const patch = [
      { track: "hat" as const, fromStep: 0, steps: [3, 3, 3, 3] },
      { track: "hat" as const, fromStep: 2, steps: [1, 1] },
    ];
    const applied = applyPatch(before, patch);
    expect(applied.hat.slice(0, 4)).toEqual([3, 3, 1, 1]);
    expect(applyPatch(applied, invertPatch(before, patch))).toEqual(before);
  });

  it("returns an empty patch when nothing in bounds was touched", () => {
    const before = pattern();
    expect(
      invertPatch(before, [{ track: "kick", fromStep: 99, steps: [1] }]),
    ).toEqual([]);
  });
});

describe("diffSteps", () => {
  it("reports contiguous changed runs only", () => {
    expect(diffSteps("kick", [0, 0, 0, 0], [1, 1, 0, 2])).toEqual([
      { track: "kick", fromStep: 0, steps: [1, 1] },
      { track: "kick", fromStep: 3, steps: [2] },
    ]);
  });

  it("returns no entries for identical rows", () => {
    expect(diffSteps("hat", [1, 2, 3], [1, 2, 3])).toEqual([]);
  });
});

describe("small predicates", () => {
  it("identifies active cells", () => {
    expect(isActiveStep(0)).toBe(false);
    expect(isActiveStep(2)).toBe(true);
    expect(isActiveStep(null)).toBe(false);
    expect(isActiveStep("")).toBe(false);
    expect(isActiveStep("IV")).toBe(true);
  });

  it("treats quarter notes as downbeats", () => {
    expect(isDownbeat(0)).toBe(true);
    expect(isDownbeat(4)).toBe(true);
    expect(isDownbeat(2)).toBe(false);
  });

  it("counts patched cells", () => {
    expect(
      patchCellCount([
        { track: "kick", fromStep: 0, steps: [1, 1] },
        { track: "hat", fromStep: 4, steps: [1] },
      ]),
    ).toBe(3);
  });
});
