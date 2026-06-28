import type { Localized } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { localized } from "@/lib/hotels";

/**
 * Cancellation-fee guide per supplier. Each card holds the internal NET fee
 * tables (supplier cost) plus ready-to-send "client copy" scripts that keep a
 * 10% gross margin and fold in the Israeli Consumer Protection Law. Curated
 * editorial data, resolved to the active locale on the server.
 */

/** Fee severity → cell color. low = blue, net = gold, gross = orange, full = red. */
export type FeeLevel = "low" | "net" | "gross" | "full";

/** Product tag color: flight = blue, package = green, organized = purple. */
export type ProductKind = "flight" | "package" | "organized";

export type FeeRow = { timeframe: Localized; fee: Localized; level: FeeLevel };

export type Block =
  | { kind: "heading"; text: Localized }
  | { kind: "subheading"; text: Localized; tone: "accent" | "gold" }
  | { kind: "table"; caption: Localized; headers?: [Localized, Localized]; rows: FeeRow[] }
  | { kind: "copy"; text: Localized; levels?: FeeLevel[] };

export type Product = { kind: ProductKind; label: Localized };

export type CancelSupplier = {
  id: string;
  /** Path to the supplier's logo image (under /public). */
  logo?: string;
  name: Localized;
  code: string;
  products: Product[];
  blocks: Block[];
};

const t = (he: string, en: string): Localized => ({ he, en });

const row = (
  level: FeeLevel,
  timeHe: string,
  timeEn: string,
  feeHe: string,
  feeEn: string,
): FeeRow => ({ timeframe: t(timeHe, timeEn), fee: t(feeHe, feeEn), level });

// Shared product tags.
const P_FLIGHT = (he = "✈ טיסות", en = "✈ Flights"): Product => ({
  kind: "flight",
  label: t(he, en),
});
const P_PACKAGE = (he: string, en: string): Product => ({ kind: "package", label: t(he, en) });
const P_ORGANIZED = (he = "🚌 טיולים מאורגנים", en = "🚌 Organized tours"): Product => ({
  kind: "organized",
  label: t(he, en),
});

// Table header presets.
const H_TIME_CANCEL = t("מועד ביטול", "Cancellation timing");
const H_TIME_CHANGE = t("מועד שינוי", "Change timing");
const H_FEE_PAX_NET = t("דמי ביטול לנוסע (נטו ספק)", "Cancellation fee / traveler (net)");
const H_CHANGE_PAX = t("עלות שינוי לנוסע", "Change cost / traveler");

const CAP_INTERNAL = t("דמי ביטול לאדם (נטו ספק)", "Cancellation fee / person (net)");
const CAP_INTERNAL_SHORT = t("דמי ביטול לאדם (נטו ספק)", "Cancellation fee / person (net)");

/**
 * Builds a client-copy script. Every script opens with the Consumer Protection
 * Law clause (which varies only by "before the flight" / "before departure"),
 * then the supplier-specific tiers.
 */
function copyText(when: "flight" | "departure", he: string, en: string): Localized {
  const wHe = when === "flight" ? "לפני הטיסה" : "לפני היציאה";
  const wEn = when === "flight" ? "before the flight" : "before departure";
  const lawHe = `עד 14 ימים קלנדריים מיום ההזמנה, בתנאי שיש לפחות 7 ימי עסקים ${wHe} — 100 ₪ לאדם או 5% ממחיר העסקה (הנמוך מביניהם) — בהתאם לחוק הגנת הצרכן.`;
  const lawEn = `Up to 14 calendar days from booking, provided there are at least 7 business days ${wEn} — ₪100 per person or 5% of the transaction price (whichever is lower) — per the Consumer Protection Law.`;
  return t(`${lawHe}\n\n${he}`, `${lawEn}\n\n${en}`);
}

