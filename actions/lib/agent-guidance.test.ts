import { readFileSync, realpathSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("agent instruction delivery", () => {
  it("keeps the full Jam guide below the compact prompt resource limit", () => {
    const guide = readFileSync(
      new URL("../../AGENTS.md", import.meta.url),
      "utf8",
    );
    // Core 0.223.0 truncates each compact prompt resource at 6,000 chars.
    // Leave space for its resource wrapper and future edits.
    expect(guide.length).toBeLessThan(5_500);
    expect(guide.startsWith("# Jam Session")).toBe(true);
  });

  it("keeps CLAUDE.md linked to the same guide", () => {
    expect(realpathSync(new URL("../../CLAUDE.md", import.meta.url))).toBe(
      realpathSync(new URL("../../AGENTS.md", import.meta.url)),
    );
  });
});
