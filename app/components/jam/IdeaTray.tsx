import {
  IconCheck,
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
  IconX,
} from "@tabler/icons-react";

import {
  patchPreviewRows,
  type IdeaData,
  type TrackData,
} from "@/lib/jam/grid";

import "./jam.css";

const TRACK_LABELS: Record<string, string> = {
  kick: "KICK",
  snare: "SNARE",
  hat: "HAT",
  bass: "BASS",
  keys: "KEYS",
};

export function IdeaTray({
  ideas,
  tracks,
  auditionId,
  onAudition,
  onKeep,
  onToss,
}: {
  ideas: IdeaData[];
  tracks: TrackData[];
  auditionId: string | null;
  onAudition: (id: string | null) => void;
  onKeep: (idea: IdeaData) => void;
  onToss: (idea: IdeaData) => void;
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
          <h2 id="jam-ideas-heading">Ideas</h2>
          <span className="jam-idea-tray__count jam-mono">
            {ideas.length}/6
          </span>
        </div>
        <span className="jam-label">AUDITION · KEEP · TOSS</span>
      </div>

      {ideas.length === 0 ? (
        <div className="jam-idea-tray__empty">
          <span className="jam-idea-tray__empty-mark" aria-hidden="true">
            —
          </span>
          <span>The loop is yours for now.</span>
        </div>
      ) : (
        <div className="jam-idea-tray__list">
          {orderedIdeas.map((idea, index) => {
            const auditioning = auditionId === idea.id;
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
            const previewRows = patchPreviewRows(tracks, idea.patch);
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
              >
                <div className="jam-idea__topline">
                  <span className="jam-idea__index jam-mono">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="jam-author" data-author={authorTone}>
                    {idea.author || "Bandmate"}
                  </span>
                  {auditioning ? (
                    <span className="jam-idea__state">ON THE GRID</span>
                  ) : null}
                </div>
                <h3 className="jam-idea__label">{idea.label}</h3>
                {idea.rationale ? (
                  <p className="jam-idea__rationale">{idea.rationale}</p>
                ) : null}

                <div
                  className="jam-idea__diff"
                  aria-label={`${changedCells} changed cells in the preview`}
                >
                  <div className="jam-idea__diff-heading">
                    <span>PATCH PREVIEW</span>
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
                          className="jam-diff-row__cells"
                          aria-hidden="true"
                        >
                          {row.after.map((value, cellIndex) => {
                            const previous = row.before[cellIndex];
                            const changed = row.changed.includes(cellIndex);
                            const wasOn =
                              typeof previous === "number"
                                ? previous > 0
                                : typeof previous === "string";
                            const isOn =
                              typeof value === "number"
                                ? value > 0
                                : typeof value === "string";
                            return (
                              <i
                                key={cellIndex}
                                data-on={isOn ? "true" : undefined}
                                data-added={
                                  changed && isOn && !wasOn ? "true" : undefined
                                }
                                data-removed={
                                  changed && !isOn && wasOn ? "true" : undefined
                                }
                                data-changed={changed ? "true" : undefined}
                              />
                            );
                          })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="jam-diff-empty">No cells changed.</span>
                  )}
                </div>

                <div className="jam-idea__actions">
                  <button
                    type="button"
                    className="jam-idea__audition"
                    data-active={auditioning ? "true" : undefined}
                    aria-pressed={auditioning}
                    onClick={() => onAudition(auditioning ? null : idea.id)}
                  >
                    {auditioning ? (
                      <IconPlayerStopFilled size={13} />
                    ) : (
                      <IconPlayerPlayFilled size={13} />
                    )}
                    {auditioning ? "Stop" : "Audition"}
                  </button>
                  <button
                    type="button"
                    className="jam-idea__keep"
                    onClick={() => onKeep(idea)}
                  >
                    <IconCheck size={14} /> Keep
                  </button>
                  <button
                    type="button"
                    className="jam-idea__toss"
                    title="Toss idea"
                    aria-label={`Toss ${idea.label}`}
                    onClick={() => onToss(idea)}
                  >
                    <IconX size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
