"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

const KEY_STORAGE = "amih_admin_key";

/**
 * Global refresh control.
 *
 * Runs the core pipeline (all sources) through the same manual ingestion
 * endpoint the Sources workspace uses, sharing the stored admin token, so a
 * full refresh is one click from any page. The header stays compact: state is
 * carried by the icon, the tooltip and an aria-live announcement.
 */
export function QuickSyncButton(): React.JSX.Element {
  const router = useRouter();
  const [adminKey, setAdminKey] = React.useState("");
  const [keyOpen, setKeyOpen] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | null>(null);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY_STORAGE);
      if (saved) setAdminKey(saved);
    } catch {
      // Storage unavailable: the token can still be typed for this session.
    }
  }, []);

  React.useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), 8000);
    return () => clearTimeout(timer);
  }, [result]);

  const saveKey = (value: string): void => {
    setAdminKey(value);
    try {
      if (value) localStorage.setItem(KEY_STORAGE, value);
      else localStorage.removeItem(KEY_STORAGE);
    } catch {
      // Preference is not persisted; the session still works.
    }
  };

  const handleSync = async (): Promise<void> => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/jobs/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job: "all", adminKey: adminKey.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        results?: { ok: boolean }[];
      };
      if (!res.ok) {
        if (res.status === 401) setKeyOpen(true);
        setResult({ ok: false, text: data.error ?? `Refresh failed (HTTP ${res.status}).` });
        return;
      }
      const results = Array.isArray(data.results) ? data.results : [];
      const succeeded = results.filter((entry) => entry.ok).length;
      setResult({
        ok: Boolean(data.ok),
        text:
          results.length > 1
            ? `Refresh finished: ${succeeded} of ${results.length} jobs succeeded.`
            : "Refresh finished.",
      });
      router.refresh();
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "Connection error." });
    } finally {
      setRunning(false);
    }
  };

  const stateText = running
    ? "Refreshing all data…"
    : (result?.text ?? "Refresh all data now (core pipeline)");

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleSync}
        disabled={running}
        aria-label={stateText}
        title={stateText}
        className={cn(result && !result.ok && "text-destructive", result?.ok && "text-success")}
      >
        <RefreshCw
          className={cn("h-4 w-4", running && "animate-spin motion-reduce:animate-none")}
          aria-hidden="true"
        />
      </Button>

      <span role="status" aria-live="polite" className="sr-only">
        {result?.text ?? ""}
      </span>

      {keyOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-panel border border-border bg-surface p-2.5 shadow-lg">
          <label htmlFor="quick-sync-key" className="block text-2xs font-medium text-foreground">
            Admin Secret (CRON_SECRET)
          </label>
          <Input
            id="quick-sync-key"
            type="password"
            value={adminKey}
            onChange={(event) => saveKey(event.target.value)}
            placeholder="Token from the Vercel environment"
            className="mt-1.5 h-8 text-xs"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-2xs text-muted-foreground">Saved in this browser.</span>
            <Button size="xs" variant="ghost" onClick={() => setKeyOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
