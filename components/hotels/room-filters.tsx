"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { parseSize, roomSizeBounds, type RoomAmenity } from "@/lib/room-filter";
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
 * The size control: a range slider over the destination's real room-size span
 * (`floor`..`ceil`) plus two manual boxes. The slider's numeric `[lo, hi]` is
 * its own state — the single source of truth for the thumbs — so dragging never
 * round-trips through the text boxes (which used to make the first drag stick at
 * one step). The boxes stay free-editable and are re-synced to the range on
 * commit. At the extremes a bound is treated as "no limit" (null). Commits to
 * the URL on release / blur; remounted (via `key`) when the URL values change
 * externally, e.g. after "clear".
 */
function SizeControl({
  minSize,
  maxSize,
  floor,
  ceil,
  step,
  unit,
  isHe,
  labelMin,
  labelMax,
  onCommit,
}: {
  minSize: number | null;
  maxSize: number | null;
  floor: number;
  ceil: number;
  step: number;
  unit: string;
  isHe: boolean;
  labelMin: string;
  labelMax: string;
  onCommit: (_min: number | null, _max: number | null) => void;
}) {
  const clamp = (n: number) => Math.min(Math.max(n, floor), ceil);
  const [range, setRange] = useState<[number, number]>([
    minSize != null ? clamp(minSize) : floor,
    maxSize != null ? clamp(maxSize) : ceil,
  ]);
  // Box strings, so partial typing ("1" before "15") isn't clobbered mid-entry.
  const [minText, setMinText] = useState(minSize != null ? String(minSize) : "");
  const [maxText, setMaxText] = useState(maxSize != null ? String(maxSize) : "");

  // Blank the box at its bound so the placeholder ("no lower/upper limit") shows.
  const boxText = (v: number, bound: number) => (v === bound ? "" : String(v));
  const commit = (a: number, b: number) => onCommit(a > floor ? a : null, b < ceil ? b : null);

  return (
    <DirectionProvider direction="ltr">
      {/* Forced LTR so Base UI's drag logic matches the visuals: left handle =
          min, right = max (the app is RTL, which otherwise inverts dragging). */}
      <div dir="ltr" className="flex w-64 flex-col gap-2 self-start">
        <Slider
          min={floor}
          max={ceil}
          step={step}
          value={range}
          onValueChange={(v) => {
            const [a, b] = Array.isArray(v) ? v : [v, v];
            setRange([a, b]);
            setMinText(boxText(a, floor));
            setMaxText(boxText(b, ceil));
          }}
          onValueCommitted={(v) => {
            const [a, b] = Array.isArray(v) ? v : [v, v];
            commit(a, b);
          }}
        />
        {/* Min under the slider's left end, max under its right end. */}
        <div className="flex items-start justify-between gap-4">
          <SizeBox
            id="room-size-min"
            label={labelMin}
            value={minText}
            placeholder={String(floor)}
            unit={unit}
            isHe={isHe}
            onChange={(v) => {
              setMinText(v);
              // Move the thumb live for a valid number; empty → back to the floor.
              const n = parseSize(v);
              setRange(([, hi]) => [n != null ? Math.min(clamp(n), hi) : floor, hi]);
            }}
            onCommit={() => {
              const [a, b] = range;
              setMinText(boxText(a, floor));
              commit(a, b);
            }}
          />
          <SizeBox
            id="room-size-max"
            label={labelMax}
            value={maxText}
            placeholder={String(ceil)}
            unit={unit}
            isHe={isHe}
            alignEnd
            onChange={(v) => {
              setMaxText(v);
              const n = parseSize(v);
              setRange(([lo]) => [lo, n != null ? Math.max(clamp(n), lo) : ceil]);
            }}
            onCommit={() => {
              const [a, b] = range;
              setMaxText(boxText(b, ceil));
              commit(a, b);
            }}
          />
        </div>
      </div>
    </DirectionProvider>
  );
}

export function RoomFilters({
  roomSizeMin,
  roomSizeMax,
}: {
  /** Smallest / largest sized room in this destination (m²); drives the slider. */
  roomSizeMin: number | null;
  roomSizeMax: number | null;
}) {
  const t = useTranslations("hotels.roomFilter");
  const isHe = useLocale() === "he";
  const { roomMinSize, roomMaxSize, roomAmenities, update } = useHotelParams();
  const { floor, ceil, step } = roomSizeBounds(roomSizeMin, roomSizeMax);

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
          key={`${roomMinSize ?? ""}:${roomMaxSize ?? ""}:${floor}:${ceil}`}
          minSize={roomMinSize}
          maxSize={roomMaxSize}
          floor={floor}
          ceil={ceil}
          step={step}
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
