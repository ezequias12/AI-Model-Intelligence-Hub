"use client";

import * as React from "react";
import { ChevronDown, Plus, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chip, ProviderDot } from "@/components/ui/primitives";
import { Popover } from "@/components/ui/overlay";
import {
  MAX_COMPARISON_MODELS,
  PRESET_KEYS,
  PRESET_LABELS,
  type PresetKey,
} from "@/lib/domain/selection";
import { cn } from "@/lib/utils/cn";
import { useModelsWorkspace } from "./workspace-context";
import { ModelSelector } from "./model-selector";

export function SelectionTray(): React.JSX.Element {
  const workspace = useModelsWorkspace();
  const [selectorOpen, setSelectorOpen] = React.useState(false);

  const providerById = React.useMemo(
    () => new Map(workspace.providers.map((provider) => [provider.id, provider])),
    [workspace.providers],
  );

  const selected = workspace.selectedIds
    .map((id) => workspace.models.find((model) => model.id === id))
    .filter((model): model is NonNullable<typeof model> => Boolean(model));

  const statusLabel =
    workspace.source === "default"
      ? "Default comparison set"
      : workspace.source === "preset" && workspace.preset
        ? `Preset: ${PRESET_LABELS[workspace.preset]}`
        : "Custom comparison set";

  return (
    <section
      aria-label="Comparison set"
      className="sticky top-[calc(var(--tray-offset,7.25rem))] z-20 rounded-panel border border-border bg-surface-raised/95 p-3 backdrop-blur"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">Comparison set</h2>
          <Badge variant={workspace.source === "default" ? "muted" : "primary"}>
            {statusLabel}
          </Badge>
          <span className="tabular text-2xs text-muted-foreground">
            {selected.length}/{MAX_COMPARISON_MODELS} models
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Popover
            label="Presets"
            align="end"
            trigger={({ toggle, open }) => (
              <Button variant="outline" size="sm" onClick={toggle} aria-expanded={open}>
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                Presets
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              </Button>
            )}
          >
            {({ close }) => (
              <div className="flex flex-col">
                <p className="px-2 py-1.5 text-2xs text-muted-foreground">
                  Provider grouping is geographic/structural, never a quality judgement.
                </p>
                {PRESET_KEYS.filter((key) => key !== "custom").map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      workspace.applyPresetKey(key as PresetKey);
                      close();
                    }}
                    className={cn(
                      "rounded-control px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent",
                      workspace.preset === key && "bg-accent font-medium",
                    )}
                  >
                    {PRESET_LABELS[key]}
                  </button>
                ))}
              </div>
            )}
          </Popover>

          <Button variant="outline" size="sm" onClick={workspace.resetSelection}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Restore defaults
          </Button>

          <Button size="sm" onClick={() => setSelectorOpen(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add models
          </Button>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {selected.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No models selected. Use <span className="font-medium">Add models</span> or a preset to
            build a comparison set.
          </p>
        )}
        {selected.map((model) => {
          const provider = providerById.get(model.providerId);
          return (
            <Chip
              key={model.id}
              title={model.name}
              removeLabel={`Remove ${model.name}`}
              onRemove={() => workspace.toggleModel(model.id)}
            >
              <ProviderDot color={provider?.color ?? null} name={provider?.name ?? "Unknown"} />
              <span className="font-medium">{model.shortName}</span>
              <span className="hidden text-2xs text-muted-foreground sm:inline">
                {provider?.name ?? "Unknown"}
              </span>
            </Chip>
          );
        })}
      </div>

      <ModelSelector open={selectorOpen} onOpenChange={setSelectorOpen} />
    </section>
  );
}
