"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Calculator, Copy, Trash2 } from "lucide-react";
import { evalLine, formatNumber } from "@/lib/dashboard/calc";
import { saveScratchpadAction } from "@/app/actions/dashboard";
import { Button } from "@/components/ui/button";

type SaveStatus = "idle" | "saving" | "saved" | "offline";

/**
 * Soulver-style scratchpad: a plain multi-line editor whose math lines show a
 * live result in the right gutter (see lib/dashboard/calc). Content auto-saves
 * to Supabase-equivalent (Neon) ~1s after typing stops, syncing across devices.
 */
export function Playground({ initialContent }: { initialContent: string }) {
  const t = useTranslations("dashboard.playground");
  const [value, setValue] = useState(initialContent);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const firstRender = useRef(true);

  // Debounced auto-save (~1s after the last keystroke).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setStatus("saving");
    const id = setTimeout(async () => {
      const res = await saveScratchpadAction(value);
      setStatus("error" in res ? "offline" : "saved");
    }, 1000);
    return () => clearTimeout(id);
  }, [value]);

  const lines = useMemo(() => value.split("\n"), [value]);
  const results = useMemo(() => lines.map(evalLine), [lines]);
  const rows = Math.max(8, lines.length + 1);

  function copyAll() {
    navigator.clipboard.writeText(value).then(
      () => toast.success(t("copied")),
      () => toast.error(t("copied")),
    );
  }

  const statusText =
    status === "saving"
      ? t("saving")
      : status === "saved"
        ? t("saved")
        : status === "offline"
          ? t("offline")
          : "";

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-base font-bold tracking-tight text-foreground">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 ring-1 ring-brand/15"
            aria-hidden>
            <Calculator className="size-4 text-brand" />
          </span>
          {t("title")}
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs ${status === "offline" ? "text-destructive" : "text-muted-foreground"}`}
            aria-live="polite">
            {statusText}
          </span>
          <Button variant="outline" size="sm" onClick={copyAll}>
            <Copy className="size-3.5" /> {t("copy")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setValue("")}>
            <Trash2 className="size-3.5" /> {t("clear")}
          </Button>
        </div>
      </div>

      <div
        dir="ltr"
        className="flex overflow-hidden rounded-xl border border-border/70 bg-surface ring-1 ring-foreground/5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          wrap="off"
          rows={rows}
          spellCheck={false}
          className="flex-1 resize-none overflow-x-auto bg-transparent p-3 font-mono text-sm leading-6 text-foreground outline-none"
        />
        <div
          aria-hidden
          className="w-28 shrink-0 border-l border-border/50 py-3 pe-3 font-mono text-sm leading-6">
          {lines.map((_, i) => (
            <div key={i} className="h-6 truncate text-end text-brand/70">
              {results[i] != null ? `= ${formatNumber(results[i]!)}` : " "}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
