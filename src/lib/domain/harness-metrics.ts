/**
 * Harness (coding-agent subscription) derived metrics.
 *
 * Rule: never infer an undocumented request count. If the vendor does not
 * publish an estimate, the derived per-dollar estimate is `null` and the UI
 * shows "—" with the source link to the numbers that DO exist.
 */
import type { HarnessPlanSnapshot } from "./schema";

export interface HarnessPlanDerived {
  planId: string;
  /** Lowest meaningful monthly outlay in USD. */
  entryPriceUsd: number | null;
  /** Monthly price normalized from annual billing when only annual exists. */
  effectiveMonthlyPriceUsd: number | null;
  includedCreditsUsd: number | null;
  /** Included credit value per USD of price. */
  includedCreditPerDollar: number | null;
  /** Documented requests per USD. Null unless the vendor documents requests. */
  documentedRequestEstimatePerDollar: number | null;
  isFree: boolean;
  byok: boolean;
  frontierModelAccess: boolean;
  /** Net USD of value beyond the subscription price, when computable. */
  includedValueOverPriceUsd: number | null;
  platforms: HarnessPlanSnapshot["platforms"];
  resetPeriod: HarnessPlanSnapshot["resetPeriod"];
  modelCount: number;
  verifiedFrom: string;
}

export function deriveHarnessPlanMetrics(snapshot: HarnessPlanSnapshot): HarnessPlanDerived {
  const monthly = snapshot.monthlyPriceUsd;
  const annual = snapshot.annualPriceUsd;

  const effectiveMonthlyPriceUsd = monthly ?? (annual === null ? null : round2(annual / 12));

  const entryPriceUsd = monthly ?? effectiveMonthlyPriceUsd;

  const includedCreditsUsd = snapshot.includedCreditsUsd;
  const includedCreditPerDollar =
    includedCreditsUsd !== null && entryPriceUsd !== null && entryPriceUsd > 0
      ? round4(includedCreditsUsd / entryPriceUsd)
      : null;

  const documentedRequestEstimatePerDollar =
    snapshot.estimatedRequests !== null && entryPriceUsd !== null && entryPriceUsd > 0
      ? round2(snapshot.estimatedRequests / entryPriceUsd)
      : null;

  const isFree = entryPriceUsd === 0 || (entryPriceUsd === null && includedCreditsUsd !== null);

  const includedValueOverPriceUsd =
    includedCreditsUsd !== null && entryPriceUsd !== null
      ? round2(includedCreditsUsd - entryPriceUsd)
      : null;

  return {
    planId: snapshot.planId,
    entryPriceUsd,
    effectiveMonthlyPriceUsd,
    includedCreditsUsd,
    includedCreditPerDollar,
    documentedRequestEstimatePerDollar,
    isFree,
    byok: snapshot.byok,
    frontierModelAccess: snapshot.frontierModelAccess,
    includedValueOverPriceUsd,
    platforms: snapshot.platforms,
    resetPeriod: snapshot.resetPeriod,
    modelCount: snapshot.models.length,
    verifiedFrom: snapshot.sourceUrl,
  };
}

/* -------------------------------------------------------------------------- */
/* Cheapest views                                                              */
/* -------------------------------------------------------------------------- */

export type CheapestCategory =
  | "free"
  | "lowest_paid_entry"
  | "highest_credit_per_dollar"
  | "premium_under_threshold"
  | "open_models_under_threshold"
  | "byok_friendly"
  | "highest_documented_allowance";

export interface CheapestEntry {
  planId: string;
  productId: string;
  planName: string;
  value: number;
  /** Human-readable formula/source so nothing is an unexplained winner. */
  formula: string;
  detail: string;
}

export interface CheapestViews {
  free: CheapestEntry[];
  lowestPaidEntryUsd: CheapestEntry | null;
  highestCreditPerDollar: CheapestEntry | null;
  premiumUnderThreshold: CheapestEntry | null;
  openModelsUnderThreshold: CheapestEntry | null;
  byokFriendly: CheapestEntry | null;
  highestDocumentedAllowance: CheapestEntry | null;
}

export interface CheapestContext {
  planId: string;
  productId: string;
  planName: string;
  productName: string;
  derived: HarnessPlanDerived;
  snapshot: HarnessPlanSnapshot;
}

