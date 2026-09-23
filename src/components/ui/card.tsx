import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Panel.
 *
 * The hairline border is what structures the page in every theme. In the light
 * theme a panel also carries a barely-there shadow so white paper separates
 * from the tinted page behind it; that shadow resolves to `none` in dark, where
 * the border alone does the work.
 *
 * A panel is used only where content is genuinely card-shaped. Prefer grouping
 * with `PanelHeader` over nesting containers inside containers.
 */
export const Panel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-panel border border-border bg-card text-card-foreground shadow-card",
        className,
      )}
      {...props}
    />
  ),
);
Panel.displayName = "Panel";

/**
 * Panel header.
 *
 * A hairline rule under the header is the structural device that separates a
 * panel's identity from its content. It is a rule, not a shadow: elevation stays
 * border-only.
 */
export const PanelHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1 border-b border-border px-4 py-3", className)}
      {...props}
    />
  ),
);
PanelHeader.displayName = "PanelHeader";

interface PanelTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** The panel's own heading level. Never add a label above it. */
  as?: "h2" | "h3" | "h4";
}

export const PanelTitle = React.forwardRef<HTMLHeadingElement, PanelTitleProps>(
  ({ className, as: Tag = "h3", ...props }, ref) => (
    <Tag
      ref={ref}
      className={cn("text-sm font-semibold tracking-[-0.012em] text-foreground", className)}
      {...props}
    />
  ),
);
PanelTitle.displayName = "PanelTitle";

export const PanelDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("max-w-[68ch] text-xs leading-relaxed text-muted-foreground", className)}
    {...props}
  />
));
PanelDescription.displayName = "PanelDescription";

export const PanelBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-4 pb-3.5", className)} {...props} />
  ),
);
PanelBody.displayName = "PanelBody";

export const PanelFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center gap-2 border-t border-border px-4 py-2.5", className)}
      {...props}
    />
  ),
);
PanelFooter.displayName = "PanelFooter";

/** Full-bleed divider used between list rows inside a panel. */
export function Divider({ className }: { className?: string }): React.JSX.Element {
  return <div className={cn("h-px w-full bg-border", className)} role="presentation" />;
}

/* -------------------------------------------------------------------------- */
/* Section                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Page section.
 *
 * Spacing rule from the craft floor: more space above a heading than below it.
 * The gap between sections is generous; the gap from a heading to its own
 * content is tight. There is deliberately no eyebrow slot: a tracked, cased
 * label above a heading is the most recognisable generated-UI tell, and the
 * heading is expected to carry its own weight.
 */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  id,
  headingLevel = 2,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
  headingLevel?: 2 | 3;
}): React.JSX.Element {
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <section id={id} className={cn("flex flex-col", className)}>
      {(title || actions) && (
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-col gap-1">
            {title && (
              <Heading className="text-base font-semibold tracking-[-0.014em] text-foreground">
                {title}
              </Heading>
            )}
            {description && (
              <p className="max-w-[68ch] text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Vertical rhythm container for the sections of a page. */
export function SectionStack({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return <div className={cn("flex flex-col gap-8", className)}>{children}</div>;
}

/* -------------------------------------------------------------------------- */
/* Compatibility aliases                                                       */
/* -------------------------------------------------------------------------- */

/*
 * `Card` and friends remain as thin aliases so pages can adopt the new names
 * incrementally. They resolve to the flat panel: the previous
 * bordered-plus-shadowed card no longer exists.
 */
export const Card = Panel;
export const CardHeader = PanelHeader;
export const CardTitle = PanelTitle;
export const CardDescription = PanelDescription;
export const CardContent = PanelBody;
export const CardFooter = PanelFooter;
