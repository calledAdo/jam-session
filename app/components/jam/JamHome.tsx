import { sendToAgentChatAndConfirm } from "@agent-native/core/client/agent-chat";
import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { AgentPanel } from "@agent-native/toolkit/app/chat";
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
import { TAB_ID } from "@/lib/tab-id";

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
    blurb: "Chill chords and soft, dusty drums.",
  },
  {
    seed: "boombap",
    label: "Hip-hop",
    blurb: "Boom-bap drums with a head-nod bounce.",
  },
  { seed: "trap", label: "Trap", blurb: "Deep 808s and rolling hats." },
  {
    seed: "house",
    label: "House",
    blurb: "Four on the floor to get you moving.",
  },
  {
    seed: "empty",
    label: "Empty page",
    blurb: "Start with silence. Add your first sound.",
  },
] as const;
function mood(scale: string) {
  return scale === "major" ? "Happy" : "Sad";
}

function SketchCard({ session }: { session: SessionRow }) {
  const date = session.createdAt;
  return (
    <Link className="jam-sketch-card" to={`/s/${session.id}`}>
      <div className="jam-sketch-card__heading">
        <h3>{session.name}</h3>
        <IconArrowRight size={18} />
      </div>
      <p>
        {mood(session.scale)} · Speed{" "}
        {session.bpm < 100 ? "slow" : session.bpm < 120 ? "steady" : "fast"}{" "}
        <small>· {session.bpm}</small>
      </p>
      <span className="jam-sketch-meta">
        {session.root} {mood(session.scale)} · {session.bars} bars
      </span>
      {date && (
        <time dateTime={date}>
          Created{" "}
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
  const [name, setName] = useState("");
  const [seed, setSeed] = useState<(typeof SEEDS)[number]["seed"]>("lofi");
  const [bars, setBars] = useState(8);
  const [search, setSearch] = useState("");
  const [describing, setDescribing] = useState(false);
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [describeError, setDescribeError] = useState("");
  const describeToStart = async () => {
    if (!description.trim() || sending) return;
    setSending(true);
    setDescribeError("");
    setNewOpen(false);
    setDescribing(true);
    try {
      const delivery = await sendToAgentChatAndConfirm({
        message: description.trim(),
        context:
          "Start a NEW Jam Session sketch from this description. Pick the closest vibe (lofi, boombap, trap, house, empty) and kit (dusty, boombap, 808, clean). Call create-session with seed and kit; keep the vibe's default transport unless the user specifies otherwise. Read get-taste, then use read-only generators and propose-ideas for three distinct, non-no-op ideas authored by the right bandmates. Do not apply ideas. Call navigate with path /s/<created session id> to open the new session. Follow the Jam starter workflow.",
        submit: true,
        openSidebar: false,
        chatTarget: "local",
      });
      if (!delivery.delivered)
        throw new Error("Open band chat to connect AI, then try again.");
      setDescription("");
    } catch (cause) {
      setDescribeError(
        cause instanceof Error
          ? cause.message
          : "Could not reach the band. Try again.",
      );
      setDescribing(false);
      setNewOpen(true);
    } finally {
      setSending(false);
    }
  };
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
    () =>
      sessions.filter(
        (session) =>
          session.id !== spark?.id &&
          session.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [sessions, spark, search],
  );
  return (
    <div className="jam-root jam-home">
      <div className="jam-home__inner">
        <header className="jam-home__header">
          <div className="jam-wordmark">
            <span className="jam-wordmark__mark">J</span>JAM SESSION
          </div>
          <h1>Pick up a sketch.</h1>
          <p className="jam-home__subhead">A little room for your next idea.</p>
          <button
            type="button"
            className="jam-primary jam-new-sketch"
            onClick={() => setNewOpen(true)}
          >
            <IconPlus size={21} />
            New sketch
          </button>
        </header>
        <section className="jam-spark" aria-label="Daily spark">
          <div className="jam-spark__label">
            <IconSun size={18} />
            <span>Daily spark</span>
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
            <h2>Your sketches</h2>
            <span>{sketches.length} saved</span>
          </div>
          <input
            className="jam-input jam-sketch-search"
            aria-label="Find a sketch"
            placeholder="Find a sketch…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
              {search
                ? `No sketches match “${search}”.`
                : "A few hits are enough to start."}
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
        <Link to="/settings" className="jam-home__settings">
          Settings & connections
        </Link>
        {describing && (
          <div className="jam-starter-band">
            <button className="jam-btn" onClick={() => setDescribing(false)}>
              Back to sketches
            </button>
            <AgentPanel
              storageKey="jam-starter"
              browserTabId={TAB_ID}
              chatOnly
              showHeader={false}
              dynamicSuggestions={false}
              showPageHeader={false}
              showTabBar={false}
              showCollapseButton={false}
              composerAutoFocus={false}
              emptyStateText="Describe your next sketch."
              composerPlaceholder="Something slow and rainy…"
            />
          </div>
        )}
        <Sheet open={newOpen} onOpenChange={setNewOpen}>
          <SheetContent
            side="bottom"
            className="jam-root jam-bottom-sheet jam-new-sheet"
          >
            <SheetTitle>New sketch</SheetTitle>
            <SheetDescription>
              Choose a feeling. Make it yours.
            </SheetDescription>
            <label className="jam-new-name">
              Name <span>optional</span>
              <input
                className="jam-input"
                placeholder="Untitled jam"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <h3 className="jam-feel-label">Pick a feel</h3>
            <div className="jam-seed-choices">
              {SEEDS.map((choice) => (
                <button
                  key={choice.seed}
                  type="button"
                  className="jam-seed-choice"
                  aria-pressed={seed === choice.seed}
                  disabled={create.isPending || sending}
                  onClick={() => setSeed(choice.seed)}
                >
                  <span>
                    <strong>{choice.label}</strong>
                    <p>{choice.blurb}</p>
                  </span>
                  <IconArrowRight size={21} />
                </button>
              ))}
            </div>
            <details className="jam-new-length">
              <summary>Length · {bars} bars</summary>
              <label>
                Bars{" "}
                <select
                  value={bars}
                  onChange={(e) => setBars(Number(e.target.value))}
                >
                  {Array.from({ length: 16 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </label>
            </details>
            <button
              className="jam-primary jam-create-sketch"
              disabled={create.isPending || sending}
              onClick={() =>
                create.mutate({
                  seed,
                  name: name.trim() || "Untitled jam",
                  bars,
                })
              }
            >
              {create.isPending ? "Creating…" : "Create sketch"}
            </button>
            <form
              className="jam-describe"
              onSubmit={(event) => {
                event.preventDefault();
                void describeToStart();
              }}
            >
              <label htmlFor="sketch-description">Or describe it…</label>
              <input
                id="sketch-description"
                className="jam-input"
                placeholder="rainy night boom-bap"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={1000}
                disabled={sending}
              />
              <button
                className="jam-btn"
                type="submit"
                disabled={sending || create.isPending || !description.trim()}
              >
                {sending ? "Asking the band…" : "Ask the band"}{" "}
                <IconArrowRight size={17} />
              </button>
              {describeError && (
                <p className="jam-inline-error" role="alert">
                  {describeError}
                </p>
              )}
            </form>
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
