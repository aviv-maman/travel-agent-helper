"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Copy, Eye, ImageIcon, List, PanelRight, Trash2 } from "lucide-react";
import { deleteQuoteAction } from "@/app/actions/ai";
import { forwardableMessage } from "@/lib/ai/quote-title";
import { emitQuoteDeleted } from "@/lib/ai/quote-events";
import { QUOTE_HISTORY_VIEW_COOKIE } from "@/lib/ai/constants";
import type { SavedQuote } from "@/lib/ai/quotes";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useDirection } from "@/components/ui/direction";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ViewMode = "list" | "drawer";

/**
 * Resolve a stored quote's image to a URL. The `mock` sentinel (set in dev, when
 * no storage backend stores real bytes) points at the bundled sample image; real keys
 * go through the backend image endpoint.
 */
function quoteImageSrc(imageKey: string): string {
  return imageKey === "mock" ? "/mock/quote-sample.jpg" : `/api/ai/quote-image/${imageKey}`;
}

/**
 * The saved-quotes history. Each quote is a box with a title/date and Eye + Trash
 * actions; Eye opens a dialog with the full message, a Copy button, and Trash. A
 * toggle switches between the **list** (below the chat) and a side **drawer**; the
 * choice is remembered per browser via a cookie. The original image renders in the
 * dialog once stored (storage backend pending; `imageKey` is null for now).
 */
export function QuoteHistory({
  locale,
  quotes,
  initialView,
}: {
  locale: string;
  quotes: SavedQuote[];
  initialView: ViewMode;
}) {
  const t = useTranslations("ai");
  const router = useRouter();
  const direction = useDirection();
  const [view, setView] = useState<ViewMode>(initialView);
  const [viewTarget, setViewTarget] = useState<SavedQuote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedQuote | null>(null);
  const [copied, setCopied] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [pending, startTransition] = useTransition();

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  function setViewMode(mode: ViewMode) {
    setView(mode);
    document.cookie = `${QUOTE_HISTORY_VIEW_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
  }

  function onDelete() {
    const target = deleteTarget;
    if (!target) return;
    startTransition(async () => {
      try {
        await deleteQuoteAction(target.id);
      } catch {
        toast.error(t("deleteError"));
        return;
      }
      // Tell the chat: re-enable "Save" on the reply that produced this quote, and
      // drop the (now freed) imageKey so a re-save re-uploads the screenshot.
      emitQuoteDeleted({ id: target.id, imageKey: target.imageKey });
      setDeleteTarget(null);
      toast.success(t("quoteDeleted"));
      router.refresh();
    });
  }

  async function copyView() {
    if (!viewTarget) return;
    try {
      await navigator.clipboard.writeText(forwardableMessage(viewTarget.content));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  // The boxes list (or empty state) — reused in both the list and drawer modes.
  const quoteList =
    quotes.length === 0 ? (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        {t("noSavedQuotes")}
      </p>
    ) : (
      <ul className="flex flex-col gap-2">
        {quotes.map((quote) => (
          <li
            key={quote.id}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-foreground">{quote.title}</span>
              <span className="text-xs text-muted-foreground">
                {dateFmt.format(new Date(quote.createdAt))}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("view")}
              onClick={() => {
                setCopied(false);
                setViewTarget(quote);
              }}>
              <Eye className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("deleteQuote")}
              onClick={() => setDeleteTarget(quote)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
    );

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t("savedQuotesTitle")}</h3>
        {/* List ⇄ drawer view toggle */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
          <Button
            type="button"
            variant={view === "list" ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={t("viewAsList")}
            aria-pressed={view === "list"}
            onClick={() => setViewMode("list")}>
            <List className="size-4" />
          </Button>
          <Button
            type="button"
            variant={view === "drawer" ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={t("viewAsDrawer")}
            aria-pressed={view === "drawer"}
            onClick={() => setViewMode("drawer")}>
            <PanelRight className="size-4" />
          </Button>
        </div>
      </div>

      {view === "list" ? (
        quoteList
      ) : (
        <Sheet>
          <SheetTrigger render={<Button variant="outline" className="gap-2 self-start" />}>
            <PanelRight className="size-4" />
            {t("openSavedQuotes")}
            {quotes.length > 0 ? ` (${quotes.length})` : ""}
          </SheetTrigger>
          <SheetContent
            side={direction === "rtl" ? "left" : "right"}
            className="flex flex-col gap-0 sm:max-w-md">
            <SheetHeader>
              <SheetTitle>{t("savedQuotesTitle")}</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{quoteList}</div>
          </SheetContent>
        </Sheet>
      )}

      {/* View dialog */}
      <Dialog
        open={viewTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setViewTarget(null);
            setZoomed(false);
          }
        }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="pe-6 text-lg">{viewTarget?.title}</DialogTitle>
          </DialogHeader>

          {/* Original image — shown when stored (storage upload pending), placeholder otherwise.
              Click to enlarge to full/original size. */}
          {viewTarget?.imageKey ? (
            <button
              type="button"
              onClick={() => setZoomed(true)}
              aria-label={t("enlargeImage")}
              className="block cursor-zoom-in overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={quoteImageSrc(viewTarget.imageKey)}
                alt={viewTarget.title}
                className="max-h-72 w-full object-contain transition-transform hover:scale-[1.01]"
              />
            </button>
          ) : (
            <div className="flex h-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground">
              <ImageIcon className="size-7" />
              <span className="text-xs">{t("noImage")}</span>
            </div>
          )}

          <p className="max-h-[45vh] overflow-y-auto rounded-lg bg-muted/50 p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            {viewTarget ? forwardableMessage(viewTarget.content) : null}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={copyView}>
              {copied ? <Check className="text-success" /> : <Copy />}
              {t("copy")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const q = viewTarget;
                setViewTarget(null);
                if (q) setDeleteTarget(q);
              }}>
              <Trash2 />
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full-size image lightbox — opened from the view dialog's image. */}
      <Dialog open={zoomed} onOpenChange={setZoomed}>
        <DialogContent className="max-h-[95vh] overflow-auto p-2 sm:max-w-[95vw]">
          {viewTarget?.imageKey && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={quoteImageSrc(viewTarget.imageKey)}
              alt={viewTarget.title}
              className="mx-auto max-w-none"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteQuoteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteQuoteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete} disabled={pending}>
              {pending ? <Spinner /> : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
