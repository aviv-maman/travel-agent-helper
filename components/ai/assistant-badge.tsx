import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The assistant's brand mark — a Sparkles glyph in a subtle blue gradient circle.
 * Reused for the hero, the header strip, and the assistant message avatar. Size it
 * via `className` (e.g. `size-8`); the icon scales with `[&_svg]:size-*`.
 */
export function AssistantBadge({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-purple text-brand-foreground shadow-sm [&_svg]:size-4",
        className,
      )}>
      <Sparkles />
    </span>
  );
}
