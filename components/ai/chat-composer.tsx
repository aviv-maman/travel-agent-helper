"use client";

import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { ArrowRightLeft, ArrowUp, ChevronDown, ImageIcon, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Target currency for conversions, and the source currencies we support for now. */
export const TARGET_CURRENCY = "ILS";
export const CURRENCIES = ["USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];
export type Rate = { currency: Currency; rate: string };

/**
 * The prompt composer, styled as a single elevated pill (à la ChatGPT/Claude):
 * an optional image chip, a borderless auto-growing textarea, and a toolbar with
 * an attach button, an exchange-rate builder, and a circular brand send button.
 * The attached image and exchange rates are **owned by the parent** (ChatInterface):
 * the composer remounts when the chat leaves its empty state, so any state that
 * must survive a send — the rates, the image — cannot live here. Images arrive
 * via the paperclip, clipboard paste, or the parent's chat-wide drag-and-drop.
 * Enter sends, Shift+Enter newlines.
 */
export function ChatComposer({
  disabled,
  image,
  onPickImage,
  onClearImage,
  rates,
  onRatesChange,
  onSend,
}: {
  disabled: boolean;
  image: File | null;
  onPickImage: (_file: File | null) => void;
  onClearImage: () => void;
  rates: Rate[];
  onRatesChange: (_rates: Rate[]) => void;
  onSend: (_prompt: string) => void;
}) {
  const t = useTranslations("ai");
  const [text, setText] = useState("");
  const [draftRate, setDraftRate] = useState("");
  const [draftCurrency, setDraftCurrency] = useState<Currency>("USD");
  const fileRef = useRef<HTMLInputElement>(null);

  // Preview URL derived from the (parent-owned) image; revoked on change/unmount.
  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => {
    if (!image && fileRef.current) fileRef.current.value = "";
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [image, preview]);

  const available = CURRENCIES.filter((c) => !rates.some((r) => r.currency === c));
  const selectedCurrency: Currency = available.includes(draftCurrency)
    ? draftCurrency
    : (available[0] ?? "USD");

  function addRate() {
    const value = draftRate.trim();
    const num = Number(value);
    if (!value || !Number.isFinite(num) || num <= 0) return;
    if (rates.some((r) => r.currency === selectedCurrency)) return;
    onRatesChange([...rates, { currency: selectedCurrency, rate: value }]);
    setDraftRate("");
  }

  function removeRate(currency: Currency) {
    onRatesChange(rates.filter((r) => r.currency !== currency));
  }

  function submit() {
    const prompt = text.trim();
    if (!prompt || disabled) return;
    onSend(prompt);
    setText("");
    // The image is cleared by the parent after the send; exchange rates persist
    // on purpose — they apply to subsequent prompts too.
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  // Pasting a screenshot attaches it (replacing any current image); text paste is untouched.
  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    if (disabled) return;
    const item = Array.from(e.clipboardData.items).find(
      (i) => i.kind === "file" && i.type.startsWith("image/"),
    );
    const file = item?.getAsFile();
    if (!file) return;
    e.preventDefault();
    onPickImage(file);
  }

  const canSend = !disabled && text.trim().length > 0;
  const ratesSet = rates.length > 0;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm transition-colors focus-within:border-ring/60 focus-within:ring-3 focus-within:ring-ring/15">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
      />

      {image && preview && (
        <div className="flex items-center gap-2 rounded-xl bg-muted/60 p-1.5 ps-2">
          <span className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={image.name} className="size-full object-cover" />
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="flex items-center gap-1 truncate text-xs font-medium text-foreground">
              <ImageIcon className="size-3 shrink-0 text-muted-foreground" />
              {image.name}
            </span>
            <span className="text-[0.7rem] text-muted-foreground">{t("imageReady")}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="ms-auto"
            aria-label={t("removeImage")}
            onClick={onClearImage}>
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        placeholder={t("composerPlaceholder")}
        rows={1}
        disabled={disabled}
        className="field-sizing-content max-h-48 min-h-9 w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
      />

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("attachImage")}
          disabled={disabled}
          onClick={() => fileRef.current?.click()}>
          <Paperclip className="size-4" />
        </Button>

        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant={ratesSet ? "outline" : "ghost"}
                size="sm"
                aria-label={t("exchangeRate")}
                className={cn("gap-1.5", ratesSet && "border-brand/40 text-brand")}
              />
            }>
            <ArrowRightLeft className="size-4" />
            {ratesSet ? (
              <span className="max-w-40 truncate text-xs font-medium">
                {rates.map((r) => `${r.currency} ${r.rate}`).join(" · ")}
              </span>
            ) : (
              <span className="hidden text-xs sm:inline">{t("exchangeRate")}</span>
            )}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80">
            <PopoverHeader>
              <PopoverTitle>{t("exchangeRate")}</PopoverTitle>
              <PopoverDescription>{t("exchangeRateHint")}</PopoverDescription>
            </PopoverHeader>

            {/* Added rates */}
            {rates.length > 0 && (
              <ul className="flex flex-col gap-1">
                {rates.map((r) => (
                  <li
                    key={r.currency}
                    className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1 text-sm"
                    dir="ltr">
                    <span className="flex-1 font-medium">
                      1 {r.currency} = {r.rate} {TARGET_CURRENCY}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("remove")}
                      onClick={() => removeRate(r.currency)}>
                      <X className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add row — hidden once both currencies are set */}
            {available.length > 0 && (
              <div className="flex items-center gap-2" dir="ltr">
                <div className="flex h-8 flex-1 items-center rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                  <input
                    inputMode="decimal"
                    placeholder={t("ratePlaceholder")}
                    value={draftRate}
                    onChange={(e) => setDraftRate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addRate();
                      }
                    }}
                    aria-label={t("exchangeRate")}
                    className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <div className="relative h-full shrink-0 border-s border-input">
                    <select
                      value={selectedCurrency}
                      onChange={(e) => setDraftCurrency(e.target.value as Currency)}
                      aria-label={t("exchangeRate")}
                      className="h-full cursor-pointer appearance-none rounded-e-lg bg-transparent ps-2.5 pe-7 text-sm font-medium outline-none">
                      {available.map((c) => (
                        <option key={c} value={c} className="bg-[Canvas] text-[CanvasText]">
                          {c}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={addRate}
                  disabled={draftRate.trim().length === 0}>
                  {t("add")}
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <span className="ms-auto hidden text-xs text-muted-foreground sm:block">
          {t("enterHint")}
        </span>
        <Button
          type="button"
          size="icon"
          aria-label={t("send")}
          disabled={!canSend}
          onClick={submit}
          className={cn(
            "size-8 rounded-full bg-brand text-brand-foreground hover:bg-brand/90",
            !canSend && "opacity-40",
          )}>
          <ArrowUp className="size-4" />
        </Button>
      </div>
    </div>
  );
}
