import { cn } from "@/lib/utils";

/**
 * Renders a country's flag as an SVG image. We can't use flag emoji (🇬🇪) because
 * Windows / Edge don't ship regional-indicator glyphs — they show "GE" instead.
 */
export function CountryFlag({ code, className }: { code: string; className?: string }) {
  if (!/^[A-Za-z]{2}$/.test(code)) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static flag asset
    <img
      src={`https://flagcdn.com/${code.toLowerCase()}.svg`}
      alt=""
      aria-hidden
      loading="lazy"
      className={cn("inline-block h-3.5 w-5 shrink-0 rounded-xs object-cover", className)}
    />
  );
}
