import type { Metadata } from "next";
import { ModelsShellServer } from "@/features/models/models-shell-server";
import { RankingsView } from "@/features/models/views";

export const metadata: Metadata = {
  title: "Models · Rankings",
  description: "Top 10 boards for intelligence, coding, agentic, speed, price and cost efficiency.",
};

export default async function RankingsPage(): Promise<React.JSX.Element> {
  return (
    <ModelsShellServer>
      <RankingsView />
    </ModelsShellServer>
  );
}
