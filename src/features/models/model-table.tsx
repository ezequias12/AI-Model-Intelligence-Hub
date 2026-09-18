"use client";

import * as React from "react";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Columns3, Download, Pin, Plus, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/input";
import { MetaLine, ProviderDot } from "@/components/ui/primitives";
import { Popover } from "@/components/ui/overlay";
import { RelativeTime } from "@/components/ui/relative-time";
import { DEFAULT_TABLE_METRIC_KEYS, getMetric } from "@/lib/analytics/metric-registry";
import type { ModelContext } from "@/lib/analytics/metric-registry";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils/cn";
import { useModelsWorkspace } from "./workspace-context";
import { ModelDetailDrawer } from "./model-detail";

interface TableRow {
  context: ModelContext;
  id: string;
}

const STORAGE_KEY = "amih.models.table.v1";

export function ModelTable(): React.JSX.Element {
  const workspace = useModelsWorkspace();
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "intelligence", desc: true }]);
  const [visibleMetricKeys, setVisibleMetricKeys] = React.useState<string[]>([
    ...DEFAULT_TABLE_METRIC_KEYS,
  ]);
  const [selectedOnly, setSelectedOnly] = React.useState(false);
  const [pinnedIds, setPinnedIds] = React.useState<string[]>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [detailContext, setDetailContext] = React.useState<ModelContext | null>(null);

  // Restore table preferences once on mount.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        sorting?: SortingState;
        visibleMetricKeys?: string[];
        selectedOnly?: boolean;
        pinnedIds?: string[];
      };
      if (parsed.sorting) setSorting(parsed.sorting);
      if (parsed.visibleMetricKeys) setVisibleMetricKeys(parsed.visibleMetricKeys);
      if (typeof parsed.selectedOnly === "boolean") setSelectedOnly(parsed.selectedOnly);
      if (parsed.pinnedIds) setPinnedIds(parsed.pinnedIds);
    } catch {
      // Ignore malformed storage.
    }
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ sorting, visibleMetricKeys, selectedOnly, pinnedIds }),
      );
    } catch {
      // Storage unavailable; the table still works for this session.
    }
  }, [sorting, visibleMetricKeys, selectedOnly, pinnedIds]);

  const {
    contexts,
    providerFilter,
    customProviderIds,
    minimumCapability,
    selectedIds: selectedModelIds,
  } = workspace;

  const scoped = React.useMemo(() => {
    let list = contexts;

    if (providerFilter === "mainstream") {
      list = list.filter((context) => context.provider?.group === "mainstream_global");
    } else if (providerFilter === "china_based") {
      list = list.filter((context) => context.provider?.group === "china_based");
    } else if (providerFilter === "open_weight") {
      list = list.filter((context) => context.model.openWeight);
    } else if (providerFilter === "closed") {
      list = list.filter((context) => !context.model.openWeight);
    } else if (providerFilter === "custom" && customProviderIds.length > 0) {
      const allowed = new Set(customProviderIds);
      list = list.filter((context) => allowed.has(context.model.providerId));
    }

    if (minimumCapability > 0) {
      list = list.filter((context) => {
        const value = context.model.metrics.intelligence;
        return value === null || value >= minimumCapability;
      });
    }

    if (selectedOnly) {
      list = list.filter((context) => selectedModelIds.includes(context.model.id));
    }

    return list;
  }, [
    contexts,
    providerFilter,
    customProviderIds,
    minimumCapability,
    selectedModelIds,
    selectedOnly,
  ]);

  const rows: TableRow[] = React.useMemo(() => {
    const mapped = scoped.map((context) => ({ id: context.model.id, context }));
    // Pinned rows always sort first, in pin order.
    return mapped.sort((a, b) => {
      const aPinned = pinnedIds.indexOf(a.id);
      const bPinned = pinnedIds.indexOf(b.id);
      if (aPinned !== -1 && bPinned !== -1) return aPinned - bPinned;
      if (aPinned !== -1) return -1;
      if (bPinned !== -1) return 1;
      return 0;
    });
  }, [scoped, pinnedIds]);

  const columns = React.useMemo<ColumnDef<TableRow>[]>(() => {
    const metricColumns: ColumnDef<TableRow>[] = [];

    for (const key of visibleMetricKeys) {
      const metric = getMetric(key);
      if (!metric) continue;

      metricColumns.push({
        id: key,
        accessorFn: (row: TableRow) => metric.get(row.context),
        header: metric.label,
        cell: ({ row }) => (
          <span className="tabular">{metric.format(metric.get(row.original.context))}</span>
        ),
        sortingFn: (a, b) => {
          const av = metric.get(a.original.context);
          const bv = metric.get(b.original.context);
          if (av === null && bv === null) return 0;
          if (av === null) return 1;
          if (bv === null) return -1;
          return av - bv;
        },
      });
    }

    return [
      {
        id: "pin",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const pinned = pinnedIds.includes(row.original.id);
          return (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={
                pinned
                  ? `Unpin ${row.original.context.model.name}`
                  : `Pin ${row.original.context.model.name}`
              }
              title={pinned ? "Unpin row" : "Pin row"}
              onClick={() =>
                setPinnedIds((current) =>
                  current.includes(row.original.id)
                    ? current.filter((id) => id !== row.original.id)
                    : [...current, row.original.id],
                )
              }
            >
              <Pin className={cn("h-3 w-3", pinned && "text-primary")} />
            </Button>
          );
        },
      },
      {
        id: "select",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const selected = workspace.selectedIds.includes(row.original.id);
          return (
            <Checkbox
              checked={selected}
              aria-label={
                selected
                  ? `Remove ${row.original.context.model.name} from comparison`
                  : `Add ${row.original.context.model.name} to comparison`
              }
              onChange={() => workspace.toggleModel(row.original.id)}
            />
          );
        },
      },
      {
        id: "model",
        accessorFn: (row) => row.context.model.name,
        header: "Model",
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col">
            <Link
              href={`/models/${row.original.context.model.slug}`}
              className="truncate font-medium underline-offset-2 hover:underline"
            >
              {row.original.context.model.name}
            </Link>
            <span className="flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground">
              <span className="min-w-0 truncate">
                {row.original.context.model.deprecatedAt ? "Deprecated" : "Active"}
              </span>
              <span aria-hidden="true" className="meta-sep" />
              <span className="min-w-0 truncate">
                {row.original.context.model.openWeight ? "open-weight" : "closed"}
              </span>
            </span>
          </span>
        ),
      },
      {
        id: "provider",
        accessorFn: (row) => row.context.provider?.name ?? "Unknown",
        header: "Provider",
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5">
            <ProviderDot
              color={row.original.context.provider?.color ?? null}
              name={row.original.context.provider?.name ?? "Unknown"}
            />
            <span className="truncate">{row.original.context.provider?.name ?? "—"}</span>
          </span>
        ),
      },
      {
        id: "releaseDate",
        accessorFn: (row) => row.context.model.releaseDate ?? "",
        header: "Released",
        cell: ({ row }) => (
          <span className="tabular text-muted-foreground">
            {formatDate(row.original.context.model.releaseDate)}
          </span>
        ),
      },
      ...metricColumns,
      {
        id: "refreshed",
        accessorFn: (row) => row.context.model.lastRefreshedAt ?? "",
        header: "Refreshed",
        cell: ({ row }) => (
          <RelativeTime
            value={row.original.context.model.lastRefreshedAt}
            className="text-2xs text-muted-foreground"
          />
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => workspace.toggleModel(row.original.id)}
              aria-label="Toggle comparison membership"
              title="Add or remove from comparison set"
            >
              {workspace.selectedIds.includes(row.original.id) ? (
                <Check className="h-3 w-3" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setDetailContext(row.original.context)}
            >
              Detail
            </Button>
          </span>
        ),
      },
    ];
  }, [visibleMetricKeys, pinnedIds, workspace]);

  const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>({});

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const needle = String(filterValue).toLowerCase();
      const context = row.original.context;
      return `${context.model.name} ${context.model.slug} ${context.provider?.name ?? ""}`
        .toLowerCase()
        .includes(needle);
    },
  });

  const exportCsv = (): void => {
    const header = [
      "Model",
      "Provider",
      "Released",
      ...visibleMetricKeys.map((key) => getMetric(key)?.label ?? key),
      "Open weight",
      "Deprecated",
      "Last refreshed",
    ];

    const lines = table.getSortedRowModel().rows.map((row) => {
      const context = row.original.context;
      return [
        context.model.name,
        context.provider?.name ?? "",
        context.model.releaseDate ?? "",
        ...visibleMetricKeys.map((key) => {
          const metric = getMetric(key);
          const value = metric ? metric.get(context) : null;
          return value === null ? "" : String(value);
        }),
        context.model.openWeight ? "yes" : "no",
        context.model.deprecatedAt ? "yes" : "no",
        context.model.lastRefreshedAt ?? "",
      ];
    });

    const csv = [header, ...lines]
      .map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ai-model-intelligence-hub-models.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder="Filter by model or provider…"
          aria-label="Filter table"
          className="h-8 max-w-[280px] text-xs"
        />
        <Button
          variant={selectedOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedOnly((value) => !value)}
          aria-pressed={selectedOnly}
        >
          {selectedOnly ? "Showing selected only" : "Selected only"}
        </Button>

        <Popover
          label="Table columns"
          align="end"
          trigger={({ toggle }) => (
            <Button variant="outline" size="sm" onClick={toggle}>
              <Columns3 className="h-3.5 w-3.5" aria-hidden="true" />
              Columns
            </Button>
          )}
        >
          {() => (
            <div className="scroll-thin max-h-72 overflow-y-auto">
              {[
                ...DEFAULT_TABLE_METRIC_KEYS,
                "blendedPrice",
                "intelligencePerDollar",
                "codingPerDollar",
                "agenticPerDollar",
                "weightedValue",
              ]
                .filter((key, index, array) => array.indexOf(key) === index)
                .map((key) => {
                  const metric = getMetric(key);
                  if (!metric) return null;
                  const checked = visibleMetricKeys.includes(key);
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-xs transition-colors hover:bg-accent"
                    >
                      <Checkbox
                        checked={checked}
                        onChange={() =>
                          setVisibleMetricKeys((current) =>
                            checked ? current.filter((value) => value !== key) : [...current, key],
                          )
                        }
                      />
                      {metric.label}
                    </label>
                  );
                })}
            </div>
          )}
        </Popover>

        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Export CSV
        </Button>

        <MetaLine
          className="ml-auto text-2xs text-muted-foreground"
          items={[
            `${table.getFilteredRowModel().rows.length} of ${workspace.contexts.length} models`,
            pinnedIds.length > 0 ? `${pinnedIds.length} pinned` : null,
          ]}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="scroll-thin max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[1200px] border-collapse text-xs">
              <caption className="sr-only">
                Full model table. Sortable, filterable and exportable.
              </caption>
              <thead className="sticky top-0 z-10 bg-surface-sunken">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b border-border">
                    {headerGroup.headers.map((header) => {
                      const sortable = header.column.getCanSort();
                      const sorted = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          className="whitespace-nowrap px-2 py-2 text-left font-medium text-muted-foreground"
                          aria-sort={
                            sorted === "asc"
                              ? "ascending"
                              : sorted === "desc"
                                ? "descending"
                                : sortable
                                  ? "none"
                                  : undefined
                          }
                        >
                          {sortable ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1 hover:text-foreground"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {sorted === "asc" && (
                                <ArrowUp className="h-3 w-3" aria-hidden="true" />
                              )}
                              {sorted === "desc" && (
                                <ArrowDown className="h-3 w-3" aria-hidden="true" />
                              )}
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => {
                  const pinned = pinnedIds.includes(row.original.id);
                  const selected = workspace.selectedIds.includes(row.original.id);
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-border/50 transition-colors hover:bg-accent",
                        selected && "bg-accent/50",
                        pinned && "bg-primary-muted",
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="whitespace-nowrap px-2 py-1.5">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {table.getRowModel().rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      No models match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {pinnedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
          <Badge variant="muted">{pinnedIds.length} pinned rows</Badge>
          <Button variant="ghost" size="xs" onClick={() => setPinnedIds([])}>
            Clear pins
          </Button>
        </div>
      )}

      <ModelDetailDrawer
        context={detailContext}
        onOpenChange={(open) => {
          if (!open) setDetailContext(null);
        }}
      />
    </div>
  );
}
