/**
 * Fixture harness (coding-agent subscription) data.
 *
 * FIXTURE DATA. The seed values mirror what official pricing pages documented at
 * specification time; the app still treats them as snapshots with a
 * `capturedAt` and a `sourceUrl`, never as permanent truth.
 */
import type {
  HarnessChangeEvent,
  HarnessPlan,
  HarnessPlanSnapshot,
  HarnessProduct,
} from "@/lib/domain/schema";
import { hashPayload } from "@/lib/domain/hash";

interface PlanSeed {
  key: string;
  name: string;
  monthlyPriceUsd: number | null;
  annualPriceUsd: number | null;
  includedCreditsUsd: number | null;
  estimatedRequests: number | null;
  resetPeriod: HarnessPlanSnapshot["resetPeriod"];
  overageModel: HarnessPlanSnapshot["overageModel"];
  byok: boolean;
  models: string[];
  frontierModelAccess: boolean;
  platforms: HarnessPlanSnapshot["platforms"];
  regions: string[];
  notes: string | null;
  active: boolean;
  capturedHoursAgo: number;
}

interface ProductSeed {
  slug: string;
  name: string;
  vendor: string;
  website: string;
  docsUrl: string | null;
  pricingUrl: string | null;
  changelogUrl: string | null;
  openSource: boolean;
  repoUrl: string | null;
  platforms: HarnessProduct["platforms"];
  sourceId: string;
  plans: PlanSeed[];
}

const P = (
  key: string,
  name: string,
  monthlyPriceUsd: number | null,
  includedCreditsUsd: number | null,
  extra: Partial<PlanSeed> = {},
): PlanSeed => ({
  key,
  name,
  monthlyPriceUsd,
  annualPriceUsd: null,
  includedCreditsUsd,
  estimatedRequests: null,
  resetPeriod: "monthly",
  overageModel: "unknown",
  byok: false,
  models: [],
  frontierModelAccess: false,
  platforms: ["cli"],
  regions: ["Global"],
  notes: null,
  active: true,
  capturedHoursAgo: 6,
  ...extra,
});