export interface CheapestOptions {
  /** Threshold for the "premium models under $X" category. */
  premiumThresholdUsd?: number;
  /** Models that count as "open" for the open-model category. */
  openModelMatchers?: string[];
}

const OPEN_MODEL_HINTS = [
  "llama",
  "qwen",
  "deepseek",
  "glm",
  "kimi",
  "mistral",
  "gpt-oss",
  "mimo",
  "granite",
];

export function buildCheapestViews(
  contexts: CheapestContext[],
  options: CheapestOptions = {},
): CheapestViews {
  const premiumThreshold = options.premiumThresholdUsd ?? 20;
  const openMatchers = (options.openModelMatchers ?? OPEN_MODEL_HINTS).map((m) => m.toLowerCase());

  const free = contexts
    .filter((c) => c.derived.isFree)
    .map<CheapestEntry>((c) => ({
      planId: c.planId,
      productId: c.productId,
      planName: `${c.productName} — ${c.planName}`,
      value: c.derived.entryPriceUsd ?? 0,
      formula: "monthly_price_usd == 0",
      detail: c.snapshot.notes ?? "Advertised as free.",
    }))
    .sort((a, b) => a.value - b.value);

  const paid = contexts.filter(
    (c) => c.derived.entryPriceUsd !== null && (c.derived.entryPriceUsd ?? 0) > 0,
  );

  const cheapestPaid = [...paid].sort(
    (a, b) => (a.derived.entryPriceUsd ?? Infinity) - (b.derived.entryPriceUsd ?? Infinity),
  )[0];

  const lowestPaidEntryUsd: CheapestEntry | null = cheapestPaid
    ? {
        planId: cheapestPaid.planId,
        productId: cheapestPaid.productId,
        planName: `${cheapestPaid.productName} — ${cheapestPaid.planName}`,
        value: cheapestPaid.derived.entryPriceUsd ?? 0,
        formula: "min(monthly_price_usd) over paid plans",
        detail: cheapestPaid.snapshot.notes ?? "Lowest documented monthly price.",
      }
    : null;

  const creditPerDollar = [...contexts]
    .filter((c) => c.derived.includedCreditPerDollar !== null)
    .sort(
      (a, b) => (b.derived.includedCreditPerDollar ?? 0) - (a.derived.includedCreditPerDollar ?? 0),
    )[0];

  const highestCreditPerDollar: CheapestEntry | null = creditPerDollar
    ? {
        planId: creditPerDollar.planId,
        productId: creditPerDollar.productId,
        planName: `${creditPerDollar.productName} — ${creditPerDollar.planName}`,
        value: creditPerDollar.derived.includedCreditPerDollar ?? 0,
        formula: "included_credits_usd / monthly_price_usd",
        detail: `$${creditPerDollar.derived.includedCreditsUsd?.toFixed(2) ?? "—"} credits at $${creditPerDollar.derived.entryPriceUsd?.toFixed(2) ?? "—"}/mo.`,
      }
    : null;

  const premium = [...paid]
    .filter(
      (c) =>
        c.derived.frontierModelAccess && (c.derived.entryPriceUsd ?? Infinity) <= premiumThreshold,
    )
    .sort(
      (a, b) => (a.derived.entryPriceUsd ?? Infinity) - (b.derived.entryPriceUsd ?? Infinity),
    )[0];

  const premiumUnderThreshold: CheapestEntry | null = premium
    ? {
        planId: premium.planId,
        productId: premium.productId,
        planName: `${premium.productName} — ${premium.planName}`,
        value: premium.derived.entryPriceUsd ?? 0,
        formula: `min(monthly_price_usd) where frontier_model_access and price <= $${premiumThreshold}`,
        detail: `Documents frontier-tier model access.`,
      }
    : null;

  const openPlan = [...paid]
    .filter((c) => {
      const values = c.snapshot.models.map((m) => m.toLowerCase());
      return values.some((value) => openMatchers.some((matcher) => value.includes(matcher)));
    })
    .sort(
      (a, b) => (a.derived.entryPriceUsd ?? Infinity) - (b.derived.entryPriceUsd ?? Infinity),
    )[0];

  const openModelsUnderThreshold: CheapestEntry | null = openPlan
    ? {
        planId: openPlan.planId,
        productId: openPlan.productId,
        planName: `${openPlan.productName} — ${openPlan.planName}`,
        value: openPlan.derived.entryPriceUsd ?? 0,
        formula: "min(monthly_price_usd) where plan lists an open-weight model family",
        detail: openPlan.snapshot.models.join(", "),
      }
    : null;

  const byokPlan = [...contexts]
    .filter((c) => c.derived.byok)
    .sort(
      (a, b) => (a.derived.entryPriceUsd ?? Infinity) - (b.derived.entryPriceUsd ?? Infinity),
    )[0];

  const byokFriendly: CheapestEntry | null = byokPlan
    ? {
        planId: byokPlan.planId,
        productId: byokPlan.productId,
        planName: `${byokPlan.productName} — ${byokPlan.planName}`,
        value: byokPlan.derived.entryPriceUsd ?? 0,
        formula: "min(monthly_price_usd) where byok == true",
        detail: "Bring-your-own-key supported.",
      }
    : null;

  const allowance = [...contexts]
    .filter((c) => c.derived.documentedRequestEstimatePerDollar !== null)
    .sort(
      (a, b) =>
        (b.derived.documentedRequestEstimatePerDollar ?? 0) -
        (a.derived.documentedRequestEstimatePerDollar ?? 0),
    )[0];

  const highestDocumentedAllowance: CheapestEntry | null = allowance
    ? {
        planId: allowance.planId,
        productId: allowance.productId,
        planName: `${allowance.productName} — ${allowance.planName}`,
        value: allowance.derived.documentedRequestEstimatePerDollar ?? 0,
        formula: "documented_estimated_requests / monthly_price_usd",
        detail: `${allowance.snapshot.estimatedRequests?.toLocaleString("en-US") ?? "—"} documented requests per month.`,
      }
    : null;

  return {
    free,
    lowestPaidEntryUsd,
    highestCreditPerDollar,
    premiumUnderThreshold,
    openModelsUnderThreshold,
    byokFriendly,
    highestDocumentedAllowance,
  };
}

