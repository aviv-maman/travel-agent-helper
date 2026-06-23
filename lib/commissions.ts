import type { Localized } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { localized } from "@/lib/hotels";

/**
 * Supplier commission guide. This is curated, fairly static editorial data
 * (not hotel inventory), so it lives in code rather than the DB — mirroring the
 * structure of the original single-page guide. Every text value is `Localized`
 * and resolved to the active locale on the server (see `getCommissions`), so the
 * client only ever receives the language it displays.
 */

/** Semantic color token for a supplier's icon chip. */
export type CommColor =
  | "brand"
  | "success"
  | "gold"
  | "warning"
  | "purple"
  | "destructive"
  | "muted";

/**
 * Commission level → drives the percentage color (matches the legend):
 * high = green (10%+), mid = blue (7–9.5%), low = orange (5–6%),
 * range = gold (a span like 7–10% or "varies"), net = red ("net price").
 */
export type CommLevel = "high" | "mid" | "low" | "range" | "net";

/** Which glyph leads a baggage row (and its color). */
export type BaggageIcon = "bag" | "money" | "ok" | "warn";

export type CommissionRate = {
  label: Localized;
  /** Display value, e.g. "7.5%" / "7–10%" or a localized phrase like "net price". */
  value: Localized;
  level: CommLevel;
};

export type BaggageRow = {
  icon: BaggageIcon;
  /** May contain `**bold**` spans (rendered as emphasis). */
  text: Localized;
};

export type Supplier = {
  id: string;
  /** Leading emoji shown in the icon chip. */
  emoji: string;
  color: CommColor;
  name: Localized;
  alias?: Localized;
  rates: CommissionRate[];
  baggage: BaggageRow[];
  note?: Localized;
  noteVariant?: "default" | "red";
};

const t = (he: string, en: string): Localized => ({ he, en });

// Shared rate-category labels — written once, reused across suppliers.
const FLIGHTS_ONLY = t("✈️ טיסות בלבד", "✈️ Flights Only");
const PACKAGES = t("🏖️ חבילות", "🏖️ Packages");
const ORGANIZED_TOURS = t("🧳 טיולים מאורגנים", "🧳 Organized Tours");

// Shared baggage lines reused across many suppliers.
const BACKPACK = (): BaggageRow => ({
  icon: "bag",
  text: t('תיק גב עד 4 ק"ג — כלול תמיד', "Backpack up to 4 kg — always included"),
});
const ARKIA_TROLLEY = (price = 60): BaggageRow => ({
  icon: "warn",
  text: t(
    `טיסות/חבילות בחב' ארקיע: טרולי לא כלול — **${price}$ נטו**`,
    `Flights/packages on Arkia: trolley not included — **$${price} net**`,
  ),
});

