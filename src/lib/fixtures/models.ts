/**
 * Fixture model catalogue.
 *
 * FIXTURE DATA — deterministic and clearly labeled in the UI. Metric values are
 * plausible placeholders used to exercise rankings, Pareto frontiers, value
 * scoring and change detection. They are NOT live Artificial Analysis values.
 */
import type { Model, ModelMetrics, Provider } from "@/lib/domain/schema";
import { stableHash } from "@/lib/domain/hash";
import type { FixtureProviderSeed } from "./providers";

interface ModelSeed {
  slug: string;
  name: string;
  shortName: string;
  provider: string;
  /** Days before `now` the model was released. */
  releasedDaysAgo: number;
  deprecatedDaysAgo?: number;
  openWeight: boolean;
  metrics: ModelMetrics;
}

function metrics(input: Partial<ModelMetrics>): ModelMetrics {
  return {
    intelligence: null,
    coding: null,
    agentic: null,
    math: null,
    outputSpeedTps: null,
    ttftSeconds: null,
    inputPricePerMillion: null,
    outputPricePerMillion: null,
    cacheReadPricePerMillion: null,
    cacheWritePricePerMillion: null,
    contextWindow: null,
    hfDownloads: null,
    hfLikes: null,
    ...input,
  };
}

const M = metrics;

