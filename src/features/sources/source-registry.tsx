"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Filter,
  Key,
  RefreshCw,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Divider,
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { FreshnessBadge, RelativeTime } from "@/components/ui/relative-time";
import { thresholdsForDomain } from "@/lib/domain/freshness";
import type { IngestionRun, IngestionRunStatus, SourceDefinition } from "@/lib/domain/schema";
import type { DataSourceMeta } from "@/lib/data";
import { DASH, formatEnumLabel } from "@/lib/format";
import { cn } from "@/lib/utils/cn";

const RUN_STATUS_VARIANT: Record<IngestionRunStatus, NonNullable<BadgeProps["variant"]>> = {
  running: "info",
  success: "success",
  partial: "warning",
  failed: "destructive",
  skipped: "muted",
  rate_limited: "warning",
};

const RUN_STATUS_LABEL: Record<IngestionRunStatus, string> = {
  running: "Running",
  success: "Success",
  partial: "Partial",
  failed: "Failed",
  skipped: "Skipped",
  rate_limited: "Rate limited",
};

interface SourceRow {
  source: SourceDefinition;
  runs: IngestionRun[];
  latestRun: IngestionRun | null;
  lastSuccess: IngestionRun | null;
  lastError: IngestionRun | null;
  rateRun: IngestionRun | null;
}

function formatCadence(minutes: number | null): string {
  if (minutes === null) return "Manual";
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function buildRows(sources: SourceDefinition[], runs: IngestionRun[]): SourceRow[] {
  return sources.map((source) => {
    const sourceRuns = runs
      .filter((run) => run.sourceId === source.id)
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));

    const latestRun = sourceRuns[0] ?? null;
    const lastSuccess = sourceRuns.find((run) => run.status === "success") ?? null;
    const lastError = sourceRuns.find((run) => run.error !== null) ?? null;
    const rateRun =
      sourceRuns.find((run) => run.rateLimitRemaining !== null || run.status === "rate_limited") ??
      null;

    return { source, runs: sourceRuns, latestRun, lastSuccess, lastError, rateRun };
  });
}

