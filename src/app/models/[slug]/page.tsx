import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Section } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetaLine, TrustTierBadge } from "@/components/ui/primitives";
import { ModelHistoryChart } from "@/features/models/model-history-chart";
import {
  ModelHeadline,
  ModelIdentitySection,
  ModelLineageSection,
  ModelMetricsSection,
  ModelPricingSection,
  RelatedModels,
} from "@/features/models/model-detail-sections";
import { loadModelWorkspace } from "@/lib/data/workspace";
import { formatRelative } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadModelWorkspace();
  const model = data.models.find((entry) => entry.slug === slug);

  if (!model) return { title: "Model not found" };

  return {
    title: `${model.name} · Models`,
    description: `${model.name} metrics, pricing, snapshots and related coverage.`,
  };
}

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<React.JSX.Element> {
  const { slug } = await params;
  const data = await loadModelWorkspace();

  const model = data.models.find((entry) => entry.slug === slug);
  if (!model) notFound();

  const provider = data.providersById.get(model.providerId);
  const snapshots = data.snapshotsByModelId[model.id] ?? [];
  const previous = data.previousByModelId[model.id] ?? null;
  const context = data.contexts.find((entry) => entry.model.id === model.id);

  const news = await data.repository.getNews({ limit: 200 });
  const relatedNews = news
    .filter(
      (item) =>
        item.providerIds.includes(model.providerId) ||
        item.entities.some((entity) => entity.toLowerCase() === model.name.toLowerCase()) ||
        item.title.toLowerCase().includes(model.shortName.toLowerCase()),
    )
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-2xs text-muted-foreground">
        <Link href="/models" className="underline-offset-2 hover:underline">
          Models
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{provider?.name ?? "Unknown provider"}</span>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{model.name}</span>
      </nav>

      <ModelHeadline model={model} provider={provider} />

      <Card>
        <CardContent className="py-3">
          <ModelIdentitySection model={model} provider={provider} />
        </CardContent>
      </Card>

      <Section
        title="Metrics"
        description="Measured values come from the source payload; derived values are computed here and labeled. An em dash means the source does not publish that metric."
      >
        <Card>
          <CardContent className="py-4">
            <ModelMetricsSection model={model} previous={previous} />
          </CardContent>
        </Card>
      </Section>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardContent className="py-4">
            <ModelPricingSection model={model} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <ModelLineageSection model={model} snapshots={snapshots} />
          </CardContent>
        </Card>
      </div>

      <ModelHistoryChart snapshots={snapshots} modelName={model.name} />

      <Section
        title="Recent coverage"
        description="News items mentioning this model or its provider. Trust tier describes provenance, never viewpoint."
      >
        {relatedNews.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No matching coverage in the current dataset.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {relatedNews.map((item) => (
              <Card key={item.id}>
                <CardHeader className="gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-2xs font-medium">{item.sourceName}</span>
                    <TrustTierBadge tier={item.trustTier} />
                    {item.official && <Badge variant="success">Official</Badge>}
                  </div>
                  <CardTitle className="text-xs leading-snug">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline-offset-2 hover:underline"
                    >
                      {item.title}
                    </a>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <MetaLine
                    className="text-2xs text-muted-foreground"
                    items={[formatRelative(item.publishedAt), item.category.replace(/_/g, " ")]}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Card>
        <CardContent className="py-4">
          {context ? (
            <RelatedModels contexts={data.contexts} model={model} />
          ) : (
            <p className="text-xs text-muted-foreground">Related models unavailable.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