export const MODEL_SEEDS: ModelSeed[] = [
  /* ------------------------------- OpenAI -------------------------------- */
  {
    slug: "gpt-5-2",
    name: "GPT-5.2",
    shortName: "GPT-5.2",
    provider: "openai",
    releasedDaysAgo: 34,
    openWeight: false,
    metrics: M({
      intelligence: 72,
      coding: 74,
      agentic: 76,
      math: 88,
      outputSpeedTps: 92,
      ttftSeconds: 1.9,
      inputPricePerMillion: 1.75,
      outputPricePerMillion: 14,
      cacheReadPricePerMillion: 0.175,
      contextWindow: 400_000,
    }),
  },
  {
    slug: "gpt-5-2-mini",
    name: "GPT-5.2 mini",
    shortName: "GPT-5.2 mini",
    provider: "openai",
    releasedDaysAgo: 34,
    openWeight: false,
    metrics: M({
      intelligence: 61,
      coding: 62,
      agentic: 63,
      math: 78,
      outputSpeedTps: 140,
      ttftSeconds: 0.9,
      inputPricePerMillion: 0.25,
      outputPricePerMillion: 2,
      cacheReadPricePerMillion: 0.025,
      contextWindow: 400_000,
    }),
  },
  {
    slug: "o5",
    name: "o5",
    shortName: "o5",
    provider: "openai",
    releasedDaysAgo: 61,
    openWeight: false,
    metrics: M({
      intelligence: 76,
      coding: 78,
      agentic: 82,
      math: 95,
      outputSpeedTps: 48,
      ttftSeconds: 12,
      inputPricePerMillion: 2.5,
      outputPricePerMillion: 20,
      cacheReadPricePerMillion: 0.25,
      contextWindow: 200_000,
    }),
  },
  {
    slug: "gpt-5-1",
    name: "GPT-5.1",
    shortName: "GPT-5.1",
    provider: "openai",
    releasedDaysAgo: 210,
    deprecatedDaysAgo: 20,
    openWeight: false,
    metrics: M({
      intelligence: 66,
      coding: 68,
      agentic: 69,
      math: 84,
      outputSpeedTps: 85,
      ttftSeconds: 2.2,
      inputPricePerMillion: 2,
      outputPricePerMillion: 16,
      cacheReadPricePerMillion: 0.2,
      contextWindow: 256_000,
    }),
  },

  /* ------------------------------ Anthropic ------------------------------ */
  {
    slug: "claude-opus-5",
    name: "Claude Opus 5",
    shortName: "Opus 5",
    provider: "anthropic",
    releasedDaysAgo: 47,
    openWeight: false,
    metrics: M({
      intelligence: 74,
      coding: 79,
      agentic: 80,
      math: 84,
      outputSpeedTps: 55,
      ttftSeconds: 2.4,
      inputPricePerMillion: 5,
      outputPricePerMillion: 25,
      cacheReadPricePerMillion: 0.5,
      cacheWritePricePerMillion: 6.25,
      contextWindow: 200_000,
    }),
  },
  {
    slug: "claude-sonnet-5",
    name: "Claude Sonnet 5",
    shortName: "Sonnet 5",
    provider: "anthropic",
    releasedDaysAgo: 47,
    openWeight: false,
    metrics: M({
      intelligence: 69,
      coding: 75,
      agentic: 77,
      math: 79,
      outputSpeedTps: 88,
      ttftSeconds: 1.4,
      inputPricePerMillion: 3,
      outputPricePerMillion: 15,
      cacheReadPricePerMillion: 0.3,
      cacheWritePricePerMillion: 3.75,
      contextWindow: 200_000,
    }),
  },
  {
    slug: "claude-haiku-5",
    name: "Claude Haiku 5",
    shortName: "Haiku 5",
    provider: "anthropic",
    releasedDaysAgo: 47,
    openWeight: false,
    metrics: M({
      intelligence: 52,
      coding: 54,
      agentic: 52,
      math: 60,
      outputSpeedTps: 180,
      ttftSeconds: 0.7,
      inputPricePerMillion: 1,
      outputPricePerMillion: 5,
      cacheReadPricePerMillion: 0.1,
      contextWindow: 200_000,
    }),
  },

  /* --------------------------- Google DeepMind --------------------------- */
  {
    slug: "gemini-3-ultra",
    name: "Gemini 3 Ultra",
    shortName: "Gemini 3 Ultra",
    provider: "google",
    releasedDaysAgo: 26,
    openWeight: false,
    metrics: M({
      intelligence: 73,
      coding: 71,
      agentic: 74,
      math: 89,
      outputSpeedTps: 110,
      ttftSeconds: 1.1,
      inputPricePerMillion: 2,
      outputPricePerMillion: 12,
      cacheReadPricePerMillion: 0.2,
      contextWindow: 1_000_000,
    }),
  },
  {
    slug: "gemini-3-pro",
    name: "Gemini 3 Pro",
    shortName: "Gemini 3 Pro",
    provider: "google",
    releasedDaysAgo: 26,
    openWeight: false,
    metrics: M({
      intelligence: 70,
      coding: 69,
      agentic: 72,
      math: 86,
      outputSpeedTps: 135,
      ttftSeconds: 0.8,
      inputPricePerMillion: 1.25,
      outputPricePerMillion: 10,
      cacheReadPricePerMillion: 0.125,
      contextWindow: 1_000_000,
    }),
  },
  {
    slug: "gemini-3-flash",
    name: "Gemini 3 Flash",
    shortName: "Gemini 3 Flash",
    provider: "google",
    releasedDaysAgo: 26,
    openWeight: false,
    metrics: M({
      intelligence: 58,
      coding: 57,
      agentic: 59,
      math: 74,
      outputSpeedTps: 220,
      ttftSeconds: 0.4,
      inputPricePerMillion: 0.3,
      outputPricePerMillion: 2.5,
      cacheReadPricePerMillion: 0.03,
      contextWindow: 1_000_000,
    }),
  },

  /* --------------------------------- xAI --------------------------------- */
  {
    slug: "grok-5",
    name: "Grok 5",
    shortName: "Grok 5",
    provider: "xai",
    releasedDaysAgo: 40,
    openWeight: false,
    metrics: M({
      intelligence: 70,
      coding: 71,
      agentic: 73,
      math: 87,
      outputSpeedTps: 100,
      ttftSeconds: 1.2,
      inputPricePerMillion: 3,
      outputPricePerMillion: 15,
      cacheReadPricePerMillion: 0.75,
      contextWindow: 256_000,
    }),
  },
  {
    slug: "grok-5-mini",
    name: "Grok 5 mini",
    shortName: "Grok 5 mini",
    provider: "xai",
    releasedDaysAgo: 40,
    openWeight: false,
    metrics: M({
      intelligence: 58,
      coding: 59,
      agentic: 60,
      math: 75,
      outputSpeedTps: 165,
      ttftSeconds: 0.6,
      inputPricePerMillion: 0.6,
      outputPricePerMillion: 3,
      contextWindow: 256_000,
    }),
  },

  /* --------------------------------- Meta -------------------------------- */
  {
    slug: "llama-5-405b",
    name: "Llama 5 405B",
    shortName: "Llama 5 405B",
    provider: "meta",
    releasedDaysAgo: 75,
    openWeight: true,
    metrics: M({
      intelligence: 64,
      coding: 63,
      agentic: 61,
      math: 77,
      outputSpeedTps: 60,
      ttftSeconds: 1,
      inputPricePerMillion: 0.9,
      outputPricePerMillion: 2.2,
      contextWindow: 128_000,
    }),
  },
  {
    slug: "llama-5-70b",
    name: "Llama 5 70B",
    shortName: "Llama 5 70B",
    provider: "meta",
    releasedDaysAgo: 75,
    openWeight: true,
    metrics: M({
      intelligence: 55,
      coding: 56,
      agentic: 52,
      math: 68,
      outputSpeedTps: 150,
      ttftSeconds: 0.5,
      inputPricePerMillion: 0.2,
      outputPricePerMillion: 0.6,
      contextWindow: 128_000,
    }),
  },

  /* -------------------------------- Mistral ------------------------------ */
  {
    slug: "mistral-large-3",
    name: "Mistral Large 3",
    shortName: "Mistral Large 3",
    provider: "mistral",
    releasedDaysAgo: 96,
    openWeight: false,
    metrics: M({
      intelligence: 58,
      coding: 57,
      agentic: 54,
      math: 70,
      outputSpeedTps: 120,
      ttftSeconds: 0.6,
      inputPricePerMillion: 1.8,
      outputPricePerMillion: 5.4,
      contextWindow: 128_000,
    }),
  },
  {
    slug: "magistral-medium",
    name: "Magistral Medium",
    shortName: "Magistral Med.",
    provider: "mistral",
    releasedDaysAgo: 120,
    openWeight: true,
    metrics: M({
      intelligence: 60,
      coding: 58,
      agentic: 55,
      math: 82,
      outputSpeedTps: 95,
      ttftSeconds: 0.9,
      inputPricePerMillion: 0.6,
      outputPricePerMillion: 2.4,
      contextWindow: 128_000,
    }),
  },

  /* -------------------------------- Cohere ------------------------------- */
  {
    slug: "command-a-3",
    name: "Command A 3",
    shortName: "Command A 3",
    provider: "cohere",
    releasedDaysAgo: 140,
    openWeight: true,
    metrics: M({
      intelligence: 50,
      coding: 48,
      agentic: 50,
      math: 55,
      outputSpeedTps: 130,
      ttftSeconds: 0.7,
      inputPricePerMillion: 2.5,
      outputPricePerMillion: 10,
      contextWindow: 256_000,
    }),
  },

  /* ------------------------------ Microsoft ------------------------------ */
  {
    slug: "phi-6",
    name: "Phi-6",
    shortName: "Phi-6",
    provider: "microsoft",
    releasedDaysAgo: 165,
    openWeight: true,
    metrics: M({
      intelligence: 45,
      coding: 47,
      agentic: 42,
      math: 60,
      outputSpeedTps: 190,
      ttftSeconds: 0.4,
      inputPricePerMillion: 0.1,
      outputPricePerMillion: 0.3,
      contextWindow: 128_000,
    }),
  },

  /* -------------------------------- Amazon ------------------------------- */
  {
    slug: "nova-premier-2",
    name: "Nova Premier 2",
    shortName: "Nova Premier 2",
    provider: "amazon",
    releasedDaysAgo: 110,
    openWeight: false,
    metrics: M({
      intelligence: 56,
      coding: 55,
      agentic: 57,
      math: 66,
      outputSpeedTps: 140,
      ttftSeconds: 0.8,
      inputPricePerMillion: 0.8,
      outputPricePerMillion: 3.2,
      contextWindow: 300_000,
    }),
  },
  {
    slug: "nova-lite-2",
    name: "Nova Lite 2",
    shortName: "Nova Lite 2",
    provider: "amazon",
    releasedDaysAgo: 110,
    openWeight: false,
    metrics: M({
      intelligence: 44,
      coding: 43,
      agentic: 45,
      math: 52,
      outputSpeedTps: 240,
      ttftSeconds: 0.3,
      inputPricePerMillion: 0.06,
      outputPricePerMillion: 0.24,
      contextWindow: 300_000,
    }),
  },

  /* -------------------------------- NVIDIA ------------------------------- */
  {
    slug: "nemotron-4-ultra",
    name: "Nemotron 4 Ultra",
    shortName: "Nemotron 4 Ultra",
    provider: "nvidia",
    releasedDaysAgo: 190,
    openWeight: true,
    metrics: M({
      intelligence: 52,
      coding: 51,
      agentic: 49,
      math: 63,
      outputSpeedTps: 110,
      ttftSeconds: 0.7,
      inputPricePerMillion: 0.6,
      outputPricePerMillion: 1.8,
      contextWindow: 128_000,
    }),
  },

  /* ------------------------------- DeepSeek ------------------------------ */
  {
    slug: "deepseek-v4",
    name: "DeepSeek V4",
    shortName: "DeepSeek V4",
    provider: "deepseek",
    releasedDaysAgo: 52,
    openWeight: true,
    metrics: M({
      intelligence: 68,
      coding: 72,
      agentic: 70,
      math: 90,
      outputSpeedTps: 85,
      ttftSeconds: 1.5,
      inputPricePerMillion: 0.28,
      outputPricePerMillion: 0.42,
      cacheReadPricePerMillion: 0.028,
      contextWindow: 128_000,
    }),
  },
  {
    slug: "deepseek-v4-lite",
    name: "DeepSeek V4 Lite",
    shortName: "DeepSeek V4 Lite",
    provider: "deepseek",
    releasedDaysAgo: 52,
    openWeight: true,
    metrics: M({
      intelligence: 55,
      coding: 57,
      agentic: 55,
      math: 74,
      outputSpeedTps: 150,
      ttftSeconds: 0.7,
      inputPricePerMillion: 0.1,
      outputPricePerMillion: 0.2,
      contextWindow: 128_000,
    }),
  },

  /* -------------------------------- Alibaba ------------------------------ */
  {
    slug: "qwen3-5-max",
    name: "Qwen3.5 Max",
    shortName: "Qwen3.5 Max",
    provider: "alibaba",
    releasedDaysAgo: 30,
    openWeight: false,
    metrics: M({
      intelligence: 66,
      coding: 68,
      agentic: 67,
      math: 85,
      outputSpeedTps: 95,
      ttftSeconds: 1,
      inputPricePerMillion: 1.2,
      outputPricePerMillion: 6,
      contextWindow: 262_144,
    }),
  },
  {
    slug: "qwen3-5-235b",
    name: "Qwen3.5 235B",
    shortName: "Qwen3.5 235B",
    provider: "alibaba",
    releasedDaysAgo: 30,
    openWeight: true,
    metrics: M({
      intelligence: 64,
      coding: 66,
      agentic: 64,
      math: 84,
      outputSpeedTps: 105,
      ttftSeconds: 0.9,
      inputPricePerMillion: 0.35,
      outputPricePerMillion: 1.2,
      contextWindow: 262_144,
    }),
  },
  {
    slug: "qwen3-5-32b",
    name: "Qwen3.5 32B",
    shortName: "Qwen3.5 32B",
    provider: "alibaba",
    releasedDaysAgo: 30,
    openWeight: true,
    metrics: M({
      intelligence: 53,
      coding: 54,
      agentic: 51,
      math: 72,
      outputSpeedTps: 170,
      ttftSeconds: 0.5,
      inputPricePerMillion: 0.12,
      outputPricePerMillion: 0.4,
      contextWindow: 262_144,
    }),
  },

  /* ------------------------------- Moonshot ------------------------------ */
  {
    slug: "kimi-k3",
    name: "Kimi K3",
    shortName: "Kimi K3",
    provider: "moonshot",
    releasedDaysAgo: 21,
    openWeight: true,
    metrics: M({
      intelligence: 69,
      coding: 73,
      agentic: 75,
      math: 88,
      outputSpeedTps: 70,
      ttftSeconds: 2,
      inputPricePerMillion: 0.6,
      outputPricePerMillion: 2.5,
      contextWindow: 256_000,
    }),
  },
  {
    slug: "kimi-k3-turbo",
    name: "Kimi K3 Turbo",
    shortName: "Kimi K3 Turbo",
    provider: "moonshot",
    releasedDaysAgo: 21,
    openWeight: true,
    metrics: M({
      intelligence: 60,
      coding: 62,
      agentic: 63,
      math: 78,
      outputSpeedTps: 160,
      ttftSeconds: 0.6,
      inputPricePerMillion: 0.25,
      outputPricePerMillion: 1.2,
      contextWindow: 256_000,
    }),
  },

  /* ------------------------------- MiniMax ------------------------------- */
  {
    slug: "minimax-m2-5",
    name: "MiniMax M2.5",
    shortName: "MiniMax M2.5",
    provider: "minimax",
    releasedDaysAgo: 58,
    openWeight: true,
    metrics: M({
      intelligence: 63,
      coding: 65,
      agentic: 66,
      math: 80,
      outputSpeedTps: 90,
      ttftSeconds: 1.1,
      inputPricePerMillion: 0.3,
      outputPricePerMillion: 1.2,
      contextWindow: 1_000_000,
    }),
  },

  /* --------------------------------- Zhipu ------------------------------- */
  {
    slug: "glm-5",
    name: "GLM-5",
    shortName: "GLM-5",
    provider: "zhipu",
    releasedDaysAgo: 44,
    openWeight: true,
    metrics: M({
      intelligence: 65,
      coding: 67,
      agentic: 65,
      math: 82,
      outputSpeedTps: 100,
      ttftSeconds: 0.9,
      inputPricePerMillion: 0.4,
      outputPricePerMillion: 1.6,
      contextWindow: 200_000,
    }),
  },
  {
    slug: "glm-5-air",
    name: "GLM-5 Air",
    shortName: "GLM-5 Air",
    provider: "zhipu",
    releasedDaysAgo: 44,
    openWeight: true,
    metrics: M({
      intelligence: 54,
      coding: 55,
      agentic: 53,
      math: 70,
      outputSpeedTps: 175,
      ttftSeconds: 0.5,
      inputPricePerMillion: 0.12,
      outputPricePerMillion: 0.5,
      contextWindow: 200_000,
    }),
  },

  /* -------------------------------- Xiaomi ------------------------------- */
  {
    slug: "mimo-3",
    name: "MiMo-3",
    shortName: "MiMo-3",
    provider: "xiaomi",
    releasedDaysAgo: 130,
    openWeight: true,
    metrics: M({
      intelligence: 57,
      coding: 58,
      agentic: 56,
      math: 74,
      outputSpeedTps: 145,
      ttftSeconds: 0.6,
      inputPricePerMillion: 0.2,
      outputPricePerMillion: 0.8,
      contextWindow: 256_000,
    }),
  },
];

