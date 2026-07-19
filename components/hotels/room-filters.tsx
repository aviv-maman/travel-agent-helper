"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ROOM_SIZE_MAX, ROOM_SIZE_STEP, parseSize, type RoomAmenity } from "@/lib/room-filter";
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

/** A manual size input with its unit. The unit sits so the number reads on its
 *  right — before the box in Hebrew ("מ״ר 50"), after it in English ("50 Sqm"). */
function SizeBox({
  id,
  label,
  value,
  placeholder,
  unit,
  isHe,
  alignEnd,
  onChange,
  onCommit,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  unit: string;
  isHe: boolean;
  alignEnd?: boolean;
  onChange: (_v: string) => void;
  onCommit: () => void;
}) {
  const unitEl = <span className="text-xs text-muted-foreground">{unit}</span>;
  return (
    <div className={`flex flex-col gap-0.5 ${alignEnd ? "items-end" : ""}`}>
      <label className="text-xs text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        {isHe && unitEl}
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.currentTarget.value)}
          onBlur={onCommit}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="h-8 w-20 rounded-md border border-input bg-surface px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
        />
        {!isHe && unitEl}
      </div>
    </div>
  );
}

/**
 * The size control: a range slider wired to the two boxes through one shared
 * text state, so dragging a thumb updates the box numbers live (and typing in a
 * box moves the thumb). Commits to the URL on release / blur. Remounted (via
 * `key`) when the URL values change externally, e.g. after "clear".
 */
function SizeControl({
  minSize,
  maxSize,
  unit,
  isHe,
  labelMin,
  labelMax,
  onCommit,
}: {
  minSize: number | null;
  maxSize: number | null;
  unit: string;
  isHe: boolean;
  labelMin: string;
  labelMax: string;
  onCommit: (_min: number | null, _max: number | null) => void;
}) {
  const [minText, setMinText] = useState(minSize != null ? String(minSize) : "");
  const [maxText, setMaxText] = useState(maxSize != null ? String(maxSize) : "");

  // Slider position derived from the box text (clamped to the track); the boxes
  // may still hold values beyond the ceiling — the thumb just pins at the top.
  const lo = Math.min(Math.max(parseSize(minText) ?? 0, 0), ROOM_SIZE_MAX);
  const hiTyped = parseSize(maxText);
  const hi = hiTyped != null ? Math.min(hiTyped, ROOM_SIZE_MAX) : ROOM_SIZE_MAX;
  const sliderValue = [Math.min(lo, hi), Math.max(lo, hi)];

  const commit = () => onCommit(parseSize(minText), parseSize(maxText));

  return (
    <DirectionProvider direction="ltr">
      {/* Forced LTR so Base UI's drag logic matches the visuals: left handle =
          min, right = max (the app is RTL, which otherwise inverts dragging). */}
      <div dir="ltr" className="flex w-64 flex-col gap-2 self-start">
        <Slider
          min={0}
          max={ROOM_SIZE_MAX}
          step={ROOM_SIZE_STEP}
          value={sliderValue}
          onValueChange={(v) => {
            const [a, b] = Array.isArray(v) ? v : [v, v];
            // Live-update the boxes; blank at the bounds so the placeholder shows.
            setMinText(a > 0 ? String(a) : "");
            setMaxText(b < ROOM_SIZE_MAX ? String(b) : "");
          }}
          onValueCommitted={(v) => {
            const [a, b] = Array.isArray(v) ? v : [v, v];
            onCommit(a > 0 ? a : null, b < ROOM_SIZE_MAX ? b : null);
          }}
        />
        {/* Min under the slider's left end, max under its right end. */}
        <div className="flex items-start justify-between gap-4">
          <SizeBox
            id="room-size-min"
            label={labelMin}
            value={minText}
            placeholder="5"
            unit={unit}
            isHe={isHe}
            onChange={setMinText}
            onCommit={commit}
          />
          <SizeBox
            id="room-size-max"
            label={labelMax}
            value={maxText}
            placeholder="300"
            unit={unit}
            isHe={isHe}
            alignEnd
            onChange={setMaxText}
            onCommit={commit}
          />
        </div>
      </div>
    </DirectionProvider>
  );
}

export function RoomFilters() {
  const t = useTranslations("hotels.roomFilter");
  const isHe = useLocale() === "he";
  const { roomMinSize, roomMaxSize, roomAmenities, update } = useHotelParams();

  const toggleAmenity = (v: RoomAmenity) =>
    update({
      roomAmenities: roomAmenities.includes(v)
        ? roomAmenities.filter((x) => x !== v)
        : [...roomAmenities, v],
    });

  const hasFilters = roomMinSize != null || roomMaxSize != null || roomAmenities.length > 0;
  const clearAll = () => update({ roomMinSize: null, roomMaxSize: null, roomAmenities: [] });

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

      {/* Room size: slider + optional manual min/max boxes (live-linked) */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-muted-foreground">{t("size")}</span>
        <SizeControl
          key={`${roomMinSize ?? ""}:${roomMaxSize ?? ""}`}
          minSize={roomMinSize}
          maxSize={roomMaxSize}
          unit={t("unit")}
          isHe={isHe}
          labelMin={t("min")}
          labelMax={t("max")}
          onCommit={(min, max) => update({ roomMinSize: min, roomMaxSize: max })}
        />
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
