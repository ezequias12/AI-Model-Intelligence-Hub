import type { Metadata } from "next";
import { OverviewBlocks } from "@/features/overview/overview-blocks";
import { loadOverview, previousMetricsByModel } from "@/lib/data/workspace";

export const metadata: Metadata = {
  title: "Overview",
  description:
    "Cross-domain command center: market pulse, model changes, top value models, AI news, harness plan changes and world headlines.",
};

export default async function OverviewPage(): Promise<React.JSX.Element> {
  const overview = await loadOverview();
  const previousByModelId = previousMetricsByModel(overview.modelWorkspace.snapshots);

  return (
    <OverviewBlocks
      models={overview.modelWorkspace.models}
      providers={overview.modelWorkspace.providers}
      previousByModelId={previousByModelId}
      news={overview.news}
      harnessProducts={overview.harness.products}
      harnessPlans={overview.harness.plans}
      harnessSnapshots={[...overview.harness.latestSnapshotByPlan.values()]}
      harnessChangeEvents={overview.harness.changeEvents}
      world={overview.world}
      socialPosts={overview.socialPosts}
      changeEvents={overview.changeEvents}
      sources={overview.sources}
      ingestionRuns={overview.ingestionRuns}
    />
  );
}
