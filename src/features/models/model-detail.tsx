"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Sheet } from "@/components/ui/overlay";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { ModelContext } from "@/lib/analytics/metric-registry";
import { useModelsWorkspace } from "./workspace-context";
import {
  ModelIdentitySection,
  ModelLineageSection,
  ModelMetricsSection,
  ModelPricingSection,
  RelatedModels,
} from "./model-detail-sections";
import { ModelHistoryChart } from "./model-history-chart";

export function ModelDetailDrawer({
  context,
  onOpenChange,
}: {
  context: ModelContext | null;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const workspace = useModelsWorkspace();
  const open = context !== null;

  const snapshots = context ? (workspace.snapshotsByModelId[context.model.id] ?? []) : [];
  const selected = context ? workspace.selectedIds.includes(context.model.id) : false;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={context?.model.name}
      description={context?.provider?.name ?? "Unknown provider"}
      className="max-w-[540px]"
    >
      {context && (
        <div className="flex flex-col gap-5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={selected ? "primary" : "muted"}>
              {selected ? "In comparison set" : "Not in comparison set"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => workspace.toggleModel(context.model.id)}
            >
              {selected ? "Remove from comparison" : "Add to comparison"}
            </Button>
            <Link
              href={`/models/${context.model.slug}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Full page
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>

          <ModelIdentitySection model={context.model} provider={context.provider} />
          <ModelMetricsSection model={context.model} previous={context.previous} />
          <ModelPricingSection model={context.model} />
          <ModelHistoryChart snapshots={snapshots} modelName={context.model.name} />
          <ModelLineageSection model={context.model} snapshots={snapshots} />
          <RelatedModels contexts={workspace.contexts} model={context.model} />
        </div>
      )}
    </Sheet>
  );
}
