import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireAgentConfirm } from "./lib/agent-write-guard.js";

import { setSteps } from "../server/sessions/store.js";
import { stepsSchema, trackKindSchema } from "./lib/session-schemas.js";

export default defineAction({
  description:
    "Direct write; to SUGGEST changes use a generator + propose-ideas. Write a contiguous run of cells on one track, starting at a zero-based step. This is the same direct-edit action the grid uses for clicks. Drum steps are integer velocities 0-3 (0 = off), bass steps are scale-degree numbers or null, keys steps are roman-numeral strings or null. The change is applied immediately and recorded for undo-last.",
  schema: z.object({
    confirmApply: z
      .boolean()
      .optional()
      .describe(
        "Agent only: true when the user explicitly asked to apply this directly. Otherwise propose instead.",
      ),
    sessionId: z.string().min(1).describe("Session id."),
    track: trackKindSchema,
    fromStep: z.coerce
      .number()
      .int()
      .min(0)
      .describe("Zero-based step index where the run starts."),
    steps: stepsSchema,
  }),
  run: async ({ confirmApply, ...args }, ctx) => {
    requireAgentConfirm(ctx?.caller, confirmApply, "build the patch with vary-pattern, add-fill or transform");
    return setSteps({
      ...args,
      author: ctx?.caller === "frontend" ? "user" : "agent",
    });
  },
});
