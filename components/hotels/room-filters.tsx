"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ROOM_SIZE_MAX,
  ROOM_SIZE_STEP,
  parseSize,
  type RoomAmenity,
} from "@/lib/room-filter";
import { Button } from "@/components/ui/button";
import { DirectionProvider } from "@/components/ui/direction";
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

  const hasFilters = roomMinSize != null || roomMaxSize != null || roomAmenities.length > 0;
  const clearAll = () =>
    update({ roomMinSize: null, roomMaxSize: null, roomAmenities: [] });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-brand/5 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold">🛏 {t("label")}</span>
        {/* Same slot/behavior as the general filters' clear button. */}
        <Button
          variant="destructive"
          onClick={clearAll}
          aria-hidden={!hasFilters}
          tabIndex={hasFilters ? undefined : -1}
          className={hasFilters ? undefined : "invisible"}>
          ✕ {t("clear")}
        </Button>
      </div>

      {/* Room size: slider + optional manual min/max boxes */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-muted-foreground">{t("size")}</span>
        {/* Compact slider + min/max boxes, grouped at the inline-start (right
            in RTL). DirectionProvider forces Base UI's slider logic to LTR —
            the DOM dir alone only flips the visuals, so dragging was inverted —
            making the left handle the min and the right handle the max. */}
        <DirectionProvider direction="ltr">
          <div dir="ltr" className="flex w-64 flex-col gap-2 self-start">
            <SizeSlider key={sliderKey} min={displayMin} max={displayMax} onCommit={commitSize} />
            {/* Min under the slider's left end, max under its right end. */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <label className="text-xs text-muted-foreground" htmlFor="room-size-min">
                  {t("min")}
                </label>
                <input
                  id="room-size-min"
                  key={`min-${roomMinSize ?? ""}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  defaultValue={roomMinSize ?? ""}
                  onBlur={(e) => update({ roomMinSize: parseSize(e.currentTarget.value) })}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  className="h-8 w-24 rounded-md border border-input bg-surface px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <label className="text-xs text-muted-foreground" htmlFor="room-size-max">
                  {t("max")}
                </label>
                <input
                  id="room-size-max"
                  key={`max-${roomMaxSize ?? ""}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  defaultValue={roomMaxSize ?? ""}
                  onBlur={(e) => update({ roomMaxSize: parseSize(e.currentTarget.value) })}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  className="h-8 w-24 rounded-md border border-input bg-surface px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
                />
              </div>
            </div>
          </div>
        </DirectionProvider>
      </div>

      {/* Amenities the room must have */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
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
