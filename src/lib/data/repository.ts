/**
 * Repository contract.
 *
 * The UI depends on this interface only. Mock and Supabase implementations are
 * interchangeable, which is what makes mock mode a genuine first-class mode
 * rather than a special case sprinkled through the components.
 */
import type {
  ChangeEvent,
  HarnessChangeEvent,
  HarnessPlan,
  HarnessPlanSnapshot,
  HarnessProduct,
  IngestionRun,
  Model,
  ModelSnapshot,
  MonitoredAccount,
  NewsItem,
  Provider,
  SocialPost,
  SourceDefinition,
  WorldNewsItem,
} from "@/lib/domain/schema";
import type { DataSourceMeta } from "./mode";

export interface NewsQuery {
  domain?: NewsItem["domain"];
  category?: NewsItem["category"];
  providerId?: string;
  sourceId?: string;
  /** Full-text-ish filter over title, excerpt and entities. */
  search?: string;
  limit?: number;
}

export interface WorldQuery {
  region?: WorldNewsItem["region"] | "top";
  category?: WorldNewsItem["category"];
  countryCode?: string;
  search?: string;
  limit?: number;
}

export interface IngestionRunQuery {
  sourceId?: string;
  limit?: number;
}

export interface IngestionLedger {
  runs: IngestionRun[];
  sources: SourceDefinition[];
}

export interface IntelligenceRepository {
  readonly meta: DataSourceMeta;

  getProviders(): Promise<Provider[]>;
  getModels(): Promise<Model[]>;
  getModelSnapshots(modelId?: string): Promise<ModelSnapshot[]>;

  getNews(query?: NewsQuery): Promise<NewsItem[]>;
  getSocialPosts(): Promise<SocialPost[]>;
  getMonitoredAccounts(): Promise<MonitoredAccount[]>;

  getHarnessProducts(): Promise<HarnessProduct[]>;
  getHarnessPlans(): Promise<HarnessPlan[]>;
  getHarnessPlanSnapshots(planId?: string): Promise<HarnessPlanSnapshot[]>;
  getHarnessChangeEvents(): Promise<HarnessChangeEvent[]>;

  getWorldNews(query?: WorldQuery): Promise<WorldNewsItem[]>;

  getSources(): Promise<SourceDefinition[]>;
  getChangeEvents(limit?: number): Promise<ChangeEvent[]>;
  getIngestionRuns(query?: IngestionRunQuery): Promise<IngestionRun[]>;
}
