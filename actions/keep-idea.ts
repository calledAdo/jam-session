import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { keepIdea } from "../server/sessions/store.js";
import { patchSchema } from "./lib/session-schemas.js";

export default defineAction({
  description:
    "Keep an idea from the tray: apply its patch to the grid, mark the card kept, record undo history, and log positive taste for the agent. Pass patch only when the user edited the card first; that draft replaces the stored patch, the history shows '<author> + You', and a second taste signal is logged. Use only when the user chooses a card or says to apply it.",
  schema: z.object({
    ideaId: z.string().min(1).describe("Idea card id."),
    patch: patchSchema
      .optional()
      .describe(
        "Optional edited draft in the same {track, fromStep, steps} shape as propose-ideas. No-op entries are dropped; a draft that changes nothing is rejected.",
      ),
  }),
  run: async ({ ideaId, patch }) => {
    return keepIdea(ideaId, patch === undefined ? {} : { patch });
  },
});
