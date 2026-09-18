"use client";

import * as React from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { z } from "zod";
import { Badge, CountPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Divider,
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Segmented, type SegmentedOption } from "@/components/ui/primitives";
import { watchlistSchema, type Watchlist, type WatchlistItem } from "@/lib/domain/schema";
import { cn } from "@/lib/utils/cn";

type WatchlistItemKind = WatchlistItem["kind"];

const STORAGE_KEY = "amih.watchlists.v1";

export interface WatchlistCatalog {
  models: Array<{ slug: string; name: string; providerId: string }>;
  providers: Array<{ id: string; name: string; group: string }>;
  harnessProducts: Array<{ id: string; name: string; slug: string; vendor: string }>;
  suggestedTopics: string[];
}

const KIND_OPTIONS: ReadonlyArray<SegmentedOption<WatchlistItemKind>> = [
  { value: "model", label: "Models" },
  { value: "provider", label: "Providers" },
  { value: "harness_product", label: "Harness" },
  { value: "topic", label: "Topics" },
  { value: "news_query", label: "Queries" },
];

const KIND_LABELS: Record<WatchlistItemKind, string> = {
  model: "Model",
  provider: "Provider",
  harness_product: "Harness",
  topic: "Topic",
  news_query: "Query",
};

const PROVIDER_GROUP_LABELS: Record<string, string> = {
  mainstream_global: "Mainstream / global",
  china_based: "China-based",
  other: "Other",
};

const storeSchema = z.object({
  version: z.literal(1),
  watchlists: z.array(watchlistSchema),
});

/**
 * Persistence boundary. It is intentionally narrow so a Supabase-backed
 * user-preferences store can replace local storage without touching the UI.
 */
interface WatchlistStore {
  load(): Watchlist[];
  save(watchlists: Watchlist[]): void;
}

const localStorageStore: WatchlistStore = {
  load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = storeSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data.watchlists : [];
    } catch {
      // Corrupt or unavailable storage is treated as empty, never fatal.
      return [];
    }
  },
  save(watchlists) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, watchlists }));
    } catch {
      // Storage full or blocked: the session still works in memory.
    }
  },
};

