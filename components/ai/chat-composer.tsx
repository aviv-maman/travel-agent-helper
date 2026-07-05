"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB — offers are screenshots, not photos

/** Target currency for conversions, and the source currencies we support for now. */
const TARGET_CURRENCY = "ILS";
const CURRENCIES = ["USD", "EUR"] as const;
type Currency = (typeof CURRENCIES)[number];
type Rate = { currency: Currency; rate: string };

/**
 * The prompt composer, styled as a single elevated pill (à la ChatGPT/Claude):
 * an optional image chip, a borderless auto-growing textarea, and a toolbar with
 * an attach button, an exchange-rate builder, and a circular brand send button.
 * Exchange rates persist across sends and are forwarded to the model so they apply
 * to subsequent prompts. Enter sends, Shift+Enter newlines.
 */
export function ChatComposer({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (_prompt: string, _image: File | null, _exchangeRate: string) => void;
}) {
  const t = useTranslations("ai");
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rates, setRates] = useState<Rate[]>([]);
  const [draftRate, setDraftRate] = useState("");
  const [draftCurrency, setDraftCurrency] = useState<Currency>("USD");
  const fileRef = useRef<HTMLInputElement>(null);

  const available = CURRENCIES.filter((c) => !rates.some((r) => r.currency === c));
  const selectedCurrency: Currency = available.includes(draftCurrency)
    ? draftCurrency
    : (available[0] ?? "USD");

  // "1 USD = 3.65 ILS, 1 EUR = 4.0 ILS" — sent to the model (not shown in chat).
  const formattedRates = rates
    .map((r) => `1 ${r.currency} = ${r.rate} ${TARGET_CURRENCY}`)
    .join(", ");

  function pickImage(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("errNotImage"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t("errImageTooLarge"));
      return;
    }
    setImage(file);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function clearImage() {
    setImage(null);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function addRate() {
    const value = draftRate.trim();
    const num = Number(value);
    if (!value || !Number.isFinite(num) || num <= 0) return;
    if (rates.some((r) => r.currency === selectedCurrency)) return;
    setRates((prev) => [...prev, { currency: selectedCurrency, rate: value }]);
    setDraftRate("");
  }

  function removeRate(currency: Currency) {
    setRates((prev) => prev.filter((r) => r.currency !== currency));
  }

  function submit() {
    const prompt = text.trim();
    if (!prompt || disabled) return;
    onSend(prompt, image, formattedRates);
    setText("");
    clearImage();
    // Exchange rates persist on purpose — they apply to subsequent prompts too.
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
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
        onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
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
            onClick={clearImage}>
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
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
