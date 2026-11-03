import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "../db/index.js";
import * as schema from "../db/schema.js";
import type { DbHandle } from "../db/transaction.js";
import {
  TRACK_KINDS,
  type IdeaStatus,
  type PatchEntry,
  type StepValue,
  type SessionSeed,
  type TrackKind,
} from "./types.js";
import { seedSession } from "../music/index.js";
import {
  assertProgressionInput,
  assertPatchInBounds,
  normalizePatch,
} from "./validation.js";

const MAX_PENDING_IDEAS = 6;

export type Session = typeof schema.sessions.$inferSelect;
export type Track = {
  id: string;
  sessionId: string;
  kind: TrackKind;
  steps: StepValue[];
  muted: boolean;
};
export type Idea = Omit<typeof schema.ideas.$inferSelect, "patchJson"> & {
  patch: PatchEntry[];
};
export type Edit = Omit<
  typeof schema.edits.$inferSelect,
  "patchJson" | "inverseJson"
> & {
  patch: PatchEntry[];
  inverse: PatchEntry[];
};
export type SessionDetail = {
  session: Session;
  tracks: Track[];
  ideas: Idea[];
};

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function inputError(message: string): never {
  throw new Error(message);
}

function parseJsonArray<T>(value: string, label: string): T[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return inputError(`${label} is not an array.`);
    }
    return parsed as T[];
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("is not an array.")) {
      throw error;
    }
    return inputError(`${label} contains invalid JSON.`);
  }
}

function toTrack(row: typeof schema.tracks.$inferSelect): Track {
  return {
    id: row.id,
    sessionId: row.sessionId,
    kind: row.kind as TrackKind,
    steps: parseJsonArray<StepValue>(
      row.stepsJson,
      `Track ${row.kind} steps_json`,
    ),
    muted: row.muted,
  };
}

function toIdea(row: typeof schema.ideas.$inferSelect): Idea {
  return {
    id: row.id,
    sessionId: row.sessionId,
    author: row.author,
    label: row.label,
    rationale: row.rationale,
    status: row.status as IdeaStatus,
    patch: parseJsonArray<PatchEntry>(
      row.patchJson,
      `Idea ${row.id} patch_json`,
    ),
    createdAt: row.createdAt,
  };
}

function toEdit(row: typeof schema.edits.$inferSelect): Edit {
  return {
    id: row.id,
    sessionId: row.sessionId,
    author: row.author,
    patch: parseJsonArray<PatchEntry>(
      row.patchJson,
      `Edit ${row.id} patch_json`,
    ),
    inverse: parseJsonArray<PatchEntry>(
      row.inverseJson,
      `Edit ${row.id} inverse_json`,
    ),
    createdAt: row.createdAt,
  };
}

async function requireSession(
  sessionId: string,
  db: DbHandle,
): Promise<Session> {
  const [session] = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.id, sessionId))
    .limit(1);
  if (!session) inputError(`Session ${sessionId} not found.`);
  return session;
}

async function loadTracks(
  sessionId: string,
  db: DbHandle,
): Promise<Track[]> {
  const rows = await db
    .select()
    .from(schema.tracks)
    .where(eq(schema.tracks.sessionId, sessionId));
  const order = new Map(TRACK_KINDS.map((kind, index) => [kind, index]));
  return rows
    .map(toTrack)
    .sort(
      (left, right) =>
        (order.get(left.kind) ?? 99) - (order.get(right.kind) ?? 99),
    );
}

async function loadPendingIdeas(
  sessionId: string,
  db: DbHandle,
): Promise<Idea[]> {
  const rows = await db
    .select()
    .from(schema.ideas)
    .where(
      and(
        eq(schema.ideas.sessionId, sessionId),
        eq(schema.ideas.status, "pending"),
      ),
    )
    .orderBy(schema.ideas.createdAt, schema.ideas.id);
  return rows.map(toIdea);
}

export async function getSession(
  sessionId: string,
  db: DbHandle = getDb(),
): Promise<SessionDetail> {
  const session = await requireSession(sessionId, db);
  return {
    session,
    tracks: await loadTracks(sessionId, db),
    ideas: await loadPendingIdeas(sessionId, db),
  };
}

export async function listSessions(
  db: DbHandle = getDb(),
): Promise<Session[]> {
  return db
    .select()
    .from(schema.sessions)
    .orderBy(desc(schema.sessions.createdAt), desc(schema.sessions.id));
}

function seededSteps(
  pattern: ReturnType<typeof seedSession>,
  kind: TrackKind,
): StepValue[] {
  return [...pattern[kind]] as StepValue[];
}

