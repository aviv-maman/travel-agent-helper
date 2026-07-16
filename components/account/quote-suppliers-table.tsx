"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { QuoteSupplier } from "@/db/schema";
import {
  deleteQuoteSupplierAction,
  saveQuoteSupplierAction,
  type QuoteSupplierInput,
} from "@/app/actions/quote-suppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * The AI quote assistant's supplier-commission table, editable in place: one
 * row at a time flips to inputs via the pencil (no dialog), plus add/delete.
 * Percent cells are entered bare ("7.5") — the % is display-only; baggage
 * cells use the sheet grammar the AI already understands ("כלול" / "130$").
 */

const EMPTY: QuoteSupplierInput = {
  nameEn: "",
  nameHe: "",
  baggageSuitcase: "",
  baggageTrolley: "",
  netFlightNoStar: "",
  netFlightStar: "",
  netPackageNoStar: "",
  netPackageStar: "",
  notes: "",
};

const PCT_KEYS = [
  "netFlightNoStar",
  "netFlightStar",
  "netPackageNoStar",
  "netPackageStar",
] as const;

function toInput(r: QuoteSupplier): QuoteSupplierInput {
  return {
    nameEn: r.nameEn,
    nameHe: r.nameHe,
    baggageSuitcase: r.baggageSuitcase ?? "",
    baggageTrolley: r.baggageTrolley ?? "",
    netFlightNoStar: r.netFlightNoStar ?? "",
    netFlightStar: r.netFlightStar ?? "",
    netPackageNoStar: r.netPackageNoStar ?? "",
    netPackageStar: r.netPackageStar ?? "",
    notes: r.notes,
  };
}

export function QuoteSuppliersTable({ rows }: { rows: QuoteSupplier[] }) {
  const t = useTranslations("quoteCommissions");
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<QuoteSupplierInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QuoteSupplier | null>(null);

  const set = (patch: Partial<QuoteSupplierInput>) => setDraft((d) => ({ ...d, ...patch }));

  async function save() {
    if (editingId === null || saving) return;
    if (!draft.nameEn.trim()) {
      toast.error(t("nameRequired"));
      return;
    }
    for (const key of PCT_KEYS) {
      const s = draft[key].trim().replace(/%$/, "").trim();
      if (s && (!/^\d{1,3}(?:\.\d{1,2})?$/.test(s) || Number(s) > 100)) {
        toast.error(t("invalidPercent"));
        return;
      }
    }
    setSaving(true);
    const res = await saveQuoteSupplierAction(editingId === "new" ? null : editingId, draft);
    setSaving(false);
    if ("error" in res) {
      toast.error(t("saveFailed"));
      return;
    }
    toast.success(t("saved"));
    setEditingId(null);
    router.refresh();
  }

  async function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    const res = await deleteQuoteSupplierAction(target.id);
    setDeleteTarget(null);
    if ("error" in res) {
      toast.error(t("saveFailed"));
      return;
    }
    toast.success(t("deleted"));
    router.refresh();
  }

  const pctCell = (v: string | null) => (v ? `${v}%` : "—");

  /** A compact cell input; Enter saves, Escape cancels. */
  function cellInput(key: keyof QuoteSupplierInput, opts?: { dir?: "ltr" | "rtl"; wide?: boolean }) {
    return (
      <Input
        value={draft[key]}
        dir={opts?.dir ?? "ltr"}
        disabled={saving}
        aria-label={t(`col_${key}`)}
        onChange={(e) => set({ [key]: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            setEditingId(null);
          }
        }}
        className={`h-7 px-1.5 text-xs ${opts?.wide ? "min-w-32" : "min-w-16"}`}
      />
    );
  }

  function editorCells() {
    return (
      <>
        <TableCell className="p-1.5">{cellInput("nameEn", { wide: true })}</TableCell>
        <TableCell className="p-1.5">{cellInput("nameHe", { dir: "rtl", wide: true })}</TableCell>
        <TableCell className="p-1.5">{cellInput("baggageSuitcase", { dir: "rtl" })}</TableCell>
        <TableCell className="p-1.5">{cellInput("baggageTrolley", { dir: "rtl" })}</TableCell>
        <TableCell className="p-1.5">{cellInput("netFlightNoStar")}</TableCell>
        <TableCell className="p-1.5">{cellInput("netFlightStar")}</TableCell>
        <TableCell className="p-1.5">{cellInput("netPackageNoStar")}</TableCell>
        <TableCell className="p-1.5">{cellInput("netPackageStar")}</TableCell>
        <TableCell className="p-1.5">{cellInput("notes", { dir: "rtl", wide: true })}</TableCell>
        <TableCell className="p-1.5 whitespace-nowrap">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("save")}
            disabled={saving}
            onClick={save}>
            <Check className="size-4 text-success" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("cancel")}
            disabled={saving}
            onClick={() => setEditingId(null)}>
            <X className="size-4 text-destructive" />
          </Button>
        </TableCell>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table className="min-w-[64rem] text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">{t("col_nameEn")}</TableHead>
              <TableHead className="whitespace-nowrap">{t("col_nameHe")}</TableHead>
              <TableHead className="whitespace-nowrap">{t("col_baggageSuitcase")}</TableHead>
              <TableHead className="whitespace-nowrap">{t("col_baggageTrolley")}</TableHead>
              <TableHead className="whitespace-nowrap">{t("col_netFlightNoStar")}</TableHead>
              <TableHead className="whitespace-nowrap">{t("col_netFlightStar")}</TableHead>
              <TableHead className="whitespace-nowrap">{t("col_netPackageNoStar")}</TableHead>
              <TableHead className="whitespace-nowrap">{t("col_netPackageStar")}</TableHead>
              <TableHead className="whitespace-nowrap">{t("col_notes")}</TableHead>
              <TableHead className="whitespace-nowrap">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) =>
              editingId === r.id ? (
                <TableRow key={r.id}>{editorCells()}</TableRow>
              ) : (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell dir="ltr" className="whitespace-nowrap text-center text-foreground">
                    {r.nameEn}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{r.nameHe || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-center">{r.baggageSuitcase ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-center">{r.baggageTrolley ?? "—"}</TableCell>
                  <TableCell dir="ltr" className="text-center">{pctCell(r.netFlightNoStar)}</TableCell>
                  <TableCell dir="ltr" className="text-center">{pctCell(r.netFlightStar)}</TableCell>
                  <TableCell dir="ltr" className="text-center">{pctCell(r.netPackageNoStar)}</TableCell>
                  <TableCell dir="ltr" className="text-center">{pctCell(r.netPackageStar)}</TableCell>
                  {/* Notes wrap in full — clamping hid the destination/season
                      exceptions, which are exactly what tells twin rows apart. */}
                  <TableCell className="min-w-56 whitespace-normal">
                    {r.notes || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("edit")}
                      disabled={editingId !== null}
                      onClick={() => {
                        setDraft(toInput(r));
                        setEditingId(r.id);
                      }}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("delete")}
                      disabled={editingId !== null}
                      onClick={() => setDeleteTarget(r)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ),
            )}
            {editingId === "new" && <TableRow>{editorCells()}</TableRow>}
          </TableBody>
        </Table>
      </div>

      {editingId === null && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            setDraft(EMPTY);
            setEditingId("new");
          }}>
          <Plus className="size-4" /> {t("addRow")}
        </Button>
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { name: deleteTarget?.nameEn ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
