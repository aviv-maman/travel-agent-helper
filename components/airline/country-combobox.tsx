"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronsUpDown } from "lucide-react";
import { buildCountries } from "@/lib/countries";
import { smartNormalize, smartScore } from "@/lib/search";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CountryFlag } from "@/components/country-flag";

/**
 * Searchable country picker for the airline form: the user types a country name
 * (Hebrew or English) instead of guessing an ISO code. `value`/`onChange` carry
 * the uppercase 2-letter code — the flag emoji is derived from it downstream.
 */
export function CountryCombobox({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (_code: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const t = useTranslations("baggage.form");
  const countries = useMemo(() => buildCountries(locale), [locale]);
  const selected = useMemo(
    () => countries.find((c) => c.code === value.toUpperCase()) ?? null,
    [countries, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-invalid={invalid}
            className="w-full justify-between font-normal"
          />
        }>
        <span className="flex items-center gap-2 truncate">
          {selected ? (
            <>
              <CountryFlag code={selected.code} />
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{t("countryPlaceholder")}</span>
          )}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const score = smartScore(search, smartNormalize(itemValue));
            return score < 0 ? 0 : score;
          }}>
          <CommandInput placeholder={t("countrySearch")} />
          <CommandList>
            <CommandEmpty>{t("countryEmpty")}</CommandEmpty>
            {countries.map((c) => (
              <CommandItem
                key={c.code}
                value={c.search}
                data-checked={selected?.code === c.code}
                onSelect={() => {
                  onChange(c.code);
                  setOpen(false);
                }}>
                <CountryFlag code={c.code} />
                <span className="truncate">{c.name}</span>
                <Badge
                  variant="outline"
                  className="ms-auto shrink-0 rounded-sm px-1 text-[0.6rem] font-semibold tracking-wide text-muted-foreground">
                  {c.code}
                </Badge>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
