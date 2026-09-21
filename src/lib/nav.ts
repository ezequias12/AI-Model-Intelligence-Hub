/**
 * Navigation model.
 *
 * The primary rail follows the product domains rather than generic admin
 * navigation, per the information architecture.
 */
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  BarChart3,
  Compass,
  Database,
  GitCompareArrows,
  Globe2,
  LayoutDashboard,
  Newspaper,
  Star,
  Terminal,
  Table2,
  TrendingUp,
  Layers,
  History,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  /** Compact label used when horizontal space is constrained. */
  shortLabel?: string;
  icon: LucideIcon;
  description: string;
  /** Match nested routes as well as the exact path. */
  matchPrefix?: boolean;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "core",
    label: "Core",
    items: [
      {
        href: "/",
        label: "Overview",
        icon: Compass,
        description: "Cross-domain command center: market pulse, changes and freshness.",
      },
      {
        href: "/models",
        label: "Models",
        shortLabel: "Models",
        icon: LayoutDashboard,
        description: "Metric leaders, rankings, landscape charts and the full model table.",
        matchPrefix: true,
      },
      {
        href: "/compare",
        label: "Compare",
        icon: GitCompareArrows,
        description: "Full-width side-by-side comparison for models or harness plans.",
      },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      {
        href: "/news",
        label: "News",
        icon: Newspaper,
        description: "AI ecosystem news, provider feeds, social pulse and research.",
        matchPrefix: true,
      },
      {
        href: "/harness",
        label: "Harness Watch",
        shortLabel: "Harness",
        icon: Terminal,
        description: "Coding-agent subscriptions, plans, prices and change history.",
        matchPrefix: true,
      },
      {
        href: "/world",
        label: "World & Politics",
        shortLabel: "World",
        icon: Globe2,
        description: "Neutral, attributed world and political news. Separate editorial domain.",
      },
    ],
  },
  {
    id: "personal",
    label: "Personal",
    items: [
      {
        href: "/watchlists",
        label: "Watchlists",
        icon: Star,
        description: "Saved model groups, providers, harness products, topics and queries.",
      },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      {
        href: "/sources",
        label: "Sources",
        icon: Database,
        description: "Source registry, adapter status, freshness, rate limits and errors.",
      },
      {
        href: "/methodology",
        label: "Methodology",
        icon: BookOpen,
        description: "How every derived number is produced, and what it does not claim.",
      },
    ],
  },
];

export interface SubNavItem {
  href: string;
  label: string;
  description?: string;
}

export interface WorkspaceDefinition {
  id: string;
  title: string;
  /** Short label used in the compact rail and mobile tabs. */
  compactTitle: string;
  description: string;
  basePath: string;
  subNav: SubNavItem[];
}

export const WORKSPACES: WorkspaceDefinition[] = [
  {
    id: "models",
    title: "Models",
    compactTitle: "Models",
    description:
      "Model intelligence: metrics, rankings, cost efficiency, provider segmentation and history.",
    basePath: "/models",
    subNav: [
      {
        href: "/models",
        label: "Dashboard",
        description: "Metric leaders and a fast read on the market.",
      },
      {
        href: "/models/rankings",
        label: "Rankings",
        description: "All Top 10 boards in one grid.",
      },
      {
        href: "/models/landscape",
        label: "Landscape",
        description: "Large configurable scatter charts.",
      },
      {
        href: "/models/table",
        label: "Table",
        description: "Dense, sortable, filterable research table.",
      },
      {
        href: "/models/releases",
        label: "Releases",
        description: "Chronological releases and change events.",
      },
    ],
  },
  {
    id: "news",
    title: "News",
    compactTitle: "News",
    description: "AI ecosystem news, provider feeds, social pulse and research signal.",
    basePath: "/news",
    subNav: [
      { href: "/news", label: "Overview", description: "High-signal cross-category summary." },
      {
        href: "/news/ai",
        label: "AI General",
        description: "Launches, research, funding, infrastructure, regulation.",
      },
      { href: "/news/providers", label: "Providers", description: "Provider-specific feeds." },
      {
        href: "/news/social",
        label: "Social Pulse",
        description: "Bluesky and Hacker News community signals.",
      },
      {
        href: "/news/research",
        label: "Research",
        description: "Benchmarks, methodology and evaluation changes.",
      },
    ],
  },
  {
    id: "harness",
    title: "Harness Watch",
    compactTitle: "Harness",
    description:
      "Coding-agent subscriptions: plans, prices, included credits, model access and change history.",
    basePath: "/harness",
    subNav: [
      {
        href: "/harness",
        label: "Overview",
        description: "Monitored products and the latest plan changes.",
      },
      {
        href: "/harness/plans",
        label: "Plans",
        description: "Every active plan with price, credits and access.",
      },
      {
        href: "/harness/compare",
        label: "Compare",
        description: "Select plans and compare them side by side.",
      },
      {
        href: "/harness/cheapest",
        label: "Cheapest",
        description: "Factual cheapest-option views with formulas.",
      },
      {
        href: "/harness/changes",
        label: "Changes",
        description: "Chronological plan and price change feed.",
      },
      { href: "/harness/news", label: "News", description: "Harness ecosystem news." },
      {
        href: "/harness/calculator",
        label: "Calculator",
        description: "What should I pay for? Transparent fit scoring.",
      },
    ],
  },
  {
    id: "world",
    title: "World & Politics",
    compactTitle: "World",
    description:
      "A separate editorial domain. Descriptive, attributed and never used for model or harness recommendations.",
    basePath: "/world",
    subNav: [],
  },
  {
    id: "watchlists",
    title: "Watchlists",
    compactTitle: "Watchlists",
    description: "Saved model groups, providers, harness products, topics and news queries.",
    basePath: "/watchlists",
    subNav: [],
  },
  {
    id: "sources",
    title: "Sources",
    compactTitle: "Sources",
    description: "Source registry, adapter status, freshness, rate limits and ingestion errors.",
    basePath: "/sources",
    subNav: [],
  },
  {
    id: "methodology",
    title: "Methodology",
    compactTitle: "Methodology",
    description: "How every derived number is produced, and what this product does not claim.",
    basePath: "/methodology",
    subNav: [],
  },
];

export const MOBILE_TABS: NavItem[] = [
  { href: "/models", label: "Models", icon: LayoutDashboard, description: "", matchPrefix: true },
  { href: "/news", label: "News", icon: Newspaper, description: "", matchPrefix: true },
  { href: "/harness", label: "Watch", icon: Terminal, description: "", matchPrefix: true },
  { href: "/world", label: "World", icon: Globe2, description: "" },
  { href: "/", label: "More", icon: Layers, description: "" },
];

export function isActivePath(pathname: string, item: NavItem): boolean {
  if (item.href === "/") return pathname === "/";
  if (item.matchPrefix) return pathname === item.href || pathname.startsWith(`${item.href}/`);
  return pathname === item.href;
}

export function workspaceForPath(pathname: string): WorkspaceDefinition | null {
  const sorted = [...WORKSPACES].sort((a, b) => b.basePath.length - a.basePath.length);
  return (
    sorted.find(
      (workspace) =>
        pathname === workspace.basePath || pathname.startsWith(`${workspace.basePath}/`),
    ) ?? null
  );
}

export const NAV_ICONS = { BarChart3, TrendingUp, Table2, History };
