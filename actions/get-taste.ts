import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { summarizeTaste } from "../server/music/taste.js";
import { getRecentTaste } from "../server/sessions/store.js";

export default defineAction({
  description:
    "Read the user's taste signals from the idea tray: ideas they kept (liked) and tossed (disliked). Read before proposing ideas and avoid what was tossed.",
  schema: z.object({
    limit: z.coerce.number().int().min(1).max(200).default(30),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ limit }) => {
    const rows = await getRecentTaste(limit);
    const kept = rows.filter((r) => r.weight > 0).map((r) => r.signal);
    const tossed = rows.filter((r) => r.weight < 0).map((r) => r.signal);
    const summary = summarizeTaste(rows);
    return { kept, tossed, summary };
  },
});