const SUPPLIERS: CancelSupplier[] = [
  {
    id: "flying",
    logo: "/suppliers/flying.png",
    name: t("שטיח מעופף", "Flying Carpet"),
    code: "FLYING",
    products: [P_FLIGHT(), P_PACKAGE("🏖 חבילות", "🏖 Packages"), P_ORGANIZED()],
    blocks: [
      {
        kind: "table",
        caption: CAP_INTERNAL,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "low",
            "מרגע ביצוע ההזמנה עד 21 ימי עסקים לפני הטיסה",
            "From booking until 21 business days before the flight",
            "100$",
            "$100",
          ),
          row(
            "net",
            "21–15 ימי עסקים לפני הטיסה",
            "21–15 business days before the flight",
            "30% מעלות החבילה",
            "30% of package cost",
          ),
          row(
            "gross",
            "14–8 ימי עסקים לפני הטיסה",
            "14–8 business days before the flight",
            "60% מעלות החבילה",
            "60% of package cost",
          ),
          row(
            "full",
            "7 ימי עסקים ומטה לפני הטיסה",
            "7 business days or fewer before the flight",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "flight",
          "לאחר מכן ועד 21 ימי עסקים לפני הטיסה — 185$ לאדם.\n\nמ-21 ימי עסקים לפני הטיסה ועד 15 ימי עסקים לפניה — 40% מעלות החבילה לאדם.\n\nמ-14 ימי עסקים ועד 8 ימי עסקים לפני הטיסה — 70% מעלות החבילה לאדם.\n\n7 ימי עסקים לפני הטיסה ומטה — 100% מעלות החבילה, ללא כל החזר.",
          "Thereafter and up to 21 business days before the flight — $185 per person.\n\nFrom 21 to 15 business days before the flight — 40% of the package cost per person.\n\nFrom 14 to 8 business days before the flight — 70% of the package cost per person.\n\n7 business days before the flight or fewer — 100% of the package cost, no refund.",
        ),
        levels: ["low", "net", "gross", "full"],
      },
    ],
  },
  {
    id: "issta",
    logo: "/suppliers/issta.png",
    name: t("איסתא", "Issta"),
    code: "ISSTA",
    products: [
      P_FLIGHT(),
      P_PACKAGE("🏖 חבילות נופש", "🏖 Vacation packages"),
      P_PACKAGE("🌴 כפרי נופש", "🌴 Holiday villages"),
      P_ORGANIZED(),
    ],
    blocks: [
      {
        kind: "heading",
        text: t(
          "🌍 כל היעדים פרט לסיישל וזנזיבר",
          "🌍 All destinations except Seychelles and Zanzibar",
        ),
      },
      {
        kind: "table",
        caption: CAP_INTERNAL,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "net",
            "מיום ביצוע ההזמנה עד 28 ימי עסקים לפני היציאה",
            "From booking until 28 business days before departure",
            "25% מעלות החבילה",
            "25% of package cost",
          ),
          row(
            "gross",
            "27–15 ימי עסקים לפני היציאה",
            "27–15 business days before departure",
            "50% מעלות החבילה",
            "50% of package cost",
          ),
          row(
            "gross",
            "14–7 ימי עסקים לפני היציאה",
            "14–7 business days before departure",
            "75% מעלות החבילה",
            "75% of package cost",
          ),
          row(
            "full",
            "פחות מ-7 ימי עסקים לפני היציאה",
            "Fewer than 7 business days before departure",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "departure",
          "לאחר מכן ועד 28 ימי עסקים לפני היציאה — 35% מעלות החבילה לנוסע.\n\n27–15 ימי עסקים לפני היציאה — 60% מעלות החבילה לנוסע.\n\n14–7 ימי עסקים לפני היציאה — 85% מעלות החבילה לנוסע.\n\nפחות מ-7 ימי עסקים לפני היציאה — 100% מעלות החבילה, ללא כל החזר.",
          "Thereafter and up to 28 business days before departure — 35% of the package cost per traveler.\n\n27–15 business days before departure — 60% of the package cost per traveler.\n\n14–7 business days before departure — 85% of the package cost per traveler.\n\nFewer than 7 business days before departure — 100% of the package cost, no refund.",
        ),
        levels: ["net", "gross", "gross", "full"],
      },
      { kind: "heading", text: t("🌺 סיישל / זנזיבר", "🌺 Seychelles / Zanzibar") },
      {
        kind: "table",
        caption: t(
          "📋 לוח דמי ביטול — נטו ספק (לשימוש פנימי) · יעדים אקזוטיים",
          "📋 Cancellation fee schedule — net (internal) · exotic destinations",
        ),
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "net",
            "מיום ביצוע ההזמנה עד 28 ימי עסקים לפני היציאה",
            "From booking until 28 business days before departure",
            "25% מעלות החבילה",
            "25% of package cost",
          ),
          row(
            "full",
            "27–15 ימי עסקים לפני היציאה",
            "27–15 business days before departure",
            "75% מעלות החבילה",
            "75% of package cost",
          ),
          row(
            "full",
            "פחות מ-15 ימי עסקים לפני היציאה",
            "Fewer than 15 business days before departure",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "departure",
          "לאחר מכן ועד 28 ימי עסקים לפני היציאה — 35% מעלות החבילה לנוסע.\n\n27–15 ימי עסקים לפני היציאה — 85% מעלות החבילה לנוסע.\n\nפחות מ-15 ימי עסקים לפני היציאה — 100% מעלות החבילה, ללא כל החזר.",
          "Thereafter and up to 28 business days before departure — 35% of the package cost per traveler.\n\n27–15 business days before departure — 85% of the package cost per traveler.\n\nFewer than 15 business days before departure — 100% of the package cost, no refund.",
        ),
        levels: ["net", "full", "full"],
      },
    ],
  },
  {
    id: "israir",
    logo: "/suppliers/israir.png",
    name: t("ישראייר", "Israir"),
    code: "ISRAIR",
    products: [P_FLIGHT(), P_PACKAGE("🏖 חבילות", "🏖 Packages")],
    blocks: [
      {
        kind: "table",
        caption: t(
          "📋 דמי ביטול — נטו ספק (טיסות + חבילות)",
          "📋 Cancellation fees — net supplier (flights + packages)",
        ),
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "net",
            "עד 21 ימי עסקים טרם הטיסה",
            "Up to 21 business days before the flight",
            "35%",
            "35%",
          ),
          row(
            "net",
            "14–21 ימי עסקים טרם הטיסה",
            "14–21 business days before the flight",
            "50%",
            "50%",
          ),
          row(
            "gross",
            "7–14 ימי עסקים טרם הטיסה",
            "7–14 business days before the flight",
            "75%",
            "75%",
          ),
          row(
            "gross",
            "7 ימי עסקים עד 24 שעות טרם הטיסה",
            "7 business days to 24 hours before the flight",
            "90%",
            "90%",
          ),
          row(
            "full",
            "פחות מ-24 שעות טרם הטיסה",
            "Fewer than 24 hours before the flight",
            "100% (למעט מיסי נמל)",
            "100% (except airport taxes)",
          ),
        ],
      },
      {
        kind: "table",
        caption: t("🔄 דמי שינוי — טיסות בלבד", "🔄 Change fees — flights only"),
        headers: [H_TIME_CHANGE, H_CHANGE_PAX],
        rows: [
          row(
            "low",
            "עד 21 ימי עסקים טרם הטיסה",
            "Up to 21 business days before the flight",
            "100$ + הפרשי מחיר",
            "$100 + fare difference",
          ),
          row(
            "net",
            "14–21 ימי עסקים טרם הטיסה",
            "14–21 business days before the flight",
            "150$ + הפרשי מחיר",
            "$150 + fare difference",
          ),
          row(
            "gross",
            "7–14 ימי עסקים טרם הטיסה",
            "7–14 business days before the flight",
            "250$ + הפרשי מחיר",
            "$250 + fare difference",
          ),
          row(
            "full",
            "פחות מ-7 ימי עסקים טרם הטיסה",
            "Fewer than 7 business days before the flight",
            "לא ניתן לבצע שינוי",
            "Change not permitted",
          ),
        ],
      },
      {
        kind: "table",
        caption: t("🔄 דמי שינוי — חבילות", "🔄 Change fees — packages"),
        headers: [H_TIME_CHANGE, H_CHANGE_PAX],
        rows: [
          row(
            "net",
            "עד 21 ימי עסקים טרם הטיסה",
            "Up to 21 business days before the flight",
            "150$ + הפרשי מחיר",
            "$150 + fare difference",
          ),
          row(
            "gross",
            "14–21 ימי עסקים טרם הטיסה",
            "14–21 business days before the flight",
            "250$ + הפרשי מחיר",
            "$250 + fare difference",
          ),
          row(
            "full",
            "פחות מ-14 ימי עסקים טרם הטיסה",
            "Fewer than 14 business days before the flight",
            "לא ניתן לבצע שינוי",
            "Change not permitted",
          ),
        ],
      },
      {
        kind: "table",
        caption: t('👤 שינוי שם בהזמנה לחו"ל', "👤 Name change on an overseas booking"),
        rows: [
          row(
            "net",
            "עד 24 שעות לפני הטיסה הלוך",
            "Up to 24 hours before the outbound flight",
            "100$ לנוסע (בכפוף לתנאי הכרטיס)",
            "$100 per traveler (subject to ticket terms)",
          ),
          row(
            "full",
            "פחות מ-24 שעות לפני הטיסה הלוך",
            "Fewer than 24 hours before the outbound flight",
            "נחשב כביטול + הזמנה חדשה",
            "Treated as cancellation + new booking",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "flight",
          "לאחר מכן ועד 21 ימי עסקים טרם הטיסה — 45% לנוסע.\n\n14–21 ימי עסקים טרם הטיסה — 60% לנוסע.\n\n7–14 ימי עסקים טרם הטיסה — 85% לנוסע.\n\nפחות מ-7 ימי עסקים טרם הטיסה — 100% לנוסע, ללא כל החזר (למעט מיסי נמל).",
          "Thereafter and up to 21 business days before the flight — 45% per traveler.\n\n14–21 business days before the flight — 60% per traveler.\n\n7–14 business days before the flight — 85% per traveler.\n\nFewer than 7 business days before the flight — 100% per traveler, no refund (except airport taxes).",
        ),
        levels: ["net", "gross", "gross", "full"],
      },
    ],
  },
  {
    id: "kishrei",
    logo: "/suppliers/kishrei.png",
    name: t("קשרי תעופה", "Kishrei Teufa"),
    code: "KISHREI",
    products: [
      P_FLIGHT("✈ טיסות שכר", "✈ Charter flights"),
      P_PACKAGE("🏖 חבילות נופש", "🏖 Vacation packages"),
      P_ORGANIZED(),
      P_PACKAGE("⛷ חבילות סקי", "⛷ Ski packages"),
      P_PACKAGE("🏟 ספורט/הופעות", "🏟 Sports / concerts"),
    ],
    blocks: [
      {
        kind: "heading",
        text: t("🏖 חבילות נופש + טיסות שכר", "🏖 Vacation packages + charter flights"),
      },
      {
        kind: "table",
        caption: CAP_INTERNAL_SHORT,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "low",
            "מרגע ביצוע ההזמנה עד 30 ימים לפני היציאה",
            "From booking until 30 days before departure",
            "100$",
            "$100",
          ),
          row("net", "29–14 ימים לפני היציאה", "29–14 days before departure", "50%", "50%"),
          row("gross", "13–7 ימים לפני היציאה", "13–7 days before departure", "80%", "80%"),
          row(
            "full",
            "6 ימים ועד יום היציאה",
            "6 days until departure day",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "departure",
          "לאחר מכן ועד 30 ימים לפני היציאה — 185$ לאדם.\n\n29–14 ימים לפני היציאה — 60% לאדם.\n\n13–7 ימים לפני היציאה — 90% לאדם.\n\n6 ימים ועד יום היציאה — 100% לאדם, ללא כל החזר.",
          "Thereafter and up to 30 days before departure — $185 per person.\n\n29–14 days before departure — 60% per person.\n\n13–7 days before departure — 90% per person.\n\n6 days until departure day — 100% per person, no refund.",
        ),
        levels: ["low", "net", "gross", "full"],
      },
      { kind: "heading", text: t("🚌 טיולים מאורגנים", "🚌 Organized tours") },
      { kind: "subheading", tone: "accent", text: t("✈ טיסות סדירות", "✈ Scheduled flights") },
      {
        kind: "table",
        caption: CAP_INTERNAL_SHORT,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "low",
            "מרגע ביצוע ההזמנה עד 45 ימים לפני היציאה",
            "From booking until 45 days before departure",
            "100$",
            "$100",
          ),
          row("net", "44–30 ימים לפני היציאה", "44–30 days before departure", "25%", "25%"),
          row("net", "29–14 ימים לפני היציאה", "29–14 days before departure", "50%", "50%"),
          row("gross", "13–7 ימים לפני היציאה", "13–7 days before departure", "80%", "80%"),
          row(
            "full",
            "6 ימים ועד יום היציאה",
            "6 days until departure day",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      { kind: "subheading", tone: "gold", text: t("✈ טיסות שכר", "✈ Charter flights") },
      {
        kind: "table",
        caption: CAP_INTERNAL_SHORT,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "low",
            "מרגע ביצוע ההזמנה עד 30 ימים לפני היציאה",
            "From booking until 30 days before departure",
            "100$",
            "$100",
          ),
          row("net", "29–14 ימים לפני היציאה", "29–14 days before departure", "50%", "50%"),
          row("gross", "13–7 ימים לפני היציאה", "13–7 days before departure", "80%", "80%"),
          row(
            "full",
            "6 ימים ועד יום היציאה",
            "6 days until departure day",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "departure",
          "לאחר מכן ועד 45 ימים לפני היציאה — 185$ לאדם.\n\n44–30 ימים לפני היציאה — 35% לאדם.\n\n29–14 ימים לפני היציאה — 60% לאדם.\n\n13–7 ימים לפני היציאה — 90% לאדם.\n\n6 ימים ועד יום היציאה — 100% לאדם, ללא כל החזר.",
          "Thereafter and up to 45 days before departure — $185 per person.\n\n44–30 days before departure — 35% per person.\n\n29–14 days before departure — 60% per person.\n\n13–7 days before departure — 90% per person.\n\n6 days until departure day — 100% per person, no refund.",
        ),
        levels: ["low", "net", "net", "gross", "full"],
      },
      {
        kind: "copy",
        text: copyText(
          "departure",
          "לאחר מכן ועד 30 ימים לפני היציאה — 185$ לאדם.\n\n29–14 ימים לפני היציאה — 60% לאדם.\n\n13–7 ימים לפני היציאה — 90% לאדם.\n\n6 ימים ועד יום היציאה — 100% לאדם, ללא כל החזר.",
          "Thereafter and up to 30 days before departure — $185 per person.\n\n29–14 days before departure — 60% per person.\n\n13–7 days before departure — 90% per person.\n\n6 days until departure day — 100% per person, no refund.",
        ),
        levels: ["low", "net", "gross", "full"],
      },
      { kind: "heading", text: t("⛷ חבילות סקי", "⛷ Ski packages") },
      {
        kind: "table",
        caption: CAP_INTERNAL_SHORT,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "net",
            "מרגע ביצוע ההזמנה עד 30 ימים לפני היציאה",
            "From booking until 30 days before departure",
            "50%",
            "50%",
          ),
          row("gross", "29–14 ימים לפני היציאה", "29–14 days before departure", "80%", "80%"),
          row(
            "full",
            "13 ימים ועד יום היציאה",
            "13 days until departure day",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "departure",
          "לאחר מכן ועד 30 ימים לפני היציאה — 60% מעלות החבילה לאדם.\n\n29–14 ימים לפני היציאה — 90% מעלות החבילה לאדם.\n\n13 ימים ועד יום היציאה — 100% מעלות החבילה, ללא כל החזר.",
          "Thereafter and up to 30 days before departure — 60% of the package cost per person.\n\n29–14 days before departure — 90% of the package cost per person.\n\n13 days until departure day — 100% of the package cost, no refund.",
        ),
        levels: ["net", "gross", "full"],
      },
      { kind: "heading", text: t("🎄 לפלנד", "🎄 Lapland") },
      {
        kind: "table",
        caption: CAP_INTERNAL_SHORT,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "low",
            "מרגע ביצוע ההזמנה עד 60 ימים לפני היציאה",
            "From booking until 60 days before departure",
            "500€ לנוסע",
            "€500 per traveler",
          ),
          row(
            "net",
            "59–30 ימים לפני היציאה",
            "59–30 days before departure",
            "1,000€ לנוסע",
            "€1,000 per traveler",
          ),
          row(
            "gross",
            "29–22 ימים לפני היציאה",
            "29–22 days before departure",
            "1,500€ לנוסע",
            "€1,500 per traveler",
          ),
          row(
            "full",
            "21 ימים ועד יום היציאה",
            "21 days until departure day",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "departure",
          "לאחר מכן ועד 60 ימים לפני היציאה — 600€ לאדם.\n\n59–30 ימים לפני היציאה — 1,100€ לאדם.\n\n29–22 ימים לפני היציאה — 1,600€ לאדם.\n\n21 ימים ועד יום היציאה — 100% מעלות החבילה, ללא כל החזר.",
          "Thereafter and up to 60 days before departure — €600 per person.\n\n59–30 days before departure — €1,100 per person.\n\n29–22 days before departure — €1,600 per person.\n\n21 days until departure day — 100% of the package cost, no refund.",
        ),
        levels: ["low", "net", "gross", "full"],
      },
      { kind: "heading", text: t("🏟 חבילות ספורט / הופעות", "🏟 Sports / concert packages") },
      {
        kind: "table",
        caption: t("⚠ לאחר חוק הגנת הצרכן", "⚠ After the Consumer Protection Law period"),
        rows: [
          row(
            "full",
            "בכל מועד לאחר תקופת חוק הגנת הצרכן",
            "At any time after the Consumer Protection Law period",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "departure",
          "לאחר מכן — 100% מעלות החבילה, ללא כל החזר.",
          "Thereafter — 100% of the package cost, no refund.",
        ),
        levels: ["full"],
      },
    ],
  },
  {
    id: "kavei",
    logo: "/suppliers/kavei.png",
    name: t("קווי חופשה", "Kavei Hufsha"),
    code: "KAVEI",
    products: [
      P_FLIGHT(),
      P_PACKAGE("🏖 חבילות נופש", "🏖 Vacation packages"),
      P_ORGANIZED("🚌 מאורגנים", "🚌 Organized tours"),
    ],
    blocks: [
      {
        kind: "table",
        caption: CAP_INTERNAL,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "full",
            "לאחר תקופת חוק הגנת הצרכן — בכל מועד",
            "After the Consumer Protection Law period — at any time",
            "100% מהסכום — ללא החזר",
            "100% of the amount — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "flight",
          "לאחר מכן — 100% מהסכום, ללא כל החזר (Non-Refundable).",
          "Thereafter — 100% of the amount, no refund (non-refundable).",
        ),
        levels: ["full"],
      },
    ],
  },
];

