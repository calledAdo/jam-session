import { createAgentThreadState } from "@agent-native/agentkit/client";
import { describe, expect, it } from "vitest";

import { authorsForNewIdeas, bandActivityRows } from "./band-moment.js";

describe("authorsForNewIdeas", () => {
  it("matches newly arrived ideas by bandmate author", () => {
    expect(
      authorsForNewIdeas(
        [
          { id: "old", author: "Drummer" },
          { id: "keys", author: "Keys" },
          { id: "other", author: "Bandmate" },
          { id: "bass", author: "Bassist" },
        ],
        new Set(["old"]),
      ),
    ).toEqual(["Bassist", "Keys"]);
  });

  it("returns no authors when only old or non-bandmate ideas are present", () => {
    expect(
      authorsForNewIdeas(
        [
          { id: "old", author: "Drummer" },
          { id: "user", author: "You" },
        ],
        new Set(["old"]),
      ),
    ).toEqual([]);
  });
});

describe("bandActivityRows", () => {
  function runningThread() {
    const thread = createAgentThreadState("jam-thread");
    thread.runs.run = { id: "run", status: "running", lastSequence: 1 };
    thread.activeRunIds = ["run"];
    return thread;
  }

  it("hides ordinary activity while idle, failed or cancelled", () => {
    const thread = runningThread();
    for (const status of ["completed", "failed", "cancelled"] as const) {
      thread.runs.run!.status = status;
      expect(bandActivityRows(thread, { barStart: 0 })).toEqual([]);
    }
    expect(
      bandActivityRows(createAgentThreadState("other"), { barStart: 0 }),
    ).toEqual([]);
  });

  it.each([
    ["vary-pattern", "trying variations"],
    ["add-fill", "writing a fill"],
    ["transform", "changing the mood"],
    ["progression-patch", "picking chords"],
    ["propose-ideas", "writing it up"],
  ])(
    "describes the current %s tool using its actual bar range",
    (name, words) => {
      const thread = runningThread();
      thread.tools.current = {
        id: "current",
        name,
        status: "running",
        runId: "run",
        input: { barStart: 2, barEnd: 3 },
      };
      expect(bandActivityRows(thread, { barStart: 0 })).toEqual([
        { text: `The band is ${words} for bars 3–4…` },
      ]);
    },
  );

  it("ignores running tools from older runs and completed tools", () => {
    const thread = runningThread();
    thread.tools.old = {
      id: "old",
      name: "transform",
      status: "running",
      runId: "previous",
    };
    thread.tools.done = {
      id: "done",
      name: "add-fill",
      status: "completed",
      runId: "run",
    };
    expect(bandActivityRows(thread, { barStart: 2 })).toEqual([
      { text: "The band is working on bar 3…" },
    ]);
  });

  it("hides stale run projections after the controller retires the active run", () => {
    const thread = runningThread();
    thread.activeRunIds = [];
    expect(bandActivityRows(thread, { barStart: 0 })).toEqual([]);
  });

  it("doesn't show the previous team's checkmarks during an ordinary follow-up", () => {
    const thread = runningThread();
    thread.messages.push({
      id: "follow-up",
      role: "user",
      parts: [{ type: "text", text: "Make bar 3 darker" }],
    });
    expect(
      bandActivityRows(thread, {
        team: true,
        done: new Set(["Drummer", "Bassist", "Keys"]),
        barStart: 2,
      }),
    ).toEqual([{ text: "The band is working on bar 3…" }]);
  });

  it("reads nested selection and fill bar without changing 0-based data", () => {
    const thread = runningThread();
    thread.tools.current = {
      id: "current",
      name: "transform",
      status: "running",
      runId: "run",
      input: { selection: { barStart: 5, barEnd: 5 } },
    };
    expect(bandActivityRows(thread, { barStart: 0 })[0]!.text).toContain(
      "bar 6",
    );
    thread.tools.current.input = { bar: 7 };
    expect(bandActivityRows(thread, { barStart: 0 })[0]!.text).toContain(
      "bar 8",
    );
  });

  it("marks only authors whose new ideas actually arrived, not completed tasks", () => {
    const thread = runningThread();
    thread.tasks.keys = {
      id: "keys",
      title: "Keys",
      status: "completed",
      runId: "run",
    };
    thread.events.push({
      type: "task.completed",
      task: thread.tasks.keys,
      id: "event",
      runId: "run",
      threadId: thread.id,
      sequence: 1,
      occurredAt: "2026-11-06T00:00:00Z",
    });
    const rows = bandActivityRows(thread, {
      team: true,
      done: new Set(["Drummer"]),
      barStart: 2,
    });
    expect(rows[0]).toEqual({
      author: "Drummer",
      text: "✓ Drummer has an idea",
      done: true,
    });
    expect(rows[1]!.text).toBe("Bassist is waiting for the band…");
    expect(rows[2]!.text).toBe("Keys finished — waiting for an idea");
    expect(rows[2]!.done).toBeUndefined();
  });

  it("shows live team tasks but excludes tasks before the latest user turn", () => {
    const thread = runningThread();
    thread.messages.push({
      id: "user",
      role: "user",
      parts: [{ type: "text", text: "Unstick me" }],
    });
    thread.tasks.old = { id: "old", title: "Drummer", status: "running" };
    thread.tasks.current = { id: "current", title: "Keys", status: "running" };
    const base = {
      runId: "run",
      threadId: thread.id,
      occurredAt: "2026-11-06T00:00:00Z",
    };
    thread.events.push(
      {
        ...base,
        id: "old",
        sequence: 1,
        type: "task.created",
        task: thread.tasks.old,
      },
      {
        ...base,
        id: "user",
        sequence: 2,
        type: "message.created",
        message: thread.messages[0]!,
      },
      {
        ...base,
        id: "current",
        sequence: 3,
        type: "task.created",
        task: thread.tasks.current,
      },
    );
    const rows = bandActivityRows(thread, { barStart: 2 });
    expect(rows[0]!.text).toBe("Drummer is waiting for the band…");
    expect(rows[2]!.text).toBe("Keys is picking chords for bar 3…");
    thread.tasks.current.status = "failed";
    expect(bandActivityRows(thread, { barStart: 2 })[2]!.text).toContain(
      "couldn't finish",
    );
    thread.runs.run!.status = "cancelled";
    expect(bandActivityRows(thread, { team: true, barStart: 2 })[0]!.text).toBe(
      "Drummer stopped",
    );
  });
});
