import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { INITIAL_SCHEMA_SQL } from "../server/db/migrations.js";
import * as schema from "../server/db/schema.js";
import {
  createSession,
  getSession,
  type SessionDetail,
} from "../server/sessions/store.js";
import proposeVariations from "./propose-variations.js";

vi.mock("../server/db/index.js", () => ({
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

function row(
  detail: SessionDetail,
  kind: "kick" | "snare" | "hat" | "bass" | "keys",
): Array<number | string | null> {
  return detail.tracks.find((track) => track.kind === kind)!.steps;
}

function grid(detail: SessionDetail): string {
  return JSON.stringify(
    detail.tracks.map((track) => [track.kind, track.steps]),
  );
}

describe("propose-variations", () => {
  it("puts three distinct pending ideas in the tray without touching the grid", async () => {
    const before = await createSession({
      name: "Variations",
      bpm: 96,
      root: "F",
      scale: "dorian",
      bars: 4,
      seed: "lofi",
    });
    const gridBefore = grid(before);

    const result = await proposeVariations.run({
      sessionId: before.session.id,
      track: "snare",
      barStart: 0,
      barEnd: 3,
      kind: "vary",
      author: "You",
      count: 3,
    });

    expect(result.ideas).toHaveLength(3);
    expect(result.ideas.every((idea) => idea.status === "pending")).toBe(true);
    expect(result.ideas.every((idea) => idea.author === "You")).toBe(true);
    expect(
      new Set(result.ideas.map((idea) => JSON.stringify(idea.patch))).size,
    ).toBe(3);
    expect(result.ideas.every((idea) => idea.patch.length > 0)).toBe(true);

    const after = await getSession(before.session.id);
    expect(after.ideas).toHaveLength(3);
    expect(grid(after)).toBe(gridBefore);
    expect(row(after, "snare")).toEqual(row(before, "snare"));
  });

  it("builds fills and directional variations on other rows", async () => {
    for (const kind of ["fill", "simplify", "darker", "brighter"] as const) {
      // Each kind gets its own session so the 6-idea tray cap never fills up.
      const session = await createSession({ bars: 4, seed: "house" });
      const result = await proposeVariations.run({
        sessionId: session.session.id,
        track: kind === "fill" ? "hat" : "bass",
        barStart: 0,
        barEnd: 3,
        kind,
        author: "You",
        count: 2,
      });

      expect(result.ideas).toHaveLength(2);
      expect(
        new Set(result.ideas.map((idea) => JSON.stringify(idea.patch))).size,
      ).toBe(2);
    }
  });
});
