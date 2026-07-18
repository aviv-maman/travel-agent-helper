import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalize the fancy en/em dashes (– —) to a plain hyphen "-" for text that
 * gets copied and sent to a client — the agent wants ordinary hyphens, not the
 * typographic dashes that creep into AI-generated and curated copy.
 */
export function toClientDashes(text: string): string {
  return text.replace(/[–—]/g, "-");
}
