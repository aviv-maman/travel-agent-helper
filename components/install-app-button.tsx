"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Download, MoreVertical, Share } from "lucide-react";
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

type Platform = "ios" | "android" | "other";
/** Coarse platform sniff — decides the manual install instructions to show. */
function getPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPhone/iPod, plus iPadOS 13+ which masquerades as desktop Safari.
  if (
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  ) {
    return "ios";
  }
  if (/android/i.test(ua)) return "android";
  return "other";
}
// No external events to watch — the value is computed once on the client.
const noSubscribe = () => () => {
  /* nothing to unsubscribe */
};

/**
 * "Install app" affordance for the PWA.
 *
 * - When the browser hands us a `beforeinstallprompt` (Chromium: Android +
 *   desktop Chrome/Edge), the button replays it on click for a native one-tap
 *   install.
 * - On mobile WITHOUT that event — iOS Safari (which never fires it) and the
 *   many Android/Samsung cases where Chrome withholds it (engagement heuristics,
 *   Samsung Internet, timing) — the button instead opens a popover with the
 *   manual "Add to Home Screen" steps, so it's always reachable on a phone.
 * - On desktop with no prompt (e.g. Firefox), and when already installed, it
 *   renders nothing.
 *
 * `full` = full-width left-aligned (the mobile menu); otherwise a compact button.
 */
export function InstallAppButton({ full = false }: { full?: boolean }) {
  const t = useTranslations("pwa");
  const prompt = useSyncExternalStore(subscribe, getPrompt, () => null);
  const installed = useSyncExternalStore(subscribe, isInstalled, () => false);
  const platform = useSyncExternalStore(noSubscribe, getPlatform, (): Platform => "other");

  if (installed) return null;
  const isMobile = platform === "ios" || platform === "android";
  // Nothing to offer: desktop browser that never surfaced an install prompt.
  if (!prompt && !isMobile) return null;

  const label = (
    <>
      <Download className="size-4" />
      {t("install")}
    </>
  );
  const btnClass = full ? "w-full justify-start" : undefined;

  // Native one-tap install (Chromium gave us the prompt).
  if (prompt) {
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

  // Mobile, no native prompt → manual steps for the platform.
  const isIOS = platform === "ios";
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
            {isIOS ? (
              <Share className="size-4" aria-hidden />
            ) : (
              <MoreVertical className="size-4" aria-hidden />
            )}
            {isIOS ? t("iosTitle") : t("androidTitle")}
          </PopoverTitle>
        </PopoverHeader>
        <PopoverDescription>{isIOS ? t("iosBody") : t("androidBody")}</PopoverDescription>
      </PopoverContent>
    </Popover>
  );
}
