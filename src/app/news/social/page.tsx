import type { Metadata } from "next";
import { Panel, Section } from "@/components/ui/card";
import { SocialPulse } from "@/features/news/social-pulse";
import { loadNewsWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = {
  title: "News · Social Pulse",
  description:
    "Monitored AI accounts ingested through authorized platform APIs only. X HTML is never scraped and full posts are never mirrored.",
};

export default async function SocialPulsePage(): Promise<React.JSX.Element> {
  const { socialPosts, repository } = await loadNewsWorkspace();
  const mock = repository.meta.mode === "mock";

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-panel border border-info/30 bg-info-muted px-3.5 py-2.5 text-xs"
        role="note"
      >
        <p className="font-medium text-info">Authorized APIs only</p>
        <p className="mt-0.5 text-muted-foreground">
          Social ingestion runs through authorized platform APIs. X (Twitter) HTML is never scraped,
          and posts are shown as short excerpts consistent with platform terms rather than full
          mirrors or embedded content.
        </p>
        {mock && (
          <p className="mt-1 font-medium text-warning">
            Mock mode: every row below is deterministic fixture data, not live social data.
          </p>
        )}
      </div>

      <Section
        title="Social pulse"
        description="A dense timeline of monitored model providers, researchers, benchmark organizations and coding-harness accounts. “Not yet corroborated” means no official or tier-1 source has confirmed the claim."
      >
        <Panel className="p-0">
          <SocialPulse posts={socialPosts} />
        </Panel>
      </Section>
    </div>
  );
}
