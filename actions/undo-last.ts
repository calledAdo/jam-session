import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { undoLast } from "../server/sessions/store.js";

export default defineAction({
  description:
    "Revert the most recent grid edit in a session, including a patch applied by keep-idea. Returns the restored session plus the edit that was undone. Each call walks one step further back in the session's edit history.",
  schema: z.object({
    sessionId: z.string().min(1).describe("Session id."),
  }),
  run: async ({ sessionId }) => {
    return undoLast(sessionId);
  },
});
