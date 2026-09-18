import type { Metadata } from "next";
import Link from "next/link";
import { WorldFeed } from "@/features/world/world-feed";
import { loadWorldWorkspace } from "@/lib/data/workspace";
import type { WorldRegion } from "@/lib/domain/schema";
import { WORLD_REGIONS, WORLD_REGION_LABELS, WORLD_TAB_ORDER } from "@/lib/domain/world";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "World & Politics",
  description:
    "Neutral, attributed world and political news. A separate editorial domain that never feeds model or harness recommendations.",
};

const REGION_SET = new Set<string>(WORLD_REGIONS);

function resolveRegion(value: string | undefined): WorldRegion | "top" {
  if (value && REGION_SET.has(value)) return value as WorldRegion;
  return "top";
}

function timestamp(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default async function WorldPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const rawRegion = params.region;
  const region = resolveRegion(typeof rawRegion === "string" ? rawRegion : undefined);

  const { items } = await loadWorldWorkspace();

  const tabs = WORLD_TAB_ORDER.map((value) => ({
    value,
    label: value === "top" ? "Top" : WORLD_REGION_LABELS[value],
    href: value === "top" ? "/world" : `/world?region=${value}`,
    count: value === "top" ? items.length : items.filter((item) => item.region === value).length,
  }));

  const regionItems = region === "top" ? items : items.filter((item) => item.region === region);
  const ordered = [...regionItems].sort(
    (a, b) => timestamp(b.publishedAt) - timestamp(a.publishedAt),
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <p className="max-w-3xl text-xs text-muted-foreground">
          Recent non-AI current affairs, rendered descriptively with explicit sourcing, publication
          and event timestamps, and region and country tags. Nothing here is scored or ranked.
        </p>
      </header>

      <WorldNotice />

      <nav
        aria-label="World regions"
        className="scroll-thin flex flex-wrap items-center gap-1 rounded-panel border border-border bg-surface px-2 py-1.5"
      >
        {tabs.map((tab) => {
          const active = tab.value === region;
          return (
            <Link
              key={tab.value}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-control px-2 py-1 text-xs transition-[background-color,color] duration-150 ease-out",
                active
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              {tab.label}
              <span className="tabular text-2xs text-muted-foreground">{tab.count}</span>
            </Link>
          );
        })}
      </nav>

      <WorldFeed
        items={ordered}
        regionLabel={region === "top" ? "All regions" : WORLD_REGION_LABELS[region]}
      />
    </div>
  );
}

function WorldNotice(): React.JSX.Element {
  return (
    <div
      role="note"
      className="rounded-panel border border-border bg-surface px-3 py-2 text-xs text-muted-foreground"
    >
      <p className="font-medium text-foreground">A separate editorial domain</p>
      <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4">
        <li>
          Every item names its source, trust tier and publication time, shows the event time when it
          differs, and links to the original article and the primary source where one exists.
        </li>
        <li>
          The app does not adjudicate contested claims. Contested stories show a{" "}
          <span className="font-medium text-foreground">Multiple accounts</span> indicator and list
          sources individually instead of a synthesized verdict.
        </li>
        <li>
          Political content never feeds model or harness recommendations. No ideological scores,
          party or candidate recommendations, rankings of political actors, or electoral predictions
          are produced here.
        </li>
      </ul>
    </div>
  );
}
