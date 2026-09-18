import type { Metadata } from "next";
import { SourceRegistry } from "@/features/sources/source-registry";
import { getRepository } from "@/lib/data";

export const metadata: Metadata = {
  title: "Sources",
  description:
    "Source registry with adapter status, freshness, rate-limit state, errors and integration capabilities.",
};

export default async function SourcesPage(): Promise<React.JSX.Element> {
  const repository = await getRepository();
  const [sources, runs] = await Promise.all([
    repository.getSources(),
    repository.getIngestionRuns({ limit: 200 }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <p className="max-w-3xl text-xs text-muted-foreground">
          Operational transparency for every source: what it is, whether it is enabled, how fresh it
          is, its rate-limit state, the most recent error, and which integrations are configured.
          Freshness is measured against per-domain thresholds and never presented without its age.
        </p>
      </header>

      <SourceRegistry sources={sources} runs={runs} meta={repository.meta} />
    </div>
  );
}