/** Plain-language comparison rows for the selected-plan tray. */
export interface PlanComparisonRow {
  key: string;
  label: string;
  format: "currency" | "number" | "boolean" | "text" | "list";
  values: Array<{ planId: string; value: string | number | boolean | null }>;
  betterDirection?: "higher" | "lower" | null;
}

export function buildPlanComparisonRows(contexts: CheapestContext[]): PlanComparisonRow[] {
  const rows: Array<{
    key: string;
    label: string;
    format: PlanComparisonRow["format"];
    get: (c: CheapestContext) => string | number | boolean | null;
    betterDirection?: "higher" | "lower" | null;
  }> = [
    {
      key: "price",
      label: "Monthly price",
      format: "currency",
      get: (c) => c.derived.entryPriceUsd,
      betterDirection: "lower",
    },
    {
      key: "credits",
      label: "Included credits",
      format: "currency",
      get: (c) => c.derived.includedCreditsUsd,
      betterDirection: "higher",
    },
    {
      key: "creditPerDollar",
      label: "Credit per USD",
      format: "number",
      get: (c) => c.derived.includedCreditPerDollar,
      betterDirection: "higher",
    },
    { key: "usage", label: "Reset period", format: "text", get: (c) => c.snapshot.resetPeriod },
    {
      key: "overage",
      label: "Overage / PAYG",
      format: "text",
      get: (c) => c.snapshot.overageModel,
    },
    {
      key: "models",
      label: "Included models",
      format: "list",
      get: (c) => c.snapshot.models.join(", "),
    },
    { key: "byok", label: "BYOK", format: "boolean", get: (c) => c.derived.byok },
    {
      key: "frontier",
      label: "Frontier models",
      format: "boolean",
      get: (c) => c.derived.frontierModelAccess,
    },
    {
      key: "cli",
      label: "CLI",
      format: "boolean",
      get: (c) => c.snapshot.platforms.includes("cli"),
    },
    {
      key: "desktop",
      label: "Desktop",
      format: "boolean",
      get: (c) => c.snapshot.platforms.includes("desktop"),
    },
    {
      key: "ide",
      label: "IDE",
      format: "boolean",
      get: (c) => c.snapshot.platforms.includes("ide"),
    },
    {
      key: "cloud",
      label: "Cloud agents",
      format: "boolean",
      get: (c) => c.snapshot.platforms.includes("cloud_agent"),
    },
    { key: "regions", label: "Regions", format: "list", get: (c) => c.snapshot.regions.join(", ") },
    { key: "verified", label: "Last verified", format: "text", get: (c) => c.snapshot.capturedAt },
    { key: "notes", label: "Notes", format: "text", get: (c) => c.snapshot.notes },
  ];

  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    format: row.format,
    betterDirection: row.betterDirection ?? null,
    values: contexts.map((c) => ({ planId: c.planId, value: row.get(c) })),
  }));
}

