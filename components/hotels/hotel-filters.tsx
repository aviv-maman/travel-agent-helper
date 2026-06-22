"use client";

import { useTranslations } from "next-intl";
import type { HotelFeatureValue, HotelTagValue, BoardCode } from "@/db/schema";
import type { ViewLandmark, SortMode } from "@/lib/hotels";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHotelParams } from "./use-hotel-params";

const TAGS: { value: HotelTagValue; emoji: string }[] = [{ value: "kosher", emoji: "✡️" }];
const BOARDS: { value: BoardCode; emoji: string }[] = [
  { value: "bb", emoji: "🍳" },
  { value: "hb", emoji: "🍴" },
  { value: "fb", emoji: "🍽️" },
];
const AMENITIES: { value: HotelFeatureValue; key: string; emoji: string }[] = [
  { value: "pool-in", key: "poolIn", emoji: "🏊" },
  { value: "pool-out", key: "poolOut", emoji: "🌊" },
  { value: "casino", key: "casino", emoji: "🎰" },
  { value: "waterpark", key: "waterpark", emoji: "🛝" },
];
const BASE_SORTS: { value: SortMode; key: string; emoji: string }[] = [
  { value: "default", key: "default", emoji: "💠" },
  { value: "stars-desc", key: "starsDesc", emoji: "🌟" },
  { value: "stars-asc", key: "starsAsc", emoji: "🌟" },
  { value: "booking-desc", key: "bookingDesc", emoji: "📉" },
  { value: "booking-asc", key: "bookingAsc", emoji: "📈" },
];

const chipClass =
  "rounded-full border border-border aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-brand-foreground";

const groupClass =
  "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-brand/5 px-3 py-2";

export function HotelFilters({ landmarks }: { landmarks: ViewLandmark[] }) {
  const t = useTranslations("hotels");
  const { tags, boards, features, sort, update } = useHotelParams();

  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const sortItems: Record<string, string> = {};
  for (const s of BASE_SORTS) {
    sortItems[s.value] = `${s.emoji ? `${s.emoji} ` : ""}${t(`sort.${s.key}`)}`;
  }
  for (const lm of landmarks)
    sortItems[`dist:${lm.key}`] = `📍 ${t("sort.distanceFrom", { name: lm.name })}`;

  const hasFilters = tags.length > 0 || boards.length > 0 || features.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Sort */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">{t("sort.label")}</span>
          <Select
            items={sortItems}
            value={sort}
            onValueChange={(v) => update({ sort: v as SortMode })}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BASE_SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {sortItems[s.value]}
                </SelectItem>
              ))}
              {landmarks.map((lm) => (
                <SelectItem key={lm.key} value={`dist:${lm.key}`}>
                  📍 {t("sort.distanceFrom", { name: lm.name })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasFilters && (
          <Button
            variant="destructive"
            className="ms-auto"
            onClick={() => update({ tags: [], boards: [], features: [] })}>
            ✕ {t("filter.clear")}
          </Button>
        )}
      </div>

      {/* Tags */}
      <div className={groupClass}>
        <span className="text-xs font-bold text-muted-foreground">{t("filter.tagsLabel")}</span>
        {TAGS.map((c) => (
          <Toggle
            key={c.value}
            pressed={tags.includes(c.value)}
            onPressedChange={() => update({ tags: toggle(tags, c.value) })}
            className={chipClass}>
            {c.emoji} {t(`tier.${c.value}`)}
          </Toggle>
        ))}
      </div>

      {/* Board basis */}
      <div className={groupClass}>
        <span className="text-xs font-bold text-muted-foreground">{t("filter.boardLabel")}</span>
        {BOARDS.map((b) => (
          <Toggle
            key={b.value}
            pressed={boards.includes(b.value)}
            onPressedChange={() => update({ boards: toggle(boards, b.value) })}
            className={chipClass}>
            {b.emoji} {t(`board.${b.value}`)}
          </Toggle>
        ))}
      </div>

      {/* Amenities */}
      <div className={groupClass}>
        <span className="text-xs font-bold text-muted-foreground">{t("filter.label")}</span>
        {AMENITIES.map((f) => (
          <Toggle
            key={f.value}
            pressed={features.includes(f.value)}
            onPressedChange={() => update({ features: toggle(features, f.value) })}
            className={chipClass}>
            {f.emoji} {t(`filter.${f.key}`)}
          </Toggle>
        ))}
      </div>
    </div>
  );
}
