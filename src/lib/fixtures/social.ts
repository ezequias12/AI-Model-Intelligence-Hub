/**
 * Fixture monitored accounts and community posts.
 *
 * FIXTURE DATA. Community ingestion runs through the key-less Bluesky and
 * Hacker News adapters; this file only supplies deterministic samples for mock
 * mode. Handles are plausible placeholders, not a claim about a live account.
 */
import type { MonitoredAccount, SocialPost } from "@/lib/domain/schema";

export const MONITORED_ACCOUNT_SEEDS: Array<Omit<MonitoredAccount, "id"> & { slug: string }> = [
  {
    slug: "openai",
    handle: "@openai.bsky.social",
    displayName: "OpenAI",
    platform: "bluesky",
    accountCategory: "model_provider",
    providerId: "provider:openai",
    harnessProductId: null,
    enabled: true,
  },
  {
    slug: "anthropic",
    handle: "@anthropic.bsky.social",
    displayName: "Anthropic",
    platform: "bluesky",
    accountCategory: "model_provider",
    providerId: "provider:anthropic",
    harnessProductId: null,
    enabled: true,
  },
  {
    slug: "googledeepmind",
    handle: "@googledeepmind.bsky.social",
    displayName: "Google DeepMind",
    platform: "bluesky",
    accountCategory: "model_provider",
    providerId: "provider:google",
    harnessProductId: null,
    enabled: true,
  },
  {
    slug: "xai",
    handle: "@xai.bsky.social",
    displayName: "xAI",
    platform: "bluesky",
    accountCategory: "model_provider",
    providerId: "provider:xai",
    harnessProductId: null,
    enabled: true,
  },
  {
    slug: "deepseek",
    handle: "@deepseek.bsky.social",
    displayName: "DeepSeek",
    platform: "bluesky",
    accountCategory: "model_provider",
    providerId: "provider:deepseek",
    harnessProductId: null,
    enabled: true,
  },
  {
    slug: "alibaba-qwen",
    handle: "@qwen.bsky.social",
    displayName: "Qwen",
    platform: "bluesky",
    accountCategory: "model_provider",
    providerId: "provider:alibaba",
    harnessProductId: null,
    enabled: true,
  },
  {
    slug: "moonshot",
    handle: "@moonshot.bsky.social",
    displayName: "Moonshot AI",
    platform: "bluesky",
    accountCategory: "model_provider",
    providerId: "provider:moonshot",
    harnessProductId: null,
    enabled: true,
  },
  {
    slug: "artificialanalysis",
    handle: "@artificialanalysis.bsky.social",
    displayName: "Artificial Analysis",
    platform: "bluesky",
    accountCategory: "benchmark_org",
    providerId: null,
    harnessProductId: null,
    enabled: true,
  },
  {
    slug: "commandcode",
    handle: "@commandcode.bsky.social",
    displayName: "Command Code",
    platform: "bluesky",
    accountCategory: "coding_harness",
    providerId: null,
    harnessProductId: "harness:command-code",
    enabled: true,
  },
  {
    slug: "opencode",
    handle: "@opencode.bsky.social",
    displayName: "OpenCode",
    platform: "bluesky",
    accountCategory: "coding_harness",
    providerId: null,
    harnessProductId: "harness:opencode",
    enabled: true,
  },
  {
    slug: "kilo",
    handle: "@kilocode.bsky.social",
    displayName: "Kilo Code",
    platform: "bluesky",
    accountCategory: "coding_harness",
    providerId: null,
    harnessProductId: "harness:kilo-code",
    enabled: true,
  },
  {
    slug: "gemini-cli",
    handle: "@geminicli.bsky.social",
    displayName: "Gemini CLI",
    platform: "bluesky",
    accountCategory: "coding_harness",
    providerId: "provider:google",
    harnessProductId: "harness:gemini-cli",
    enabled: true,
  },
  {
    slug: "hackernews",
    handle: "@HackerNews",
    displayName: "Hacker News",
    platform: "hackernews",
    accountCategory: "other",
    providerId: null,
    harnessProductId: null,
    enabled: true,
  },
];

export function buildFixtureMonitoredAccounts(): MonitoredAccount[] {
  return MONITORED_ACCOUNT_SEEDS.map(({ slug, ...rest }) => ({
    id: `social-account:${slug}`,
    ...rest,
  }));
}

interface PostSeed {
  id: string;
  accountSlug: string;
  minutesAgo: number;
  text: string;
  entities: string[];
  corroborated: boolean;
  likes: number | null;
  reposts: number | null;
  replies: number | null;
}

