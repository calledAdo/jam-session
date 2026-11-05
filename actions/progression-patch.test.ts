import { PGlite } from "@electric-sql/pglite";
import { isNoWriteError } from "@agent-native/core";
import { drizzle } from "drizzle-orm/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EDIT_COMMENTS_SCHEMA_SQL,
  INITIAL_SCHEMA_SQL,
  KIT_SCHEMA_SQL,
} from "../server/db/migrations.js";
import * as schema from "../server/db/schema.js";
import {
  createSession,
  getEditsForSession,
  getSession,
  type SessionDetail,
} from "../server/sessions/store.js";
import progressionPatch from "./progression-patch.js";
import proposeIdeas from "./propose-ideas.js";
import setSteps from "./set-steps.js";

vi.mock("../server/db/index.js", () => ({
  getDb: () => testDb,
}));

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

function grid(detail: SessionDetail): string {
  return JSON.stringify(
    detail.tracks.map((track) => [track.kind, track.steps]),
  );
}

describe("progression-patch", () => {
  it("returns a keys patch without changing the session grid", async () => {
    const before = await createSession({ bars: 4, seed: "empty" });
    const beforeGrid = grid(before);

    const result = await progressionPatch.run({
      sessionId: before.session.id,
      numerals: ["i", "VI", "III"],
      barStart: 1,
    });

    expect(result.patch).toEqual([
      { track: "keys", fromStep: 1, steps: ["i"] },
      { track: "keys", fromStep: 2, steps: ["VI"] },
      { track: "keys", fromStep: 3, steps: ["III"] },
    ]);
    expect(grid(await getSession(before.session.id))).toBe(beforeGrid);
  });

  it("rejects an idea whose patch does not change the current grid", async () => {
    const before = await createSession({ bars: 4, seed: "lofi" });
    const kick = before.tracks.find((track) => track.kind === "kick")!;

    let caught: unknown;
    try {
      await proposeIdeas.run({
        sessionId: before.session.id,
        ideas: [
          {
            author: "Drummer",
            label: "Same kick",
            rationale: "This should be rejected as unchanged.",
            patch: [
              { track: "kick", fromStep: 0, steps: [kick.steps[0]!] },
            ],
          },
        ],
      });
    } catch (error) {
      caught = error;
    }

    expect(isNoWriteError(caught)).toBe(true);
    expect((caught as Error).message).toContain(
      "That idea doesn't change anything — propose something different",
    );
    expect((await getSession(before.session.id)).ideas).toHaveLength(0);
  });

  it("attributes grid edits to the action caller", async () => {
    const session = await createSession({ bars: 2, seed: "empty" });

    await setSteps.run(
      {
        sessionId: session.session.id,
        track: "kick",
        fromStep: 0,
        steps: [3],
      },
      { caller: "frontend" },
    );
    await expect(
      setSteps.run(
        {
          sessionId: session.session.id,
          track: "kick",
          fromStep: 1,
          steps: [2],
        },
        { caller: "tool" },
      ),
    ).rejects.toThrow(/propose-ideas/);
    await setSteps.run(
      {
        sessionId: session.session.id,
        track: "kick",
        fromStep: 1,
        steps: [2],
        confirmApply: true,
      },
      { caller: "tool" },
    );

    const authors = (await getEditsForSession(session.session.id)).map(
      (edit) => edit.author,
    );
    expect(authors).toHaveLength(2);
    expect(authors).toEqual(expect.arrayContaining(["user", "agent"]));
  });
});
