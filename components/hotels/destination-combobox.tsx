"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronsUpDown, MapPin, X } from "lucide-react";
import { type DestinationSummary } from "@/lib/hotels";
import { smartNormalize, smartScore } from "@/lib/search";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CountryFlag } from "@/components/country-flag";
import { useHotelParams } from "./use-hotel-params";

/** Group destinations by country, preserving first-appearance order. */
function groupByCountry(destinations: DestinationSummary[]) {
  const groups = new Map<
    string,
    { country: string; countryCode: string; cities: DestinationSummary[] }
  >();
  for (const d of destinations) {
    const g = groups.get(d.countryCode);
    if (g) g.cities.push(d);
    else
      groups.set(d.countryCode, {
        country: d.country,
        countryCode: d.countryCode,
        cities: [d],
      });
  }
  return [...groups.values()];
}

export function DestinationCombobox({ destinations }: { destinations: DestinationSummary[] }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("hotels");
  const { dest, update } = useHotelParams();

  const selected = destinations.find((d) => d.iata === dest) ?? null;
  const countries = groupByCountry(destinations);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative w-full max-w-xl">
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              className={`w-full justify-between ${selected ? "pe-8" : "pe-1"}`}
              size="lg"
            />
          }>
          <span className="flex items-center gap-2">
            <MapPin className="size-4 text-brand" />
            {selected ? (
              <span className="flex items-center gap-1.5">
                <CountryFlag code={selected.countryCode} />
                {selected.name}
                <span className="text-muted-foreground">· {selected.country}</span>
              </span>
            ) : (
              t("destinationPlaceholder")
            )}
          </span>
          <span className="rounded-lg p-1.5">
            <ChevronsUpDown className="size-4 opacity-50" />
          </span>
        </PopoverTrigger>
        {selected && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("clearDestination")}
            className="absolute inset-e-1 top-1 text-muted-foreground hover:text-red-600"
            onClick={() => update({ dest: null, features: [], sort: "default" })}>
            <X className="size-4" />
          </Button>
        )}
      </div>
      <PopoverContent className="w-(--anchor-width) p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const score = smartScore(search, smartNormalize(itemValue));
            return score < 0 ? 0 : score;
          }}>
          <CommandInput placeholder={t("destinationPlaceholder")} />
          <CommandList>
            <CommandEmpty>{t("noResults")}</CommandEmpty>
            {countries.map((group) => (
              <CommandGroup
                key={group.countryCode}
                className="mb-1 **:[[cmdk-group-heading]]:sticky **:[[cmdk-group-heading]]:top-0 **:[[cmdk-group-heading]]:z-10 **:[[cmdk-group-heading]]:mb-1 **:[[cmdk-group-heading]]:bg-popover **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5"
                heading={
                  <span className="flex items-center gap-1.5 text-[0.68rem] leading-none font-bold tracking-wide text-muted-foreground uppercase">
                    <CountryFlag code={group.countryCode} className="h-3 w-4 shrink-0" />
                    {group.country}
                  </span>
                }>
                {group.cities.map((d) => (
                  <CommandItem
                    key={d.iata}
                    value={d.search}
                    data-checked={dest === d.iata}
                    className="ps-4"
                    onSelect={() => {
                      update({ dest: d.iata, features: [], sort: "default" });
                      setOpen(false);
                    }}>
                    <Badge
                      variant="outline"
                      className="w-8 shrink-0 rounded-sm border-brand/35 bg-brand/10 px-0 text-[0.65rem] font-semibold tracking-wide text-brand">
                      {d.iata}
                    </Badge>
                    {d.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
