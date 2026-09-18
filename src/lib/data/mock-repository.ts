/**
 * Mock repository.
 *
 * Backed entirely by deterministic fixtures. This is the default data source
 * when no credentials are configured, and it powers every test.
 */
import type { IngestionRun } from "@/lib/domain/schema";
import { getFixtures } from "@/lib/fixtures";
import { buildFixtureIngestionRuns } from "@/lib/fixtures/ingestion";
import { buildDataSourceMeta } from "./mode";
import type {
  IngestionLedger,
  IngestionRunQuery,
  IntelligenceRepository,
  NewsQuery,
  WorldQuery,
} from "./repository";

export function createMockRepository(): IntelligenceRepository {
  const fixtures = getFixtures();
  let ingestionCache: IngestionLedger | null = null;

  const ingestion = (): IngestionLedger => {
    if (!ingestionCache) {
      ingestionCache = {
        runs: buildFixtureIngestionRuns(fixtures.sources, fixtures.now),
        sources: fixtures.sources,
      };
    }
    return ingestionCache;
  };

  return {
    meta: buildDataSourceMeta(fixtures.now.toISOString()),

    async getProviders() {
      return fixtures.providers;
    },

    async getModels() {
      return fixtures.models;
    },

    async getModelSnapshots(modelId) {
      if (!modelId) return fixtures.modelSnapshots;
      return fixtures.modelSnapshots.filter((snapshot) => snapshot.modelId === modelId);
    },

    async getNews(query = {}) {
      return filterNews(fixtures.news, query);
    },

    async getSocialPosts() {
      return fixtures.socialPosts;
    },

    async getMonitoredAccounts() {
      return fixtures.monitoredAccounts;
    },

    async getHarnessProducts() {
      return fixtures.harnessProducts;
    },

    async getHarnessPlans() {
      return fixtures.harnessPlans;
    },

    async getHarnessPlanSnapshots(planId) {
      if (!planId) return fixtures.harnessPlanSnapshots;
      return fixtures.harnessPlanSnapshots.filter((snapshot) => snapshot.planId === planId);
    },

    async getHarnessChangeEvents() {
      return fixtures.harnessChangeEvents;
    },

    async getWorldNews(query = {}) {
      return filterWorldNews(fixtures.worldNews, query);
    },

    async getSources() {
      return fixtures.sources;
    },

    async getChangeEvents(limit) {
      return limit === undefined ? fixtures.changeEvents : fixtures.changeEvents.slice(0, limit);
    },

    async getIngestionRuns(query: IngestionRunQuery = {}) {
      const runs: IngestionRun[] = ingestion().runs;
      const filtered = query.sourceId
        ? runs.filter((run) => run.sourceId === query.sourceId)
        : runs;
      return query.limit === undefined ? filtered : filtered.slice(0, query.limit);
    },
  };
}

export function filterNews(
  items: ReturnType<typeof getFixtures>["news"],
  query: NewsQuery,
): ReturnType<typeof getFixtures>["news"] {
  let result = items;

  if (query.domain) result = result.filter((item) => item.domain === query.domain);
  if (query.category) result = result.filter((item) => item.category === query.category);
  if (query.providerId) {
    result = result.filter((item) => item.providerIds.includes(query.providerId as string));
  }
  if (query.sourceId) result = result.filter((item) => item.sourceId === query.sourceId);

  if (query.search) {
    const needle = query.search.toLowerCase();
    result = result.filter((item) => {
      const haystack = [item.title, item.excerpt ?? "", item.sourceName, ...item.entities]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }

  const sorted = [...result].sort((a, b) => {
    const at = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const bt = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return bt - at;
  });

  return query.limit === undefined ? sorted : sorted.slice(0, query.limit);
}

export function filterWorldNews(
  items: ReturnType<typeof getFixtures>["worldNews"],
  query: WorldQuery,
): ReturnType<typeof getFixtures>["worldNews"] {
  let result = items;

  if (query.region && query.region !== "top") {
    result = result.filter((item) => item.region === query.region);
  }
  if (query.category) result = result.filter((item) => item.category === query.category);
  if (query.countryCode) {
    result = result.filter((item) => item.countryCodes.includes(query.countryCode as string));
  }
  if (query.search) {
    const needle = query.search.toLowerCase();
    result = result.filter((item) =>
      [item.headline, item.summary ?? "", item.sourceName].join(" ").toLowerCase().includes(needle),
    );
  }

  const sorted = [...result].sort((a, b) => {
    const at = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const bt = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return bt - at;
  });

  return query.limit === undefined ? sorted : sorted.slice(0, query.limit);
}
