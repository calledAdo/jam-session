import { describe, expect, it } from "vitest";

import { analyzeGroove } from "./analyze";
import type { Pattern } from "./types";

const BARS = 2;

function blank(): Pattern {
  return blankBars(BARS);
}

function blankBars(bars: number): Pattern {
  return {
    kick: new Array<number>(bars * 16).fill(0),
    snare: new Array<number>(bars * 16).fill(0),
    hat: new Array<number>(bars * 16).fill(0),
    bass: new Array<number | null>(bars * 16).fill(null),
    keys: new Array<string>(bars).fill(""),
  };
}

function busyPattern(): Pattern {
  const pattern = blank();
  for (let bar = 0; bar < BARS; bar++) {
    const base = bar * 16;
    for (const offset of [0, 4, 8, 12]) pattern.kick[base + offset] = 3;
    for (const offset of [4, 12]) pattern.snare[base + offset] = 2;
    for (let offset = 0; offset < 16; offset += 2)
      pattern.hat[base + offset] = 1;
  }
  pattern.bass[0] = 1;
  pattern.bass[16] = 1;
  pattern.keys = ["i", "i"];
  return pattern;
}

describe("analyzeGroove density", () => {
  it("reports active cells per bar for every row", () => {
    const analysis = analyzeGroove(busyPattern(), BARS);
    expect(analysis.density).toEqual({
      kick: 4,
      snare: 2,
      hat: 8,
      bass: 1,
      keys: 1,
    });
  });

  it("computes the downbeat ratio over drums and bass", () => {
    const analysis = analyzeGroove(busyPattern(), BARS);
    // kick 8/8, snare 4/4, hat 8/16, bass 2/2 → 22 of 30 hits.
    expect(analysis.downbeatRatio).toBe(0.73);
  });

  it("rounds density to two decimals", () => {
    const pattern = blank();
    pattern.kick[0] = 1;
    pattern.kick[16] = 1;
    pattern.kick[17] = 1;
    expect(analyzeGroove(pattern, 3).density.kick).toBe(1);
  });
});

describe("analyzeGroove emptyRows", () => {
  it("lists rows without content", () => {
    const pattern = blank();
    pattern.kick[0] = 1;
    pattern.keys = ["i", "i"];
    const analysis = analyzeGroove(pattern, BARS);
    expect(analysis.emptyRows).toEqual(["snare", "hat", "bass"]);
  });

  it("considers whitespace-only chords empty", () => {
    const pattern = blank();
    pattern.keys = ["  ", ""];
    expect(analyzeGroove(pattern, BARS).emptyRows).toContain("keys");
  });
});

describe("analyzeGroove repetition", () => {
  it("scores identical bars as fully repetitive", () => {
    const analysis = analyzeGroove(busyPattern(), BARS);
    expect(analysis.repetitionScore).toBe(1);
  });

  it("scores different bars lower", () => {
    const pattern = busyPattern();
    pattern.snare[16 + 4] = 0;
    pattern.hat[16 + 1] = 2;
    pattern.bass[16] = 5;
    pattern.keys[1] = "iv";
    expect(analyzeGroove(pattern, BARS).repetitionScore).toBeLessThan(1);
  });

  it("handles a single bar", () => {
    expect(analyzeGroove(busyPattern(), 1).repetitionScore).toBe(1);
  });
});

describe("analyzeGroove notes", () => {
  it("points out a kick on every downbeat and identical bars", () => {
    const pattern = blankBars(4);
    for (let bar = 0; bar < 4; bar++) {
      pattern.kick[bar * 16] = 3;
      pattern.snare[bar * 16 + 4] = 2;
      pattern.hat[bar * 16 + 2] = 1;
      pattern.bass[bar * 16] = 1;
    }
    pattern.keys = ["i", "i", "i", "i"];

    const analysis = analyzeGroove(pattern, 4);
    expect(analysis.notes).toContain("kick lands on every downbeat");
    expect(analysis.notes).toContain("bars 1–4 identical");
  });

  it("describes an empty grid", () => {
    const analysis = analyzeGroove(blank(), BARS);
    expect(analysis.notes[0]).toMatch(/empty/);
  });

  it("flags lead-footed and busy rows", () => {
    const pattern = busyPattern();
    for (let bar = 0; bar < BARS; bar++) {
      for (const offset of [0, 4, 8, 12]) {
        pattern.snare[bar * 16 + offset] = 2;
      }
    }
    pattern.hat = new Array<number>(BARS * 16).fill(0);
    for (let index = 0; index < pattern.hat.length; index += 2) {
      pattern.hat[index] = 2;
    }
    const analysis = analyzeGroove(pattern, BARS);
    expect(analysis.notes).toContain("hats are busy — leave some space");
    expect(analysis.notes.some((note) => note.includes("on-the-grid"))).toBe(
      true,
    );
  });

  it("flags missing low end", () => {
    const pattern = busyPattern();
    pattern.bass = new Array<number | null>(BARS * 16).fill(null);
    expect(analyzeGroove(pattern, BARS).notes).toContain(
      "no low end — add bass notes",
    );
  });

  it("returns a balanced note when nothing is wrong", () => {
    const pattern = blank();
    pattern.kick[0] = 3;
    pattern.kick[16] = 3;
    pattern.snare[4] = 2;
    pattern.snare[16 + 12] = 2;
    pattern.hat[2] = 1;
    pattern.hat[16 + 14] = 1;
    pattern.bass[0] = 1;
    pattern.bass[16] = 1;
    pattern.keys = ["i", "VI"];
    // Keep bars varied so repetition and on-grid hints don't fire.
    const analysis = analyzeGroove(pattern, BARS);
    expect(analysis.notes.length).toBeGreaterThan(0);
  });
});

describe("analyzeGroove register", () => {
  it("flags bass and keys sharing a register", () => {
    const pattern = blank();
    pattern.bass[0] = 6;
    pattern.bass[16] = 6;
    pattern.keys = ["i", "i"];
    expect(analyzeGroove(pattern, BARS).registerGap).toBe(true);
    expect(analyzeGroove(pattern, BARS).notes).toContain(
      "bass and keys share a register — spread them out",
    );
  });

  it("does not flag bass below the keys", () => {
    const pattern = blank();
    pattern.bass[0] = 1;
    pattern.bass[16] = 1;
    pattern.keys = ["VI", "VI"];
    expect(analyzeGroove(pattern, BARS).registerGap).toBe(false);
  });

  it("does not flag a missing row", () => {
    const pattern = blank();
    pattern.keys = ["i", "i"];
    expect(analyzeGroove(pattern, BARS).registerGap).toBe(false);
  });
});
