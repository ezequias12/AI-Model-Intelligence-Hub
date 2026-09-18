"use client";

import * as React from "react";
import { Panel, Section } from "@/components/ui/card";
import { Chip, Segmented, type SegmentedOption } from "@/components/ui/primitives";
import type { NewsItem, Provider, SocialPost } from "@/lib/domain/schema";
import { EmptyState, NewsCard, NewsFeed, NewsProviderFilter, filterNewsItems } from "./feed";
import { NewsSearch } from "./news-search";
import { SocialPulseStrip } from "./social-pulse";

type DomainFilter = "all" | "ai_general" | "provider" | "research" | "harness";

const DOMAIN_OPTIONS: Array<SegmentedOption<DomainFilter>> = [
  { value: "all", label: "All" },
  { value: "ai_general", label: "AI", title: "AI General" },
  { value: "provider", label: "Providers", title: "Model Providers" },
  { value: "research", label: "Research", title: "Research & Benchmarks" },
  { value: "harness", label: "Harness", title: "Harness ecosystem" },
];

function isDomainFilter(value: string): value is DomainFilter {
  return DOMAIN_OPTIONS.some((option) => option.value === value);
}

/** Ranks items so the lead story is the strongest primary-source report available. */
function pickLeadStory(items: NewsItem[]): NewsItem | null {
  const anchors = items.filter((item) => item.clusterId === null);
  const pool = anchors.length > 0 ? anchors : items;

  const ranked = [...pool].sort((a, b) => {
    const provenanceRank = (item: NewsItem): number =>
      item.official ? 0 : item.corroborated ? 1 : 2;
    if (provenanceRank(a) !== provenanceRank(b)) return provenanceRank(a) - provenanceRank(b);
    if (a.trustTier !== b.trustTier) return a.trustTier - b.trustTier;
    const at = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const bt = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return bt - at;
  });

  return ranked[0] ?? null;
}

export function NewsOverview({
  news,
  socialPosts,
  providers,
}: {
  news: NewsItem[];
  socialPosts: SocialPost[];
  providers: Provider[];
}): React.JSX.Element {
  const [query, setQuery] = React.useState("");
  const [domain, setDomain] = React.useState<DomainFilter>("all");
  const [providerId, setProviderId] = React.useState("all");

  const scoped = React.useMemo(
    () => (domain === "all" ? news : news.filter((item) => item.domain === domain)),
    [news, domain],
  );

  const filtered = React.useMemo(
    () => filterNewsItems(scoped, query, providerId),
    [scoped, query, providerId],
  );

  const lead = React.useMemo(() => pickLeadStory(filtered), [filtered]);

  const trending = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of filtered) {
      for (const entity of item.entities) counts.set(entity, (counts.get(entity) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10);
  }, [filtered]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-panel border border-border bg-surface px-3 py-2">
        <div className="min-w-[240px] flex-1">
          <NewsSearch
            query={query}
            onQueryChange={setQuery}
            domain={domain}
            resultCount={filtered.length}
            placeholder="Search headlines, sources and entities"
            onApplySaved={(entry) => {
              setQuery(entry.query);
              if (isDomainFilter(entry.domain)) setDomain(entry.domain);
            }}
          />
        </div>
        <Segmented
          ariaLabel="Filter by news domain"
          size="sm"
          value={domain}
          onChange={setDomain}
          options={DOMAIN_OPTIONS}
        />
        <NewsProviderFilter providers={providers} value={providerId} onChange={setProviderId} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Section
            title="Lead story"
            description="The strongest current primary-source report across the selected categories."
          >
            {lead ? (
              <Panel className="p-4">
                <NewsCard item={lead} featured />
              </Panel>
            ) : (
              <EmptyState label="No lead story matches the current filters." />
            )}
          </Section>

          <Section
            title="Latest"
            description="A compact, newest-first cross-category feed."
            actions={
              <span className="tabular text-2xs text-muted-foreground">
                {filtered.length} report{filtered.length === 1 ? "" : "s"}
              </span>
            }
          >
            <NewsFeed
              items={filtered.slice(0, 12)}
              compact
              emptyLabel="No reports match the current filters."
            />
          </Section>
        </div>

        <div className="flex flex-col gap-4">
          <Section title="Trending entities">
            {trending.length === 0 ? (
              <EmptyState label="No entities detected for the current filters." />
            ) : (
              <Panel className="p-4">
                <ul className="flex flex-wrap gap-1.5">
                  {trending.map(([entity, count]) => (
                    <li key={entity}>
                      <Chip
                        title={`${count} mention${count === 1 ? "" : "s"}`}
                        className="border-transparent bg-muted text-2xs text-muted-foreground"
                      >
                        <span>{entity}</span>
                        <span className="tabular text-muted-foreground">{count}</span>
                      </Chip>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </Section>

          <Section
            title="Social pulse"
            description="Monitored accounts ingested through authorized platform APIs only."
          >
            <Panel className="p-4">
              <SocialPulseStrip posts={socialPosts} />
            </Panel>
          </Section>
        </div>
      </div>
    </div>
  );
}
