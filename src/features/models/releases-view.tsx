"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, Section } from "@/components/ui/card";
import { ProviderDot, Segmented } from "@/components/ui/primitives";
import { RelativeTime } from "@/components/ui/relative-time";
import { computeReleases } from "@/lib/analytics";
import type { ChangeEvent } from "@/lib/domain/schema";
import { useModelsWorkspace } from "./workspace-context";

type KindFilter = "all" | "release" | "deprecation" | "change";

export function ReleasesView({ changeEvents }: { changeEvents: ChangeEvent[] }): React.JSX.Element {
  const workspace = useModelsWorkspace();
  const [kind, setKind] = React.useState<KindFilter>("all");
  const [providerId, setProviderId] = React.useState<string>("all");

  const rows = React.useMemo(
    () => computeReleases(workspace.contexts, changeEvents),
    [workspace.contexts, changeEvents],
  );

  const filtered = rows.filter((row) => {
    if (kind !== "all" && row.kind !== kind) return false;
    if (providerId !== "all" && row.modelId !== providerId) {
      const context = workspace.contexts.find((entry) => entry.model.id === row.modelId);
      if (context?.model.providerId !== providerId) return false;
    }
    return true;
  });

  const grouped = React.useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const row of filtered) {
      const key = row.date.slice(0, 7);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  return (
    <Section
      title="Releases & changes"
      description="Chronological view of model releases, deprecations and observed metric or price changes."
      actions={
        <>
          <Segmented
            ariaLabel="Filter by event kind"
            size="sm"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "All" },
              { value: "release", label: "Releases" },
              { value: "deprecation", label: "Deprecations" },
              { value: "change", label: "Changes" },
            ]}
          />
          <select
            aria-label="Filter by provider"
            className="h-8 rounded-control border border-input bg-background px-2.5 text-xs"
            value={providerId}
            onChange={(event) => setProviderId(event.target.value)}
          >
            <option value="all">All providers</option>
            {workspace.providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </>
      }
    >
      {grouped.length === 0 ? (
        <p className="text-xs text-muted-foreground">No events match the current filters.</p>
      ) : (
        grouped.map(([month, monthRows]) => (
          <Card key={month}>
            <CardHeader>
              <CardTitle>
                {new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                })}
              </CardTitle>
              <p className="text-2xs text-muted-foreground">
                {monthRows.length} event{monthRows.length === 1 ? "" : "s"}
              </p>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border/60 p-0">
              {monthRows.map((row) => (
                <div key={row.id} className="flex flex-wrap items-start gap-2 px-4 py-2.5 text-xs">
                  <ProviderDot color={row.providerColor} name={row.providerName} />
                  <Link
                    href={`/models/${row.modelSlug}`}
                    className="min-w-0 font-medium underline-offset-2 hover:underline"
                  >
                    {row.modelName}
                  </Link>
                  <Badge
                    variant={
                      row.kind === "deprecation"
                        ? "destructive"
                        : row.kind === "release"
                          ? "primary"
                          : "muted"
                    }
                  >
                    {row.kind}
                  </Badge>
                  {row.significance === "high" && <Badge variant="warning">High impact</Badge>}
                  <span className="min-w-0 flex-1 text-muted-foreground">{row.detail}</span>
                  <RelativeTime
                    value={row.date}
                    className="tabular shrink-0 text-2xs text-muted-foreground"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </Section>
  );
}