function makeId(): string {
  const random = globalThis.crypto?.randomUUID?.();
  return random ?? `wl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createWatchlist(name: string): Watchlist {
  const now = new Date().toISOString();
  return { id: makeId(), name, items: [], createdAt: now, updatedAt: now };
}

export function watchlistItemHref(item: WatchlistItem): string {
  switch (item.kind) {
    case "model":
      return `/models/${item.refId}`;
    case "provider":
      return "/models/table";
    case "harness_product":
      return "/harness/plans";
    case "topic":
      return "/news";
    case "news_query":
      return `/news?q=${encodeURIComponent(item.refId)}`;
    default:
      return "/news";
  }
}

export function WatchlistManager({ catalog }: { catalog: WatchlistCatalog }): React.JSX.Element {
  const [ready, setReady] = React.useState(false);
  const [watchlists, setWatchlists] = React.useState<Watchlist[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<WatchlistItemKind>("model");
  const [term, setTerm] = React.useState("");
  const [draftName, setDraftName] = React.useState("");

  React.useEffect(() => {
    const stored = localStorageStore.load();
    const initial = stored.length > 0 ? stored : [createWatchlist("My watchlist")];
    setWatchlists(initial);
    setActiveId(initial[0]?.id ?? null);
    setReady(true);
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    localStorageStore.save(watchlists);
  }, [watchlists, ready]);

  const active = watchlists.find((entry) => entry.id === activeId) ?? watchlists[0] ?? null;

  const modelsByProvider = React.useMemo(() => {
    const map = new Map<string, WatchlistCatalog["models"]>();
    for (const model of catalog.models) {
      const list = map.get(model.providerId) ?? [];
      list.push(model);
      map.set(model.providerId, list);
    }
    return map;
  }, [catalog.models]);

  const addItem = React.useCallback(
    (draft: { kind: WatchlistItemKind; refId: string; label: string }): void => {
      if (!active) return;
      setWatchlists((list) =>
        list.map((entry) => {
          if (entry.id !== active.id) return entry;
          if (entry.items.some((item) => item.kind === draft.kind && item.refId === draft.refId)) {
            return entry;
          }
          const addedAt = new Date().toISOString();
          const item: WatchlistItem = {
            id: makeId(),
            kind: draft.kind,
            refId: draft.refId,
            label: draft.label,
            addedAt,
          };
          return { ...entry, items: [...entry.items, item], updatedAt: addedAt };
        }),
      );
    },
    [active],
  );

  const addGroup = React.useCallback(
    (models: WatchlistCatalog["models"]): void => {
      if (!active) return;
      setWatchlists((list) =>
        list.map((entry) => {
          if (entry.id !== active.id) return entry;
          const addedAt = new Date().toISOString();
          const existing = new Set(entry.items.map((item) => `${item.kind}:${item.refId}`));
          const additions: WatchlistItem[] = [];
          for (const model of models) {
            if (existing.has(`model:${model.slug}`)) continue;
            existing.add(`model:${model.slug}`);
            additions.push({
              id: makeId(),
              kind: "model",
              refId: model.slug,
              label: model.name,
              addedAt,
            });
          }
          if (additions.length === 0) return entry;
          return { ...entry, items: [...entry.items, ...additions], updatedAt: addedAt };
        }),
      );
    },
    [active],
  );

  const removeItem = (itemId: string): void => {
    if (!active) return;
    const updatedAt = new Date().toISOString();
    setWatchlists((list) =>
      list.map((entry) =>
        entry.id === active.id
          ? { ...entry, items: entry.items.filter((item) => item.id !== itemId), updatedAt }
          : entry,
      ),
    );
  };

  const renameWatchlist = (name: string): void => {
    if (!active) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setWatchlists((list) =>
      list.map((entry) =>
        entry.id === active.id
          ? { ...entry, name: trimmed, updatedAt: new Date().toISOString() }
          : entry,
      ),
    );
  };

  const createNew = (): void => {
    const created = createWatchlist(draftName.trim() || `Watchlist ${watchlists.length + 1}`);
    setWatchlists((list) => [...list, created]);
    setActiveId(created.id);
    setDraftName("");
  };

  const removeWatchlist = (id: string): void => {
    setWatchlists((list) => (list.length <= 1 ? list : list.filter((entry) => entry.id !== id)));
    setActiveId((current) => (current === id ? null : current));
  };

  const filteredModels = React.useMemo(() => {
    const needle = term.trim().toLowerCase();
    const list = needle
      ? catalog.models.filter((model) => model.name.toLowerCase().includes(needle))
      : catalog.models;
    return list.slice(0, 40);
  }, [catalog.models, term]);

  const filteredProviders = React.useMemo(() => {
    const needle = term.trim().toLowerCase();
    return needle
      ? catalog.providers.filter((provider) => provider.name.toLowerCase().includes(needle))
      : catalog.providers;
  }, [catalog.providers, term]);

  const filteredProducts = React.useMemo(() => {
    const needle = term.trim().toLowerCase();
    return needle
      ? catalog.harnessProducts.filter(
          (product) =>
            product.name.toLowerCase().includes(needle) ||
            product.vendor.toLowerCase().includes(needle),
        )
      : catalog.harnessProducts;
  }, [catalog.harnessProducts, term]);

  const savedKey = (itemKind: WatchlistItemKind, refId: string): boolean =>
    Boolean(active?.items.some((item) => item.kind === itemKind && item.refId === refId));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Panel className="h-fit">
          <PanelHeader>
            <PanelTitle>Watchlists</PanelTitle>
            <PanelDescription>Saved locally in this browser.</PanelDescription>
          </PanelHeader>
          <PanelBody className="flex flex-col gap-1">
            <ul className="flex flex-col">
              {watchlists.map((entry, index) => {
                const selected = entry.id === active?.id;
                return (
                  <li key={entry.id}>
                    {index > 0 && <Divider />}
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-control px-2 py-1.5 text-xs",
                        selected && "bg-accent",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveId(entry.id)}
                        aria-current={selected ? "true" : undefined}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-control text-left transition-[color] duration-150 ease-out"
                      >
                        <Star
                          className={cn("h-3.5 w-3.5 shrink-0", selected && "text-primary")}
                          aria-hidden="true"
                        />
                        <span
                          className={cn(
                            "truncate",
                            selected ? "font-medium text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {entry.name}
                        </span>
                        <CountPill className="ml-auto">{entry.items.length}</CountPill>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Delete ${entry.name}`}
                        disabled={watchlists.length <= 1}
                        onClick={() => removeWatchlist(entry.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Divider className="mt-1" />
            <div className="flex items-end gap-2 pt-2">
              <Label htmlFor="new-watchlist-name" className="flex-1">
                New watchlist
              </Label>
              <Input
                id="new-watchlist-name"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Name"
                className="h-8 max-w-[140px] text-xs"
              />
              <Button variant="outline" size="sm" onClick={createNew}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Create
              </Button>
            </div>
          </PanelBody>
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel>
            <PanelHeader>
              <PanelTitle>{active ? active.name : "Watchlist"}</PanelTitle>
              <PanelDescription>
                {active
                  ? `${active.items.length} saved ${active.items.length === 1 ? "item" : "items"}. Each item links to its workspace.`
                  : "Loading saved items."}
              </PanelDescription>
            </PanelHeader>
            <PanelBody className="flex flex-col gap-2">
              {active && (
                <div className="flex items-end gap-2">
                  <Label htmlFor="rename-watchlist" className="flex-1">
                    Rename
                  </Label>
                  <Input
                    id="rename-watchlist"
                    key={active.id}
                    defaultValue={active.name}
                    onBlur={(event) => renameWatchlist(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                    className="h-8 max-w-[240px] text-xs"
                  />
                </div>
              )}

              {active && active.items.length > 0 ? (
                <ul className="flex flex-col">
                  {active.items.map((item, index) => (
                    <li key={item.id}>
                      {index > 0 && <Divider />}
                      <div className="flex items-center gap-2 px-0.5 py-1.5 text-xs">
                        <Badge variant="muted">{KIND_LABELS[item.kind]}</Badge>
                        <a
                          href={watchlistItemHref(item)}
                          className="min-w-0 flex-1 truncate underline-offset-2 hover:underline"
                        >
                          {item.label}
                        </a>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Remove ${item.label}`}
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nothing saved yet. Use the panel below to add models, providers, harness products,
                  topics or news queries.
                </p>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Add an item</PanelTitle>
              <PanelDescription>
                Groups are saved as individual model entries. Provider rows can add a whole group in
                one action.
              </PanelDescription>
            </PanelHeader>
            <PanelBody className="flex flex-col gap-3">
              <Segmented
                ariaLabel="Watchlist item type"
                value={kind}
                onChange={(value) => {
                  setKind(value);
                  setTerm("");
                }}
                options={KIND_OPTIONS}
              />

              {kind === "topic" || kind === "news_query" ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-end gap-2">
                    <Label htmlFor="watchlist-term" className="flex-1">
                      {kind === "topic" ? "Topic" : "News query"}
                    </Label>
                    <Input
                      id="watchlist-term"
                      value={term}
                      onChange={(event) => setTerm(event.target.value)}
                      placeholder={
                        kind === "topic" ? "e.g. AI regulation" : "e.g. benchmark update"
                      }
                      className="h-8 max-w-[280px] text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={term.trim().length === 0}
                      onClick={() => {
                        addItem({ kind, refId: term.trim(), label: term.trim() });
                        setTerm("");
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Add
                    </Button>
                  </div>
                  {kind === "topic" && catalog.suggestedTopics.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-2xs text-muted-foreground">Suggestions</span>
                      {catalog.suggestedTopics.map((topic) => (
                        <Button
                          key={topic}
                          variant="ghost"
                          size="xs"
                          onClick={() => addItem({ kind: "topic", refId: topic, label: topic })}
                        >
                          {topic}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Input
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    placeholder={
                      kind === "model"
                        ? "Search models…"
                        : kind === "provider"
                          ? "Search providers…"
                          : "Search harness products…"
                    }
                    aria-label="Search the catalogue"
                    className="h-8 max-w-[320px] text-xs"
                  />

                  <ul className="scroll-thin flex max-h-72 flex-col overflow-y-auto">
                    {kind === "model" &&
                      filteredModels.map((model, index) => {
                        const saved = savedKey("model", model.slug);
                        return (
                          <li key={model.slug}>
                            {index > 0 && <Divider />}
                            <div className="flex items-center gap-2 px-0.5 py-1.5 text-xs">
                              <span className="min-w-0 flex-1 truncate">{model.name}</span>
                              <Button
                                variant="ghost"
                                size="xs"
                                disabled={saved}
                                aria-label={`Add ${model.name}`}
                                onClick={() =>
                                  addItem({ kind: "model", refId: model.slug, label: model.name })
                                }
                              >
                                {saved ? "Saved" : "Add"}
                              </Button>
                            </div>
                          </li>
                        );
                      })}

                    {kind === "provider" &&
                      filteredProviders.map((provider, index) => {
                        const saved = savedKey("provider", provider.id);
                        const group = modelsByProvider.get(provider.id) ?? [];
                        return (
                          <li key={provider.id}>
                            {index > 0 && <Divider />}
                            <div className="flex items-center gap-2 px-0.5 py-1.5 text-xs">
                              <span className="min-w-0 flex-1 truncate">
                                {provider.name}
                                <span className="ml-1 text-2xs text-muted-foreground">
                                  {PROVIDER_GROUP_LABELS[provider.group] ?? provider.group}
                                </span>
                              </span>
                              {group.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => addGroup(group)}
                                  aria-label={`Add ${group.length} ${provider.name} models as a group`}
                                >
                                  Add {group.length} models
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="xs"
                                disabled={saved}
                                aria-label={`Add provider ${provider.name}`}
                                onClick={() =>
                                  addItem({
                                    kind: "provider",
                                    refId: provider.id,
                                    label: provider.name,
                                  })
                                }
                              >
                                {saved ? "Saved" : "Add"}
                              </Button>
                            </div>
                          </li>
                        );
                      })}

                    {kind === "harness_product" &&
                      filteredProducts.map((product, index) => {
                        const saved = savedKey("harness_product", product.id);
                        return (
                          <li key={product.id}>
                            {index > 0 && <Divider />}
                            <div className="flex items-center gap-2 px-0.5 py-1.5 text-xs">
                              <span className="min-w-0 flex-1 truncate">
                                {product.name}
                                <span className="ml-1 text-2xs text-muted-foreground">
                                  {product.vendor}
                                </span>
                              </span>
                              <Button
                                variant="ghost"
                                size="xs"
                                disabled={saved}
                                aria-label={`Add ${product.name}`}
                                onClick={() =>
                                  addItem({
                                    kind: "harness_product",
                                    refId: product.id,
                                    label: product.name,
                                  })
                                }
                              >
                                {saved ? "Saved" : "Add"}
                              </Button>
                            </div>
                          </li>
                        );
                      })}

                    {kind === "model" && filteredModels.length === 0 && (
                      <li className="px-0.5 py-3 text-2xs text-muted-foreground">No matches.</li>
                    )}
                    {kind === "provider" && filteredProviders.length === 0 && (
                      <li className="px-0.5 py-3 text-2xs text-muted-foreground">No matches.</li>
                    )}
                    {kind === "harness_product" && filteredProducts.length === 0 && (
                      <li className="px-0.5 py-3 text-2xs text-muted-foreground">No matches.</li>
                    )}
                  </ul>
                </div>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>

      <p className="text-2xs text-muted-foreground">
        Persistence uses a narrow local-storage store (
        <span className="measured">{STORAGE_KEY}</span>
        ). The interface is designed so Supabase-backed user preferences can be added later without
        changing this screen.
      </p>
    </div>
  );
}
