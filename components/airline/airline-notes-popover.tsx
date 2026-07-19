"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { NotebookPen } from "lucide-react";
import { saveAirlineNotesAction } from "@/app/actions/airlines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Editor popover for an airline's two ⓘ notes — the suitcase note and the
 * commission note (e.g. explaining a "15/23" bag or a "0%/5%" commission). The
 * inline pencil handles the figures; this handles the free-text tooltips, and
 * works for every row (seed + custom), unlike the full add/edit dialog.
 */
export function AirlineNotesPopover({
  slug,
  suitcaseNote,
  commissionNote,
  disabled,
}: {
  slug: string;
  suitcaseNote: string;
  commissionNote: string;
  disabled?: boolean;
}) {
  const t = useTranslations("baggage.form");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [suitcase, setSuitcase] = useState(suitcaseNote);
  const [commission, setCommission] = useState(commissionNote);
  const [saving, setSaving] = useState(false);

  function onOpenChange(next: boolean) {
    if (next) {
      // Re-sync drafts from the row each time it opens.
      setSuitcase(suitcaseNote);
      setCommission(commissionNote);
    }
    setOpen(next);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    const res = await saveAirlineNotesAction(slug, {
      info: suitcase,
      commissionInfo: commission,
    });
    setSaving(false);
    if ("error" in res) {
      toast.error(t("saveFailed"));
      return;
    }
    toast.success(t("saved"));
    setOpen(false);
    router.refresh();
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={t("editNotes")}
                  disabled={disabled}
                />
              }
            />
          }>
          <NotebookPen className="size-4" />
        </TooltipTrigger>
        <TooltipContent>{t("editNotes")}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">{t("suitcaseNote")}</Label>
          <Input
            value={suitcase}
            onChange={(e) => setSuitcase(e.target.value)}
            placeholder={t("suitcaseNotePlaceholder")}
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">{t("commissionNote")}</Label>
          <Input
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            placeholder={t("commissionNotePlaceholder")}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={saving}>
            {saving ? <Spinner className="size-4" /> : t("save")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
