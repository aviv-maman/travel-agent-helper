"use client";

import { useTranslations } from "next-intl";
import type { ViewInfo } from "@/lib/hotels";
import { stripApprox } from "@/lib/money";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/** Splits a "Heading: …" string into its heading (incl. emoji) and the rest. */
function splitHeading(raw: string): { heading: string; body: string } {
  const idx = raw.indexOf(":");
  if (idx === -1) return { heading: "", body: raw.trim() };
  return { heading: raw.slice(0, idx + 1).trim(), body: raw.slice(idx + 1).trim() };
}

/** Each point of interest begins with its own emoji — split on those boundaries. */
function splitLandmarks(body: string): string[] {
  return body
    .split(/\s+(?=\p{Extended_Pictographic})/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function CityInfoAccordion({ info }: { info: ViewInfo }) {
  const t = useTranslations("hotels.city");

  const transport = info.transport ?? [];
  const airportTitle = info.airport?.title;
  const airportNote = info.airport?.note;

  const hasContent =
    info.about ||
    info.attractions ||
    info.currencyNote ||
    airportTitle ||
    airportNote ||
    info.landmarks ||
    transport.length > 0;
  if (!hasContent) return null;

  return (
    <Accordion className="rounded-xl border border-border bg-surface">
      <AccordionItem value="about-city" className="border-none px-4">
        <AccordionTrigger className="text-sm font-extrabold hover:no-underline">
          {t("title")}
        </AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3 text-sm leading-relaxed">
          {info.about && <p className="text-foreground">{info.about}</p>}

          {info.attractions &&
            (() => {
              const { heading, body } = splitHeading(info.attractions);
              const items = body
                .split(/\s*·\s*/)
                .map((s) => s.trim())
                .filter(Boolean);
              return (
                <div className="text-muted-foreground">
                  {heading && <div className="mb-1 font-bold text-foreground">{heading}</div>}
                  <ul className="flex list-disc flex-col gap-0.5 ps-5">
                    {items.map((it, i) => (
                      <li key={i}>{it}</li>
                    ))}
                  </ul>
                </div>
              );
            })()}

          {info.currencyNote && (
            <div className="border-t border-border pt-2">
              <div className="mb-1 text-xs font-bold text-foreground">💱 {t("currency")}</div>
              <div className="text-muted-foreground">{info.currencyNote}</div>
            </div>
          )}

          {(airportTitle || airportNote) && (
            <div className="border-t border-border pt-2">
              <div className="mb-1 text-xs font-bold text-foreground">
                ✈ {airportTitle || t("airport")}
              </div>
              {airportNote && <div className="text-muted-foreground">{airportNote}</div>}
            </div>
          )}

          {transport.length > 0 && (
            <div className="border-t border-border pt-2">
              <div className="mb-1 text-xs font-bold text-foreground">🚕 {t("gettingAround")}</div>
              <table className="w-full text-xs">
                <tbody>
                  {transport.map((row, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-1 pe-1 text-foreground">{row.icon}</td>
                      <td className="py-1 pe-2 font-semibold whitespace-nowrap text-foreground">
                        {row.mode}
                      </td>
                      <td className="py-1 text-muted-foreground">{row.detail}</td>
                      <td className="py-1 ps-2 text-end whitespace-nowrap">
                        {row.priceIls ? (
                          <span dir="ltr" className="inline-flex gap-1">
                            <span className="font-bold text-gold">{row.priceIls}</span>
                            <span className="text-brand">({stripApprox(row.price ?? "")})</span>
                          </span>
                        ) : (
                          <span dir="ltr" className="inline-block font-bold text-gold">
                            {row.price}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {info.landmarks &&
            (() => {
              const { heading, body } = splitHeading(info.landmarks);
              const items = splitLandmarks(body);
              return (
                <div className="border-t border-border pt-2 text-xs text-muted-foreground">
                  {heading && <div className="mb-1 font-bold text-foreground">{heading}</div>}
                  <ul className="flex flex-col gap-1">
                    {items.map((it, i) => (
                      <li key={i}>{it}</li>
                    ))}
                  </ul>
                </div>
              );
            })()}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
