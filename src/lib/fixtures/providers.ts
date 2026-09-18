/**
 * Fixture provider registry.
 *
 * FIXTURE DATA — deterministic, clearly labeled in the UI. Provider grouping is
 * geographic/structural, never a quality judgement.
 */
import type { Provider } from "@/lib/domain/schema";

export interface FixtureProviderSeed {
  slug: string;
  name: string;
  domain: string;
  countryCode: string;
  region: string;
  group: Provider["group"];
  color: string;
}

export const PROVIDER_SEEDS: FixtureProviderSeed[] = [
  {
    slug: "openai",
    name: "OpenAI",
    domain: "openai.com",
    countryCode: "US",
    region: "United States",
    group: "mainstream_global",
    color: "#10a37f",
  },
  {
    slug: "anthropic",
    name: "Anthropic",
    domain: "anthropic.com",
    countryCode: "US",
    region: "United States",
    group: "mainstream_global",
    color: "#d97757",
  },
  {
    slug: "google",
    name: "Google DeepMind",
    domain: "deepmind.google",
    countryCode: "US",
    region: "United States",
    group: "mainstream_global",
    color: "#4285f4",
  },
  {
    slug: "xai",
    name: "xAI",
    domain: "x.ai",
    countryCode: "US",
    region: "United States",
    group: "mainstream_global",
    color: "#1d1d1f",
  },
  {
    slug: "meta",
    name: "Meta",
    domain: "ai.meta.com",
    countryCode: "US",
    region: "United States",
    group: "mainstream_global",
    color: "#0866ff",
  },
  {
    slug: "mistral",
    name: "Mistral AI",
    domain: "mistral.ai",
    countryCode: "FR",
    region: "European Union",
    group: "mainstream_global",
    color: "#fa520f",
  },
  {
    slug: "cohere",
    name: "Cohere",
    domain: "cohere.com",
    countryCode: "CA",
    region: "Canada",
    group: "mainstream_global",
    color: "#39594d",
  },
  {
    slug: "microsoft",
    name: "Microsoft",
    domain: "microsoft.com",
    countryCode: "US",
    region: "United States",
    group: "other",
    color: "#00a4ef",
  },
  {
    slug: "amazon",
    name: "Amazon",
    domain: "aws.amazon.com",
    countryCode: "US",
    region: "United States",
    group: "other",
    color: "#ff9900",
  },
  {
    slug: "nvidia",
    name: "NVIDIA",
    domain: "nvidia.com",
    countryCode: "US",
    region: "United States",
    group: "other",
    color: "#76b900",
  },
  {
    slug: "deepseek",
    name: "DeepSeek",
    domain: "deepseek.com",
    countryCode: "CN",
    region: "China",
    group: "china_based",
    color: "#4d6bfe",
  },
  {
    slug: "alibaba",
    name: "Alibaba Qwen",
    domain: "qwen.ai",
    countryCode: "CN",
    region: "China",
    group: "china_based",
    color: "#615ced",
  },
  {
    slug: "moonshot",
    name: "Moonshot AI",
    domain: "moonshot.ai",
    countryCode: "CN",
    region: "China",
    group: "china_based",
    color: "#0b0b0f",
  },
  {
    slug: "minimax",
    name: "MiniMax",
    domain: "minimax.io",
    countryCode: "CN",
    region: "China",
    group: "china_based",
    color: "#e8543f",
  },
  {
    slug: "zhipu",
    name: "Z.ai (Zhipu)",
    domain: "z.ai",
    countryCode: "CN",
    region: "China",
    group: "china_based",
    color: "#3859ff",
  },
  {
    slug: "xiaomi",
    name: "Xiaomi",
    domain: "xiaomi.com",
    countryCode: "CN",
    region: "China",
    group: "china_based",
    color: "#ff6900",
  },
];

export function buildFixtureProviders(now: Date): Provider[] {
  const updatedAt = now.toISOString();
  return PROVIDER_SEEDS.map((seed) => ({
    id: `provider:${seed.slug}`,
    slug: seed.slug,
    name: seed.name,
    domain: seed.domain,
    countryCode: seed.countryCode,
    region: seed.region,
    group: seed.group,
    logoUrl: null,
    color: seed.color,
    active: true,
    sourceId: "internal:provider-registry",
    updatedAt,
  }));
}
