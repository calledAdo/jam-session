import { describe, expect, it } from "vitest";

import { shouldLogMainThreadBandmateFallback } from "./unstick-proposal-log.js";

describe("shouldLogMainThreadBandmateFallback", () => {
  it("logs when separate proposals use multiple bandmate authors in one turn", () => {
    expect(
      shouldLogMainThreadBandmateFallback("turn-separate-calls", ["Drummer"]),
    ).toBe(false);
    expect(
      shouldLogMainThreadBandmateFallback("turn-separate-calls", ["Bassist"]),
    ).toBe(true);
    expect(
      shouldLogMainThreadBandmateFallback("turn-separate-calls", ["Keys"]),
    ).toBe(false);
  });

  it("logs one multi-author proposal and ignores non-bandmate authors", () => {
    expect(
      shouldLogMainThreadBandmateFallback("turn-bulk", ["Drummer", "Keys"]),
    ).toBe(true);
    expect(
      shouldLogMainThreadBandmateFallback("turn-other", ["You", "Bandmate"]),
    ).toBe(false);
  });
});
