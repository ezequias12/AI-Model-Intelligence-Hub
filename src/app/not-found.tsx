import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export default function NotFound(): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-3 py-16">
      <p className="text-2xs font-medium text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold tracking-[-0.018em]">
        That page is not part of the hub
      </h1>
      <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
        The model, source or route you asked for does not exist in the current dataset. A stale
        shared link with an unknown model id is the most common cause.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/" className={cn(buttonVariants({ size: "sm" }))}>
          Overview
        </Link>
        <Link href="/models" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Models
        </Link>
      </div>
    </div>
  );
}
