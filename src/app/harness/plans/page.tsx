import type { Metadata } from "next";
import { PlanBoard } from "@/features/harness/plan-board";
import { loadHarnessWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = {
  title: "Harness · Plans",
  description:
    "Every active coding-agent plan with price, billing period, included credits, model access, BYOK, open-source status and platform support.",
};

export default async function HarnessPlansPage(): Promise<React.JSX.Element> {
  const workspace = await loadHarnessWorkspace();
  const latestSnapshots = Array.from(workspace.latestSnapshotByPlan.values());

  return (
    <PlanBoard
      products={workspace.products}
      plans={workspace.plans}
      latestSnapshots={latestSnapshots}
    />
  );
}
