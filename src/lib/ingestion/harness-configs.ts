/**
 * Harness pricing-page extraction configurations.
 *
 * These are versioned, explicit selector configurations for the official
 * pricing pages. A page shape change must cause a loud failure, never a silent
 * null or a zero price — that is why every config declares `required` fields.
 *
 * STATUS: the code paths are complete and unit-tested against fixtures. The
 * selector patterns still require live verification against the current pages
 * (see docs/03-implementation/current/implementation-status.md).
 */
import type { HarnessPageConfig } from "@/lib/adapters/harness-html";

export const HARNESS_PAGE_CONFIGS: HarnessPageConfig[] = [
  {
    sourceId: "command-code-pricing",
    configVersion: "2026.09.1",
    sourceUrl: "https://commandcode.ai/pricing",
    plans: [
      {
        planKey: "command-code-go",
        planName: "Go",
        required: ["monthlyPriceUsd", "includedCreditsUsd"],
        fields: {
          monthlyPriceUsd: {
            pattern: /go[^$]{0,40}\$(\d+(?:\.\d+)?)\s*(?:\/|per\s*)?(?:mo|month)/i,
            kind: "number",
          },
          includedCreditsUsd: {
            pattern: /go[^$]{0,80}\$(\d+(?:\.\d+)?)\s*(?:in\s+)?credits/i,
            kind: "number",
          },
          estimatedRequests: {
            pattern: /(\d{1,3}(?:,\d{3})+|\d+)\s*requests/i,
            kind: "number",
            fallback: null,
          },
          resetPeriod: {
            pattern: /(monthly|weekly|daily|rolling)/i,
            kind: "text",
            fallback: "monthly",
          },
          overageModel: {
            pattern: /(pay[\s-]?as[\s-]?you[\s-]?go|hard cap|throttl)/i,
            kind: "text",
            fallback: "unknown",
          },
          platforms: { pattern: /(cli)/i, kind: "text", fallback: "cli" },
        },
      },
      {
        planKey: "command-code-goat",
        planName: "GOAT",
        required: ["monthlyPriceUsd"],
        fields: {
          monthlyPriceUsd: {
            pattern: /goat[^$]{0,40}\$(\d+(?:\.\d+)?)\s*(?:\/|per\s*)?(?:mo|month)/i,
            kind: "number",
          },
          includedCreditsUsd: {
            pattern: /goat[^$]{0,80}\$(\d+(?:\.\d+)?)\s*(?:in\s+)?credits/i,
            kind: "number",
            fallback: null,
          },
          byok: { pattern: /bring your own key|byok/i, kind: "boolean", fallback: false },
          frontierModelAccess: { pattern: /premium|frontier/i, kind: "boolean", fallback: false },
          platforms: { pattern: /(cli)/i, kind: "text", fallback: "cli" },
        },
      },
    ],
  },
  {
    sourceId: "opencode-go",
    configVersion: "2026.09.1",
    sourceUrl: "https://opencode.ai/v2/docs/console/go",
    plans: [
      {
        planKey: "opencode-go",
        planName: "Go",
        required: ["monthlyPriceUsd"],
        fields: {
          monthlyPriceUsd: {
            pattern: /\$(\d+(?:\.\d+)?)\s*(?:\/|per\s*)?(?:mo|month)/i,
            kind: "number",
          },
          includedCreditsUsd: {
            pattern: /\$(\d+(?:\.\d+)?)\s*(?:of\s+)?credits/i,
            kind: "number",
            fallback: null,
          },
          overageModel: {
            pattern: /(pay[\s-]?as[\s-]?you[\s-]?go)/i,
            kind: "text",
            fallback: "unknown",
          },
          platforms: { pattern: /(cli|desktop|web)/i, kind: "text", fallback: "cli" },
        },
      },
    ],
  },
  {
    sourceId: "kilo-pricing",
    configVersion: "2026.09.1",
    sourceUrl: "https://kilo.ai/pricing",
    plans: [
      {
        planKey: "kilo-individual-free",
        planName: "Individual platform",
        required: ["monthlyPriceUsd"],
        fields: {
          monthlyPriceUsd: { pattern: /free/i, kind: "number", fallback: 0 },
          byok: { pattern: /bring your own|byok/i, kind: "boolean", fallback: true },
          platforms: { pattern: /(ide|cli)/i, kind: "text", fallback: "ide" },
        },
      },
      {
        planKey: "kilo-pass",
        planName: "Kilo Pass",
        required: ["monthlyPriceUsd"],
        fields: {
          monthlyPriceUsd: {
            pattern: /\$(\d+(?:\.\d+)?)\s*(?:\/|per\s*)?(?:mo|month)/i,
            kind: "number",
          },
          frontierModelAccess: { pattern: /frontier|premium/i, kind: "boolean", fallback: false },
          platforms: { pattern: /(ide|cli)/i, kind: "text", fallback: "ide" },
        },
      },
    ],
  },
  {
    sourceId: "claude-pricing",
    configVersion: "2026.09.1",
    sourceUrl: "https://claude.com/pricing",
    plans: [
      {
        planKey: "claude-pro",
        planName: "Claude Pro",
        required: ["monthlyPriceUsd"],
        fields: {
          monthlyPriceUsd: { pattern: /pro[^$]{0,60}\$(\d+(?:\.\d+)?)/i, kind: "number" },
          resetPeriod: {
            pattern: /(rolling|5[\s-]?hour|weekly)/i,
            kind: "text",
            fallback: "rolling_5h",
          },
          overageModel: { pattern: /(throttl|rate limit)/i, kind: "text", fallback: "throttle" },
          frontierModelAccess: { pattern: /opus|sonnet/i, kind: "boolean", fallback: true },
          platforms: { pattern: /(cli|desktop|web|ide)/i, kind: "text", fallback: "cli" },
        },
      },
      {
        planKey: "claude-max",
        planName: "Claude Max",
        required: ["monthlyPriceUsd"],
        fields: {
          monthlyPriceUsd: { pattern: /max[^$]{0,60}\$(\d+(?:\.\d+)?)/i, kind: "number" },
          resetPeriod: {
            pattern: /(rolling|5[\s-]?hour|weekly)/i,
            kind: "text",
            fallback: "rolling_5h",
          },
          platforms: { pattern: /(cli|desktop|web|ide)/i, kind: "text", fallback: "cli" },
        },
      },
    ],
  },
  {
    sourceId: "freebuff",
    configVersion: "2026.09.1",
    sourceUrl: "https://freebuff.ai/",
    plans: [
      {
        planKey: "freebuff-free",
        planName: "Ad-supported free tier",
        required: ["monthlyPriceUsd"],
        fields: {
          monthlyPriceUsd: { pattern: /free/i, kind: "number", fallback: 0 },
          resetPeriod: { pattern: /(daily|weekly|monthly)/i, kind: "text", fallback: "daily" },
          platforms: { pattern: /(web|cli)/i, kind: "text", fallback: "web" },
        },
      },
    ],
  },
  {
    sourceId: "cursor-pricing",
    configVersion: "2026.09.1",
    sourceUrl: "https://cursor.com/pricing",
    plans: [
      {
        planKey: "cursor-pro",
        planName: "Pro",
        required: ["monthlyPriceUsd"],
        fields: {
          monthlyPriceUsd: {
            pattern: /pro[^$]{0,60}\$(\d+(?:\.\d+)?)\s*(?:\/|per\s*)?(?:mo|month)/i,
            kind: "number",
          },
          includedCreditsUsd: {
            pattern: /\$(\d+(?:\.\d+)?)\s*(?:of\s+)?credits/i,
            kind: "number",
            fallback: null,
          },
          platforms: { pattern: /(ide|cli|web)/i, kind: "text", fallback: "ide" },
        },
      },
    ],
  },
  {
    sourceId: "windsurf-pricing",
    configVersion: "2026.09.1",
    sourceUrl: "https://windsurf.com/pricing",
    plans: [
      {
        planKey: "windsurf-pro",
        planName: "Pro",
        required: ["monthlyPriceUsd"],
        fields: {
          monthlyPriceUsd: {
            pattern: /pro[^$]{0,60}\$(\d+(?:\.\d+)?)\s*(?:\/|per\s*)?(?:mo|month)/i,
            kind: "number",
          },
          platforms: { pattern: /(ide|web)/i, kind: "text", fallback: "ide" },
        },
      },
    ],
  },
];

export const HARNESS_CONFIG_BY_SOURCE = new Map(
  HARNESS_PAGE_CONFIGS.map((config) => [config.sourceId, config]),
);

/** Boolean used by the runner and by tests to assert config coverage. */
export function hasHarnessConfig(sourceId: string): boolean {
  return HARNESS_CONFIG_BY_SOURCE.has(sourceId);
}
