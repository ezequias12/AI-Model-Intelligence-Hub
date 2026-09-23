/**
 * Artificial Analysis web dataset adapter.
 *
 * Artificial Analysis publishes the data behind its own charts as Schema.org
 * `Dataset` blocks inside `<script type="application/ld+json">`, carrying
 * `citation`, `license` and `isAccessibleForFree`. This adapter reads those
 * blocks. It is deliberately **not** a DOM scraper: the target is a structured,
 * self-describing payload the vendor emits for machine consumption, which is far
 * more stable than markup and states its own provenance.
 *
 * Why it exists at all: the per-task token split is the one figure the vendor's
 * free API does not expose (it is a Pro-tier field). Everything else about a
 * model comes from the API; this source contributes exactly two columns.
 *
 * Scope, stated plainly and repeated in the UI: each Dataset block carries only
 * the models the page is currently displaying — around twenty, not the whole
 * catalogue. The token-per-task chart therefore covers fewer models than the
 * others, by construction rather than by accident.
 *
 * Discipline, matching the harness pricing extractor:
 *  - extraction is driven by a versioned configuration;
 *  - the named block is REQUIRED: if it disappears the adapter fails loudly and
 *    writes nothing, so a vendor change cannot silently blank a metric;
 *  - the raw payload is hashed so a silent change is detectable.
 */
import { hashPayload } from "@/lib/domain/hash";
import { HttpClient } from "./http";
import { adapterFailure, adapterSuccess, type AdapterResult, type FetchLike } from "./types";

export interface ArtificialAnalysisWebConfig {
  sourceUrl: string;
  /** Bump when the vendor's dataset block names or row shape change. */
  configVersion: string;
  /** The dataset this adapter exists for, named exactly as the vendor names it. */
  tokenBlockName: string;
}

export const AA_WEB_CONFIG: ArtificialAnalysisWebConfig = {
  sourceUrl: "https://artificialanalysis.ai/models",
  configVersion: "2026-09-23",
  tokenBlockName: "Output Tokens per Intelligence Index Task",
};

export interface WebTokenEntry {
  slug: string;
  label: string;
  answerTokensPerTask: number | null;
  reasoningTokensPerTask: number | null;
}

/** Every `<script type="application/ld+json">` payload on the page. */
function extractJsonLdBlocks(html: string): unknown[] {
  const pattern = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  const blocks: unknown[] = [];

  for (const match of html.matchAll(pattern)) {
    const raw = match[1];
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // A block we cannot parse is skipped: one malformed script must not take
      // the whole page's dataset down with it.
    }
  }

  return blocks;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** The vendor links each row back to its model page; that path carries the slug. */
function slugFromDetailsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /\/models\/([a-z0-9]+(?:-[a-z0-9]+)*)$/i.exec(value);
  return match?.[1]?.toLowerCase() ?? null;
}

export interface ArtificialAnalysisWebOptions {
  url?: string;
  fetchImpl?: FetchLike;
  client?: HttpClient;
  config?: ArtificialAnalysisWebConfig;
}

/** Parses the page for the token dataset. Exported so it can be tested directly. */
export function parseTokenDataset(
  html: string,
  config: ArtificialAnalysisWebConfig = AA_WEB_CONFIG,
): { ok: true; items: WebTokenEntry[] } | { ok: false; reason: string } {
  const blocks = extractJsonLdBlocks(html);

  const dataset = blocks.find((block): block is Record<string, unknown> => {
    if (typeof block !== "object" || block === null) return false;
    const candidate = block as Record<string, unknown>;
    return candidate["@type"] === "Dataset" && candidate.name === config.tokenBlockName;
  });

  if (!dataset) {
    return {
      ok: false,
      reason: `No "${config.tokenBlockName}" dataset block found. The vendor page shape changed; bump AA_WEB_CONFIG.configVersion after fixing the parser.`,
    };
  }

  const rows = Array.isArray(dataset.data) ? dataset.data : [];
  const items: WebTokenEntry[] = [];

  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const entry = row as Record<string, unknown>;
    const slug = slugFromDetailsUrl(entry.detailsUrl);
    if (!slug) continue;

    const answer = asNumber(entry.answer);
    const reasoning = asNumber(entry.reasoning);
    if (answer === null && reasoning === null) continue;

    items.push({
      slug,
      label: typeof entry.label === "string" ? entry.label : slug,
      answerTokensPerTask: answer,
      reasoningTokensPerTask: reasoning,
    });
  }

  return { ok: true, items };
}

export async function fetchArtificialAnalysisWebTokens(
  options: ArtificialAnalysisWebOptions = {},
): Promise<AdapterResult<WebTokenEntry>> {
  const config = options.config ?? AA_WEB_CONFIG;
  const url = options.url ?? config.sourceUrl;
  const client =
    options.client ??
    new HttpClient({
      fetchImpl: options.fetchImpl,
      userAgent:
        "AI-Model-Intelligence-Hub/0.1 (+artificial-analysis-web-dataset; attribution: Artificial Analysis)",
    });

  const startedAt = Date.now();

  try {
    const html = await client.requestText(url);
    const parsed = parseTokenDataset(html, config);

    if (!parsed.ok) {
      return adapterFailure(
        { code: "schema", message: parsed.reason, retryable: false, retryAfterMs: null },
        {
          items: [],
          skipped: 0,
          rateLimit: client.rateLimit,
          requests: client.requests,
          durationMs: Date.now() - startedAt,
        },
      );
    }

    if (parsed.items.length === 0) {
      return adapterFailure(
        {
          code: "schema",
          message: `The "${config.tokenBlockName}" dataset parsed but carried no usable rows.`,
          retryable: false,
          retryAfterMs: null,
        },
        {
          items: [],
          skipped: 0,
          rateLimit: client.rateLimit,
          requests: client.requests,
          durationMs: Date.now() - startedAt,
        },
      );
    }

    return adapterSuccess(parsed.items, {
      skipped: 0,
      rateLimit: client.rateLimit,
      requests: client.requests,
      durationMs: Date.now() - startedAt,
      // The hash covers the parsed rows, so a change in what we actually read is
      // detectable even when the surrounding page markup churns.
      payloadHash: hashPayload(parsed.items),
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return adapterFailure(
      { code: "network", message, retryable: true, retryAfterMs: null },
      {
        items: [],
        skipped: 0,
        rateLimit: client.rateLimit,
        requests: client.requests,
        durationMs: Date.now() - startedAt,
      },
    );
  }
}
