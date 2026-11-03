import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@agent-native/toolkit/ui/sheet";
import { useState } from "react";

type HistoryEdit = {
  id: string;
  author: string;
  patch: Array<{ track: string }>;
  createdAt: string;
};

const TRACK_LABELS: Record<string, string> = {
  kick: "kick",
  snare: "snare",
  hat: "hat",
  bass: "bass",
  keys: "keys",
};

function editLabel(edit: HistoryEdit): string {
  const tracks = [...new Set(edit.patch.map(({ track }) => track))]
    .map((track) => TRACK_LABELS[track] ?? track)
    .join(", ");
  return tracks ? `Edited ${tracks}` : "Grid edit";
}

function editAuthor(author: string): { label: string; agentName?: string } {
  if (["you", "user"].includes(author.trim().toLowerCase())) {
    return { label: "You" };
  }
  return { label: "Agent", agentName: author };
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export function HistoryDrawer({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const { data, error, isLoading } = useActionQuery("list-edits", {
    sessionId,
  }) as { data: HistoryEdit[] | undefined; error: unknown; isLoading: boolean };
  const revertM = useActionMutation("revert-to-edit");
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const revert = (editId: string) => {
    setRevertingId(editId);
    setMessage(null);
    revertM.mutate(
      { sessionId, editId },
      {
        onSuccess: () => setMessage("Session restored to this edit."),
        onError: (cause: unknown) =>
          setMessage(
            cause instanceof Error ? cause.message : "Could not restore edit.",
          ),
        onSettled: () => setRevertingId(null),
      },
    );
  };

  return (
    <Sheet open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent
        className="jam-root flex w-full flex-col border-[var(--jam-line)] p-0 sm:max-w-md"
        showClose={false}
        side="right"
      >
        <header className="flex items-center justify-between border-b border-[var(--jam-line)] px-5 py-4">
          <div>
            <SheetTitle className="text-sm">Edit history</SheetTitle>
            <SheetDescription className="sr-only">
              Applied edits for this jam session, newest first.
            </SheetDescription>
          </div>
          <button
            aria-label="Close edit history"
            className="jam-btn"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </header>
        {message ? (
          <p aria-live="polite" className="px-5 pt-3 text-xs text-[var(--jam-dim)]">
            {message}
          </p>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {isLoading ? (
            <p className="jam-mono py-4 text-xs text-[var(--jam-dim)]">
              Loading edits...
            </p>
          ) : error ? (
            <p className="py-4 text-sm">Could not load edit history.</p>
          ) : data?.length ? (
            <ol className="divide-y divide-[var(--jam-line)]">
              {data.map((edit, index) => {
                const author = editAuthor(edit.author);
                const newest = index === 0;
                return (
                  <li className="flex items-start gap-3 py-4" key={edit.id}>
                    <span
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        background:
                          author.label === "You"
                            ? "var(--jam-cyan)"
                            : "var(--jam-amber)",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            borderColor:
                              author.label === "You"
                                ? "var(--jam-cyan)"
                                : "var(--jam-amber)",
                            color:
                              author.label === "You"
                                ? "var(--jam-cyan)"
                                : "var(--jam-amber)",
                          }}
                        >
                          {author.label}
                        </span>
                        {author.agentName ? (
                          <span className="truncate text-xs text-[var(--jam-dim)]">
                            {author.agentName}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm">{editLabel(edit)}</p>
                      <time
                        className="jam-mono mt-1 block text-[11px] text-[var(--jam-dim)]"
                        dateTime={edit.createdAt}
                      >
                        {formatTime(edit.createdAt)}
                      </time>
                    </div>
                    <button
                      className="jam-btn shrink-0"
                      disabled={newest || revertingId !== null}
                      onClick={() => revert(edit.id)}
                      type="button"
                    >
                      {revertingId === edit.id ? "Restoring..." : "Revert to here"}
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="py-4 text-sm text-[var(--jam-dim)]">
              No grid edits yet.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
