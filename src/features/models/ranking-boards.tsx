"use client";

import * as React from "react";
import Link from "next/link";
import { Info, Plus, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeltaBadge, MetaLine, ProviderDot, Segmented } from "@/components/ui/primitives";
import { Popover } from "@/components/ui/overlay";
import { computeRankings, type RankingBoardDefinition } from "@/lib/analytics";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils/cn";
import { useModelsWorkspace } from "./workspace-context";

export function RankingBoards({
  boards,
}: {
  boards?: RankingBoardDefinition[];
}): React.JSX.Element {
  const workspace = useModelsWorkspace();

  const results = React.useMemo(
    () =>
      computeRankings(workspace.contexts, {
        scope: workspace.scope,
        providerScope: {
          filter: workspace.providerFilter,
          providerIds: workspace.customProviderIds,
        },
        selectedIds: workspace.selectedIds,
        minimumCapability: workspace.minimumCapability,
        limit: 10,
      }),
    [
      workspace.contexts,
      workspace.scope,
      workspace.providerFilter,
      workspace.customProviderIds,
      workspace.selectedIds,
      workspace.minimumCapability,
    ],
  );

  const filtered = boards
    ? results.filter((result) => boards.some((board) => board.id === result.definition.id))
    : results;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((result) => (
        <RankingBoardCard key={result.definition.id} result={result} />
      ))}
    </div>
  );
}

function RankingBoardCard({
  result,
}: {
  result: ReturnType<typeof computeRankings>[number];
}): React.JSX.Element {
  const workspace = useModelsWorkspace();
  const { definition } = result;

  return (
    <Card
      className={cn(definition.emphasisesCostEfficiency && "border-primary/30", "flex flex-col")}
    >
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <CardTitle className="truncate">{definition.title}</CardTitle>
          <p className="text-2xs text-muted-foreground">{definition.description}</p>
        </div>
        <Popover
          label={`${definition.title} methodology`}
          align="end"
          trigger={({ toggle }) => (
            <Button variant="ghost" size="icon-xs" onClick={toggle} aria-label="Methodology">
              <Info className="h-3.5 w-3.5" />
            </Button>
          )}
        >
          {() => (
            <div className="w-72 p-2 text-2xs leading-relaxed text-muted-foreground">
              <p className="mb-1.5 font-medium text-foreground">{definition.title}</p>
              <p>{result.methodology}</p>
              <MetaLine
                className="mt-2"
                items={[
                  `Population: ${result.populationSize} models`,
                  result.excludedBelowThreshold > 0
                    ? `${result.excludedBelowThreshold} excluded below the capability threshold`
                    : null,
                  result.excludedNoData > 0 ? `${result.excludedNoData} without this metric` : null,
                ]}
              />
              <p className="mt-2">
                Direction:{" "}
                {definition.emphasisesCostEfficiency ? "higher is better" : "see metric definition"}
              </p>
            </div>
          )}
        </Popover>
      </CardHeader>

      <CardContent className="flex-1 px-2 py-2">
        {result.rows.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            No models with this metric in the current scope.
          </p>
        ) : (
          <ol className="flex flex-col">
            {result.rows.map((row) => (
              <li
                key={row.context.model.id}
                className={cn(
                  "flex items-center gap-2 rounded-control px-2 py-1.5 text-xs transition-colors hover:bg-accent/50",
                  row.selected && "bg-accent/40",
                )}
              >
                <span className="tabular w-5 shrink-0 text-right text-2xs text-muted-foreground">
                  {row.rank}
                </span>
                <ProviderDot
                  color={row.context.provider?.color ?? null}
                  name={row.context.provider?.name ?? "Unknown"}
                />
                <Link
                  href={`/models/${row.context.model.slug}`}
                  className="min-w-0 flex-1 truncate font-medium underline-offset-2 hover:underline"
                  title={`${row.context.model.name} — ${row.context.provider?.name ?? "unknown provider"}`}
                >
                  {row.context.model.shortName}
                </Link>
                <span className="tabular shrink-0 text-2xs font-medium">{row.display}</span>
                {row.delta !== null && (
                  <DeltaBadge
                    value={row.delta}
                    betterDirection="higher"
                    format={(value) => formatPercent(value, 0)}
                  />
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => workspace.toggleModel(row.context.model.id)}
                  aria-label={
                    row.selected
                      ? `Remove ${row.context.model.name} from comparison`
                      : `Add ${row.context.model.name} to comparison`
                  }
                  title={row.selected ? "In comparison set" : "Add to comparison set"}
                >
                  {row.selected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                </Button>
              </li>
            ))}
          </ol>
        )}
      </CardContent>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-3 py-2">
        <Segmented
          ariaLabel={`${definition.title} scope`}
          size="sm"
          value={workspace.scope}
          options={[
            { value: "all", label: "All" },
            { value: "selected", label: "Selected" },
          ]}
          onChange={(value) => workspace.setScope(value)}
        />
        {workspace.minimumCapability > 0 && (
          <Badge variant="info" title="Minimum intelligence threshold applied">
            ≥{workspace.minimumCapability}
          </Badge>
        )}
        <span className="tabular ml-auto text-2xs text-muted-foreground">
          {result.populationSize} in scope
        </span>
      </div>
    </Card>
  );
}