export const HARNESS_PRODUCT_SEEDS: ProductSeed[] = [
  {
    slug: "command-code",
    name: "Command Code",
    vendor: "Command Code",
    website: "https://commandcode.ai",
    docsUrl: "https://commandcode.ai/docs",
    pricingUrl: "https://commandcode.ai/pricing",
    changelogUrl: "https://commandcode.ai/changelog",
    openSource: false,
    repoUrl: null,
    platforms: ["cli", "ide"],
    sourceId: "command-code-pricing",
    plans: [
      P("go", "Go", 1, 10, {
        estimatedRequests: 15000,
        resetPeriod: "monthly",
        overageModel: "hard_cap",
        models: ["Open-weight frontier models", "Selected premium models (limited)"],
        frontierModelAccess: false,
        platforms: ["cli", "ide"],
        notes: "Vendor documents an approximate monthly request estimate.",
        capturedHoursAgo: 4,
      }),
      P("goat", "GOAT", 10, 60, {
        overageModel: "pay_as_you_go",
        models: ["Frontier providers", "Open-weight providers", "Premium reasoning models"],
        frontierModelAccess: true,
        platforms: ["cli", "ide"],
        notes: "Larger included-credit allocation than Go; premium model access documented.",
        capturedHoursAgo: 4,
      }),
    ],
  },
  {
    slug: "opencode",
    name: "OpenCode",
    vendor: "OpenCode",
    website: "https://opencode.ai",
    docsUrl: "https://opencode.ai/docs",
    pricingUrl: "https://opencode.ai/pricing",
    changelogUrl: "https://opencode.ai/changelog",
    openSource: true,
    repoUrl: "https://github.com/sst/opencode",
    platforms: ["cli", "desktop", "web"],
    sourceId: "opencode-go",
    plans: [
      P("free", "OpenCode (BYOK)", 0, null, {
        overageModel: "pay_as_you_go",
        byok: true,
        models: ["Bring your own provider"],
        platforms: ["cli", "desktop"],
        notes: "Open-source client; inference is bring-your-own-key.",
      }),
      P("go", "Go", 10, 25, {
        overageModel: "pay_as_you_go",
        models: ["Curated frontier model list", "Open-weight models"],
        frontierModelAccess: true,
        platforms: ["cli", "desktop", "web"],
        notes: "First month documented at $5, then $10/month.",
        capturedHoursAgo: 5,
      }),
    ],
  },
  {
    slug: "claude-code",
    name: "Claude Code",
    vendor: "Anthropic",
    website: "https://claude.com/product/claude-code",
    docsUrl: "https://docs.claude.com/en/docs/claude-code",
    pricingUrl: "https://claude.com/pricing",
    changelogUrl: "https://docs.claude.com/en/release-notes/claude-code",
    openSource: false,
    repoUrl: null,
    platforms: ["cli", "ide", "web", "desktop", "cloud_agent"],
    sourceId: "claude-pricing",
    plans: [
      P("pro", "Claude Pro", 20, null, {
        resetPeriod: "rolling_5h",
        overageModel: "throttle",
        models: ["Claude Sonnet tier", "Claude Opus tier (limited)"],
        frontierModelAccess: true,
        platforms: ["cli", "ide", "web", "desktop"],
        notes: "Claude Code is included with a Pro subscription; usage limits apply.",
        capturedHoursAgo: 7,
      }),
      P("max-5x", "Claude Max 5x", 100, null, {
        resetPeriod: "rolling_5h",
        overageModel: "throttle",
        models: ["Claude Sonnet tier", "Claude Opus tier"],
        frontierModelAccess: true,
        platforms: ["cli", "ide", "web", "desktop", "cloud_agent"],
        notes: "Higher usage allowance than Pro.",
        capturedHoursAgo: 7,
      }),
      P("max-20x", "Claude Max 20x", 200, null, {
        resetPeriod: "rolling_5h",
        overageModel: "throttle",
        models: ["Claude Sonnet tier", "Claude Opus tier"],
        frontierModelAccess: true,
        platforms: ["cli", "ide", "web", "desktop", "cloud_agent"],
        notes: "Highest documented consumer usage tier.",
        capturedHoursAgo: 7,
      }),
    ],
  },
  {
    slug: "openai-codex",
    name: "OpenAI Codex",
    vendor: "OpenAI",
    website: "https://openai.com/codex",
    docsUrl: "https://developers.openai.com/codex",
    pricingUrl: "https://openai.com/chatgpt/pricing",
    changelogUrl: "https://openai.com/products/release-notes/",
    openSource: false,
    repoUrl: null,
    platforms: ["cli", "ide", "web", "cloud_agent"],
    sourceId: "openai-release-notes",
    plans: [
      P("plus", "ChatGPT Plus (Codex included)", 20, null, {
        resetPeriod: "rolling_5h",
        overageModel: "throttle",
        models: ["GPT flagship tier", "Codex-tuned models"],
        frontierModelAccess: true,
        platforms: ["cli", "ide", "web"],
        notes: "Codex access is included with a Plus subscription; usage limits apply.",
        capturedHoursAgo: 9,
      }),
      P("pro", "ChatGPT Pro", 200, null, {
        resetPeriod: "rolling_5h",
        overageModel: "throttle",
        models: ["GPT flagship tier", "Codex-tuned models", "Reasoning tier"],
        frontierModelAccess: true,
        platforms: ["cli", "ide", "web", "cloud_agent"],
        notes: "Higher usage allowance.",
        capturedHoursAgo: 9,
      }),
    ],
  },
  {
    slug: "gemini-cli",
    name: "Gemini CLI",
    vendor: "Google",
    website: "https://github.com/google-gemini/gemini-cli",
    docsUrl: "https://google-gemini.github.io/gemini-cli/",
    pricingUrl: "https://ai.google.dev/pricing",
    changelogUrl: "https://github.com/google-gemini/gemini-cli/releases",
    openSource: true,
    repoUrl: "https://github.com/google-gemini/gemini-cli",
    platforms: ["cli", "ide"],
    sourceId: "gemini-cli-releases",
    plans: [
      P("free", "Gemini CLI Free tier", 0, null, {
        resetPeriod: "daily",
        overageModel: "hard_cap",
        models: ["Gemini Flash tier"],
        platforms: ["cli"],
        notes: "Free tier has a documented daily request allowance.",
        capturedHoursAgo: 11,
      }),
      P("byok", "Gemini CLI (API key)", 0, null, {
        overageModel: "pay_as_you_go",
        byok: true,
        models: ["Bring your own Google AI API key"],
        platforms: ["cli", "ide"],
        notes: "Pay-per-token through a Google AI API key.",
        capturedHoursAgo: 11,
      }),
    ],
  },
  {
    slug: "kilo-code",
    name: "Kilo Code",
    vendor: "Kilo Code",
    website: "https://kilo.ai",
    docsUrl: "https://kilocode.ai/docs",
    pricingUrl: "https://kilo.ai/pricing",
    changelogUrl: "https://github.com/Kilo-Org/kilocode/releases",
    openSource: true,
    repoUrl: "https://github.com/Kilo-Org/kilocode",
    platforms: ["ide", "cli"],
    sourceId: "kilo-pricing",
    plans: [
      P("individual-free", "Individual platform", 0, null, {
        overageModel: "pay_as_you_go",
        byok: true,
        models: ["Bring your own key", "Gateway routing", "Free routes"],
        platforms: ["ide"],
        notes: "The IDE extension is free; inference is BYOK, gateway or free routes.",
        capturedHoursAgo: 8,
      }),
      P("pass-19", "Kilo Pass", 19, 20, {
        overageModel: "pay_as_you_go",
        models: ["Frontier providers", "Open-weight providers"],
        frontierModelAccess: true,
        platforms: ["ide", "cli"],
        notes: "Entry tier; higher tiers exist with additional bonus-credit mechanics.",
        capturedHoursAgo: 8,
      }),
    ],
  },
  {
    slug: "freebuff",
    name: "Freebuff",
    vendor: "Freebuff",
    website: "https://freebuff.ai",
    docsUrl: null,
    pricingUrl: "https://freebuff.ai/pricing",
    changelogUrl: null,
    openSource: false,
    repoUrl: null,
    platforms: ["web", "cli"],
    sourceId: "freebuff",
    plans: [
      P("free", "Ad-supported free tier", 0, null, {
        resetPeriod: "daily",
        overageModel: "hard_cap",
        models: ["Selected open-weight models"],
        frontierModelAccess: false,
        platforms: ["web", "cli"],
        notes: "Ad-supported offering; daily allowance and model availability can change.",
        capturedHoursAgo: 14,
      }),
    ],
  },
  {
    slug: "cursor",
    name: "Cursor",
    vendor: "Anysphere",
    website: "https://cursor.com",
    docsUrl: "https://docs.cursor.com",
    pricingUrl: "https://cursor.com/pricing",
    changelogUrl: "https://cursor.com/changelog",
    openSource: false,
    repoUrl: null,
    platforms: ["ide", "cli", "web", "cloud_agent"],
    sourceId: "cursor-pricing",
    plans: [
      P("hobby", "Hobby", 0, null, {
        overageModel: "hard_cap",
        models: ["Limited frontier requests"],
        frontierModelAccess: true,
        platforms: ["ide"],
        notes: "Free tier with limited included usage.",
        capturedHoursAgo: 18,
      }),
      P("pro", "Pro", 20, 20, {
        overageModel: "pay_as_you_go",
        models: ["Frontier providers", "Fast premium models"],
        frontierModelAccess: true,
        platforms: ["ide", "cli", "web", "cloud_agent"],
        notes: "Includes a documented monthly credit allocation.",
        capturedHoursAgo: 18,
      }),
    ],
  },
  {
    slug: "windsurf",
    name: "Windsurf",
    vendor: "Windsurf",
    website: "https://windsurf.com",
    docsUrl: "https://docs.windsurf.com",
    pricingUrl: "https://windsurf.com/pricing",
    changelogUrl: "https://windsurf.com/changelog",
    openSource: false,
    repoUrl: null,
    platforms: ["ide", "web"],
    sourceId: "windsurf-pricing",
    plans: [
      P("free", "Free", 0, null, {
        overageModel: "hard_cap",
        models: ["Limited frontier requests"],
        platforms: ["ide"],
        notes: "Free tier with a documented monthly prompt allowance.",
        capturedHoursAgo: 20,
      }),
      P("pro", "Pro", 15, 15, {
        overageModel: "pay_as_you_go",
        models: ["Frontier providers"],
        frontierModelAccess: true,
        platforms: ["ide", "web"],
        notes: "Credit-based usage with overage available.",
        capturedHoursAgo: 20,
      }),
    ],
  },
];

