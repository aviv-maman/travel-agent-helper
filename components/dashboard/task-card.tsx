"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2, Hash } from "lucide-react";
import type { DashTask } from "./types";
import { daysSince } from "@/lib/dashboard/dates";
import { completeTaskAction, reopenTaskAction, deleteTaskAction } from "@/app/actions/dashboard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TaskEditDialog } from "./task-edit-dialog";
import { PhoneActions } from "./phone-actions";

export function TaskCard({ task, handle }: { task: DashTask; handle?: React.ReactNode }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const done = task.status === "done";

  function toggle(checked: boolean) {
    startTransition(async () => {
      const res = checked ? await completeTaskAction(task.id) : await reopenTaskAction(task.id);
      if ("error" in res) {
        toast.error(t("offline"));
        return;
      }
      toast.success(t(checked ? "toasts.completed" : "toasts.reopened"));
      router.refresh();
    });
  }

  function remove() {
    setConfirmOpen(false);
    startTransition(async () => {
      const res = await deleteTaskAction(task.id);
      if ("error" in res) {
        toast.error(t("offline"));
        return;
      }
      toast.success(t("toasts.deleted"));
      router.refresh();
    });
  }

  // "Days waiting" for supplier follow-ups: <1d default, 1–2d orange, >2d red.
  const waiting = (() => {
    if (task.type !== "awaiting_supplier") return null;
    const d = daysSince(task.createdAt);
    const label =
      d === 0
        ? t("task.sentToday")
        : d === 1
          ? t("task.sentYesterday")
          : t("task.sentAgo", { days: d });
    const color = d === 0 ? "text-muted-foreground" : d <= 2 ? "text-warning" : "text-destructive";
    return { label, color };
  })();

  const hasMeta = Boolean(
    task.clientName || task.supplierName || task.orderNumber || waiting || task.clientPhone,
  );

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-border/70 bg-surface p-3 transition-colors hover:border-border">
      {handle}
      <Checkbox
        checked={done}
        onCheckedChange={(c) => toggle(Boolean(c))}
        disabled={pending}
        className="mt-0.5"
        aria-label={done ? t("task.reopen") : t("task.complete")}
      />

      {/* The whole text region is the edit trigger (the pencil was removed):
          click or Enter/Space opens edit, and it lights up on hover so the row
          reads as clickable. Interactive children (phone) stop propagation. */}
      <div
        role="button"
        tabIndex={0}
        aria-label={t("task.edit")}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setEditing(true);
          }
        }}
        className="-mx-1.5 -my-1 min-w-0 flex-1 cursor-pointer rounded-lg px-1.5 py-1 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50">
        <p
          className={`text-sm font-medium break-words ${
            done ? "text-muted-foreground line-through" : "text-foreground"
          }`}>
          {task.title}
        </p>

        {hasMeta && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
            {task.type === "awaiting_supplier" && task.supplierName && (
              <span className="font-semibold text-foreground">{task.supplierName}</span>
            )}
            {task.clientName && <span className="text-muted-foreground">{task.clientName}</span>}
            {task.orderNumber && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-brand/10 px-1.5 py-0.5 font-medium text-brand">
                <Hash className="size-3" aria-hidden />
                {task.orderNumber}
              </span>
            )}
            {waiting && <span className={`font-medium ${waiting.color}`}>{waiting.label}</span>}
            {task.clientPhone && (
              <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <PhoneActions phone={task.clientPhone} />
              </span>
            )}
          </div>
        )}

        {task.notes && (
          <p className="mt-1.5 text-xs whitespace-pre-wrap text-muted-foreground">{task.notes}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger
            render={<Button variant="ghost" size="icon-sm" aria-label={t("task.delete")} />}>
            <Trash2 className="size-4 text-destructive" />
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>{t("task.confirmDelete")}</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("task.cancel")}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={remove}>
                {t("task.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {editing && <TaskEditDialog task={task} onClose={() => setEditing(false)} />}
    </div>
  );
}
