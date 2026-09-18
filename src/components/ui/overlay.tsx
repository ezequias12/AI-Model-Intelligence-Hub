"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";

/**
 * Overlay primitives built on the native `<dialog>` element.
 *
 * The platform element gives focus trapping, Escape handling and inert
 * background content for free, which is more reliable than a hand-rolled
 * implementation. Overlays are the only elevated surfaces in this product, so
 * they are also the only place a shadow is declared. Styling comes from the
 * `.sheet` class in globals.css.
 */

interface BaseOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  /** Accessible name, rendered visually as the panel title when provided. */
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Hides the default header. Useful for palettes that render their own. */
  hideHeader?: boolean;
}

function useDialog(
  open: boolean,
  onOpenChange: (open: boolean) => void,
): React.RefObject<HTMLDialogElement | null> {
  const ref = React.useRef<HTMLDialogElement | null>(null);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleClose = (): void => onOpenChange(false);
    const handleClick = (event: MouseEvent): void => {
      // A click that lands on the dialog element itself is a backdrop click: the
      // panel content is always wrapped in a child div.
      if (event.target === element) onOpenChange(false);
    };

    element.addEventListener("close", handleClose);
    element.addEventListener("click", handleClick);
    return () => {
      element.removeEventListener("close", handleClose);
      element.removeEventListener("click", handleClick);
    };
  }, [onOpenChange]);

  return ref;
}

function OverlayHeader({
  title,
  description,
  onClose,
  closeLabel,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  onClose: () => void;
  closeLabel: string;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        {title && (
          <h2 className="text-md font-semibold tracking-[-0.014em] text-foreground">{title}</h2>
        )}
        {description && (
          <p className="max-w-[62ch] text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={closeLabel}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function Modal({
  open,
  onOpenChange,
  children,
  className,
  title,
  description,
  hideHeader = false,
}: BaseOverlayProps): React.JSX.Element {
  const ref = useDialog(open, onOpenChange);

  return (
    <dialog ref={ref} className="sheet" aria-label={typeof title === "string" ? title : "Dialog"}>
      <div className="absolute inset-0 overflow-y-auto overscroll-contain p-4 pt-[9vh]">
        <div
          className={cn(
            "mx-auto w-full max-w-2xl animate-overlay-in rounded-overlay border border-border bg-popover text-popover-foreground shadow-overlay",
            className,
          )}
        >
          {!hideHeader && (
            <OverlayHeader
              title={title}
              description={description}
              onClose={() => onOpenChange(false)}
              closeLabel="Close dialog"
            />
          )}
          {children}
        </div>
      </div>
    </dialog>
  );
}

export function Sheet({
  open,
  onOpenChange,
  children,
  className,
  title,
  description,
  side = "right",
}: BaseOverlayProps & { side?: "right" | "left" }): React.JSX.Element {
  const ref = useDialog(open, onOpenChange);

  return (
    <dialog ref={ref} className="sheet" aria-label={typeof title === "string" ? title : "Panel"}>
      <div
        className={cn(
          "absolute inset-y-0 flex w-full max-w-[560px] flex-col bg-surface-raised shadow-overlay",
          side === "right" ? "right-0 animate-sheet-in border-l" : "left-0 border-r",
          "border-border",
          className,
        )}
      >
        <OverlayHeader
          title={title}
          description={description}
          onClose={() => onOpenChange(false)}
          closeLabel="Close panel"
        />
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </dialog>
  );
}

export interface PopoverProps {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (props: { close: () => void }) => React.ReactNode;
  align?: "start" | "end";
  className?: string;
  label: string;
}

/** Small anchored popover with click-outside and Escape handling. */
export function Popover({
  trigger,
  children,
  align = "start",
  className,
  label,
}: PopoverProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {trigger({ open, toggle: () => setOpen((value) => !value) })}
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute z-50 mt-1.5 min-w-[220px] animate-overlay-in rounded-control border border-border bg-popover p-1 text-popover-foreground shadow-overlay",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  );
}
