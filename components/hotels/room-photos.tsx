"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Images } from "lucide-react";
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
        <DialogContent className="max-w-lg">
          <DialogTitle className="text-sm">{name}</DialogTitle>
          <Carousel className="w-full" opts={{ loop: true, direction: "ltr" }}>
            <CarouselContent dir="ltr">
              {photos.map((src, i) => (
                <CarouselItem key={i}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`${name} — ${i + 1}`}
                    className="h-64 w-full rounded-lg object-cover sm:h-80"
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            {photos.length > 1 && (
              <>
                <CarouselPrevious className="start-2" />
                <CarouselNext className="end-2" />
              </>
            )}
          </Carousel>
        </DialogContent>
      </Dialog>
    </>
  );
}
