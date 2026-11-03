import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { tossIdea } from "../server/sessions/store.js";

export default defineAction({
  description:
    "Toss an idea from the tray. The grid is untouched, the card is marked tossed, and negative taste is logged so the agent learns what to avoid.",
  schema: z.object({
    ideaId: z.string().min(1).describe("Idea card id."),
  }),
  run: async ({ ideaId }) => {
    return tossIdea(ideaId);
  },
});