export function SourceRegistry({
  sources,
  runs,
  meta,
}: {
  sources: SourceDefinition[];
  runs: IngestionRun[];
  meta: DataSourceMeta;
}): React.JSX.Element {
  const [domain, setDomain] = React.useState<string>("all");
  const [status, setStatus] = React.useState<string>("all");
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const rows = React.useMemo(() => buildRows(sources, runs), [sources, runs]);

  const domains = React.useMemo(
    () => [...new Set(sources.map((source) => source.domain))].sort(),
    [sources],
  );

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (domain !== "all" && row.source.domain !== domain) return false;
      if (status === "enabled" && !row.source.enabled) return false;
      if (status === "disabled" && row.source.enabled) return false;
      if (status === "errors" && !row.lastError) return false;
      if (status === "rate_limited" && row.rateRun?.status !== "rate_limited") return false;
      if (!needle) return true;
      return `${row.source.name} ${row.source.id} ${row.source.type}`
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, domain, status, query]);

  const toggle = (id: string): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <CapabilityPanel meta={meta} />
      <ManualSyncPanel />

      <div className="flex flex-wrap items-center gap-2 rounded-panel border border-border bg-surface px-3 py-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter sources…"
          aria-label="Filter sources by name or id"
          className="h-8 max-w-[240px] text-xs"
        />
        <Select
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
          aria-label="Filter sources by domain"
          className="h-8 w-[170px]"
        >
          <option value="all">All domains</option>
          {domains.map((value) => (
            <option key={value} value={value}>
              {formatEnumLabel(value)}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter sources by status"
          className="h-8 w-[180px]"
        >
          <option value="all">All statuses</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
          <option value="errors">With errors</option>
          <option value="rate_limited">Rate limited</option>
        </Select>
        <span className="tabular ml-auto text-2xs text-muted-foreground">
          {filtered.length} of {sources.length} sources
        </span>
      </div>

      <Panel className="overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-xs">
            <caption className="sr-only">
              Source registry with adapter status, freshness, rate-limit state and errors.
            </caption>
            <thead className="bg-surface">
              <tr className="border-b border-border">
                {[
                  "Source",
                  "Domain / type",
                  "Enabled",
                  "Cadence",
                  "Last successful sync",
                  "Freshness",
                  "Adapter status",
                  "Rate limit",
                  "Most recent error",
                ].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="whitespace-nowrap px-2 py-2 text-left font-medium text-muted-foreground"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const isOpen = expanded.has(row.source.id);
                const detailId = `source-detail-${row.source.id}`;
                const thresholds = thresholdsForDomain(row.source.domain);
                return (
                  <React.Fragment key={row.source.id}>
                    <tr className="border-b border-border/50 align-top transition-[background-color] duration-150 ease-out hover:bg-accent/40">
                      <td className="px-2 py-1.5">
                        <div className="flex items-start gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggle(row.source.id)}
                            aria-expanded={isOpen}
                            aria-controls={detailId}
                            aria-label={
                              isOpen
                                ? `Hide details for ${row.source.name}`
                                : `Show details for ${row.source.name}`
                            }
                            className="mt-0.5 rounded-control text-muted-foreground transition-[color] duration-150 ease-out hover:text-foreground"
                          >
                            {isOpen ? (
                              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                          </button>
                          <span className="flex min-w-0 flex-col">
                            <span className="font-medium">{row.source.name}</span>
                            <span className="truncate text-2xs text-muted-foreground">
                              {row.source.id}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          {formatEnumLabel(row.source.domain)}
                          <span aria-hidden="true" className="meta-sep" />
                          {formatEnumLabel(row.source.type)}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <Badge variant={row.source.enabled ? "success" : "muted"}>
                          {row.source.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </td>
                      <td className="tabular whitespace-nowrap px-2 py-1.5 text-muted-foreground">
                        {formatCadence(row.source.cadenceMinutes)}
                      </td>
                      <td className="tabular whitespace-nowrap px-2 py-1.5">
                        <RelativeTime value={row.lastSuccess?.finishedAt ?? null} />
                      </td>
                      <td className="tabular px-2 py-1.5">
                        <FreshnessBadge
                          value={row.lastSuccess?.finishedAt ?? row.lastSuccess?.startedAt ?? null}
                          thresholds={thresholds}
                          title={`Thresholds: fresh ≤ ${thresholds.freshMinutes}m, aging ≤ ${thresholds.agingMinutes}m`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        {row.latestRun ? (
                          <Badge variant={RUN_STATUS_VARIANT[row.latestRun.status]}>
                            {RUN_STATUS_LABEL[row.latestRun.status]}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Never run</span>
                        )}
                      </td>
                      <td className="tabular whitespace-nowrap px-2 py-1.5 text-muted-foreground">
                        {renderRateLimit(row.rateRun)}
                      </td>
                      <td className="max-w-[280px] px-2 py-1.5">
                        {row.lastError?.error ? (
                          <span className="text-destructive" title={row.lastError.error}>
                            {row.lastError.error}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{DASH}</span>
                        )}
                      </td>
                    </tr>

                    {isOpen && (
                      <tr id={detailId} className="border-b border-border/50 bg-surface/60">
                        <td colSpan={9} className="px-3 py-3">
                          <div className="flex flex-col gap-3">
                            <dl className="grid grid-cols-1 gap-2 text-2xs sm:grid-cols-2">
                              <div>
                                <dt className="font-medium text-foreground">Attribution</dt>
                                <dd className="text-muted-foreground">
                                  {row.source.attribution ?? DASH}
                                </dd>
                              </div>
                              <div>
                                <dt className="font-medium text-foreground">Licensing note</dt>
                                <dd className="text-muted-foreground">
                                  {row.source.licensingNote ?? DASH}
                                </dd>
                              </div>
                              <div className="sm:col-span-2">
                                <dt className="font-medium text-foreground">Operational notes</dt>
                                <dd className="text-muted-foreground">
                                  {row.source.notes ?? DASH}
                                </dd>
                              </div>
                              <div className="sm:col-span-2">
                                <dt className="font-medium text-foreground">Source URL</dt>
                                <dd>
                                  <a
                                    href={row.source.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary underline-offset-2 hover:underline"
                                  >
                                    {row.source.url}
                                    <span className="sr-only"> (opens in a new tab)</span>
                                  </a>
                                </dd>
                              </div>
                            </dl>

                            <Divider />

                            <div className="flex flex-col gap-1">
                              <p className="text-2xs font-medium text-foreground">
                                Ingestion run history
                              </p>
                              {row.runs.length === 0 ? (
                                <p className="text-2xs text-muted-foreground">
                                  No runs recorded for this source.
                                </p>
                              ) : (
                                <div className="scroll-thin max-h-56 overflow-y-auto">
                                  <table className="w-full border-collapse text-2xs">
                                    <thead>
                                      <tr className="border-b border-border text-left text-muted-foreground">
                                        <th scope="col" className="px-2 py-1 font-medium">
                                          Started
                                        </th>
                                        <th scope="col" className="px-2 py-1 font-medium">
                                          Status
                                        </th>
                                        <th scope="col" className="px-2 py-1 font-medium">
                                          Seen / written
                                        </th>
                                        <th scope="col" className="px-2 py-1 font-medium">
                                          Rate limit
                                        </th>
                                        <th scope="col" className="px-2 py-1 font-medium">
                                          Error
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {row.runs.slice(0, 10).map((run) => (
                                        <tr key={run.id} className="border-b border-border/40">
                                          <td className="tabular whitespace-nowrap px-2 py-1">
                                            <RelativeTime value={run.startedAt} />
                                          </td>
                                          <td className="px-2 py-1">
                                            <Badge variant={RUN_STATUS_VARIANT[run.status]}>
                                              {RUN_STATUS_LABEL[run.status]}
                                            </Badge>
                                          </td>
                                          <td className="tabular px-2 py-1 text-muted-foreground">
                                            {run.itemsSeen} / {run.itemsWritten}
                                          </td>
                                          <td className="tabular px-2 py-1 text-muted-foreground">
                                            {renderRateLimit(run)}
                                          </td>
                                          <td className="max-w-[260px] px-2 py-1 text-muted-foreground">
                                            {run.error ?? DASH}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    No sources match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function renderRateLimit(run: IngestionRun | null): React.ReactNode {
  if (!run) return <span className="text-muted-foreground">{DASH}</span>;
  if (run.status === "rate_limited") {
    return (
      <span className="text-warning" title={run.rateLimitResetAt ?? undefined}>
        Exhausted
      </span>
    );
  }
  if (run.rateLimitRemaining !== null) {
    return (
      <span className="text-muted-foreground" title={run.rateLimitResetAt ?? undefined}>
        {run.rateLimitRemaining} remaining
      </span>
    );
  }
  return <span className="text-muted-foreground">{DASH}</span>;
}

function CapabilityPanel({ meta }: { meta: DataSourceMeta }): React.JSX.Element {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle as="h2">Integration capability</PanelTitle>
        <PanelDescription>
          Exactly which credentials and integrations are configured for this deployment, and whether
          live mode degraded to fixtures.
        </PanelDescription>
      </PanelHeader>
      <PanelBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={meta.mode === "live" ? "success" : "muted"}>
            {meta.mode === "live" ? "Live mode" : "Mock mode"}
          </Badge>
          {meta.degraded && <Badge variant="warning">Degraded</Badge>}
          <span className="text-muted-foreground">{meta.label}</span>
          {meta.datasetCapturedAt && (
            <span className="text-2xs text-muted-foreground">
              Dataset captured <RelativeTime value={meta.datasetCapturedAt} />
            </span>
          )}
        </div>

        {meta.degraded && meta.degradedReason && (
          <p className="rounded-control bg-warning-muted px-2.5 py-1.5 text-2xs text-warning">
            {meta.degradedReason}
          </p>
        )}

        <p className="text-xs text-muted-foreground">{meta.description}</p>

        <ul className="flex flex-col">
          {meta.capabilities.map((capability, index) => (
            <li
              key={capability.key}
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 py-1.5 text-xs",
                index > 0 && "border-t border-border",
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    capability.configured ? "bg-success" : "bg-muted-foreground",
                  )}
                />
                <span className="font-medium">{capability.label}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-2xs text-muted-foreground">{capability.note}</span>
                <Badge variant={capability.configured ? "success" : "outline"}>
                  {capability.configured ? "Configured" : "Not configured"}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      </PanelBody>
    </Panel>
  );
}

function ManualSyncPanel(): React.JSX.Element {
  const router = useRouter();
  const [job, setJob] = React.useState<string>("all");
  const [adminKey, setAdminKey] = React.useState<string>("");
  const [showKeyInput, setShowKeyInput] = React.useState<boolean>(false);
  const [isRunning, setIsRunning] = React.useState<boolean>(false);
  const [statusResult, setStatusResult] = React.useState<{ ok: boolean; text: string } | null>(
    null,
  );

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("amih_admin_key");
      if (saved) setAdminKey(saved);
    } catch {
      // ignore
    }
  }, []);

  const handleKeyChange = (val: string): void => {
    setAdminKey(val);
    try {
      if (val) {
        localStorage.setItem("amih_admin_key", val);
      } else {
        localStorage.removeItem("amih_admin_key");
      }
    } catch {
      // ignore
    }
  };

  const handleSync = async (): Promise<void> => {
    setIsRunning(true);
    setStatusResult(null);
    try {
      const res = await fetch("/api/jobs/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job,
          adminKey: adminKey.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusResult({ ok: false, text: data.error ?? "Sync failed." });
      } else {
        if (job === "all" && Array.isArray(data.results)) {
          const successes = data.results.filter((r: { ok: boolean }) => r.ok).length;
          setStatusResult({
            ok: data.ok,
            text: `Sync completed: ${successes} of ${data.results.length} jobs succeeded.`,
          });
        } else {
          const written = data.result?.totals?.written ?? 0;
          const seen = data.result?.totals?.seen ?? 0;
          setStatusResult({
            ok: data.ok,
            text: `Job "${job}" finished. Items seen: ${seen}, written: ${written}.`,
          });
        }
        router.refresh();
      }
    } catch (err) {
      setStatusResult({
        ok: false,
        text: err instanceof Error ? err.message : "Error connecting to sync endpoint.",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Panel>
      <PanelHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <PanelTitle as="h2">Manual Ingestion</PanelTitle>
            <PanelDescription>
              Trigger live source ingestion on demand without waiting for QStash or scheduled cron.
            </PanelDescription>
          </div>
          <button
            type="button"
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="inline-flex items-center gap-1 text-2xs text-muted-foreground transition-[color] duration-150 ease-out hover:text-foreground"
            title="Configure Admin / CRON_SECRET token"
          >
            <Key className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{adminKey ? "Token configured" : "Admin Token"}</span>
          </button>
        </div>
      </PanelHeader>
      <PanelBody className="flex flex-col gap-3">
        {showKeyInput && (
          <div className="flex flex-wrap items-center gap-2 rounded-control bg-surface-sunken p-2.5 text-xs">
            <span className="text-2xs text-muted-foreground">Admin Secret (CRON_SECRET):</span>
            <Input
              type="password"
              placeholder="Leave empty if CRON_SECRET is not set"
              value={adminKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              className="h-8 max-w-xs text-xs"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={job}
            onChange={(e) => setJob(e.target.value)}
            disabled={isRunning}
            aria-label="Select job to run"
            className="h-8 w-[260px] text-xs"
          >
            <option value="all">All sources (Core pipeline)</option>
            <option value="sync-models">Models (Artificial Analysis, OpenRouter, HF)</option>
            <option value="sync-ai-news">AI News (GDELT)</option>
            <option value="sync-social">Social Pulse (Bluesky, Hacker News)</option>
            <option value="sync-harness-pricing">Harness Pricing</option>
          </Select>

          <Button
            size="sm"
            onClick={handleSync}
            disabled={isRunning}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRunning && "animate-spin")} />
            <span>{isRunning ? "Sincronizando..." : "Sincronizar ahora"}</span>
          </Button>
        </div>

        {statusResult && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-control px-3 py-2 text-xs",
              statusResult.ok
                ? "bg-success-muted text-success"
                : "bg-destructive-muted text-destructive",
            )}
          >
            {statusResult.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>{statusResult.text}</span>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
