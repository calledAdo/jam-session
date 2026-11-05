import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  IconArrowRight,
  IconMusic,
  IconPlus,
  IconSun,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import type { SessionData } from "@/lib/jam/grid";

import { isSparkSessionName } from "../../../server/music/spark";

import "./jam.css";

type SessionRow = {
  id: string;
  name: string;
  bpm: number;
  root: string;
  scale: string;
  bars: number;
  createdAt?: string;
};
const SEEDS = [
  {
    seed: "lofi",
    label: "Chill",
    genre: "lo-fi",
    blurb: "Soft drums and a little rainy-day feeling.",
    bpm: 82,
  },
  {
    seed: "house",
    label: "Dance",
    genre: "house",
    blurb: "A steady beat to get you moving.",
    bpm: 124,
  },
  {
    seed: "empty",
    label: "Empty page",
    genre: "",
    blurb: "Start with silence. Add your first sound.",
    bpm: 90,
  },
] as const;
function mood(scale: string) {
  return scale === "major" ? "Happy" : "Sad";
}

function SketchCard({ session }: { session: SessionRow }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const { data } = useActionQuery(
    "get-session",
    { id: session.id },
    { enabled: visible, staleTime: 60_000 },
  ) as { data: SessionData | undefined };
  const { data: edits } = useActionQuery(
    "list-edits",
    { sessionId: session.id },
    { enabled: visible, staleTime: 60_000 },
  ) as { data: { createdAt: string }[] | undefined };
  const lastEdit = edits?.[0]?.createdAt;
  const date = lastEdit ?? session.createdAt;
  return (
    <Link ref={ref} className="jam-sketch-card" to={`/s/${session.id}`}>
      <div className="jam-sketch-card__heading">
        <h3>{session.name}</h3>
        <IconArrowRight size={18} />
      </div>
      <p>
        {mood(session.scale)} · Speed{" "}
        {session.bpm < 100 ? "slow" : session.bpm < 120 ? "steady" : "fast"}{" "}
        <small>· {session.bpm}</small>
      </p>
      <div
        className="jam-sketch-preview"
        aria-hidden="true"
        data-loaded={!!data}
      >
        {data ? (
          data.tracks.map((track) => (
            <div key={track.kind}>
              {track.steps
                .slice(0, track.kind === "keys" ? 1 : 16)
                .map((value, i) => (
                  <i
                    key={i}
                    data-on={
                      typeof value === "string" ||
                      (typeof value === "number" && value > 0) ||
                      undefined
                    }
                  />
                ))}
            </div>
          ))
        ) : (
          <span />
        )}
      </div>
      {date && (
        <time dateTime={date}>
          {lastEdit ? "Edited" : "Created"}{" "}
          {new Date(date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </time>
      )}
    </Link>
  );
}

export function JamHome() {
  const automationRequested = useRef(false);
  const bandAgentsRequested = useRef(false);
  const navigate = useNavigate();
  const [newOpen, setNewOpen] = useState(false);
  const [limit, setLimit] = useState(12);
  const { data, error, isLoading, refetch } = useActionQuery(
    "list-sessions",
    {},
  ) as {
    data: { sessions: SessionRow[] } | undefined;
    error: unknown;
    isLoading: boolean;
    refetch: () => Promise<unknown>;
  };
  const create = useActionMutation("create-session", {
    onSuccess: (result: { session: { id: string } }) =>
      navigate(`/s/${result.session.id}`),
  });
  const ensureSparkAutomation = useActionMutation("ensure-spark-automation");
  const ensureBandAgents = useActionMutation("ensure-band-agents");
  useEffect(() => {
    if (automationRequested.current) return;
    automationRequested.current = true;
    ensureSparkAutomation.mutate({}, { onError: () => {} });
  }, [ensureSparkAutomation]);
  useEffect(() => {
    if (bandAgentsRequested.current) return;
    bandAgentsRequested.current = true;
    ensureBandAgents.mutate(
      {},
      { onError: () => console.error("Unable to initialize bandmate agents.") },
    );
  }, [ensureBandAgents]);
  const sessions = data?.sessions ?? [];
  const spark = useMemo(
    () => sessions.find((session) => isSparkSessionName(session.name)),
    [sessions],
  );
  const sketches = useMemo(
    () => sessions.filter((session) => session.id !== spark?.id),
    [sessions, spark],
  );
  return (
    <div className="jam-root jam-home">
      <div className="jam-home__inner">
        <header className="jam-home__header">
          <div className="jam-wordmark">
            <span className="jam-wordmark__mark">J</span>JAM SESSION
          </div>
          <h1>Your sketches</h1>
          <p className="jam-home__subhead">
            A sketchbook for producers, with a band in the margins.
          </p>
          <button
            type="button"
            className="jam-primary jam-new-sketch"
            onClick={() => setNewOpen(true)}
          >
            <IconPlus size={21} />
            New sketch
          </button>
        </header>
        <section className="jam-spark" aria-label="Fresh idea for today">
          <div className="jam-spark__label">
            <IconSun size={18} />
            <span>Fresh idea for today</span>
          </div>
          {spark ? (
            <Link className="jam-spark__loop" to={`/s/${spark.id}`}>
              <div className="jam-spark__main">
                <strong>{spark.name}</strong>
                <span className="jam-spark__eyebrow">
                  {mood(spark.scale)} · Speed {spark.bpm}
                </span>
              </div>
              <IconArrowRight size={21} />
            </Link>
          ) : (
            <div className="jam-spark__empty">
              <span>
                {isLoading
                  ? "Finding today's spark…"
                  : error
                    ? "Today's spark is unavailable."
                    : "Your next fresh start is on its way."}
              </span>
              <IconMusic size={22} />
            </div>
          )}
        </section>
        <section className="jam-home__section">
          <div className="jam-section-heading">
            <h2>Pick up a sketch</h2>
            <span>{sketches.length} saved</span>
          </div>
          {isLoading ? (
            <div className="jam-crate__loading" aria-label="Loading sketches">
              <span />
              <span />
              <span />
            </div>
          ) : error ? (
            <div className="jam-state-row" role="alert">
              Could not load your sketches.
              <button
                type="button"
                className="jam-btn"
                onClick={() => void refetch()}
              >
                Try again
              </button>
            </div>
          ) : sketches.length ? (
            <div className="jam-sketch-list">
              {sketches.slice(0, limit).map((session) => (
                <SketchCard key={session.id} session={session} />
              ))}
            </div>
          ) : (
            <p className="jam-state-row">
              An empty page is a good place to start.
            </p>
          )}
          {sketches.length > limit && (
            <button
              type="button"
              className="jam-btn jam-load-more"
              onClick={() => setLimit((n) => n + 12)}
            >
              More sketches
            </button>
          )}
        </section>
        <Link to="/chat" className="jam-home__chat-link">
          Open band chat <IconArrowRight size={16} />
        </Link>
        <Sheet open={newOpen} onOpenChange={setNewOpen}>
          <SheetContent
            side="bottom"
            className="jam-root jam-bottom-sheet jam-new-sheet"
          >
            <SheetTitle>New sketch</SheetTitle>
            <SheetDescription>
              Choose a feeling. Make it yours.
            </SheetDescription>
            <div className="jam-seed-choices">
              {SEEDS.map((seed) => (
                <button
                  key={seed.seed}
                  type="button"
                  className="jam-seed-choice"
                  disabled={create.isPending}
                  onClick={() =>
                    create.mutate({
                      seed: seed.seed,
                      bpm: seed.bpm,
                      name: `${seed.label} sketch`,
                    })
                  }
                >
                  <span>
                    <strong>{seed.label}</strong>
                    {seed.genre && <small> ({seed.genre})</small>}
                    <p>{seed.blurb}</p>
                  </span>
                  <IconArrowRight size={21} />
                </button>
              ))}
            </div>
            {create.isPending && <p role="status">Opening your sketch…</p>}
            {create.error && (
              <p className="jam-inline-error" role="alert">
                {create.error instanceof Error
                  ? create.error.message
                  : "Could not create your sketch. Try again."}
              </p>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
