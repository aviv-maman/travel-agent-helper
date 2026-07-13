"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { updateHotelBookingScore } from "@/app/actions/hotels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Editor+ inline control for a hotel's Booking.com score. Shows a pencil next to
 * the score badge; opens a small popover with a number field. Saves via the
 * `updateHotelBookingScore` server action and updates the displayed value
 * optimistically. Empty input clears the score.
 */
export function EditBookingScore({
  hotelId,
  value,
  onSaved,
}: {
  hotelId: number;
  value: number | null;
  onSaved: (_score: number | null) => void;
}) {
  const t = useTranslations("hotels.card");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    const trimmed = draft.trim();
    const score = trimmed === "" ? null : Number(trimmed);
    if (score != null && (!Number.isFinite(score) || score < 0 || score > 10)) {
      setError(true);
      return;
    }
    setError(false);
    startTransition(async () => {
      const res = await updateHotelBookingScore(hotelId, score);
      if ("ok" in res) {
        toast.success(t("scoreSaved"));
        onSaved(res.score);
        setOpen(false);
      } else {
        toast.error(t("scoreError"));
        setError(true);
      }
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDraft(value == null ? "" : String(value));
          setError(false);
        }
      }}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground"
            aria-label={t("editScore")}
          />
        }>
        <Pencil className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 gap-2 p-3">
        <p className="text-xs font-semibold text-foreground">{t("editScore")}</p>
        <Input
          type="number"
          step={0.1}
          min={0}
          max={10}
          inputMode="decimal"
          value={draft}
          placeholder={t("scorePlaceholder")}
          aria-invalid={error}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7"
            disabled={pending}
            onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" size="sm" className="h-7" disabled={pending} onClick={save}>
            {pending ? t("saving") : t("save")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