export type CreateSessionInput = {
  name?: string | undefined;
  bpm?: number | undefined;
  root?: string | undefined;
  scale?: string | undefined;
  swing?: number | undefined;
  bars?: number | undefined;
  seed?: SessionSeed | undefined;
};

export async function createSession(
  input: CreateSessionInput = {},
  db: DbHandle = getDb(),
): Promise<SessionDetail> {
  const bars = input.bars ?? 8;
  if (!Number.isInteger(bars) || bars < 1 || bars > 16) {
    inputError("bars must be an integer from 1 to 16.");
  }
  const bpm = input.bpm ?? 90;
  if (!Number.isInteger(bpm) || bpm < 40 || bpm > 240) {
    inputError("bpm must be an integer from 40 to 240.");
  }
  const swing = input.swing ?? 0;
  if (!Number.isFinite(swing) || swing < 0 || swing > 1) {
    inputError("swing must be a number from 0 to 1.");
  }

  const sessionId = newId();
  const createdAt = nowIso();
  const name = input.name?.trim() || "Untitled jam";
  const root = input.root?.trim() || "C";
  const scale = input.scale?.trim() || "minor";

  // T01's pure seed library builds deterministic patterns; "empty" is a
  // fully blank grid and lofi/house start from a playable loop.
  const pattern = seedSession(input.seed ?? "lofi", bars);

  await db.transaction(async (tx) => {
    await tx.insert(schema.sessions).values({
      id: sessionId,
      name,
      bpm,
      root,
      scale,
      swing,
      bars,
      createdAt,
    });
    await tx.insert(schema.tracks).values(
      TRACK_KINDS.map((kind) => ({
        id: newId(),
        sessionId,
        kind,
        stepsJson: JSON.stringify(seededSteps(pattern, kind)),
        muted: false,
      })),
    );
  });

  return getSession(sessionId, db);
}

export type UpdateTransportInput = {
  bpm?: number | undefined;
  root?: string | undefined;
  scale?: string | undefined;
  swing?: number | undefined;
};

