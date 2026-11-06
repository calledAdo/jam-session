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
import addFill from "./add-fill.js";
import setEnergy from "./set-energy.js";
import transform from "./transform.js";
import undoLast from "./undo-last.js";
import updateTransport from "./update-transport.js";
import varyPattern from "./vary-pattern.js";

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

function pattern(detail: { tracks?: SessionDetail["tracks"] }): Pattern {
  if (!detail.tracks) throw new Error("Expected a saved session snapshot");
  return Object.fromEntries(
    detail.tracks.map((t) => [t.kind, t.steps]),
  ) as unknown as Pattern;
}

describe("set-energy", () => {
  it("classifies only explicit dry runs as read-only for framework batching and change events", () => {
    for (const action of [setEnergy, updateTransport]) {
      const effect = action.planMode?.effect;
      expect(typeof effect).toBe("function");
      if (typeof effect !== "function")
        throw new Error("Missing per-call effect");
      const args = {
        sessionId: "test",
        track: "bass" as const,
        level: 0.5,
        bpm: 120,
      };
      expect(effect({ ...args, dryRun: true })).toBe("read");
      expect(effect({ ...args, dryRun: false })).toBe("write");
      expect(effect(args)).toBe("write");
    }
  });

  it.each(["kick", "snare", "hat", "bass"] as const)(
    "dry-runs %s endpoints without changing the session or existing edit rows",
    async (track) => {
      const original = await createSession({ bars: 2, seed: "trap" });
      const sessionId = original.session.id;
      await setEnergy.run(
        { sessionId, track: "bass", level: 0.5 },
        { caller: "frontend" },
      );
      const baseline = await getSession(sessionId);
      const edits = await getEditsForSession(sessionId);
      expect(edits).toHaveLength(1);

      for (const level of [0, 1]) {
        const args = { sessionId, track, level };
        const preview = await setEnergy.run({ ...args, dryRun: true });
        expect(preview).toMatchObject({
          sessionId,
          dryRun: true,
          applied: false,
        });
        expect(preview.patch.length).toBeGreaterThan(0);
        expect(preview).not.toHaveProperty("tracks");
        expect(preview).not.toHaveProperty("ideas");
        expect(await getSession(sessionId)).toEqual(baseline);
        expect(await getEditsForSession(sessionId)).toEqual(edits);

        // A real user change must write exactly the patch that was previewed.
        const written = await setEnergy.run(
          { ...args, dryRun: false },
          { caller: "frontend" },
        );
        expect(written.patch).toEqual(preview.patch);
        expect(pattern(written)).toEqual(
          applyPatch(pattern(baseline), preview.patch),
        );
        expect(await getEditsForSession(sessionId)).toHaveLength(
          edits.length + 1,
        );
        await undoLast.run({ sessionId });
        expect(await getSession(sessionId)).toEqual(baseline);
        expect(await getEditsForSession(sessionId)).toEqual(edits);
      }
    },
  );

  it("dry-runs a no-op and still validates bounds, track, flag and session", async () => {
    const original = await createSession({ bars: 2, seed: "empty" });
    const sessionId = original.session.id;
    const args = { sessionId, track: "bass" as const, level: 0 };
    await setEnergy.run(args);
    const baseline = await getSession(sessionId);
    const edits = await getEditsForSession(sessionId);
    expect(await setEnergy.run({ ...args, dryRun: true })).toMatchObject({
      dryRun: true,
      applied: false,
      patch: [],
    });
    for (const invalid of [
      { track: "keys" },
      { level: -1 },
      { level: 1.1 },
      { dryRun: "invalid" },
      { sessionId: "missing" },
    ]) {
      await expect(
        setEnergy.run({ ...args, dryRun: true, ...invalid } as never),
      ).rejects.toThrow();
    }
    expect(await getSession(sessionId)).toEqual(baseline);
    expect(await getEditsForSession(sessionId)).toEqual(edits);
  });

  it("transport dry-runs preserve all fields and history; normal changes still save", async () => {
    const baseline = await createSession({ bars: 2, seed: "trap" });
    const sessionId = baseline.session.id;
    for (const patch of [
      { bpm: 60, root: "C", scale: "major", swing: 0, kit: "dusty" },
      { bpm: 200, root: "A", scale: "minor", swing: 1, kit: "clean" },
    ] as const) {
      expect(
        await updateTransport.run({ sessionId, ...patch, dryRun: true }),
      ).toMatchObject({
        sessionId,
        dryRun: true,
        applied: false,
        patch,
      });
      expect(await getSession(sessionId)).toEqual(baseline);
      expect(await getEditsForSession(sessionId)).toHaveLength(0);
    }
    await expect(
      updateTransport.run({ sessionId, bpm: -1, dryRun: true }),
    ).rejects.toThrow();
    await expect(
      updateTransport.run({ sessionId: "missing", bpm: 120, dryRun: true }),
    ).rejects.toThrow();
    await expect(
      updateTransport.run({ sessionId, dryRun: true }),
    ).rejects.toThrow();
    await expect(
      updateTransport.run({ sessionId, bpm: 120, dryRun: "invalid" } as never),
    ).rejects.toThrow();
    expect(await getSession(sessionId)).toEqual(baseline);
    await updateTransport.run({ sessionId, bpm: 120 });
    expect((await getSession(sessionId)).session.bpm).toBe(120);
    await updateTransport.run({ id: sessionId, bpm: 130, dryRun: false });
    expect((await getSession(sessionId)).session.bpm).toBe(130);
  });

  it("fill, transform and variation probes already return patches without edit rows", async () => {
    const baseline = await createSession({ bars: 2, seed: "trap" });
    const sessionId = baseline.session.id;
    for (const style of ["roll", "stutter", "drop"] as const) {
      expect(await addFill.run({ sessionId, bar: 1, style })).toHaveProperty(
        "patch",
      );
    }
    for (const mode of ["simplify", "darker", "brighter"] as const) {
      expect(
        await transform.run({
          sessionId,
          selection: { barStart: 0, barEnd: 1 },
          mode,
        }),
      ).toHaveProperty("patch");
    }
    for (const intensity of [0, 1]) {
      expect(
        await varyPattern.run({
          sessionId,
          track: "hat",
          barStart: 0,
          barEnd: 1,
          intensity,
        }),
      ).toHaveProperty("patch");
    }
    expect(await getSession(sessionId)).toEqual(baseline);
    expect(await getEditsForSession(sessionId)).toHaveLength(0);
  });

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
