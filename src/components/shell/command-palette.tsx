"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { Modal } from "@/components/ui/overlay";
import { Input } from "@/components/ui/input";
import { SEARCH_KIND_LABELS, searchEntries, type SearchEntry } from "@/lib/search";
import { cn } from "@/lib/utils/cn";

export function CommandPalette({
  open,
  onOpenChange,
  index = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  index?: SearchEntry[];
}): React.JSX.Element {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

  const results = React.useMemo(() => searchEntries(index, query, { limit: 24 }), [index, query]);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const commit = React.useCallback(
    (entry: SearchEntry | undefined) => {
      if (!entry) return;
      onOpenChange(false);
      router.push(entry.href);
    },
    [onOpenChange, router],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((value) => Math.min(value + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((value) => Math.max(value - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      commit(results[activeIndex]);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      hideHeader
      className="max-w-xl overflow-hidden p-0"
      title="Command palette"
    >
      <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search models, providers, plans, sources, pages…"
          aria-label="Search"
          className="h-6 border-0 bg-transparent px-0 text-md hover:border-transparent focus-visible:outline-none"
        />
      </div>

      <div
        className="scroll-thin max-h-[54vh] overflow-y-auto overscroll-contain p-1.5"
        role="listbox"
        aria-label="Results"
      >
        {results.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">
            No matches. Try a model name, a provider, a plan or a page.
          </p>
        ) : (
          results.map((entry, position) => (
            <button
              key={entry.id}
              type="button"
              role="option"
              aria-selected={position === activeIndex}
              onMouseEnter={() => setActiveIndex(position)}
              onClick={() => commit(entry)}
              className={cn(
                "flex w-full items-center gap-3 rounded-control px-2.5 py-2 text-left transition-[background-color] duration-100",
                position === activeIndex ? "bg-accent" : "hover:bg-accent/60",
              )}
            >
              <span
                className={cn(
                  "w-[54px] shrink-0 text-2xs font-medium",
                  position === activeIndex ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {SEARCH_KIND_LABELS[entry.kind]}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm text-foreground">{entry.title}</span>
                <span className="truncate text-xs text-muted-foreground">{entry.subtitle}</span>
              </span>
              {position === activeIndex && (
                <CornerDownLeft
                  className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
            </button>
          ))
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-3.5 py-2 text-2xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <kbd className="rounded-[4px] border border-border px-1 py-px">↑</kbd>
          <kbd className="rounded-[4px] border border-border px-1 py-px">↓</kbd>
          to navigate
          <span aria-hidden="true" className="meta-sep" />
          <kbd className="rounded-[4px] border border-border px-1 py-px">↵</kbd>
          to open
          <span aria-hidden="true" className="meta-sep" />
          <kbd className="rounded-[4px] border border-border px-1 py-px">Esc</kbd>
          to close
        </span>
        <span className="tabular">
          {results.length} result{results.length === 1 ? "" : "s"}
        </span>
      </div>
    </Modal>
  );
}
