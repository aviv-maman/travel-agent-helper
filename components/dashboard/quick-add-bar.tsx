"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { TaskTypeValue } from "./types";
import { createTaskAction } from "@/app/actions/dashboard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const TYPES: TaskTypeValue[] = ["task", "awaiting_supplier", "client_followup", "reminder"];

/**
 * Sticky quick-add. Title + type on the first row; the optional client / phone /
 * supplier / order-number fields are always visible for fast capture.
 */
export function QuickAddBar() {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskTypeValue>("task");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [orderNumber, setOrderNumber] = useState("");

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
        supplierName: supplierName || null,
        orderNumber: orderNumber || null,
      });
      if ("error" in res) {
        toast.error(t("offline"));
        return;
      }
      toast.success(t("quickAdd.added"));
      reset();
      router.refresh();
    });
  }

  return (
    <section className="sticky top-14 z-30 flex flex-col gap-2.5 rounded-2xl border border-border/70 bg-background/80 p-3 shadow-sm ring-1 ring-foreground/5 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={t("quickAdd.placeholder")}
          aria-label={t("quickAdd.title")}
          className="h-9 flex-1"
        />
        <NativeSelect
          value={type}
          onChange={(e) => setType(e.target.value as TaskTypeValue)}
          aria-label={t("quickAdd.type")}
          className="shrink-0">
          {TYPES.map((ty) => (
            <NativeSelectOption key={ty} value={ty}>
              {t(`types.${ty}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button
          size="icon"
          onClick={submit}
          disabled={pending || !title.trim()}
          aria-label={t("quickAdd.add")}>
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder={t("quickAdd.client")}
          className="h-9"
        />
        <Input
          value={clientPhone}
          onChange={(e) => setClientPhone(e.target.value)}
          placeholder={t("quickAdd.phone")}
          inputMode="tel"
          className="h-9"
        />
        <Input
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
          placeholder={t("quickAdd.supplier")}
          className="h-9"
        />
        <Input
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder={t("quickAdd.order")}
          className="h-9"
        />
      </div>
    </section>
  );
}