const SUPPLIERS: Supplier[] = [
  {
    id: "israir",
    emoji: "✈",
    color: "brand",
    name: t("Israir", "Israir"),
    alias: t("ידוע גם כ: Unital (טיולים מאורגנים)", "Also known as: Unital (organized tours)"),
    rates: [
      { label: FLIGHTS_ONLY, value: t("7.5%", "7.5%"), level: "mid" },
      { label: PACKAGES, value: t("9.5%", "9.5%"), level: "high" },
      { label: ORGANIZED_TOURS, value: t("7.5%", "7.5%"), level: "mid" },
    ],
    baggage: [
      BACKPACK(),
      {
        icon: "money",
        text: t(
          "טיסות — מזוודה וטרולי לא כלולים, תוספת: מזוודה: **130$ ברוטו** · טרולי: **60$ ברוטו**",
          "Flights — suitcase & trolley not included, add: suitcase **$130 gross** · trolley **$60 gross**",
        ),
      },
      {
        icon: "money",
        text: t(
          "חבילות — מזוודה וטרולי לא כלולים, תוספת: מזוודה: **130$ ברוטו** · טרולי: **60$ ברוטו**",
          "Packages — suitcase & trolley not included, add: suitcase **$130 gross** · trolley **$60 gross**",
        ),
      },
      {
        icon: "ok",
        text: t(
          "מאורגנים: מזוודה גדולה + טרולי כלולים",
          "Organized tours: large suitcase + trolley included",
        ),
      },
    ],
  },
  {
    id: "kavei-hofesha",
    emoji: "⛔",
    color: "muted",
    name: t("קוי חופשה", "Kavei Hofesha"),
    alias: t("מחיר נטו — ללא עמלה", "Net price — no commission"),
    rates: [
      {
        label: FLIGHTS_ONLY,
        value: t("מחיר נטו", "Net price"),
        level: "net",
      },
      {
        label: PACKAGES,
        value: t("מחיר נטו", "Net price"),
        level: "net",
      },
      {
        label: ORGANIZED_TOURS,
        value: t("מחיר נטו", "Net price"),
        level: "net",
      },
    ],
    baggage: [
      BACKPACK(),
      {
        icon: "money",
        text: t(
          "טיסות — מזוודה וטרולי לא כלולים, תוספת: מזוודה: **92$ נטו** · טרולי: **42$ נטו**",
          "Flights — suitcase & trolley not included, add: suitcase **$92 net** · trolley **$42 net**",
        ),
      },
      {
        icon: "money",
        text: t(
          "חבילות — מזוודה וטרולי לא כלולים, תוספת: מזוודה: **92$ נטו** · טרולי: **42$ נטו**",
          "Packages — suitcase & trolley not included, add: suitcase **$92 net** · trolley **$42 net**",
        ),
      },
      {
        icon: "ok",
        text: t("דובאי: מזוודה + טרולי **כלולים**", "Dubai: suitcase + trolley **included**"),
      },
    ],
  },
  {
    id: "flying",
    emoji: "🪄",
    color: "gold",
    name: t("שטיח מעופף — Flying", "Flying Carpet — Flying"),
    alias: t("ספק ראשי", "Primary supplier"),
    rates: [
      { label: FLIGHTS_ONLY, value: t("5%", "5%"), level: "low" },
      { label: PACKAGES, value: t("11%", "11%"), level: "high" },
      { label: ORGANIZED_TOURS, value: t("9%", "9%"), level: "high" },
    ],
    baggage: [
      BACKPACK(),
      {
        icon: "ok",
        text: t("טיסות: מזוודה גדולה + טרולי כלולים", "Flights: large suitcase + trolley included"),
      },
      {
        icon: "ok",
        text: t(
          "חבילות: מזוודה גדולה + טרולי כלולים",
          "Packages: large suitcase + trolley included",
        ),
      },
      ARKIA_TROLLEY(60),
      {
        icon: "warn",
        text: t(
          "טיסות ישראייר לפראג ובודפשט: מזוודה גדולה וטרולי **לא כלולים**",
          "Israir flights to Prague & Budapest: large suitcase & trolley **not included**",
        ),
      },
    ],
    note: t(
      "**🏖️ חבילות נופש בלבד**\n📅 ינואר–יוני + ספטמבר–דצמבר: להוריד **20$ לאדם** ממחיר Market\n☀️ יולי–אוגוסט: להוריד **25$ לאדם** ממחיר Market\n\n**✈️ טיסות בלבד**\nלהוריד **10$ לאדם** ממחיר Market",
      "**🏖️ Vacation packages only**\n📅 Jan–Jun + Sep–Dec: subtract **$20 per person** off the Market price\n☀️ Jul–Aug: subtract **$25 per person** off the Market price\n\n**✈️ Flights only**\nSubtract **$10 per person** off the Market price",
    ),
  },
  {
    id: "flying-sp",
    emoji: "🪄",
    color: "destructive",
    name: t("שטיח מעופף — FlyingSP", "Flying Carpet — FlyingSP"),
    alias: t("ספק משנה", "Sub-supplier"),
    rates: [
      { label: FLIGHTS_ONLY, value: t("5%", "5%"), level: "low" },
      { label: PACKAGES, value: t("7%", "7%"), level: "mid" },
    ],
    baggage: [
      BACKPACK(),
      {
        icon: "ok",
        text: t("טיסות: מזוודה גדולה + טרולי כלולים", "Flights: large suitcase + trolley included"),
      },
      {
        icon: "ok",
        text: t(
          "חבילות: מזוודה גדולה + טרולי כלולים",
          "Packages: large suitcase + trolley included",
        ),
      },
      ARKIA_TROLLEY(60),
      {
        icon: "warn",
        text: t(
          "טיסות ישראייר לפראג ובודפשט: מזוודה גדולה וטרולי **לא כלולים**",
          "Israir flights to Prague & Budapest: large suitcase & trolley **not included**",
        ),
      },
    ],
    note: t(
      "⚠️ עמלת חבילות נמוכה ב-4% מהספק הראשי Flying",
      "⚠️ Package commission is 4% lower than the primary supplier Flying",
    ),
    noteVariant: "red",
  },
  {
    id: "kishrei-teufa",
    emoji: "🌍",
    color: "gold",
    name: t("קשרי תעופה", "Kishrei Teufa"),
    alias: t(
      "עמלה מיוחדת לדובאי · מאורגנים משתנה",
      "Special commission for Dubai · organized tours vary",
    ),
    rates: [
      { label: FLIGHTS_ONLY, value: t("7%", "7%"), level: "mid" },
      {
        label: t("✈️ טיסה בלבד — דובאי", "✈️ Flight only — Dubai"),
        value: t("10%", "10%"),
        level: "high",
      },
      { label: PACKAGES, value: t("10%", "10%"), level: "high" },
      {
        label: ORGANIZED_TOURS,
        value: t("7–10%", "7–10%"),
        level: "range",
      },
    ],
    baggage: [
      BACKPACK(),
      {
        icon: "ok",
        text: t(
          "טיסות בלבד: מזוודה גדולה + טרולי כלולים",
          "Flight only: large suitcase + trolley included",
        ),
      },
      {
        icon: "ok",
        text: t(
          "חבילות: מזוודה גדולה + טרולי כלולים",
          "Packages: large suitcase + trolley included",
        ),
      },
      ARKIA_TROLLEY(60),
    ],
    note: t(
      "מאורגנים: יש לוודא עמלה ספציפית לכל טיול",
      "Organized tours: confirm the specific commission for each trip",
    ),
  },
  {
    id: "eshet-tours",
    emoji: "🌺",
    color: "success",
    name: t("אשת טורס", "Eshet Tours"),
    rates: [
      { label: FLIGHTS_ONLY, value: t("5%", "5%"), level: "low" },
      { label: PACKAGES, value: t("10%", "10%"), level: "high" },
      { label: ORGANIZED_TOURS, value: t("7%", "7%"), level: "mid" },
    ],
    baggage: [
      BACKPACK(),
      {
        icon: "ok",
        text: t(
          "טיסות בלבד: מזוודה גדולה + טרולי כלולים",
          "Flight only: large suitcase + trolley included",
        ),
      },
      {
        icon: "ok",
        text: t(
          "חבילות: מזוודה גדולה + טרולי כלולים",
          "Packages: large suitcase + trolley included",
        ),
      },
      {
        icon: "warn",
        text: t(
          "טיסות/חבילות בחב' ארקיע: טרולי לא כלול — **40$ נטו** (נבדק במאורגנים בלבד)",
          "Flights/packages on Arkia: trolley not included — **$40 net** (verified for organized tours only)",
        ),
      },
    ],
  },
  {
    id: "arkia",
    emoji: "🛫",
    color: "destructive",
    name: t("ארקיע", "Arkia"),
    alias: t("עמלה מיוחדת לבנגקוק ו-New York", "Special commission for Bangkok & New York"),
    rates: [
      { label: FLIGHTS_ONLY, value: t("6%", "6%"), level: "low" },
      {
        label: t("✈️ בנגקוק / ניו יורק", "✈️ Bangkok / New York"),
        value: t("7%", "7%"),
        level: "mid",
      },
      { label: PACKAGES, value: t("10%", "10%"), level: "high" },
    ],
    baggage: [
      { icon: "bag", text: t('תיק גב עד 4 ק"ג — כלול', "Backpack up to 4 kg — included") },
      {
        icon: "money",
        text: t(
          "טיסות — מזוודה וטרולי לא כלולים, תוספת: מזוודה: **100$ נטו** · טרולי: **50$ נטו**",
          "Flights — suitcase & trolley not included, add: suitcase **$100 net** · trolley **$50 net**",
        ),
      },
      {
        icon: "money",
        text: t(
          "חבילות — מזוודה וטרולי לא כלולים, תוספת: מזוודה: **100$ נטו** · טרולי: **50$ נטו**",
          "Packages — suitcase & trolley not included, add: suitcase **$100 net** · trolley **$50 net**",
        ),
      },
      {
        icon: "ok",
        text: t(
          "מאורגנים: מזוודה גדולה + טרולי כלולים",
          "Organized tours: large suitcase + trolley included",
        ),
      },
      {
        icon: "ok",
        text: t(
          "בנגקוק ו-New York: מזוודה גדולה + טרולי כלולים",
          "Bangkok & New York: large suitcase + trolley included",
        ),
      },
    ],
  },
  {
    id: "mona-tours",
    emoji: "🌴",
    color: "success",
    name: t("מונה טורס", "Mona Tours"),
    rates: [
      { label: FLIGHTS_ONLY, value: t("5%", "5%"), level: "low" },
      { label: PACKAGES, value: t("10%", "10%"), level: "high" },
    ],
    baggage: [
      BACKPACK(),
      {
        icon: "ok",
        text: t(
          "טיסות בלבד: מזוודה גדולה + טרולי כלולים",
          "Flight only: large suitcase + trolley included",
        ),
      },
      {
        icon: "ok",
        text: t(
          "חבילות: מזוודה גדולה + טרולי כלולים",
          "Packages: large suitcase + trolley included",
        ),
      },
      ARKIA_TROLLEY(60),
    ],
  },
  {
    id: "issta",
    emoji: "🏢",
    color: "brand",
    name: t("איסתא (Issta)", "Issta"),
    alias: t("לפעמים עמלה מיוחדת במאורגנים", "Sometimes a special commission on organized tours"),
    rates: [
      { label: FLIGHTS_ONLY, value: t("7%", "7%"), level: "mid" },
      { label: PACKAGES, value: t("9.5%", "9.5%"), level: "high" },
      { label: ORGANIZED_TOURS, value: t("7%", "7%"), level: "mid" },
    ],
    baggage: [
      { icon: "bag", text: t('תיק גב עד 4 ק"ג — כלול', "Backpack up to 4 kg — included") },
      {
        icon: "money",
        text: t(
          "טיסות — מזוודה וטרולי לא כלולים, תוספת: מזוודה: **120$ ברוטו** · טרולי: **60$ ברוטו**",
          "Flights — suitcase & trolley not included, add: suitcase **$120 gross** · trolley **$60 gross**",
        ),
      },
      {
        icon: "ok",
        text: t("חבילות נופש: טרולי כלול בחינם", "Vacation packages: trolley included free"),
      },
      {
        icon: "money",
        text: t(
          "חבילות: מזוודה גדולה לא כלולה — תוספת: **100$ ברוטו**",
          "Packages: large suitcase not included — add: **$100 gross**",
        ),
      },
    ],
    note: t(
      "מאורגנים מסוימים — עמלה מיוחדת של 10%",
      "Certain organized tours — a special 10% commission",
    ),
  },
  {
    id: "wtc",
    emoji: "🌐",
    color: "brand",
    name: t("WTC", "WTC"),
    rates: [
      { label: FLIGHTS_ONLY, value: t("5%", "5%"), level: "low" },
      { label: PACKAGES, value: t("8%", "8%"), level: "mid" },
    ],
    baggage: [
      BACKPACK(),
      {
        icon: "ok",
        text: t(
          "טיסות בלבד: מזוודה גדולה + טרולי כלולים",
          "Flight only: large suitcase + trolley included",
        ),
      },
      {
        icon: "ok",
        text: t(
          "חבילות: מזוודה גדולה + טרולי כלולים",
          "Packages: large suitcase + trolley included",
        ),
      },
      {
        icon: "warn",
        text: t(
          "טיסות/חבילות בחב' ארקיע: לוודא אם טרולי כלול",
          "Flights/packages on Arkia: verify whether the trolley is included",
        ),
      },
    ],
  },
  {
    id: "ayala",
    emoji: "💎",
    color: "purple",
    name: t("Ayala — איילה", "Ayala"),
    rates: [
      { label: FLIGHTS_ONLY, value: t("5%", "5%"), level: "low" },
      { label: PACKAGES, value: t("7%", "7%"), level: "mid" },
    ],
    baggage: [
      BACKPACK(),
      {
        icon: "ok",
        text: t(
          "טיסות בלבד: מזוודה גדולה + טרולי כלולים",
          "Flight only: large suitcase + trolley included",
        ),
      },
      {
        icon: "ok",
        text: t(
          "חבילות: מזוודה גדולה + טרולי כלולים",
          "Packages: large suitcase + trolley included",
        ),
      },
    ],
  },
  {
    id: "disenhause",
    emoji: "🏛",
    color: "success",
    name: t("Disenhause — דיזנהאוז", "Diesenhaus"),
    alias: t("לבדוק שלא השתנה", "Check that it hasn't changed"),
    rates: [
      { label: FLIGHTS_ONLY, value: t("7%", "7%"), level: "mid" },
      { label: PACKAGES, value: t("7%", "7%"), level: "mid" },
    ],
    baggage: [
      BACKPACK(),
      {
        icon: "ok",
        text: t(
          "טיסות בלבד: מזוודה גדולה + טרולי כלולים",
          "Flight only: large suitcase + trolley included",
        ),
      },
      {
        icon: "ok",
        text: t(
          "חבילות: מזוודה גדולה + טרולי כלולים",
          "Packages: large suitcase + trolley included",
        ),
      },
      ARKIA_TROLLEY(60),
    ],
    note: t("לבדוק תקופתית — תנאים עשויים להשתנות", "Check periodically — terms may change"),
  },
  {
    id: "rimon",
    emoji: "🍎",
    color: "warning",
    name: t("רימון", "Rimon"),
    alias: t("מאורגנים בלבד", "Organized tours only"),
    rates: [
      {
        label: t("🧳 מאורגנים עד $3,000 לאדם", "🧳 Organized tours up to $3,000 pp"),
        value: t("10%", "10%"),
        level: "high",
      },
      {
        label: t("🧳 מאורגנים מעל $3,000 לאדם", "🧳 Organized tours over $3,000 pp"),
        value: t("משתנה", "Varies"),
        level: "range",
      },
    ],
    baggage: [
      BACKPACK(),
      {
        icon: "ok",
        text: t(
          "מאורגנים: מזוודה גדולה + טרולי כלולים",
          "Organized tours: large suitcase + trolley included",
        ),
      },
    ],
    note: t(
      "מעל $3,000 לאדם — לברר עמלה ספציפית לכל טיול",
      "Over $3,000 per person — confirm the specific commission per trip",
    ),
  },
];

