import * as React from "react";
import { loadModelWorkspace } from "@/lib/data/workspace";
import { ModelsShell } from "./models-shell";

/**
 * Server-side wrapper that loads the Models workspace data and hands it to the
 * client shell. Keeps every Models route to three lines.
 */
export async function ModelsShellServer({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const data = await loadModelWorkspace();

  return (
    <ModelsShell
      models={data.models}
      providers={data.providers}
      previousByModelId={data.previousByModelId}
      snapshotsByModelId={data.snapshotsByModelId}
      initialSelectedIds={data.defaultSelection}
    >
      {children}
    </ModelsShell>
  );
}
