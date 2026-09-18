import type { Metadata } from "next";
import { NewsDomainView } from "@/features/news/feed";
import { loadNewsWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = {
  title: "News · Model Providers",
  description:
    "Provider-specific feeds: official releases, pricing restatements and product changes from the tracked model providers.",
};

export default async function ProviderNewsPage(): Promise<React.JSX.Element> {
  const { news, providers } = await loadNewsWorkspace();
  const items = news.filter((item) => item.domain === "provider");

  return (
    <NewsDomainView
      title="Model Providers"
      description="Provider-specific feeds. Official provider pages and changelogs are tier 1; use the provider filter to narrow the feed."
      domain="provider"
      items={items}
      providers={providers}
      emptyLabel="No provider reports match the current filters."
    />
  );
}
