import { describe, expect, it } from "vitest";

import { summarizeTaste } from "./taste";

describe("summarizeTaste", () => {
  it("turns track and move words into a concise producer profile", () => {
    expect(
      summarizeTaste([
        { signal: "Shake up the bass in bars 1–2", weight: 1 },
        { signal: "Fill bars 1–2 on the hats", weight: 1 },
        { signal: "Simplify the keys", weight: -1 },
      ]),
    ).toBe("Likes bass movement, hat fills · avoids space");
  });

  it("net-weights repeated descriptors and limits each side", () => {
    expect(
      summarizeTaste([
        { signal: "Nudge the bass", weight: 1 },
        { signal: "Push the bass", weight: 1 },
        { signal: "Vary the snare", weight: 1 },
        { signal: "Shake the bass", weight: -1 },
        { signal: "Make the hats darker", weight: -1 },
        { signal: "Make the hats brighter", weight: -1 },
      ]),
    ).toBe("Likes bass movement, snare movement · avoids darker");
  });

  it("summarizes chord changes and movement without a track", () => {
    expect(
      summarizeTaste([
        { signal: "Try a new chord progression", weight: 1 },
        { signal: "A stutter fill before the drop", weight: -1 },
      ]),
    ).toBe("Likes chord changes · avoids fills");
  });

  it("uses the learning prompt when signals have no recognized descriptors", () => {
    expect(summarizeTaste([])).toBe("Still learning your taste");
    expect(summarizeTaste([{ signal: "Four on the floor", weight: 1 }])).toBe(
      "Still learning your taste",
    );
  });
});
