export interface TasteSignal {
  signal: string;
  weight: number;
}

type Descriptor = {
  pattern: RegExp;
  label: string;
};

const DESCRIPTORS: Descriptor[] = [
  {
    pattern: /\b(?:vary|variation|nudge|push|shake|move|moving)\w*\b/i,
    label: "movement",
  },
  { pattern: /\b(?:fill|roll|stutter|drop)\w*\b/i, label: "fills" },
  { pattern: /\b(?:simplify|simpler|simplified|space)\b/i, label: "space" },
  { pattern: /\bdarker\b/i, label: "darker" },
  { pattern: /\bbrighter\b/i, label: "brighter" },
  { pattern: /\b(?:progression|chord|chords)\b/i, label: "chord changes" },
];

const TRACKS = ["kick", "snare", "hats?", "bass", "keys"] as const;

function descriptorsFor(signal: string): string[] {
  const tracks = TRACKS.filter((track) =>
    new RegExp(`\\b${track}\\b`, "i").test(signal),
  ).map((track) => (track === "hats?" ? "hat" : track));
  const moves = DESCRIPTORS.filter(({ pattern }) => pattern.test(signal)).map(
    ({ label }) => label,
  );

  if (moves.length === 0) return [];
  if (tracks.length === 0 || moves.includes("chord changes")) return moves;

  return moves
    .map((move) =>
      move === "movement" || move === "fills"
        ? tracks.map((track) => `${track} ${move}`)
        : move,
    )
    .flat();
}

/** Summarize kept and tossed idea labels as a short, net-weighted taste profile. */
export function summarizeTaste(signals: readonly TasteSignal[]): string {
  const totals = new Map<string, number>();
  for (const { signal, weight } of signals) {
    for (const descriptor of descriptorsFor(signal)) {
      totals.set(descriptor, (totals.get(descriptor) ?? 0) + weight);
    }
  }

  const likes = [...totals]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([descriptor]) => descriptor);
  const avoids = [...totals]
    .filter(([, weight]) => weight < 0)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 1)
    .map(([descriptor]) => descriptor);

  if (likes.length === 0 && avoids.length === 0) {
    return "Still learning your taste";
  }

  return [
    likes.length ? `Likes ${likes.join(", ")}` : "",
    avoids.length ? `avoids ${avoids.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