function hoursBefore(now: Date, hours: number): string {
  return new Date(now.getTime() - hours * 3_600_000).toISOString();
}

export interface HarnessFixtureBundle {
  products: HarnessProduct[];
  plans: HarnessPlan[];
  snapshots: HarnessPlanSnapshot[];
  changeEvents: HarnessChangeEvent[];
}

export function buildFixtureHarness(now: Date): HarnessFixtureBundle {
  const products: HarnessProduct[] = [];
  const plans: HarnessPlan[] = [];
  const snapshots: HarnessPlanSnapshot[] = [];

  for (const seed of HARNESS_PRODUCT_SEEDS) {
    const productId = `harness:${seed.slug}`;
    products.push({
      id: productId,
      name: seed.name,
      slug: seed.slug,
      vendor: seed.vendor,
      website: seed.website,
      docsUrl: seed.docsUrl,
      pricingUrl: seed.pricingUrl,
      changelogUrl: seed.changelogUrl,
      openSource: seed.openSource,
      repoUrl: seed.repoUrl,
      platforms: seed.platforms,
      active: true,
    });

    for (const planSeed of seed.plans) {
      const planId = `plan:${seed.slug}:${planSeed.key}`;
      plans.push({
        id: planId,
        productId,
        canonicalPlanKey: `${seed.slug}-${planSeed.key}`,
        name: planSeed.name,
        active: planSeed.active,
      });

      const capturedAt = hoursBefore(now, planSeed.capturedHoursAgo);
      const sourceUrl = seed.pricingUrl ?? seed.website;

      const snapshotBase = {
        monthlyPriceUsd: planSeed.monthlyPriceUsd,
        annualPriceUsd: planSeed.annualPriceUsd,
        includedCreditsUsd: planSeed.includedCreditsUsd,
        estimatedRequests: planSeed.estimatedRequests,
        resetPeriod: planSeed.resetPeriod,
        overageModel: planSeed.overageModel,
        byok: planSeed.byok,
        models: planSeed.models,
        frontierModelAccess: planSeed.frontierModelAccess,
        platforms: planSeed.platforms,
        regions: planSeed.regions,
      };

      snapshots.push({
        id: `snapshot:${planId}:0`,
        planId,
        capturedAt,
        ...snapshotBase,
        estimatedRequestsSourceUrl: planSeed.estimatedRequests === null ? null : sourceUrl,
        notes: planSeed.notes,
        sourceId: seed.sourceId,
        sourceUrl,
        rawSourceHash: hashPayload(snapshotBase),
      });
    }
  }

  return { products, plans, snapshots, changeEvents: buildFixtureHarnessChangeEvents(now, plans) };
}

