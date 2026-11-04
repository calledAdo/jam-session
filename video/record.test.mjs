import { describe, expect, it } from "vitest";
import { spokenRationale } from "../../video/record.mjs";

describe("spokenRationale", () => {
  it("turns real role rationales into short, plain spoken lines", () => {
    const cases = [
      [
        "Drummer",
        "A restrained snare lead-in on the final beat lifts the pocket into the turnaround.",
        "Your loop never breathes. I'll slip a quick snare roll in to lift the ending.",
      ],
      [
        "Drummer",
        "A light kick-pocket loosen-up adds a little offbeat give while leaving the busy hats untouched.",
        "I'll loosen the kick and leave your busy hats exactly as they are.",
      ],
      [
        "Bassist",
        "A few offbeat pickups and a compact turnaround give the bass fresh motion.",
        "Let me walk the bass between the kicks so it pulls you forward into the ending.",
      ],
      [
        "Keys",
        "A Gentle VI turnaround in the loop's final bar gives a subtle harmonic lift while leaving the busy hats and bass pocket untouched.",
        "I'll brighten the last chord with a small turn, leaving your bass and busy hats alone.",
      ],
      [
        "Keys",
        "A gentle chord change adds motion under the busy cymbals.",
        "I'll add a gentle chord change beneath your busy cymbals to bring the loop some warmth.",
      ],
      [
        "Keys",
        "Resolving the final bar to C minor gives the ending a darker landing.",
        "I'll settle the final chord to give your ending a darker landing.",
      ],
    ];

    for (const [role, input, expected] of cases) {
      const rationale = spokenRationale(role, input);
      expect(rationale).toBe(expected);
      expect(rationale).not.toMatch(/\d/);
      const line = `${role} here. ${rationale}`;
      expect(line.match(/[\w’'-]+/g).length).toBeGreaterThanOrEqual(10);
      expect(line.match(/[\w’'-]+/g).length).toBeLessThanOrEqual(18);
    }
  });
});
