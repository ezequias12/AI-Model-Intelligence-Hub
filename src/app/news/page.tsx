import type { Metadata } from "next";
import { NewsOverview } from "@/features/news/news-overview";
import { loadNewsWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = {
  title: "News",
  description:
    "Cross-category AI news overview: lead story, latest reports, trending entities and the social pulse of monitored accounts.",
};

export default async function NewsOverviewPage(): Promise<React.JSX.Element> {
  const { news, socialPosts, providers } = await loadNewsWorkspace();

  return <NewsOverview news={news} socialPosts={socialPosts} providers={providers} />;
}
