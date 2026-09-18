import type { Metadata } from "next";
import { NewsDomainView } from "@/features/news/feed";
import { loadNewsWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = {
  title: "News · AI General",
  description:
    "AI general news: model releases, launches, research, funding, infrastructure and regulation, with source trust tiers.",
};

export default async function AiGeneralNewsPage(): Promise<React.JSX.Element> {
  const { news, providers } = await loadNewsWorkspace();
  const items = news.filter((item) => item.domain === "ai_general");

  return (
    <NewsDomainView
      title="AI General"
      description="Launches, research, funding, infrastructure and regulation. Trust tiers describe source provenance, never a viewpoint."
      domain="ai_general"
      items={items}
      providers={providers}
      emptyLabel="No AI general reports match the current filters."
    />
  );
}
