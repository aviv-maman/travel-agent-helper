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
/**
 * Avatar: the user's image when `src` is set, else an initials fallback. Safe in
 * server or client components. Uses a plain <img> (a small storage asset on an external
 * domain — no next/image loader config needed).
 */
export function UserAvatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  const base = "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className={cn(base, "size-full object-cover", className)} />
    );
  }
  return (
    <span aria-hidden className={cn(base, "bg-brand/15 font-semibold text-brand", className)}>
      {initialsOf(name)}
    </span>
  );
}