// ── Locale-resolved view types ───────────────────────────────────────────────
export type ViewFeeRow = { timeframe: string; fee: string; level: FeeLevel };
export type ViewBlock =
  | { kind: "heading"; text: string }
  | { kind: "subheading"; text: string; tone: "accent" | "gold" }
  | { kind: "table"; caption: string; headers: [string, string] | null; rows: ViewFeeRow[] }
  | { kind: "copy"; text: string; levels: FeeLevel[] };
export type ViewProduct = { kind: ProductKind; label: string };
export type ViewCancelSupplier = {
  id: string;
  logo: string | null;
  name: string;
  code: string;
  products: ViewProduct[];
  blocks: ViewBlock[];
  /** Lowercased he + en + code, for client-side filtering across both locales. */
  search: string;
};

/** All cancellation suppliers, resolved to `locale`, in guide order. */
export function getCancellations(locale: string): ViewCancelSupplier[] {
  const pick = (v: Localized) => localized(v, locale as Locale);
  return SUPPLIERS.map((s) => ({
    id: s.id,
    logo: s.logo ?? null,
    name: pick(s.name),
    code: s.code,
    products: s.products.map((p) => ({ kind: p.kind, label: pick(p.label) })),
    blocks: s.blocks.map((b): ViewBlock => {
      switch (b.kind) {
        case "heading":
          return { kind: "heading", text: pick(b.text) };
        case "subheading":
          return { kind: "subheading", text: pick(b.text), tone: b.tone };
        case "table":
          return {
            kind: "table",
            caption: pick(b.caption),
            headers: b.headers ? [pick(b.headers[0]), pick(b.headers[1])] : null,
            rows: b.rows.map((r) => ({
              timeframe: pick(r.timeframe),
              fee: pick(r.fee),
              level: r.level,
            })),
          };
        case "copy":
          return {
            kind: "copy",
            text: pick(b.text),
            levels: b.levels ?? [],
          };
      }
    }),
    search: `${s.name.he ?? ""} ${s.name.en ?? ""} ${s.code}`.toLowerCase(),
  }));
}
