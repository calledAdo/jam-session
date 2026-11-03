import { describe, expect, it } from "vitest";

import { BAND_AGENT_PROFILES, profilesNeedingSeed } from "./band-agents.js";

describe("band agent profiles", () => {
  it("declares one focused profile for each bandmate", () => {
    expect(BAND_AGENT_PROFILES.map(({ name, path }) => [name, path])).toEqual([
      ["Drummer", "agents/drummer.md"],
      ["Bassist", "agents/bassist.md"],
      ["Keys", "agents/keys.md"],
    ]);
    for (const profile of BAND_AGENT_PROFILES) {
      expect(profile.content).toContain("tools: inherit");
      expect(profile.content).toContain(
        "call propose-ideas exactly once with exactly one idea",
      );
      expect(profile.content).toContain("Never call set-steps");
    }
  });

  it("selects only missing profile paths and preserves existing profiles", () => {
    expect(
      profilesNeedingSeed(["agents/drummer.md", "agents/keys.md"]),
    ).toEqual([BAND_AGENT_PROFILES[1]]);
    expect(
      profilesNeedingSeed(BAND_AGENT_PROFILES.map(({ path }) => path)),
    ).toEqual([]);
  });
});
