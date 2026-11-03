import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { listEdits } from "../server/sessions/store.js";

export default defineAction({
  description:
    "List a jam session's applied grid edits, newest first, including author, patch, inverse, and timestamp.",
  schema: z.object({
    sessionId: z.string().min(1).describe("Session id."),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ sessionId }) => listEdits(sessionId),
});
