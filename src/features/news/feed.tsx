"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Divider, Panel, Section } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Chip, TrustTierBadge } from "@/components/ui/primitives";
import { RelativeTime } from "@/components/ui/relative-time";
import { formatEnumLabel } from "@/lib/format";
import { cn } from "@/lib/utils/cn";
import type { NewsItem, Provider } from "@/lib/domain/schema";
import { NewsSearch } from "./news-search";

export interface NewsGroup {
  anchor: NewsItem;
  /** Secondary reports of the same event, each with its own source and trust tier. */
  reports: NewsItem[];
}

/**
 * Groups items around their cluster anchor. The anchor is the item whose
 * `clusterId` is null; every item with a non-null `clusterId` points at the
 * anchor for the same event. Groups are built from the array already in hand —
 * no additional fetch.
 */
export function groupNewsByCluster(items: NewsItem[]): NewsGroup[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const groups = new Map<string, NewsGroup>();
  const order: string[] = [];

  for (const item of items) {
    if (item.clusterId !== null) continue;
    groups.set(item.id, { anchor: item, reports: [] });
    order.push(item.id);
  }

  for (const item of items) {
    if (item.clusterId === null) continue;
    const anchor = byId.get(item.clusterId);
    const group = anchor ? groups.get(anchor.id) : undefined;
    if (group) {
      group.reports.push(item);
      continue;
    }
    // The anchor fell outside the filtered array: stand the report up alone.
    if (groups.has(item.id)) continue;
    groups.set(item.id, { anchor: item, reports: [] });
    order.push(item.id);
  }

  return order
    .map((id) => groups.get(id))
    .filter((group): group is NewsGroup => group !== undefined);
}

