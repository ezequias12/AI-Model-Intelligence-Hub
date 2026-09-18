"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  useEffect(() => {
    console.error("[app] render error", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-3 py-16">
      <p className="text-2xs font-medium text-destructive">Error</p>
      <h1 className="text-xl font-semibold tracking-[-0.018em]">This workspace failed to render</h1>
      <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
        The failure was logged server-side. Retry the render; if it persists, check the ingestion
        status on the Sources page — a malformed source payload is the usual cause.
      </p>
      {error.digest && (
        <p className="measured text-2xs text-muted-foreground">digest: {error.digest}</p>
      )}
      <Button size="sm" onClick={reset}>
        Retry
      </Button>
    </div>
  );
}
