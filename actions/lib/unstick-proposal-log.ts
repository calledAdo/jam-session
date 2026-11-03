const BANDMATE_AUTHORS = new Set(["Drummer", "Bassist", "Keys"]);
const MAX_TRACKED_TURNS = 128;
const authorsByTurn = new Map<string, Set<string>>();
const reportedTurns = new Set<string>();

export function shouldLogMainThreadBandmateFallback(
  turnId: string | undefined,
  authors: readonly string[],
): boolean {
  const current = new Set(
    authors.filter((author) => BANDMATE_AUTHORS.has(author)),
  );
  if (current.size === 0) return false;
  if (!turnId) return current.size > 1;

  let seen = authorsByTurn.get(turnId);
  if (!seen) {
    if (authorsByTurn.size >= MAX_TRACKED_TURNS) {
      const oldest = authorsByTurn.keys().next().value;
      if (oldest) {
        authorsByTurn.delete(oldest);
        reportedTurns.delete(oldest);
      }
    }
    seen = new Set();
    authorsByTurn.set(turnId, seen);
  }
  for (const author of current) seen.add(author);
  if (seen.size < 2 || reportedTurns.has(turnId)) return false;
  reportedTurns.add(turnId);
  return true;
}