// ── Locale-resolved view types (what the client receives) ────────────────────
export type ViewRate = { label: string; value: string; level: CommLevel };
export type ViewBaggageRow = { icon: BaggageIcon; text: string };
export type ViewSupplier = {
  id: string;
  emoji: string;
  color: CommColor;
  name: string;
  alias: string | null;
  rates: ViewRate[];
  baggage: ViewBaggageRow[];
  note: string | null;
  noteVariant: "default" | "red";
  /** Lowercased he + en name + alias, for client-side filtering across locales. */
  search: string;
};

/** All suppliers, resolved to `locale`, in guide order. */
export function getCommissions(locale: string): ViewSupplier[] {
  const pick = (v: Localized) => localized(v, locale as Locale);
  return SUPPLIERS.map((s) => ({
    id: s.id,
    emoji: s.emoji,
    color: s.color,
    name: pick(s.name),
    alias: s.alias ? pick(s.alias) : null,
    rates: s.rates.map((r) => ({ label: pick(r.label), value: pick(r.value), level: r.level })),
    baggage: s.baggage.map((b) => ({ icon: b.icon, text: pick(b.text) })),
    note: s.note ? pick(s.note) : null,
    noteVariant: s.noteVariant ?? "default",
    search: `${s.name.he ?? ""} ${s.name.en ?? ""} ${s.alias?.he ?? ""} ${s.alias?.en ?? ""}`
      .toLowerCase()
      .trim(),
  }));
}
