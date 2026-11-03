import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  IconArrowRight,
  IconBolt,
  IconMusic,
  IconPlayerPlayFilled,
  IconSun,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef } from "react";
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
  createdAt?: string;
};

const SEEDS = [
  {
    seed: "lofi",
    label: "Lo-fi",
    blurb: "Dusty drums · minor harmony",
    bpm: 82,
    pattern: [0, 3, 6, 10, 14],
  },
  {
    seed: "house",
    label: "House",
    blurb: "Four to the floor · open hats",
    bpm: 124,
    pattern: [0, 4, 8, 12, 14],
  },
  {
    seed: "empty",
    label: "Blank grid",
    blurb: "Start with one hit",
    bpm: 90,
    pattern: [],
  },
] as const;

export function JamHome() {
  const automationRequested = useRef(false);
  const bandAgentsRequested = useRef(false);
  const navigate = useNavigate();
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
      {
        onError: () => console.error("Unable to initialize bandmate agents."),
      },
    );
  }, [ensureBandAgents]);

  const sessions = data?.sessions ?? [];
  const spark = useMemo(
    () => sessions.find((session) => isSparkSessionName(session.name)),
    [sessions],
  );
  const crate = useMemo(
    () => sessions.filter((session) => session.id !== spark?.id),
    [sessions, spark],
  );
  const createError =
    create.error instanceof Error ? create.error.message : null;

  const start = (seed: (typeof SEEDS)[number]) => {
    create.mutate({
      seed: seed.seed,
      bpm: seed.bpm,
      name: `${seed.label} jam`,
    });
  };

  return (
    <div className="jam-root jam-home">
      <div className="jam-home__inner">
        <header className="jam-home__header">
          <div className="jam-wordmark" aria-label="Jam Session">
            <span className="jam-wordmark__mark">J</span>
            <span>JAM SESSION</span>
          </div>
          <div className="jam-home__heading-row">
            <div>
              <h1>Loop crate</h1>
              <p className="jam-home__subhead">
                Pick up where the groove left off.
              </p>
            </div>
            <span
              className="jam-mono jam-home__count"
              aria-label={`${sessions.length} saved loops`}
            >
              {String(sessions.length).padStart(2, "0")} LOOPS
            </span>
          </div>
        </header>

        <section className="jam-spark" aria-label="Today's spark">
          <div className="jam-spark__label">
            <IconSun size={16} stroke={1.8} />
            <span>TODAY'S SPARK</span>
          </div>
          {isLoading ? (
            <div className="jam-spark__empty" role="status">
              <span className="jam-spark__main">
                <strong>Finding today's spark</strong>
                <span className="jam-spark__eyebrow">
                  Checking the loop crate.
                </span>
              </span>
              <IconSun size={22} stroke={1.5} aria-hidden="true" />
            </div>
          ) : error ? (
            <div className="jam-spark__empty" role="status">
              <span className="jam-spark__main">
                <strong>Today's spark is unavailable</strong>
                <span className="jam-spark__eyebrow">
                  Your saved loops are still below.
                </span>
              </span>
              <IconMusic size={22} stroke={1.5} aria-hidden="true" />
            </div>
          ) : spark ? (
            <Link className="jam-spark__loop" to={`/s/${spark.id}`}>
              <div className="jam-spark__main">
                <span className="jam-spark__eyebrow">A loop to start from</span>
                <strong>{spark.name}</strong>
              </div>
              <span className="jam-mono jam-spark__meta">
                {spark.root} {spark.scale} <i /> {spark.bpm} BPM <i />{" "}
                {spark.bars} bars
              </span>
              <span className="jam-spark__open">
                Open spark <IconArrowRight size={17} />
              </span>
            </Link>
          ) : (
            <div className="jam-spark__empty">
              <span className="jam-spark__main">
                <strong>No spark in the crate yet</strong>
                <span className="jam-spark__eyebrow">
                  Start a loop below and make it yours.
                </span>
              </span>
              <IconMusic size={22} stroke={1.5} aria-hidden="true" />
            </div>
          )}
        </section>

        <section
          className="jam-home__section"
          aria-labelledby="new-loop-heading"
        >
          <div className="jam-section-heading">
            <h2 id="new-loop-heading">New loop</h2>
            <span className="jam-label">CHOOSE A STARTING POCKET</span>
          </div>
          <div className="jam-seeds">
            {SEEDS.map((seed, seedIndex) => (
              <button
                key={seed.seed}
                type="button"
                className="jam-seed"
                data-seed={seed.seed}
                disabled={create.isPending}
                onClick={() => start(seed)}
              >
                <span className="jam-seed__topline">
                  <span className="jam-seed__index">0{seedIndex + 1}</span>
                  <span className="jam-seed__icon">
                    {seed.seed === "empty" ? (
                      <IconMusic size={18} />
                    ) : (
                      <IconBolt size={18} />
                    )}
                  </span>
                </span>
                <span className="jam-seed__title">{seed.label}</span>
                <span className="jam-seed__blurb">{seed.blurb}</span>
                <span className="jam-seed__pattern" aria-hidden="true">
                  {Array.from({ length: 16 }, (_, step) => (
                    <i
                      key={step}
                      data-hit={
                        (seed.pattern as readonly number[]).includes(step)
                          ? "true"
                          : undefined
                      }
                    />
                  ))}
                </span>
                <span className="jam-seed__start">
                  {create.isPending ? "Opening..." : `${seed.bpm} BPM`}
                  <IconPlayerPlayFilled size={13} />
                </span>
              </button>
            ))}
          </div>
          {createError ? (
            <p className="jam-inline-error" role="alert">
              {createError}
            </p>
          ) : null}
        </section>

        <section
          className="jam-home__section jam-crate"
          aria-labelledby="crate-heading"
        >
          <div className="jam-section-heading">
            <h2 id="crate-heading">Your crate</h2>
            <span className="jam-label">RECENTLY TOUCHED</span>
          </div>
          {isLoading ? (
            <div className="jam-crate__loading" aria-label="Loading loops">
              <span />
              <span />
              <span />
            </div>
          ) : error ? (
            <div className="jam-state-row jam-state-row--error" role="alert">
              <span>Could not load your loops.</span>
              <button
                className="jam-text-button"
                type="button"
                onClick={() => void refetch()}
              >
                Try again <IconArrowRight size={14} />
              </button>
            </div>
          ) : crate.length ? (
            <div className="jam-crate__list">
              {crate.map((session, index) => (
                <Link
                  className="jam-crate-row"
                  key={session.id}
                  to={`/s/${session.id}`}
                >
                  <span className="jam-crate-row__index jam-mono">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="jam-crate-row__name">{session.name}</span>
                  <span className="jam-crate-row__meta jam-mono">
                    {session.root} {session.scale} <i /> {session.bpm} BPM <i />{" "}
                    {session.bars} bars
                  </span>
                  <IconArrowRight className="jam-crate-row__arrow" size={17} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="jam-state-row">
              <span>Your next loop starts with one of these pockets.</span>
            </div>
          )}
        </section>

        <Link to="/chat" className="jam-home__chat-link">
          Open bandmate chat <IconArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
