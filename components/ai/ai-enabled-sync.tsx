"use client";

import { useEffect } from "react";
import { setAiEnabled } from "@/lib/ai/ai-enabled-store";

/**
 * Reconciles the client nav mirror (`ai_enabled` cookie) with the authoritative
 * server value whenever an AI page renders. Renders nothing. Keeps the Assistant
 * link in sync even across devices / after the key changes elsewhere.
 */
export function AiEnabledSync({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    setAiEnabled(enabled);
  }, [enabled]);
  return null;
}
