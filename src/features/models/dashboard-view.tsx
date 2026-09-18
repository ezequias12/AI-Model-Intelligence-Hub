"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Section } from "@/components/ui/card";
import { FreshnessBadge, RelativeTime } from "@/components/ui/relative-time";
import { cn } from "@/lib/utils/cn";
import { MetricLeaders } from "./metric-leaders";
import { RankingBoards } from "./ranking-boards";
import { RANKING_BOARDS } from "@/lib/analytics";
import { useModelsWorkspace } from "./workspace-context";

export function DashboardView(): React.JSX.Element {
  const workspace = useModelsWorkspace();

  const boardSubset = React.useMemo(
    () =>
      RANKING_BOARDS.filter(
        (board) => board.id === "intelligence" || board.id === "value_weighted",
      ),
    [],
  );

  const providerSummary = React.useMemo(() => {
    const groups = new Map<string, number>();
    for (const model of workspace.models) {
      const provider = workspace.providers.find((entry) => entry.id === model.providerId);
      const key = provider?.group ?? "other";
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
    return groups;
  }, [workspace.models, workspace.providers]);

  return (
    <>
      <Section
        title="Metric leaders"
        description="One card per question the workspace answers immediately. Deltas appear only where a previous snapshot exists."
        actions={
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-2xs font-medium text-muted-foreground">Model data</span>
              <FreshnessBadge
                value={workspace.models[0]?.lastRefreshedAt ?? null}
                thresholds={{ freshMinutes: 60, agingMinutes: 360 }}
              />
            </span>
            <Link
              href="/models/rankings"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              All rankings
            </Link>
          </>
        }
      >
        <MetricLeaders />
      </Section>

      <Section
        title="Top value"
        description="Cost efficiency is shown next to raw capability, and a minimum-capability threshold can exclude cheap-but-weak models."
        actions={
          <Link href="/models/rankings" className="text-xs underline underline-offset-2">
            Open rankings
          </Link>
        }
      >
        <RankingBoards boards={boardSubset} />
      </Section>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Provider segmentation</CardTitle>
            <p className="text-2xs text-muted-foreground">
              Geographic and structural grouping only — never a quality ranking.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {(
              [
                ["mainstream_global", "Mainstream / global"],
                ["china_based", "China-based"],
                ["other", "Other"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span>{label}</span>
                <span className="tabular font-medium">{providerSummary.get(key) ?? 0} models</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Catalogue</CardTitle>
            <p className="text-2xs text-muted-foreground">
              Current model coverage in this dataset.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            <Row label="Models tracked" value={String(workspace.models.length)} />
            <Row
              label="Open-weight"
              value={String(workspace.models.filter((model) => model.openWeight).length)}
            />
            <Row
              label="Deprecated"
              value={String(workspace.models.filter((model) => model.deprecatedAt).length)}
            />
            <Row label="Providers" value={String(workspace.providers.length)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comparison set</CardTitle>
            <p className="text-2xs text-muted-foreground">
              Selection persists in the URL, so any view is shareable.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            {workspace.selectedIds.length === 0 ? (
              <p className="text-muted-foreground">No models selected.</p>
            ) : (
              workspace.selectedIds.map((id) => {
                const model = workspace.models.find((entry) => entry.id === id);
                if (!model) return null;
                return (
                  <div key={id} className="flex items-center justify-between gap-2">
                    <Link
                      href={`/models/${model.slug}`}
                      className="truncate underline-offset-2 hover:underline"
                    >
                      {model.shortName}
                    </Link>
                    <span className="tabular text-2xs text-muted-foreground">
                      intel {model.metrics.intelligence ?? "—"}
                    </span>
                  </div>
                );
              })
            )}
            <p className="mt-1 text-2xs text-muted-foreground">
              Last updated <RelativeTime value={workspace.models[0]?.lastRefreshedAt ?? null} />
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-medium">{value}</span>
    </div>
  );
}
