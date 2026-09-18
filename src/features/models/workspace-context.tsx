"use client";

import * as React from "react";
import type { Model, ModelMetrics, ModelSnapshot, Provider } from "@/lib/domain/schema";
import { buildModelContexts, type ModelContext } from "@/lib/analytics/metric-registry";
import {
  clampSelection,
  decodeSelection,
  encodeSelection,
  SELECTION_QUERY_PARAM,
  SELECTION_SOURCE_KEY,
  SELECTION_STORAGE_KEY,
  applyPreset,
  reconcileSelection,
  type PresetKey,
  type ProviderFilterValue,
  type SelectionSource,
} from "@/lib/domain/selection";

export interface ModelsWorkspaceValue {
  models: Model[];
  providers: Provider[];
  contexts: ModelContext[];
  /** Snapshot history keyed by model id, for the detail drawer. */
  snapshotsByModelId: Record<string, ModelSnapshot[]>;
  /** Currently compared models. */
  selectedIds: string[];
  source: SelectionSource;
  preset: PresetKey | null;
  /** Provider scope applied to the all-models views. */
  providerFilter: ProviderFilterValue;
  customProviderIds: string[];
  scope: "selected" | "all";
  minimumCapability: number;
  setSelectedIds: (ids: string[], source?: SelectionSource, preset?: PresetKey | null) => void;
  toggleModel: (id: string) => void;
  resetSelection: () => void;
  applyPresetKey: (preset: PresetKey) => void;
  setProviderFilter: (value: ProviderFilterValue) => void;
  setCustomProviderIds: (ids: string[]) => void;
  setScope: (value: "selected" | "all") => void;
  setMinimumCapability: (value: number) => void;
  /** True once the client has hydrated selection from storage/URL. */
  hydrated: boolean;
}

const ModelsWorkspaceContext = React.createContext<ModelsWorkspaceValue | null>(null);

export function useModelsWorkspace(): ModelsWorkspaceValue {
  const value = React.useContext(ModelsWorkspaceContext);
  if (!value) {
    throw new Error("useModelsWorkspace must be used inside <ModelsWorkspaceProvider>");
  }
  return value;
}

export interface ModelsWorkspaceProviderProps {
  models: Model[];
  providers: Provider[];
  /** Previous snapshot metrics keyed by model id, for deltas. */
  previousByModelId: Record<string, ModelMetrics>;
  /** Snapshot history keyed by model id, for the detail drawer. */
  snapshotsByModelId?: Record<string, ModelSnapshot[]>;
  initialSelectedIds: string[];
  initialSource?: SelectionSource;
  initialPreset?: PresetKey | null;
  children: React.ReactNode;
}

