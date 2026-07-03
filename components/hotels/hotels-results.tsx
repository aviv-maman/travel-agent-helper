"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LayoutGrid, List } from "lucide-react";
import type { ViewHotel } from "@/lib/hotels";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HotelCard } from "./hotel-card";
import { HotelDetailModal } from "./hotel-detail-modal";
import { useViewMode } from "./use-view-mode";

export function HotelsResults({
  hotels,
  canEdit = false,
}: {
  hotels: ViewHotel[];
  canEdit?: boolean;
}) {
  const t = useTranslations("hotels");
  const [selected, setSelected] = useState<ViewHotel | null>(null);
  const [view, setView] = useViewMode();

  if (hotels.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("noResults")}</p>;
  }

  return (
    <>
      <div className="flex items-center justify-end gap-3">
        <TooltipProvider>
          <div className="inline-flex items-center rounded-lg border border-border p-0.5">
            {(
              [
                { mode: "list", Icon: List, label: t("view.list") },
                { mode: "grid", Icon: LayoutGrid, label: t("view.grid") },
              ] as const
            ).map(({ mode, Icon, label }) => (
              <Tooltip key={mode}>
                <TooltipTrigger
                  render={
                    <Button
                      variant={view === mode ? "secondary" : "ghost"}
                      size="icon"
                      className="size-7"
                      aria-label={label}
                      aria-pressed={view === mode}
                      onClick={() => setView(mode)}
                    />
                  }>
                  <Icon className="size-4" />
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </div>

      <div
        className={
          view === "grid"
            ? "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
            : "flex flex-col gap-4"
        }>
        {hotels.map((h) => (
          <HotelCard
            key={h.id}
            hotel={h}
            layout={view}
            canEdit={canEdit}
            onOpen={() => setSelected(h)}
          />
        ))}
      </div>

      <HotelDetailModal hotel={selected} onClose={() => setSelected(null)} />
    </>
  );
}
