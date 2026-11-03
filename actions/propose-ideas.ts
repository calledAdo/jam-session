import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { proposeIdeas } from "../server/sessions/store.js";
import { ideaSchema } from "./lib/session-schemas.js";

export default defineAction({
  description:
    "Put idea cards in the session's idea tray without touching the grid. Each idea carries a patch in the same {track, fromStep, steps} shape the grid applies; only keep-idea writes it. Set each author to the bandmate voice: 'Drummer' (kick/snare/hat), 'Bassist' (bass), 'Keys' (chords), or 'Bandmate' for mixed ideas, never 'You'. The tray holds up to 6 pending ideas, so propose 3 focused alternatives by default.",
  schema: z.object({
    sessionId: z.string().min(1).describe("Session id."),
    ideas: z
      .array(ideaSchema)
      .min(1)
      .max(6)
      .describe("Idea cards to propose, up to 6 at once."),
  }),
  run: async (args, ctx) => {
    // "You" is the user's own voice in the tray. When the agent proposes, it
    // must never claim that author, so its ideas stay attributable.
    const ideas =
      ctx?.caller === "frontend"
        ? args.ideas
        : args.ideas.map((idea) =>
            /^(you|user)$/i.test(idea.author?.trim() ?? "")
              ? { ...idea, author: "Bandmate" }
              : idea,
          );
    return { ideas: await proposeIdeas({ ...args, ideas }) };
  },
});
