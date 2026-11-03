import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireAgentConfirm } from "./lib/agent-write-guard.js";

import { applyProgression } from "../server/sessions/store.js";
import {
  barIndicesSchema,
  numeralsSchema,
} from "./lib/session-schemas.js";

export default defineAction({
  description:
    "Direct write; to SUGGEST chords use progression-patch + propose-ideas. Write a chord progression to the keys row: one roman-numeral chord per bar. bars uses zero-based indices, so bars [2,3] are the third and fourth bars. numerals must line up one-to-one with bars. Recorded for undo-last.",
  schema: z.object({
    confirmApply: z
      .boolean()
      .optional()
      .describe(
        "Agent only: true when the user explicitly asked to apply this directly. Otherwise propose instead.",
      ),
    sessionId: z.string().min(1).describe("Session id."),
    bars: barIndicesSchema,
    numerals: numeralsSchema,
  }),
  run: async ({ confirmApply, ...args }, ctx) => {
    requireAgentConfirm(ctx?.caller, confirmApply, "build the chords with progression-patch");
    return applyProgression({
      ...args,
      author: ctx?.caller === "frontend" ? "user" : "agent",
    });
  },
});
