"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { enUS, he, type Locale } from "react-day-picker/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** "YYYY-MM-DD" → a local-midnight Date (avoids the UTC shift of `new Date(str)`). */
function parseISO(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}

/** A Date → "YYYY-MM-DD" from its local parts (matches a native date input). */
function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * A date field backed by our Calendar in a popover — a drop-in for
 * `<input type="date">`: same "YYYY-MM-DD" string value, optional min/max, and
 * an onChange that fires the string. Localized month names + RTL for Hebrew.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  locale = "he",
  placeholder,
  id,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (_value: string) => void;
  min?: string;
  max?: string;
  locale?: string;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const isHe = locale === "he";
  const dpLocale: Locale = isHe ? he : enUS;
  const selected = parseISO(value);
  const minDate = min ? parseISO(min) : undefined;
  const maxDate = max ? parseISO(max) : undefined;

  const disabled = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];

  const label = selected
    ? selected.toLocaleDateString(isHe ? "he-IL" : "en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : (placeholder ?? "");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            id={id}
            aria-label={ariaLabel}
            className={cn(
              "h-9 justify-start gap-2 bg-surface font-normal",
              !selected && "text-muted-foreground",
              className,
            )}
          />
        }>
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span dir="ltr" className="tabular-nums">
          {label}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (d) {
              onChange(toISO(d));
              setOpen(false);
            }
          }}
          defaultMonth={selected ?? maxDate ?? minDate}
          disabled={disabled.length ? disabled : undefined}
          locale={dpLocale}
          dir={isHe ? "rtl" : "ltr"}
          autoFocus
          // Wider, landscape layout: columns stretch to fill a fixed width while
          // each day row stays short (the cells fill width, height = cell-size).
          className="[--cell-size:--spacing(8)]"
          classNames={{ root: "w-[22rem]" }}
        />
      </PopoverContent>
    </Popover>
  );
}
