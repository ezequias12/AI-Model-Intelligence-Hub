/**
 * Controlled harness pricing-page extraction.
 *
 * Pricing pages are the hardest source class: no structured API, shapes change
 * without notice, and a wrong value is worse than no value. The policy is:
 *
 *  - extraction is driven by an explicit, versioned configuration (regex-based
 *    field extractors with fixtures and selector tests);
 *  - required fields must resolve, otherwise the adapter FAILS LOUDLY and
 *    writes nothing;
 *  - a raw source hash is always recorded so a silent change is detectable;
 *  - null is never written in place of an expected value.
 */
import type { HarnessPlanSnapshot } from "@/lib/domain/schema";
import { hashPayload, toPlainTextSafe } from "./text-utils";
import { adapterFailure, adapterSuccess, type AdapterResult } from "./types";

export type FieldKind = "number" | "text" | "boolean";

export interface FieldExtractor {
  /** Regex applied to the normalized text of the page. */
  pattern: RegExp;
  /** Capture group index holding the value. Defaults to 1. */
  group?: number;
  kind: FieldKind;
  /** Value written when the pattern does not match AND the field is not required. */
  fallback?: number | string | boolean | null;
}

export interface PlanExtractionConfig {
  planKey: string;
  planName: string;
  fields: Partial<Record<ExtractedField, FieldExtractor>>;
  /** Fields that must resolve; otherwise the run fails. */
  required: ExtractedField[];
}

export type ExtractedField =
  | "monthlyPriceUsd"
  | "annualPriceUsd"
  | "includedCreditsUsd"
  | "estimatedRequests"
  | "resetPeriod"
  | "overageModel"
  | "byok"
  | "frontierModelAccess"
  | "models"
  | "platforms"
  | "regions"
  | "notes";

export interface HarnessPageConfig {
  sourceId: string;
  /** Version of this extraction config; bump when selectors change. */
  configVersion: string;
  sourceUrl: string;
  plans: PlanExtractionConfig[];
}

export interface ExtractedPlan {
  planKey: string;
  planName: string;
  snapshot: Omit<
    HarnessPlanSnapshot,
    "id" | "planId" | "capturedAt" | "sourceId" | "sourceUrl" | "rawSourceHash"
  >;
}

const RESET_PERIODS = ["daily", "weekly", "monthly", "rolling_5h", "none"] as const;
const OVERAGE_MODELS = ["hard_cap", "pay_as_you_go", "throttle", "unknown"] as const;
const PLATFORMS = ["cli", "desktop", "ide", "web", "cloud_agent"] as const;

function coerce(value: string | undefined, kind: FieldKind): unknown {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  switch (kind) {
    case "number": {
      const parsed = Number(trimmed.replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    case "boolean":
      return /^(true|yes|included|supported)$/i.test(trimmed);
    case "text":
    default:
      return trimmed;
  }
}

function extractNumber(fields: Record<string, unknown>, key: string): number | null {
  const value = fields[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function extractText(fields: Record<string, unknown>, key: string): string | null {
  const value = fields[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function extractBoolean(fields: Record<string, unknown>, key: string): boolean {
  return fields[key] === true;
}

function extractList(fields: Record<string, unknown>, key: string): string[] {
  const value = fields[key];
  if (typeof value !== "string" || value.length === 0) return [];
  return value
    .split(/[,|]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function extractPlan(
  html: string,
  config: PlanExtractionConfig,
  sourceUrl: string,
): { ok: true; plan: ExtractedPlan } | { ok: false; reason: string } {
  const text = toPlainTextSafe(html);
  const fields: Record<string, unknown> = {};

  for (const [field, extractor] of Object.entries(config.fields) as Array<
    [ExtractedField, FieldExtractor]
  >) {
    if (!extractor) continue;
    const match = extractor.pattern.exec(text);
    const raw = match ? match[extractor.group ?? 1] : undefined;
    const coerced = coerce(raw, extractor.kind);

    if (coerced === undefined) {
      if (extractor.fallback !== undefined) fields[field] = extractor.fallback;
      continue;
    }
    fields[field] = coerced;
  }

  const requiredMissing = config.required.filter((field) => !(field in fields));
  if (requiredMissing.length > 0) {
    return {
      ok: false,
      reason: `Required fields did not resolve: ${requiredMissing.join(", ")}. Page shape likely changed; nothing was written.`,
    };
  }

  const resetRaw = extractText(fields, "resetPeriod");
  const overageRaw = extractText(fields, "overageModel");
  const estimatedRequests = extractNumber(fields, "estimatedRequests");

  return {
    ok: true,
    plan: {
      planKey: config.planKey,
      planName: config.planName,
      snapshot: {
        monthlyPriceUsd: extractNumber(fields, "monthlyPriceUsd"),
        annualPriceUsd: extractNumber(fields, "annualPriceUsd"),
        includedCreditsUsd: extractNumber(fields, "includedCreditsUsd"),
        estimatedRequests,
        // Only recorded when the vendor actually documents a request estimate.
        estimatedRequestsSourceUrl: estimatedRequests === null ? null : sourceUrl,
        resetPeriod: (RESET_PERIODS as readonly string[]).includes(resetRaw ?? "")
          ? (resetRaw as HarnessPlanSnapshot["resetPeriod"])
          : "none",
        overageModel: (OVERAGE_MODELS as readonly string[]).includes(overageRaw ?? "")
          ? (overageRaw as HarnessPlanSnapshot["overageModel"])
          : "unknown",
        byok: extractBoolean(fields, "byok"),
        models: extractList(fields, "models"),
        frontierModelAccess: extractBoolean(fields, "frontierModelAccess"),
        platforms: extractList(fields, "platforms").filter(
          (value): value is (typeof PLATFORMS)[number] =>
            (PLATFORMS as readonly string[]).includes(value),
        ),
        regions: extractList(fields, "regions"),
        notes: extractText(fields, "notes"),
      },
    },
  };
}

export async function extractHarnessPage(
  html: string,
  config: HarnessPageConfig,
  now: Date = new Date(),
): Promise<AdapterResult<ExtractedPlan>> {
  const startedAt = Date.now();
  const plans: ExtractedPlan[] = [];
  const failures: string[] = [];

  for (const planConfig of config.plans) {
    const result = extractPlan(html, planConfig, config.sourceUrl);
    if (result.ok) plans.push(result.plan);
    else failures.push(`${planConfig.planKey}: ${result.reason}`);
  }

  if (plans.length === 0) {
    return adapterFailure(
      {
        code: "parse",
        message: failures.join(" | ") || "No plan could be extracted from the page.",
        retryable: false,
        retryAfterMs: null,
      },
      { durationMs: Date.now() - startedAt, requests: 1 },
    );
  }

  return adapterSuccess(plans, {
    skipped: failures.length,
    requests: 1,
    durationMs: Date.now() - startedAt,
    payloadHash: hashPayload({
      sourceId: config.sourceId,
      version: config.configVersion,
      at: now.toISOString(),
    }),
  });
}

/** Normalizes a plan name into a stable key so renames do not fork history. */
export function canonicalPlanKey(productSlug: string, planName: string): string {
  const slug = planName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${productSlug}-${slug}`;
}
