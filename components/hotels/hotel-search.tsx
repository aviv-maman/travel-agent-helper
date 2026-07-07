"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { rankBySearch } from "@/lib/search";
import { Input } from "@/components/ui/input";
import { useHotelParams } from "./use-hotel-params";

const MAX_SUGGESTIONS = 8;

/**
 * Hotel-name search with smart, Hebrew-aware autocomplete drawn from the current
 * destination's hotels (`hotelNames`). Typing debounces into the `q` URL param,
 * which the server uses to filter the results. Keyed by destination upstream so
 * switching cities resets the field.
 */
export function HotelSearch({ hotelNames }: { hotelNames: string[] }) {
  const t = useTranslations("hotels");
  const { q, update } = useHotelParams();
  const [value, setValue] = useState(q);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  // Debounce pushing the typed query into the URL (drives the server-side filter).
  useEffect(() => {
    const id = setTimeout(() => {
      const next = value.trim();
      if (next !== q.trim()) update({ q: next || null });
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close the suggestion list on an outside click.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const suggestions =
    value.trim().length === 0
      ? []
      : rankBySearch(hotelNames, value, (n) => [n]).slice(0, MAX_SUGGESTIONS);

  function choose(name: string) {
    setValue(name);
    update({ q: name });
    setOpen(false);
  }

  function clear() {
    setValue("");
    update({ q: null });
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter") update({ q: value.trim() || null });
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlight((h) => (h + 1) % suggestions.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
        break;
      case "Enter":
        e.preventDefault();
        choose(suggestions[Math.min(highlight, suggestions.length - 1)]);
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <Search
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => value.trim() && setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
        placeholder={t("searchHotel")}
        className="h-11 ps-9 pe-9 text-sm"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label={t("clearSearch")}
          className="absolute end-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive">
          <X className="size-4" />
        </button>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-md">
          {suggestions.map((name, i) => (
            <li key={name}>
              <button
                type="button"
                // Keep focus on the input so the blur/outside-click logic doesn't fire first.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(name)}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-sm ${
                  i === highlight ? "bg-brand/10 text-brand" : "text-foreground"
                }`}>
                <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
