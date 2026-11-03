import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { applyProgression } from "../server/sessions/store.js";
import {
  authorSchema,
  barIndicesSchema,
  numeralsSchema,
} from "./lib/session-schemas.js";

export default defineAction({
  description:
    "Write a chord progression to the keys row: one roman-numeral chord per bar. bars uses zero-based indices, so bars [2,3] are the third and fourth bars. numerals must line up one-to-one with bars. Recorded for undo-last.",
  schema: z.object({
    sessionId: z.string().min(1).describe("Session id."),
    bars: barIndicesSchema,
    numerals: numeralsSchema,
    author: authorSchema,
  }),
  run: async (args) => {
    return applyProgression(args);
  },
});
