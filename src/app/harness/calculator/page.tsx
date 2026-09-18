import type { Metadata } from "next";
import { Calculator } from "@/features/harness/calculator";
import { loadHarnessWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = {
  title: "Harness · Calculator",
  description:
    "Transparent fit scoring for coding-agent plans based on budget, platform and model requirements.",
};

export default async function HarnessCalculatorPage(): Promise<React.JSX.Element> {
  const workspace = await loadHarnessWorkspace();
  const latestSnapshots = Array.from(workspace.latestSnapshotByPlan.values());

  return (
    <Calculator
      products={workspace.products}
      plans={workspace.plans}
      latestSnapshots={latestSnapshots}
    />
  );
}
