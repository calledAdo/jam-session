import { describe, expect, it } from "vitest";

import { addFill, transform, varyPattern } from "./generate";
import { applyPatch, patchCellCount } from "./patch";
import type { BassSteps, DrumSteps, KeysSteps, Patch, Pattern } from "./types";

const BARS = 4;

function expectInBounds(patch: Patch, bars: number): void {
  for (const entry of patch) {
    const rowLength = entry.track === "keys" ? bars : bars * 16;
    expect(entry.fromStep).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(entry.fromStep)).toBe(true);
    expect(entry.fromStep + entry.steps.length).toBeLessThanOrEqual(rowLength);
  }
}

function blank(): Pattern {
  return {
    kick: new Array<number>(BARS * 16).fill(0),
    snare: new Array<number>(BARS * 16).fill(0),
    hat: new Array<number>(BARS * 16).fill(0),
    bass: new Array<number | null>(BARS * 16).fill(null),
    keys: new Array<string>(BARS).fill("i"),
  };
}

function eighthHats(): DrumSteps {
  const steps = new Array<number>(BARS * 16).fill(0);
  for (let index = 0; index < steps.length; index += 2) steps[index] = 2;
  return steps;
}

function walkingBass(scaleLength = 7): BassSteps {
  const steps = new Array<number | null>(BARS * 16).fill(null);
  const degrees = [1, 2, 3, 4, 5, 6, 7, 1];
  for (let index = 0; index < steps.length; index += 2) {
    steps[index] = degrees[(index / 2) % degrees.length] ?? 1;
    if ((steps[index] ?? 1) > scaleLength) steps[index] = scaleLength;
  }
  return steps;
}

describe("varyPattern determinism", () => {
  it("returns the same patch for the same seed", () => {
    const steps = eighthHats();
    const a = varyPattern("hat", steps, {
      barStart: 0,
      barEnd: 3,
      intensity: 0.6,
      seed: 42,
    });
    const b = varyPattern("hat", steps, {
      barStart: 0,
      barEnd: 3,
      intensity: 0.6,
      seed: 42,
    });
    expect(a).toEqual(b);
  });

  it("returns different patches for different seeds", () => {
    const steps = eighthHats();
    const a = varyPattern("hat", steps, {
      barStart: 0,
      barEnd: 3,
      intensity: 0.6,
      seed: 1,
    });
    const b = varyPattern("hat", steps, {
      barStart: 0,
      barEnd: 3,
      intensity: 0.6,
      seed: 2,
    });
    expect(a).not.toEqual(b);
  });

  it("does nothing at intensity 0", () => {
    expect(
      varyPattern("hat", eighthHats(), {
        barStart: 0,
        barEnd: 3,
        intensity: 0,
        seed: 1,
      }),
    ).toEqual([]);
  });
});

describe("varyPattern bounds", () => {
  it("stays inside the row for every kind and many seeds", () => {
    const pattern = blank();
    for (let seed = 0; seed < 60; seed++) {
      expectInBounds(
        varyPattern("kick", pattern.kick, {
          barStart: 0,
          barEnd: 3,
          intensity: 0.8,
          seed,
        }),
        BARS,
      );
      expectInBounds(
        varyPattern("snare", pattern.snare, {
          barStart: 1,
          barEnd: 2,
          intensity: 0.5,
          seed,
        }),
        BARS,
      );
      expectInBounds(
        varyPattern("hat", eighthHats(), {
          barStart: 0,
          barEnd: 3,
          intensity: 1,
          seed,
        }),
        BARS,
      );
      expectInBounds(
        varyPattern("bass", walkingBass(), {
          barStart: 0,
          barEnd: 3,
          intensity: 1,
          seed,
        }),
        BARS,
      );
      expectInBounds(
        varyPattern("keys", pattern.keys, {
          barStart: 0,
          barEnd: 3,
          intensity: 1,
          seed,
        }),
        BARS,
      );
    }
  });

  it("only touches the selected bars", () => {
    const steps = walkingBass();
    const patch = varyPattern("bass", steps, {
      barStart: 2,
      barEnd: 3,
      intensity: 1,
      seed: 5,
    });
    expect(patch.length).toBeGreaterThan(0);
    for (const entry of patch) {
      expect(entry.fromStep).toBeGreaterThanOrEqual(32);
      expect(entry.fromStep + entry.steps.length).toBeLessThanOrEqual(64);
    }
  });

  it("swaps reversed bar ranges instead of producing garbage", () => {
    const patch = varyPattern("hat", eighthHats(), {
      barStart: 2,
      barEnd: 1,
      intensity: 0.5,
      seed: 3,
    });
    expectInBounds(patch, BARS);
  });

  it("returns no patch when the selection is outside the row", () => {
    expect(
      varyPattern("hat", eighthHats(), {
        barStart: 9,
        barEnd: 12,
        intensity: 0.5,
        seed: 1,
      }),
    ).toEqual([]);
  });
});

