"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateSupplierDetailsAction } from "@/app/actions/suppliers";
import type { SupplierCategory } from "@/db/schema";
import { SupplierDetailsFields } from "./supplier-details-fields";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export type SupplierDetailsInitial = {
  category: SupplierCategory;
  name: string;
  code: string;
  website: string;
  logoUrl: string | null;
};

/** Edit a supplier's header (name/code/website/category + logo) after creation. */
export function SupplierDetailsDialog({
  slug,
  initial,
  signUrl,
  open,
  onOpenChange,
}: {
  slug: string;
  initial: SupplierDetailsInitial;
  signUrl: string | null;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
}) {
  const t = useTranslations("commissions.create");
  const tc = useTranslations("commissions.contact");
  const router = useRouter();

  const [category, setCategory] = useState<SupplierCategory>(initial.category);
  const [name, setName] = useState(initial.name);
  const [code, setCode] = useState(initial.code);
  const [website, setWebsite] = useState(initial.website);
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl);
  const [saving, setSaving] = useState(false);

  function handleOpenChange(next: boolean) {
    if (next) {
      // Re-sync fields from the row each time it opens.
      setCategory(initial.category);
      setName(initial.name);
      setCode(initial.code);
      setWebsite(initial.website);
      setLogoUrl(initial.logoUrl);
    }
    onOpenChange(next);
  }

  async function save() {
    if (saving) return;
    if (!name.trim() || !code.trim() || !website.trim()) {
      return toast.error(t("fillRequired"));
    }
    setSaving(true);
    const res = await updateSupplierDetailsAction(slug, { category, name, code, website, logoUrl });
    setSaving(false);
    if ("error" in res) {
      toast.error(t("saveFailed"));
      return;
    }
    toast.success(t("saved"));
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription className="sr-only">{t("editTitle")}</DialogDescription>
        </DialogHeader>

        <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto border-t border-border px-4 pt-3">
          <SupplierDetailsFields
            category={category}
            onCategory={setCategory}
            name={name}
            onName={setName}
            code={code}
            onCode={setCode}
            website={website}
            onWebsite={setWebsite}
            logoUrl={logoUrl}
            onLogoUrl={setLogoUrl}
            signUrl={signUrl}
          />
        </div>

        <DialogFooter className="flex-row items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {tc("cancel")}
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? <Spinner className="size-4" /> : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
