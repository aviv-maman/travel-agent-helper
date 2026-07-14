"use client";

import { useTranslations } from "next-intl";
import type { HotelFeatureValue, HotelTagValue, BoardCode } from "@/db/schema";
import type { ViewLandmark, SortMode } from "@/lib/hotels";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { useHotelParams } from "./use-hotel-params";

const TAGS: { value: HotelTagValue; emoji: string }[] = [
  { value: "kosher", emoji: "✡️" },
  { value: "aparthotel", emoji: "🏢" },
];
const BOARDS: { value: BoardCode; emoji: string }[] = [
  { value: "bb", emoji: "🍳" },
  { value: "hb", emoji: "🍴" },
  { value: "fb", emoji: "🍽️" },
];
type HotelMessages = (typeof import("@/messages/en.json"))["hotels"];

const AMENITIES: { value: HotelFeatureValue; key: keyof HotelMessages["filter"]; emoji: string }[] =
  [
    { value: "pool-in", key: "poolIn", emoji: "🏊" },
    { value: "pool-out", key: "poolOut", emoji: "🌊" },
    { value: "casino", key: "casino", emoji: "🎰" },
    { value: "waterpark", key: "waterpark", emoji: "🛝" },
    { value: "spa", key: "spa", emoji: "🧖" },
  ];
const BASE_SORTS: { value: SortMode; key: keyof HotelMessages["sort"]; emoji: string }[] = [
  { value: "default", key: "default", emoji: "💠" },
  { value: "stars-desc", key: "starsDesc", emoji: "🌟" },
  { value: "stars-asc", key: "starsAsc", emoji: "🌟" },
  { value: "booking-desc", key: "bookingDesc", emoji: "📉" },
  { value: "booking-asc", key: "bookingAsc", emoji: "📈" },
];

const chipClass =
  "rounded-full border border-border aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-brand-foreground";

export function HotelFilters({ landmarks }: { landmarks: ViewLandmark[] }) {
  const t = useTranslations("hotels");
  const { tags, boards, features, sort, update } = useHotelParams();

  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const hasFilters = tags.length > 0 || boards.length > 0 || features.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Sort */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-brand/5 px-3 py-3">
        <span className="text-sm font-bold">{t("sort.label")}</span>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {BASE_SORTS.map((s) => (
            <Toggle
              key={s.value}
              pressed={sort === s.value}
              onPressedChange={() => update({ sort: s.value })}
              size="sm"
              className={chipClass}>
              {s.emoji} {t(`sort.${s.key}`)}
            </Toggle>
          ))}
          {landmarks.map((lm) => {
            const value: SortMode = `dist:${lm.key}`;
            return (
              <Toggle
                key={lm.key}
                pressed={sort === value}
                onPressedChange={() => update({ sort: value })}
                size="sm"
                className={chipClass}>
                📍 {t("sort.distanceFrom", { name: lm.name })}
              </Toggle>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-brand/5 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-bold">{t("filter.filtersLabel")}</span>
          <Button
            variant="destructive"
            onClick={() => update({ tags: [], boards: [], features: [] })}
            aria-hidden={!hasFilters}
            tabIndex={hasFilters ? undefined : -1}
            className={hasFilters ? undefined : "invisible"}>
            ✕ {t("filter.clear")}
          </Button>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-xs font-bold text-muted-foreground">{t("filter.tagsLabel")}</span>
          {TAGS.map((c) => (
            <Toggle
              key={c.value}
              pressed={tags.includes(c.value)}
              onPressedChange={() => update({ tags: toggle(tags, c.value) })}
              size="sm"
              className={chipClass}>
              {c.emoji} {t(`tier.${c.value}`)}
            </Toggle>
          ))}
        </div>

        {/* Board basis */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-xs font-bold text-muted-foreground">{t("filter.boardLabel")}</span>
          {BOARDS.map((b) => (
            <Toggle
              key={b.value}
              pressed={boards.includes(b.value)}
              onPressedChange={() => update({ boards: toggle(boards, b.value) })}
              size="sm"
              className={chipClass}>
              {b.emoji} {t(`board.${b.value}`)}
            </Toggle>
          ))}
        </div>

        {/* Amenities */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-xs font-bold text-muted-foreground">{t("filter.label")}</span>
          {AMENITIES.map((f) => (
            <Toggle
              key={f.value}
              pressed={features.includes(f.value)}
              onPressedChange={() => update({ features: toggle(features, f.value) })}
              size="sm"
              className={chipClass}>
              {f.emoji} {t(`filter.${f.key}`)}
            </Toggle>
          ))}
        </div>
      </div>
    </div>
  );
}
