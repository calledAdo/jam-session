import { describe, expect, it } from "vitest";

import {
  ENERGY_EIGHTH_THRESHOLD,
  ENERGY_SIXTEENTH_THRESHOLD,
  energyHitsPerBar,
  setEnergy,
  setBassEnergy,
} from "./energy";
import { degreeToNote, noteToMidi, SCALE_INTERVALS, scaleNotes } from "./notes";
import type { BassSteps, DrumSteps } from "./types";

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

describe("setBassEnergy", () => {
  const harmony = {
    root: "C",
    scale: "minor",
    keys: ["i", "VI"],
    kick: Array.from({ length: 32 }, (_, i) =>
      [0, 7, 10].includes(i % 16) ? 3 : 0,
    ),
  };
  const bass = (): BassSteps => new Array(32).fill(null);
  const hits = (steps: BassSteps) =>
    steps.flatMap((note, i) => (note === null ? [] : [i]));

  it("places only chord roots on bar downbeats at low energy", () => {
    const result = setBassEnergy(new Array(32).fill(5), 0, 2, harmony);
    expect(hits(result)).toEqual([0, 16]);
    expect([result[0], result[16]]).toEqual([1, 6]);
  });

  it("follows even syncopated kick hits with chord roots at mid energy", () => {
    const result = setBassEnergy(bass(), 0.5, 2, harmony);
    expect(hits(result)).toEqual([0, 7, 10, 16, 23, 26]);
    expect(result.slice(0, 16).filter((n) => n !== null)).toEqual([1, 1, 1]);
    expect(result.slice(16).filter((n) => n !== null)).toEqual([6, 6, 6]);
  });

  it("adds eighths before sixteenths, preserving bar and kick anchors", () => {
    const result = setBassEnergy(bass(), 2 / 3, 2, harmony);
    expect(hits(result).slice(0, 9)).toEqual([0, 2, 4, 6, 7, 8, 10, 12, 14]);
    expect(result[0]).toBe(1);
    expect(result[2]).toBe(8); // octave of i
    expect(result[6]).toBe(5); // fifth of i
    expect(result[16]).toBe(6);
    expect(result[18]).toBe(13); // octave of VI
    expect(result[22]).toBe(10); // fifth of VI, in the next octave
    expect(hits(setBassEnergy(bass(), 1, 2, harmony))).toHaveLength(32);
  });

  it.each(Object.keys(SCALE_INTERVALS))(
    "stays in %s for every root, including chromatic chords",
    (scale) => {
      for (const root of ["C", "F#", "Bb"]) {
        const chords = [
          "i",
          "ii°",
          "III",
          "iv",
          "V7",
          "VI",
          "VII",
          "bII",
          "#IV",
        ];
        const notes = new Set(
          scaleNotes(root, scale, 2).map((n) => noteToMidi(n) % 12),
        );
        const result = setBassEnergy(
          new Array(chords.length * 16).fill(null),
          1,
          chords.length,
          {
            ...harmony,
            root,
            scale,
            keys: chords,
          },
        );
        for (const degree of result) {
          expect(Number.isInteger(degree)).toBe(true);
          expect(degree).toBeGreaterThan(0);
          expect(
            notes.has(noteToMidi(degreeToNote(root, scale, degree!, 2)) % 12),
          ).toBe(true);
        }
      }
    },
  );

  it("maps pentatonic VI and VII to their actual in-key roots", () => {
    const result = setBassEnergy(bass(), 0, 2, {
      ...harmony,
      scale: "pentatonic minor",
      keys: ["VI", "VII"],
    });
    // Ab projects to G; Bb is pentatonic degree 5, not degree 7.
    expect([result[0], result[16]]).toEqual([4, 5]);
  });

  it("uses tonic for empty, missing, or invalid chord labels and anchors a silent kick", () => {
    for (const keys of [[], ["", "nonsense"]]) {
      const result = setBassEnergy(bass(), 0.5, 2, {
        ...harmony,
        keys,
        kick: [],
      });
      expect(hits(result)).toEqual([0, 16]);
      expect([result[0], result[16]]).toEqual([1, 1]);
    }
  });

  it("is deterministic, preserves inputs and tail, and clamps invalid levels/bars", () => {
    const input = new Array(35).fill(3);
    const snapshot = structuredClone({ input, harmony });
    const first = setBassEnergy(input, 0.5, 1, harmony);
    expect(first).toEqual(setBassEnergy(input, 0.5, 1, harmony));
    expect(first).not.toBe(input);
    expect(first.slice(16)).toEqual(input.slice(16));
    expect({ input, harmony }).toEqual(snapshot);
    for (const level of [-1, NaN, Infinity]) {
      expect(setBassEnergy(input, level, 2, harmony)).toEqual(
        setBassEnergy(input, 0, 2, harmony),
      );
    }
    expect(setBassEnergy(input, 2, 2, harmony)).toEqual(
      setBassEnergy(input, 1, 2, harmony),
    );
    for (const bars of [0, -1, NaN])
      expect(setBassEnergy(input, 1, bars, harmony)).toEqual(input);
    expect(setBassEnergy(input, 1, 100, harmony).slice(32)).toEqual(
      input.slice(32),
    );
  });
});
