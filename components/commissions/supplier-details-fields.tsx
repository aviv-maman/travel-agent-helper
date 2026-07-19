"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ImageIcon, UploadCloud } from "lucide-react";
import type { SupplierCategory } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORY_OPTS: {
  value: SupplierCategory;
  key: "main" | "hotels" | "carRental" | "insurance";
  emoji: string;
}[] = [
  { value: "flights", key: "main", emoji: "✈️" },
  { value: "hotels", key: "hotels", emoji: "🏨" },
  { value: "car-rental", key: "carRental", emoji: "🚗" },
  { value: "insurance", key: "insurance", emoji: "🛡️" },
];

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LOGO_MAX = 2 * 1024 * 1024;

/**
 * The supplier "details" fields (category + logo + name + code + website), shared
 * by the create wizard and the header edit dialog. Handles the logo presigned-PUT
 * upload internally. Layout: name (wide) beside a narrow code, then a full-width
 * website (URLs are long).
 */
export function SupplierDetailsFields({
  category,
  onCategory,
  name,
  onName,
  code,
  onCode,
  website,
  onWebsite,
  logoUrl,
  onLogoUrl,
  signUrl,
}: {
  category: SupplierCategory;
  onCategory: (_c: SupplierCategory) => void;
  name: string;
  onName: (_v: string) => void;
  code: string;
  onCode: (_v: string) => void;
  website: string;
  onWebsite: (_v: string) => void;
  logoUrl: string | null;
  onLogoUrl: (_url: string | null) => void;
  signUrl: string | null;
}) {
  const t = useTranslations("commissions.create");
  const tCat = useTranslations("commissions.categories");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadLogo(file: File) {
    if (!signUrl) return toast.error(t("logoError"));
    if (!LOGO_TYPES.includes(file.type)) return toast.error(t("logoBadType"));
    if (file.size > LOGO_MAX) return toast.error(t("logoTooBig"));
    setUploading(true);
    try {
      const signRes = await fetch(`${signUrl}/sign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: "supplier-logo", contentType: file.type, size: file.size }),
      });
      if (!signRes.ok) return toast.error(t("logoError"));
      const { uploadUrl, contentType, publicUrl } = await signRes.json();
      const up = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      }).catch(() => null);
      if (!up || !up.ok) return toast.error(t("logoError"));
      onLogoUrl(publicUrl);
      toast.success(t("logoUploaded"));
    } catch {
      toast.error(t("logoError"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">{t("category")}</Label>
        <Select
          value={category}
          onValueChange={(v) => onCategory(v as SupplierCategory)}
          items={Object.fromEntries(CATEGORY_OPTS.map((o) => [o.value, `${o.emoji} ${tCat(o.key)}`]))}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.emoji} {tCat(o.key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
        <div className="flex items-center gap-2">
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
            {uploading ? t("logoUploading") : t("logo")}
          </Button>
          {logoUrl && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onLogoUrl(null)}>
              {t("logoRemove")}
            </Button>
          )}
        </div>
      </div>

      {/* Name (wide) + Code (narrow) share a row; website is full width below. */}
      <div className="grid grid-cols-[2fr_1fr] gap-2">
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">
            {t("name")} <span className="text-destructive">*</span>
          </Label>
          <Input value={name} onChange={(e) => onName(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">
            {t("code")} <span className="text-destructive">*</span>
          </Label>
          <Input dir="ltr" value={code} onChange={(e) => onCode(e.target.value)} placeholder="Kavei" />
        </div>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">
          {t("website")} <span className="text-destructive">*</span>
        </Label>
        <Input
          dir="ltr"
          value={website}
          onChange={(e) => onWebsite(e.target.value)}
          placeholder="https://…"
        />
      </div>
    </>
  );
}
