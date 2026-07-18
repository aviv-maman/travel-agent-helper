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

/** The room facilities worth surfacing (admin's list, 2026-07-18): minibar,
 * air conditioning, balcony/terrace, bath/shower. The DB stores Booking's full
 * highlight chips; this display filter keeps the card compact. */
const FACILITY_WHITELIST = /minibar|air conditioning|balcon|terrace|patio|bath|shower/i;

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

            {/* Distances intentionally omitted — the modal is the ROOMS view
                (admin request 2026-07-18); the card already shows distances. */}
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
                      <div className="min-w-0 flex-1">
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
                        {r.facilities.some((f) => FACILITY_WHITELIST.test(f)) && (
                          <div className="mt-1 flex flex-wrap gap-1" dir="ltr">
                            {r.facilities
                              .filter((f) => FACILITY_WHITELIST.test(f))
                              .map((f) => (
                                <span
                                  key={f}
                                  className="rounded-sm bg-muted/60 px-1.5 py-px text-[0.65rem] text-muted-foreground">
                                  {f}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                      {r.photoUrl && (
                        // A small storage asset on Booking's CDN — plain <img>
                        // (no next/image loader config), hidden if it breaks.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.photoUrl}
                          alt={r.name}
                          loading="lazy"
                          className="h-16 w-24 shrink-0 rounded-md object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
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
