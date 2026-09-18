/**
 * Runtime data mode.
 *
 * `mock` is the default and never requires credentials. `live` uses real
 * adapters. The mode is resolved once on the server and passed down; the UI
 * labels it explicitly so a mock state is never mistaken for a live one.
 */
import type { DataMode } from "@/lib/domain/schema";
import { resolveDataMode } from "@/lib/domain/schema";

export function getDataMode(): DataMode {
  return resolveDataMode(process.env.NEXT_PUBLIC_DATA_MODE);
}

export function isMockMode(): boolean {
  return getDataMode() === "mock";
}

export interface DataSourceMeta {
  mode: DataMode;
  /** Where the data came from for this render. */
  label: string;
  description: string;
  /** Snapshot timestamp of the underlying dataset, when known. */
  datasetCapturedAt: string | null;
  /**
   * True when live mode was requested but a required integration is missing.
   * The UI must surface this loudly instead of pretending the state is live.
   */
  degraded: boolean;
  degradedReason: string | null;
  /** Integrations that require credentials, and whether they are configured. */
  capabilities: Array<{ key: string; label: string; configured: boolean; note: string }>;
}

export function describeCapabilities(): DataSourceMeta["capabilities"] {
  return [
    {
      key: "artificial_analysis",
      label: "Artificial Analysis Data API",
      configured: Boolean(process.env.ARTIFICIAL_ANALYSIS_API_KEY),
      note: "Primary model metrics source. Attribution required.",
    },
    {
      key: "supabase",
      label: "Supabase",
      configured: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
      ),
      note: "Persistence, snapshots and RLS-protected reads.",
    },
    {
      key: "qstash",
      label: "QStash",
      configured: Boolean(process.env.QSTASH_TOKEN && process.env.QSTASH_CURRENT_SIGNING_KEY),
      note: "Scheduled ingestion with signature verification.",
    },
    {
      key: "social",
      label: "X / social API",
      configured: Boolean(process.env.X_BEARER_TOKEN),
      note: "Authorized API only. X HTML is never scraped as the foundation.",
    },
    {
      key: "world_news",
      label: "World news provider",
      configured: Boolean(process.env.WORLD_NEWS_API_KEY),
      note: "Licensed provider. Political content never feeds model ranking.",
    },
    {
      key: "llm_summary",
      label: "LLM summaries",
      configured: Boolean(process.env.LLM_SUMMARY_API_KEY),
      note: "Optional. Without it, summaries degrade to source excerpts.",
    },
  ];
}

export interface DataSourceMetaOptions {
  degraded?: boolean;
  degradedReason?: string | null;
}

export function buildDataSourceMeta(
  datasetCapturedAt: string | null,
  options: DataSourceMetaOptions = {},
): DataSourceMeta {
  const mode = getDataMode();
  const degraded = options.degraded ?? false;

  return {
    mode,
    label: degraded
      ? "Live mode — degraded"
      : mode === "mock"
        ? "Fixture data (mock mode)"
        : "Live sources",
    description: degraded
      ? "Live mode was requested but a required integration is not configured. Showing the fixture fallback so the app stays usable; no live state is being claimed."
      : mode === "mock"
        ? "Deterministic fixtures. No credentials required. Values are illustrative and labeled as such."
        : "Live adapters. Integrations without credentials degrade gracefully and are listed below.",
    datasetCapturedAt,
    degraded,
    degradedReason: options.degradedReason ?? null,
    capabilities: describeCapabilities(),
  };
}
