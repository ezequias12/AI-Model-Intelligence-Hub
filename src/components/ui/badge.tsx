import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/**
 * Chip-style label.
 *
 * Semantic variants use a tinted background rather than a coloured border, so a
 * row of chips reads as one quiet band instead of a fence. State is never
 * carried by colour alone: callers pair these with text (see `TrustTierBadge`
 * and `DeltaBadge`, which add a glyph or a word).
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-chip border border-transparent px-1.5 py-[3px] text-2xs font-medium leading-none",
  {
    variants: {
      variant: {
        default: "border-border bg-surface-sunken text-foreground",
        muted: "bg-muted text-muted-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        primary: "bg-primary-muted text-primary",
        success: "bg-success-muted text-success",
        warning: "bg-warning-muted text-warning",
        info: "bg-info-muted text-info",
        destructive: "bg-destructive-muted text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  ),
);
Badge.displayName = "Badge";

/** Small numeric counter. The only place a pill shape is used. */
export function CountPill({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}): React.JSX.Element {
  return (
    <span
      title={title}
      className={cn(
        "tabular inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-muted px-1.5 py-[2px] text-2xs font-medium leading-none text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export { badgeVariants };
