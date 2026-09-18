/**
 * Supabase repository.
 *
 * Uses the service-role key on the server only. Rows are validated with Zod at
 * the boundary so a schema drift surfaces as a clear error instead of a
 * malformed object reaching the UI.
 *
 * Missing credentials do not throw here: the caller (getRepository) decides
 * whether to degrade, so the app never crashes from an absent key.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { IngestionRun, NewsItem, WorldNewsItem } from "@/lib/domain/schema";
import {
  changeEventRowSchema,
  harnessChangeEventRowSchema,
  harnessPlanRowSchema,
  harnessPlanSnapshotRowSchema,
  harnessProductRowSchema,
  ingestionRunRowSchema,
  modelRowSchema,
  modelSnapshotRowSchema,
  monitoredAccountRowSchema,
  newsItemRowSchema,
  providerRowSchema,
  socialPostRowSchema,
  sourceRowSchema,
  worldNewsRowSchema,
} from "@/lib/db/rows";
import {
  toChangeEvent,
  toHarnessChangeEvent,
  toHarnessPlan,
  toHarnessPlanSnapshot,
  toHarnessProduct,
  toIngestionRun,
  toModel,
  toModelSnapshot,
  toMonitoredAccount,
  toNewsItem,
  toProvider,
  toSocialPost,
  toSource,
  toWorldNews,
} from "@/lib/db/mappers";
import { buildDataSourceMeta } from "./mode";
import type {
  IngestionRunQuery,
  IntelligenceRepository,
  NewsQuery,
  WorldQuery,
} from "./repository";

export function supabaseCredentials(): { url: string; serviceRoleKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

function parseRows<T>(
  schema: { safeParse: (input: unknown) => { success: boolean; data?: T; error?: unknown } },
  rows: unknown[] | null,
  table: string,
): T[] {
  if (!rows) return [];
  const out: T[] = [];
  for (const row of rows) {
    const parsed = schema.safeParse(row);
    if (parsed.success && parsed.data !== undefined) {
      out.push(parsed.data);
    } else {
      console.error(`[supabase] row failed validation in "${table}"`, parsed.error);
    }
  }
  return out;
}

export function createSupabaseRepository(): IntelligenceRepository | null {
  const credentials = supabaseCredentials();
  if (!credentials) return null;

  const client: SupabaseClient = createClient(credentials.url, credentials.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "ai-model-intelligence-hub" } },
  });

  const unchecked = client as unknown as {
    from: (table: string) => {
      select: (columns?: string) => {
        order: (
          column: string,
          options?: { ascending?: boolean },
        ) => {
          limit: (count: number) => Promise<{ data: unknown[] | null; error: unknown }>;
          eq: (
            column: string,
            value: unknown,
          ) => Promise<{ data: unknown[] | null; error: unknown }>;
          then: (resolve: (value: { data: unknown[] | null; error: unknown }) => void) => void;
        };
      };
    };
  };

  async function selectAll<T>(
    table: string,
    schema: Parameters<typeof parseRows<T>>[0],
    options: { orderBy?: string; ascending?: boolean; limit?: number } = {},
  ): Promise<T[]> {
    const builder = unchecked.from(table).select("*");
    if (options.orderBy) {
      const ordered = builder.order(options.orderBy, { ascending: options.ascending ?? true });
      const { data, error } = await ordered.limit(options.limit ?? 5000);
      if (error) {
        console.error(`[supabase] select from "${table}" failed`, error);
        return [];
      }
      return parseRows<T>(schema, data, table);
    }
    const { data, error } = await builder
      .order("id", { ascending: true })
      .limit(options.limit ?? 5000);
    if (error) {
      console.error(`[supabase] select from "${table}" failed`, error);
      return [];
    }
    return parseRows<T>(schema, data, table);
  }

  return {
    meta: buildDataSourceMeta(new Date().toISOString()),

    async getProviders() {
      const rows = await selectAll("providers", providerRowSchema, { orderBy: "name" });
      return rows.map(toProvider);
    },

    async getModels() {
      const rows = await selectAll("models", modelRowSchema, { orderBy: "name" });
      return rows.map(toModel);
    },

    async getModelSnapshots(modelId) {
      const rows = await selectAll("model_snapshots", modelSnapshotRowSchema, {
        orderBy: "captured_at",
      });
      const filtered = modelId ? rows.filter((row) => row.model_id === modelId) : rows;
      return filtered.map(toModelSnapshot);
    },

    async getNews(query: NewsQuery = {}) {
      const rows = await selectAll("news_items", newsItemRowSchema, {
        orderBy: "published_at",
        ascending: false,
        limit: query.limit ?? 200,
      });
      return filterNewsRows(rows.map(toNewsItem), query);
    },

    async getSocialPosts() {
      const rows = await selectAll("social_posts", socialPostRowSchema, {
        orderBy: "published_at",
        ascending: false,
        limit: 200,
      });
      return rows.map(toSocialPost);
    },

    async getMonitoredAccounts() {
      const rows = await selectAll("monitored_social_accounts", monitoredAccountRowSchema, {
        orderBy: "handle",
      });
      return rows.map(toMonitoredAccount);
    },

    async getHarnessProducts() {
      const rows = await selectAll("harness_products", harnessProductRowSchema, {
        orderBy: "name",
      });
      return rows.map(toHarnessProduct);
    },

    async getHarnessPlans() {
      const rows = await selectAll("harness_plans", harnessPlanRowSchema, {
        orderBy: "canonical_plan_key",
      });
      return rows.map(toHarnessPlan);
    },

    async getHarnessPlanSnapshots(planId) {
      const rows = await selectAll("harness_plan_snapshots", harnessPlanSnapshotRowSchema, {
        orderBy: "captured_at",
        ascending: false,
      });
      const filtered = planId ? rows.filter((row) => row.plan_id === planId) : rows;
      return filtered.map(toHarnessPlanSnapshot);
    },

    async getHarnessChangeEvents() {
      const rows = await selectAll("harness_change_events", harnessChangeEventRowSchema, {
        orderBy: "observed_at",
        ascending: false,
        limit: 300,
      });
      return rows.map(toHarnessChangeEvent);
    },

    async getWorldNews(query: WorldQuery = {}) {
      const rows = await selectAll("world_news_items", worldNewsRowSchema, {
        orderBy: "published_at",
        ascending: false,
        limit: query.limit ?? 200,
      });
      return filterWorldRows(rows.map(toWorldNews), query);
    },

    async getSources() {
      const rows = await selectAll("sources", sourceRowSchema, { orderBy: "priority" });
      return rows.map(toSource);
    },

    async getChangeEvents(limit) {
      const rows = await selectAll("change_events", changeEventRowSchema, {
        orderBy: "observed_at",
        ascending: false,
        limit: limit ?? 200,
      });
      return rows.map(toChangeEvent);
    },

    async getIngestionRuns(query: IngestionRunQuery = {}) {
      const rows = await selectAll("ingestion_runs", ingestionRunRowSchema, {
        orderBy: "started_at",
        ascending: false,
        limit: query.limit ?? 200,
      });
      const runs: IngestionRun[] = rows.map(toIngestionRun);
      return query.sourceId ? runs.filter((run) => run.sourceId === query.sourceId) : runs;
    },
  };
}

export function filterNewsRows(items: NewsItem[], query: NewsQuery): NewsItem[] {
  let result = items;
  const { domain, category, providerId, sourceId } = query;
  if (domain) result = result.filter((item) => item.domain === domain);
  if (category) result = result.filter((item) => item.category === category);
  if (providerId) result = result.filter((item) => item.providerIds.includes(providerId));
  if (sourceId) result = result.filter((item) => item.sourceId === sourceId);
  if (query.search) {
    const needle = query.search.toLowerCase();
    result = result.filter((item) =>
      [item.title, item.excerpt ?? "", item.sourceName, ...item.entities]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }
  return query.limit === undefined ? result : result.slice(0, query.limit);
}

export function filterWorldRows(items: WorldNewsItem[], query: WorldQuery): WorldNewsItem[] {
  let result = items;
  const { region, category, countryCode } = query;
  if (region && region !== "top") {
    result = result.filter((item) => item.region === region);
  }
  if (category) result = result.filter((item) => item.category === category);
  if (countryCode) result = result.filter((item) => item.countryCodes.includes(countryCode));
  if (query.search) {
    const needle = query.search.toLowerCase();
    result = result.filter((item) =>
      [item.headline, item.summary ?? "", item.sourceName].join(" ").toLowerCase().includes(needle),
    );
  }
  return query.limit === undefined ? result : result.slice(0, query.limit);
}
