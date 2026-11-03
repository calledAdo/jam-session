import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { keepIdea } from "../server/sessions/store.js";

export default defineAction({
  description:
    "Keep an idea from the tray: apply its patch to the grid, mark the card kept, record undo history, and log positive taste for the agent. Use only when the user chooses a card or says to apply it.",
  schema: z.object({
    ideaId: z.string().min(1).describe("Idea card id."),
  }),
  run: async ({ ideaId }) => {
    return keepIdea(ideaId);
  },
});
