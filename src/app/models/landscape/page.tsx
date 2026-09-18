import type { Metadata } from "next";
import { ModelsShellServer } from "@/features/models/models-shell-server";
import { LandscapeView } from "@/features/models/views";

export const metadata: Metadata = {
  title: "Models · Landscape",
  description:
    "Configurable scatter charts with Pareto frontier highlighting, provider colours and an accessible data table.",
};

export default async function LandscapePage(): Promise<React.JSX.Element> {
  return (
    <ModelsShellServer>
      <LandscapeView />
    </ModelsShellServer>
  );
}
