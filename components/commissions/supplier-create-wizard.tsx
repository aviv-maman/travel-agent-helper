"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ImageIcon, UploadCloud } from "lucide-react";
import { createSupplierAction } from "@/app/actions/suppliers";
import type { BaggageRow, SupplierCategory } from "@/db/schema";
import type { CommissionInput } from "@/lib/commissions";
import { type ContactGroup } from "@/lib/contacts";
import {
  BaggageRows,
  CommissionRows,
  baggageDraftsToRows,
  commissionDraftsToInputs,
  newCommissionDraft,
  type BaggageDraft,
  type CommissionDraft,
} from "./supplier-inline-edit";
import { ContactEdit } from "./supplier-contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { newContactGroup } from "@/lib/contacts";

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

type StepId = "details" | "commissions" | "baggage" | "contacts";

/** Flights use the standard kinds; other categories use labeled "special" lines. */
function firstCommissionDraft(category: SupplierCategory): CommissionDraft {
  return category === "flights"
    ? newCommissionDraft([])
    : { kind: "custom", label: "", value: "" };
}

/**
 * Multi-step "Add supplier" wizard. Collects header (category/name/code/website/
 * logo), commissions, baggage (flights only), and optional contacts, then creates
 * the supplier atomically via `createSupplierAction`. Reuses the same row editors
 * as the inline card (`CommissionRows`/`BaggageRows`/`ContactEdit`).
 */
