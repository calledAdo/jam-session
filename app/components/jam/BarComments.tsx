import { IconMessageCircle, IconX } from "@tabler/icons-react";
import { useState } from "react";

import { PopoverContent } from "@/components/ui/popover";
import type { BarCommentData } from "@/lib/jam/grid";

import "./jam.css";

const MAX_COMMENT_LENGTH = 200;

function authorTone(author: string | null): string {
  switch ((author ?? "").trim().toLowerCase()) {
    case "drummer":
      return "drummer";
    case "bassist":
      return "bassist";
    case "keys":
      return "keys";
    case "bandmate":
      return "bandmate";
    default:
      return "you";
  }
}

export function BarCommentTrigger({
  bar,
  comments,
  onOpen,
}: {
  bar: number;
  comments: BarCommentData[];
  onOpen: (element: HTMLButtonElement) => void;
}) {
  const openCount = comments.filter(
    (comment) => comment.status === "open",
  ).length;
  return (
    <button
      type="button"
      className="jam-bar-comment"
      data-bar-header
      data-open={openCount > 0 ? "true" : undefined}
      title={
        comments.length
          ? `${comments.length} note${comments.length === 1 ? "" : "s"} on bar ${bar + 1}`
          : `Comment on bar ${bar + 1}`
      }
      aria-label={
        comments.length
          ? `Open ${comments.length} note${comments.length === 1 ? "" : "s"} on bar ${bar + 1}`
          : `Comment on bar ${bar + 1}`
      }
      onClick={(event) => {
        event.stopPropagation();
        onOpen(event.currentTarget);
      }}
    >
      <IconMessageCircle size={11} aria-hidden="true" />
      {comments.length > 0 ? (
        <span className="jam-bar-comment__count jam-mono">
          {comments.length}
        </span>
      ) : null}
      {openCount > 0 ? (
        <span className="jam-bar-comment__pulse" aria-hidden="true" />
      ) : null}
    </button>
  );
}

export function BarCommentPopover({
  bar,
  comments,
  anchor,
  onClose,
  onSubmit,
  onSeeIdea,
}: {
  bar: number;
  comments: BarCommentData[];
  anchor: HTMLElement;
  onClose: () => void;
  onSubmit: (bar: number, text: string) => Promise<void>;
  onSeeIdea: (ideaId: string) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const note = text.trim();
    if (!note || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(bar, note);
      setText("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not send that note.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <PopoverContent
      className="jam-root jam-bar-comments"
      align="start"
      sideOffset={6}
      aria-label={`Notes on bar ${bar + 1}`}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        anchor.focus({ preventScroll: true });
      }}
    >
      <header className="jam-bar-comments__head">
        <span className="jam-label">
          Bar {String(bar + 1).padStart(2, "0")}
        </span>
        <button
          type="button"
          className="jam-bar-comments__close"
          aria-label="Close notes"
          onClick={onClose}
        >
          <IconX size={13} />
        </button>
      </header>

      {comments.length > 0 ? (
        <div className="jam-bar-comments__thread">
          {comments.map((comment) => (
            <article
              key={comment.id}
              className="jam-comment"
              data-status={comment.status}
            >
              <div className="jam-comment__note">
                <span
                  className="jam-comment__dot"
                  data-open={comment.status === "open" ? "true" : undefined}
                  aria-label={
                    comment.status === "open"
                      ? "Waiting on a bandmate"
                      : "Answered"
                  }
                />
                <p>{comment.text}</p>
              </div>
              {comment.reply ? (
                <div className="jam-comment__reply">
                  <div className="jam-comment__reply-head">
                    <span
                      className="jam-author"
                      data-author={authorTone(comment.replyAuthor)}
                    >
                      {comment.replyAuthor ?? "Bandmate"}
                    </span>
                    {comment.ideaId ? (
                      <button
                        type="button"
                        className="jam-comment__see-idea"
                        onClick={() => {
                          onSeeIdea(comment.ideaId!);
                          onClose();
                        }}
                      >
                        See idea
                      </button>
                    ) : null}
                  </div>
                  <p>{comment.reply}</p>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="jam-bar-comments__empty">No notes on this bar yet.</p>
      )}

      <form className="jam-bar-comments__form" onSubmit={submit}>
        <input
          className="jam-bar-comments__input"
          value={text}
          maxLength={MAX_COMMENT_LENGTH}
          placeholder="What's wrong with this bar?"
          aria-label={`Note on bar ${bar + 1}`}
          autoFocus
          onChange={(event) => setText(event.target.value)}
        />
        <button
          type="submit"
          className="jam-bar-comments__send"
          disabled={busy || text.trim().length === 0}
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </form>
      {error ? (
        <p className="jam-bar-comments__error" role="alert">
          {error}
        </p>
      ) : null}
    </PopoverContent>
  );
}
