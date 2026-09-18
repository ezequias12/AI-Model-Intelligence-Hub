"use client";

import * as React from "react";
import { Bookmark, BookmarkCheck, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NEWS_DOMAIN_LABELS, type NewsDomain } from "@/lib/domain/schema";

export const NEWS_SAVED_KEY = "amih.news.saved.v1";

export interface SavedNewsQuery {
  id: string;
  query: string;
  /** Domain scope the query was saved under, or "all" for the cross-category view. */
  domain: string;
  savedAt: string;
}

function toSavedEntry(value: unknown): SavedNewsQuery | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.query !== "string" ||
    typeof candidate.domain !== "string"
  ) {
    return null;
  }
  return {
    id: candidate.id,
    query: candidate.query,
    domain: candidate.domain,
    savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : "",
  };
}

function readSaved(): SavedNewsQuery[] {
  try {
    const raw = window.localStorage.getItem(NEWS_SAVED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(toSavedEntry).filter((entry): entry is SavedNewsQuery => entry !== null);
  } catch {
    return [];
  }
}

function writeSaved(entries: SavedNewsQuery[]): void {
  try {
    window.localStorage.setItem(NEWS_SAVED_KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable or full: saved queries simply do not persist.
  }
}

function savedDomainLabel(domain: string): string {
  if (domain === "all") return "All categories";
  return NEWS_DOMAIN_LABELS[domain as NewsDomain] ?? domain;
}

export function NewsSearch({
  query,
  onQueryChange,
  domain,
  onApplySaved,
  resultCount,
  placeholder,
  className,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  /** Domain scope the current query belongs to; stored alongside the query. */
  domain: string;
  onApplySaved: (entry: SavedNewsQuery) => void;
  resultCount?: number;
  placeholder?: string;
  className?: string;
}): React.JSX.Element {
  const [saved, setSaved] = React.useState<SavedNewsQuery[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setSaved(readSaved());
    setMounted(true);
  }, []);

  const persist = React.useCallback((next: SavedNewsQuery[]) => {
    setSaved(next);
    writeSaved(next);
  }, []);

  const trimmed = query.trim();
  const entryId = `${domain}::${trimmed.toLowerCase()}`;
  const isSaved = trimmed.length > 0 && saved.some((entry) => entry.id === entryId);

  const toggleSave = (): void => {
    if (trimmed.length === 0) return;
    if (isSaved) {
      persist(saved.filter((entry) => entry.id !== entryId));
      return;
    }
    persist([{ id: entryId, query: trimmed, domain, savedAt: new Date().toISOString() }, ...saved]);
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={placeholder ?? "Search news"}
            aria-label="Search news"
            className="pl-8 pr-8"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-[color] duration-150 ease-out hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <Button
          variant={isSaved ? "secondary" : "outline"}
          size="sm"
          onClick={toggleSave}
          disabled={trimmed.length === 0}
          aria-pressed={isSaved}
        >
          {isSaved ? (
            <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {isSaved ? "Saved" : "Save query"}
        </Button>

        {typeof resultCount === "number" && (
          <span className="tabular text-2xs text-muted-foreground" role="status">
            {resultCount} result{resultCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {mounted && saved.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-2xs font-medium text-muted-foreground">Saved</span>
          {saved.map((entry) => (
            <span
              key={entry.id}
              className="inline-flex max-w-full items-center gap-1 rounded-chip border border-border bg-surface px-2 py-1 text-xs"
            >
              <button
                type="button"
                onClick={() => onApplySaved(entry)}
                className="min-w-0 truncate text-left underline-offset-2 hover:underline"
                title={`Restore saved query "${entry.query}"`}
              >
                <span className="text-muted-foreground">{savedDomainLabel(entry.domain)}: </span>
                {entry.query}
              </button>
              <button
                type="button"
                onClick={() => persist(saved.filter((item) => item.id !== entry.id))}
                aria-label={`Remove saved query "${entry.query}"`}
                className="rounded p-0.5 text-muted-foreground transition-[color] duration-150 ease-out hover:text-foreground"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
