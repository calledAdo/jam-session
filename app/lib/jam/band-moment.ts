import type { AgentThreadState } from "@agent-native/agentkit/client";
import {
  hasActiveAgentRuns,
  selectLatestAgentRun,
} from "@agent-native/agentkit/client";

export const BANDMATE_AUTHORS = ["Drummer", "Bassist", "Keys"] as const;

export type BandmateAuthor = (typeof BANDMATE_AUTHORS)[number];

export type BandmateIdea = {
  id: string;
  author: string;
};

export function authorsForNewIdeas(
  ideas: readonly BandmateIdea[],
  previousIdeaIds: ReadonlySet<string>,
): BandmateAuthor[] {
  const arrived = new Set<BandmateAuthor>();
  for (const idea of ideas) {
    if (previousIdeaIds.has(idea.id)) continue;
    if (BANDMATE_AUTHORS.includes(idea.author as BandmateAuthor)) {
      arrived.add(idea.author as BandmateAuthor);
    }
  }
  return BANDMATE_AUTHORS.filter((author) => arrived.has(author));
}

const TOOL_WORDS: Record<string, string> = {
  "vary-pattern": "trying variations",
  "add-fill": "writing a fill",
  transform: "changing the mood",
  "progression-patch": "picking chords",
  "propose-ideas": "writing it up",
};

export type BandActivityRow = {
  author?: BandmateAuthor;
  text: string;
  done?: boolean;
};

/** Project the existing chat controller. Never infer progress from elapsed time. */
export function bandActivityRows(
  thread: AgentThreadState,
  {
    team = false,
    pending = false,
    done = new Set<BandmateAuthor>(),
    barStart,
    barEnd = barStart,
  }: {
    team?: boolean;
    pending?: boolean;
    done?: ReadonlySet<BandmateAuthor>;
    barStart: number;
    barEnd?: number;
  },
): BandActivityRow[] {
  const run = selectLatestAgentRun(thread);
  const active = hasActiveAgentRuns(thread);
  const latestUser = [...thread.messages]
    .reverse()
    .find((message) => message.role === "user");
  const unstick = latestUser?.parts.some(
    (part) => part.type === "text" && /\bunstick me\b/i.test(part.text),
  );
  const tool = Object.values(thread.tools)
    .reverse()
    .find((tool) => tool.status === "running" && tool.runId === run?.id);
  const input =
    tool?.input && typeof tool.input === "object"
      ? (tool.input as Record<string, unknown>)
      : {};
  const selection =
    input.selection && typeof input.selection === "object"
      ? (input.selection as Record<string, unknown>)
      : input;
  const start = selection.barStart ?? input.bar;
  const end = selection.barEnd ?? input.bar ?? start;
  if (typeof start === "number" && Number.isInteger(start) && start >= 0) {
    barStart = start;
    barEnd =
      typeof end === "number" && Number.isInteger(end) && end >= start
        ? end
        : start;
  }
  const bars =
    barStart === barEnd
      ? `bar ${barStart + 1}`
      : `bars ${barStart + 1}–${barEnd + 1}`;
  if ((team && (!active || unstick || !latestUser)) || (active && unstick)) {
    // Tasks remain in the thread after a turn ends. Only show this turn's tasks.
    let boundary = -1;
    thread.events.forEach((event, index) => {
      if (
        event.type === "message.created" &&
        event.message.id === latestUser?.id
      )
        boundary = index;
    });
    const taskIds = new Set(
      thread.events
        .slice(boundary + 1)
        .flatMap((event) =>
          (event.type === "task.created" ||
            event.type === "task.updated" ||
            event.type === "task.completed") &&
          (boundary >= 0 || event.runId === run?.id)
            ? [event.task.id]
            : [],
        ),
    );
    return BANDMATE_AUTHORS.map((author) => {
      if (done.has(author))
        return { author, text: `✓ ${author} has an idea`, done: true };
      const task = Object.values(thread.tasks)
        .reverse()
        .find((task) => {
          if (!taskIds.has(task.id)) return false;
          const name = task.assignedAgentId
            ? thread.agents[task.assignedAgentId]?.name
            : undefined;
          return new RegExp(`\\b${author}\\b`, "i").test(
            `${name ?? ""} ${task.title}`,
          );
        });
      if (task?.status === "failed")
        return {
          author,
          text: `${author} couldn't finish — check How the band works`,
        };
      if (task?.status === "cancelled" || run?.status === "cancelled")
        return { author, text: `${author} stopped` };
      if (task?.status === "awaiting_input" || run?.status === "awaiting_input")
        return { author, text: `${author} is waiting for your reply…` };
      if (run?.status === "failed")
        return {
          author,
          text: `${author} couldn't finish — check How the band works`,
        };
      if (!pending && !active)
        return { author, text: `${author} hasn't sent an idea` };
      if (!task) return { author, text: `${author} is waiting for the band…` };
      if (task.status === "completed")
        return { author, text: `${author} finished — waiting for an idea` };
      return {
        author,
        text:
          author === "Keys"
            ? `Keys is picking chords for ${bars}…`
            : author === "Bassist"
              ? `Bassist is listening to ${bars}…`
              : `Drummer is trying ideas for ${bars}…`,
      };
    });
  }
  if (!active) return [];
  const words = tool && TOOL_WORDS[tool.name];
  return [
    {
      text: words
        ? `The band is ${words} for ${bars}…`
        : `The band is working on ${bars}…`,
    },
  ];
}
