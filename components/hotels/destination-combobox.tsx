"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { type DestinationSummary } from "@/lib/hotels";
import { smartNormalize, smartScore } from "@/lib/search";
import { cn } from "@/lib/utils";
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
      <PopoverTrigger
        render={<Button variant="outline" className="w-full max-w-xl justify-between" />}>
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
        <ChevronsUpDown className="size-4 opacity-50" />
      </PopoverTrigger>
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
                className="**:[[cmdk-group-heading]]:py-2"
                heading={
                  <span className="flex items-center gap-2">
                    <span className="flex w-8 shrink-0 justify-center">
                      <CountryFlag code={group.countryCode} />
                    </span>
                    {group.country}
                  </span>
                }>
                {group.cities.map((d) => (
                  <CommandItem
                    key={d.iata}
                    value={d.search}
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
                    <Check
                      className={cn(
                        "ms-auto size-4",
                        dest === d.iata ? "opacity-100" : "opacity-0",
                      )}
                    />
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
