import { Fragment } from "react";

/**
 * Picks a color for a price span: net prices (נטו / "net") render red, gross
 * prices (ברוטו / "gross") render blue. Anything else keeps the default color.
 */
function priceColor(inner: string): string {
  if (/נטו|net/i.test(inner)) return "text-destructive";
  if (/ברוטו|gross/i.test(inner)) return "text-brand";
  return "";
}

/**
 * Renders text with `**bold**` spans as <strong>, and `\n` as line breaks.
 * Used for the curated commission notes/baggage lines, which carry light
 * emphasis but no other markup. When `colorPrices` is set, bold price spans are
 * tinted by type (net = red, gross = blue) — used for the baggage table.
 */
export function RichText({ text, colorPrices = false }: { text: string; colorPrices?: boolean }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong
                key={j}
                className={`font-bold ${colorPrices ? `whitespace-nowrap ${priceColor(part.slice(2, -2))}` : ""}`}>
                {part.slice(2, -2)}
              </strong>
            ) : (
              <Fragment key={j}>{part}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}
