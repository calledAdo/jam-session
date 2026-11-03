import { useEffect, useRef } from "react";
import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { Link, useNavigate } from "react-router";

import { isSparkSessionName } from "../../../server/music/spark";

import "./jam.css";

type SessionRow = {
  id: string;
  name: string;
  bpm: number;
  root: string;
  scale: string;
  bars: number;
};

const SEEDS = [
  { seed: "lofi", label: "Lo-fi", blurb: "Dusty swung drums, minor chords", bpm: 82 },
  { seed: "house", label: "House", blurb: "Four on the floor, offbeat hats", bpm: 124 },
  { seed: "empty", label: "Empty", blurb: "A blank grid", bpm: 90 },
] as const;

export function JamHome() {
  const automationRequested = useRef(false);
  const navigate = useNavigate();
  const { data } = useActionQuery("list-sessions", {}) as {
    data: { sessions: SessionRow[] } | undefined;
  };
  const create = useActionMutation("create-session", {
    onSuccess: (result: { session: { id: string } }) =>
      navigate(`/s/${result.session.id}`),
  });
  const ensureSparkAutomation = useActionMutation("ensure-spark-automation");

  useEffect(() => {
    if (automationRequested.current) return;
    automationRequested.current = true;
    ensureSparkAutomation.mutate({}, { onError: () => {} });
  }, [ensureSparkAutomation]);

  return (
    <div className="jam-root p-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jam Session</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--jam-dim)" }}>
            An AI bandmate for when you are stuck. You and the agent edit the same loop.
          </p>
        </div>

        <div>
          <div className="jam-label mb-2">New jam</div>
          <div className="grid gap-3 sm:grid-cols-3">
            {SEEDS.map((s) => (
              <button
                key={s.seed}
                type="button"
                className="jam-panel p-4 text-left"
                style={{ cursor: "pointer" }}
                disabled={create.isPending}
                onClick={() =>
                  create.mutate({
                    seed: s.seed,
                    bpm: s.bpm,
                    name: `${s.label} jam`,
                  })
                }
              >
                <div className="text-lg font-semibold">{s.label}</div>
                <div className="mt-1 text-xs" style={{ color: "var(--jam-dim)" }}>
                  {s.blurb}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="jam-label mb-2">Your jams</div>
          {data?.sessions.length ? (
            <div className="flex flex-col gap-2">
              {data.sessions.map((s) => (
                <Link
                  key={s.id}
                  to={`/s/${s.id}`}
                  className="jam-panel flex items-center justify-between px-4 py-3"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <span className="font-semibold">
                    {isSparkSessionName(s.name) ? "☀️ " : ""}
                    {s.name}
                  </span>
                  <span className="jam-mono text-xs" style={{ color: "var(--jam-dim)" }}>
                    {s.bpm} BPM - {s.root} {s.scale} - {s.bars} bars
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--jam-dim)" }}>
              No jams yet. Start one above.
            </p>
          )}
        </div>

        <Link to="/chat" className="jam-label" style={{ textDecoration: "none" }}>
          Open agent chat
        </Link>
      </div>
    </div>
  );
}