function buildFixtureHarnessChangeEvents(now: Date, plans: HarnessPlan[]): HarnessChangeEvent[] {
  const byKey = new Map(plans.map((plan) => [plan.canonicalPlanKey, plan]));
  const events: HarnessChangeEvent[] = [];

  const push = (
    planKey: string,
    eventType: HarnessChangeEvent["eventType"],
    summary: string,
    hoursAgo: number,
    significance: HarnessChangeEvent["significance"],
    before: unknown,
    after: unknown,
  ): void => {
    const plan = byKey.get(planKey);
    if (!plan) return;
    events.push({
      id: `harness-change:${planKey}:${eventType}:${hoursAgo}`,
      planId: plan.id,
      productId: plan.productId,
      eventType,
      before,
      after,
      observedAt: hoursBefore(now, hoursAgo),
      significance,
      sourceId: "command-code-pricing",
      summary,
    });
  };

  push(
    "command-code-goat",
    "credits_changed",
    "Command Code GOAT credits changed",
    52,
    "high",
    { includedCreditsUsd: 50 },
    { includedCreditsUsd: 60 },
  );
  push(
    "command-code-go",
    "price_changed",
    "Command Code Go price changed",
    120,
    "high",
    { monthlyPriceUsd: 3 },
    { monthlyPriceUsd: 1 },
  );
  push(
    "opencode-go",
    "model_added",
    "OpenCode Go added a model to its curated list",
    30,
    "medium",
    { models: ["Curated frontier model list"] },
    { models: ["Curated frontier model list", "Open-weight models"] },
  );
  push(
    "claude-code-pro",
    "limit_changed",
    "Claude Code Pro usage limit changed",
    76,
    "medium",
    { resetPeriod: "monthly" },
    { resetPeriod: "rolling_5h" },
  );
  push(
    "freebuff-free",
    "limit_changed",
    "Freebuff changed its daily allowance",
    44,
    "medium",
    { resetPeriod: "rolling_5h" },
    { resetPeriod: "daily" },
  );
  push(
    "kilo-code-pass-19",
    "promotion_started",
    "Kilo Pass bonus-credit promotion started",
    20,
    "low",
    null,
    { bonusCreditsUsd: 5 },
  );
  push(
    "cursor-pro",
    "credits_changed",
    "Cursor Pro monthly credit allocation changed",
    96,
    "high",
    { includedCreditsUsd: 15 },
    { includedCreditsUsd: 20 },
  );

  return events.sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
}
