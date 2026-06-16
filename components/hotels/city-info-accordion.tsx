"use client";

import { useTranslations } from "next-intl";
import type { ViewInfo } from "@/lib/hotels";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
        <AccordionTrigger className="text-sm font-extrabold">🏙 {t("title")}</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3 text-sm leading-relaxed">
          {info.about && <p className="text-foreground">{info.about}</p>}
          {info.attractions && <p className="text-muted-foreground">{info.attractions}</p>}

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
                      <td className="py-1 ps-2 text-end font-bold whitespace-nowrap text-gold">
                        {row.price}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {info.landmarks && (
            <div className="border-t border-border pt-2 text-xs text-muted-foreground">
              {info.landmarks}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
