"use client";

import * as React from "react";
import { Section } from "@/components/ui/card";
import { ModelFilterBar } from "./filter-bar";
import { RankingBoards } from "./ranking-boards";
import { LandscapeCharts } from "./landscape-charts";
import { ArtificialAnalysisCharts } from "./aa-charts";
import { ModelTable } from "./model-table";
import { useModelsWorkspace } from "./workspace-context";

export function RankingsView(): React.JSX.Element {
  return (
    <>
      <Section
        title="Rankings"
        description="Every Top 10 board. Boards respect the scope, provider grouping and minimum-capability controls below."
      >
        <ModelFilterBar />
        <RankingBoards />
      </Section>
    </>
  );
}

export function LandscapeView(): React.JSX.Element {
  return (
    <>
      <Section
        title="Landscape"
        description="The Artificial Analysis set first — a bar per model and the capability-against-cost frontier — then the freely configurable charts. Every card reads the same scope, provider grouping and capability threshold."
      >
        <ModelFilterBar showScope={false} />
      </Section>
      <ArtificialAnalysisCharts />
      <Section
        title="Configurable charts"
        description="Large configurable charts. Each card has independent axis, bubble, frontier and label controls."
      >
        <LandscapeCharts />
      </Section>
    </>
  );
}

export function TableView(): React.JSX.Element {
  return (
    <>
      <Section
        title="Full model table"
        description="Dense, sortable and filterable. Column choice and sorting persist locally; CSV export is available."
      >
        <ModelFilterBar />
        <ModelTable />
      </Section>
    </>
  );
}

/** Small helper used by the dashboard's comparison summary. */
export function useSelectionCount(): number {
  return useModelsWorkspace().selectedIds.length;
}
