import { describe, expect, it } from "vitest";

import { seedSession, SEED_STYLES, SEED_DEFAULTS } from "./seed";

import { degreeToNote, romanToChord, scaleNotes } from "./notes";

const STYLES = SEED_STYLES;

describe("seedSession", () => {
  it("exposes the supported styles", () => {
    expect(STYLES).toEqual(["lofi", "boombap", "trap", "house", "empty"]);
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

describe("vibe cells", () => {
  it.each(SEED_STYLES)(
    "%s stays in key, valid, deterministic, and repeats its cells",
    (style) => {
      const pattern = seedSession(style, 8);
      const { root, scale } = SEED_DEFAULTS[style];
      const pitches = scaleNotes(root, scale, 2).map((note) =>
        note.replace(/-?\d+$/, ""),
      );
      for (const row of [pattern.kick, pattern.snare, pattern.hat]) {
        expect(row).toHaveLength(128);
        expect(row.every((n) => Number.isInteger(n) && n >= 0 && n <= 3)).toBe(
          true,
        );
      }
      expect(pattern.bass).toHaveLength(128);
      expect(pattern.keys).toHaveLength(8);
      for (const degree of pattern.bass) {
        if (degree === null) continue;
        expect(pitches).toContain(
          degreeToNote(root, scale, degree, 2).replace(/-?\d+$/, ""),
        );
      }
      for (const chord of pattern.keys.filter(Boolean)) {
        for (const note of romanToChord(root, scale, chord, 3)) {
          expect(pitches).toContain(note.replace(/-?\d+$/, ""));
        }
      }
      expect(pattern).toEqual(seedSession(style, 8));
      for (const row of [
        pattern.kick,
        pattern.snare,
        pattern.hat,
        pattern.bass,
      ]) {
        expect(row.slice(0, 64)).toEqual(row.slice(64));
      }
      if (style !== "empty") {
        const cells = Array.from({ length: 4 }, (_, bar) =>
          JSON.stringify({
            kick: pattern.kick.slice(bar * 16, (bar + 1) * 16),
            bass: pattern.bass.slice(bar * 16, (bar + 1) * 16),
            chord: pattern.keys[bar],
          }),
        );
        expect(new Set(cells).size).toBeGreaterThanOrEqual(2);
      }
    },
  );

  it("gives boom-bap a swung backbeat, seventh chords and kick-led bass", () => {
    const pattern = seedSession("boombap", 2);
    expect(SEED_DEFAULTS.boombap).toMatchObject({
      bpm: 90,
      root: "D",
      swing: 0.3,
      kit: "boombap",
    });
    expect(pattern.keys).toEqual(["i7", "iv7"]);
    for (let bar = 0; bar < 2; bar++) {
      expect(pattern.kick[bar * 16]).toBe(3);
      for (const offset of [4, 12])
        expect(pattern.snare[bar * 16 + offset]).toBe(3);
    }
    pattern.bass.forEach((value, step) => {
      if (value !== null) expect(pattern.kick[step]).toBeGreaterThan(0);
    });
    expect(pattern.hat).toContain(1);
  });

  it("gives trap a single half-time snare and sparse sub hits under rolling hats", () => {
    const pattern = seedSession("trap", 4);
    expect(SEED_DEFAULTS.trap).toMatchObject({
      bpm: 140,
      root: "F",
      swing: 0,
      kit: "808",
    });
    for (let bar = 0; bar < 4; bar++) {
      expect(
        pattern.snare
          .slice(bar * 16, bar * 16 + 16)
          .flatMap((v, i) => (v ? [i] : [])),
      ).toEqual([8]);
    }
    expect(pattern.bass.filter((v) => v !== null).length).toBeLessThanOrEqual(
      12,
    );
    pattern.bass.forEach((v, step) => {
      if (v !== null) expect(pattern.kick[step]).toBeGreaterThan(0);
    });
    expect(new Set(pattern.hat)).toEqual(new Set([1, 2, 3]));
  });
});
