import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EDIT_COMMENTS_SCHEMA_SQL,
  INITIAL_SCHEMA_SQL,
  KIT_SCHEMA_SQL,
} from "../server/db/migrations.js";
import * as schema from "../server/db/schema.js";
import { applyPatch, type Pattern } from "../server/music/index.js";
import {
  createSession,
  getEditsForSession,
  getSession,
  type SessionDetail,
} from "../server/sessions/store.js";
import setEnergy from "./set-energy.js";
import undoLast from "./undo-last.js";

vi.mock("../server/db/index.js", () => ({ getDb: () => testDb }));

let client: PGlite;
let testDb: PgliteDatabase<typeof schema>;

beforeEach(async () => {
  client = new PGlite();
  await client.exec(INITIAL_SCHEMA_SQL);
  await client.exec(EDIT_COMMENTS_SCHEMA_SQL);
  await client.exec(KIT_SCHEMA_SQL);
  testDb = drizzle(client, { schema });
});
afterEach(async () => {
  await client.close();
});

function pattern(detail: SessionDetail): Pattern {
  return Object.fromEntries(
    detail.tracks.map((t) => [t.kind, t.steps]),
  ) as unknown as Pattern;
}

describe("set-energy", () => {
  it("persists bass at 0, 0.5, and 1; undo restores each prior grid", async () => {
    const original = await createSession({ bars: 2, seed: "lofi" });
    const sessionId = original.session.id;
    const snapshots = [pattern(original)];
    for (const level of [0, 0.5, 1]) {
      const before = snapshots.at(-1)!;
      const result = await setEnergy.run({ sessionId, track: "bass", level });
      expect(result.applied).toBe(true);
      expect(result.patch.every((entry) => entry.track === "bass")).toBe(true);
      const saved = pattern(await getSession(sessionId));
      expect(saved).toEqual(applyPatch(before, result.patch));
      for (const track of ["kick", "snare", "hat", "keys"] as const) {
        expect(saved[track]).toEqual(before[track]);
      }
      if (level === 0)
        expect(saved.bass.filter((n) => n !== null)).toEqual([1, 6]);
      if (level === 0.5) {
        saved.kick.forEach((hit, i) =>
          expect(saved.bass[i] !== null).toBe(hit > 0 || i % 16 === 0),
        );
      }
      if (level === 1)
        expect(saved.bass.every((n) => Number.isInteger(n))).toBe(true);
      snapshots.push(saved);
    }
    const edits = await getEditsForSession(sessionId);
    expect(edits).toHaveLength(3);
    expect(edits.every((edit) => edit.author === "agent")).toBe(true);

    for (let index = snapshots.length - 2; index >= 0; index--) {
      await undoLast.run({ sessionId });
      expect(pattern(await getSession(sessionId))).toEqual(snapshots[index]);
    }
    expect(await getEditsForSession(sessionId)).toHaveLength(0);
  });

  it("attributes frontend bass controls to user and skips repeated no-op writes", async () => {
    const original = await createSession({ bars: 2, seed: "empty" });
    const args = {
      sessionId: original.session.id,
      track: "bass" as const,
      level: 0.5,
    };
    await setEnergy.run(args, { caller: "frontend" });
    expect(
      (await getEditsForSession(args.sessionId)).map((e) => e.author),
    ).toEqual(["user"]);
    const repeated = await setEnergy.run(args, { caller: "frontend" });
    expect(repeated).toMatchObject({ applied: false, patch: [] });
    expect(await getEditsForSession(args.sessionId)).toHaveLength(1);
    await undoLast.run({ sessionId: args.sessionId });
    expect(pattern(await getSession(args.sessionId))).toEqual(
      pattern(original),
    );
  });

  it("validates supported tracks and energy bounds before writing", async () => {
    const original = await createSession({ bars: 2, seed: "empty" });
    for (const args of [
      { track: "keys", level: 0.5 },
      { track: "bass", level: -1 },
      { track: "bass", level: 1.1 },
    ]) {
      await expect(
        setEnergy.run({ sessionId: original.session.id, ...args } as never),
      ).rejects.toThrow();
    }
    expect(await getEditsForSession(original.session.id)).toHaveLength(0);
  });

  it.each(["kick", "snare", "hat"] as const)(
    "preserves %s drum behavior",
    async (track) => {
      const original = await createSession({ bars: 2, seed: "empty" });
      const result = await setEnergy.run({
        sessionId: original.session.id,
        track,
        level: 0,
      });
      expect(pattern(result)[track].slice(0, 16)).toEqual([
        3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0,
      ]);
    },
  );
});
