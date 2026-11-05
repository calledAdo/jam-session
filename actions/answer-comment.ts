import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { answerComment, MAX_REPLY_LENGTH } from "../server/sessions/store.js";
import { REPLY_AUTHORS } from "../server/sessions/types.js";

export default defineAction({
  description:
    "Answer a bar note in the bandmate's own voice after putting an idea in the tray. Keep the reply to one short first-person sentence and pass the ideaId you just proposed. This never edits the grid.",
  schema: z.object({
    commentId: z.string().min(1).describe("Comment id from the note context."),
    reply: z
      .string()
      .trim()
      .min(1)
      .max(MAX_REPLY_LENGTH)
      .describe(
        `One short first-person reply, e.g. "Got it — I thinned the hats, it's in your tray." Up to ${MAX_REPLY_LENGTH} characters.`,
      ),
    replyAuthor: z
      .enum(REPLY_AUTHORS)
      .describe(
        "Bandmate voice answering: Drummer, Bassist, Keys, or Bandmate.",
      ),
    ideaId: z
      .string()
      .min(1)
      .optional()
      .describe(
        "The idea card proposed in response, so the UI can link to it.",
      ),
  }),
  run: async (args) => {
    return { comment: await answerComment(args) };
  },
});