const POST_SEEDS: PostSeed[] = [
  {
    id: "post-01",
    accountSlug: "openai",
    minutesAgo: 42,
    text: "GPT-5.2 is rolling out today with a larger context window and cheaper cached input.",
    entities: ["GPT-5.2", "OpenAI"],
    corroborated: true,
    likes: 8421,
    reposts: 1204,
    replies: 640,
  },
  {
    id: "post-02",
    accountSlug: "artificialanalysis",
    minutesAgo: 96,
    text: "We've updated the Intelligence Index weighting. Scores will shift slightly; methodology notes are published.",
    entities: ["Intelligence Index"],
    corroborated: false,
    likes: 1620,
    reposts: 388,
    replies: 121,
  },
  {
    id: "post-03",
    accountSlug: "anthropic",
    minutesAgo: 180,
    text: "Claude Opus 5 is available today. Longer agentic runs, stronger coding, same tiered pricing.",
    entities: ["Claude Opus 5"],
    corroborated: true,
    likes: 5310,
    reposts: 902,
    replies: 415,
  },
  {
    id: "post-04",
    accountSlug: "commandcode",
    minutesAgo: 240,
    text: "GOAT now includes a larger monthly credit allocation. Existing subscribers keep their pricing.",
    entities: ["Command Code"],
    corroborated: true,
    likes: 388,
    reposts: 61,
    replies: 47,
  },
  {
    id: "post-05",
    accountSlug: "deepseek",
    minutesAgo: 320,
    text: "DeepSeek V4 training notes and an updated math evaluation are published.",
    entities: ["DeepSeek V4"],
    corroborated: true,
    likes: 2960,
    reposts: 712,
    replies: 208,
  },
  {
    id: "post-06",
    accountSlug: "opencode",
    minutesAgo: 400,
    text: "Curated model list updated. Open-weight family added at no extra cost.",
    entities: ["OpenCode"],
    corroborated: true,
    likes: 240,
    reposts: 33,
    replies: 28,
  },
  {
    id: "post-07",
    accountSlug: "moonshot",
    minutesAgo: 620,
    text: "Kimi K3 supports a larger context window starting today.",
    entities: ["Kimi K3"],
    corroborated: true,
    likes: 1105,
    reposts: 214,
    replies: 96,
  },
  {
    id: "post-08",
    accountSlug: "kilo",
    minutesAgo: 720,
    text: "Kilo Pass tiers now include bonus credits on upgrade. Details on the pricing page.",
    entities: ["Kilo Code"],
    corroborated: true,
    likes: 176,
    reposts: 24,
    replies: 19,
  },
  {
    id: "post-09",
    accountSlug: "gemini-cli",
    minutesAgo: 900,
    text: "New release: default model selection changed and slash-command handling was reworked.",
    entities: ["Gemini CLI"],
    corroborated: true,
    likes: 512,
    reposts: 88,
    replies: 63,
  },
  {
    id: "post-10",
    accountSlug: "alibaba-qwen",
    minutesAgo: 1440,
    text: "Updated tool-calling evaluation harness published, with multi-turn function-calling scenarios.",
    entities: ["Qwen3.5"],
    corroborated: false,
    likes: 690,
    reposts: 132,
    replies: 41,
  },
  {
    id: "post-11",
    accountSlug: "xai",
    minutesAgo: 2600,
    text: "Grok 5 enterprise agreements now include a cache read discount.",
    entities: ["Grok 5"],
    corroborated: false,
    likes: 1480,
    reposts: 260,
    replies: 174,
  },
  {
    id: "post-12",
    accountSlug: "googledeepmind",
    minutesAgo: 3200,
    text: "Gemini 3 pricing tiers and cache discounts are restated on the pricing page.",
    entities: ["Gemini 3"],
    corroborated: true,
    likes: 2240,
    reposts: 402,
    replies: 155,
  },
  {
    id: "hn-01",
    accountSlug: "hackernews",
    minutesAgo: 150,
    text: "Show HN: a local-first coding agent that runs on open-weight models",
    entities: [],
    corroborated: false,
    likes: 412,
    reposts: null,
    replies: 138,
  },
  {
    id: "hn-02",
    accountSlug: "hackernews",
    minutesAgo: 540,
    text: "Discussion: benchmark contamination and what it means for model rankings",
    entities: [],
    corroborated: false,
    likes: 268,
    reposts: null,
    replies: 97,
  },
];

/** Uncorroborated claim used to exercise the "not yet corroborated" UI state. */
const UNVERIFIED_SEED: PostSeed = {
  id: "post-13",
  accountSlug: "artificialanalysis",
  minutesAgo: 30,
  text: "Rumour: a new frontier model may be benchmarked this week. We have not verified this.",
  entities: ["Rumour"],
  corroborated: false,
  likes: 96,
  reposts: 14,
  replies: 22,
};

function postIdFor(account: MonitoredAccount, seedId: string): string {
  return account.platform === "hackernews" ? seedId : `${seedId}-bsky`;
}

function postUrlFor(account: MonitoredAccount, id: string): string {
  const handle = account.handle.replace("@", "");
  return account.platform === "hackernews"
    ? `https://news.ycombinator.com/item?id=${id}`
    : `https://bsky.app/profile/${handle}/post/${id}`;
}

export function buildFixtureSocialPosts(now: Date): SocialPost[] {
  const accounts = buildFixtureMonitoredAccounts();
  const bySlug = new Map(
    MONITORED_ACCOUNT_SEEDS.map((seed, index) => [seed.slug, accounts[index]!]),
  );

  return [...POST_SEEDS, UNVERIFIED_SEED]
    .sort((a, b) => a.minutesAgo - b.minutesAgo)
    .map((seed) => {
      const account = bySlug.get(seed.accountSlug);
      if (!account) throw new Error(`Unknown social account slug "${seed.accountSlug}"`);
      const postId = postIdFor(account, seed.id);
      return {
        id: seed.id,
        accountId: account.id,
        handle: account.handle,
        displayName: account.displayName,
        platform: account.platform,
        postId,
        url: postUrlFor(account, postId),
        text: seed.text,
        publishedAt: new Date(now.getTime() - seed.minutesAgo * 60_000).toISOString(),
        metrics: { likes: seed.likes, reposts: seed.reposts, replies: seed.replies },
        entities: seed.entities,
        corroborated: seed.corroborated,
      } satisfies SocialPost;
    });
}
