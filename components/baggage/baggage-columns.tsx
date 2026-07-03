"use client";

import { useState } from "react";
import Image from "next/image";
import type { ColumnDef } from "@tanstack/react-table";
import { Info } from "lucide-react";
import { useLocale, type useTranslations } from "next-intl";
import type { WeightTier, ViewAirline } from "@/lib/baggage";
import { CountryFlag } from "@/components/country-flag";
import { DataTableColumnHeader } from "@/components/ui/data-table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AirlineActions } from "./airline-actions";

const AIRLINE_PLACEHOLDER_LOGO = "/airlines/placeholder-logo.svg";

/** Airline logo with a placeholder fallback if the file is missing (load error). */
function AirlineLogo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2 ring-1 ring-border/50">
      <Image
        src={failed ? AIRLINE_PLACEHOLDER_LOGO : src}
        alt=""
        width={32}
        height={32}
        className="size-full object-contain"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

const TIER: Record<WeightTier, string> = {
  kg23: "bg-success/[0.12] text-success",
  kg20: "bg-brand/[0.12] text-brand",
};

// Trolley badge — same chip style as the suitcase weight, in a non-green tone.
const TROLLEY_CHIP = "bg-gold/[0.12] text-gold";

// Commission badge — same chip style; red when 0% (no commission), blue otherwise.
const COMMISSION_CHIP: Record<"zero" | "some", string> = {
  zero: "bg-destructive/[0.12] text-destructive",
  some: "bg-brand/[0.12] text-brand",
};

type T = ReturnType<typeof useTranslations<"baggage">>;

/** Airline name followed by its country flag, with the country name on hover. */
function AirlineNameCell({ airline }: { airline: ViewAirline }) {
  const locale = useLocale();
  const country = airline.code
    ? new Intl.DisplayNames([locale], { type: "region" }).of(airline.code.toUpperCase())
    : null;
  return (
    <span className="flex items-center gap-1.5">
      {airline.iata && (
        <span className="inline-block shrink-0 rounded border border-brand/25 bg-brand/10 px-1.5 font-mono text-[0.68rem] font-extrabold tracking-wide text-brand">
          {airline.iata}
        </span>
      )}
      <span className="text-sm font-medium text-foreground">{airline.name}</span>
      {airline.code &&
        (country ? (
          <Tooltip>
            <TooltipTrigger className="inline-flex cursor-help">
              <CountryFlag code={airline.code} />
            </TooltipTrigger>
            <TooltipContent>{country}</TooltipContent>
          </Tooltip>
        ) : (
          <CountryFlag code={airline.code} />
        ))}
    </span>
  );
}

/** Build the airline DataTable columns, resolved against the active locale. */
export function airlineColumns(t: T): ColumnDef<ViewAirline>[] {
  return [
    {
      id: "logo",
      header: () => <span className="text-xs font-bold tracking-wide">{t("colLogo")}</span>,
      enableSorting: false,
      enableHiding: false,
      meta: { headerClassName: "w-px", cellClassName: "w-px" },
      cell: ({ row }) => <AirlineLogo src={row.original.logo} />,
    },
    {
      id: "name",
      accessorFn: (a) => a.name,
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("colAirline")} />,
      meta: { label: t("colAirline") },
      cell: ({ row }) => <AirlineNameCell airline={row.original} />,
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
      id: "commission",
      accessorFn: (a) => a.commissionSort,
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("colCommission")} />,
      meta: { label: t("colCommission") },
      cell: ({ row }) => (
        <span
          className={`inline-flex h-5 items-center rounded-md px-1.5 align-middle text-xs font-bold ${COMMISSION_CHIP[row.original.commissionTier]}`}>
          {row.original.commission}
        </span>
      ),
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
