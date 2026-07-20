"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Star, X } from "lucide-react";
import type { BoardCode, HotelFeatureValue } from "@/db/schema";
import type { ViewHotel } from "@/lib/hotels";
import { updateHotelAction } from "@/app/actions/hotels";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";

type FilterKey = keyof (typeof import("@/messages/en.json"))["hotels"]["filter"];

// Ascending so the RTL layout shows 5★ on the left (matches the stars filter).
const STAR_OPTIONS = [2, 3, 4, 5] as const;
const BOARDS: { value: BoardCode; emoji: string }[] = [
  { value: "bb", emoji: "🍳" },
  { value: "hb", emoji: "🍴" },
  { value: "fb", emoji: "🍽️" },
];
const AMENITIES: { value: HotelFeatureValue; key: FilterKey; emoji: string }[] = [
  { value: "pool-in", key: "poolIn", emoji: "🏊" },
  { value: "pool-out", key: "poolOut", emoji: "🌊" },
  { value: "casino", key: "casino", emoji: "🎰" },
  { value: "casino-near", key: "casinoNear", emoji: "🎰" },
  { value: "waterpark", key: "waterpark", emoji: "🛝" },
  { value: "spa", key: "spa", emoji: "🧖" },
  { value: "outside-center", key: "outsideCenter", emoji: "📍" },
];

const chipClass =
  "rounded-full border border-border aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-brand-foreground";
const NO_SPINNER =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/**
 * Editor dialog for a single hotel's curated fields: name, star rating
 * (single-pick), Booking score, board basis + amenities (pick lists), and the
 * Booking + website links. Address, Google rating and distances are left alone
 * (auto-managed). Initialised from the already-loaded ViewHotel.
 */
export function HotelEditDialog({ hotel, onClose }: { hotel: ViewHotel; onClose: () => void }) {
  const t = useTranslations("hotels");
  const router = useRouter();

  const [name, setName] = useState(hotel.name);
  const [stars, setStars] = useState<number | null>(hotel.stars);
  const [bookingScore, setBookingScore] = useState(hotel.bookingScore == null ? "" : String(hotel.bookingScore));
  const [boards, setBoards] = useState<BoardCode[]>(hotel.boards);
  const [features, setFeatures] = useState<HotelFeatureValue[]>(hotel.features);
  const [bookingUrl, setBookingUrl] = useState(hotel.bookingUrl ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(hotel.websiteUrl ?? "");
  const [saving, setSaving] = useState(false);

  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  async function save() {
    if (saving) return;
    if (!name.trim()) return toast.error(t("edit.nameRequired"));
    const scoreTrim = bookingScore.trim();
    const score = scoreTrim === "" ? null : Number(scoreTrim);
    if (score != null && (!Number.isFinite(score) || score < 0 || score > 10)) {
      return toast.error(t("edit.badScore"));
    }
    setSaving(true);
    const res = await updateHotelAction(Number(hotel.id), {
      name: name.trim(),
      stars,
      bookingScore: score,
      boards,
      features,
      bookingUrl: bookingUrl.trim() || null,
      websiteUrl: websiteUrl.trim() || null,
    });
    setSaving(false);
    if ("error" in res) {
      toast.error(res.error === "forbidden" ? t("edit.forbidden") : t("edit.saveFailed"));
      return;
    }
    toast.success(t("edit.saved"));
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("edit.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("edit.title")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto pe-1">
          {/* Name */}
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">{t("edit.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {/* Stars (single) + Booking score */}
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">{t("edit.stars")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {STAR_OPTIONS.map((n) => (
                  <Toggle
                    key={n}
                    pressed={stars === n}
                    onPressedChange={() => setStars(stars === n ? null : n)}
                    size="sm"
                    className={`${chipClass} tabular-nums`}>
                    {n} <Star className="size-3 fill-gold text-gold" />
                  </Toggle>
                ))}
              </div>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">{t("edit.bookingScore")}</Label>
              <Input
                type="number"
                inputMode="decimal"
                step={0.1}
                min={0}
                max={10}
                dir="ltr"
                value={bookingScore}
                placeholder="8.9"
                onChange={(e) => setBookingScore(e.target.value)}
                className={`h-9 w-24 text-end ${NO_SPINNER}`}
              />
            </div>
          </div>

          {/* Board basis */}
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">{t("edit.boards")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {BOARDS.map((b) => (
                <Toggle
                  key={b.value}
                  pressed={boards.includes(b.value)}
                  onPressedChange={() => setBoards(toggle(boards, b.value))}
                  size="sm"
                  className={chipClass}>
                  {b.emoji} {t(`board.${b.value}`)}
                </Toggle>
              ))}
            </div>
          </div>

          {/* Amenities */}
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">{t("edit.amenities")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {AMENITIES.map((f) => (
                <Toggle
                  key={f.value}
                  pressed={features.includes(f.value)}
                  onPressedChange={() => setFeatures(toggle(features, f.value))}
                  size="sm"
                  className={chipClass}>
                  {f.emoji} {t(`filter.${f.key}`)}
                </Toggle>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">{t("edit.bookingUrl")}</Label>
            <Input
              dir="ltr"
              value={bookingUrl}
              placeholder="https://www.booking.com/…"
              onChange={(e) => setBookingUrl(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">{t("edit.website")}</Label>
            <Input
              dir="ltr"
              value={websiteUrl}
              placeholder="https://…"
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={onClose}>
            <X className="size-4 text-destructive" /> {t("edit.cancel")}
          </Button>
          <Button type="button" size="sm" disabled={saving} onClick={save}>
            <Check className="size-4" /> {saving ? t("edit.saving") : t("edit.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