/** Shared news search predicate used by every feed surface. */
export function filterNewsItems(items: NewsItem[], query: string, providerId: string): NewsItem[] {
  const needle = query.trim().toLowerCase();

  return items.filter((item) => {
    if (providerId !== "all" && !item.providerIds.includes(providerId)) return false;
    if (needle.length === 0) return true;
    const haystack = [
      item.title,
      item.summary ?? "",
      item.excerpt ?? "",
      item.sourceName,
      ...item.entities,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function EmptyState({
  label,
  className,
}: {
  label: string;
  className?: string;
}): React.JSX.Element {
  return (
    <p
      role="status"
      className={cn(
        "rounded-panel border border-dashed border-border bg-surface px-4 py-6 text-center text-xs text-muted-foreground",
        className,
      )}
    >
      {label}
    </p>
  );
}

/**
 * Feed card anatomy: source, trust tier, provenance badges, relative time,
 * headline linking to the original URL, excerpt, category and entity chips.
 */
export function NewsCard({
  item,
  compact = false,
  featured = false,
  className,
}: {
  item: NewsItem;
  compact?: boolean;
  featured?: boolean;
  className?: string;
}): React.JSX.Element {
  const excerpt = item.summary ?? item.excerpt;

  return (
    <article className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground">
        <span className="font-medium text-foreground">{item.sourceName}</span>
        <TrustTierBadge tier={item.trustTier} />
        {item.official && <Badge variant="primary">Official</Badge>}
        {item.developing && <Badge variant="warning">Developing</Badge>}
        {item.corroborated && <Badge variant="success">Corroborated</Badge>}
        <RelativeTime value={item.publishedAt} className="tabular" />
      </div>

      <h3 className={cn("font-semibold leading-snug", featured ? "text-lg" : "text-sm")}>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          className="underline-offset-2 hover:underline"
        >
          {item.title}
          <ExternalLink
            className="ml-1 inline-block h-3 w-3 align-[-0.125em] text-muted-foreground"
            aria-hidden="true"
          />
          <span className="sr-only"> (opens the original article in a new tab)</span>
        </a>
      </h3>

      {!compact && excerpt && (
        <p className="max-w-[68ch] text-xs text-muted-foreground">{excerpt}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">{formatEnumLabel(item.category)}</Badge>
        {item.entities.map((entity) => (
          <Chip
            key={entity}
            title={entity}
            className="border-transparent bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground"
          >
            {entity}
          </Chip>
        ))}
      </div>
    </article>
  );
}

export function NewsFeedItem({
  group,
  compact = false,
}: {
  group: NewsGroup;
  compact?: boolean;
}): React.JSX.Element {
  return (
    <Panel className={cn(compact ? "p-3" : "p-4")}>
      <NewsCard item={group.anchor} compact={compact} />

      {group.reports.length > 0 && (
        <>
          <Divider className="mt-3" />
          <details className="mt-2">
            <summary className="cursor-pointer select-none text-2xs font-medium text-muted-foreground transition-[color] duration-150 ease-out hover:text-foreground">
              {group.reports.length} more report{group.reports.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-1 flex flex-col divide-y divide-border">
              {group.reports.map((report) => (
                <li key={report.id} className="flex flex-wrap items-center gap-2 py-1.5 text-xs">
                  <span className="font-medium">{report.sourceName}</span>
                  <TrustTierBadge tier={report.trustTier} />
                  <a
                    href={report.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="min-w-0 flex-1 underline-offset-2 hover:underline"
                  >
                    {report.title}
                  </a>
                  <RelativeTime
                    value={report.publishedAt}
                    className="tabular shrink-0 text-2xs text-muted-foreground"
                  />
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </Panel>
  );
}

export function NewsFeed({
  items,
  compact = false,
  emptyLabel = "No reports match the current filters.",
  className,
}: {
  items: NewsItem[];
  compact?: boolean;
  emptyLabel?: string;
  className?: string;
}): React.JSX.Element {
  const groups = React.useMemo(() => groupNewsByCluster(items), [items]);

  if (groups.length === 0) return <EmptyState label={emptyLabel} className={className} />;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {groups.map((group) => (
        <NewsFeedItem key={group.anchor.id} group={group} compact={compact} />
      ))}
    </div>
  );
}

/** Provider filter: narrows a feed to items tagged with the chosen provider id. */
export function NewsProviderFilter({
  providers,
  value,
  onChange,
  className,
}: {
  providers: Provider[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}): React.JSX.Element {
  return (
    <label className={cn("flex items-center gap-2", className)}>
      <span className="text-2xs font-medium text-muted-foreground">Provider</span>
      <Select
        aria-label="Filter by provider"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-[184px]"
      >
        <option value="all">All providers</option>
        {providers.map((provider) => (
          <option key={provider.id} value={provider.id}>
            {provider.name}
          </option>
        ))}
      </Select>
    </label>
  );
}

/** Composed single-domain view: search, provider filter, saved queries and the feed. */
export function NewsDomainView({
  title,
  description,
  domain,
  items,
  providers,
  emptyLabel,
}: {
  title: string;
  description: string;
  domain: string;
  items: NewsItem[];
  providers: Provider[];
  emptyLabel?: string;
}): React.JSX.Element {
  const [query, setQuery] = React.useState("");
  const [providerId, setProviderId] = React.useState("all");

  const filtered = React.useMemo(
    () => filterNewsItems(items, query, providerId),
    [items, query, providerId],
  );

  return (
    <Section title={title} description={description}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-panel border border-border bg-surface px-3 py-2">
          <div className="min-w-[240px] flex-1">
            <NewsSearch
              query={query}
              onQueryChange={setQuery}
              domain={domain}
              resultCount={filtered.length}
              placeholder="Search headlines, sources and entities"
              onApplySaved={(entry) => setQuery(entry.query)}
            />
          </div>
          <NewsProviderFilter providers={providers} value={providerId} onChange={setProviderId} />
        </div>
        <NewsFeed items={filtered} emptyLabel={emptyLabel} />
      </div>
    </Section>
  );
}
