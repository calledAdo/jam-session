import {
  boolean,
  index,
  integer,
  now,
  real,
  table,
  text,
} from "@agent-native/core/db/schema";

import { IDEA_STATUSES, SESSION_KITS, TRACK_KINDS } from "../sessions/types.js";

export const sessions = table(
  "jam_sessions",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    bpm: integer("bpm").notNull().default(90),
    root: text("root").notNull().default("C"),
    scale: text("scale").notNull().default("minor"),
    swing: real("swing").notNull().default(0),
    kit: text("kit", { enum: SESSION_KITS }).notNull().default("dusty"),
    bars: integer("bars").notNull().default(8),
    createdAt: text("created_at").notNull().default(now()),
  },
  (session) => [index("idx_sessions_created_at").on(session.createdAt)],
);

export const tracks = table(
  "tracks",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    kind: text("kind", { enum: TRACK_KINDS }).notNull(),
    stepsJson: text("steps_json").notNull(),
    muted: boolean("muted").notNull().default(false),
  },
  (track) => [index("idx_tracks_session_kind").on(track.sessionId, track.kind)],
);

export const ideas = table(
  "ideas",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    author: text("author").notNull(),
    label: text("label").notNull(),
    rationale: text("rationale").notNull(),
    patchJson: text("patch_json").notNull(),
    status: text("status", { enum: IDEA_STATUSES })
      .notNull()
      .default("pending"),
    /** True when the user adjusted the card patch before keeping it. */
    edited: boolean("edited").notNull().default(false),
    createdAt: text("created_at").notNull().default(now()),
  },
  (idea) => [
    index("idx_ideas_session_status").on(
      idea.sessionId,
      idea.status,
      idea.createdAt,
    ),
  ],
);

export const taste = table(
  "taste",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id"),
    signal: text("signal").notNull(),
    weight: integer("weight").notNull(),
    createdAt: text("created_at").notNull().default(now()),
  },
  (entry) => [index("idx_taste_created_at").on(entry.createdAt)],
);

export const barComments = table(
  "bar_comments",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    bar: integer("bar").notNull(),
    text: text("text").notNull(),
    status: text("status").notNull().default("open"),
    reply: text("reply"),
    replyAuthor: text("reply_author"),
    ideaId: text("idea_id"),
    createdAt: text("created_at").notNull().default(now()),
  },
  (comment) => [
    index("idx_bar_comments_session_bar").on(
      comment.sessionId,
      comment.bar,
      comment.createdAt,
    ),
  ],
);

export const edits = table(
  "edits",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    patchJson: text("patch_json").notNull(),
    inverseJson: text("inverse_json").notNull(),
    author: text("author").notNull().default("user"),
    createdAt: text("created_at").notNull().default(now()),
  },
  (edit) => [
    index("idx_edits_session_created_at").on(edit.sessionId, edit.createdAt),
  ],
);

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
export type TrackRow = typeof tracks.$inferSelect;
export type NewTrackRow = typeof tracks.$inferInsert;
export type IdeaRow = typeof ideas.$inferSelect;
export type NewIdeaRow = typeof ideas.$inferInsert;
export type TasteRow = typeof taste.$inferSelect;
export type NewTasteRow = typeof taste.$inferInsert;
export type BarCommentRow = typeof barComments.$inferSelect;
export type NewBarCommentRow = typeof barComments.$inferInsert;
export type EditRow = typeof edits.$inferSelect;
export type NewEditRow = typeof edits.$inferInsert;
