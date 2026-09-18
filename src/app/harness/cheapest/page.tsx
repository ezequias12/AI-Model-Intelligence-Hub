import type { Metadata } from "next";
import { Cheapest } from "@/features/harness/cheapest";
import { loadHarnessWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = {
  title: "Harness · Cheapest",
  description:
    "Factual cheapest-option views for coding-agent plans, each with the formula and source behind the result.",
};

export default async function HarnessCheapestPage(): Promise<React.JSX.Element> {
  const workspace = await loadHarnessWorkspace();
  const latestSnapshots = Array.from(workspace.latestSnapshotByPlan.values());

  return (
    <Cheapest
      products={workspace.products}
      plans={workspace.plans}
      latestSnapshots={latestSnapshots}
    />
  );
}
