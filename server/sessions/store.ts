import { NoWriteError, fail } from "@agent-native/core";
import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "../db/index.js";
import * as schema from "../db/schema.js";
import type { DbHandle } from "../db/transaction.js";
import { SEED_DEFAULTS } from "../music/seed.js";
import { seedSession } from "../music/index.js";
import {
  REPLY_AUTHORS,
  SESSION_KITS,
  type SessionKit,
  TRACK_KINDS,
  type IdeaStatus,
  type PatchEntry,
  type ReplyAuthor,
  type StepValue,
  type SessionSeed,
  type TrackKind,
} from "./types.js";
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
export type BarComment = typeof schema.barComments.$inferSelect;
export type SessionDetail = {
  session: Session;
  tracks: Track[];
  ideas: Idea[];
  comments: BarComment[];
};

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function inputError(message: string): never {
  return fail(message, { statusCode: 400 });
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
    edited: row.edited,
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

async function loadTracks(sessionId: string, db: DbHandle): Promise<Track[]> {
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
  const [tracks, ideas, comments] = await Promise.all([
    loadTracks(sessionId, db),
    loadPendingIdeas(sessionId, db),
    loadComments(sessionId, db),
  ]);
  return { session, tracks, ideas, comments };
}

export async function listSessions(db: DbHandle = getDb()): Promise<Session[]> {
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
  kit?: SessionKit | undefined;
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
  const defaults = SEED_DEFAULTS[input.seed ?? "lofi"];
  const kit = input.kit ?? defaults.kit;
  if (!SESSION_KITS.includes(kit)) inputError("Unknown sound kit.");
  const bpm = input.bpm ?? defaults.bpm;
  if (!Number.isInteger(bpm) || bpm < 40 || bpm > 240) {
    inputError("bpm must be an integer from 40 to 240.");
  }
  const swing = input.swing ?? defaults.swing;
  if (!Number.isFinite(swing) || swing < 0 || swing > 1) {
    inputError("swing must be a number from 0 to 1.");
  }

  const sessionId = newId();
  const createdAt = nowIso();
  const name = input.name?.trim() || "Untitled jam";
  const root = input.root?.trim() || defaults.root;
  const scale = input.scale?.trim() || defaults.scale;

  // T01's pure seed library builds deterministic patterns; "empty" is a
  // fully blank grid and each other vibe starts from a playable loop.
  const pattern = seedSession(input.seed ?? "lofi", bars);

  await db.transaction(async (tx) => {
    await tx.insert(schema.sessions).values({
      id: sessionId,
      name,
      bpm,
      root,
      scale,
      swing,
      kit,
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
  kit?: SessionKit | undefined;
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
    input.swing === undefined &&
    input.kit === undefined
  ) {
    inputError("Provide at least one of bpm, root, scale, swing, or kit.");
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
    if (!Number.isFinite(input.swing) || input.swing < 0 || input.swing > 1) {
      inputError("swing must be a number from 0 to 1.");
    }
    patch.swing = input.swing;
  }

  if (input.kit !== undefined) {
    if (!SESSION_KITS.includes(input.kit)) inputError("Unknown sound kit.");
    patch.kit = input.kit;
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
    track.steps.splice(entry.fromStep, entry.steps.length, ...entry.steps);
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

function removeNoopEntries(patch: PatchEntry[], tracks: Track[]): PatchEntry[] {
  const original = new Map(
    tracks.map((track) => [track.kind, track.steps.slice()]),
  );
  const working = new Map(
    tracks.map((track) => [track.kind, track.steps.slice()]),
  );
  const changedEntries: PatchEntry[] = [];

  for (const entry of patch) {
    const steps = working.get(entry.track);
    if (!steps) {
      inputError(`Track "${entry.track}" does not exist in this session.`);
    }
    if (
      entry.steps.some(
        (value, index) => steps[entry.fromStep + index] !== value,
      )
    ) {
      changedEntries.push(entry);
    }
    steps.splice(entry.fromStep, entry.steps.length, ...entry.steps);
  }

  const changesGrid = TRACK_KINDS.some((track) =>
    original
      .get(track)!
      .some((value, index) => value !== working.get(track)![index]),
  );
  return changesGrid ? changedEntries : [];
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
    const tracks = mutableTrackMap(await loadTracks(input.sessionId, tx));
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
  if (input.ideas.length > MAX_PENDING_IDEAS) {
    inputError(
      `The idea tray holds at most ${MAX_PENDING_IDEAS} pending ideas. Propose fewer at once.`,
    );
  }

  const tracks = await loadTracks(input.sessionId, db);
  const rows = input.ideas.map((idea) => {
    const author = idea.author?.trim();
    const label = idea.label?.trim();
    const rationale = idea.rationale?.trim();
    if (!author) inputError("Every idea needs an author.");
    if (!label) inputError("Every idea needs a label.");
    if (!rationale) inputError("Every idea needs a one-line rationale.");

    const normalized = normalizePatch(idea.patch, session.bars);
    const patch = removeNoopEntries(normalized, tracks);
    if (patch.length === 0) {
      throw new NoWriteError(
        "That idea doesn't change anything — propose something different",
        { errorCode: "no_op_patch", statusCode: 400 },
      );
    }

    return {
      id: newId(),
      sessionId: input.sessionId,
      author,
      label,
      rationale,
      patchJson: JSON.stringify(patch),
      status: "pending" as const,
      edited: false,
      createdAt: "",
    };
  });

  // A full tray never blocks a new idea: the oldest pending cards slide out
  // (tossed without a taste signal, since the user never judged them).
  const overflow = pending.length + input.ideas.length - MAX_PENDING_IDEAS;
  if (overflow > 0) {
    await db
      .update(schema.ideas)
      .set({ status: "tossed" })
      .where(
        inArray(
          schema.ideas.id,
          pending.slice(0, overflow).map((idea) => idea.id),
        ),
      );
  }

  // Keep new ideas strictly after existing ones, even within the same
  // millisecond, so "oldest pending" is well defined.
  const latest = pending.reduce(
    (max, idea) => Math.max(max, Date.parse(idea.createdAt)),
    0,
  );
  const baseTime = Math.max(Date.now(), latest + 1);
  rows.forEach((row, index) => {
    // Millisecond offsets keep a proposed batch in the order the agent sent
    // it even though all cards land in the same tick.
    row.createdAt = new Date(baseTime + index).toISOString();
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

export type KeepIdeaInput = {
  /** Optional client-side draft replacing the card's stored patch. */
  patch?: unknown;
};

/** Applies an idea's patch, marks it kept, records undo history, logs taste. */
export async function keepIdea(
  ideaId: string,
  input: KeepIdeaInput = {},
  db: DbHandle = getDb(),
): Promise<KeepIdeaResult> {
  const edited = input.patch !== undefined;
  const kept = await db.transaction(async (tx) => {
    const idea = await requireIdea(ideaId, tx);
    if (idea.status !== "pending") {
      inputError(`Idea "${idea.label}" is already ${idea.status}.`);
    }

    const session = await requireSession(idea.sessionId, tx);
    const currentTracks = await loadTracks(idea.sessionId, tx);
    const normalized = normalizePatch(
      edited ? input.patch : idea.patch,
      session.bars,
    );
    // An edited draft can contain untouched cells plus the user's tweaks.
    // Drop those no-ops and refuse a draft that leaves the grid alone.
    const patch = edited
      ? removeNoopEntries(normalized, currentTracks)
      : normalized;
    if (patch.length === 0) {
      throw new NoWriteError(
        "That edit doesn't change anything — tweak a cell first",
        { errorCode: "no_op_patch", statusCode: 400 },
      );
    }

    const tracks = mutableTrackMap(currentTracks);
    const inverse = await applyEntries(tx, tracks, patch);
    const author = edited ? `${idea.author} + You` : idea.author;

    await tx.insert(schema.edits).values({
      id: newId(),
      sessionId: idea.sessionId,
      patchJson: JSON.stringify(patch),
      inverseJson: JSON.stringify(inverse),
      author,
      createdAt: nowIso(),
    });
    await tx
      .update(schema.ideas)
      .set(edited ? { status: "kept", edited: true } : { status: "kept" })
      .where(eq(schema.ideas.id, idea.id));

    const now = nowIso();
    const tasteRows = [
      {
        id: newId(),
        sessionId: idea.sessionId,
        signal: tasteSignal(idea),
        weight: 1,
        createdAt: now,
      },
    ];
    if (edited) {
      // A second, explicit signal: the user liked the idea enough to work on
      // it, which is stronger than a straight keep.
      tasteRows.push({
        id: newId(),
        sessionId: idea.sessionId,
        signal: `edited ${idea.label}`,
        weight: 1,
        createdAt: now,
      });
    }
    await tx.insert(schema.taste).values(tasteRows);

    return {
      ...idea,
      status: "kept" as const,
      edited: edited || idea.edited,
    };
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

export async function revertToEdit(
  sessionId: string,
  editId: string,
  author: string = "user",
  db: DbHandle = getDb(),
): Promise<SessionDetail & { revertedTo: Edit; revert: Edit }> {
  const result = await db.transaction(async (tx) => {
    const session = await requireSession(sessionId, tx);
    const rows = await tx
      .select()
      .from(schema.edits)
      .where(eq(schema.edits.sessionId, sessionId))
      .orderBy(desc(schema.edits.createdAt), desc(schema.edits.id));
    const edits = rows.map(toEdit);
    const targetIndex = edits.findIndex((edit) => edit.id === editId);
    if (targetIndex < 0)
      inputError(`Edit ${editId} not found in this session.`);
    if (targetIndex === 0) inputError("The session is already at this edit.");

    const patch = edits
      .slice(0, targetIndex)
      .flatMap((edit) => normalizePatch(edit.inverse, session.bars));
    const tracks = mutableTrackMap(await loadTracks(sessionId, tx));
    const inverse = await applyEntries(tx, tracks, patch);
    const revert: Edit = {
      id: newId(),
      sessionId,
      author,
      patch,
      inverse,
      createdAt: nowIso(),
    };
    await tx.insert(schema.edits).values({
      id: revert.id,
      sessionId,
      patchJson: JSON.stringify(patch),
      inverseJson: JSON.stringify(inverse),
      author: revert.author,
      createdAt: revert.createdAt,
    });
    return { revertedTo: edits[targetIndex]!, revert };
  });

  return { ...(await getSession(sessionId, db)), ...result };
}

export const MAX_COMMENT_LENGTH = 200;
export const MAX_REPLY_LENGTH = 160;

export type AddCommentInput = {
  sessionId: string;
  bar: number;
  text: string;
};

/** Adds a note on one zero-based bar. Notes start open until a bandmate answers. */
export async function addComment(
  input: AddCommentInput,
  db: DbHandle = getDb(),
): Promise<BarComment> {
  const session = await requireSession(input.sessionId, db);
  if (
    !Number.isInteger(input.bar) ||
    input.bar < 0 ||
    input.bar >= session.bars
  ) {
    inputError(
      `Bar ${String(input.bar)} is out of range. Use a zero-based bar from 0 to ${
        session.bars - 1
      }.`,
    );
  }
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!text) inputError("Comment text cannot be empty.");
  if (text.length > MAX_COMMENT_LENGTH) {
    inputError(
      `Comment text must be ${MAX_COMMENT_LENGTH} characters or fewer.`,
    );
  }

  const comment: BarComment = {
    id: newId(),
    sessionId: input.sessionId,
    bar: input.bar,
    text,
    status: "open",
    reply: null,
    replyAuthor: null,
    ideaId: null,
    createdAt: nowIso(),
  };
  await db.insert(schema.barComments).values(comment);
  return comment;
}

export async function listComments(
  sessionId: string,
  db: DbHandle = getDb(),
): Promise<BarComment[]> {
  await requireSession(sessionId, db);
  return loadComments(sessionId, db);
}

async function loadComments(
  sessionId: string,
  db: DbHandle,
): Promise<BarComment[]> {
  return db
    .select()
    .from(schema.barComments)
    .where(eq(schema.barComments.sessionId, sessionId))
    .orderBy(schema.barComments.createdAt, schema.barComments.id);
}

export type AnswerCommentInput = {
  commentId: string;
  reply: string;
  replyAuthor: ReplyAuthor | string;
  ideaId?: string | null | undefined;
};

/** Attaches one bandmate reply (and optional idea card) to an open note. */
export async function answerComment(
  input: AnswerCommentInput,
  db: DbHandle = getDb(),
): Promise<BarComment> {
  const [row] = await db
    .select()
    .from(schema.barComments)
    .where(eq(schema.barComments.id, input.commentId))
    .limit(1);
  if (!row) inputError(`Comment ${input.commentId} not found.`);
  if (row.status !== "open") {
    inputError(`Comment ${row.id} is already ${row.status}.`);
  }

  const reply = typeof input.reply === "string" ? input.reply.trim() : "";
  if (!reply) inputError("Reply text cannot be empty.");
  if (reply.length > MAX_REPLY_LENGTH) {
    inputError(`Reply text must be ${MAX_REPLY_LENGTH} characters or fewer.`);
  }
  if (!(REPLY_AUTHORS as readonly string[]).includes(input.replyAuthor)) {
    inputError(`replyAuthor must be one of: ${REPLY_AUTHORS.join(", ")}.`);
  }

  let ideaId: string | null = null;
  if (input.ideaId !== undefined && input.ideaId !== null) {
    const candidate = input.ideaId.trim();
    if (!candidate) inputError("ideaId cannot be blank.");
    const idea = await requireIdea(candidate, db);
    if (idea.sessionId !== row.sessionId) {
      inputError("That idea belongs to a different session.");
    }
    ideaId = idea.id;
  }

  const updated: BarComment = {
    ...row,
    status: "answered",
    reply,
    replyAuthor: String(input.replyAuthor),
    ideaId,
  };
  const saved = await db
    .update(schema.barComments)
    .set({
      status: updated.status,
      reply: updated.reply,
      replyAuthor: updated.replyAuthor,
      ideaId: updated.ideaId,
    })
    .where(
      and(
        eq(schema.barComments.id, row.id),
        eq(schema.barComments.status, "open"),
      ),
    )
    .returning();
  if (saved.length === 0) inputError(`Comment ${row.id} is already answered.`);
  return saved[0]!;
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

/** Most recent taste signals across all sessions (agent-facing). */
export async function getRecentTaste(
  limit = 30,
  db: DbHandle = getDb(),
): Promise<Array<typeof schema.taste.$inferSelect>> {
  return db
    .select()
    .from(schema.taste)
    .orderBy(desc(schema.taste.createdAt))
    .limit(limit);
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

export async function listEdits(
  sessionId: string,
  db: DbHandle = getDb(),
): Promise<Edit[]> {
  const rows = await db
    .select()
    .from(schema.edits)
    .where(eq(schema.edits.sessionId, sessionId))
    .orderBy(desc(schema.edits.createdAt), desc(schema.edits.id));
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