describe("varyPattern drums", () => {
  it("keeps a kick on every downbeat", () => {
    const steps = new Array<number>(BARS * 16).fill(0);
    steps[0] = 3;
    steps[16] = 3;
    for (let seed = 0; seed < 100; seed++) {
      const patch = varyPattern("kick", steps, {
        barStart: 0,
        barEnd: 3,
        intensity: 0.7,
        seed,
      });
      const next = applyPatch({ ...blank(), kick: steps }, patch);
      for (let bar = 0; bar < BARS; bar++) {
        expect(next.kick[bar * 16]).toBeGreaterThan(0);
      }
    }
  });

  it("anchors an empty kick on every selected downbeat", () => {
    const steps = new Array<number>(BARS * 16).fill(0);
    const patch = varyPattern("kick", steps, {
      barStart: 0,
      barEnd: 1,
      intensity: 0.4,
      seed: 7,
    });
    const next = applyPatch({ ...blank(), kick: steps }, patch);
    expect(next.kick[0]).toBeGreaterThan(0);
    expect(next.kick[16]).toBeGreaterThan(0);
  });

  it("makes more changes at high intensity than at low intensity", () => {
    const steps = eighthHats();
    const count = (intensity: number) =>
      Array.from({ length: 5 }, (_, seed) =>
        patchCellCount(
          varyPattern("hat", steps, {
            barStart: 0,
            barEnd: 3,
            intensity,
            seed,
          }),
        ),
      ).reduce((sum, value) => sum + value, 0);

    expect(count(1)).toBeGreaterThan(count(0.1));
  });

  it("keeps velocities inside 1..3 when adding hits", () => {
    const patch = varyPattern("hat", new Array<number>(64).fill(0), {
      barStart: 0,
      barEnd: 3,
      intensity: 1,
      seed: 11,
    });
    const next = applyPatch(
      { ...blank(), hat: new Array<number>(64).fill(0) },
      patch,
    );
    for (const velocity of next.hat) {
      expect(velocity).toBeGreaterThanOrEqual(0);
      expect(velocity).toBeLessThanOrEqual(3);
    }
  });
});

describe("varyPattern bass", () => {
  it("keeps every degree inside 1..scaleLength", () => {
    const steps = walkingBass(5);
    for (let seed = 0; seed < 80; seed++) {
      const patch = varyPattern("bass", steps, {
        barStart: 0,
        barEnd: 3,
        intensity: 1,
        seed,
        scaleLength: 5,
      });
      const next = applyPatch({ ...blank(), bass: steps }, patch);
      for (const degree of next.bass) {
        if (degree === null) continue;
        expect(Number.isInteger(degree)).toBe(true);
        expect(degree).toBeGreaterThanOrEqual(1);
        expect(degree).toBeLessThanOrEqual(5);
      }
    }
  });

  it("preserves a bar-start bass note", () => {
    const steps = walkingBass();
    for (let seed = 0; seed < 60; seed++) {
      const patch = varyPattern("bass", steps, {
        barStart: 0,
        barEnd: 3,
        intensity: 1,
        seed,
      });
      const next = applyPatch({ ...blank(), bass: steps }, patch);
      for (let bar = 0; bar < BARS; bar++) {
        expect(next.bass[bar * 16]).not.toBeNull();
      }
    }
  });
});

