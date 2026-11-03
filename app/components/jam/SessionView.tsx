import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { defineClientAction } from "@agent-native/core/client/host";
import { createAgentNativeWebMcpRegistration } from "@agent-native/core/client/webmcp";
import {
  deleteClientAppState,
  writeClientAppState,
} from "@agent-native/core/client/application-state";
import {
  useActionMutation,
  useActionQuery,
  useDbSync,
} from "@agent-native/core/client/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { getJamEngine } from "@/lib/jam/audio";
import {
  applyPatchToTracks,
  cycleVelocity,
  describeSelection,
  diffCells,
  patchCells,
  shiftBassDegree,
  toggleBass,
  toggleDrum,
  type IdeaData,
  type PatchEntry,
  type Selection,
  type SessionData,
  type TrackKind,
} from "@/lib/jam/grid";
import { TAB_ID } from "@/lib/tab-id";

import { Grid, type SelectionAction } from "./Grid";
import { HistoryDrawer } from "./HistoryDrawer";
import { IdeaTray } from "./IdeaTray";
import { TransportBar } from "./TransportBar";

import "./jam.css";

const EMPTY_SET: ReadonlySet<string> = new Set();

function isTextTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  return (
    ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable
  );
}

export function SessionView({ sessionId }: { sessionId: string }) {
  const qc = useQueryClient();
  const queryKey = useMemo(
    () => ["action", "get-session", { id: sessionId }],
    [sessionId],
  );

  useDbSync({
    queryClient: qc,
    ignoreSource: TAB_ID,
    realtime: { reason: "agent edits the grid while the loop plays" },
  });

  const { data, error, isLoading } = useActionQuery("get-session", {
    id: sessionId,
  }) as { data: SessionData | undefined; error: unknown; isLoading: boolean };

  const setStepsM = useActionMutation("set-steps");
  const progressionM = useActionMutation("apply-progression");
  const transportM = useActionMutation("update-transport");
  const keepM = useActionMutation("keep-idea");
  const tossM = useActionMutation("toss-idea");
  const undoM = useActionMutation("undo-last");
  const variationsM = useActionMutation("propose-variations");

  const [playing, setPlaying] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [auditionId, setAuditionId] = useState<string | null>(null);
  const [flashing, setFlashing] = useState<ReadonlySet<string>>(EMPTY_SET);
  const [notice, setNotice] = useState<string | null>(null);
  const [menuBusy, setMenuBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4500);
  }, []);
  const errorMessage = (e: unknown) =>
    e instanceof Error
      ? e.message
      : e && typeof e === "object" && "error" in e && typeof e.error === "string"
        ? e.error
        : "Something went wrong.";

  // --- Derived display state (audition overlays the pending idea client-side).
  const auditionIdea = data?.ideas.find((i) => i.id === auditionId) ?? null;
  const displayTracks = useMemo(() => {
    if (!data) return [];
    return auditionIdea
      ? applyPatchToTracks(data.tracks, auditionIdea.patch)
      : data.tracks;
  }, [data, auditionIdea]);
  const ghosts = useMemo(
    () =>
      data && auditionIdea
        ? new Set(patchCells(data.tracks, auditionIdea.patch))
        : EMPTY_SET,
    [data, auditionIdea],
  );

  useEffect(() => {
    if (auditionId && data && !data.ideas.some((i) => i.id === auditionId)) {
      setAuditionId(null);
    }
  }, [auditionId, data]);

  // --- Audio: the engine reads the latest grid on every tick.
  const engine = getJamEngine();
  useEffect(() => {
    if (!data) return;
    engine.setState({
      bpm: data.session.bpm,
      swing: data.session.swing,
      root: data.session.root,
      scale: data.session.scale,
      bars: data.session.bars,
      tracks: displayTracks,
    });
  }, [data, displayTracks, engine]);

  useEffect(() => () => engine.stop(), [engine]);

  const togglePlay = useCallback(async () => {
    if (engine.playing) {
      engine.stop();
      setPlaying(false);
    } else {
      await engine.start();
      setPlaying(engine.playing);
    }
  }, [engine]);

  useEffect(() => {
    const registration = createAgentNativeWebMcpRegistration({
      actions: [
        defineClientAction<Record<string, never>, { playing: boolean }>({
          name: "play",
          title: "Play loop",
          description: "Start playback of the current Jam Session loop.",
          schema: { type: "object", properties: {}, additionalProperties: false },
          run: async () => {
            if (!engine.playing) await engine.start();
            setPlaying(engine.playing);
            return { playing: engine.playing };
          },
        }),
        defineClientAction<Record<string, never>, { playing: boolean }>({
          name: "stop",
          title: "Stop loop",
          description: "Stop playback of the current Jam Session loop.",
          schema: { type: "object", properties: {}, additionalProperties: false },
          run: () => {
            engine.stop();
            setPlaying(false);
            return { playing: false };
          },
        }),
        defineClientAction<{ id: string }, { auditioning: string }>({
          name: "audition-idea",
          title: "Audition idea",
          description: "Preview an idea in this session's grid overlay.",
          schema: {
            type: "object",
            properties: { id: { type: "string", minLength: 1 } },
            required: ["id"],
            additionalProperties: false,
          },
          run: ({ id }) => {
            if (!dataRef.current?.ideas.some((idea) => idea.id === id)) {
              throw new Error("That idea is not available in this session.");
            }
            setAuditionId(id);
            return { auditioning: id };
          },
        }),
      ],
      getContext: () => ({
        route: { name: "jam-session", params: { sessionId } },
        resource: { type: "jam-session", id: sessionId },
      }),
    });

    if (!registration.supported) {
      console.info("[Jam Session] WebMCP is unavailable in this browser.");
    }
    void registration.start().then(
      () => {
        if (registration.supported) {
          console.info(
            `[Jam Session] WebMCP registered ${registration.registered} page actions.`,
          );
        }
      },
      (cause: unknown) => {
        console.warn("[Jam Session] WebMCP registration failed.", cause);
      },
    );
    return () => registration.stop();
  }, [engine, sessionId]);

  // --- Flash cells changed by someone other than this tab.
  const prevTracks = useRef<{ id: string; tracks: SessionData["tracks"] } | null>(
    null,
  );
  const localCells = useRef<Set<string>>(new Set());
  const suppressUntil = useRef(0);
  useEffect(() => {
    if (!data) return;
    const prev = prevTracks.current;
    prevTracks.current = { id: data.session.id, tracks: data.tracks };
    if (!prev || prev.id !== data.session.id) return;
    const changed = diffCells(prev.tracks, data.tracks);
    const external = changed.filter((key) => !localCells.current.has(key));
    for (const key of changed) localCells.current.delete(key);
    if (external.length === 0 || Date.now() < suppressUntil.current) return;
    setFlashing((cur) => new Set([...cur, ...external]));
    const timer = setTimeout(() => {
      setFlashing((cur) => {
        const next = new Set(cur);
        for (const key of external) next.delete(key);
        return next;
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [data]);

  // --- Optimistic writes.
  const optimistic = useCallback(
    (update: (d: SessionData) => SessionData, cells: string[] = []) => {
      void qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<SessionData>(queryKey);
      for (const cell of cells) localCells.current.add(cell);
      qc.setQueryData<SessionData>(queryKey, (d) => (d ? update(d) : d));
      return () => {
        if (prev) qc.setQueryData(queryKey, prev);
      };
    },
    [qc, queryKey],
  );

  const editCells = useCallback(
    (track: TrackKind, fromStep: number, steps: (number | string | null)[]) => {
      const patch: PatchEntry[] = [{ track, fromStep, steps }];
      const base = data?.tracks ?? [];
      const rollback = optimistic(
        (d) => ({ ...d, tracks: applyPatchToTracks(d.tracks, patch) }),
        patchCells(base, patch),
      );
      setStepsM.mutate(
        { sessionId, track, fromStep, steps, author: "You" },
        {
          onError: (e: unknown) => {
            rollback();
            notify(errorMessage(e));
          },
        },
      );
    },
    [data, optimistic, sessionId, setStepsM, notify],
  );

  const valueAt = (kind: TrackKind, index: number) =>
    data?.tracks.find((t) => t.kind === kind)?.steps[index];

  const onDrumClick = (kind: TrackKind, index: number, shift: boolean) => {
    const current = valueAt(kind, index);
    const isOn = typeof current === "number" && current > 0;
    const next = shift && isOn ? cycleVelocity(current as number) : shift ? 1 : toggleDrum(current ?? 0);
    editCells(kind, index, [next]);
    if (next > 0) void engine.preview(kind, next);
  };

  const onBassClick = (index: number) => {
    const next = toggleBass(valueAt("bass", index) ?? null);
    editCells("bass", index, [next]);
    if (next !== null) void engine.preview("bass", next);
  };

  const onBassWheel = (index: number, delta: number) => {
    const current = valueAt("bass", index);
    if (!(typeof current === "number" && current > 0)) return;
    const next = shiftBassDegree(current, delta);
    if (next === current) return;
    editCells("bass", index, [next]);
    void engine.preview("bass", next);
  };

  const onPickChord = (bar: number, numeral: string | null) => {
    if (numeral === null) {
      editCells("keys", bar, [null]);
      return;
    }
    const patch: PatchEntry[] = [{ track: "keys", fromStep: bar, steps: [numeral] }];
    const rollback = optimistic(
      (d) => ({ ...d, tracks: applyPatchToTracks(d.tracks, patch) }),
      patchCells(data?.tracks ?? [], patch),
    );
    progressionM.mutate(
      { sessionId, bars: [bar], numerals: [numeral], author: "You" },
      {
        onError: (e: unknown) => {
          rollback();
          notify(errorMessage(e));
        },
      },
    );
    void engine.preview("keys", numeral);
  };

  const onTransport = (
    change: Partial<{ bpm: number; root: string; scale: string; swing: number }>,
  ) => {
    optimistic((d) => ({ ...d, session: { ...d.session, ...change } }));
    scheduleTransport(change);
  };
  const pendingTransport = useRef<Record<string, unknown>>({});
  const transportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleTransport = (change: Record<string, unknown>) => {
    pendingTransport.current = { ...pendingTransport.current, ...change };
    if (transportTimer.current) clearTimeout(transportTimer.current);
    transportTimer.current = setTimeout(() => {
      const payload = pendingTransport.current;
      pendingTransport.current = {};
      transportM.mutate(
        { id: sessionId, ...payload },
        {
          onError: (e: unknown) => {
            void qc.invalidateQueries({ queryKey });
            notify(errorMessage(e));
          },
        },
      );
    }, 250);
  };

  // --- Ideas.
  const onKeep = (idea: IdeaData) => {
    setAuditionId((cur) => (cur === idea.id ? null : cur));
    // Not marked local: kept ideas flash amber like any other non-"You" edit.
    const rollback = optimistic((d) => ({
      ...d,
      tracks: applyPatchToTracks(d.tracks, idea.patch),
      ideas: d.ideas.filter((i) => i.id !== idea.id),
    }));
    keepM.mutate(
      { ideaId: idea.id },
      {
        onError: (e: unknown) => {
          rollback();
          notify(errorMessage(e));
        },
      },
    );
  };

  const onToss = (idea: IdeaData) => {
    setAuditionId((cur) => (cur === idea.id ? null : cur));
    const rollback = optimistic((d) => ({
      ...d,
      ideas: d.ideas.filter((i) => i.id !== idea.id),
    }));
    tossM.mutate(
      { ideaId: idea.id },
      {
        onError: (e: unknown) => {
          rollback();
          notify(errorMessage(e));
        },
      },
    );
  };

  const undo = useCallback(() => {
    suppressUntil.current = Date.now() + 2000;
    undoM.mutate(
      { sessionId },
      { onError: (e: unknown) => notify(errorMessage(e)) },
    );
  }, [undoM, sessionId, notify]);

  // --- Selection menu.
  const onMenuAction = async (kind: SelectionAction) => {
    if (!selection) return;
    setMenuBusy(true);
    try {
      for (const track of selection.tracks) {
        await variationsM.mutateAsync({
          sessionId,
          track,
          barStart: selection.barStart,
          barEnd: selection.barEnd,
          kind,
          author: "You",
        });
      }
      notify(`New ${kind} ideas in the tray`);
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setMenuBusy(false);
    }
  };

  const onAskBandmate = () => {
    if (!selection) return;
    sendToAgentChat({
      message: `Give me ideas for ${describeSelection(selection)}`,
      context: [
        `Session id: ${sessionId}`,
        `Selected tracks: ${selection.tracks.join(", ")}`,
        `Selected bars (0-based, inclusive): ${selection.barStart}-${selection.barEnd}`,
      ].join("\n"),
      submit: true,
      openSidebar: true,
    });
  };

  const onUnstick = () => {
    sendToAgentChat({
      message: "Unstick me",
      context: JSON.stringify({ sessionId, selection }),
      submit: true,
      openSidebar: true,
    });
  };

  // --- Keyboard.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTextTarget(event.target)) return;
      if (event.code === "Space") {
        event.preventDefault();
        const active = document.activeElement as HTMLElement | null;
        if (active?.tagName === "BUTTON") active.blur();
        void togglePlay();
      } else if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "z"
      ) {
        event.preventDefault();
        undo();
      } else if (event.key === "Escape") {
        setSelection(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, undo]);

  // --- application_state for the agent.
  useEffect(() => {
    if (!selection) {
      void deleteClientAppState("selection", { requestSource: TAB_ID }).catch(
        () => undefined,
      );
      return;
    }
    void writeClientAppState(
      "selection",
      {
        sessionId,
        tracks: selection.tracks,
        barStart: selection.barStart,
        barEnd: selection.barEnd,
      },
      { requestSource: TAB_ID },
    ).catch(() => undefined);
  }, [selection, sessionId]);

  useEffect(() => {
    if (!data) return;
    const { session } = data;
    void writeClientAppState(
      "transport",
      {
        sessionId,
        bpm: session.bpm,
        root: session.root,
        scale: session.scale,
        swing: session.swing,
        bars: session.bars,
        playing,
      },
      { requestSource: TAB_ID },
    ).catch(() => undefined);
  }, [data, sessionId, playing]);

  useEffect(() => {
    void writeClientAppState(
      "audition",
      { ideaId: auditionId },
      { requestSource: TAB_ID },
    ).catch(() => undefined);
  }, [auditionId]);

  useEffect(
    () => () => {
      for (const key of ["selection", "transport"]) {
        void deleteClientAppState(key, {
          requestSource: TAB_ID,
          keepalive: true,
        }).catch(() => undefined);
      }
    },
    [],
  );

  if (isLoading) {
    return (
      <div className="jam-root p-6">
        <p className="jam-mono text-sm" style={{ color: "var(--jam-dim)" }}>
          Loading session...
        </p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="jam-root p-6">
        <p className="text-sm">{errorMessage(error)}</p>
        <Link to="/home" className="jam-btn mt-3">
          Back to jams
        </Link>
      </div>
    );
  }

  const { session } = data;
  return (
    <div className="jam-root flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Link to="/home" className="jam-label" style={{ textDecoration: "none" }}>
          &larr; All jams
        </Link>
      </div>
      <TransportBar
        name={session.name}
        bpm={session.bpm}
        root={session.root}
        scale={session.scale}
        swing={session.swing}
        playing={playing}
        onTogglePlay={() => void togglePlay()}
        onChange={onTransport}
        onUnstick={onUnstick}
        notice={notice}
        sessionId={sessionId}
      />
      <div className="flex justify-end">
        <button
          className="jam-btn"
          onClick={() => setHistoryOpen(true)}
          type="button"
        >
          History
        </button>
      </div>
      <div className="jam-panel px-3 py-3">
        <Grid
          tracks={displayTracks}
          bars={session.bars}
          scale={session.scale}
          flashing={flashing}
          ghosts={ghosts}
          selection={selection}
          onSelect={setSelection}
          onDrumClick={onDrumClick}
          onBassClick={onBassClick}
          onBassWheel={onBassWheel}
          onPickChord={onPickChord}
          onMenuAction={(a) => void onMenuAction(a)}
          onAskBandmate={onAskBandmate}
          menuBusy={menuBusy}
        />
        <p className="jam-mono mt-2 px-1 text-[10px]" style={{ color: "var(--jam-dim)" }}>
          Drag across bars to select · Space play/stop · ⌘Z undo
        </p>
      </div>
      <IdeaTray
        ideas={data.ideas}
        auditionId={auditionId}
        onAudition={setAuditionId}
        onKeep={onKeep}
        onToss={onToss}
      />
      {historyOpen ? (
        <HistoryDrawer
          sessionId={sessionId}
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}
    </div>
  );
}

