"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { NAV_SECTIONS, MOBILE_TABS, isActivePath, workspaceForPath } from "@/lib/nav";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme";
import { CommandPalette } from "./command-palette";
import type { SearchEntry } from "@/lib/search";

export interface ShellChromeProps {
  children: React.ReactNode;
  /** Freshness summary shown in the top bar. */
  freshnessLabel: string;
  freshnessTone: "fresh" | "aging" | "stale" | "unknown";
  dataModeLabel: string;
  degraded: boolean;
  /** Serialisable search index for the command palette. */
  searchIndex?: SearchEntry[];
  /** Data-mode notice rendered directly under the header. */
  dataNotice?: React.ReactNode;
}

const TONE_DOT: Record<ShellChromeProps["freshnessTone"], string> = {
  fresh: "bg-success",
  aging: "bg-warning",
  stale: "bg-destructive",
  unknown: "bg-muted-foreground",
};

const TONE_TEXT: Record<ShellChromeProps["freshnessTone"], string> = {
  fresh: "text-muted-foreground",
  aging: "text-warning",
  stale: "text-destructive",
  unknown: "text-muted-foreground",
};

const RAIL_STORAGE_KEY = "amih.shell.rail.v1";

export function AppShell({
  children,
  freshnessLabel,
  freshnessTone,
  dataModeLabel,
  degraded,
  searchIndex = [],
  dataNotice,
}: ShellChromeProps): React.JSX.Element {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  const workspace = workspaceForPath(pathname);

  // The rail is a preference, not page state: it survives navigation and reloads
  // but never leaks into a shared URL.
  React.useEffect(() => {
    try {
      if (window.localStorage.getItem(RAIL_STORAGE_KEY) === "collapsed") setCollapsed(true);
    } catch {
      // Storage unavailable: fall back to the expanded rail.
    }
  }, []);

  const toggleRail = React.useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(RAIL_STORAGE_KEY, next ? "collapsed" : "expanded");
      } catch {
        // Preference is not persisted; the session still works.
      }
      return next;
    });
  }, []);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div
      className="flex min-h-dvh bg-background"
      style={{ "--tray-offset": "5.75rem" } as React.CSSProperties}
    >
      <a
        href="#workspace-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-control focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {/* Rail. Same surface family as the content, separated by a hairline. */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out lg:flex",
          collapsed ? "w-[68px]" : "w-[244px]",
        )}
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-border",
            collapsed ? "px-3" : "px-4",
          )}
        >
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5 rounded-control"
            aria-label="AI Model Intelligence Hub home"
            title="AI Model Intelligence Hub"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-chip bg-primary text-primary-foreground">
              <Activity className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
            </span>
            {!collapsed && (
              <span className="truncate text-sm font-semibold tracking-[-0.016em] text-foreground">
                AI Model Intelligence Hub
              </span>
            )}
          </Link>
        </div>

        <nav
          aria-label="Sections"
          className="scroll-thin flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-2.5 py-3.5"
        >
          {NAV_SECTIONS.map((section) => (
            <div key={section.id} className="flex flex-col gap-0.5">
              {!collapsed ? (
                /* A labelled divider, not an eyebrow: the rule is the structure,
                   the word only names the group. */
                <div className="mb-1 flex items-center gap-2 px-2">
                  <span className="text-2xs font-medium text-muted-foreground">
                    {section.label}
                  </span>
                  <span aria-hidden="true" className="h-px flex-1 bg-border" />
                </div>
              ) : (
                <div aria-hidden="true" className="mb-1 h-px bg-border" />
              )}

              {section.items.map((item) => {
                const active = isActivePath(pathname, item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : item.description}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-control px-2 py-[7px] text-sm transition-[background-color,color] duration-150 ease-out",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-accent font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn("h-4 w-4 shrink-0", active && "text-primary")}
                      aria-hidden="true"
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-border p-2.5">
          <button
            type="button"
            onClick={toggleRail}
            className={cn(
              "flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-xs text-muted-foreground transition-[background-color,color] duration-150 hover:bg-accent hover:text-foreground",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-pressed={collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-sm">
          <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setMobileOpen((value) => !value)}
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
            >
              <Menu className="h-4 w-4" />
            </Button>

            <div className="flex min-w-0 flex-col justify-center">
              <h1 className="truncate text-md font-semibold leading-tight tracking-[-0.016em]">
                {workspace?.title ?? "Overview"}
              </h1>
              <p className="hidden max-w-[70ch] truncate text-xs leading-tight text-muted-foreground sm:block">
                {workspace?.description ??
                  "Cross-domain command center for models, news, harness plans and world signal."}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="hidden items-center gap-2 rounded-control border border-border bg-surface px-2.5 py-1.5 text-xs text-muted-foreground transition-[border-color,color] duration-150 hover:border-input hover:text-foreground sm:flex"
                aria-label="Open command palette"
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Search</span>
                <kbd className="rounded-[4px] border border-border bg-background px-1 py-px font-sans text-2xs text-muted-foreground">
                  ⌘&nbsp;K
                </kbd>
              </button>

              <Button
                variant="ghost"
                size="icon-sm"
                className="sm:hidden"
                onClick={() => setPaletteOpen(true)}
                aria-label="Open command palette"
              >
                <Search className="h-4 w-4" />
              </Button>

              {/* Freshness: a state dot plus its label, so the meaning does not
                  depend on the colour. */}
              <span
                className={cn(
                  "hidden items-center gap-1.5 px-1.5 text-2xs md:flex",
                  TONE_TEXT[freshnessTone],
                )}
                title="Age of the underlying dataset"
              >
                <span
                  aria-hidden="true"
                  className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[freshnessTone])}
                />
                {freshnessLabel}
              </span>

              {dataModeLabel && (
                <span
                  className={cn(
                    "hidden text-2xs md:inline-flex",
                    degraded ? "font-medium text-warning" : "text-muted-foreground",
                  )}
                  title={
                    degraded
                      ? "Live mode was requested but a required integration is not configured"
                      : "Data mode"
                  }
                >
                  {dataModeLabel}
                </span>
              )}

              <ThemeToggle />
            </div>
          </div>

          {/* Mobile navigation drawer */}
          {mobileOpen && (
            <nav
              className="border-t border-border bg-surface px-3 py-2.5 lg:hidden"
              aria-label="Mobile navigation"
            >
              <div className="grid grid-cols-2 gap-1.5">
                {NAV_SECTIONS.flatMap((section) => section.items).map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(pathname, item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-2 rounded-control px-2.5 text-sm",
                        active ? "bg-accent font-medium text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          )}

          {/* Workspace tabs. An underline indicator reads as an instrument panel;
              a row of filled pills reads as a marketing nav. */}
          {workspace && workspace.subNav.length > 0 && (
            <nav
              aria-label={`${workspace.title} sections`}
              className="scroll-thin flex items-stretch gap-1 overflow-x-auto px-3 sm:px-5"
            >
              {workspace.subNav.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={item.description}
                    className={cn(
                      "-mb-px whitespace-nowrap border-b-2 px-2.5 py-2 text-sm transition-[color,border-color] duration-150 ease-out",
                      active
                        ? "border-primary font-medium text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </header>

        <main
          id="workspace-content"
          className="min-w-0 flex-1 px-3 py-5 pb-24 sm:px-5 lg:px-6 lg:pb-8"
        >
          {dataNotice && <div className="mb-5">{dataNotice}</div>}
          {children}
        </main>

        <footer className="hidden border-t border-border px-6 py-3 lg:block">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>Model metrics, news intelligence and harness watch.</span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-px bg-border" />
              Provider grouping is geographic, never a quality judgement.{" "}
              <Link href="/methodology" className="text-foreground underline decoration-border">
                Read the methodology
              </Link>
            </span>
          </div>
        </footer>
      </div>

      {/* Mobile bottom tabs */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
      >
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isActivePath(pathname, tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-2xs",
                active ? "font-medium text-primary" : "text-muted-foreground",
              )}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary"
                />
              )}
              <Icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} index={searchIndex} />
    </div>
  );
}
