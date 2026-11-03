import { JamHome } from "@/components/jam/JamHome";

export function meta() {
  return [{ title: "Jam Session" }];
}

export default function HomeRoute() {
  return <JamHome />;
}
