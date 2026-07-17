"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ViewHotel } from "@/lib/hotels";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatMeters, useTimeLabel } from "./hotel-card";

export function HotelDetailModal({
  hotel,
  onClose,
}: {
  hotel: ViewHotel | null;
  onClose: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("hotels");
  const isHe = locale === "he";
  const timeLabel = useTimeLabel();

  function sizeText(sqm: number | null): string {
    if (sqm == null) return t("modal.sizeUnknown");
    return isHe ? `${sqm} מ״ר` : `${sqm} m²`;
  }

  return (
    <Dialog open={hotel !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        {hotel && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <span aria-hidden>🏨</span> {hotel.name}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
                {hotel.stars != null && (
                  <span className="text-gold" aria-hidden>
                    {"★".repeat(hotel.stars)}
                  </span>
                )}
                {hotel.boards.map((b) => (
                  <Badge key={b} variant="secondary" className="text-xs">
                    {t(`board.${b}`)}
                  </Badge>
                ))}
                {hotel.bookingScore != null && (
                  <span className="font-bold text-success">
                    {t("card.booking")} {hotel.bookingScore}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            {hotel.distances.length > 0 && (
              <table className="w-full text-xs text-muted-foreground">
                <tbody>
                  {hotel.distances.map((d) => (
                    <tr key={d.landmarkKey}>
                      <td className="py-0.5 text-start text-foreground">{d.name}</td>
                      <td className="py-0.5 text-end font-bold whitespace-nowrap text-gold">
                        {timeLabel(d)}
                      </td>
                      <td className="py-0.5 ps-2 text-end text-[0.68rem]">
                        {formatMeters(d.meters, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <section className="flex flex-col gap-2 border-t border-border pt-3">
              <h3 className="text-sm font-extrabold text-foreground">🛏 {t("modal.rooms")}</h3>
              {hotel.rooms.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("modal.noRooms")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {hotel.rooms.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 p-2.5">
                      <span className="text-lg" aria-hidden>
                        {r.icon ?? "🛏"}
                      </span>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-foreground">{r.name}</div>
                        <div
                          className={
                            r.sizeSqm == null
                              ? "text-xs text-muted-foreground/60 italic"
                              : "text-xs text-muted-foreground"
                          }>
                          {t("modal.size")}: <strong>{sizeText(r.sizeSqm)}</strong>
                        </div>
                        {r.occupancy && (
                          <div className="text-xs text-muted-foreground">👥 {r.occupancy}</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {hotel.roomsNote && (
                <p className="text-xs text-muted-foreground">📌 {hotel.roomsNote}</p>
              )}
              <p className="text-xs text-muted-foreground/70">{t("modal.updateManually")}</p>
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
