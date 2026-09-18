import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/**
 * Control surface.
 *
 * Transitions list their properties explicitly rather than using `all`, so an
 * unrelated layout change never animates. The focus ring is inherited from the
 * global `:focus-visible` rule: a replacement ring always exists, and it is
 * never suppressed.
 */
const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-medium transition-[background-color,color,border-color,opacity] duration-150 ease-out disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent active:bg-secondary",
        outline:
          "border border-border bg-transparent text-foreground hover:border-input hover:bg-accent active:bg-accent/70",
        ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
        /* A tinted, borderless surface for controls that sit inside panels. */
        subtle: "bg-surface-sunken text-foreground hover:bg-accent",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-primary underline decoration-primary/40 hover:decoration-primary",
      },
      size: {
        default: "h-9 px-3.5 text-sm",
        sm: "h-8 px-3 text-sm",
        xs: "h-7 px-2 text-xs",
        lg: "h-10 px-5 text-base",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
        "icon-xs": "h-7 w-7",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type, ...props }, ref) => (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export interface ButtonLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement>,
    VariantProps<typeof buttonVariants> {}

export const ButtonLink = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ className, variant, size, ...props }, ref) => (
    <a ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
ButtonLink.displayName = "ButtonLink";

/**
 * Inline text action. Used inside dense rows where a full control would add
 * visual weight without adding meaning.
 */
export const TextAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, type, ...props }, ref) => (
  <button
    ref={ref}
    type={type ?? "button"}
    className={cn(
      "inline-flex items-center gap-1 text-xs font-medium text-primary underline decoration-primary/30 underline-offset-[3px] transition-[text-decoration-color] duration-150 hover:decoration-primary",
      className,
    )}
    {...props}
  />
));
TextAction.displayName = "TextAction";

export { buttonVariants };
