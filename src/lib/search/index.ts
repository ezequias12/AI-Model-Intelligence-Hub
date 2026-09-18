/**
 * Client-side search index.
 *
 * Small enough to ship to the browser (a few hundred entries) which keeps the
 * command palette instant and dependency-free. Built on the server and passed
 * into the shell as a plain serialisable array.
 */
import type {
  HarnessPlan,
  HarnessProduct,
  Model,
  NewsItem,
  Provider,
  SourceDefinition,
} from "@/lib/domain/schema";
import { NAV_SECTIONS, WORKSPACES } from "@/lib/nav";

export type SearchEntryKind = "page" | "model" | "provider" | "harness_plan" | "source" | "news";

export interface SearchEntry {
  id: string;
  kind: SearchEntryKind;
  title: string;
  subtitle: string;
  href: string;
  /** Lower-cased haystack, precomputed so filtering stays cheap. */
  keywords: string;
}

export interface SearchIndexInput {
  models: Model[];
  providers: Provider[];
  harnessProducts: HarnessProduct[];
  harnessPlans: HarnessPlan[];
  harnessPlanSnapshots: Array<{
    planId: string;
    monthlyPriceUsd: number | null;
    capturedAt: string;
  }>;
  sources: SourceDefinition[];
  news: NewsItem[];
}

export function buildSearchIndex(input: SearchIndexInput): SearchEntry[] {
  const entries: SearchEntry[] = [];
  // A href can legitimately appear both as a primary nav item and as a
  // workspace sub-route (e.g. /models is both). Entries are keyed by href, so
  // the first occurrence wins and the palette never renders duplicate keys.
  const seenIds = new Set<string>();

  const push = (entry: SearchEntry): void => {
    if (seenIds.has(entry.id)) return;
    seenIds.add(entry.id);
    entries.push(entry);
  };

  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      push({
        id: `page:${item.href}`,
        kind: "page",
        title: item.label,
        subtitle: item.description,
        href: item.href,
        keywords: `${item.label} ${item.description} ${section.label}`.toLowerCase(),
      });
    }
  }

  for (const workspace of WORKSPACES) {
    for (const sub of workspace.subNav) {
      push({
        id: `page:${sub.href}`,
        kind: "page",
        title: `${workspace.title} · ${sub.label}`,
        subtitle: sub.description ?? "",
        href: sub.href,
        keywords: `${workspace.title} ${sub.label} ${sub.description ?? ""}`.toLowerCase(),
      });
    }
  }

  const providerById = new Map(input.providers.map((provider) => [provider.id, provider]));

  for (const model of input.models) {
    const provider = providerById.get(model.providerId);
    push({
      id: `model:${model.id}`,
      kind: "model",
      title: model.name,
      subtitle: `${provider?.name ?? "Unknown provider"}${model.openWeight ? " · open-weight" : ""}`,
      href: `/models/${model.slug}`,
      keywords:
        `${model.name} ${model.shortName} ${model.slug} ${provider?.name ?? ""}`.toLowerCase(),
    });
  }

  for (const provider of input.providers) {
    push({
      id: `provider:${provider.id}`,
      kind: "provider",
      title: provider.name,
      subtitle:
        provider.group === "china_based"
          ? "China-based provider"
          : provider.group === "mainstream_global"
            ? "Mainstream provider"
            : "Provider",
      href: `/models/table?providers=${encodeURIComponent(provider.id)}`,
      keywords: `${provider.name} ${provider.slug} ${provider.region ?? ""}`.toLowerCase(),
    });
  }

  const productById = new Map(input.harnessProducts.map((product) => [product.id, product]));
  const latestSnapshotByPlan = new Map<
    string,
    { monthlyPriceUsd: number | null; capturedAt: string }
  >();
  for (const snapshot of input.harnessPlanSnapshots) {
    const existing = latestSnapshotByPlan.get(snapshot.planId);
    if (!existing || Date.parse(snapshot.capturedAt) > Date.parse(existing.capturedAt)) {
      latestSnapshotByPlan.set(snapshot.planId, snapshot);
    }
  }

  for (const plan of input.harnessPlans) {
    const product = productById.get(plan.productId);
    const price = latestSnapshotByPlan.get(plan.id)?.monthlyPriceUsd ?? null;
    push({
      id: `plan:${plan.id}`,
      kind: "harness_plan",
      title: `${product?.name ?? "Unknown product"} — ${plan.name}`,
      subtitle:
        price === null
          ? "Price not documented"
          : `$${price.toFixed(2)}/month (last verified snapshot)`,
      href: `/harness/plans?plan=${encodeURIComponent(plan.id)}`,
      keywords: `${product?.name ?? ""} ${plan.name} ${product?.vendor ?? ""}`.toLowerCase(),
    });
  }

  for (const source of input.sources) {
    push({
      id: `source:${source.id}`,
      kind: "source",
      title: source.name,
      subtitle: `${source.domain} · ${source.type}${source.enabled ? "" : " · disabled"}`,
      href: `/sources?source=${encodeURIComponent(source.id)}`,
      keywords:
        `${source.name} ${source.domain} ${source.type} ${source.notes ?? ""}`.toLowerCase(),
    });
  }

  for (const item of input.news.slice(0, 60)) {
    push({
      id: `news:${item.id}`,
      kind: "news",
      title: item.title,
      subtitle: `${item.sourceName} · ${item.domain.replace(/_/g, " ")}`,
      href: `/news?q=${encodeURIComponent(item.title.slice(0, 48))}`,
      keywords: `${item.title} ${item.sourceName} ${item.entities.join(" ")}`.toLowerCase(),
    });
  }

  return entries;
}

export interface SearchOptions {
  limit?: number;
  kinds?: SearchEntryKind[];
}

/**
 * Substring match with a light relevance boost: prefix-of-title beats
 * contains-in-keywords, so typing "gpt" surfaces the GPT models first.
 */
export function searchEntries(
  index: SearchEntry[],
  query: string,
  options: SearchOptions = {},
): SearchEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return index.filter((entry) => entry.kind === "page").slice(0, options.limit ?? 8);
  }

  const kinds = options.kinds ? new Set(options.kinds) : null;
  const scored: Array<{ entry: SearchEntry; score: number }> = [];

  for (const entry of index) {
    if (kinds && !kinds.has(entry.kind)) continue;

    const titleIndex = entry.title.toLowerCase().indexOf(needle);
    const keywordIndex = entry.keywords.indexOf(needle);
    if (titleIndex === -1 && keywordIndex === -1) continue;

    let score = 0;
    if (titleIndex === 0) score += 100;
    else if (titleIndex > 0) score += 50;
    if (keywordIndex >= 0) score += 10;
    score -= entry.title.length / 100;

    scored.push({ entry, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, options.limit ?? 20).map((item) => item.entry);
}

export const SEARCH_KIND_LABELS: Record<SearchEntryKind, string> = {
  page: "Page",
  model: "Model",
  provider: "Provider",
  harness_plan: "Plan",
  source: "Source",
  news: "News",
};
