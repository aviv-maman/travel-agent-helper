import { beforeEach, describe, expect, test } from "bun:test";
import { loadRates, storeRates } from "./rates-store";
import type { Rate } from "@/components/ai/chat-composer";

// Minimal localStorage stub (bun:test runs outside a browser).
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const RATES: Rate[] = [{ currency: "USD", rate: "3.7" }];

beforeEach(() => store.clear());

describe("rates-store", () => {
  test("round-trips fresh rates", () => {
    storeRates(RATES);
    expect(loadRates()).toEqual(RATES);
  });

  test("returns empty when nothing is stored", () => {
    expect(loadRates()).toEqual([]);
  });

  test("drops rates older than the freshness window", () => {
    store.set(
      "ai_sale_rates",
      JSON.stringify({ savedAt: Date.now() - 13 * 60 * 60 * 1000, rates: RATES }),
    );
    expect(loadRates()).toEqual([]);
  });

  test("keeps rates just inside the window", () => {
    store.set(
      "ai_sale_rates",
      JSON.stringify({ savedAt: Date.now() - 11 * 60 * 60 * 1000, rates: RATES }),
    );
    expect(loadRates()).toEqual(RATES);
  });

  test("filters entries with unknown currencies or bad shapes", () => {
    store.set(
      "ai_sale_rates",
      JSON.stringify({
        savedAt: Date.now(),
        rates: [...RATES, { currency: "GBP", rate: "4.7" }, { currency: "EUR", rate: 4 }, null],
      }),
    );
    expect(loadRates()).toEqual(RATES);
  });

  test("survives corrupt JSON", () => {
    store.set("ai_sale_rates", "{not json");
    expect(loadRates()).toEqual([]);
  });

  test("an empty list clears the stored entry", () => {
    storeRates(RATES);
    storeRates([]);
    expect(store.has("ai_sale_rates")).toBe(false);
  });
});
