import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, Section } from "@/components/ui/card";
import { TrustTierBadge } from "@/components/ui/primitives";
import { loadHarnessWorkspace } from "@/lib/data/workspace";
import { formatEnumLabel, formatRelative } from "@/lib/format";

export const metadata: Metadata = {
  title: "Harness · News",
  description: "Harness ecosystem news from official pricing pages, docs and changelogs.",
};

export default async function HarnessNewsPage(): Promise<React.JSX.Element> {
  const harnessData = await loadHarnessWorkspace();
  const repository = harnessData.repository;
  const news = await repository.getNews({ domain: "harness" });

  return (
    <Section
      title="Harness ecosystem news"
      description="Official and reputable coverage of coding-agent products. Trust tiers describe provenance quality, never a viewpoint."
      actions={
        <Link href="/harness/changes" className="text-xs underline underline-offset-2">
          Plan change feed
        </Link>
      }
    >
      {news.length === 0 ? (
        <p className="text-xs text-muted-foreground">No harness news in the current dataset.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {news.map((item) => (
            <Panel key={item.id}>
              <PanelBody className="flex flex-col gap-1.5 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-2xs font-medium">{item.sourceName}</span>
                  <TrustTierBadge tier={item.trustTier} />
                  {item.official && <Badge variant="success">Official</Badge>}
                  <Badge variant="outline">{formatEnumLabel(item.category)}</Badge>
                  <span
                    className="ml-auto text-2xs text-muted-foreground"
                    title={item.publishedAt ?? undefined}
                  >
                    {formatRelative(item.publishedAt)}
                  </span>
                </div>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm font-semibold underline-offset-2 hover:underline"
                >
                  {item.title}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                {item.excerpt && <p className="text-xs text-muted-foreground">{item.excerpt}</p>}
                {item.entities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {item.entities.map((entity) => (
                      <Badge key={entity} variant="muted">
                        {entity}
                      </Badge>
                    ))}
                  </div>
                )}
              </PanelBody>
            </Panel>
          ))}
        </div>
      )}
    </Section>
  );
}
