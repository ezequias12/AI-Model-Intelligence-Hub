"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Modal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Input } from "@/components/ui/input";
import { MetaLine, ProviderDot, Segmented } from "@/components/ui/primitives";
import { MAX_COMPARISON_MODELS } from "@/lib/domain/selection";
import { cn } from "@/lib/utils/cn";
import { useModelsWorkspace } from "./workspace-context";

type GroupFilter = "all" | "recent" | "mainstream" | "china_based" | "open_weight";

const GROUP_OPTIONS: Array<{ value: GroupFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "recent", label: "Recent" },
  { value: "mainstream", label: "Mainstream" },
  { value: "china_based", label: "China-based" },
  { value: "open_weight", label: "Open-weight" },
];

export function ModelSelector({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const workspace = useModelsWorkspace();
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState<GroupFilter>("all");
  const [draft, setDraft] = React.useState<string[]>(workspace.selectedIds);

  React.useEffect(() => {
    if (open) {
      setDraft(workspace.selectedIds);
      setQuery("");
      setGroup("all");
    }
  }, [open, workspace.selectedIds]);

  const providerById = React.useMemo(
    () => new Map(workspace.providers.map((provider) => [provider.id, provider])),
    [workspace.providers],
  );

  const filtered = React.useMemo(() => {
    let list = [...workspace.models];

    if (group === "mainstream") {
      list = list.filter(
        (model) => providerById.get(model.providerId)?.group === "mainstream_global",
      );
    } else if (group === "china_based") {
      list = list.filter((model) => providerById.get(model.providerId)?.group === "china_based");
    } else if (group === "open_weight") {
      list = list.filter((model) => model.openWeight);
    } else if (group === "recent") {
      list = list
        .filter((model) => model.releaseDate)
        .sort((a, b) => Date.parse(b.releaseDate ?? "") - Date.parse(a.releaseDate ?? ""))
        .slice(0, 14);
    }

    if (query.trim().length > 0) {
      const needle = query.trim().toLowerCase();
      list = list.filter((model) => {
        const provider = providerById.get(model.providerId);
        return `${model.name} ${model.shortName} ${model.slug} ${provider?.name ?? ""}`
          .toLowerCase()
          .includes(needle);
      });
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [group, providerById, query, workspace.models]);

  const toggle = (id: string): void => {
    setDraft((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length >= MAX_COMPARISON_MODELS
          ? current
          : [...current, id],
    );
  };

  const atLimit = draft.length >= MAX_COMPARISON_MODELS;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add models"
      description={`Search, filter by provider grouping, and pick up to ${MAX_COMPARISON_MODELS} models.`}
      className="max-w-2xl"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search models or providers…"
            aria-label="Search models"
            className="pl-8"
          />
        </div>
        <Segmented
          ariaLabel="Provider grouping filter"
          options={GROUP_OPTIONS}
          value={group}
          onChange={setGroup}
          size="sm"
        />
      </div>

      <div
        className="scroll-thin max-h-[46vh] overflow-y-auto p-1.5"
        role="group"
        aria-label="Model list"
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">No models match.</p>
        ) : (
          filtered.map((model) => {
            const provider = providerById.get(model.providerId);
            const checked = draft.includes(model.id);
            const disabled = !checked && atLimit;

            return (
              <label
                key={model.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-control px-2.5 py-2 transition-colors",
                  checked ? "bg-accent/70" : "hover:bg-accent/50",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <Checkbox checked={checked} disabled={disabled} onChange={() => toggle(model.id)} />
                <ProviderDot
                  color={provider?.color ?? null}
                  name={provider?.name ?? "Unknown"}
                  size={9}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-xs font-medium">{model.name}</span>
                  <MetaLine
                    className="text-2xs text-muted-foreground"
                    items={[
                      provider?.name ?? "Unknown provider",
                      model.openWeight ? "open-weight" : null,
                      model.deprecatedAt ? "deprecated" : null,
                    ]}
                  />
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                  {model.metrics.intelligence !== null && (
                    <Badge variant="muted">Intel {model.metrics.intelligence}</Badge>
                  )}
                  {model.openWeight && <Badge variant="outline">Open</Badge>}
                </span>
              </label>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-2.5">
        <MetaLine
          className="text-2xs text-muted-foreground"
          items={[`${draft.length} selected`, atLimit ? "limit reached" : null]}
        />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDraft([])}>
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              workspace.setSelectedIds(draft, "custom", null);
              onOpenChange(false);
            }}
          >
            Apply selection
          </Button>
        </div>
      </div>
    </Modal>
  );
}
