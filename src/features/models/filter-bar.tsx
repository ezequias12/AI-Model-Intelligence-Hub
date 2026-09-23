"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label, Select } from "@/components/ui/input";
import { Chip, ProviderDot, Segmented } from "@/components/ui/primitives";
import { Popover } from "@/components/ui/overlay";
import {
  PROVIDER_FILTER_LABELS,
  PROVIDER_FILTER_VALUES,
  type ProviderFilterValue,
} from "@/lib/domain/selection";
import { cn } from "@/lib/utils/cn";
import { useModelsWorkspace } from "./workspace-context";

const OPTIONS = PROVIDER_FILTER_VALUES.map((value) => ({
  value,
  label: PROVIDER_FILTER_LABELS[value],
  title:
    value === "china_based"
      ? "Geographic provider classification — not a quality label"
      : value === "mainstream"
        ? "Mainstream/global provider grouping"
        : undefined,
}));

const THRESHOLD_OPTIONS = [
  { value: 0, label: "Any capability" },
  { value: 40, label: "Intelligence ≥ 40" },
  { value: 50, label: "Intelligence ≥ 50" },
  { value: 60, label: "Intelligence ≥ 60" },
  { value: 70, label: "Intelligence ≥ 70" },
];

export function ModelFilterBar({
  showScope = true,
  className,
}: {
  showScope?: boolean;
  className?: string;
}): React.JSX.Element {
  const workspace = useModelsWorkspace();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-panel border border-border bg-surface px-3 py-2",
        className,
      )}
    >
      {showScope && (
        <div className="flex items-center gap-2">
          <span className="text-2xs font-medium text-muted-foreground">Scope</span>
          <Segmented
            ariaLabel="Ranking scope"
            size="sm"
            value={workspace.scope}
            onChange={(value) => workspace.setScope(value)}
            options={[
              { value: "all", label: "All models" },
              { value: "selected", label: `Selected (${workspace.selectedIds.length})` },
            ]}
          />
        </div>
      )}

      <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
        <span className="text-2xs font-medium text-muted-foreground">Provider</span>
        {/* Six options are wider than a phone viewport. The control scrolls
            inside its own box rather than pushing the whole page sideways. */}
        <Segmented
          ariaLabel="Provider group filter"
          size="sm"
          className="min-w-0 max-w-full overflow-x-auto"
          value={workspace.providerFilter}
          onChange={(value: ProviderFilterValue) => workspace.setProviderFilter(value)}
          options={OPTIONS}
        />
      </div>

      {workspace.providerFilter === "custom" && (
        <Popover
          label="Custom provider selection"
          trigger={({ toggle }) => (
            <Button variant="outline" size="sm" onClick={toggle}>
              {workspace.customProviderIds.length === 0
                ? "Choose providers"
                : `${workspace.customProviderIds.length} providers`}
            </Button>
          )}
        >
          {() => (
            <div className="scroll-thin max-h-72 overflow-y-auto">
              {workspace.providers.map((provider) => {
                const checked = workspace.customProviderIds.includes(provider.id);
                return (
                  <label
                    key={provider.id}
                    className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-xs transition-colors hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        workspace.setCustomProviderIds(
                          checked
                            ? workspace.customProviderIds.filter((id) => id !== provider.id)
                            : [...workspace.customProviderIds, provider.id],
                        )
                      }
                      className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                    />
                    <ProviderDot color={provider.color} name={provider.name} />
                    {provider.name}
                  </label>
                );
              })}
            </div>
          )}
        </Popover>
      )}

      <div className="flex items-center gap-2">
        <Label htmlFor="capability-threshold" className="text-2xs text-muted-foreground">
          Minimum
        </Label>
        <Select
          id="capability-threshold"
          className="w-[164px]"
          value={String(workspace.minimumCapability)}
          onChange={(event) => workspace.setMinimumCapability(Number(event.target.value))}
        >
          {THRESHOLD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {workspace.minimumCapability > 0 && (
        <Badge variant="info" title="Cheap but weak models are excluded from these rankings">
          Capability threshold active
        </Badge>
      )}

      {workspace.providerFilter === "custom" && workspace.customProviderIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {workspace.customProviderIds.map((id) => {
            const provider = workspace.providers.find((entry) => entry.id === id);
            if (!provider) return null;
            return (
              <Chip
                key={id}
                removeLabel={`Remove ${provider.name} filter`}
                onRemove={() =>
                  workspace.setCustomProviderIds(
                    workspace.customProviderIds.filter((value) => value !== id),
                  )
                }
              >
                <ProviderDot color={provider.color} name={provider.name} />
                {provider.name}
              </Chip>
            );
          })}
        </div>
      )}
    </div>
  );
}
