export const BANDMATE_AUTHORS = ["Drummer", "Bassist", "Keys"] as const;

export type BandmateAuthor = (typeof BANDMATE_AUTHORS)[number];

export type BandmateIdea = {
  id: string;
  author: string;
};

export function authorsForNewIdeas(
  ideas: readonly BandmateIdea[],
  previousIdeaIds: ReadonlySet<string>,
): BandmateAuthor[] {
  const arrived = new Set<BandmateAuthor>();
  for (const idea of ideas) {
    if (previousIdeaIds.has(idea.id)) continue;
    if (BANDMATE_AUTHORS.includes(idea.author as BandmateAuthor)) {
      arrived.add(idea.author as BandmateAuthor);
    }
  }
  return BANDMATE_AUTHORS.filter((author) => arrived.has(author));
}
