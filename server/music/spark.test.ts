import { describe, expect, it } from "vitest";

import {
  isSparkSessionName,
  pickSparkStyle,
  sparkDateKey,
  sparkRowSeed,
  sparkSessionName,
} from "./spark";

describe("spark helpers", () => {
  it("formats a local date key", () => {
    expect(sparkDateKey(new Date(2026, 10, 3, 23, 59))).toBe("2026-11-03");
  });

  it("names and recognises spark sessions", () => {
    const name = sparkSessionName("2026-11-03");
    expect(name).toBe("Spark — 2026-11-03");
    expect(isSparkSessionName(name)).toBe(true);
    expect(isSparkSessionName("Lofi jam")).toBe(false);
  });

  it("defaults to lofi with no liked taste", () => {
    expect(pickSparkStyle([])).toBe("lofi");
    expect(pickSparkStyle([{ signal: "house stabs — You", weight: -1 }])).toBe("lofi");
  });

  it("picks house when liked signals lean house", () => {
    expect(
      pickSparkStyle([
        { signal: "Four on the floor — You", weight: 1 },
        { signal: "Offbeat hats — Drummer", weight: 1 },
      ]),
    ).toBe("house");
  });

  it("derives stable seeds per date and row", () => {
    expect(sparkRowSeed("2026-11-03", "hat")).toBe(sparkRowSeed("2026-11-03", "hat"));
    expect(sparkRowSeed("2026-11-03", "hat")).not.toBe(sparkRowSeed("2026-11-04", "hat"));
  });
});