export function SupplierCreateWizard({
  defaultCategory,
  signUrl,
  onClose,
}: {
  defaultCategory: SupplierCategory;
  signUrl: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("commissions.create");
  const te = useTranslations("commissions.editor");
  const tCat = useTranslations("commissions.categories");
  const tc = useTranslations("commissions.contact");
  const router = useRouter();

  const [stepId, setStepId] = useState<StepId>("details");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 1 — details.
  const [category, setCategory] = useState<SupplierCategory>(defaultCategory);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  // Steps 2–4 — drafts (reuse the inline editors' shapes).
  const [commissions, setCommissions] = useState<CommissionDraft[]>(() => [
    firstCommissionDraft(defaultCategory),
  ]);
  const [baggage, setBaggage] = useState<BaggageDraft[]>([]);
  const [contactsDraft, setContactsDraft] = useState<ContactGroup[]>([]);

  const isFlights = category === "flights";

  /** Category drives the commission model — reset the lines to a fresh default. */
  function changeCategory(next: SupplierCategory) {
    setCategory(next);
    setCommissions([firstCommissionDraft(next)]);
  }
  // Baggage step only for the main (flights) category.
  const order: StepId[] = isFlights
    ? ["details", "commissions", "baggage", "contacts"]
    : ["details", "commissions", "contacts"];
  const idx = order.indexOf(stepId);
  const isLast = idx === order.length - 1;

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
      setLogoUrl(publicUrl);
      toast.success(t("logoUploaded"));
    } catch {
      toast.error(t("logoError"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /** Validate the current step; returns an error message or null. */
  function validateStep(id: StepId): string | null {
    if (id === "details") {
      if (!name.trim() || !code.trim() || !website.trim()) return t("fillRequired");
    } else if (id === "commissions") {
      const res = commissionDraftsToInputs(commissions);
      if ("error" in res) return te(res.error);
      if (res.rows.length === 0) return t("needCommission");
    } else if (id === "baggage") {
      const res = baggageDraftsToRows(baggage);
      if ("error" in res) return te(res.error);
      if (res.rows.length === 0) return t("needBaggage");
    }
    return null;
  }

  function goNext() {
    const msg = validateStep(stepId);
    if (msg) {
      toast.error(msg);
      return;
    }
    setStepId(order[idx + 1]);
  }

  function goBack() {
    setStepId(order[idx - 1]);
  }

  /** Re-validate everything and assemble the create payload. */
  function buildPayload():
    | { commissions: CommissionInput[]; baggage: BaggageRow[] }
    | { message: string } {
    const c = commissionDraftsToInputs(commissions);
    if ("error" in c) return { message: te(c.error) };
    if (c.rows.length === 0) return { message: t("needCommission") };
    let bag: BaggageRow[] = [];
    if (isFlights) {
      const b = baggageDraftsToRows(baggage);
      if ("error" in b) return { message: te(b.error) };
      if (b.rows.length === 0) return { message: t("needBaggage") };
      bag = b.rows;
    }
    return { commissions: c.rows, baggage: bag };
  }

  async function submit() {
    if (saving) return;
    if (!name.trim() || !code.trim() || !website.trim()) {
      setStepId("details");
      return toast.error(t("fillRequired"));
    }
    const payload = buildPayload();
    if ("message" in payload) return toast.error(payload.message);
    setSaving(true);
    const res = await createSupplierAction({
      category,
      name,
      code,
      website,
      logoUrl,
      commissions: payload.commissions,
      baggage: payload.baggage,
      contacts: contactsDraft,
    });
    setSaving(false);
    if ("error" in res) {
      toast.error(t("createFailed"));
      return;
    }
    toast.success(t("created"));
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[88vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("title")}</DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          {order.map((id, i) => (
            <span key={id} className="flex items-center gap-1.5">
              <span
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${
                  i === idx
                    ? "bg-brand/15 text-brand"
                    : i < idx
                      ? "text-success"
                      : "text-muted-foreground"
                }`}>
                <span className="tabular-nums">{i + 1}</span>
                {t(
                  id === "details"
                    ? "stepDetails"
                    : id === "commissions"
                      ? "stepCommissions"
                      : id === "baggage"
                        ? "stepBaggage"
                        : "stepContacts",
                )}
              </span>
              {i < order.length - 1 && <span className="text-border">›</span>}
            </span>
          ))}
        </div>

        <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto border-t border-border px-4 pt-3">
          {stepId === "details" && (
            <>
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">{t("category")}</Label>
                <Select
                  value={category}
                  onValueChange={(v) => changeCategory(v as SupplierCategory)}
                  items={Object.fromEntries(
                    CATEGORY_OPTS.map((o) => [o.value, `${o.emoji} ${tCat(o.key)}`]),
                  )}>
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
                    <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl(null)}>
                      {t("logoRemove")}
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">
                  {t("name")} <span className="text-destructive">*</span>
                </Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">
                    {t("code")} <span className="text-destructive">*</span>
                  </Label>
                  <Input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Kavei" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">
                    {t("website")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    dir="ltr"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
              </div>
            </>
          )}

          {stepId === "commissions" && (
            <div className="flex flex-col gap-2">
              <CommissionRows
                drafts={commissions}
                setDrafts={setCommissions}
                customOnly={!isFlights}
              />
            </div>
          )}

          {stepId === "baggage" && (
            <div className="flex flex-col gap-2">
              <BaggageRows drafts={baggage} setDrafts={setBaggage} />
            </div>
          )}

          {stepId === "contacts" && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">{t("contactsOptional")}</p>
              <ContactEdit
                contacts={contactsDraft}
                updateContact={(i, patch) =>
                  setContactsDraft((d) => d.map((g, idx2) => (idx2 === i ? { ...g, ...patch } : g)))
                }
                addContact={() => setContactsDraft((d) => [...d, newContactGroup("agent-support")])}
                removeContact={(i) => setContactsDraft((d) => d.filter((_, idx2) => idx2 !== i))}
                t={tc}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2">
          <Button type="button" variant="outline" onClick={idx === 0 ? onClose : goBack} disabled={saving}>
            {idx === 0 ? tc("cancel") : t("back")}
          </Button>
          {isLast ? (
            <Button type="button" onClick={submit} disabled={saving}>
              {saving ? <Spinner className="size-4" /> : t("create")}
            </Button>
          ) : (
            <Button type="button" onClick={goNext}>
              {t("next")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
