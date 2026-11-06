import { hasActiveAgentRuns } from "@agent-native/agentkit/client";
// Match AgentPanel's optimized public context entry; the broad barrel duplicates it in dev.
import {
  useAgentKitSubmissionHoldsTurn,
  useAgentThread,
} from "@agent-native/toolkit/app/agentkit/react/context";
import {
  IconGuitarPick,
  IconMusic,
  IconPiano,
  IconMessageCircle,
} from "@tabler/icons-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import { bandActivityRows, type BandmateAuthor } from "@/lib/jam/band-moment";

const AVATARS = {
  Drummer: IconMusic,
  Bassist: IconGuitarPick,
  Keys: IconPiano,
};

/** Lives in AgentPanel's slot so it observes that panel's existing controller. */
export function BandActivity({
  target,
  threadId,
  team,
  pending,
  done,
  barStart,
  barEnd,
  onBusyChange,
}: {
  target: HTMLElement | null;
  threadId: string | null;
  team: boolean;
  pending: boolean;
  done: ReadonlySet<BandmateAuthor>;
  barStart: number;
  barEnd: number;
  onBusyChange: (busy: boolean) => void;
}) {
  const thread = useAgentThread(threadId ?? undefined);
  const starting = useAgentKitSubmissionHoldsTurn(threadId ?? undefined);
  const busy = starting || hasActiveAgentRuns(thread);
  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);
  const rows = bandActivityRows(thread, {
    team,
    pending,
    done,
    barStart,
    barEnd,
  });
  if (!target || rows.length === 0) return null;
  return createPortal(
    <div className="jam-band-activity">
      {rows.map((row) => {
        const Avatar = row.author ? AVATARS[row.author] : IconMessageCircle;
        return (
          <div
            className="jam-band-activity__row"
            key={row.author ?? "band"}
            data-done={row.done || undefined}
          >
            <span className="jam-band-activity__avatar" aria-hidden="true">
              <Avatar size={16} />
            </span>
            <span>{row.text}</span>
          </div>
        );
      })}
    </div>,
    target,
  );
}
