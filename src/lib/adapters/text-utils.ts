/**
 * Text + hashing utilities shared by adapters.
 */
import { decodeEntities, toPlainText } from "./rss";

export { decodeEntities };

/** Strips markup and collapses whitespace; safe on non-string input. */
export function toPlainTextSafe(input: unknown): string {
  if (typeof input !== "string") return "";
  return toPlainText(input);
}

/** Re-exported so adapter modules have a single hashing import path. */
export { hashPayload, stableHash } from "@/lib/domain/hash";

/** Truncates text on a word boundary, adding an ellipsis when shortened. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}
