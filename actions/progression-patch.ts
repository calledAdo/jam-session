import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { assertProgressionInput } from "../server/sessions/validation.js";
import { loadSessionPattern } from "./lib/generator-session.js";
import { numeralsSchema } from "./lib/session-schemas.js";

export default defineAction({
  description:
    "Build a keys-row chord progression patch without writing to the grid. Numerals apply to consecutive bars beginning at zero-based barStart (default 0). Send the returned patch to propose-ideas; only apply-progression writes directly.",
  schema: z.object({
    sessionId: z.string().min(1).describe("Session id."),
    numerals: numeralsSchema,
    barStart: z.coerce
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Zero-based first bar for the progression."),
  }),
  readOnly: true,
  run: async ({ sessionId, numerals, barStart }) => {
    const { bars } = await loadSessionPattern(sessionId);
    const indices = numerals.map((_, index) => barStart + index);
    assertProgressionInput(indices, numerals, bars);

    return {
      sessionId,
      track: "keys" as const,
      barStart,
      barEnd: barStart + numerals.length - 1,
      patch: numerals.map((numeral, index) => ({
        track: "keys" as const,
        fromStep: barStart + index,
        steps: [numeral.trim()],
      })),
    };
  },
});