function daysBefore(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

/**
 * Deterministic mock popularity for open-weight models, so the popularity boards
 * have data in mock mode. Closed models stay `null` (no Hub page).
 */
function withPopularity(slug: string, metrics: ModelMetrics): ModelMetrics {
  const seed = Number.parseInt(stableHash(`${slug}:hf`).slice(0, 8), 16);
  return {
    ...metrics,
    hfDownloads: 25_000 + (seed % 4_000_000),
    hfLikes: 40 + (seed % 2_500),
  };
}

export function buildFixtureModels(
  providers: Provider[],
  providerSeeds: FixtureProviderSeed[],
  now: Date,
): Model[] {
  const slugToId = new Map(providerSeeds.map((seed) => [seed.slug, `provider:${seed.slug}`]));
  const known = new Set(providers.map((p) => p.id));
  const refreshedAt = now.toISOString();

  return MODEL_SEEDS.map((seed) => {
    const providerId = slugToId.get(seed.provider);
    if (!providerId || !known.has(providerId)) {
      throw new Error(
        `Fixture model "${seed.slug}" references unknown provider "${seed.provider}"`,
      );
    }
    return {
      id: `model:${seed.slug}`,
      slug: seed.slug,
      name: seed.name,
      shortName: seed.shortName,
      providerId,
      releaseDate: daysBefore(now, seed.releasedDaysAgo),
      deprecatedAt:
        seed.deprecatedDaysAgo === undefined ? null : daysBefore(now, seed.deprecatedDaysAgo),
      openWeight: seed.openWeight,
      description: `${seed.name} — fixture entry for the Model Intelligence Hub comparison workspace.`,
      officialUrl: null,
      metrics: seed.openWeight ? withPopularity(seed.slug, seed.metrics) : seed.metrics,
      sourceId: "artificial-analysis-api",
      sourceVersion: "fixture-2026.09",
      lastRefreshedAt: refreshedAt,
    } satisfies Model;
  });
}
