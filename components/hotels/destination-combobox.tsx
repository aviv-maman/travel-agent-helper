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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

export function DestinationCombobox({
  destinations,
}: {
  destinations: DestinationSummary[];
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("hotels");
  const { dest, update } = useHotelParams();

  const selected = destinations.find((d) => d.iata === dest) ?? null;
  const countries = groupByCountry(destinations);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="w-full max-w-xl justify-between"
          />
        }
      >
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
          }}
        >
          <CommandInput placeholder={t("destinationPlaceholder")} />
          <CommandList>
            <CommandEmpty>{t("noResults")}</CommandEmpty>
            {countries.map((group) => (
              <CommandGroup
                key={group.countryCode}
                heading={
                  <span className="flex items-center gap-1.5">
                    <CountryFlag code={group.countryCode} />
                    {group.country}
                  </span>
                }
              >
                {group.cities.map((d) => (
                  <CommandItem
                    key={d.iata}
                    value={d.search}
                    onSelect={() => {
                      update({ dest: d.iata, features: [], sort: "default" });
                      setOpen(false);
                    }}
                  >
                    <span className="w-5 shrink-0 text-[0.7rem] font-medium text-muted-foreground">
                      {d.iata}
                    </span>
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
