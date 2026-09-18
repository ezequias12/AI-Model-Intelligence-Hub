import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Text input.
 *
 * Defaults match the Web Interface Guidelines for this product: every field is a
 * search, filter or number entry rather than a credential, so autofill and
 * spellcheck are off by default and a caller can opt back in. The font size is
 * inherited from the global rule, which keeps the computed size at 1rem on small
 * screens so iOS Safari does not zoom the viewport on focus.
 */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, autoComplete, spellCheck, ...props }, ref) => (
  <input
    ref={ref}
    type={type ?? "text"}
    autoComplete={autoComplete ?? "off"}
    spellCheck={spellCheck ?? false}
    className={cn(
      "flex h-9 w-full rounded-control border border-input bg-background px-2.5 text-sm text-foreground",
      "transition-[border-color,background-color] duration-150 ease-out",
      "placeholder:text-muted-foreground",
      "hover:border-muted-foreground/40",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

/**
 * Native select.
 *
 * `background-color` and `color` are set explicitly because Windows dark mode
 * otherwise renders the popup unreadable.
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, style, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-8 w-full appearance-none rounded-control border border-input bg-background bg-[length:14px] bg-[right_0.5rem_center] bg-no-repeat pl-2.5 pr-7 text-sm text-foreground",
      "transition-[border-color,background-color] duration-150 ease-out",
      "hover:border-muted-foreground/40",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%237c8a94' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      ...style,
    }}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

/**
 * Field label. Always rendered: a placeholder is never a label.
 */
export function Label({
  className,
  children,
  hint,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { hint?: string }): React.JSX.Element {
  return (
    <label
      className={cn("flex flex-col gap-1 text-xs font-medium text-foreground", className)}
      {...props}
    >
      <span className="flex items-baseline gap-1.5">
        {children}
        {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={cn(
      "h-3.5 w-3.5 shrink-0 cursor-pointer rounded-[4px] border border-input bg-background accent-[hsl(var(--primary))] transition-colors duration-150",
      className,
    )}
    {...props}
  />
));
Checkbox.displayName = "Checkbox";

export function Separator({
  className,
  orientation = "horizontal",
}: {
  className?: string;
  orientation?: "horizontal" | "vertical";
}): React.JSX.Element {
  return (
    <div
      role="presentation"
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
    />
  );
}

export function Skeleton({ className }: { className?: string }): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-chip bg-muted motion-reduce:animate-none", className)}
    />
  );
}
