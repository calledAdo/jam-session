import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { listSessions } from "../server/sessions/store.js";

export default defineAction({
  description:
    "List jam sessions newest first. Use get-session to load the grid and idea tray for one session.",
  schema: z.object({}),
  http: { method: "GET" },
  run: async () => {
    return { sessions: await listSessions() };
  },
});