describe("varyPattern keys", () => {
  it("returns string chord replacements inside the selected bars", () => {
    const steps: KeysSteps = ["i", "VI", "iv", "v"];
    const patch = varyPattern("keys", steps, {
      barStart: 1,
      barEnd: 3,
      intensity: 0.8,
      seed: 4,
    });
    expect(patch.length).toBeGreaterThan(0);
    for (const entry of patch) {
      expect(entry.track).toBe("keys");
      expect(entry.fromStep).toBeGreaterThanOrEqual(1);
      for (const value of entry.steps) expect(typeof value).toBe("string");
    }
    const next = applyPatch({ ...blank(), keys: steps }, patch);
    expect(next.keys).toHaveLength(4);
  });
});

describe("addFill", () => {
  it("rolls a snare over the last beat by default", () => {
    const steps = new Array<number>(32).fill(0);
    const patch = addFill(steps, 0, "roll");
    expect(patch.every((entry) => entry.track === "snare")).toBe(true);
    expectInBounds(patch, 2);

    const next = applyPatch({ ...blank(), snare: steps }, patch);
    expect(next.snare[12]).toBe(2);
    expect(next.snare[15]).toBe(3);
    expect(next.snare[28]).toBe(0);
  });

  it("stutters hats by default", () => {
    const steps = new Array<number>(16).fill(0);
    const patch = addFill(steps, 0, "stutter");
    expect(patch.every((entry) => entry.track === "hat")).toBe(true);
    const next = applyPatch({ ...blank(), hat: steps }, patch);
    expect(next.hat[15]).toBe(3);
    expect(next.hat[8]).toBe(1);
  });

  it("drops the kick on the last beat by default", () => {
    const steps = new Array<number>(16).fill(0);
    steps[0] = 3;
    steps[12] = 2;
    steps[14] = 1;
    const patch = addFill(steps, 0, "drop");
    expect(patch.every((entry) => entry.track === "kick")).toBe(true);
    const next = applyPatch({ ...blank(), kick: steps }, patch);
    expect(next.kick[0]).toBe(3);
    expect(next.kick[12]).toBe(0);
    expect(next.kick[14]).toBe(0);
  });

  it("supports an explicit target row", () => {
    const steps = new Array<number>(16).fill(0);
    const patch = addFill(steps, 0, "roll", { track: "hat" });
    expect(patch.every((entry) => entry.track === "hat")).toBe(true);
  });

  it("is deterministic and rejects out-of-range bars", () => {
    const steps = new Array<number>(32).fill(0);
    expect(addFill(steps, 1, "roll")).toEqual(addFill(steps, 1, "roll"));
    expect(addFill(steps, -1, "roll")).toEqual([]);
    expect(addFill(steps, 2, "roll")).toEqual([]);
  });
});

describe("transform drums", () => {
  it("simplify removes about 40% of non-downbeat hits and keeps downbeats", () => {
    const steps = eighthHats();
    const patch = transform(
      "hat",
      steps,
      { barStart: 0, barEnd: 3 },
      "simplify",
    );
    expectInBounds(patch, BARS);
    const next = applyPatch({ ...blank(), hat: steps }, patch);

    for (let index = 0; index < steps.length; index += 4) {
      expect(next.hat[index]).toBe(steps[index]);
    }
    const beforeOffbeat = steps.filter(
      (velocity, index) => velocity > 0 && index % 4 !== 0,
    ).length;
    const afterOffbeat = next.hat.filter(
      (velocity, index) => velocity > 0 && index % 4 !== 0,
    ).length;
    expect(beforeOffbeat - afterOffbeat).toBe(Math.round(beforeOffbeat * 0.4));
  });

  it("darker lowers velocities and brighter raises them", () => {
    const steps = eighthHats();
    const darker = applyPatch(
      { ...blank(), snare: steps },
      transform("snare", steps, { barStart: 0, barEnd: 3 }, "darker"),
    );
    const brighter = applyPatch(
      { ...blank(), hat: steps },
      transform("hat", steps, { barStart: 0, barEnd: 3 }, "brighter"),
    );
    expect(Math.max(...darker.snare)).toBeLessThanOrEqual(2);
    expect(Math.max(...brighter.hat)).toBe(3);
  });

  it("is deterministic", () => {
    const steps = eighthHats();
    expect(
      transform("hat", steps, { barStart: 1, barEnd: 2 }, "simplify"),
    ).toEqual(transform("hat", steps, { barStart: 1, barEnd: 2 }, "simplify"));
  });
});

