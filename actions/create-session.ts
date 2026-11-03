import { embedRoute } from "@agent-native/core";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createSession } from "../server/sessions/store.js";
import {
  barsSchema,
  bpmSchema,
  rootSchema,
  scaleSchema,
  seedSchema,
} from "./lib/session-schemas.js";

export default defineAction({
  description:
    "Create a new looping jam session with five empty tracks (kick, snare, hat, bass, keys) and return the full session. Use seed 'empty' for a blank grid; lofi and house select the starting style. Defaults: 90 BPM, C minor, 8 bars.",
  schema: z.object({
    name: z.string().max(80).optional().describe("Session name."),
    bpm: bpmSchema.optional(),
    root: rootSchema.optional(),
    scale: scaleSchema.optional(),
    bars: barsSchema.optional(),
    seed: seedSchema,
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
