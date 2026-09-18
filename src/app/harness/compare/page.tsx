import type { Metadata } from "next";
import { PlanCompare } from "@/features/harness/plan-compare";
import { loadHarnessWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = {
  title: "Harness · Compare",
  description:
    "Select coding-agent plans and compare price, credits, usage, models, BYOK and platform support side by side.",
};

export default async function HarnessComparePage(): Promise<React.JSX.Element> {
  const workspace = await loadHarnessWorkspace();
  const latestSnapshots = Array.from(workspace.latestSnapshotByPlan.values());

  return (
    <PlanCompare
      products={workspace.products}
      plans={workspace.plans}
      latestSnapshots={latestSnapshots}
    />
  );
}
