import type { Metadata } from "next";
import { CompareView } from "@/features/compare/compare-view";
import { ModelsShellServer } from "@/features/models/models-shell-server";
import { loadHarnessWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = {
  title: "Compare",
  description:
    "Side-by-side comparison workspace for models and, in a separate mode, coding-harness plans.",
};

export default async function ComparePage(): Promise<React.JSX.Element> {
  const harness = await loadHarnessWorkspace();

  const defaultPlanIds = harness.plans
    .filter((plan) => plan.active && harness.latestSnapshotByPlan.has(plan.id))
    .slice(0, 3)
    .map((plan) => plan.id);

  return (
    <ModelsShellServer>
      <CompareView
        products={harness.products}
        plans={harness.plans}
        latestSnapshots={[...harness.latestSnapshotByPlan.values()]}
        defaultPlanIds={defaultPlanIds}
      />
    </ModelsShellServer>
  );
}
