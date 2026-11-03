import { defineAction } from "@agent-native/core/action";
import { readAppState } from "@agent-native/core/application-state";
import { z } from "zod";

import { getSession } from "../server/sessions/store.js";

export default defineAction({
  description:
    "Read what the user is looking at: navigation, the grid selection (bars are 0-based), transport settings, the idea being auditioned, and a summary of the open jam session. Call before acting.",
  schema: z.object({}),
  http: false,
  readOnly: true,
  run: async () => {
    const [navigation, selection, transport, audition] = await Promise.all([
      readAppState("navigation"),
      readAppState("selection"),
      readAppState("transport"),
      readAppState("audition"),
    ]);

    const screen: Record<string, unknown> = {};
    if (navigation) screen.navigation = navigation;
    if (selection) screen.selection = selection;
    if (transport) screen.transport = transport;
    if (audition) screen.audition = audition;

    const nav = navigation as { sessionId?: string } | null;
    const sessionId =
      nav?.sessionId ?? (selection as { sessionId?: string } | null)?.sessionId;
    if (sessionId) {
      try {
        const detail = await getSession(sessionId);
        screen.session = {
          id: detail.session.id,
          name: detail.session.name,
          bars: detail.session.bars,
          pendingIdeas: detail.ideas.length,
        };
      } catch {
        screen.session = { id: sessionId, error: "not found" };
      }
    }

    if (Object.keys(screen).length === 0) {
      return "No application state found. Is the app running?";
    }
    return screen;
  },
});
