import { describe, expect, it } from "vitest";

import { authorsForNewIdeas } from "./band-moment.js";

describe("authorsForNewIdeas", () => {
  it("matches newly arrived ideas by bandmate author", () => {
    expect(
      authorsForNewIdeas(
        [
          { id: "old", author: "Drummer" },
          { id: "keys", author: "Keys" },
          { id: "other", author: "Bandmate" },
          { id: "bass", author: "Bassist" },
        ],
        new Set(["old"]),
      ),
    ).toEqual(["Bassist", "Keys"]);
  });

  it("returns no authors when only old or non-bandmate ideas are present", () => {
    expect(
      authorsForNewIdeas(
        [
          { id: "old", author: "Drummer" },
          { id: "user", author: "You" },
        ],
        new Set(["old"]),
      ),
    ).toEqual([]);
  });
});
