"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { FilterFn } from "@tanstack/react-table";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { saveAirlineRowAction } from "@/app/actions/airlines";
import { FIGURE_RE, bareFigure } from "@/lib/airline-figures";
import type { ViewAirline } from "@/lib/airlines";
import type { SupplierContact } from "@/lib/contacts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DataTable } from "@/components/ui/data-table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { airlineColumns, type RowEdit } from "./airline-columns";

// Match the search box against the precomputed he + en + iata string.
const filterAirline: FilterFn<ViewAirline> = (row, _columnId, value) =>
  row.original.search.includes(String(value).toLowerCase());

export function AirlineView({
  airlines,
  contacts,
  canEditContacts,
}: {
  airlines: ViewAirline[];
  /** Shared contact records keyed by `air:{slug}` (server-fetched). */
  contacts: Record<string, SupplierContact>;
  canEditContacts: boolean;
}) {
  const t = useTranslations("baggage");
  const router = useRouter();

  // Inline row edit (suitcase / trolley / commission). One row at a time; the
  // draft is a stable scratch object written only from input events (the inputs
  // are uncontrolled) so typing doesn't rebuild the table. `initialTrolley`
  // detects "untouched" — a non-numeric trolley note ("depends on ticket") left
  // as-is is not overwritten.
  const [editing, setEditing] = useState<{ id: string; initialTrolley: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const draft = useMemo(() => ({ kg: "", trolley: "", commission: "" }), []);

  async function saveRow() {
    if (!editing || saving) return;
    const kg = bareFigure(draft.kg);
    const commission = bareFigure(draft.commission);
    const trolleyTouched = draft.trolley.trim() !== editing.initialTrolley.trim();
    const trolley = bareFigure(draft.trolley);
    if (
      !FIGURE_RE.test(kg) ||
      (commission !== "" && !FIGURE_RE.test(commission)) ||
      (trolleyTouched && trolley !== "" && !FIGURE_RE.test(trolley))
    ) {
      toast.error(t("numbersOnly"));
      return;
    }
    setSaving(true);
    const res = await saveAirlineRowAction(editing.id.replace(/^air:/, ""), {
      kg,
      commission,
      ...(trolleyTouched ? { trolley } : {}),
    });
    setSaving(false);
    if ("error" in res) {
      toast.error(t("rowSaveFailed"));
      return;
    }
    toast.success(t("rowSaved"));
    setEditing(null);
    router.refresh();
  }

  const edit: RowEdit | null = canEditContacts
    ? {
        editingId: editing?.id ?? null,
        saving,
        setDraft: (patch) => Object.assign(draft, patch),
        start: (a) => {
          Object.assign(draft, { kg: a.kgRaw, trolley: a.trolleyRaw, commission: a.commissionRaw });
          setEditing({ id: a.id, initialTrolley: a.trolleyRaw });
        },
        cancel: () => setEditing(null),
        save: saveRow,
      }
    : null;

  // `edit` is rebuilt every render; the cells only change when edit mode or
  // saving flips, so those are the deps instead.
  const columns = useMemo(
    () => airlineColumns(t, contacts, canEditContacts, edit),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, contacts, canEditContacts, editing, saving],
  );

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        <Alert variant="info">
          <Info />
          <AlertTitle>{t("introTitle")}</AlertTitle>
          <AlertDescription>
            <p className="leading-relaxed">
              {t.rich("intro", {
                strong: (chunks) => <strong className="font-bold">{chunks}</strong>,
                br: () => <br />,
              })}
            </p>
          </AlertDescription>
        </Alert>

        <Alert variant="warning">
          <Info />
          <AlertDescription>
            <p className="leading-relaxed">{t("commissionNote")}</p>
          </AlertDescription>
        </Alert>

        <DataTable
          columns={columns}
          data={airlines}
          globalFilterFn={filterAirline}
          initialSorting={[{ id: "name", desc: false }]}
          pageSizeOptions={[25, 50, 100]}
          initialPageSize={100}
          rowClassName={(a) => (a.highlight ? "bg-brand/[0.03]" : "")}
          labels={{
            search: t("searchPlaceholder"),
            clear: t("clear"),
            noResults: t("noResults"),
            columns: t("columns"),
            total: (count) => t("count", { total: count }),
            perPage: t("perPage"),
            page: (page, total) => t("page", { page, total }),
            prev: t("prev"),
            next: t("next"),
          }}
        />
      </div>
    </TooltipProvider>
  );
}
