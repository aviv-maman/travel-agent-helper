"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ImageIcon, UploadCloud, X } from "lucide-react";
import type { CancelMarkup } from "@/db/schema";
import { PRODUCT_ORDER } from "@/lib/cancellations";
import {
  categoriesToSections,
  newSub,
  DEFAULT_MARKUP,
  type EditCategory,
} from "@/lib/cancellations-edit";
import { createCancellationSupplierAction } from "@/app/actions/cancellations";
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
import { CancellationSectionsEditor } from "./cancellation-sections-editor";

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LOGO_MAX = 2 * 1024 * 1024;

/**
 * Create a new cancellation supplier: step 1 collects the supplier itself
 * (logo + name + code + which products it sells), step 2 is the same
 * category/rows editor as editing. Saved atomically via
 * `createCancellationSupplierAction`.
 */
export function CancellationCreateWizard({
  signUrl,
  onClose,
}: {
  signUrl: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("cancellations");
  const locale = useLocale() as "he" | "en";
  const router = useRouter();
  const loc = (v: { he?: string; en?: string }) => (locale === "he" ? v.he : v.en) ?? "";

  const [step, setStep] = useState<"supplier" | "cancellations">("supplier");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Selected products, keyed by their (unique) Hebrew label.
  const [products, setProducts] = useState<Set<string>>(new Set());

  const [rule, setRule] = useState<CancelMarkup>(DEFAULT_MARKUP);
  const [cats, setCats] = useState<EditCategory[]>([{ heading: null, subs: [newSub()] }]);
  const [saving, setSaving] = useState(false);

  async function uploadLogo(file: File) {
    if (!signUrl) return toast.error(t("create.logoError"));
    if (!LOGO_TYPES.includes(file.type)) return toast.error(t("create.logoBadType"));
    if (file.size > LOGO_MAX) return toast.error(t("create.logoTooBig"));
    setUploading(true);
    try {
      const signRes = await fetch(`${signUrl}/sign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: "supplier-logo", contentType: file.type, size: file.size }),
      });
      if (!signRes.ok) return toast.error(t("create.logoError"));
      const { uploadUrl, contentType, publicUrl } = await signRes.json();
      const up = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      }).catch(() => null);
      if (!up || !up.ok) return toast.error(t("create.logoError"));
      setLogoUrl(publicUrl);
      toast.success(t("create.logoUploaded"));
    } catch {
      toast.error(t("create.logoError"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const toggleProduct = (key: string) =>
    setProducts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  function goNext() {
    if (!name.trim() || !code.trim()) return toast.error(t("create.fillRequired"));
    if (products.size === 0) return toast.error(t("create.needProduct"));
    setStep("cancellations");
  }

  async function create() {
    if (saving) return;
    const selected = PRODUCT_ORDER.filter((p) => products.has(p.label.he ?? ""));
    setSaving(true);
    const res = await createCancellationSupplierAction(
      { name: name.trim(), code: code.trim(), logoUrl, products: selected },
      rule,
      categoriesToSections(cats),
    );
    setSaving(false);
    if ("error" in res) {
      const key =
        res.error === "exists"
          ? "create.exists"
          : res.error === "forbidden"
            ? "edit.forbidden"
            : "create.failed";
      toast.error(t(key));
      return;
    }
    toast.success(t("create.created"));
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("create.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("create.title")}</DialogDescription>
        </DialogHeader>

        {step === "supplier" ? (
          <div className="flex flex-col gap-4 overflow-y-auto pe-1">
            {/* Logo (optional) */}
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-2">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" className="size-full object-contain" />
                ) : (
                  <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
                )}
              </span>
              <input
                ref={fileRef}
                type="file"
                accept={LOGO_TYPES.join(",")}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadLogo(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading || !signUrl}
                onClick={() => fileRef.current?.click()}>
                <UploadCloud className="size-4" />
                {uploading ? t("create.logoUploading") : t("create.logo")}
              </Button>
              {logoUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl(null)}>
                  {t("create.logoRemove")}
                </Button>
              )}
            </div>

            {/* Name (wide) + code (narrow). */}
            <div className="grid grid-cols-[2fr_1fr] gap-2">
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">
                  {t("create.name")} <span className="text-destructive">*</span>
                </Label>
                <Input dir="rtl" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">
                  {t("create.code")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  dir="ltr"
                  value={code}
                  placeholder="KAVEI"
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
            </div>

            {/* Product checklist. */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                {t("create.products")} <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {PRODUCT_ORDER.map((p) => {
                  const key = p.label.he ?? "";
                  const on = products.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleProduct(key)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                        on
                          ? "border-brand bg-brand text-brand-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}>
                      {loc(p.label)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <CancellationSectionsEditor rule={rule} setRule={setRule} cats={cats} setCats={setCats} />
        )}

        <DialogFooter>
          {step === "cancellations" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setStep("supplier")}
              className="me-auto">
              {t("create.back")}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={onClose}>
            <X className="size-4 text-destructive" /> {t("edit.cancel")}
          </Button>
          {step === "supplier" ? (
            <Button type="button" size="sm" onClick={goNext}>
              {t("create.next")}
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={saving} onClick={create}>
              <Check className="size-4" /> {saving ? t("create.creating") : t("create.create")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