/* -------------------------------------------------------------------------- */
/* Budget calculator                                                           */
/* -------------------------------------------------------------------------- */

export interface CalculatorInput {
  monthlyBudgetUsd: number;
  codingHoursPerDay: number;
  preferOpen: boolean;
  requiresByok: boolean;
  requiresCli: boolean;
  requiresCloudAgents: boolean;
  requiresIde: boolean;
  preferredModelMatch?: string;
}

export interface CalculatorResult {
  context: CheapestContext;
  /** 0-100 fit score with transparent inputs listed. */
  fit: number;
  reasons: string[];
  disqualifiers: string[];
}

/**
 * "What should I pay for?" calculator.
 *
 * This is non-political and may rank results, but every score is decomposed
 * into the constraints that produced it. It never hides methodology.
 */
export function recommendPlans(
  input: CalculatorInput,
  contexts: CheapestContext[],
): CalculatorResult[] {
  const results: CalculatorResult[] = [];

  for (const context of contexts) {
    const { derived, snapshot } = context;
    const reasons: string[] = [];
    const disqualifiers: string[] = [];
    let fit = 50;

    if (input.requiresByok && !derived.byok)
      disqualifiers.push("Requires BYOK but plan does not support it");
    if (input.requiresCli && !snapshot.platforms.includes("cli"))
      disqualifiers.push("Requires CLI but plan does not list CLI");
    if (input.requiresIde && !snapshot.platforms.includes("ide"))
      disqualifiers.push("Requires IDE integration but plan does not list one");
    if (input.requiresCloudAgents && !snapshot.platforms.includes("cloud_agent"))
      disqualifiers.push("Requires cloud agents but plan does not list them");
    if (input.preferOpen && derived.frontierModelAccess && derived.modelCount < 2) {
      reasons.push("Closed-model focus; no open-weight families listed");
      fit -= 10;
    }

    const price = derived.entryPriceUsd;
    if (price === null) {
      disqualifiers.push("No documented price");
    } else if (price <= input.monthlyBudgetUsd) {
      const headroom = (input.monthlyBudgetUsd - price) / Math.max(1, input.monthlyBudgetUsd);
      fit += headroom * 20;
      reasons.push(
        `$${price.toFixed(2)}/mo fits the $${input.monthlyBudgetUsd} budget with $${(input.monthlyBudgetUsd - price).toFixed(2)} headroom`,
      );
    } else {
      disqualifiers.push(`$${price.toFixed(2)}/mo exceeds the $${input.monthlyBudgetUsd} budget`);
      fit -= 40;
    }

    if (derived.includedCreditPerDollar !== null && derived.includedCreditPerDollar >= 1) {
      fit += Math.min(20, derived.includedCreditPerDollar * 4);
      reasons.push(`${derived.includedCreditPerDollar.toFixed(2)}x included credit per USD`);
    }

    if (
      input.preferOpen &&
      snapshot.models.some((m) => OPEN_MODEL_HINTS.some((hint) => m.toLowerCase().includes(hint)))
    ) {
      fit += 15;
      reasons.push("Lists open-weight model families");
    }

    const preferred = input.preferredModelMatch?.trim().toLowerCase();
    if (preferred && preferred.length > 0) {
      const hit = snapshot.models.some((m) => m.toLowerCase().includes(preferred));
      if (hit) {
        fit += 20;
        reasons.push(`Includes a model matching "${input.preferredModelMatch}"`);
      } else {
        disqualifiers.push(`No model matching "${input.preferredModelMatch}"`);
      }
    }

    if (derived.isFree) {
      fit += 10;
      reasons.push("Free tier available");
    }

    fit -= disqualifiers.length * 25;

    results.push({
      context,
      fit: Math.max(0, Math.min(100, Math.round(fit))),
      reasons,
      disqualifiers,
    });
  }

  return results
    .filter((entry) => entry.disqualifiers.length === 0)
    .sort(
      (a, b) =>
        b.fit - a.fit ||
        (a.context.derived.entryPriceUsd ?? Infinity) -
          (b.context.derived.entryPriceUsd ?? Infinity),
    );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
