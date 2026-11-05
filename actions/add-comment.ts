import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { addComment, MAX_COMMENT_LENGTH } from "../server/sessions/store.js";

export default defineAction({
  description:
    "Leave a note on one bar of a jam session. The UI opens this from a bar tab; the user types what feels wrong and the note waits for a bandmate reply. Bars are zero-based; the UI shows them one-based.",
  schema: z.object({
    sessionId: z.string().min(1).describe("Session id."),
    bar: z.coerce
      .number()
      .int()
      .min(0)
      .describe("Zero-based bar index the note points at."),
    text: z
      .string()
      .trim()
      .min(1)
      .max(MAX_COMMENT_LENGTH)
      .describe(`The note, up to ${MAX_COMMENT_LENGTH} characters.`),
  }),
  run: async (args) => {
    return { comment: await addComment(args) };
  },
});
