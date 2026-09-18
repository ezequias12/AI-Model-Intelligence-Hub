"use client";

import * as React from "react";
import type { Model, ModelMetrics, ModelSnapshot, Provider } from "@/lib/domain/schema";
import { SelectionTray } from "./selection-tray";
import { ModelsWorkspaceProvider } from "./workspace-context";

export interface ModelsShellProps {
  models: Model[];
  providers: Provider[];
  previousByModelId: Record<string, ModelMetrics>;
  snapshotsByModelId: Record<string, ModelSnapshot[]>;
  initialSelectedIds: string[];
  children: React.ReactNode;
}

/**
 * Client shell for every page in the Models workspace.
 *
 * The selection tray is rendered once here so it stays visible across the
 * workspace sub-routes while remaining a single source of selection state.
 */
export function ModelsShell({
  models,
  providers,
  previousByModelId,
  snapshotsByModelId,
  initialSelectedIds,
  children,
}: ModelsShellProps): React.JSX.Element {
  return (
    <ModelsWorkspaceProvider
      models={models}
      providers={providers}
      previousByModelId={previousByModelId}
      snapshotsByModelId={snapshotsByModelId}
      initialSelectedIds={initialSelectedIds}
    >
      <SelectionTray />
      {children}
    </ModelsWorkspaceProvider>
  );
}
