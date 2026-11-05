import { embedRoute } from "@agent-native/core";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createSession } from "../server/sessions/store.js";
import {
  barsSchema,
  kitSchema,
  swingSchema,
  bpmSchema,
  rootSchema,
  scaleSchema,
  seedSchema,
} from "./lib/session-schemas.js";

export default defineAction({
  description:
    "Create a jam sketch with five tracks. Vibes: lofi, boombap, trap, house, empty. The vibe supplies BPM, key, swing, and kit unless explicitly overridden. Default: lofi, 8 bars.",
  schema: z.object({
    name: z.string().max(80).optional().describe("Session name."),
    bpm: bpmSchema.optional(),
    root: rootSchema.optional(),
    scale: scaleSchema.optional(),
    bars: barsSchema.optional(),
    seed: seedSchema,
    kit: kitSchema.optional(),
    swing: swingSchema.optional(),
  }),
  run: async (args) => {
    return createSession(args);
  },

  // Deep link (/s/:id) that is also the inline MCP App embed target.
  ...embedRoute({
    title: "Jam session",
    openLabel: "Open in Jam Session",
    height: 640,
    path: ({ result }) => ({
      label: "Open jam session",
      url: `/s/${encodeURIComponent(String((result as { session: { id: string } }).session.id))}`,
    }),
  }),
});
