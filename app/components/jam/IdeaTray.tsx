import {
  IconCheck,
  IconPencil,
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
  IconX,
} from "@tabler/icons-react";

import {
  patchPreviewRows,
  type IdeaData,
  type PatchEntry,
  type TrackData,
} from "@/lib/jam/grid";

import "./jam.css";

const TRACK_LABELS: Record<string, string> = {
  kick: "Kick",
  snare: "Clap",
  hat: "Hi-hat",
  bass: "Bass",
  keys: "Chords",
};

export function IdeaTray({
  ideas,
  tracks,
  auditionId,
  editingId,
  draft,
  highlightId,
  playing,
  onAudition,
  onKeep,
  onToss,
  onEdit,
  onCancelEdit,
  onKeepEdited,
  onTogglePlay,
}: {
  ideas: IdeaData[];
  tracks: TrackData[];
  auditionId: string | null;
  editingId: string | null;
  draft: PatchEntry[] | null;
  highlightId: string | null;
  playing: boolean;
  onAudition: (id: string | null) => void;
  onKeep: (idea: IdeaData) => void;
  onToss: (idea: IdeaData) => void;
  onEdit: (idea: IdeaData) => void;
  onCancelEdit: () => void;
  onKeepEdited: (idea: IdeaData) => void;
  onTogglePlay: () => void;
}) {
  const orderedIdeas = [...ideas].sort((a, b) =>
    String(
      (b as typeof b & { createdAt?: string }).createdAt ?? "",
    ).localeCompare(
      String((a as typeof a & { createdAt?: string }).createdAt ?? ""),
    ),
  );

  return (
    <section className="jam-idea-tray" aria-labelledby="jam-ideas-heading">
      <div className="jam-idea-tray__head">
        <div className="jam-idea-tray__title">
          <h2 id="jam-ideas-heading">The band's ideas</h2>
          <span className="jam-idea-tray__count jam-mono">
            {ideas.length}/6
          </span>
        </div>
      </div>

      {ideas.length === 0 ? (
        <div className="jam-idea-tray__empty">
          <span className="jam-idea-tray__empty-mark" aria-hidden="true">
            —
          </span>
          <span>Ask for a nudge. Your sketch stays yours.</span>
        </div>
      ) : (
        <div className="jam-idea-tray__list">
          {orderedIdeas.map((idea) => {
            const auditioning = auditionId === idea.id;
            const editing = editingId === idea.id;
            const highlighted = highlightId === idea.id;
            const author = idea.author.trim().toLowerCase();
            const authorTone = ["you", "user"].includes(author)
              ? "you"
              : author === "drummer"
                ? "drummer"
                : author === "bassist"
                  ? "bassist"
                  : author === "keys"
                    ? "keys"
                    : "bandmate";
            const previewRows = patchPreviewRows(
              tracks,
              editing && draft ? draft : idea.patch,
            );
            const changedCells = previewRows.reduce(
              (total, row) => total + row.changed.length,
              0,
            );

            return (
              <article
                key={idea.id}
                className="jam-idea"
                data-author={authorTone}
                data-auditioning={auditioning ? "true" : undefined}
                data-editing={editing ? "true" : undefined}
                data-highlighted={highlighted ? "true" : undefined}
                data-idea-id={idea.id}
              >
                <div className="jam-idea__topline">
                  <span className="jam-idea__avatar" aria-hidden="true">
                    {idea.author.slice(0, 1) || "B"}
                  </span>
                  <span className="jam-author" data-author={authorTone}>
                    {idea.author || "Bandmate"}
                  </span>
                  {editing ? (
                    <span className="jam-idea__state">TWEAKING</span>
                  ) : auditioning ? (
                    <span className="jam-idea__state">LISTENING</span>
                  ) : null}
                </div>
                <h3 className="jam-idea__label">{idea.label}</h3>
                {idea.rationale ? (
                  <p className="jam-idea__rationale">{idea.rationale}</p>
                ) : null}
                {editing ? (
                  <p className="jam-idea__editing">
                    Tap the amber squares to tweak
                  </p>
                ) : null}

                <div
                  className="jam-idea__diff"
                  aria-label={`${changedCells} changed cells in the preview`}
                >
                  <div className="jam-idea__diff-heading">
                    <span>Before / after</span>
                    <span>
                      {changedCells} {changedCells === 1 ? "change" : "changes"}
                    </span>
                  </div>
                  {previewRows.length ? (
                    previewRows.map((row) => (
                      <div
                        className="jam-diff-row"
                        key={`${row.track}:${row.bar}`}
                      >
                        <span className="jam-diff-row__name">
                          {TRACK_LABELS[row.track]}
                        </span>
                        <span className="jam-diff-row__bar jam-mono">
                          B{row.bar + 1}
                        </span>
                        <span
                          className="jam-mini-comparison"
                          aria-hidden="true"
                        >
                          {[row.before, row.after].map((values, phase) => (
                            <span
                              className="jam-diff-row__cells"
                              key={phase}
                              data-phase={phase === 0 ? "before" : "after"}
                            >
                              {values.map((value, i) => (
                                <i
                                  key={i}
                                  data-on={
                                    typeof value === "string" ||
                                    (typeof value === "number" && value > 0) ||
                                    undefined
                                  }
                                  data-changed={
                                    (phase === 1 && row.changed.includes(i)) ||
                                    undefined
                                  }
                                />
                              ))}
                            </span>
                          ))}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="jam-diff-empty">No cells changed.</span>
                  )}
                </div>

                <div className="jam-idea__actions">
                  {editing ? (
                    <>
                      <button
                        type="button"
                        className="jam-idea__audition"
                        data-active={playing ? "true" : undefined}
                        aria-pressed={playing}
                        onClick={onTogglePlay}
                      >
                        {playing ? (
                          <IconPlayerStopFilled size={13} />
                        ) : (
                          <IconPlayerPlayFilled size={13} />
                        )}
                        {playing ? "Stop" : "Listen"}
                      </button>
                      <button
                        type="button"
                        className="jam-idea__keep"
                        disabled={changedCells === 0}
                        onClick={() => onKeepEdited(idea)}
                      >
                        <IconCheck size={14} /> Use tweaked
                      </button>
                      <button
                        type="button"
                        className="jam-idea__cancel"
                        onClick={onCancelEdit}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="jam-idea__audition"
                        data-active={auditioning ? "true" : undefined}
                        aria-pressed={auditioning}
                        disabled={editingId !== null}
                        onClick={() => onAudition(auditioning ? null : idea.id)}
                      >
                        {auditioning ? (
                          <IconPlayerStopFilled size={13} />
                        ) : (
                          <IconPlayerPlayFilled size={13} />
                        )}
                        {auditioning ? "Stop" : "Listen"}
                      </button>
                      <button
                        type="button"
                        className="jam-idea__keep"
                        disabled={editingId !== null}
                        onClick={() => onKeep(idea)}
                      >
                        <IconCheck size={14} /> Use it
                      </button>
                      <button
                        type="button"
                        className="jam-idea__edit"
                        disabled={editingId !== null}
                        onClick={() => onEdit(idea)}
                      >
                        <IconPencil size={12} /> Tweak
                      </button>
                      <button
                        type="button"
                        className="jam-idea__toss"
                        title="Skip idea"
                        aria-label={`Skip ${idea.label}`}
                        disabled={editingId !== null}
                        onClick={() => onToss(idea)}
                      >
                        <IconX size={15} /> Skip
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
