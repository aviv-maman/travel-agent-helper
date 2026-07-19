"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ImageIcon, Trash2, UploadCloud } from "lucide-react";
import {
  airlineDraftAction,
  createAirlineAction,
  updateAirlineAction,
  deleteAirlineAction,
  type AirlineInput,
} from "@/app/actions/airlines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const EMPTY: AirlineInput = {
  nameHe: "",
  nameEn: "",
  iata: "",
  flag: "",
  kg: "",
  trolleyHe: "",
  trolleyEn: "",
  infoHe: "",
  infoEn: "",
  website: "",
  commission: "",
  logoUrl: null,
};

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LOGO_MAX = 2 * 1024 * 1024;

/** Add or edit an airline (all fields + logo). `slug` null = add mode. */
export function AirlineFormDialog({
  slug,
  signUrl,
  onClose,
}: {
  slug: string | null;
  signUrl: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("baggage.form");
  const router = useRouter();
  const isEdit = slug !== null;

  const [form, setForm] = useState<AirlineInput>(EMPTY);
  const [custom, setCustom] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Edit mode: pull the raw row once. (Async setState in .then — not the
  // synchronous-in-effect pattern eslint flags.)
  useEffect(() => {
    if (slug === null) return;
    let live = true;
    airlineDraftAction(slug).then((d) => {
      if (!live) return;
      if (d) {
        const { slug: _s, custom: c, ...rest } = d;
        setForm(rest);
        setCustom(c);
      }
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [slug]);

  const set = (patch: Partial<AirlineInput>) => setForm((f) => ({ ...f, ...patch }));

  async function uploadLogo(file: File) {
    if (!signUrl) return toast.error(t("logoNotConfigured"));
    if (!LOGO_TYPES.includes(file.type)) return toast.error(t("logoBadType"));
    if (file.size > LOGO_MAX) return toast.error(t("logoTooBig"));
    setUploading(true);
    try {
      const signRes = await fetch(`${signUrl}/sign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: "airline-logo", contentType: file.type, size: file.size }),
      });
      if (!signRes.ok) {
        if (signRes.status === 503) return toast.error(t("logoNotConfigured"));
        if (signRes.status === 401 || signRes.status === 403)
          return toast.error(t("logoForbidden"));
        return toast.error(t("logoError"));
      }
      const { uploadUrl, contentType, publicUrl } = await signRes.json();
      const up = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      }).catch(() => null);
      if (!up || !up.ok) return toast.error(t("logoUploadFailed"));
      set({ logoUrl: publicUrl });
      toast.success(t("logoUploaded"));
    } catch {
      toast.error(t("logoError"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit() {
    if (saving) return;
    if (!form.nameHe.trim() && !form.nameEn.trim()) return toast.error(t("nameRequired"));
    if (!form.kg.trim()) return toast.error(t("kgRequired"));
    if (!form.website.trim()) return toast.error(t("websiteRequired"));
    setSaving(true);
    const res = isEdit ? await updateAirlineAction(slug, form) : await createAirlineAction(form);
    setSaving(false);
    if ("error" in res) {
      toast.error(res.error === "invalid" ? t("invalid") : t("saveFailed"));
      return;
    }
    toast.success(isEdit ? t("saved") : t("created"));
    onClose();
    router.refresh();
  }

  async function remove() {
    if (slug === null) return;
    const res = await deleteAirlineAction(slug);
    if ("error" in res) {
      toast.error(t("saveFailed"));
      return;
    }
    toast.success(t("deleted"));
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[88vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? t("editTitle") : t("addTitle")}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto border-t border-border px-4 pt-3">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-2">
                {form.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logoUrl} alt="" className="size-full object-contain" />
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
                {form.logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => set({ logoUrl: null })}>
                    {t("logoRemove")}
                  </Button>
                )}
              </div>
            </div>

            {/* One name — stored for both locales (airline names read the same
                in he/en). Same for the trolley/note fields below. */}
            <Field label={t("name")}>
              <Input
                value={form.nameHe}
                onChange={(e) => set({ nameHe: e.target.value, nameEn: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-3 gap-2">
              <Field label={t("iata")}>
                <Input dir="ltr" value={form.iata} onChange={(e) => set({ iata: e.target.value })} />
              </Field>
              <Field label={t("flag")}>
                <Input
                  value={form.flag}
                  onChange={(e) => set({ flag: e.target.value })}
                  placeholder="🇮🇱"
                />
              </Field>
              <Field label={t("kg")}>
                <Input
                  dir="ltr"
                  value={form.kg}
                  onChange={(e) => set({ kg: e.target.value })}
                  placeholder="23"
                />
              </Field>
            </div>

            <Field label={t("trolley")}>
              <Input
                value={form.trolleyHe}
                onChange={(e) => set({ trolleyHe: e.target.value, trolleyEn: e.target.value })}
                placeholder='8 ק"ג'
              />
            </Field>

            <Field label={t("info")}>
              <Input
                value={form.infoHe}
                onChange={(e) => set({ infoHe: e.target.value, infoEn: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Field label={t("website")}>
                <Input
                  dir="ltr"
                  value={form.website}
                  onChange={(e) => set({ website: e.target.value })}
                  placeholder="https://…"
                />
              </Field>
              <Field label={t("commission")}>
                <Input
                  dir="ltr"
                  value={form.commission}
                  onChange={(e) => set({ commission: e.target.value })}
                  placeholder="0"
                  className="w-24"
                />
              </Field>
            </div>
          </div>
        )}

        <DialogFooter className="flex-row items-center justify-between gap-2">
          {isEdit && custom ? (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button type="button" variant="ghost" className="text-destructive" />
                }>
                <Trash2 className="size-4" /> {t("delete")}
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("deleteConfirm")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("deleteConfirmBody")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={remove}>
                    {t("delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="button" onClick={submit} disabled={saving || loading}>
              {saving ? t("saving") : t("save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
