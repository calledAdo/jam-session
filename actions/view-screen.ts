import { defineAction } from "@agent-native/core/action";
import {
  readAppState,
  readAppStateForCurrentTab,
} from "@agent-native/core/application-state";
import { z } from "zod";

import { getSession } from "../server/sessions/store.js";

export default defineAction({
  description:
    "Read what the user is looking at: navigation, the grid selection (bars are 0-based), transport settings, the idea being auditioned, and a summary of the open jam session. Call before acting.",
  schema: z.object({}),
  http: false,
  readOnly: true,
  run: async () => {
    const [navigation, selection, transport, audition, editing] =
      await Promise.all([
        readAppState("navigation"),
        readAppState("selection"),
        readAppState("transport"),
        readAppState("audition"),
        readAppStateForCurrentTab("editing-idea"),
      ]);

    const screen: Record<string, unknown> = {};
    if (navigation) screen.navigation = navigation;
    if (selection) screen.selection = selection;
    if (transport) screen.transport = transport;
    if (audition) screen.audition = audition;
    if (editing) screen.editing = editing;

    const nav = navigation as { sessionId?: string } | null;
    const sessionId =
      nav?.sessionId ?? (selection as { sessionId?: string } | null)?.sessionId;
    if (sessionId) {
      try {
        const detail = await getSession(sessionId);
        screen.transport = {
          ...(transport as Record<string, unknown> | null),
          sessionId,
          bpm: detail.session.bpm,
          root: detail.session.root,
          scale: detail.session.scale,
          swing: detail.session.swing,
          bars: detail.session.bars,
          kit: detail.session.kit,
        };
        screen.session = {
          id: detail.session.id,
          name: detail.session.name,
          bars: detail.session.bars,
          pendingIdeas: detail.ideas.length,
          openComments: detail.comments
            .filter((comment) => comment.status === "open")
            .map(({ id, bar, text }) => ({ id, bar, text })),
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
