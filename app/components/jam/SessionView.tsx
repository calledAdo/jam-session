import {
  sendToAgentChatAndConfirm,
  useAgentChatGenerating,
  useChatThreads,
} from "@agent-native/core/client/agent-chat";
import {
  deleteClientAppState,
  readClientAppState,
  writeClientAppState,
} from "@agent-native/core/client/application-state";
import {
  useActionMutation,
  useActionQuery,
  useDbSync,
} from "@agent-native/core/client/hooks";
import { defineClientAction } from "@agent-native/core/client/host";
import { createAgentNativeWebMcpRegistration } from "@agent-native/core/client/webmcp";
import {
  IconArrowBackUp,
  IconArrowLeft,
  IconArrowUpRight,
  IconCheck,
  IconHistory,
  IconHelpCircle,
  IconX,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { getJamEngine } from "@/lib/jam/audio";
import {
  authorsForNewIdeas,
  BANDMATE_AUTHORS,
  type BandmateAuthor,
} from "@/lib/jam/band-moment";
import {
  activeStepRatio,
  applyPatchToTracks,
  cycleVelocity,
  describeSelection,
  diffCells,
  draftCells,
  draftPatchForIdea,
  draftValueAt,
  isDraftCell,
  patchCells,
  setDraftChord,
  shiftBassDegree,
  toggleBass,
  toggleDraftCell,
  toggleDrum,
  updateDraftCell,
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
const JAM_CHAT_TAB_KEY = "jam-session-agent-tab-v1";
const COACH_KEY = "jam-first-run-v1";
const COACH_STEPS = [
  { id: "beat", label: "Click a drum cell to add a beat." },
  {
    id: "selection",
    label: "Drag across bars (or tap a bar number) to get ideas.",
  },
  { id: "unstick", label: "Stuck? Call in the bandmates." },
] as const;

type CoachProgress = { completed: string[]; dismissed: boolean };
const INITIAL_COACH: CoachProgress = { completed: [], dismissed: false };

function isTextTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  return (
    ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable
  );
}

function jamChatTabStorageKey(sessionId: string): string {
  return `${JAM_CHAT_TAB_KEY}:${sessionId}`;
}

function readJamChatTabId(sessionId: string): string | null {
  try {
    return window.localStorage.getItem(jamChatTabStorageKey(sessionId));
  } catch {
    return null;
  }
}

function writeJamChatTabId(sessionId: string, tabId: string): void {
  try {
    window.localStorage.setItem(jamChatTabStorageKey(sessionId), tabId);
  } catch {
    // The current mounted session still owns its tab when storage is unavailable.
  }
}

export function SessionView({ sessionId }: { sessionId: string }) {
  const [agentGenerating, sendAgentPrompt] = useAgentChatGenerating();
  const { createThread } = useChatThreads(undefined, "jam-session", undefined, {
    autoCreate: false,
    restoreActiveThread: false,
  });
  const jamChatTab = useRef<{ sessionId: string; tabId: string | null }>({
    sessionId,
    tabId: null,
  });
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
  const { data: taste } = useActionQuery("get-taste", { limit: 60 }) as {
    data: { kept: string[]; tossed: string[]; summary: string } | undefined;
  };

  const setStepsM = useActionMutation("set-steps");
  const progressionM = useActionMutation("apply-progression");
  const transportM = useActionMutation("update-transport");
  const keepM = useActionMutation("keep-idea");
  const tossM = useActionMutation("toss-idea");
  const undoM = useActionMutation("undo-last");
  const variationsM = useActionMutation("propose-variations");
  const ensureBandAgents = useActionMutation("ensure-band-agents");
  const addCommentM = useActionMutation("add-comment");

  const [playing, setPlaying] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [auditionId, setAuditionId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    ideaId: string;
    draft: PatchEntry[];
  } | null>(null);
  const [highlightIdeaId, setHighlightIdeaId] = useState<string | null>(null);
  const [flashing, setFlashing] = useState<ReadonlySet<string>>(EMPTY_SET);
  const [notice, setNotice] = useState<string | null>(null);
  const [menuBusy, setMenuBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [coachProgress, setCoachProgress] = useState(INITIAL_COACH);
  const [coachReady, setCoachReady] = useState(false);
  const [bandMoment, setBandMoment] = useState<
    "working" | "ideas" | "sent" | null
  >(null);
  const [bandmateDone, setBandmateDone] = useState<ReadonlySet<BandmateAuthor>>(
    new Set(),
  );
  const dataRef = useRef(data);
  dataRef.current = data;
  const unstickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ideasBeforeUnstick = useRef<ReadonlySet<string>>(EMPTY_SET);
  const unstickRunObserved = useRef(false);
  const coachProgressDirty = useRef(false);

  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4500);
  }, []);
  const coachProgressRef = useRef(coachProgress);
  coachProgressRef.current = coachProgress;

  useEffect(() => {
    let cancelled = false;
    void readClientAppState(COACH_KEY)
      .then((value) => {
        if (cancelled) return;
        if (coachProgressDirty.current) {
          setCoachReady(true);
          return;
        }
        const stored =
          value && typeof value === "object"
            ? (value as Partial<CoachProgress>)
            : {};
        const completed = Array.isArray(stored.completed)
          ? stored.completed.filter(
              (step): step is string => typeof step === "string",
            )
          : [];
        const progress = {
          completed: completed.filter((step) =>
            COACH_STEPS.some((item) => item.id === step),
          ),
          dismissed: stored.dismissed === true,
        };
        coachProgressRef.current = progress;
        setCoachProgress(progress);
        setCoachReady(true);
      })
      .catch(() => {
        if (!cancelled) setCoachReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveCoachProgress = useCallback(
    (progress: CoachProgress) => {
      coachProgressDirty.current = true;
      coachProgressRef.current = progress;
      setCoachProgress(progress);
      void writeClientAppState(COACH_KEY, progress, {
        requestSource: TAB_ID,
      }).catch(() => {
        notify("Coach progress could not be saved.");
      });
    },
    [notify],
  );

  const completeCoachStep = useCallback(
    (step: string) => {
      const current = coachProgressRef.current;
      if (current.dismissed || current.completed.includes(step)) return;
      saveCoachProgress({
        ...current,
        completed: [...current.completed, step],
      });
    },
    [saveCoachProgress],
  );

  const dismissCoach = useCallback(() => {
    saveCoachProgress({ ...coachProgressRef.current, dismissed: true });
  }, [saveCoachProgress]);

  useEffect(
    () => () => {
      if (unstickTimer.current) clearTimeout(unstickTimer.current);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    [],
  );

  const errorMessage = (e: unknown) =>
    e instanceof Error
      ? e.message
      : e &&
          typeof e === "object" &&
          "error" in e &&
          typeof e.error === "string"
        ? e.error
        : "Something went wrong.";

  // --- Derived display state (audition or an edited draft overlays the grid).
  const auditionIdea = data?.ideas.find((i) => i.id === auditionId) ?? null;
  const displayTracks = useMemo(() => {
    if (!data) return [];
    if (editing) return applyPatchToTracks(data.tracks, editing.draft);
    return auditionIdea
      ? applyPatchToTracks(data.tracks, auditionIdea.patch)
      : data.tracks;
  }, [data, auditionIdea, editing]);
  const ghosts = useMemo(() => {
    if (editing) return new Set(draftCells(editing.draft));
    return data && auditionIdea
      ? new Set(patchCells(data.tracks, auditionIdea.patch))
      : EMPTY_SET;
  }, [data, auditionIdea, editing]);

  useEffect(() => {
    if (auditionId && data && !data.ideas.some((i) => i.id === auditionId)) {
      setAuditionId(null);
    }
  }, [auditionId, data]);

  useEffect(() => {
    if (editing && data && !data.ideas.some((i) => i.id === editing.ideaId)) {
      setEditing(null);
    }
  }, [editing, data]);

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
          schema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
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
          schema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
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
  const prevTracks = useRef<{
    id: string;
    tracks: SessionData["tracks"];
  } | null>(null);
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
        { sessionId, track, fromStep, steps },
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
    if (editing) {
      if (!isDraftCell(editing.draft, kind, index)) return;
      setEditing((current) =>
        current
          ? {
              ...current,
              draft: toggleDraftCell(
                data?.tracks ?? [],
                current.draft,
                kind,
                index,
              ),
            }
          : current,
      );
      return;
    }
    const current = valueAt(kind, index);
    const isOn = typeof current === "number" && current > 0;
    const next =
      shift && isOn
        ? cycleVelocity(current as number)
        : shift
          ? 1
          : toggleDrum(current ?? 0);
    editCells(kind, index, [next]);
    if (next > 0) {
      completeCoachStep("beat");
      void engine.preview(kind, next);
    }
  };

  const onBassClick = (index: number) => {
    if (editing) {
      if (!isDraftCell(editing.draft, "bass", index)) return;
      setEditing((current) =>
        current
          ? {
              ...current,
              draft: toggleDraftCell(
                data?.tracks ?? [],
                current.draft,
                "bass",
                index,
              ),
            }
          : current,
      );
      return;
    }
    const next = toggleBass(valueAt("bass", index) ?? null);
    editCells("bass", index, [next]);
    if (next !== null) void engine.preview("bass", next);
  };

  const onBassWheel = (index: number, delta: number) => {
    if (editing) {
      if (!isDraftCell(editing.draft, "bass", index)) return;
      const current = draftValueAt(
        data?.tracks ?? [],
        editing.draft,
        "bass",
        index,
      );
      if (!(typeof current === "number" && current > 0)) return;
      const next = shiftBassDegree(current, delta);
      if (next === current) return;
      setEditing({
        ...editing,
        draft: updateDraftCell(editing.draft, "bass", index, next),
      });
      return;
    }
    const current = valueAt("bass", index);
    if (!(typeof current === "number" && current > 0)) return;
    const next = shiftBassDegree(current, delta);
    if (next === current) return;
    editCells("bass", index, [next]);
    void engine.preview("bass", next);
  };

  const onPickChord = (bar: number, numeral: string | null) => {
    if (editing) {
      if (!isDraftCell(editing.draft, "keys", bar)) return;
      setEditing({
        ...editing,
        draft: setDraftChord(editing.draft, bar, numeral),
      });
      return;
    }
    if (numeral === null) {
      editCells("keys", bar, [null]);
      return;
    }
    const patch: PatchEntry[] = [
      { track: "keys", fromStep: bar, steps: [numeral] },
    ];
    const rollback = optimistic(
      (d) => ({ ...d, tracks: applyPatchToTracks(d.tracks, patch) }),
      patchCells(data?.tracks ?? [], patch),
    );
    progressionM.mutate(
      { sessionId, bars: [bar], numerals: [numeral] },
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
    change: Partial<{
      bpm: number;
      root: string;
      scale: string;
      swing: number;
    }>,
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

  const onEdit = (idea: IdeaData) => {
    if (!data) return;
    setAuditionId(null);
    setEditing({
      ideaId: idea.id,
      draft: draftPatchForIdea(data.tracks, idea.patch),
    });
  };

  const cancelEditing = useCallback(() => setEditing(null), []);

  const onKeepEdited = (idea: IdeaData) => {
    if (!editing || editing.ideaId !== idea.id) return;
    const savedEditing = editing;
    const draft = editing.draft;
    setEditing(null);
    setAuditionId(null);
    // Not marked local: the applied draft flashes amber like any bandmate edit.
    const rollback = optimistic((d) => ({
      ...d,
      tracks: applyPatchToTracks(d.tracks, draft),
      ideas: d.ideas.filter((i) => i.id !== idea.id),
    }));
    keepM.mutate(
      { ideaId: idea.id, patch: draft },
      {
        onError: (e: unknown) => {
          rollback();
          setEditing(savedEditing);
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
      await variationsM.mutateAsync({
        sessionId,
        tracks: selection.tracks,
        barStart: selection.barStart,
        barEnd: selection.barEnd,
        kind,
        author: "You",
        count: 3,
      });
      notify(`New ${kind} ideas in the tray`);
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setMenuBusy(false);
    }
  };

  const sendPrompt = async (
    message: string,
    extraContext: string[] = [],
    confirmDelivery = false,
  ) => {
    if (jamChatTab.current.sessionId !== sessionId) {
      jamChatTab.current = {
        sessionId,
        tabId: readJamChatTabId(sessionId),
      };
    }
    const targetTabId =
      jamChatTab.current.tabId ??
      readJamChatTabId(sessionId) ??
      (await createThread());
    if (!targetTabId) throw new Error("Could not create a Jam chat thread.");
    jamChatTab.current.tabId = targetTabId;
    writeJamChatTabId(sessionId, targetTabId);
    const prompt = {
      message,
      context: [
        `Session id: ${sessionId}`,
        `Session: ${data?.session.name ?? "Jam Session"} · ${data?.session.bpm ?? "?"} BPM · ${data?.session.root ?? "?"} ${data?.session.scale ?? ""}`,
        selection
          ? `Selection: ${describeSelection(selection)} (0-based bars ${selection.barStart}-${selection.barEnd}; tracks ${selection.tracks.join(", ")})`
          : "Selection: none",
        taste?.summary
          ? `Taste: ${taste.summary}`
          : "Taste: not enough signals yet",
        ...extraContext,
      ].join("\n"),
      submit: true,
      openSidebar: true,
      chatTarget: "local" as const,
      targetTabId,
    };
    if (confirmDelivery) {
      const delivery = await sendToAgentChatAndConfirm(prompt);
      if (!delivery.delivered) {
        throw new Error(
          "Open the bandmate chat to connect AI or retry your note.",
        );
      }
      return delivery.tabId;
    }
    return sendAgentPrompt(prompt);
  };

  const onAskBandmate = () => {
    if (!selection) return;
    void sendPrompt(`Give me ideas for ${describeSelection(selection)}`);
  };

  // --- Bar notes. The note lands first, then the bandmate gets the same
  // per-jam chat thread with the comment id in its context.
  const onAddComment = async (bar: number, text: string) => {
    const { comment } = await addCommentM.mutateAsync({ sessionId, bar, text });
    const commentId = comment.id;
    try {
      await sendPrompt(
        `Ada left a note on bar ${bar + 1}: "${text}"`,
        [
          JSON.stringify({ sessionId, commentId, bar }),
          "Follow the bar-comments skill: propose ONE idea for this bar, then answer-comment; never write the grid.",
        ],
        true,
      );
    } catch (cause) {
      notify(
        `Note saved, but the bandmate wasn't notified: ${errorMessage(cause)}`,
      );
    }
  };

  const seeIdea = useCallback(
    (ideaId: string) => {
      if (!dataRef.current?.ideas.some((idea) => idea.id === ideaId)) {
        notify("That idea has already left the tray.");
        return;
      }
      setHighlightIdeaId(ideaId);
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`[data-idea-id="${CSS.escape(ideaId)}"]`)
          ?.scrollIntoView({ behavior: "instant", block: "center" });
      });
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlightIdeaId(null), 2600);
    },
    [notify],
  );

  const onUnstick = () => {
    if (bandMoment === "working") return;
    completeCoachStep("unstick");
    ideasBeforeUnstick.current = new Set(data?.ideas.map(({ id }) => id) ?? []);
    unstickRunObserved.current = false;
    setBandmateDone(new Set());
    setBandMoment("working");
    if (unstickTimer.current) clearTimeout(unstickTimer.current);

    const showSent = (cause?: unknown) => {
      if (unstickTimer.current) clearTimeout(unstickTimer.current);
      if (cause) {
        setBandMoment(null);
        notify(errorMessage(cause));
        return;
      }
      setBandMoment("sent");
      unstickTimer.current = setTimeout(() => setBandMoment(null), 4500);
    };

    ensureBandAgents.mutate(
      {},
      {
        onSuccess: () => {
          void sendPrompt("Unstick me")
            .then(() => {
              unstickTimer.current = setTimeout(() => {
                if (unstickRunObserved.current) return;
                setBandMoment((current) =>
                  current === "working" ? "sent" : current,
                );
                unstickTimer.current = setTimeout(
                  () => setBandMoment(null),
                  4500,
                );
              }, 12000);
            })
            .catch(showSent);
        },
        onError: showSent,
      },
    );
  };

  useEffect(() => {
    if (!bandMoment || !data) return;
    const arrived = authorsForNewIdeas(data.ideas, ideasBeforeUnstick.current);
    const newlyDone = arrived.filter((author) => !bandmateDone.has(author));
    if (newlyDone.length === 0) return;
    const completed = new Set([...bandmateDone, ...newlyDone]);
    setBandmateDone(completed);
    if (!BANDMATE_AUTHORS.every((author) => completed.has(author))) return;

    if (unstickTimer.current) clearTimeout(unstickTimer.current);
    if (bandMoment !== "ideas") setBandMoment("ideas");
    unstickTimer.current = setTimeout(() => setBandMoment(null), 5000);
  }, [bandMoment, data?.ideas, bandmateDone]);

  useEffect(() => {
    if (bandMoment !== "working") return;
    if (agentGenerating) {
      unstickRunObserved.current = true;
      if (unstickTimer.current) clearTimeout(unstickTimer.current);
      return;
    }
    if (!unstickRunObserved.current) return;
    const arrived = data
      ? authorsForNewIdeas(data.ideas, ideasBeforeUnstick.current)
      : [];
    if (
      BANDMATE_AUTHORS.every(
        (author) => bandmateDone.has(author) || arrived.includes(author),
      )
    )
      return;
    setBandMoment("sent");
    unstickTimer.current = setTimeout(() => setBandMoment(null), 9000);
  }, [agentGenerating, bandMoment, bandmateDone, data?.ideas]);

  const coachStep =
    coachReady && !coachProgress.dismissed
      ? COACH_STEPS.find((step) => !coachProgress.completed.includes(step.id))
      : undefined;
  const coachStepNumber = coachStep
    ? COACH_STEPS.findIndex((step) => step.id === coachStep.id) + 1
    : 0;

  // --- Keyboard.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && editing) {
        setEditing(null);
        return;
      }
      if (isTextTarget(event.target)) return;
      if (event.code === "Space") {
        if (
          (event.target as HTMLElement | null)?.closest(
            "button, a, [role='button']",
          )
        )
          return;
        event.preventDefault();
        void togglePlay();
      } else if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "z"
      ) {
        event.preventDefault();
        undo();
      } else if (
        event.key === "?" ||
        (event.shiftKey && event.code === "Slash")
      ) {
        event.preventDefault();
        setHelpOpen(true);
      } else if (event.key === "Escape") {
        if (editing) {
          setEditing(null);
          return;
        }
        setSelection(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, undo, editing]);

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

  useEffect(() => {
    const key = `editing-idea:${TAB_ID}`;
    if (editing) {
      void writeClientAppState(
        key,
        { sessionId, ideaId: editing.ideaId },
        { requestSource: TAB_ID },
      ).catch(() => undefined);
    } else {
      void deleteClientAppState(key, { requestSource: TAB_ID }).catch(
        () => undefined,
      );
    }
  }, [sessionId, editing?.ideaId]);

  useEffect(
    () => () => {
      void deleteClientAppState(`editing-idea:${TAB_ID}`, {
        requestSource: TAB_ID,
        keepalive: true,
      }).catch(() => undefined);
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
      <div
        className="jam-root jam-session jam-session--loading"
        aria-label="Loading loop"
      >
        <div className="jam-session-head">
          <span className="jam-wordmark">JAM SESSION</span>
          <span className="jam-label">LOADING LOOP</span>
        </div>
        <div className="jam-loading-bars">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="jam-loading-grid">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="jam-root jam-session jam-session--error">
        <Link to="/home" className="jam-back-link">
          <IconArrowLeft size={15} /> CRATE
        </Link>
        <div className="jam-error-state" role="alert">
          <span className="jam-label">LOOP UNAVAILABLE</span>
          <h1>Could not open this jam.</h1>
          <p>{errorMessage(error)}</p>
          <button
            className="jam-unstick-button"
            type="button"
            onClick={() => void qc.invalidateQueries({ queryKey })}
          >
            Retry <IconArrowUpRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  const { session } = data;
  const barPhrase = selection
    ? selection.barStart === selection.barEnd
      ? `bar ${selection.barStart + 1}`
      : `bars ${selection.barStart + 1}-${selection.barEnd + 1}`
    : `the last bar`;
  const prompts = [
    {
      label: `Make ${barPhrase} build into the drop`,
      message: `Make ${barPhrase} build into the drop`,
    },
    {
      label: "Darker bassline",
      message: `Make the bassline darker${selection ? ` in ${describeSelection(selection)}` : ""}`,
    },
    {
      label: "Give me a swing knob",
      message: "Give me a swing knob for this loop",
    },
  ];
  const tasteTooltip = taste
    ? `Likes: ${taste.kept.join("; ") || "none yet"}\nAvoids: ${taste.tossed.join("; ") || "nothing yet"}`
    : "Taste signals from kept and tossed ideas";
  const hatSteps = data?.tracks.find((track) => track.kind === "hat")?.steps;
  const hatEnergy = hatSteps?.length ? activeStepRatio(hatSteps) : 0.5;

  return (
    <div className="jam-root jam-session">
      <header className="jam-session-head">
        <Link to="/home" className="jam-back-link" title="Back to loop crate">
          <IconArrowLeft size={16} /> <span>CRATE</span>
        </Link>
        <div className="jam-session-title">
          <span className="jam-label">
            {String(session.bars).padStart(2, "0")} BAR LOOP
          </span>
          <h1>{session.name}</h1>
        </div>
        <div className="jam-taste" title={tasteTooltip}>
          <span className="jam-taste__label">YOUR TASTE</span>
          <span className="jam-taste__value">
            {taste?.summary ?? "Still learning your taste"}
          </span>
        </div>
        <div className="jam-session__actions">
          <button
            className="jam-icon-button"
            type="button"
            title="Undo last edit (⌘Z)"
            aria-label="Undo last edit"
            onClick={undo}
          >
            <IconArrowBackUp size={17} />
          </button>
          <button
            className="jam-icon-button"
            type="button"
            title="Edit history"
            aria-label="Edit history"
            onClick={() => setHistoryOpen(true)}
          >
            <IconHistory size={17} />
          </button>
          <button
            className="jam-icon-button"
            type="button"
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            onClick={() => setHelpOpen(true)}
          >
            <IconHelpCircle size={17} />
          </button>
        </div>
      </header>

      <TransportBar
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
        hatEnergy={hatEnergy}
      />

      {agentGenerating && !bandMoment ? (
        <div className="jam-agent-status" role="status">
          <span className="jam-band-moment__pulse" /> BANDMATE IS WORKING WITH
          THIS LOOP
        </div>
      ) : null}

      {bandMoment ? (
        <section
          className="jam-band-moment"
          data-state={bandMoment}
          aria-live="polite"
        >
          <div className="jam-band-moment__headline">
            <span className="jam-band-moment__pulse" />
            <strong>
              {bandMoment === "ideas"
                ? "IDEAS IN THE TRAY"
                : bandMoment === "sent"
                  ? "BANDMATES INVITED"
                  : "BANDMATES ON THE LOOP"}
            </strong>
            <span>
              {bandMoment === "ideas"
                ? "Three ears on one loop."
                : bandMoment === "sent"
                  ? "The chat panel has the session context."
                  : "Sketching a way through the loop."}
            </span>
          </div>
          <div className="jam-band-roster">
            <span
              data-role="drummer"
              data-done={bandmateDone.has("Drummer") || undefined}
            >
              <i /> DRUMMER <small>pocket</small>
              {bandmateDone.has("Drummer") ? (
                <IconCheck size={12} aria-label="Drummer idea added" />
              ) : null}
            </span>
            <span
              data-role="bassist"
              data-done={bandmateDone.has("Bassist") || undefined}
            >
              <i /> BASSIST <small>counterline</small>
              {bandmateDone.has("Bassist") ? (
                <IconCheck size={12} aria-label="Bassist idea added" />
              ) : null}
            </span>
            <span
              data-role="keys"
              data-done={bandmateDone.has("Keys") || undefined}
            >
              <i /> KEYS <small>harmony</small>
              {bandmateDone.has("Keys") ? (
                <IconCheck size={12} aria-label="Keys idea added" />
              ) : null}
            </span>
          </div>
        </section>
      ) : null}

      <section className="jam-stage" aria-label="Jam loop editor">
        <div className="jam-stage__head">
          <div className="jam-stage__title">
            <span className="jam-stage__light" />
            <span>LIVE GRID</span>
            <span className="jam-stage__sep">/</span>
            <span className="jam-mono">{session.bars} BARS · 16 STEPS</span>
          </div>
          {selection ? (
            <span className="jam-stage__selection">
              {describeSelection(selection)}
            </span>
          ) : null}
        </div>

        {coachStep ? (
          <div className="jam-coach" aria-live="polite">
            <span className="jam-coach__count jam-mono">
              0{coachStepNumber} / 03
            </span>
            <span>{coachStep.label}</span>
            <button
              type="button"
              onClick={dismissCoach}
              title="Dismiss first-run guide"
              aria-label="Dismiss first-run guide"
            >
              <IconX size={14} />
            </button>
          </div>
        ) : null}

        <div
          className="jam-prompt-rail"
          role="group"
          aria-label="Suggested bandmate prompts"
        >
          <span className="jam-prompt-rail__label">ASK THE BANDMATE</span>
          {prompts.map((prompt) => (
            <button
              type="button"
              key={prompt.label}
              className="jam-prompt-chip"
              onClick={() => void sendPrompt(prompt.message)}
            >
              {prompt.label} <IconArrowUpRight size={13} />
            </button>
          ))}
        </div>

        <Grid
          tracks={displayTracks}
          bars={session.bars}
          scale={session.scale}
          flashing={flashing}
          ghosts={ghosts}
          selection={selection}
          onSelect={(next) => {
            setSelection(next);
            if (next) completeCoachStep("selection");
          }}
          onDrumClick={onDrumClick}
          onBassClick={onBassClick}
          onBassWheel={onBassWheel}
          onPickChord={onPickChord}
          onMenuAction={(action) => void onMenuAction(action)}
          onAskBandmate={onAskBandmate}
          menuBusy={menuBusy}
          comments={data.comments ?? []}
          onAddComment={onAddComment}
          onSeeIdea={seeIdea}
        />
      </section>

      <IdeaTray
        ideas={data.ideas}
        tracks={data.tracks}
        auditionId={auditionId}
        editingId={editing?.ideaId ?? null}
        draft={editing?.draft ?? null}
        highlightId={highlightIdeaId}
        playing={playing}
        onAudition={setAuditionId}
        onKeep={onKeep}
        onToss={onToss}
        onEdit={onEdit}
        onCancelEdit={cancelEditing}
        onKeepEdited={onKeepEdited}
        onTogglePlay={() => void togglePlay()}
      />

      {historyOpen ? (
        <HistoryDrawer
          sessionId={sessionId}
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}
      <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
        <SheetContent className="jam-root jam-help-sheet" side="right">
          <div className="jam-help-sheet__head">
            <div>
              <SheetTitle>Shortcuts</SheetTitle>
              <SheetDescription>Keys for working the loop.</SheetDescription>
            </div>
          </div>
          <dl className="jam-shortcuts">
            <div>
              <dt>Play / stop</dt>
              <dd>
                <kbd>Space</kbd>
              </dd>
            </div>
            <div>
              <dt>Undo last edit</dt>
              <dd>
                <kbd>⌘ Z</kbd>
                <kbd>Ctrl Z</kbd>
              </dd>
            </div>
            <div>
              <dt>Clear selection</dt>
              <dd>
                <kbd>Esc</kbd>
              </dd>
            </div>
            <div>
              <dt>Select bars</dt>
              <dd>Tap a bar tab or drag across rows</dd>
            </div>
            <div>
              <dt>Drum velocity</dt>
              <dd>
                <kbd>Shift</kbd> + click
              </dd>
            </div>
            <div>
              <dt>Bass degree</dt>
              <dd>Scroll over bass, or use − / +</dd>
            </div>
            <div>
              <dt>Open shortcuts</dt>
              <dd>
                <kbd>?</kbd>
              </dd>
            </div>
          </dl>
        </SheetContent>
      </Sheet>
    </div>
  );
}
