import { useParams } from "react-router";

import { SessionView } from "@/components/jam/SessionView";

export function meta() {
  return [{ title: "Jam Session" }];
}

export default function SessionRoute() {
  const { id } = useParams();
  if (!id) return null;
  return <SessionView sessionId={id} />;
}
