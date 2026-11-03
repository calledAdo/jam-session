import { IconCheck, IconPlayerPlayFilled, IconPlayerStopFilled, IconX } from "@tabler/icons-react";

import type { IdeaData } from "@/lib/jam/grid";

import "./jam.css";

export function IdeaTray({
  ideas,
  auditionId,
  onAudition,
  onKeep,
  onToss,
}: {
  ideas: IdeaData[];
  auditionId: string | null;
  onAudition: (id: string | null) => void;
  onKeep: (idea: IdeaData) => void;
  onToss: (idea: IdeaData) => void;
}) {
  return (
    <div className="jam-panel px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="jam-label">Idea tray</span>
        <span className="jam-mono text-xs" style={{ color: "var(--jam-dim)" }}>
          {ideas.length}/6
        </span>
      </div>
      {ideas.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--jam-dim)" }}>
          Nothing pending. Select some bars and hit Vary, or ask for Unstick me.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {[...ideas].sort((a, b) =>
            String((b as typeof b & { createdAt?: string }).createdAt ?? "")
              .localeCompare(String((a as typeof a & { createdAt?: string }).createdAt ?? "")),
          ).map((idea) => {
            const auditioning = auditionId === idea.id;
            const author = idea.author.trim().toLowerCase();
            const authorTone = author === "you" || author === "user"
              ? "you"
              : author === "drummer"
                ? "drummer"
                : author === "bassist"
                  ? "bassist"
                  : author === "keys"
                    ? "keys"
                    : "agent";
            return (
              <div key={idea.id} className="jam-idea" data-auditioning={auditioning ? "true" : undefined}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span
                    className="jam-author"
                    data-you={authorTone === "you" ? "true" : undefined}
                    data-author={authorTone}
                    style={{
                      background: authorTone === "you" ? "var(--jam-cyan)" :
                        authorTone === "bassist" ? "#a78bfa" :
                        authorTone === "keys" ? "#4ade80" : "var(--jam-amber)",
                      color: authorTone === "keys" ? "#082b14" : undefined,
                    }}
                  >
                    {idea.author}
                  </span>
                </div>
                <div className="text-sm font-semibold">{idea.label}</div>
                <p className="mt-1 text-xs" style={{ color: "var(--jam-dim)" }}>
                  {idea.rationale}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="jam-btn"
                    onClick={() => onAudition(auditioning ? null : idea.id)}
                  >
                    {auditioning ? (
                      <IconPlayerStopFilled size={14} />
                    ) : (
                      <IconPlayerPlayFilled size={14} />
                    )}
                    {auditioning ? "Stop" : "Audition"}
                  </button>
                  <button type="button" className="jam-btn" onClick={() => onKeep(idea)}>
                    <IconCheck size={14} />
                    Keep
                  </button>
                  <button type="button" className="jam-btn" onClick={() => onToss(idea)}>
                    <IconX size={14} />
                    Toss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
