import type {
  CancelBlock as Block,
  CancelProduct as Product,
  Localized,
} from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { localized, usingDatabase } from "@/lib/hotels";

/**
 * Cancellation-fee guide per supplier. Each card holds the internal NET fee
 * tables (supplier cost) plus ready-to-send "client copy" scripts that keep a
 * 10% gross margin and fold in the Israeli Consumer Protection Law. Curated
 * editorial data: the array below is the seed source (`bun run seed`) and the
 * no-DB fallback; with `DATABASE_URL` configured the page reads the
 * `supplier_cancellations` table. Resolved to the active locale on the server.
 */

export type { FeeLevel, FeeRow, ProductKind } from "@/db/schema";
export type { CancelBlock as Block, CancelProduct as Product } from "@/db/schema";
import type { FeeLevel, FeeRow, ProductKind } from "@/db/schema";

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

// Unified product tags — every card draws from this canonical set so the same
// product always shows the same label.
const P_FLIGHT: Product = { kind: "flight", label: t("✈️ טיסות בלבד", "✈️ Flights only") };
const P_PACKAGE: Product = { kind: "package", label: t("🏖️ חבילות נופש", "🏖️ Vacation packages") };
const P_ORGANIZED: Product = {
  kind: "organized",
  label: t("🚌 טיולים מאורגנים", "🚌 Organized tours"),
};
const P_VILLAGE: Product = { kind: "package", label: t("🌴 כפרי נופש", "🌴 Holiday villages") };
const P_SKI: Product = { kind: "package", label: t("⛷️ חבילות סקי", "⛷️ Ski packages") };
const P_SPORTS: Product = {
  kind: "package",
  label: t("🏟️ חבילות ספורט/הופעות", "🏟️ Sports / concerts"),
};

// Canonical render order for product tags — core categories first, then extras.
export const PRODUCT_ORDER: Product[] = [P_FLIGHT, P_PACKAGE, P_ORGANIZED, P_SPORTS, P_SKI, P_VILLAGE];

// Table header presets.
const H_TIME_CANCEL = t("מועד ביטול", "Cancellation timing");
const H_TIME_CHANGE = t("מועד שינוי", "Change timing");
const H_FEE_PAX_NET = t("דמי ביטול לנוסע (נטו ספק)", "Cancellation fee / traveler (net)");
const H_CHANGE_PAX = t("עלות שינוי לנוסע", "Change cost / traveler");

const CAP_INTERNAL = t("דמי ביטול לנוסע (נטו ספק)", "Cancellation fee / traveler (net)");
const CAP_INTERNAL_SHORT = t("דמי ביטול לנוסע (נטו ספק)", "Cancellation fee / traveler (net)");
const CAP_CHANGE = t("עלות שינוי לנוסע (נטו ספק)", "Change cost / traveler (net)");
const CAP_CANCEL_CHANGE = t(
  "דמי ביטול/שינוי לנוסע (נטו ספק)",
  "Cancellation / change fee / traveler (net)",
);

/**
 * Builds a client-copy script. Every script opens with the Consumer Protection
 * Law clause (which varies only by "before the flight" / "before departure"),
 * then the supplier-specific tiers.
 */
function copyText(when: "flight" | "departure", he: string, en: string): Localized {
  const wHe = when === "flight" ? "לפני הטיסה" : "לפני היציאה";
  const wEn = when === "flight" ? "before the flight" : "before departure";
  const lawHe = `עד 14 ימים קלנדריים מיום ההזמנה, בתנאי שיש לפחות 7 ימי עסקים ${wHe} — 100 ₪ לנוסע או 5% ממחיר העסקה (הנמוך מביניהם) — בהתאם לחוק הגנת הצרכן.`;
  const lawEn = `Up to 14 calendar days from booking, provided there are at least 7 business days ${wEn} — ₪100 per traveler or 5% of the transaction price (whichever is lower) — per the Consumer Protection Law.`;
  return t(`${lawHe}\n\n${he}`, `${lawEn}\n\n${en}`);
}

/**
 * Client copy for *change* fees (not a cancellation, so no Consumer-Protection
 * clause). Opens with a short lead — dropped from the displayed table but kept
 * in the copied text — followed by one `timeframe — fee` tier per paragraph.
 */
function changeCopy(he: string, en: string): Localized {
  const leadHe = "דמי שינוי לנוסע (כולל מרווח הסוכן):";
  const leadEn = "Change fee per traveler (incl. agency margin):";
  return t(`${leadHe}\n\n${he}`, `${leadEn}\n\n${en}`);
}

