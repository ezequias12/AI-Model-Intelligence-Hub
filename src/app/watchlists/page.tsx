import type { Metadata } from "next";
import { WatchlistManager, type WatchlistCatalog } from "@/features/watchlists/watchlist-manager";
import { getRepository } from "@/lib/data";

export const metadata: Metadata = {
  title: "Watchlists",
  description:
    "Save model groups, providers, harness products, topics and news queries for quick return visits.",
};

const SUGGESTED_TOPICS = [
  "AI regulation",
  "Frontier model releases",
  "Coding harness pricing",
  "Open-weight models",
  "Benchmark changes",
];

export default async function WatchlistsPage(): Promise<React.JSX.Element> {
  const repository = await getRepository();
  const [models, providers, products] = await Promise.all([
    repository.getModels(),
    repository.getProviders(),
    repository.getHarnessProducts(),
  ]);

  const catalog: WatchlistCatalog = {
    models: models.map((model) => ({
      slug: model.slug,
      name: model.name,
      providerId: model.providerId,
    })),
    providers: providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      group: provider.group,
    })),
    harnessProducts: products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      vendor: product.vendor,
    })),
    suggestedTopics: SUGGESTED_TOPICS,
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <p className="max-w-3xl text-xs text-muted-foreground">
          Save the models, providers, harness products, topics and news queries you return to. Each
          saved item keeps a working link into its workspace.
        </p>
      </header>

      <WatchlistManager catalog={catalog} />
    </div>
  );
}
