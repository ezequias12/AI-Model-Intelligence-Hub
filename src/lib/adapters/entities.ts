/**
 * Conservative entity extraction shared by the community adapters.
 *
 * Only exact known terms and `@handle` / `#tag` mentions become entities; the
 * extractor never guesses a person or a company from free text.
 */
export function extractEntities(text: string, knownEntities: string[]): string[] {
  const found = new Set<string>();

  for (const match of text.matchAll(/[@#]([A-Za-z0-9_.]{2,40})/g)) {
    if (match[0]) found.add(match[0]);
  }
  for (const entity of knownEntities) {
    if (entity.length < 3) continue;
    const pattern = new RegExp(`\\b${escapeRegExp(entity)}\\b`, "i");
    if (pattern.test(text)) found.add(entity);
  }

  return [...found];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
