import type { Metadata } from "next";
import { NewsDomainView } from "@/features/news/feed";
import { loadNewsWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = {
  title: "News · Research & Benchmarks",
  description:
    "Benchmarks, methodology revisions and evaluation changes. Tier 3 covers uncorroborated discovery signals such as preprints.",
};

export default async function ResearchNewsPage(): Promise<React.JSX.Element> {
  const { news, providers } = await loadNewsWorkspace();
  const items = news.filter((item) => item.domain === "research");

  return (
    <NewsDomainView
      title="Research & Benchmarks"
      description="Benchmark releases, methodology revisions and evaluation changes. Preprints and community discussion are tier 3 until corroborated."
      domain="research"
      items={items}
      providers={providers}
      emptyLabel="No research reports match the current filters."
    />
  );
}
