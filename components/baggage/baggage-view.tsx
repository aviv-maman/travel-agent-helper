"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { FilterFn } from "@tanstack/react-table";
import { Info } from "lucide-react";
import type { ViewAirline } from "@/lib/baggage";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { DataTable } from "@/components/ui/data-table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { airlineColumns } from "./baggage-columns";

// Match the search box against the precomputed he + en + iata string.
const filterAirline: FilterFn<ViewAirline> = (row, _columnId, value) =>
  row.original.search.includes(String(value).toLowerCase());

export function BaggageView({ airlines }: { airlines: ViewAirline[] }) {
  const t = useTranslations("baggage");
  const columns = useMemo(() => airlineColumns(t), [t]);

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
