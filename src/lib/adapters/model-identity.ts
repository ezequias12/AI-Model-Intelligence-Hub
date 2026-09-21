/**
 * Canonical model identity.
 *
 * Different sources name the same model differently: Artificial Analysis uses a
 * slug (`gpt-5-2`), OpenRouter uses `author/model` with optional `:variant`, and
 * Hugging Face uses `author/Model-Name`. This normalises any of them to the
 * kebab-case slug the domain uses, so a model coming from a second source can be
 * matched to the row the first source created instead of duplicating it.
 */
export function normalizeModelSlug(value: string): string {
  return value
    .toLowerCase()
    .split(":")[0]!
    .split("/")
    .pop()!
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Author/provider segment of an `author/model` id, normalised. */
export function normalizeAuthorSlug(value: string): string | null {
  const author = value.split(":")[0]!.split("/")[0];
  if (!author || author === value) return null;
  const slug = author
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug.length > 0 ? slug : null;
}
