import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { updateTransport } from "../server/sessions/store.js";
import {
  bpmSchema,
  rootSchema,
  scaleSchema,
  swingSchema,
} from "./lib/session-schemas.js";

export default defineAction({
  description:
    "Change a session's transport: BPM, root note, scale, and/or swing. Changes are audible from the next bar, so the loop keeps running.",
  schema: z
    .object({
      id: z.string().min(1).optional().describe("Session id."),
      // Every other jam action names this `sessionId`; generated controls
      // and the agent use that spelling, so accept it here too.
      sessionId: z.string().min(1).optional().describe("Session id (alias of id)."),
      bpm: bpmSchema.optional(),
      root: rootSchema.optional(),
      scale: scaleSchema.optional(),
      swing: swingSchema.optional(),
    })
    .refine((input) => input.id ?? input.sessionId, {
      message: "Provide the session id as `sessionId` (or `id`).",
    }),
  run: async ({ id, sessionId, ...transport }) => {
    return updateTransport((id ?? sessionId)!, transport);
  },
});
