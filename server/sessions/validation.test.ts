import { describe, expect, it } from "vitest";

import {
  assertProgressionInput,
  normalizePatch,
  normalizeStepValue,
} from "./validation.js";

describe("normalizeStepValue", () => {
  it("accepts drum velocities 0-3 only", () => {
    expect(normalizeStepValue("kick", 0, "kick 1")).toBe(0);
    expect(normalizeStepValue("snare", 3, "snare 1")).toBe(3);
    expect(() => normalizeStepValue("hat", 4, "hat 1")).toThrow(/velocities/);
    expect(() => normalizeStepValue("hat", 1.5, "hat 1")).toThrow(
      /velocities/,
    );
    expect(() => normalizeStepValue("hat", null, "hat 1")).toThrow(
      /velocities/,
    );
  });

  it("accepts bass scale degrees and null rests", () => {
    expect(normalizeStepValue("bass", 0, "bass 1")).toBe(0);
    expect(normalizeStepValue("bass", -3, "bass 1")).toBe(-3);
    expect(normalizeStepValue("bass", null, "bass 1")).toBeNull();
    expect(() => normalizeStepValue("bass", "1", "bass 1")).toThrow(
      /scale-degree/,
    );
  });

  it("normalizes keys chords and treats null as no chord", () => {
    expect(normalizeStepValue("keys", " iv ", "keys 1")).toBe("iv");
    expect(normalizeStepValue("keys", null, "keys 1")).toBe("");
    expect(() => normalizeStepValue("keys", 3, "keys 1")).toThrow(
      /roman-numeral/,
    );
  });
});

describe("normalizePatch", () => {
  it("returns normalized entries", () => {
    expect(
      normalizePatch(
        [{ track: "keys", fromStep: 1, steps: [null, " VI "] }],
        4,
      ),
    ).toEqual([{ track: "keys", fromStep: 1, steps: ["", "VI"] }]);
  });

  it("rejects unknown tracks, empty patches, and out-of-bounds runs", () => {
    expect(() => normalizePatch([], 4)).toThrow(/at least one/);
    expect(() =>
      normalizePatch([{ track: "piano", fromStep: 0, steps: [1] }], 4),
    ).toThrow(/unknown track/);
    expect(() =>
      normalizePatch(
        [{ track: "kick", fromStep: 63, steps: [1, 1] }],
        4,
      ),
    ).toThrow(/past the end/);
  });
});

describe("assertProgressionInput", () => {
  it("requires parallel, unique, in-range bars", () => {
    expect(() => assertProgressionInput([0, 1], ["i", "VI"], 4)).not.toThrow();
    expect(() => assertProgressionInput([0], ["i", "VI"], 4)).toThrow(
      /same length/,
    );
    expect(() => assertProgressionInput([4], ["i"], 4)).toThrow(/out of range/);
    expect(() => assertProgressionInput([1, 1], ["i", "VI"], 4)).toThrow(
      /more than once/,
    );
  });
});
