"use client";

import Image from "next/image";
import type { ColumnDef } from "@tanstack/react-table";
import { Info } from "lucide-react";
import type { useTranslations } from "next-intl";
import type { WeightTier, ViewAirline } from "@/lib/baggage";
import { CountryFlag } from "@/components/country-flag";
import { DataTableColumnHeader } from "@/components/ui/data-table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AirlineActions } from "./airline-actions";

const AIRLINE_PLACEHOLDER_LOGO = "/airlines/placeholder-logo.svg";

const TIER: Record<WeightTier, string> = {
  kg23: "bg-success/[0.12] text-success",
  kg20: "bg-brand/[0.12] text-brand",
};

// Trolley badge — same chip style as the suitcase weight, in a non-green tone.
const TROLLEY_CHIP = "bg-gold/[0.12] text-gold";

type T = ReturnType<typeof useTranslations<"baggage">>;

/** Build the airline DataTable columns, resolved against the active locale. */
export function airlineColumns(t: T): ColumnDef<ViewAirline>[] {
  return [
    {
      id: "logo",
      header: () => <span className="text-xs font-bold tracking-wide">{t("colLogo")}</span>,
      enableSorting: false,
      enableHiding: false,
      meta: { headerClassName: "w-px", cellClassName: "w-px" },
      cell: ({ row }) => (
        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2 ring-1 ring-border/50">
          <Image
            src={row.original.logo ?? AIRLINE_PLACEHOLDER_LOGO}
            alt=""
            width={32}
            height={32}
            className="size-full object-contain"
          />
        </span>
      ),
    },
    {
      id: "name",
      accessorFn: (a) => a.name,
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("colAirline")} />,
      meta: { label: t("colAirline") },
      cell: ({ row }) => (
        <span
          className={`text-sm font-medium ${
            row.original.highlight ? "text-muted-foreground" : "text-foreground"
          }`}>
          {row.original.name}
        </span>
      ),
    },
    {
      id: "iata",
      accessorFn: (a) => a.iata ?? "",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("colIata")} />,
      meta: { label: t("colIata") },
      cell: ({ row }) =>
        row.original.iata ? (
          <span className="inline-block rounded border border-brand/25 bg-brand/10 px-1.5 font-mono text-[0.68rem] font-extrabold tracking-wide text-brand">
            {row.original.iata}
          </span>
        ) : null,
    },
    {
      id: "country",
      accessorFn: (a) => a.code ?? "",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("colCountry")} />,
      meta: { label: t("colCountry") },
      cell: ({ row }) => (row.original.code ? <CountryFlag code={row.original.code} /> : null),
    },
    {
      id: "luggage",
      accessorFn: (a) => a.weightSort,
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("colSuitcase")} />,
      meta: { label: t("colSuitcase") },
      cell: ({ row }) =>
        row.original.info ? (
          <Tooltip>
            <TooltipTrigger
              className={`inline-flex h-5 cursor-help items-center gap-1 rounded-md px-1.5 align-middle text-xs font-bold ${TIER[row.original.tier]}`}>
              {row.original.weight}
              <Info className="size-3.5 shrink-0" aria-hidden />
            </TooltipTrigger>
            <TooltipContent>{row.original.info}</TooltipContent>
          </Tooltip>
        ) : (
          <span
            className={`inline-flex h-5 items-center rounded-md px-1.5 align-middle text-xs font-bold ${TIER[row.original.tier]}`}>
            {row.original.weight}
          </span>
        ),
    },
    {
      id: "trolley",
      accessorFn: (a) => a.trolleySort,
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("colTrolley")} />,
      meta: { label: t("colTrolley") },
      cell: ({ row }) => {
        const { note, noteTone } = row.original;
        if (!note) return null;
        return noteTone === "gold" ? (
          <Tooltip>
            <TooltipTrigger
              className={`inline-flex h-5 cursor-help items-center justify-center rounded-md px-1.5 align-middle ${TROLLEY_CHIP}`}>
              <Info className="size-3.5 shrink-0" aria-hidden />
            </TooltipTrigger>
            <TooltipContent>{note}</TooltipContent>
          </Tooltip>
        ) : (
          <span
            className={`inline-flex h-5 items-center rounded-md px-1.5 align-middle text-xs font-bold ${TROLLEY_CHIP}`}>
            {note}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="text-xs font-bold tracking-wide">{t("colActions")}</span>,
      enableSorting: false,
      enableHiding: false,
      meta: { headerClassName: "w-px", cellClassName: "w-px" },
      cell: ({ row }) =>
        row.original.highlight ? null : (
          <AirlineActions
            id={row.original.id}
            name={row.original.name}
            website={row.original.website}
          />
        ),
    },
  ];
}