export function ModelsWorkspaceProvider({
  models,
  providers,
  previousByModelId,
  snapshotsByModelId = {},
  initialSelectedIds,
  initialSource = "default",
  initialPreset = null,
  children,
}: ModelsWorkspaceProviderProps): React.JSX.Element {
  const previousMap = React.useMemo(() => {
    const map = new Map<string, ModelMetrics>();
    for (const [modelId, metrics] of Object.entries(previousByModelId)) map.set(modelId, metrics);
    return map;
  }, [previousByModelId]);

  const contexts = React.useMemo(
    () => buildModelContexts(models, providers, previousMap),
    [models, providers, previousMap],
  );

  const [selectedIds, setSelectedIdsState] = React.useState<string[]>(() =>
    reconcileSelection(initialSelectedIds, models),
  );
  const [source, setSource] = React.useState<SelectionSource>(initialSource);
  const [preset, setPreset] = React.useState<PresetKey | null>(initialPreset);
  const [providerFilter, setProviderFilter] = React.useState<ProviderFilterValue>("all");
  const [customProviderIds, setCustomProviderIds] = React.useState<string[]>([]);
  const [scope, setScope] = React.useState<"selected" | "all">("all");
  const [minimumCapability, setMinimumCapability] = React.useState(0);
  const [hydrated, setHydrated] = React.useState(false);

  const persist = React.useCallback(
    (ids: string[], nextSource: SelectionSource, nextPreset: PresetKey | null) => {
      const encoded = encodeSelection(ids);

      try {
        window.localStorage.setItem(SELECTION_STORAGE_KEY, encoded);
        window.localStorage.setItem(SELECTION_SOURCE_KEY, nextSource);
      } catch {
        // Storage can be unavailable (private mode); the URL still carries state.
      }

      // replaceState keeps the URL shareable without triggering a server
      // round-trip on every chip click.
      const params = new URLSearchParams(window.location.search);
      if (encoded.length > 0) params.set(SELECTION_QUERY_PARAM, encoded);
      else params.delete(SELECTION_QUERY_PARAM);
      const query = params.toString();
      const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
      window.history.replaceState(null, "", nextUrl);

      void nextSource;
      void nextPreset;
    },
    [],
  );

  // On first mount, prefer an explicit URL selection; otherwise fall back to the
  // last-used selection in local storage; otherwise keep the resolved default.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = decodeSelection(params.get(SELECTION_QUERY_PARAM));

    if (fromUrl.length > 0) {
      const reconciled = reconcileSelection(fromUrl, models);
      if (reconciled.length > 0) {
        setSelectedIdsState(clampSelection(reconciled));
        setSource("custom");
        setPreset(null);
      }
      setHydrated(true);
      return;
    }

    try {
      const stored = window.localStorage.getItem(SELECTION_STORAGE_KEY);
      const storedSource = window.localStorage.getItem(SELECTION_SOURCE_KEY);
      const fromStorage = reconcileSelection(decodeSelection(stored), models);
      if (fromStorage.length > 0) {
        setSelectedIdsState(clampSelection(fromStorage));
        setSource(
          storedSource === "preset" || storedSource === "custom" || storedSource === "default"
            ? storedSource
            : "custom",
        );
      }
    } catch {
      // Ignore storage failures and keep the server-resolved default.
    }

    setHydrated(true);
  }, [models]);

  const setSelectedIds = React.useCallback(
    (
      ids: string[],
      nextSource: SelectionSource = "custom",
      nextPreset: PresetKey | null = null,
    ) => {
      const reconciled = clampSelection(reconcileSelection(ids, models));
      setSelectedIdsState(reconciled);
      setSource(nextSource);
      setPreset(nextPreset);
      persist(reconciled, nextSource, nextPreset);
    },
    [models, persist],
  );

  const toggleModel = React.useCallback(
    (id: string) => {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((value) => value !== id)
        : [...selectedIds, id];
      setSelectedIds(next, "custom", null);
    },
    [selectedIds, setSelectedIds],
  );

  const resetSelection = React.useCallback(() => {
    setSelectedIds(initialSelectedIds, "default", null);
  }, [initialSelectedIds, setSelectedIds]);

  const applyPresetKey = React.useCallback(
    (nextPreset: PresetKey) => {
      if (nextPreset === "custom") {
        setSelectedIds(selectedIds, "custom", "custom");
        return;
      }
      const application = applyPreset(nextPreset, models, providers);
      setSelectedIds(application.ids, "preset", nextPreset);
    },
    [models, providers, selectedIds, setSelectedIds],
  );

  const value = React.useMemo<ModelsWorkspaceValue>(
    () => ({
      models,
      providers,
      contexts,
      snapshotsByModelId,
      selectedIds,
      source,
      preset,
      providerFilter,
      customProviderIds,
      scope,
      minimumCapability,
      setSelectedIds,
      toggleModel,
      resetSelection,
      applyPresetKey,
      setProviderFilter,
      setCustomProviderIds,
      setScope,
      setMinimumCapability,
      hydrated,
    }),
    [
      models,
      providers,
      contexts,
      snapshotsByModelId,
      selectedIds,
      source,
      preset,
      providerFilter,
      customProviderIds,
      scope,
      minimumCapability,
      setSelectedIds,
      toggleModel,
      resetSelection,
      applyPresetKey,
      hydrated,
    ],
  );

  return (
    <ModelsWorkspaceContext.Provider value={value}>
      <div className="flex flex-col gap-8">{children}</div>
    </ModelsWorkspaceContext.Provider>
  );
}
