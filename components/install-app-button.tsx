"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

/** The `beforeinstallprompt` event — Chromium-only, so not in the DOM lib types. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/*
 * A tiny module-level store for install state, shared across every button
 * instance. `beforeinstallprompt` fires ONCE, early — often before the mobile
 * menu (which mounts its button only when the sheet opens) exists. Capturing it
 * here, from the first-mounted instance, means a late-mounting button still sees
 * the saved prompt. Instances read it via useSyncExternalStore (clean SSR +
 * hydration, same pattern as useIsMobile).
 */
let deferredPrompt: InstallPromptEvent | null = null;
let installedByEvent = false;
let started = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // suppress Chrome's mini-infobar; we drive it from the button
    deferredPrompt = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installedByEvent = true;
    emit();
  });
}
function subscribe(cb: () => void) {
  start();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
const getPrompt = () => deferredPrompt;
function isInstalled() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    installedByEvent ||
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

/** iPhone/iPod, plus iPadOS 13+ which masquerades as desktop Safari. */
function isIOSDevice() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}
// No external events to watch — the value is computed once on the client.
const noSubscribe = () => () => {
  /* nothing to unsubscribe */
};

/**
 * "Install app" affordance for the PWA. Chromium (Android + desktop Chrome/Edge)
 * fires `beforeinstallprompt`, which we capture and replay on click for a native
 * one-tap install. iOS Safari has no such event, so there we show a popover with
 * the manual Share → "Add to Home Screen" steps. Renders nothing when the app is
 * already installed or the browser offers no install path — so it silently
 * no-ops in dev (no service worker) and on unsupported browsers.
 *
 * `full` = full-width left-aligned (the mobile menu); otherwise a compact button.
 */
export function InstallAppButton({ full = false }: { full?: boolean }) {
  const t = useTranslations("pwa");
  const prompt = useSyncExternalStore(subscribe, getPrompt, () => null);
  const installed = useSyncExternalStore(subscribe, isInstalled, () => false);
  const isIOS = useSyncExternalStore(noSubscribe, isIOSDevice, () => false);

  if (installed) return null;

  const label = (
    <>
      <Download className="size-4" />
      {t("install")}
    </>
  );
  const btnClass = full ? "w-full justify-start" : undefined;

  // iOS: no programmatic install — show the manual Share steps.
  if (isIOS) {
    return (
      <Popover>
        <PopoverTrigger
          render={
            <Button type="button" variant="outline" size="sm" className={btnClass}>
              {label}
            </Button>
          }
        />
        <PopoverContent side="bottom" align={full ? "start" : "end"}>
          <PopoverHeader>
            <PopoverTitle className="flex items-center gap-1.5">
              <Share className="size-4" aria-hidden />
              {t("iosTitle")}
            </PopoverTitle>
          </PopoverHeader>
          <PopoverDescription>{t("iosBody")}</PopoverDescription>
        </PopoverContent>
      </Popover>
    );
  }

  // Chromium: only offer once we've captured the install prompt.
  if (!prompt) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={btnClass}
      onClick={async () => {
        await prompt.prompt();
        await prompt.userChoice;
        deferredPrompt = null; // consumed — hide every instance
        emit();
      }}>
      {label}
    </Button>
  );
}
