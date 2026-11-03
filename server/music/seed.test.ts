import { describe, expect, it } from "vitest";

import { seedSession, SEED_STYLES } from "./seed";

const STYLES = SEED_STYLES;

describe("seedSession", () => {
  it("exposes the supported styles", () => {
    expect(STYLES).toEqual(["lofi", "house", "empty"]);
  });

  it("creates correctly sized lofi rows", () => {
    const pattern = seedSession("lofi", 4);
    expect(pattern.kick).toHaveLength(64);
    expect(pattern.snare).toHaveLength(64);
    expect(pattern.hat).toHaveLength(64);
    expect(pattern.bass).toHaveLength(64);
    expect(pattern.keys).toHaveLength(4);
  });

  it("keeps lofi velocities and bass degrees valid", () => {
    const pattern = seedSession("lofi", 8);
    for (const row of [pattern.kick, pattern.snare, pattern.hat]) {
      for (const velocity of row) {
        expect(Number.isInteger(velocity)).toBe(true);
        expect(velocity).toBeGreaterThanOrEqual(0);
        expect(velocity).toBeLessThanOrEqual(3);
      }
    }
    for (const degree of pattern.bass) {
      if (degree === null) continue;
      expect(degree).toBeGreaterThanOrEqual(1);
      expect(degree).toBeLessThanOrEqual(7);
    }
    for (const chord of pattern.keys) {
      expect(chord).toMatch(/^[ivIV]+$/);
    }
  });

  it("builds a four-on-the-floor house kick", () => {
    const pattern = seedSession("house", 4);
    for (let bar = 0; bar < 4; bar++) {
      for (const offset of [0, 4, 8, 12]) {
        expect(pattern.kick[bar * 16 + offset]).toBeGreaterThan(0);
      }
    }
  });

  it("returns a genuinely empty grid", () => {
    const pattern = seedSession("empty", 2);
    expect(pattern.kick.every((velocity) => velocity === 0)).toBe(true);
    expect(pattern.snare.every((velocity) => velocity === 0)).toBe(true);
    expect(pattern.hat.every((velocity) => velocity === 0)).toBe(true);
    expect(pattern.bass.every((degree) => degree === null)).toBe(true);
    expect(pattern.keys).toEqual(["", ""]);
  });

  it("repeats the four-bar cell for longer seeds", () => {
    const pattern = seedSession("lofi", 8);
    expect(pattern.keys[4]).toBe(pattern.keys[0]);
    expect(pattern.kick[64]).toBe(pattern.kick[0]);
    expect(pattern.bass[64]).toBe(pattern.bass[0]);
  });

  it("is deterministic", () => {
    expect(seedSession("house", 4)).toEqual(seedSession("house", 4));
    expect(seedSession("lofi", 2)).toEqual(seedSession("lofi", 2));
  });

  it("normalizes odd bar counts", () => {
    expect(seedSession("lofi", 0).kick).toHaveLength(16);
    expect(seedSession("lofi", 3.9).kick).toHaveLength(48);
    expect(seedSession("empty", Number.NaN).keys).toHaveLength(4);
  });
});
