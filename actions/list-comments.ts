import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { listComments } from "../server/sessions/store.js";

export default defineAction({
  description:
    "List a jam session's bar notes oldest first, including open/answered status, the bandmate reply, and any linked idea card. Call this when a bar-note context arrives or before answering a comment.",
  schema: z.object({
    sessionId: z.string().min(1).describe("Session id."),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ sessionId }) => listComments(sessionId),
});
