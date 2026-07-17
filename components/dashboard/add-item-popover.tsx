"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { TaskTypeValue } from "./types";
import { createTaskAction } from "@/app/actions/dashboard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Per-section "add" — a ＋ in the section header opens a compact popover whose
 * fields are scoped to the section's type (the type is implied by the section,
 * so there's no picker). Submits straight into that section.
 */
export function AddItemPopover({ type }: { type: TaskTypeValue }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  // Supplier only makes sense for the awaiting-supplier section; client name +
  // phone are useful everywhere (the card shows them for any type).
  const showSupplier = type === "awaiting_supplier";

  function reset() {
    setTitle("");
    setClientName("");
    setClientPhone("");
    setSupplierName("");
    setOrderNumber("");
  }

  function submit() {
    const trimmed = title.trim();
    if (!trimmed || pending) return;
    startTransition(async () => {
      const res = await createTaskAction({
        title: trimmed,
        type,
        clientName: clientName || null,
        clientPhone: clientPhone || null,
        supplierName: showSupplier ? supplierName || null : null,
        orderNumber: orderNumber || null,
      });
      if ("error" in res) {
        toast.error(t("offline"));
        return;
      }
      toast.success(t("quickAdd.added"));
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-brand"
            aria-label={t("quickAdd.add")}
          />
        }>
        <Plus className="size-4" />
      </PopoverTrigger>
      {/* initialFocus (instead of autoFocus) focuses the field only after the
          popup is positioned — React's autoFocus fired while the portal was
          still at the document top, scrolling the page up and dismissing it. */}
      <PopoverContent align="end" initialFocus={titleRef} className="w-[min(20rem,90vw)]">
        <AddField label={t("quickAdd.titleLabel")}>
          <Input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder={t("quickAdd.placeholder")}
          />
        </AddField>

        {showSupplier && (
          <AddField label={t("quickAdd.supplier")}>
            <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          </AddField>
        )}

        <AddField label={t("quickAdd.client")}>
          <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </AddField>
        <AddField label={t("quickAdd.phone")}>
          <Input
            inputMode="tel"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
          />
        </AddField>

        <AddField label={t("quickAdd.order")}>
          <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
        </AddField>

        <Button size="sm" className="mt-0.5" onClick={submit} disabled={pending || !title.trim()}>
          <Plus className="size-3.5" />
          {t("quickAdd.add")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function AddField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
