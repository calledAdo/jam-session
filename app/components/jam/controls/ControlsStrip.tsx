import { agentNativePath } from "@agent-native/core/client/api-path";
import { EmbeddedExtension } from "@agent-native/toolkit/app/extensions";
import { useQuery } from "@tanstack/react-query";

import { HAT_ENERGY_HTML, HAT_ENERGY_NAME } from "./hat-energy";

import "../jam.css";

export const CONTROLS_SLOT_ID = "jam.controls";

type ExtensionSummary = { id: string; name: string; content?: string };

let seeding: Promise<ExtensionSummary> | null = null;

/** Find the pre-built Hat Energy extension, creating it once if absent. */
async function ensureHatEnergy(): Promise<ExtensionSummary> {
  const listRes = await fetch(
    agentNativePath("/_agent-native/extensions?includeContent=true"),
  );
  if (listRes.ok) {
    const rows = (await listRes.json()) as ExtensionSummary[];
    const found = rows.find((r) => r.name === HAT_ENERGY_NAME);
    if (found) {
      // Keep the seeded content in sync with this source file.
      if (found.content !== HAT_ENERGY_HTML) {
        await fetch(agentNativePath(`/_agent-native/extensions/${found.id}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: HAT_ENERGY_HTML,
            allowFullReplacement: true,
          }),
        });
      }
      return found;
    }
  }
  if (!seeding) {
    seeding = fetch(agentNativePath("/_agent-native/extensions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: HAT_ENERGY_NAME,
        description:
          "Slider for hi-hat density. Calls set-energy on the current session.",
        content: HAT_ENERGY_HTML,
        icon: "adjustments",
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`seed failed (${r.status})`);
        return (await r.json()) as ExtensionSummary;
      })
      .finally(() => {
        seeding = null;
      });
  }
  return seeding;
}

export function ControlsStrip({
  sessionId,
  energy,
}: {
  sessionId: string;
  energy: number;
}) {
  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["jam", "hat-energy-extension"],
    queryFn: ensureHatEnergy,
    staleTime: Infinity,
    retry: 1,
  });

  return (
    <div className="jam-controls-strip">
      <span className="jam-controls-strip__title">CONTROL EXTENSION</span>
      {isLoading ? (
        <span className="jam-controls-strip__error" role="status">
          Loading hat control...
        </span>
      ) : isError || !data ? (
        <span className="jam-controls-strip__error" role="status">
          Hat control unavailable
          <button
            className="jam-text-button"
            type="button"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </span>
      ) : (
        <div className="jam-controls-strip__extension">
          <EmbeddedExtension
            extensionId={data.id}
            slotId={CONTROLS_SLOT_ID}
            context={{ sessionId, track: "hat", energy }}
            initialHeight={64}
          />
        </div>
      )}
    </div>
  );
}
