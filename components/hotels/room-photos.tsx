"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Images, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";

/**
 * A room's photo cover that opens the full set in a carousel lightbox. Photos
 * are Booking CDN URLs (cf.bstatic.com) — plain <img> (no next/image loader),
 * hidden if one 404s. Renders nothing when the room has no photos.
 */
export function RoomPhotos({ photos, name }: { photos: string[]; name: string }) {
  const t = useTranslations("hotels");
  const [open, setOpen] = useState(false);
  if (photos.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("modal.viewPhotos", { count: photos.length })}
        className="group relative size-16 shrink-0 overflow-hidden rounded-md sm:w-24">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[0]}
          alt={name}
          loading="lazy"
          className="size-full object-cover transition-transform group-hover:scale-105"
          onError={(e) => {
            (e.currentTarget.closest("button") as HTMLElement | null)?.style.setProperty(
              "display",
              "none",
            );
          }}
        />
        {photos.length > 1 && (
          <span className="absolute end-1 bottom-1 inline-flex items-center gap-0.5 rounded bg-black/60 px-1 py-px text-[0.6rem] font-semibold text-white">
            <Images className="size-2.5" /> {photos.length}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Full-screen dark lightbox. The content spans the viewport and closes
            on click, so clicking anywhere outside the photo/arrows dismisses it
            (base-ui's backdrop dismiss doesn't fire when nested in the room
            modal). Its own X (custom, white) stays visible over the dark. */}
        <DialogContent
          showCloseButton={false}
          className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col items-center justify-center gap-3 rounded-none border-0 bg-black/85 p-4 shadow-none ring-0 sm:max-w-none"
          onClick={() => setOpen(false)}>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("modal.close")}
            className="absolute end-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/30 transition-colors hover:bg-black/85">
            <X className="size-5" />
          </button>
          <DialogTitle className="text-sm text-white">{name}</DialogTitle>
          {/* Force LTR so the arrows sit physically left/right and the chevrons
              don't rtl-flip — a photo carousel reads left→right in any locale.
              Bounded box (stopPropagation) so only photo/arrow clicks are held. */}
          <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <Carousel dir="ltr" className="w-full" opts={{ loop: true }}>
              <CarouselContent>
                {photos.map((src, i) => (
                  <CarouselItem key={i}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`${name} — ${i + 1}`}
                      className="max-h-[82vh] w-full rounded-lg object-contain"
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              {photos.length > 1 && (
                // Solid dark circles + white chevrons so they stay visible over
                // any photo (outline arrows got lost on bright/busy shots).
                <>
                  <CarouselPrevious className="left-2 size-9 border-0 !bg-black/65 !text-white shadow-lg ring-1 ring-white/30 hover:!bg-black/85 [&_svg]:!size-5" />
                  <CarouselNext className="right-2 size-9 border-0 !bg-black/65 !text-white shadow-lg ring-1 ring-white/30 hover:!bg-black/85 [&_svg]:!size-5" />
                </>
              )}
            </Carousel>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
