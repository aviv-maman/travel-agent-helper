"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createSupplierAction } from "@/app/actions/suppliers";
import type { BaggageRow, SupplierCategory } from "@/db/schema";
import type { CommissionInput } from "@/lib/commissions";
import { newContactGroup, type ContactGroup } from "@/lib/contacts";
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
  const tc = useTranslations("commissions.contact");
  const router = useRouter();

  const [stepId, setStepId] = useState<StepId>("details");
  const [saving, setSaving] = useState(false);

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
            <SupplierDetailsFields
              category={category}
              onCategory={changeCategory}
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
          <Button
            type="button"
            variant="outline"
            onClick={idx === 0 ? onClose : goBack}
            disabled={saving}>
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
