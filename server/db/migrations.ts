import { runMigrations } from "@agent-native/core/db";

const JAM_SESSIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS jam_sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bpm INTEGER NOT NULL DEFAULT 90,
  root TEXT NOT NULL DEFAULT 'C',
  scale TEXT NOT NULL DEFAULT 'minor',
  swing DOUBLE PRECISION NOT NULL DEFAULT 0,
  bars INTEGER NOT NULL DEFAULT 8,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jam_sessions_created_at ON jam_sessions (created_at);
`;

/**
 * The full first-revision schema for Jam Session. Kept as one string so tests
 * can build the same schema in an in-memory PGlite database.
 */
export const INITIAL_SCHEMA_SQL = `
${JAM_SESSIONS_TABLE_SQL}
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  muted BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_tracks_session_kind ON tracks (session_id, kind);
CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  author TEXT NOT NULL,
  label TEXT NOT NULL,
  rationale TEXT NOT NULL,
  patch_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ideas_session_status
  ON ideas (session_id, status, created_at);
CREATE TABLE IF NOT EXISTS taste (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  signal TEXT NOT NULL,
  weight INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_taste_created_at ON taste (created_at);
CREATE TABLE IF NOT EXISTS edits (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  patch_json TEXT NOT NULL,
  inverse_json TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_edits_session_created_at
  ON edits (session_id, created_at);
`;

export const EDIT_COMMENTS_SCHEMA_SQL = `
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS edited BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS bar_comments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  bar INTEGER NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  reply TEXT,
  reply_author TEXT,
  idea_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bar_comments_session_bar
  ON bar_comments (session_id, bar, created_at);
`;

export const KIT_SCHEMA_SQL = `
ALTER TABLE jam_sessions ADD COLUMN IF NOT EXISTS kit TEXT NOT NULL DEFAULT 'dusty';
`;

export const sessionMigrations = [
  {
    version: 1,
    name: "jam-session-initial-schema",
    sql: INITIAL_SCHEMA_SQL,
  },
  {
    // The framework owns a `sessions` table (auth). Databases that ran v1
    // before the rename never got our table, so create it explicitly.
    version: 2,
    name: "jam-sessions-table",
    sql: JAM_SESSIONS_TABLE_SQL,
  },
  {
    // F06: per-bar notes plus the "kept after editing" marker on idea cards.
    version: 3,
    name: "bar-comments-and-edited-ideas",
    sql: EDIT_COMMENTS_SCHEMA_SQL,
  },
  { version: 4, name: "session-sound-kit", sql: KIT_SCHEMA_SQL },
];

export const runSessionMigrations = runMigrations(sessionMigrations, {
  table: "jam_session_migrations",
});
