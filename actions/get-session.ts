import { embedRoute } from "@agent-native/core";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getSession } from "../server/sessions/store.js";

export default defineAction({
  description:
    "Read one jam session: transport settings, all five track rows with their current step arrays, and the pending idea cards. Call this before editing so suggestions fit the actual grid.",
  schema: z.object({
    id: z.string().min(1).describe("Session id."),
  }),
  http: { method: "GET" },
  run: async ({ id }) => {
    return getSession(id);
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
