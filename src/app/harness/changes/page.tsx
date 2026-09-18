import type { Metadata } from "next";
import { ChangeFeed } from "@/features/harness/change-feed";
import { loadHarnessWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = {
  title: "Harness · Changes",
  description:
    "Chronological feed of coding-agent plan, price, credit, model-access and promotion changes.",
};

export default async function HarnessChangesPage(): Promise<React.JSX.Element> {
  const workspace = await loadHarnessWorkspace();

  return (
    <ChangeFeed
      changeEvents={workspace.changeEvents}
      products={workspace.products}
      plans={workspace.plans}
    />
  );
}
