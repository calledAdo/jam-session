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
  schema: z.object({
    id: z.string().min(1).describe("Session id."),
    bpm: bpmSchema.optional(),
    root: rootSchema.optional(),
    scale: scaleSchema.optional(),
    swing: swingSchema.optional(),
  }),
  run: async ({ id, ...transport }) => {
    return updateTransport(id, transport);
  },
});
