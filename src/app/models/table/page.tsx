import type { Metadata } from "next";
import { ModelsShellServer } from "@/features/models/models-shell-server";
import { TableView } from "@/features/models/views";

export const metadata: Metadata = {
  title: "Models · Table",
  description: "Dense research table with sorting, column selection, pinning and CSV export.",
};

export default async function TablePage(): Promise<React.JSX.Element> {
  return (
    <ModelsShellServer>
      <TableView />
    </ModelsShellServer>
  );
}
