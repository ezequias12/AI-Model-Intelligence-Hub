import type { Metadata } from "next";
import { getRepository } from "@/lib/data";
import { ModelsShellServer } from "@/features/models/models-shell-server";
import { ReleasesView } from "@/features/models/releases-view";

export const metadata: Metadata = {
  title: "Models · Releases",
  description: "Chronological model releases, deprecations and observed price or metric changes.",
};

export default async function ReleasesPage(): Promise<React.JSX.Element> {
  const repository = await getRepository();
  const changeEvents = await repository.getChangeEvents(80);

  return (
    <ModelsShellServer>
      <ReleasesView changeEvents={changeEvents} />
    </ModelsShellServer>
  );
}