describe("transform bass", () => {
  it("darker moves degrees down a third (clamped at 1)", () => {
    const steps: BassSteps = new Array<number | null>(16).fill(null);
    steps[0] = 1;
    steps[4] = 3;
    steps[8] = 5;
    steps[12] = 7;
    const patch = transform(
      "bass",
      steps,
      { barStart: 0, barEnd: 0 },
      "darker",
    );
    const next = applyPatch({ ...blank(), bass: steps }, patch);
    expect([next.bass[0], next.bass[4], next.bass[8], next.bass[12]]).toEqual([
      1, 1, 3, 5,
    ]);
  });

  it("brighter moves degrees up a third and clamps to the scale", () => {
    const steps: BassSteps = new Array<number | null>(16).fill(null);
    steps[0] = 1;
    steps[4] = 3;
    steps[8] = 5;
    steps[12] = 7;
    const patch = transform(
      "bass",
      steps,
      { barStart: 0, barEnd: 0 },
      "brighter",
      { scaleLength: 5 },
    );
    const next = applyPatch({ ...blank(), bass: steps }, patch);
    expect([next.bass[0], next.bass[4], next.bass[8], next.bass[12]]).toEqual([
      3, 5, 5, 5,
    ]);
  });

  it("simplify thins non-downbeat notes while keeping downbeats", () => {
    const steps = walkingBass();
    const patch = transform(
      "bass",
      steps,
      { barStart: 0, barEnd: 3 },
      "simplify",
    );
    const next = applyPatch({ ...blank(), bass: steps }, patch);
    for (let index = 0; index < steps.length; index += 4) {
      expect(next.bass[index]).toBe(steps[index]);
    }
    const before = steps.filter((value) => value !== null).length;
    const after = next.bass.filter((value) => value !== null).length;
    expect(before - after).toBeGreaterThan(0);
    expect(before - after).toBeLessThanOrEqual(Math.ceil(before * 0.4));
  });
});

describe("transform keys", () => {
  it("darker shifts down a third and leans minor", () => {
    const steps: KeysSteps = ["I", "IV", "vi", "V"];
    const patch = transform(
      "keys",
      steps,
      { barStart: 0, barEnd: 3 },
      "darker",
    );
    const next = applyPatch({ ...blank(), keys: steps }, patch);
    expect(next.keys).toEqual(["vi", "ii", "iv", "iii"]);
  });

  it("brighter shifts up a third and leans major", () => {
    const steps: KeysSteps = ["i", "iv", "v"];
    const patch = transform(
      "keys",
      steps,
      { barStart: 0, barEnd: 2 },
      "brighter",
    );
    const next = applyPatch({ ...blank(), keys: steps }, patch);
    expect(next.keys.slice(0, 3)).toEqual(["III", "VI", "VII"]);
  });

  it("simplify strips extensions and holds some chords", () => {
    const steps: KeysSteps = ["i", "V7", "vi", "IVadd9"];
    const patch = transform(
      "keys",
      steps,
      { barStart: 0, barEnd: 3 },
      "simplify",
    );
    const next = applyPatch({ ...blank(), keys: steps }, patch);
    for (const chord of next.keys) {
      expect(chord).not.toMatch(/[0-9]/);
    }
    const held = next.keys.some(
      (chord, bar) => bar > 0 && chord === next.keys[bar - 1],
    );
    expect(held).toBe(true);
  });

  it("never touches an empty chord slot", () => {
    const steps: KeysSteps = ["", ""];
    expect(
      transform("keys", steps, { barStart: 0, barEnd: 1 }, "darker"),
    ).toEqual([]);
  });
});
