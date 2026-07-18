"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Calculator, Copy, PilcrowLeft, PilcrowRight, Trash2 } from "lucide-react";
import { evalLine, formatNumber } from "@/lib/dashboard/calc";
import { saveScratchpadAction } from "@/app/actions/dashboard";
import { Button } from "@/components/ui/button";

type SaveStatus = "idle" | "saving" | "saved" | "offline";

// The scratchpad's writing direction, persisted in localStorage. Modeled as an
// external store so the server snapshot is "ltr" and the saved value lands after
// hydration — no effect-setState, no hydration mismatch on the textarea `dir`.
const DIR_KEY = "scratchpad-dir";
const DIR_EVENT = "scratchpad-dir-change";
function subscribeDir(cb: () => void) {
  window.addEventListener(DIR_EVENT, cb);
  return () => window.removeEventListener(DIR_EVENT, cb);
}
function readDir(): "ltr" | "rtl" {
  return localStorage.getItem(DIR_KEY) === "rtl" ? "rtl" : "ltr";
}
function pickDir(next: "ltr" | "rtl") {
  localStorage.setItem(DIR_KEY, next);
  window.dispatchEvent(new Event(DIR_EVENT));
}

/**
 * Soulver-style scratchpad: a plain multi-line editor whose math lines show a
 * live result in the right gutter (see lib/dashboard/calc). Content auto-saves
 * to Supabase-equivalent (Neon) ~1s after typing stops, syncing across devices.
 */
export function Playground({ initialContent }: { initialContent: string }) {
  const t = useTranslations("dashboard.playground");
  const [value, setValue] = useState(initialContent);
  const [status, setStatus] = useState<SaveStatus>("idle");
  // Which side the writing starts from — an editor preference, remembered locally.
  const dir = useSyncExternalStore(subscribeDir, readDir, () => "ltr" as const);
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
        <div className="flex items-center gap-2.5">
          <h2 className="flex items-center gap-2.5 text-base font-bold tracking-tight text-foreground">
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 ring-1 ring-brand/15"
              aria-hidden>
              <Calculator className="size-4 text-brand" />
            </span>
            {t("title")}
          </h2>
          {/* Which side writing starts from. Force LTR layout so the arrows sit
              in a fixed order — left button (←) starts from the right, right
              button (→) starts from the left — regardless of the page direction. */}
          <div dir="ltr" className="flex items-center rounded-lg border border-border">
            <Button
              variant={dir === "rtl" ? "secondary" : "ghost"}
              size="icon-sm"
              aria-pressed={dir === "rtl"}
              aria-label={t("dirRtl")}
              onClick={() => pickDir("rtl")}>
              <PilcrowLeft className="size-4" />
            </Button>
            <Button
              variant={dir === "ltr" ? "secondary" : "ghost"}
              size="icon-sm"
              aria-pressed={dir === "ltr"}
              aria-label={t("dirLtr")}
              onClick={() => pickDir("ltr")}>
              <PilcrowRight className="size-4" />
            </Button>
          </div>
        </div>
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
          dir={dir}
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
