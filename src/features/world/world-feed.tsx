"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Chip, MetaLine, TrustTierBadge } from "@/components/ui/primitives";
import { RelativeTime } from "@/components/ui/relative-time";
import type { NewsCategory, WorldNewsItem } from "@/lib/domain/schema";
import { countryName, WORLD_REGION_LABELS } from "@/lib/domain/world";
import { DASH, formatEnumLabel } from "@/lib/format";
import { cn } from "@/lib/utils/cn";

const EVENT_TOLERANCE_MS = 60_000;

function eventDiffersFromPublication(item: WorldNewsItem): boolean {
  if (!item.eventAt || !item.publishedAt) return false;
  const event = Date.parse(item.eventAt);
  const published = Date.parse(item.publishedAt);
  if (Number.isNaN(event) || Number.isNaN(published)) return false;
  return Math.abs(event - published) > EVENT_TOLERANCE_MS;
}

export function WorldCard({ item }: { item: WorldNewsItem }): React.JSX.Element {
  const eventDiffers = eventDiffersFromPublication(item);

  return (
    <article className="flex flex-col gap-2.5 rounded-panel border border-border bg-card p-4">
      <MetaLine
        className="text-2xs text-muted-foreground"
        items={[
          <span key="source" className="font-medium text-foreground">
            {item.sourceName}
          </span>,
          <TrustTierBadge key="tier" tier={item.trustTier} />,
          <RelativeTime key="published" value={item.publishedAt} prefix="Published" />,
          eventDiffers ? <RelativeTime key="event" value={item.eventAt} prefix="Event" /> : null,
          item.developing ? (
            <Badge key="developing" variant="warning">
              Developing
            </Badge>
          ) : null,
          item.multipleAccounts ? (
            <Badge key="accounts" variant="outline">
              Multiple accounts
            </Badge>
          ) : null,
        ]}
      />

      <h3 className="text-base font-semibold tracking-[-0.014em]">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="underline-offset-2 hover:underline"
        >
          {item.headline}
          <span className="sr-only"> (opens the article in a new tab)</span>
        </a>
      </h3>

      <p
        className={cn(
          "max-w-[68ch] text-sm",
          item.summary ? "text-muted-foreground" : "text-muted-foreground/70",
        )}
      >
        {item.summary ?? DASH}
      </p>

      {item.multipleAccounts && (
        <p className="max-w-[68ch] text-xs text-muted-foreground">
          Accounts differ. Sources are listed individually and the app does not adjudicate between
          them.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip>{WORLD_REGION_LABELS[item.region]}</Chip>
        {item.countryCodes.map((code) => (
          <Chip key={code}>{countryName(code)}</Chip>
        ))}
      </div>

      <div className="mt-0.5 flex flex-wrap items-center gap-2.5 text-2xs">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Read article
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        {item.primarySourceUrl && (
          <a
            href={item.primarySourceUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-chip bg-primary-muted px-2 py-0.5 font-medium text-primary underline-offset-2 hover:underline"
          >
            Primary source
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
    </article>
  );
}

export function WorldFeed({
  items,
  regionLabel,
}: {
  items: WorldNewsItem[];
  regionLabel: string;
}): React.JSX.Element {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<"all" | NewsCategory>("all");

  const categories = React.useMemo(() => {
    const present = new Set<NewsCategory>();
    for (const item of items) present.add(item.category);
    return [...present].sort((a, b) => formatEnumLabel(a).localeCompare(formatEnumLabel(b)));
  }, [items]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!needle) return true;
      const haystack = [
        item.headline,
        item.summary ?? "",
        item.sourceName,
        WORLD_REGION_LABELS[item.region],
        ...item.countryCodes.map(countryName),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, query, category]);

  return (
    <section className="flex flex-col gap-3" aria-label="World news feed">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-base font-semibold tracking-[-0.014em]">Stories</h2>
        <span className="text-2xs text-muted-foreground">{regionLabel}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search stories…"
            aria-label="Search world stories"
            className="h-8 w-[220px] text-xs"
          />
          <Select
            value={category}
            onChange={(event) => setCategory(event.target.value as "all" | NewsCategory)}
            aria-label="Filter stories by category"
            className="h-8 w-[170px]"
          >
            <option value="all">All categories</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {formatEnumLabel(value)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <p className="tabular text-2xs text-muted-foreground">
        {filtered.length} of {items.length} stories
      </p>

      {filtered.length === 0 ? (
        <Panel>
          <PanelBody className="py-8 text-center text-xs text-muted-foreground">
            No stories match the current filters.
          </PanelBody>
        </Panel>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => (
            <WorldCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