export async function updateTransport(
  sessionId: string,
  input: UpdateTransportInput,
  db: DbHandle = getDb(),
): Promise<SessionDetail> {
  if (
    input.bpm === undefined &&
    input.root === undefined &&
    input.scale === undefined &&
    input.swing === undefined
  ) {
    inputError("Provide at least one of bpm, root, scale, or swing.");
  }

  const patch: Partial<typeof schema.sessions.$inferInsert> = {};
  if (input.bpm !== undefined) {
    if (!Number.isInteger(input.bpm) || input.bpm < 40 || input.bpm > 240) {
      inputError("bpm must be an integer from 40 to 240.");
    }
    patch.bpm = input.bpm;
  }
  if (input.root !== undefined) {
    const root = input.root.trim();
    if (!/^[A-G](#|b)?$/.test(root)) {
      inputError('root must be a note name like "C", "F#", or "Bb".');
    }
    patch.root = root;
  }
  if (input.scale !== undefined) {
    const scale = input.scale.trim();
    if (!scale) inputError("scale cannot be empty.");
    patch.scale = scale;
  }
  if (input.swing !== undefined) {
    if (
      !Number.isFinite(input.swing) ||
      input.swing < 0 ||
      input.swing > 1
    ) {
      inputError("swing must be a number from 0 to 1.");
    }
    patch.swing = input.swing;
  }

  await requireSession(sessionId, db);
  await db
    .update(schema.sessions)
    .set(patch)
    .where(eq(schema.sessions.id, sessionId));
  return getSession(sessionId, db);
}

type MutableTrack = {
  row: typeof schema.tracks.$inferSelect;
  steps: StepValue[];
};

/**
 * Applies already-validated patch entries to the in-memory track map, writes
 * only the touched rows, and returns the inverse patch in application order.
 */
async function applyEntries(
  tx: DbHandle,
  tracks: Map<TrackKind, MutableTrack>,
  patch: PatchEntry[],
): Promise<PatchEntry[]> {
  const changed = new Map<TrackKind, MutableTrack>();
  const inverse: PatchEntry[] = [];

  for (const entry of patch) {
    const track = tracks.get(entry.track);
    if (!track) {
      inputError(`Track "${entry.track}" does not exist in this session.`);
    }
    const before = track.steps.slice(
      entry.fromStep,
      entry.fromStep + entry.steps.length,
    );
    inverse.push({
      track: entry.track,
      fromStep: entry.fromStep,
      steps: before,
    });
    track.steps.splice(
      entry.fromStep,
      entry.steps.length,
      ...entry.steps,
    );
    changed.set(entry.track, track);
  }

  for (const track of changed.values()) {
    await tx
      .update(schema.tracks)
      .set({ stepsJson: JSON.stringify(track.steps) })
      .where(eq(schema.tracks.id, track.row.id));
  }

  // Apply inverses in reverse order so overlapping entries round-trip.
  return inverse.reverse();
}

function mutableTrackMap(tracks: Track[]): Map<TrackKind, MutableTrack> {
  return new Map(
    tracks.map((track) => [
      track.kind,
      {
        row: {
          id: track.id,
          sessionId: track.sessionId,
          kind: track.kind,
          stepsJson: JSON.stringify(track.steps),
          muted: track.muted,
        },
        steps: [...track.steps],
      },
    ]),
  );
}

export type ApplyPatchInput = {
  sessionId: string;
  patch: unknown;
  author?: string | undefined;
};

/** Applies a patch and records its inverse so undo-last can restore the grid. */
export async function applyPatchToSession(
  input: ApplyPatchInput,
  db: DbHandle = getDb(),
): Promise<SessionDetail> {
  const session = await requireSession(input.sessionId, db);
  const patch = normalizePatch(input.patch, session.bars);
  const author = input.author?.trim() || "user";

  await db.transaction(async (tx) => {
    const tracks = mutableTrackMap(
      await loadTracks(input.sessionId, tx),
    );
    const inverse = await applyEntries(tx, tracks, patch);
    await tx.insert(schema.edits).values({
      id: newId(),
      sessionId: input.sessionId,
      patchJson: JSON.stringify(patch),
      inverseJson: JSON.stringify(inverse),
      author,
      createdAt: nowIso(),
    });
  });

  return getSession(input.sessionId, db);
}

export async function setSteps(
  input: {
    sessionId: string;
    track: TrackKind;
    fromStep: number;
    steps: StepValue[];
    author?: string;
  },
  db: DbHandle = getDb(),
): Promise<SessionDetail> {
  const session = await requireSession(input.sessionId, db);
  const patch = normalizePatch(
    [
      {
        track: input.track,
        fromStep: input.fromStep,
        steps: input.steps,
      },
    ],
    session.bars,
  );
  return applyPatchToSession(
    {
      sessionId: input.sessionId,
      patch,
      author: input.author,
    },
    db,
  );
}

export async function applyProgression(
  input: {
    sessionId: string;
    bars: number[];
    numerals: string[];
    author?: string;
  },
  db: DbHandle = getDb(),
): Promise<SessionDetail> {
  const session = await requireSession(input.sessionId, db);
  assertProgressionInput(input.bars, input.numerals, session.bars);
  const patch: PatchEntry[] = input.bars.map((bar, index) => ({
    track: "keys",
    fromStep: bar,
    steps: [input.numerals[index]!.trim()],
  }));
  return applyPatchToSession(
    {
      sessionId: input.sessionId,
      patch,
      author: input.author,
    },
    db,
  );
}

export type ProposedIdea = {
  author: string;
  label: string;
  rationale: string;
  patch: PatchEntry[];
};

export async function proposeIdeas(
  input: { sessionId: string; ideas: ProposedIdea[] },
  db: DbHandle = getDb(),
): Promise<Idea[]> {
  if (input.ideas.length === 0) inputError("Provide at least one idea.");

  const session = await requireSession(input.sessionId, db);
  const pending = await loadPendingIdeas(input.sessionId, db);
  if (pending.length + input.ideas.length > MAX_PENDING_IDEAS) {
    inputError(
      `The idea tray holds at most ${MAX_PENDING_IDEAS} pending ideas. Keep or toss one first.`,
    );
  }

  const baseTime = Date.now();
  const rows = input.ideas.map((idea, index) => {
    const author = idea.author?.trim();
    const label = idea.label?.trim();
    const rationale = idea.rationale?.trim();
    if (!author) inputError("Every idea needs an author.");
    if (!label) inputError("Every idea needs a label.");
    if (!rationale) inputError("Every idea needs a one-line rationale.");

    const patch = normalizePatch(idea.patch, session.bars);
    return {
      id: newId(),
      sessionId: input.sessionId,
      author,
      label,
      rationale,
      patchJson: JSON.stringify(patch),
      status: "pending" as const,
      // Millisecond offsets keep a proposed batch in the order the agent sent
      // it even though all cards land in the same tick.
      createdAt: new Date(baseTime + index).toISOString(),
    };
  });

  await db.insert(schema.ideas).values(rows);
  return rows.map((row) => toIdea({ ...row, status: "pending" }));
}

async function requireIdea(ideaId: string, db: DbHandle): Promise<Idea> {
  const [row] = await db
    .select()
    .from(schema.ideas)
    .where(eq(schema.ideas.id, ideaId))
    .limit(1);
  if (!row) inputError(`Idea ${ideaId} not found.`);
  return toIdea(row);
}

function tasteSignal(idea: Idea): string {
  return `${idea.label} — ${idea.author}`;
}

export type KeepIdeaResult = SessionDetail & { idea: Idea };

/** Applies an idea's patch, marks it kept, records undo history, logs taste. */
export async function keepIdea(
  ideaId: string,
  db: DbHandle = getDb(),
): Promise<KeepIdeaResult> {
  const kept = await db.transaction(async (tx) => {
    const idea = await requireIdea(ideaId, tx);
    if (idea.status !== "pending") {
      inputError(`Idea "${idea.label}" is already ${idea.status}.`);
    }

    const session = await requireSession(idea.sessionId, tx);
    const patch = normalizePatch(idea.patch, session.bars);
    const tracks = mutableTrackMap(
      await loadTracks(idea.sessionId, tx),
    );
    const inverse = await applyEntries(tx, tracks, patch);

    await tx.insert(schema.edits).values({
      id: newId(),
      sessionId: idea.sessionId,
      patchJson: JSON.stringify(patch),
      inverseJson: JSON.stringify(inverse),
      author: idea.author,
      createdAt: nowIso(),
    });
    await tx
      .update(schema.ideas)
      .set({ status: "kept" })
      .where(eq(schema.ideas.id, idea.id));
    await tx.insert(schema.taste).values({
      id: newId(),
      sessionId: idea.sessionId,
      signal: tasteSignal(idea),
      weight: 1,
      createdAt: nowIso(),
    });

    return { ...idea, status: "kept" as const };
  });

  return { ...(await getSession(kept.sessionId, db)), idea: kept };
}

export type TossIdeaResult = SessionDetail & { idea: Idea };

/** Marks an idea tossed without touching the grid, and logs negative taste. */
export async function tossIdea(
  ideaId: string,
  db: DbHandle = getDb(),
): Promise<TossIdeaResult> {
  const tossed = await db.transaction(async (tx) => {
    const idea = await requireIdea(ideaId, tx);
    if (idea.status !== "pending") {
      inputError(`Idea "${idea.label}" is already ${idea.status}.`);
    }

    await tx
      .update(schema.ideas)
      .set({ status: "tossed" })
      .where(eq(schema.ideas.id, idea.id));
    await tx.insert(schema.taste).values({
      id: newId(),
      sessionId: idea.sessionId,
      signal: tasteSignal(idea),
      weight: -1,
      createdAt: nowIso(),
    });

    return { ...idea, status: "tossed" as const };
  });

  return { ...(await getSession(tossed.sessionId, db)), idea: tossed };
}

export type UndoLastResult = SessionDetail & { undone: Edit };

/** Reverts and removes the most recent applied patch for a session. */
export async function undoLast(
  sessionId: string,
  db: DbHandle = getDb(),
): Promise<UndoLastResult> {
  const undone = await db.transaction(async (tx) => {
    const session = await requireSession(sessionId, tx);
    const [row] = await tx
      .select()
      .from(schema.edits)
      .where(eq(schema.edits.sessionId, sessionId))
      .orderBy(desc(schema.edits.createdAt), desc(schema.edits.id))
      .limit(1);

    if (!row) inputError("Nothing to undo for this session.");

    const edit = toEdit(row);
    const inverse = normalizePatch(edit.inverse, session.bars);
    const tracks = mutableTrackMap(await loadTracks(sessionId, tx));
    await applyEntries(tx, tracks, inverse);
    await tx.delete(schema.edits).where(eq(schema.edits.id, edit.id));

    return edit;
  });

  return { ...(await getSession(sessionId, db)), undone };
}

export async function getTasteForSession(
  sessionId: string,
  db: DbHandle = getDb(),
): Promise<Array<typeof schema.taste.$inferSelect>> {
  return db
    .select()
    .from(schema.taste)
    .where(eq(schema.taste.sessionId, sessionId))
    .orderBy(desc(schema.taste.createdAt));
}

export async function getEditsForSession(
  sessionId: string,
  db: DbHandle = getDb(),
): Promise<Edit[]> {
  const rows = await db
    .select()
    .from(schema.edits)
    .where(eq(schema.edits.sessionId, sessionId))
    .orderBy(schema.edits.createdAt, schema.edits.id);
  return rows.map(toEdit);
}

export async function getIdeasByIds(
  ids: string[],
  db: DbHandle = getDb(),
): Promise<Idea[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(schema.ideas)
    .where(inArray(schema.ideas.id, ids));
  return rows.map(toIdea);
}

// Re-exported for callers that want to pre-validate without touching the DB.
export { assertPatchInBounds };
