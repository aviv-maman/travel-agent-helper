import { cn } from "@/lib/utils";

/** Initials from the first and last name-parts (splits on space . _ -). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** A simple initials avatar (no image). Safe in server or client components. */
export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-brand/15 font-semibold text-brand",
        className,
      )}>
      {initialsOf(name)}
    </span>
  );
}
