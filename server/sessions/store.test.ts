import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { INITIAL_SCHEMA_SQL } from "../db/migrations.js";
import * as schema from "../db/schema.js";
import {
  applyProgression,
  createSession,
  getEditsForSession,
  getIdeasByIds,
  getSession,
  getTasteForSession,
  keepIdea,
  listSessions,
  proposeIdeas,
  setSteps,
  tossIdea,
  undoLast,
  updateTransport,
} from "./store.js";

vi.mock("../db/index.js", () => ({
  getDb: () => testDb,
}));

let client: PGlite;
let testDb: PgliteDatabase<typeof schema>;

beforeEach(async () => {
  client = new PGlite();
  await client.exec(INITIAL_SCHEMA_SQL);
  testDb = drizzle(client, { schema });
});

afterEach(async () => {
  await client.close();
});

function kickSteps(
  detail: Awaited<ReturnType<typeof getSession>>,
): Array<number | string | null> {
  return detail.tracks.find((track) => track.kind === "kick")!.steps;
}

function keysSteps(
  detail: Awaited<ReturnType<typeof getSession>>,
): Array<number | string | null> {
  return detail.tracks.find((track) => track.kind === "keys")!.steps;
}

describe("jam session store", () => {
  it("creates a session with all five tracks", async () => {
    const detail = await createSession({
      name: "  2am loop  ",
      bpm: 96,
      root: "F",
      scale: "dorian",
      bars: 4,
      seed: "empty",
    });

    expect(detail.session).toMatchObject({
      name: "2am loop",
      bpm: 96,
      root: "F",
      scale: "dorian",
      swing: 0,
      bars: 4,
    });
    expect(detail.tracks.map((track) => track.kind)).toEqual([
      "kick",
      "snare",
      "hat",
      "bass",
      "keys",
    ]);
    expect(detail.tracks.find((track) => track.kind === "kick")!.steps).toEqual(
      Array(64).fill(0),
    );
    expect(detail.tracks.find((track) => track.kind === "bass")!.steps).toEqual(
      Array(64).fill(null),
    );
    expect(keysSteps(detail)).toEqual(["", "", "", ""]);
    expect(detail.ideas).toEqual([]);

    const sessions = await listSessions();
    expect(sessions.map((session) => session.id)).toContain(detail.session.id);
  });

  it("seeds lofi and house sessions through the music library", async () => {
    const lofi = await createSession({ bars: 4, seed: "lofi" });
    expect(kickSteps(lofi).some((value) => Number(value) > 0)).toBe(true);
    expect(keysSteps(lofi)).toEqual(["i", "VI", "iv", "v"]);

    const house = await createSession({ bars: 4, seed: "house" });
    expect(keysSteps(house)).toEqual(["i", "VI", "III", "VII"]);

    const empty = await createSession({ bars: 4, seed: "empty" });
    expect(kickSteps(empty).every((value) => value === 0)).toBe(true);
  });

  it("updates transport fields without restarting the session", async () => {
    const detail = await createSession({ name: "Transport" });
    const updated = await updateTransport(detail.session.id, {
      bpm: 124,
      root: "Bb",
      scale: "major",
      swing: 0.28,
    });

    expect(updated.session).toMatchObject({
      bpm: 124,
      root: "Bb",
      scale: "major",
      swing: 0.28,
    });

    await expect(
      updateTransport(detail.session.id, { bpm: 10 }),
    ).rejects.toThrow(/40 to 240/);
  });

  it("writes steps, records an inverse, and undoes back to the previous grid", async () => {
    const detail = await createSession({ bars: 2, seed: "empty" });
    const sessionId = detail.session.id;

    const edited = await setSteps({
      sessionId,
      track: "kick",
      fromStep: 0,
      steps: [3, 0, 0, 1],
    });
    expect(kickSteps(edited).slice(0, 4)).toEqual([3, 0, 0, 1]);

    const history = await getEditsForSession(sessionId);
    expect(history).toHaveLength(1);
    expect(history[0]!.author).toBe("user");
    expect(history[0]!.inverse).toEqual([
      { track: "kick", fromStep: 0, steps: [0, 0, 0, 0] },
    ]);

    const undone = await undoLast(sessionId);
    expect(kickSteps(undone).slice(0, 4)).toEqual([0, 0, 0, 0]);
    expect(undone.undone.patch).toEqual([
      { track: "kick", fromStep: 0, steps: [3, 0, 0, 1] },
    ]);
    expect(await getEditsForSession(sessionId)).toEqual([]);

    await expect(undoLast(sessionId)).rejects.toThrow(/Nothing to undo/);
  });

  it("applies a keys progression and undoes it", async () => {
    const detail = await createSession({ bars: 4, seed: "empty" });
    const sessionId = detail.session.id;

    const progressed = await applyProgression({
      sessionId,
      bars: [1, 2],
      numerals: ["VI", "iv"],
    });
    expect(keysSteps(progressed)).toEqual(["", "VI", "iv", ""]);

    const undone = await undoLast(sessionId);
    expect(keysSteps(undone)).toEqual(["", "", "", ""]);
  });

  it("proposes three ideas, keeps one, and undoes the kept patch", async () => {
    const detail = await createSession({ bars: 2, seed: "empty" });
    const sessionId = detail.session.id;

    await setSteps({
      sessionId,
      track: "kick",
      fromStep: 0,
      steps: [3, 0, 0, 1],
    });

    const proposed = await proposeIdeas({
      sessionId,
      ideas: [
        {
          author: "Drummer",
          label: "Drop the kick in bar 2",
          rationale: "Leaving the downbeat empty makes the loop breathe.",
          patch: [{ track: "kick", fromStep: 0, steps: [0, 0, 2, 0] }],
        },
        {
          author: "Bassist",
          label: "Walk up to the fifth",
          rationale: "A small lift into bar 2 keeps the bass moving.",
          patch: [{ track: "bass", fromStep: 0, steps: [0, null, 4, null] }],
        },
        {
          author: "Keys",
          label: "Swap in a darker chord",
          rationale: "The minor iv adds shade without leaving the key.",
          patch: [{ track: "keys", fromStep: 1, steps: ["iv"] }],
        },
      ],
    });

    expect(proposed).toHaveLength(3);
    expect((await getSession(sessionId)).ideas).toHaveLength(3);

    const kept = await keepIdea(proposed[0]!.id);
    expect(kept.idea.status).toBe("kept");
    expect(kept.ideas).toHaveLength(2);
    expect(kickSteps(kept).slice(0, 4)).toEqual([0, 0, 2, 0]);

    const tasteRows = await getTasteForSession(sessionId);
    expect(tasteRows).toHaveLength(1);
    expect(tasteRows[0]!.weight).toBe(1);
    expect(tasteRows[0]!.signal).toContain("Drop the kick in bar 2");
    expect(tasteRows[0]!.signal).toContain("Drummer");

    expect(await getEditsForSession(sessionId)).toHaveLength(2);

    const undone = await undoLast(sessionId);
    expect(kickSteps(undone).slice(0, 4)).toEqual([3, 0, 0, 1]);
    expect(undone.undone.author).toBe("Drummer");
    expect(undone.undone.patch).toEqual([
      { track: "kick", fromStep: 0, steps: [0, 0, 2, 0] },
    ]);
    expect(await getEditsForSession(sessionId)).toHaveLength(1);

    const [storedIdea] = await getIdeasByIds([proposed[0]!.id]);
    expect(storedIdea?.status).toBe("kept");
  });

  it("tosses an idea without changing the grid and logs negative taste", async () => {
    const detail = await createSession({ bars: 2, seed: "empty" });
    const sessionId = detail.session.id;
    await setSteps({
      sessionId,
      track: "hat",
      fromStep: 0,
      steps: [2, 0, 0, 0],
    });
    const before = await getSession(sessionId);

    const [idea] = await proposeIdeas({
      sessionId,
      ideas: [
        {
          author: "Drummer",
          label: "Trap hats",
          rationale: "Fast hats add energy.",
          patch: [{ track: "hat", fromStep: 0, steps: [3, 3, 3, 3] }],
        },
      ],
    });

    const tossed = await tossIdea(idea!.id);
    expect(tossed.idea.status).toBe("tossed");
    expect(tossed.ideas).toEqual([]);
    expect(tossed.tracks).toEqual(before.tracks);

    const tasteRows = await getTasteForSession(sessionId);
    expect(tasteRows[0]!.weight).toBe(-1);
    expect(tasteRows[0]!.signal).toContain("Trap hats");
    expect(await getEditsForSession(sessionId)).toHaveLength(1);

    await expect(keepIdea(idea!.id)).rejects.toThrow(/already tossed/);
  });

  it("rejects invalid edits and slides the oldest idea out of a full tray", async () => {
    const detail = await createSession({ bars: 1, seed: "empty" });
    const sessionId = detail.session.id;

    await expect(
      setSteps({
        sessionId,
        track: "kick",
        fromStep: 0,
        steps: [4],
      }),
    ).rejects.toThrow(/velocities/);

    await expect(
      setSteps({
        sessionId,
        track: "kick",
        fromStep: 15,
        steps: [1, 1],
      }),
    ).rejects.toThrow(/past the end/);

    for (let index = 0; index < 6; index += 1) {
      await proposeIdeas({
        sessionId,
        ideas: [
          {
            author: "Drummer",
            label: `Idea ${index}`,
            rationale: "Because.",
            patch: [{ track: "kick", fromStep: 0, steps: [1] }],
          },
        ],
      });
    }

    await expect(
      proposeIdeas({
        sessionId,
        ideas: [
          {
            author: "Drummer",
            label: "One too many",
            rationale: "Tray is full.",
            patch: [{ track: "kick", fromStep: 0, steps: [1] }],
          },
        ],
      }),
    ).resolves.toHaveLength(1);

    const tray = await getSession(sessionId);
    expect(tray.ideas.map((idea) => idea.label)).not.toContain("Idea 0");
    expect(tray.ideas).toHaveLength(6);
  });
});
