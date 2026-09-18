import type { Metadata } from "next";
import { DashboardView } from "@/features/models/dashboard-view";
import { ModelsShellServer } from "@/features/models/models-shell-server";

export const metadata: Metadata = {
  title: "Models",
  description:
    "Model intelligence dashboard: metric leaders, cost efficiency, provider segmentation and the current comparison set.",
};

export default async function ModelsDashboardPage(): Promise<React.JSX.Element> {
  return (
    <ModelsShellServer>
      <DashboardView />
    </ModelsShellServer>
  );
}
