"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ROOM_SIZE_MAX,
  ROOM_SIZE_STEP,
  parseSize,
  type RoomAmenity,
} from "@/lib/room-filter";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { useHotelParams } from "./use-hotel-params";

const AMENITIES: { value: RoomAmenity; emoji: string }[] = [
  { value: "balcony", emoji: "🪟" },
  { value: "ac", emoji: "❄️" },
  { value: "minibar", emoji: "🍾" },
];

const chipClass =
  "rounded-full border border-border aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-brand-foreground";

/** The size range slider — local state for smooth dragging, commits to the URL
 *  on release. Remounted (via `key`) when the URL values change externally. */
function SizeSlider({
  min,
  max,
  onCommit,
}: {
  min: number;
  max: number;
  onCommit: (_lo: number, _hi: number) => void;
}) {
  const [range, setRange] = useState<number[]>([min, max]);
  return (
    <Slider
      min={0}
      max={ROOM_SIZE_MAX}
      step={ROOM_SIZE_STEP}
      value={range}
      onValueChange={(v) => setRange(Array.isArray(v) ? v : [v])}
      onValueCommitted={(v) => {
        const [lo, hi] = Array.isArray(v) ? v : [v, v];
        onCommit(lo, hi);
      }}
    />
  );
}

export function RoomFilters() {
  const t = useTranslations("hotels.roomFilter");
  const { roomMinSize, roomMaxSize, roomAmenities, update } = useHotelParams();

  const displayMin = roomMinSize ?? 0;
  const displayMax = roomMaxSize != null ? Math.min(roomMaxSize, ROOM_SIZE_MAX) : ROOM_SIZE_MAX;
  // Remount the slider when the committed values change (e.g. after "clear").
  const sliderKey = `${roomMinSize ?? ""}:${roomMaxSize ?? ""}`;

  const commitSize = (lo: number, hi: number) =>
    update({
      roomMinSize: lo > 0 ? lo : null,
      roomMaxSize: hi < ROOM_SIZE_MAX ? hi : null,
    });

  const toggleAmenity = (v: RoomAmenity) =>
    update({
      roomAmenities: roomAmenities.includes(v)
        ? roomAmenities.filter((x) => x !== v)
        : [...roomAmenities, v],
    });

  // Value shown in the top-right of the size row, e.g. "30–100+ m²".
  const maxLabel = roomMaxSize == null ? `${ROOM_SIZE_MAX}+` : String(roomMaxSize);
  const rangeLabel = t("sizeRange", { min: roomMinSize ?? 0, max: maxLabel });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-brand/5 px-3 py-3">
      <span className="text-sm font-bold">🛏 {t("label")}</span>

      {/* Room size: slider + optional manual min/max boxes */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground">{t("size")}</span>
          <span className="text-xs font-semibold text-foreground tabular-nums" dir="ltr">
            {rangeLabel}
          </span>
        </div>
        <SizeSlider key={sliderKey} min={displayMin} max={displayMax} onCommit={commitSize} />
        <div className="flex items-center gap-2" dir="ltr">
          <input
            key={`min-${roomMinSize ?? ""}`}
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={roomMinSize ?? ""}
            placeholder={t("min")}
            aria-label={t("min")}
            onBlur={(e) => update({ roomMinSize: parseSize(e.currentTarget.value) })}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="h-8 w-24 rounded-md border border-input bg-surface px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
          />
          <span className="text-muted-foreground">–</span>
          <input
            key={`max-${roomMaxSize ?? ""}`}
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={roomMaxSize ?? ""}
            placeholder={t("max")}
            aria-label={t("max")}
            onBlur={(e) => update({ roomMaxSize: parseSize(e.currentTarget.value) })}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="h-8 w-24 rounded-md border border-input bg-surface px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
          />
          <span className="text-xs text-muted-foreground">{t("unit")}</span>
        </div>
      </div>

      {/* Amenities the room must have */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {AMENITIES.map((a) => (
          <Toggle
            key={a.value}
            pressed={roomAmenities.includes(a.value)}
            onPressedChange={() => toggleAmenity(a.value)}
            size="sm"
            className={chipClass}>
            {a.emoji} {t(a.value)}
          </Toggle>
        ))}
      </div>
    </div>
  );
}
