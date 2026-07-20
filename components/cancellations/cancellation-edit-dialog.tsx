"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Check } from "lucide-react";
import type { CancelBlock, CancelMarkup } from "@/db/schema";
import {
  blocksToSections,
  categoriesToSections,
  sectionsToCategories,
  DEFAULT_MARKUP,
  type EditCategory,
} from "@/lib/cancellations-edit";
import { saveCancellationAction } from "@/app/actions/cancellations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CancellationSectionsEditor } from "./cancellation-sections-editor";

/** A supplier's full cancellation card, edited category-by-category. Navigation:
 *  main category (heading) → sub-category (subheading) → the section's rows. */
export function CancellationEditDialog({
  slug,
  name,
  blocks,
  markup,
  onClose,
}: {
  slug: string;
  name: string;
  blocks: CancelBlock[];
  markup: CancelMarkup | null;
  onClose: () => void;
}) {
  const t = useTranslations("cancellations");
  const router = useRouter();
  const [rule, setRule] = useState<CancelMarkup>(markup ?? DEFAULT_MARKUP);
  const [cats, setCats] = useState<EditCategory[]>(() =>
    sectionsToCategories(blocksToSections(blocks)),
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);
    const res = await saveCancellationAction(slug, rule, categoriesToSections(cats));
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
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("edit.title", { name })}</DialogTitle>
          <DialogDescription className="sr-only">{t("edit.title", { name })}</DialogDescription>
        </DialogHeader>

        <CancellationSectionsEditor rule={rule} setRule={setRule} cats={cats} setCats={setCats} />

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