/** Curated cancellation data, in guide order — the DB seed source and no-DB fallback. */
export const SUPPLIERS: CancelSupplier[] = [
  {
    id: "flying",
    logo: "/suppliers/flying.png",
    name: t("שטיח מעופף", "Flying Carpet"),
    code: "FLYING",
    products: [P_FLIGHT, P_PACKAGE, P_ORGANIZED],
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
            "30% מהעלות",
            "30% of cost",
          ),
          row(
            "gross",
            "14–8 ימי עסקים לפני הטיסה",
            "14–8 business days before the flight",
            "60% מהעלות",
            "60% of cost",
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
          "לאחר מכן ועד 21 ימי עסקים לפני הטיסה — 195$ לנוסע.\n\nמ-21 ימי עסקים לפני הטיסה ועד 15 ימי עסקים לפניה — 40% מהעלות לנוסע.\n\nמ-14 ימי עסקים ועד 8 ימי עסקים לפני הטיסה — 70% מהעלות לנוסע.\n\n7 ימי עסקים לפני הטיסה ומטה — 100% מהעלות, ללא כל החזר.",
          "Thereafter and up to 21 business days before the flight — $195 per traveler.\n\nFrom 21 to 15 business days before the flight — 40% of the cost per traveler.\n\nFrom 14 to 8 business days before the flight — 70% of the cost per traveler.\n\n7 business days before the flight or fewer — 100% of the cost, no refund.",
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
    products: [P_FLIGHT, P_PACKAGE, P_VILLAGE, P_ORGANIZED],
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
            "25% מהעלות",
            "25% of cost",
          ),
          row(
            "gross",
            "27–15 ימי עסקים לפני היציאה",
            "27–15 business days before departure",
            "50% מהעלות",
            "50% of cost",
          ),
          row(
            "gross",
            "14–7 ימי עסקים לפני היציאה",
            "14–7 business days before departure",
            "75% מהעלות",
            "75% of cost",
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
          "לאחר מכן ועד 28 ימי עסקים לפני היציאה — 35% מהעלות לנוסע.\n\n27–15 ימי עסקים לפני היציאה — 60% מהעלות לנוסע.\n\n14–7 ימי עסקים לפני היציאה — 85% מהעלות לנוסע.\n\nפחות מ-7 ימי עסקים לפני היציאה — 100% מהעלות, ללא כל החזר.",
          "Thereafter and up to 28 business days before departure — 35% of the cost per traveler.\n\n27–15 business days before departure — 60% of the cost per traveler.\n\n14–7 business days before departure — 85% of the cost per traveler.\n\nFewer than 7 business days before departure — 100% of the cost, no refund.",
        ),
        levels: ["net", "gross", "gross", "full"],
      },
      { kind: "heading", text: t("🌺 סיישל / זנזיבר", "🌺 Seychelles / Zanzibar") },
      {
        kind: "table",
        caption: CAP_INTERNAL,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "net",
            "מיום ביצוע ההזמנה עד 28 ימי עסקים לפני היציאה",
            "From booking until 28 business days before departure",
            "25% מהעלות",
            "25% of cost",
          ),
          row(
            "full",
            "27–15 ימי עסקים לפני היציאה",
            "27–15 business days before departure",
            "75% מהעלות",
            "75% of cost",
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
          "לאחר מכן ועד 28 ימי עסקים לפני היציאה — 35% מהעלות לנוסע.\n\n27–15 ימי עסקים לפני היציאה — 85% מהעלות לנוסע.\n\nפחות מ-15 ימי עסקים לפני היציאה — 100% מהעלות, ללא כל החזר.",
          "Thereafter and up to 28 business days before departure — 35% of the cost per traveler.\n\n27–15 business days before departure — 85% of the cost per traveler.\n\nFewer than 15 business days before departure — 100% of the cost, no refund.",
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
    products: [
      P_FLIGHT,
      P_PACKAGE,
      { kind: "organized", label: t("🚌 טיולים מאורגנים (נתור)", "🚌 Organized tours (Natour)") },
    ],
    blocks: [
      { kind: "heading", text: t("✈️ טיסות + חבילות", "✈️ Flights + packages") },
      {
        kind: "table",
        caption: CAP_INTERNAL,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "net",
            "עד 21 ימי עסקים טרם הטיסה",
            "Up to 21 business days before the flight",
            "35% מהעלות",
            "35% of cost",
          ),
          row(
            "net",
            "14–21 ימי עסקים טרם הטיסה",
            "14–21 business days before the flight",
            "50% מהעלות",
            "50% of cost",
          ),
          row(
            "gross",
            "7–14 ימי עסקים טרם הטיסה",
            "7–14 business days before the flight",
            "75% מהעלות",
            "75% of cost",
          ),
          row(
            "gross",
            "7 ימי עסקים עד 24 שעות טרם הטיסה",
            "7 business days to 24 hours before the flight",
            "90% מהעלות",
            "90% of cost",
          ),
          row(
            "full",
            "פחות מ-24 שעות טרם הטיסה",
            "Fewer than 24 hours before the flight",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "flight",
          "לאחר מכן ועד 21 ימי עסקים טרם הטיסה — 45% מהעלות לנוסע.\n\n14–21 ימי עסקים טרם הטיסה — 60% מהעלות לנוסע.\n\n7–14 ימי עסקים טרם הטיסה — 85% מהעלות לנוסע.\n\nפחות מ-7 ימי עסקים טרם הטיסה — 100% מהעלות, ללא כל החזר.",
          "Thereafter and up to 21 business days before the flight — 45% of the cost per traveler.\n\n14–21 business days before the flight — 60% of the cost per traveler.\n\n7–14 business days before the flight — 85% of the cost per traveler.\n\nFewer than 7 business days before the flight — 100% of the cost, no refund.",
        ),
        levels: ["net", "gross", "gross", "full"],
      },
      { kind: "heading", text: t("🔄 דמי שינוי", "🔄 Change fees") },
      { kind: "subheading", text: t("✈️ טיסות בלבד", "✈️ Flights only"), tone: "accent" },
      {
        kind: "table",
        caption: CAP_CHANGE,
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
        kind: "copy",
        title: t("דמי שינוי ללקוח", "Change fee for client"),
        variant: "change",
        text: changeCopy(
          "עד 21 ימי עסקים טרם הטיסה — 195$ + הפרשי מחיר.\n\n14–21 ימי עסקים טרם הטיסה — 245$ + הפרשי מחיר.\n\n7–14 ימי עסקים טרם הטיסה — 345$ + הפרשי מחיר.\n\nפחות מ-7 ימי עסקים טרם הטיסה — לא ניתן לבצע שינוי.",
          "Up to 21 business days before the flight — $195 + fare difference.\n\n14–21 business days before the flight — $245 + fare difference.\n\n7–14 business days before the flight — $345 + fare difference.\n\nFewer than 7 business days before the flight — change not permitted.",
        ),
        levels: ["low", "net", "gross", "full"],
      },
      { kind: "subheading", text: t("🏖️ חבילות נופש", "🏖️ Vacation packages"), tone: "accent" },
      {
        kind: "table",
        caption: CAP_CHANGE,
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
        kind: "copy",
        title: t("דמי שינוי ללקוח", "Change fee for client"),
        variant: "change",
        text: changeCopy(
          "עד 21 ימי עסקים טרם הטיסה — 245$ + הפרשי מחיר.\n\n14–21 ימי עסקים טרם הטיסה — 345$ + הפרשי מחיר.\n\nפחות מ-14 ימי עסקים טרם הטיסה — לא ניתן לבצע שינוי.",
          "Up to 21 business days before the flight — $245 + fare difference.\n\n14–21 business days before the flight — $345 + fare difference.\n\nFewer than 14 business days before the flight — change not permitted.",
        ),
        levels: ["net", "gross", "full"],
      },
      {
        kind: "heading",
        text: t('👤 שינוי שם בהזמנה לחו"ל', "👤 Name change on an overseas booking"),
      },
      {
        kind: "table",
        caption: t("עלות שינוי שם (נטו ספק)", "Name-change cost (net)"),
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
        title: t("שינוי שם ללקוח", "Name change for client"),
        variant: "change",
        text: t(
          "עלות שינוי שם לנוסע:\n\nעד 24 שעות לפני הטיסה הלוך — 195$ לנוסע (בכפוף לתנאי הכרטיס)\n\nפחות מ-24 שעות לפני הטיסה הלוך — נחשב כביטול + הזמנה חדשה",
          "Name-change cost per traveler:\n\nUp to 24 hours before the outbound flight — $195 per traveler (subject to ticket terms).\n\nFewer than 24 hours before the outbound flight — treated as cancellation + new booking.",
        ),
        levels: ["net", "full"],
      },
      {
        kind: "heading",
        text: t("🚌 טיולים מאורגנים (נתור)", "🚌 Organized tours (Natour)"),
      },
      {
        kind: "subheading",
        tone: "accent",
        text: t(
          "🌍 כל היעדים פרט ללפלנד, המזרח הרחוק, דרום ומרכז אמריקה",
          "🌍 All destinations except Lapland, Far East, South & Central America",
        ),
      },
      {
        kind: "table",
        caption: CAP_CANCEL_CHANGE,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "low",
            "עד 21 ימי עסקים לפני יציאת הטיול",
            "Up to 21 business days before tour departure",
            "100$ / 100€",
            "$100 / €100",
          ),
          row(
            "gross",
            "21–15 ימי עסקים לפני היציאה",
            "21–15 business days before departure",
            "50% מהעלות",
            "50% of cost",
          ),
          row(
            "gross",
            "15–5 ימי עסקים לפני היציאה",
            "15–5 business days before departure",
            "75% מהעלות",
            "75% of cost",
          ),
          row(
            "full",
            "פחות מ-5 ימי עסקים לפני היציאה",
            "Fewer than 5 business days before departure",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "departure",
          "לאחר מכן ועד 21 ימי עסקים לפני היציאה — 195$ / 195€ לנוסע.\n\n21–15 ימי עסקים לפני היציאה — 60% מהעלות לנוסע.\n\n15–5 ימי עסקים לפני היציאה — 85% מהעלות לנוסע.\n\nפחות מ-5 ימי עסקים לפני היציאה — 100% מהעלות, ללא כל החזר.",
          "Thereafter and up to 21 business days before departure — $195 / €195 per traveler.\n\n21–15 business days before departure — 60% of the cost per traveler.\n\n15–5 business days before departure — 85% of the cost per traveler.\n\nFewer than 5 business days before departure — 100% of the cost, no refund.",
        ),
        levels: ["low", "gross", "gross", "full"],
      },
      { kind: "subheading", tone: "gold", text: t("❄️ לפלנד", "❄️ Lapland") },
      {
        kind: "table",
        caption: CAP_CANCEL_CHANGE,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "low",
            "מרגע הרישום עד 60 ימי עסקים לפני היציאה",
            "From registration until 60 business days before departure",
            "50$",
            "$50",
          ),
          row(
            "net",
            "59–30 ימי עסקים לפני היציאה",
            "59–30 business days before departure",
            "35% מהעלות",
            "35% of cost",
          ),
          row(
            "gross",
            "29–15 ימי עסקים לפני היציאה",
            "29–15 business days before departure",
            "75% מהעלות",
            "75% of cost",
          ),
          row(
            "full",
            "14 ימי עסקים ומטה לפני היציאה",
            "14 business days or fewer before departure",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "departure",
          "לאחר מכן ועד 60 ימי עסקים לפני היציאה — 145$ לנוסע.\n\n59–30 ימי עסקים לפני היציאה — 45% מהעלות לנוסע.\n\n29–15 ימי עסקים לפני היציאה — 85% מהעלות לנוסע.\n\n14 ימי עסקים ומטה לפני היציאה — 100% מהעלות, ללא כל החזר.",
          "Thereafter and up to 60 business days before departure — $145 per traveler.\n\n59–30 business days before departure — 45% of the cost per traveler.\n\n29–15 business days before departure — 85% of the cost per traveler.\n\n14 business days or fewer before departure — 100% of the cost, no refund.",
        ),
        levels: ["low", "net", "gross", "full"],
      },
      {
        kind: "subheading",
        tone: "accent",
        text: t("🌏 המזרח הרחוק, דרום ומרכז אמריקה", "🌏 Far East, South & Central America"),
      },
      {
        kind: "table",
        caption: CAP_CANCEL_CHANGE,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "low",
            "עד 60 ימי עסקים לפני היציאה",
            "Up to 60 business days before departure",
            "350$",
            "$350",
          ),
          row(
            "net",
            "59–45 ימי עסקים לפני היציאה",
            "59–45 business days before departure",
            "25% מהעלות",
            "25% of cost",
          ),
          row(
            "gross",
            "44–21 ימי עסקים לפני היציאה",
            "44–21 business days before departure",
            "50% מהעלות",
            "50% of cost",
          ),
          row(
            "full",
            "21 ימי עסקים ומטה לפני היציאה",
            "21 business days or fewer before departure",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "departure",
          "לאחר מכן ועד 60 ימי עסקים לפני היציאה — 445$ לנוסע.\n\n59–45 ימי עסקים לפני היציאה — 35% מהעלות לנוסע.\n\n44–21 ימי עסקים לפני היציאה — 60% מהעלות לנוסע.\n\n21 ימי עסקים ומטה לפני היציאה — 100% מהעלות, ללא כל החזר.",
          "Thereafter and up to 60 business days before departure — $445 per traveler.\n\n59–45 business days before departure — 35% of the cost per traveler.\n\n44–21 business days before departure — 60% of the cost per traveler.\n\n21 business days or fewer before departure — 100% of the cost, no refund.",
        ),
        levels: ["low", "net", "gross", "full"],
      },
    ],
  },
  {
    id: "kishrei-teufa",
    logo: "/suppliers/kishrei-teufa.png",
    name: t("קשרי תעופה", "Kishrei Teufa"),
    code: "KISHREI",
    products: [P_FLIGHT, P_PACKAGE, P_ORGANIZED, P_SKI, P_SPORTS],
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
          "לאחר מכן ועד 30 ימים לפני היציאה — 195$ לנוסע.\n\n29–14 ימים לפני היציאה — 60% לנוסע.\n\n13–7 ימים לפני היציאה — 90% לנוסע.\n\n6 ימים ועד יום היציאה — 100% לנוסע, ללא כל החזר.",
          "Thereafter and up to 30 days before departure — $195 per traveler.\n\n29–14 days before departure — 60% per traveler.\n\n13–7 days before departure — 90% per traveler.\n\n6 days until departure day — 100% per traveler, no refund.",
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
      {
        kind: "copy",
        text: copyText(
          "departure",
          "לאחר מכן ועד 45 ימים לפני היציאה — 195$ לנוסע.\n\n44–30 ימים לפני היציאה — 35% לנוסע.\n\n29–14 ימים לפני היציאה — 60% לנוסע.\n\n13–7 ימים לפני היציאה — 90% לנוסע.\n\n6 ימים ועד יום היציאה — 100% לנוסע, ללא כל החזר.",
          "Thereafter and up to 45 days before departure — $195 per traveler.\n\n44–30 days before departure — 35% per traveler.\n\n29–14 days before departure — 60% per traveler.\n\n13–7 days before departure — 90% per traveler.\n\n6 days until departure day — 100% per traveler, no refund.",
        ),
        levels: ["low", "net", "net", "gross", "full"],
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
          "לאחר מכן ועד 30 ימים לפני היציאה — 195$ לנוסע.\n\n29–14 ימים לפני היציאה — 60% לנוסע.\n\n13–7 ימים לפני היציאה — 90% לנוסע.\n\n6 ימים ועד יום היציאה — 100% לנוסע, ללא כל החזר.",
          "Thereafter and up to 30 days before departure — $195 per traveler.\n\n29–14 days before departure — 60% per traveler.\n\n13–7 days before departure — 90% per traveler.\n\n6 days until departure day — 100% per traveler, no refund.",
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
          "לאחר מכן ועד 30 ימים לפני היציאה — 60% מהעלות לנוסע.\n\n29–14 ימים לפני היציאה — 90% מהעלות לנוסע.\n\n13 ימים ועד יום היציאה — 100% מהעלות, ללא כל החזר.",
          "Thereafter and up to 30 days before departure — 60% of the cost per traveler.\n\n29–14 days before departure — 90% of the cost per traveler.\n\n13 days until departure day — 100% of the cost, no refund.",
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
          "לאחר מכן ועד 60 ימים לפני היציאה — 600€ לנוסע.\n\n59–30 ימים לפני היציאה — 1,100€ לנוסע.\n\n29–22 ימים לפני היציאה — 1,600€ לנוסע.\n\n21 ימים ועד יום היציאה — 100% מהעלות, ללא כל החזר.",
          "Thereafter and up to 60 days before departure — €600 per traveler.\n\n59–30 days before departure — €1,100 per traveler.\n\n29–22 days before departure — €1,600 per traveler.\n\n21 days until departure day — 100% of the cost, no refund.",
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
          "לאחר מכן — 100% מהעלות, ללא כל החזר.",
          "Thereafter — 100% of the cost, no refund.",
        ),
        levels: ["full"],
      },
    ],
  },
  {
    id: "kavei-hufsha",
    logo: "/suppliers/kavei-hufsha.png",
    name: t("קווי חופשה", "Kavei Hufsha"),
    code: "KAVEI",
    products: [P_FLIGHT, P_PACKAGE, P_ORGANIZED],
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
          "לאחר מכן — 100% מהסכום, ללא כל החזר.",
          "Thereafter — 100% of the amount, no refund.",
        ),
        levels: ["full"],
      },
    ],
  },
  {
    id: "eshet-tours",
    logo: "/suppliers/eshet-tours.png",
    name: t("אשת טורס", "Eshet Tours"),
    code: "ESHET",
    products: [P_FLIGHT, P_PACKAGE, P_ORGANIZED],
    blocks: [
      { kind: "heading", text: t("✈️ טיסות + חבילות נופש", "✈️ Flights + vacation packages") },
      {
        kind: "table",
        caption: CAP_INTERNAL,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "net",
            "עד 22 ימי עסקים לפני היציאה",
            "Up to 22 business days before departure",
            "25% מהעלות",
            "25% of cost",
          ),
          row(
            "gross",
            "21–15 ימי עסקים לפני היציאה",
            "21–15 business days before departure",
            "50% מהעלות",
            "50% of cost",
          ),
          row(
            "gross",
            "14–8 ימי עסקים לפני היציאה",
            "14–8 business days before departure",
            "75% מהעלות",
            "75% of cost",
          ),
          row(
            "full",
            "7 ימי עסקים ומטה לפני היציאה",
            "7 business days or fewer before departure",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "departure",
          "לאחר מכן ועד 22 ימי עסקים לפני היציאה — 35% מהעלות לנוסע.\n\n21–15 ימי עסקים לפני היציאה — 60% מהעלות לנוסע.\n\n14–8 ימי עסקים לפני היציאה — 85% מהעלות לנוסע.\n\n7 ימי עסקים ומטה לפני היציאה — 100% מהעלות, ללא כל החזר.",
          "Thereafter and up to 22 business days before departure — 35% of the cost per traveler.\n\n21–15 business days before departure — 60% of the cost per traveler.\n\n14–8 business days before departure — 85% of the cost per traveler.\n\n7 business days or fewer before departure — 100% of the cost, no refund.",
        ),
        levels: ["net", "gross", "gross", "full"],
      },
      { kind: "heading", text: t("🚌 טיולים מאורגנים", "🚌 Organized tours") },
      {
        kind: "table",
        caption: CAP_INTERNAL,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "net",
            "עד 22 ימי עסקים לפני היציאה",
            "Up to 22 business days before departure",
            "25% מהעלות",
            "25% of cost",
          ),
          row(
            "gross",
            "21–15 ימי עסקים לפני היציאה",
            "21–15 business days before departure",
            "50% מהעלות",
            "50% of cost",
          ),
          row(
            "gross",
            "14–8 ימי עסקים לפני היציאה",
            "14–8 business days before departure",
            "75% מהעלות",
            "75% of cost",
          ),
          row(
            "full",
            "7 ימי עסקים ומטה לפני היציאה",
            "7 business days or fewer before departure",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "departure",
          "לאחר מכן ועד 22 ימי עסקים לפני היציאה — 35% מהעלות לנוסע.\n\n21–15 ימי עסקים לפני היציאה — 60% מהעלות לנוסע.\n\n14–8 ימי עסקים לפני היציאה — 85% מהעלות לנוסע.\n\n7 ימי עסקים ומטה לפני היציאה — 100% מהעלות, ללא כל החזר.",
          "Thereafter and up to 22 business days before departure — 35% of the cost per traveler.\n\n21–15 business days before departure — 60% of the cost per traveler.\n\n14–8 business days before departure — 85% of the cost per traveler.\n\n7 business days or fewer before departure — 100% of the cost, no refund.",
        ),
        levels: ["net", "gross", "gross", "full"],
      },
    ],
  },
  {
    id: "wtc",
    logo: "/suppliers/wtc.png",
    name: t("WTC", "WTC"),
    code: "WTC",
    products: [P_FLIGHT, P_PACKAGE],
    blocks: [
      {
        kind: "heading",
        text: t(
          "🗓️ כל התאריכים פרט ליולי–אוגוסט וחגים",
          "🗓️ All dates except July–August & holidays",
        ),
      },
      {
        kind: "table",
        caption: CAP_INTERNAL,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "low",
            "מרגע ביצוע ההזמנה עד 31 ימי עסקים לפני הטיסה",
            "From booking until 31 business days before the flight",
            "100$",
            "$100",
          ),
          row(
            "net",
            "30–15 ימי עסקים לפני הטיסה",
            "30–15 business days before the flight",
            "40% מהעלות",
            "40% of cost",
          ),
          row(
            "gross",
            "14–8 ימי עסקים לפני הטיסה",
            "14–8 business days before the flight",
            "75% מהעלות",
            "75% of cost",
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
          "לאחר מכן ועד 31 ימי עסקים לפני הטיסה — 195$ לנוסע.\n\n30–15 ימי עסקים לפני הטיסה — 50% מהעלות לנוסע.\n\n14–8 ימי עסקים לפני הטיסה — 85% מהעלות לנוסע.\n\n7 ימי עסקים ומטה לפני הטיסה — 100% מהעלות, ללא כל החזר.",
          "Thereafter and up to 31 business days before the flight — $195 per traveler.\n\n30–15 business days before the flight — 50% of the cost per traveler.\n\n14–8 business days before the flight — 85% of the cost per traveler.\n\n7 business days or fewer before the flight — 100% of the cost, no refund.",
        ),
        levels: ["low", "net", "gross", "full"],
      },
      {
        kind: "heading",
        text: t(
          "☀️ יולי–אוגוסט וחגים (פסח, שבועות, ראש השנה, סוכות)",
          "☀️ July–August & holidays (Passover, Shavuot, Rosh Hashanah, Sukkot)",
        ),
      },
      {
        kind: "table",
        caption: CAP_INTERNAL,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "low",
            "מרגע ביצוע ההזמנה עד 61 ימים לפני הטיסה",
            "From booking until 61 days before the flight",
            "100$",
            "$100",
          ),
          row(
            "net",
            "60–45 ימי עסקים לפני הטיסה",
            "60–45 business days before the flight",
            "25% מהעלות",
            "25% of cost",
          ),
          row(
            "gross",
            "44–31 ימי עסקים לפני הטיסה",
            "44–31 business days before the flight",
            "50% מהעלות",
            "50% of cost",
          ),
          row(
            "full",
            "30 ימי עסקים ומטה לפני הטיסה",
            "30 business days or fewer before the flight",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "flight",
          "לאחר מכן ועד 61 ימים לפני הטיסה — 195$ לנוסע.\n\n60–45 ימי עסקים לפני הטיסה — 35% מהעלות לנוסע.\n\n44–31 ימי עסקים לפני הטיסה — 60% מהעלות לנוסע.\n\n30 ימי עסקים ומטה לפני הטיסה — 100% מהעלות, ללא כל החזר.",
          "Thereafter and up to 61 days before the flight — $195 per traveler.\n\n60–45 business days before the flight — 35% of the cost per traveler.\n\n44–31 business days before the flight — 60% of the cost per traveler.\n\n30 business days or fewer before the flight — 100% of the cost, no refund.",
        ),
        levels: ["low", "net", "gross", "full"],
      },
    ],
  },
  {
    id: "mona-tours",
    logo: "/suppliers/mona-tours.png",
    name: t("מונה טורס", "Mona Tours"),
    code: "MONA",
    products: [P_FLIGHT, P_PACKAGE],
    blocks: [
      {
        kind: "table",
        caption: CAP_INTERNAL,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "full",
            "מתום תקופת חוק הגנת הצרכן ואילך",
            "After the Consumer Protection Law window",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "flight",
          "לאחר מכן — 100% מהעלות, ללא כל החזר.",
          "Thereafter — 100% of the cost, no refund.",
        ),
        levels: ["full"],
      },
    ],
  },
  {
    id: "ayala",
    logo: "/suppliers/ayala.png",
    name: t("איילה", "Ayala"),
    code: "AYALA",
    products: [P_FLIGHT, P_PACKAGE],
    blocks: [
      {
        kind: "table",
        caption: CAP_INTERNAL,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "full",
            "מתום תקופת חוק הגנת הצרכן ואילך",
            "After the Consumer Protection Law window",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "flight",
          "לאחר מכן — 100% מהעלות, ללא כל החזר.",
          "Thereafter — 100% of the cost, no refund.",
        ),
        levels: ["full"],
      },
    ],
  },
  {
    id: "disenhause",
    logo: "/suppliers/disenhause.png",
    name: t("דיזנהאוז", "Diesenhaus"),
    code: "DEASY",
    products: [P_FLIGHT, P_PACKAGE],
    blocks: [
      {
        kind: "table",
        caption: CAP_INTERNAL,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "full",
            "מתום תקופת חוק הגנת הצרכן ואילך",
            "After the Consumer Protection Law window",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "flight",
          "לאחר מכן — 100% מהעלות, ללא כל החזר.",
          "Thereafter — 100% of the cost, no refund.",
        ),
        levels: ["full"],
      },
    ],
  },
  {
    id: "arkia",
    logo: "/suppliers/arkia.png",
    name: t("ארקיע", "Arkia"),
    code: "ARKIA",
    products: [P_FLIGHT, P_PACKAGE],
    blocks: [
      {
        kind: "heading",
        text: t(
          '✈️ טיסות סדירות — ארה"ב, תאילנד, ויאטנאם, יפן',
          "✈️ Scheduled flights — USA, Thailand, Vietnam, Japan",
        ),
      },
      {
        kind: "table",
        caption: CAP_INTERNAL,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "net",
            "עד 24 שעות לפני הטיסה",
            "Up to 24 hours before the flight",
            "270$ לכיוון",
            "$270 per direction",
          ),
          row(
            "full",
            "24 שעות ומטה לפני הטיסה",
            "24 hours or fewer before the flight",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "flight",
          "לאחר מכן ועד 24 שעות לפני הטיסה — 365$ לכיוון לנוסע.\n\n24 שעות ומטה לפני הטיסה — 100% מהעלות, ללא כל החזר.",
          "Thereafter and up to 24 hours before the flight — $365 per direction, per traveler.\n\n24 hours or fewer before the flight — 100% of the cost, no refund.",
        ),
        levels: ["net", "full"],
      },
      {
        kind: "heading",
        text: t("🌍 שאר היעדים + חבילות נופש", "🌍 All other destinations + vacation packages"),
      },
      { kind: "subheading", tone: "accent", text: t("🗓️ 1.10–16.6", "🗓️ Oct 1 – Jun 16") },
      {
        kind: "table",
        caption: CAP_INTERNAL,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "net",
            "מיום ביצוע ההזמנה עד 22 ימים לפני הטיסה",
            "From booking until 22 days before the flight",
            "25% מהעלות",
            "25% of cost",
          ),
          row(
            "gross",
            "21–15 ימים לפני הטיסה",
            "21–15 days before the flight",
            "50% מהעלות",
            "50% of cost",
          ),
          row(
            "gross",
            "14–4 ימים לפני הטיסה",
            "14–4 days before the flight",
            "75% מהעלות",
            "75% of cost",
          ),
          row(
            "full",
            "3 ימים ומטה לפני הטיסה",
            "3 days or fewer before the flight",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "flight",
          "לאחר מכן ועד 22 ימים לפני הטיסה — 35% מהעלות לנוסע.\n\n21–15 ימים לפני הטיסה — 60% מהעלות לנוסע.\n\n14–4 ימים לפני הטיסה — 85% מהעלות לנוסע.\n\n3 ימים ומטה לפני הטיסה — 100% מהעלות, ללא כל החזר.",
          "Thereafter and up to 22 days before the flight — 35% of the cost per traveler.\n\n21–15 days before the flight — 60% of the cost per traveler.\n\n14–4 days before the flight — 85% of the cost per traveler.\n\n3 days or fewer before the flight — 100% of the cost, no refund.",
        ),
        levels: ["net", "gross", "gross", "full"],
      },
      {
        kind: "subheading",
        tone: "gold",
        text: t("☀️ 17.6–30.9 (עונת שיא)", "☀️ Jun 17 – Sep 30 (peak season)"),
      },
      {
        kind: "table",
        caption: CAP_INTERNAL,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "gross",
            "מיום ביצוע ההזמנה עד 22 ימים לפני הטיסה",
            "From booking until 22 days before the flight",
            "50% מהעלות",
            "50% of cost",
          ),
          row(
            "gross",
            "21–8 ימים לפני הטיסה",
            "21–8 days before the flight",
            "75% מהעלות",
            "75% of cost",
          ),
          row(
            "full",
            "7 ימים ומטה לפני הטיסה",
            "7 days or fewer before the flight",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "flight",
          "לאחר מכן ועד 22 ימים לפני הטיסה — 60% מהעלות לנוסע.\n\n21–8 ימים לפני הטיסה — 85% מהעלות לנוסע.\n\n7 ימים ומטה לפני הטיסה — 100% מהעלות, ללא כל החזר.",
          "Thereafter and up to 22 days before the flight — 60% of the cost per traveler.\n\n21–8 days before the flight — 85% of the cost per traveler.\n\n7 days or fewer before the flight — 100% of the cost, no refund.",
        ),
        levels: ["gross", "gross", "full"],
      },
      { kind: "heading", text: t("🔄 דמי שינוי", "🔄 Change fees") },
      {
        kind: "subheading",
        tone: "accent",
        text: t(
          '✈️ טיסות סדירות — ארה"ב, תאילנד, ויאטנאם, יפן',
          "✈️ Scheduled flights — USA, Thailand, Vietnam, Japan",
        ),
      },
      {
        kind: "table",
        caption: CAP_CHANGE,
        headers: [H_TIME_CHANGE, H_CHANGE_PAX],
        rows: [
          row(
            "low",
            "מרגע ההזמנה עד 24 שעות טרם הטיסה",
            "From booking until 24 hours before the flight",
            "170$ לכיוון + הפרשי מחיר",
            "$170 per direction + fare difference",
          ),
          row(
            "full",
            "24 שעות ומטה טרם הטיסה",
            "24 hours or fewer before the flight",
            "לא ניתן לבצע שינוי",
            "Change not permitted",
          ),
        ],
      },
      {
        kind: "copy",
        title: t("דמי שינוי ללקוח", "Change fee for client"),
        variant: "change",
        text: changeCopy(
          "מרגע ההזמנה עד 24 שעות טרם הטיסה — 265$ לכיוון + הפרשי מחיר.\n\n24 שעות ומטה טרם הטיסה — לא ניתן לבצע שינוי.",
          "From booking until 24 hours before the flight — $265 per direction + fare difference.\n\n24 hours or fewer before the flight — change not permitted.",
        ),
        levels: ["low", "full"],
      },
    ],
  },
  {
    id: "rimon",
    logo: "/suppliers/rimon.png",
    name: t("רימון", "Rimon"),
    code: "RIMON",
    products: [P_ORGANIZED],
    blocks: [
      {
        kind: "table",
        caption: CAP_INTERNAL,
        headers: [H_TIME_CANCEL, H_FEE_PAX_NET],
        rows: [
          row(
            "low",
            "מרגע ההרשמה עד 60 ימי עסקים לפני היציאה",
            "From registration until 60 business days before departure",
            "50$",
            "$50",
          ),
          row(
            "net",
            "פחות מ-60 עד 45 ימי עסקים לפני היציאה",
            "Under 60 to 45 business days before departure",
            "35% מהעלות",
            "35% of cost",
          ),
          row(
            "gross",
            "פחות מ-45 עד 14 ימי עסקים לפני היציאה",
            "Under 45 to 14 business days before departure",
            "55% מהעלות",
            "55% of cost",
          ),
          row(
            "full",
            "פחות מ-14 ימי עסקים עד היציאה",
            "Under 14 business days until departure",
            "100% — ללא החזר",
            "100% — no refund",
          ),
        ],
      },
      {
        kind: "copy",
        text: copyText(
          "departure",
          "לאחר מכן ועד 60 ימי עסקים לפני היציאה — 145$ לנוסע.\n\nפחות מ-60 עד 45 ימי עסקים לפני היציאה — 45% מהעלות לנוסע.\n\nפחות מ-45 עד 14 ימי עסקים לפני היציאה — 65% מהעלות לנוסע.\n\nפחות מ-14 ימי עסקים עד היציאה — 100% מהעלות, ללא כל החזר.",
          "Thereafter and up to 60 business days before departure — $145 per traveler.\n\nUnder 60 to 45 business days before departure — 45% of the cost per traveler.\n\nUnder 45 to 14 business days before departure — 65% of the cost per traveler.\n\nUnder 14 business days until departure — 100% of the cost, no refund.",
        ),
        levels: ["low", "net", "gross", "full"],
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
  | {
      kind: "copy";
      text: string;
      levels: FeeLevel[];
      title: string | null;
      variant: "change" | null;
    };
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

/** Cancellation sets from Neon when configured, otherwise the in-code array. */
async function loadCancelSuppliers(): Promise<CancelSupplier[]> {
  if (!usingDatabase()) {
    // Pre-sort products to match the stored order (the seed sorts the same way;
    // PRODUCT_ORDER identity comparison only works against the in-module data).
    return SUPPLIERS.map((s) => ({
      ...s,
      products: [...s.products].sort(
        (a, b) => PRODUCT_ORDER.indexOf(a) - PRODUCT_ORDER.indexOf(b),
      ),
    }));
  }
  const { db } = await import("@/db");
  const rows = await db.query.supplierCancellations.findMany({
    with: { supplier: true },
    orderBy: (t, { asc }) => [asc(t.sortOrder)],
  });
  return rows.map((r) => ({
    id: r.supplier.slug,
    logo: r.supplier.logo ?? undefined,
    name: r.supplier.name,
    code: r.supplier.code,
    products: r.products,
    blocks: r.blocks,
  }));
}

/** All cancellation suppliers, resolved to `locale`, in guide order. */
export async function getCancellations(locale: string): Promise<ViewCancelSupplier[]> {
  const pick = (v: Localized) => localized(v, locale as Locale);
  const suppliers = await loadCancelSuppliers();
  return suppliers.map((s) => ({
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
            title: b.title ? pick(b.title) : null,
            variant: b.variant ?? null,
          };
      }
    }),
    search: `${s.name.he ?? ""} ${s.name.en ?? ""} ${s.code}`.toLowerCase(),
  }));
}
