import type { Metadata } from "next";
import { MethodologyContent } from "@/features/methodology/methodology-content";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How every derived number is produced — model data, cost efficiency, provider groups, trust tiers, harness comparison, political neutrality, snapshots and freshness.",
};

export default function MethodologyPage(): React.JSX.Element {
  return <MethodologyContent />;
}
