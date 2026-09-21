"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/primitives";
import { RelativeTime } from "@/components/ui/relative-time";
import { cn } from "@/lib/utils/cn";
import type { SocialPost } from "@/lib/domain/schema";
import { EmptyState } from "./feed";

const PLATFORM_LABELS: Record<SocialPost["platform"], string> = {
  x: "X",
  bluesky: "Bluesky",
  hackernews: "Hacker News",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  blog: "Blog",
  reddit: "Reddit",
};

function byPublishedDesc(a: SocialPost, b: SocialPost): number {
  return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
}

function CorroborationBadge({ corroborated }: { corroborated: boolean }): React.JSX.Element {
  if (corroborated) {
    return (
      <Badge variant="success" title="An official or tier-1 source later confirmed the same claim">
        Corroborated
      </Badge>
    );
  }
  return (
    <Badge variant="warning" title="No official or tier-1 source has confirmed this claim yet">
      Not yet corroborated
    </Badge>
  );
}

/**
 * Dense social timeline row: account, platform, time, plain-text excerpt,
 * detected entities, corroboration status and a link to the original post.
 * Rendering mirrors the platform terms — excerpts only, never embedded content.
 */
export function SocialPostRow({ post }: { post: SocialPost }): React.JSX.Element {
  const platform = PLATFORM_LABELS[post.platform];

  return (
    <li className="flex flex-col gap-1 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground">
        <span className="font-medium text-foreground">{post.displayName}</span>
        <span>{post.handle}</span>
        <Badge variant="outline">{platform}</Badge>
        <RelativeTime value={post.publishedAt} className="tabular" />
        <CorroborationBadge corroborated={post.corroborated} />
      </div>

      <p className="text-xs text-foreground">{post.text}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        {post.entities.map((entity) => (
          <Chip
            key={entity}
            title={entity}
            className="border-transparent bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground"
          >
            {entity}
          </Chip>
        ))}
        <ButtonLink
          href={post.url}
          target="_blank"
          rel="noreferrer noopener"
          variant="outline"
          size="xs"
          className="ml-auto"
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          Open original
          <span className="sr-only">
            {" "}
            — {post.displayName} on {platform}, opens in a new tab
          </span>
        </ButtonLink>
      </div>
    </li>
  );
}

export function SocialPulse({
  posts,
  emptyLabel = "No monitored-account posts are available.",
  className,
}: {
  posts: SocialPost[];
  emptyLabel?: string;
  className?: string;
}): React.JSX.Element {
  const ordered = React.useMemo(() => [...posts].sort(byPublishedDesc), [posts]);

  if (ordered.length === 0) return <EmptyState label={emptyLabel} className={className} />;

  return (
    <ul className={cn("divide-y divide-border", className)}>
      {ordered.map((post) => (
        <SocialPostRow key={post.id} post={post} />
      ))}
    </ul>
  );
}

/** Compact version used by the cross-category overview. */
export function SocialPulseStrip({
  posts,
  limit = 4,
}: {
  posts: SocialPost[];
  limit?: number;
}): React.JSX.Element {
  const items = React.useMemo(
    () => [...posts].sort(byPublishedDesc).slice(0, limit),
    [posts, limit],
  );

  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No monitored-account posts are available.</p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((post) => (
        <li key={post.id} className="flex flex-col gap-1 py-2 text-xs first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground">
            <span className="font-medium text-foreground">{post.displayName}</span>
            <span>{post.handle}</span>
            <RelativeTime value={post.publishedAt} className="tabular" />
            <CorroborationBadge corroborated={post.corroborated} />
          </div>
          <p className="text-muted-foreground">{post.text}</p>
        </li>
      ))}
    </ul>
  );
}
