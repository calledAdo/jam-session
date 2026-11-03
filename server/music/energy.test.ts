import { describe, expect, it } from "vitest";

import {
  ENERGY_EIGHTH_THRESHOLD,
  ENERGY_SIXTEENTH_THRESHOLD,
  energyHitsPerBar,
  setEnergy,
} from "./energy";
import type { DrumSteps } from "./types";

const BARS = 2;

function blank(bars = BARS): DrumSteps {
  return new Array<number>(bars * 16).fill(0);
}

function activeOffsets(steps: DrumSteps): number[] {
  const offsets: number[] = [];
  for (let index = 0; index < steps.length; index++) {
    if ((steps[index] ?? 0) > 0) offsets.push(index % 16);
  }
  return offsets;
}

function hitsPerBar(steps: DrumSteps): number[] {
  const counts: number[] = [];
  for (let bar = 0; bar < steps.length / 16; bar++) {
    let count = 0;
    for (let offset = 0; offset < 16; offset++) {
      if ((steps[bar * 16 + offset] ?? 0) > 0) count++;
    }
    counts.push(count);
  }
  return counts;
}

describe("setEnergy", () => {
  it("level 0 leaves only the quarter-note downbeats", () => {
    const result = setEnergy(new Array<number>(BARS * 16).fill(2), 0, BARS);
    expect(activeOffsets(result)).toEqual([0, 4, 8, 12, 0, 4, 8, 12]);
    expect(result[0]).toBe(3);
    for (const offset of [1, 2, 3, 5, 6, 7]) {
      expect(result[offset]).toBe(0);
    }
  });

  it("level 1 fills every 16th with accents on the beats", () => {
    const result = setEnergy(blank(), 1, BARS);
    expect(hitsPerBar(result)).toEqual([16, 16]);
    expect(result.slice(0, 16)).toEqual([
      3, 1, 2, 1, 3, 1, 2, 1, 3, 1, 2, 1, 3, 1, 2, 1,
    ]);
    expect(result.every((velocity) => velocity > 0)).toBe(true);
  });

  it("adds eighth notes at the eighth threshold", () => {
    const result = setEnergy(blank(), ENERGY_EIGHTH_THRESHOLD, BARS);
    expect(hitsPerBar(result)).toEqual([8, 8]);
    expect(activeOffsets(result)).toEqual([
      0, 2, 4, 6, 8, 10, 12, 14, 0, 2, 4, 6, 8, 10, 12, 14,
    ]);
    expect(result[2]).toBe(2);
    expect(result[1]).toBe(0);
  });

  it("turns on every 16th at the sixteenth threshold", () => {
    const result = setEnergy(blank(), ENERGY_SIXTEENTH_THRESHOLD, BARS);
    expect(hitsPerBar(result)).toEqual([16, 16]);
    expect(result[1]).toBe(1);
  });

  it("is deterministic and never mutates its input", () => {
    const input = blank();
    input[3] = 2;
    const snapshot = input.slice();
    const first = setEnergy(input, 0.5, BARS);
    const second = setEnergy(input, 0.5, BARS);

    expect(input).toEqual(snapshot);
    expect(first).toEqual(second);
    expect(first).not.toBe(input);
  });

  it("clamps out-of-range levels", () => {
    expect(setEnergy(blank(), -4, BARS)).toEqual(setEnergy(blank(), 0, BARS));
    expect(setEnergy(blank(), 9, BARS)).toEqual(setEnergy(blank(), 1, BARS));
    expect(setEnergy(blank(), Number.NaN, BARS)).toEqual(
      setEnergy(blank(), 0, BARS),
    );
  });

  it("only touches the requested bars and leaves the tail alone", () => {
    const input = new Array<number>(4 * 16).fill(2);
    const result = setEnergy(input, 0, 1);
    expect(hitsPerBar(result)).toEqual([4, 16, 16, 16]);
    expect(result.slice(16)).toEqual(input.slice(16));
  });

  it("returns a copy when there are no bars to touch", () => {
    const input = new Array<number>(16).fill(2);
    const result = setEnergy(input, 1, 0);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
    expect(setEnergy(input, 1, Number.NaN)).toEqual(input);
  });

  it("increases density monotonically with the level", () => {
    const low = hitsPerBar(setEnergy(blank(), 0, BARS))[0] ?? 0;
    const middle = hitsPerBar(
      setEnergy(blank(), ENERGY_EIGHTH_THRESHOLD, BARS),
    )[0];
    const high = hitsPerBar(setEnergy(blank(), 1, BARS))[0];
    expect(low).toBe(4);
    expect(middle).toBe(8);
    expect(high).toBe(16);
    expect(energyHitsPerBar(0)).toBe(4);
    expect(energyHitsPerBar(0.5)).toBe(8);
    expect(energyHitsPerBar(1)).toBe(16);
  });
});
