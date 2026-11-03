import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { revertToEdit } from "../server/sessions/store.js";

export default defineAction({
  description:
    "Restore a jam session to the state immediately after a selected edit by applying inverses of all newer edits. This records a new edit and keeps the history intact.",
  schema: z.object({
    sessionId: z.string().min(1).describe("Session id."),
    editId: z.string().min(1).describe("Edit id to restore the session to."),
  }),
  run: async ({ sessionId, editId }, ctx) =>
    revertToEdit(
      sessionId,
      editId,
      ctx?.caller === "frontend" ? "user" : "agent",
    ),
});
