"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { DashTask, TaskTypeValue } from "./types";
import { updateTaskAction } from "@/app/actions/dashboard";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const TYPES: TaskTypeValue[] = ["task", "awaiting_supplier", "client_followup", "reminder"];

/**
 * Edit an existing item. Mounted only while open (from TaskCard), so its fields
 * initialize fresh from the current task each time it opens.
 */
export function TaskEditDialog({ task, onClose }: { task: DashTask; onClose: () => void }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(task.title);
  const [type, setType] = useState<TaskTypeValue>(task.type);
  const [clientName, setClientName] = useState(task.clientName ?? "");
  const [clientPhone, setClientPhone] = useState(task.clientPhone ?? "");
  const [supplierName, setSupplierName] = useState(task.supplierName ?? "");
  const [orderNumber, setOrderNumber] = useState(task.orderNumber ?? "");
  const [notes, setNotes] = useState(task.notes ?? "");

  function close() {
    setOpen(false);
    onClose();
  }

  function save() {
    if (!title.trim() || pending) return;
    startTransition(async () => {
      const res = await updateTaskAction(task.id, {
        title,
        type,
        clientName,
        clientPhone,
        supplierName,
        orderNumber,
        notes,
      });
      if ("error" in res) {
        toast.error(t("offline"));
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("task.edit")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <EditField label={t("quickAdd.titleLabel")}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </EditField>
          <EditField label={t("quickAdd.type")}>
            <NativeSelect
              value={type}
              onChange={(e) => setType(e.target.value as TaskTypeValue)}
              className="w-full">
              {TYPES.map((ty) => (
                <NativeSelectOption key={ty} value={ty}>
                  {t(`types.${ty}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </EditField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <EditField label={t("quickAdd.client")}>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </EditField>
            <EditField label={t("quickAdd.phone")}>
              <Input
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                inputMode="tel"
              />
            </EditField>
            <EditField label={t("quickAdd.supplier")}>
              <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
            </EditField>
            <EditField label={t("quickAdd.order")}>
              <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
            </EditField>
          </div>
          <EditField label={t("quickAdd.notes")}>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </EditField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={pending}>
            {t("task.cancel")}
          </Button>
          <Button onClick={save} disabled={pending || !title.trim()}>
            {t("task.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
