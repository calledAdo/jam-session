import { useParams, useSearchParams } from "react-router";

import { SessionView } from "@/components/jam/SessionView";

export function meta() {
  return [{ title: "Jam Session" }];
}

export default function SessionRoute() {
  const { id } = useParams();
  const [params] = useSearchParams();
  if (!id) return null;
  // `embedded=1` is added by the MCP App embed bridge; `embed=1` is the manual flag.
  const embed = ["embed", "embedded"].some((k) => {
    const v = params.get(k);
    return v === "1" || v === "true";
  });
  if (embed) {
    // Compact mode: cover the app shell (sidebar, header, agent panel) so only
    // the grid + transport remain inside the host's iframe.
    return (
      <div
        data-jam-embed
        className="fixed inset-0 z-50 overflow-auto bg-background text-foreground"
      >
        <SessionView key={id} sessionId={id} />
      </div>
    );
  }
  return <SessionView key={id} sessionId={id} />;
}
