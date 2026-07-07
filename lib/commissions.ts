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

/**
 * Commission level → drives the percentage color (matches the legend):
 * high = green (10%+), mid = blue (7–9.5%), low = orange (5–6%),
 * range = gold (a span like 7–10% or "varies"), net = red ("net price").
 */
export type CommLevel = "high" | "mid" | "low" | "range" | "net";

/** Which glyph leads a baggage row (and its color). */
export type BaggageIcon = "bag" | "ok" | "warn" | "flight" | "package" | "tour" | "village";

/** A commission percentage for one of the three default categories. */
export type CommissionValue = {
  /** Display value, e.g. "7.5%" / "7–10%" or a localized phrase like "net price". */
  value: Localized;
  level: CommLevel;
};

/** A special/extra commission line carrying its own label (e.g. a per-route deal). */
export type CustomCommission = {
  label: Localized;
  value: Localized;
  level: CommLevel;
};

export type BaggageRow = {
  icon: BaggageIcon;
  /** May contain `**bold**` spans (rendered as emphasis). */
  text: Localized;
};

/** A commission-related note shown below the commission table. */
export type SupplierNote = {
  /** May contain `**bold**` spans and `\n` line breaks. */
  text: Localized;
  /** `info` → grey alert; `warning` → amber alert. */
  variant: "info" | "warning";
  /** Whether to show the variant title (e.g. "הערה חשובה"). Defaults true. */
  showTitle?: boolean;
};

export type Supplier = {
  id: string;
  name: Localized;
  /** Short Latin code shown as a small chip next to the name (same style as the cancellations page). */
  code: string;
  /** Alternate name shown as the card subtitle and indexed for search (e.g. Israir ↔ Natour). */
  alias?: Localized;
  /** Supplier website URL (placeholder for now; wired up elsewhere later). */
  website?: string;
  /** Path to the supplier's logo image (under /public). */
  logo?: string;
  /**
   * The three default commission categories — these mirror the baggage table
   * rows. Any omitted category renders as an empty row.
   */
  flightsOnly?: CommissionValue;
  packages?: CommissionValue;
  organizedTours?: CommissionValue;
  /**
   * Extra/special commission lines, rendered in order if present. Modeled as
   * discrete numbered fields so they map cleanly to future DB columns.
   */
  customCommission1?: CustomCommission;
  customCommission2?: CustomCommission;
  customCommission3?: CustomCommission;
  baggage: BaggageRow[];
  /** Commission-related notes, rendered in order below the commission table. */
  notes?: SupplierNote[];
};

const t = (he: string, en: string): Localized => ({ he, en });

/** Compact builder for a default-category commission value. */
const c = (he: string, en: string, level: CommLevel): CommissionValue => ({
  value: t(he, en),
  level,
});

/** Compact builder for a special/extra commission line. */
const cc = (
  labelHe: string,
  labelEn: string,
  he: string,
  en: string,
  level: CommLevel,
): CustomCommission => ({ label: t(labelHe, labelEn), value: t(he, en), level });

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
    website: "https://www.israir.co.il/",
    logo: "/suppliers/israir.png",
    name: t("ישראייר", "Israir"),
    code: "ISRAIR",
    alias: t("נתור", "Natour"),
    flightsOnly: c("7.5%", "7.5%", "mid"),
    packages: c("9.5%", "9.5%", "high"),
    organizedTours: c("7.5%", "7.5%", "mid"),
    notes: [
      {
        text: t("ידוע גם כנתור בטיולים מאורגנים", "Also known as Natour for organized tours"),
        variant: "info",
        showTitle: false,
      },
    ],
    baggage: [
      BACKPACK(),
      {
        icon: "flight",
        text: t(
          "טיסות בלבד: מזוודה וטרולי לא כלולים\nמזוודה הלוך ושוב: **130$ ברוטו**\nטרולי הלוך ושוב: **60$ ברוטו**",
          "Flights only: suitcase & trolley not included\nSuitcase round trip: **$130 gross**\nTrolley round trip: **$60 gross**",
        ),
      },
      {
        icon: "package",
        text: t(
          "חבילות נופש: מזוודה וטרולי לא כלולים\nמזוודה הלוך ושוב: **130$ ברוטו**\nטרולי הלוך ושוב: **60$ ברוטו**",
          "Vacation packages: suitcase & trolley not included\nSuitcase round trip: **$130 gross**\nTrolley round trip: **$60 gross**",
        ),
      },
      {
        icon: "tour",
        text: t(
          "טיולים מאורגנים: מזוודה וטרולי כלולים",
          "Organized tours: suitcase & trolley included",
        ),
      },
    ],
  },
  {
    id: "kavei-hufsha",
    website: "https://www.kavei.co.il/",
    logo: "/suppliers/kavei-hufsha.png",
    name: t("קווי חופשה", "Kavei Hufsha"),
    code: "KAVEI",
    flightsOnly: c("נטו", "Net", "net"),
    packages: c("נטו", "Net", "net"),
    organizedTours: c("נטו", "Net", "net"),
    baggage: [
      BACKPACK(),
      {
        icon: "flight",
        text: t(
          "טיסות בלבד: מזוודה וטרולי לא כלולים\nמזוודה הלוך ושוב: **120$ נטו**\nטרולי הלוך ושוב: **58$ נטו**",
          "Flights only: suitcase & trolley not included\nSuitcase round trip: **$120 net**\nTrolley round trip: **$58 net**",
        ),
      },
      {
        icon: "package",
        text: t(
          "חבילות נופש: מזוודה וטרולי לא כלולים\nמזוודה הלוך ושוב: **120$ נטו**\nטרולי הלוך ושוב: **58$ נטו**",
          "Vacation packages: suitcase & trolley not included\nSuitcase round trip: **$120 net**\nTrolley round trip: **$58 net**",
        ),
      },
      {
        icon: "ok",
        text: t("דובאי: מזוודה + טרולי **כלולים**", "Dubai: suitcase + trolley **included**"),
      },
    ],
  },
  {
    id: "issta",
    website: "https://www.issta.co.il/",
    logo: "/suppliers/issta.png",
    name: t("איסתא", "Issta"),
    code: "ISSTA",
    flightsOnly: c("7%", "7%", "mid"),
    packages: c("9.5%", "9.5%", "high"),
    organizedTours: c("7%", "7%", "mid"),
    customCommission1: cc("🌴 כפרי נופש", "🌴 Holiday villages", "7%", "7%", "mid"),
    baggage: [
      { icon: "bag", text: t('תיק גב עד 4 ק"ג — כלול', "Backpack up to 4 kg — included") },
      {
        icon: "flight",
        text: t(
          "טיסות בלבד: מזוודה וטרולי לא כלולים\nמזוודה הלוך ושוב: **130$ ברוטו**\nטרולי הלוך ושוב: **60$ ברוטו**",
          "Flights only: suitcase & trolley not included\nSuitcase round trip: **$130 gross**\nTrolley round trip: **$60 gross**",
        ),
      },
      {
        icon: "package",
        text: t(
          "חבילות נופש: טרולי כלול, מזוודה לא כלולה\nמזוודה הלוך ושוב: **110$ ברוטו**",
          "Vacation packages: trolley included, suitcase not included\nSuitcase round trip: **$110 gross**",
        ),
      },
      {
        icon: "village",
        text: t(
          "כפרי נופש: טרולי כלול\nמזוודה הלוך ושוב: **95€ ברוטו**",
          "Holiday villages: trolley included\nSuitcase round trip: **€95 gross**",
        ),
      },
    ],
    notes: [
      {
        text: t(
          "מאורגנים מסוימים — עמלה מיוחדת של 10%",
          "Certain organized tours — a special 10% commission",
        ),
        variant: "warning",
      },
    ],
  },
  {
    id: "flying",
    website: "https://www.flyingcarpet.co.il/",
    logo: "/suppliers/flying.png",
    name: t("שטיח מעופף", "Flying Carpet"),
    code: "FLYING",
    flightsOnly: c("5%", "5%", "low"),
    packages: c("11%", "11%", "high"),
    organizedTours: c("9%", "9%", "high"),
    baggage: [
      BACKPACK(),
      {
        icon: "flight",
        text: t("טיסות בלבד: מזוודה וטרולי כלולים", "Flights only: suitcase & trolley included"),
      },
      {
        icon: "package",
        text: t(
          "חבילות נופש: מזוודה וטרולי כלולים",
          "Vacation packages: suitcase & trolley included",
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
    notes: [
      {
        text: t(
          "**חבילות נופש**\n• ינואר–יוני + ספטמבר–דצמבר: להוריד **20$ לאדם** ממחיר Market\n• יולי–אוגוסט: להוריד **25$ לאדם** ממחיר Market",
          "**Vacation packages**\n• Jan–Jun + Sep–Dec: subtract **$20 per person** off the Market price\n• Jul–Aug: subtract **$25 per person** off the Market price",
        ),
        variant: "warning",
      },
      {
        text: t(
          "**טיסות בלבד**: להוריד **10$ לאדם** ממחיר Market",
          "**Flights only**: subtract **$10 per person** off the Market price",
        ),
        variant: "warning",
      },
    ],
  },
  {
    id: "flying-sp",
    website: "https://www.flyingcarpet.co.il/",
    logo: "/suppliers/flying-sp.png",
    name: t("שטיח מעופף", "Flying Carpet"),
    code: "FLYINGSP",
    flightsOnly: c("5%", "5%", "low"),
    packages: c("7%", "7%", "mid"),
    baggage: [
      BACKPACK(),
      {
        icon: "flight",
        text: t("טיסות בלבד: מזוודה וטרולי כלולים", "Flights only: suitcase & trolley included"),
      },
      {
        icon: "package",
        text: t(
          "חבילות נופש: מזוודה וטרולי כלולים",
          "Vacation packages: suitcase & trolley included",
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
    notes: [
      {
        text: t(
          "עמלת חבילות נמוכה ב-4% מהספק הראשי Flying",
          "Package commission is 4% lower than the primary supplier Flying",
        ),
        variant: "info",
        showTitle: false,
      },
    ],
  },
  {
    id: "eshet-tours",
    website: "https://www.eshet.com/",
    logo: "/suppliers/eshet-tours.png",
    name: t("אשת טורס", "Eshet Tours"),
    code: "ESHET",
    flightsOnly: c("5%", "5%", "low"),
    packages: c("10%", "10%", "high"),
    organizedTours: c("7%", "7%", "mid"),
    baggage: [
      BACKPACK(),
      {
        icon: "flight",
        text: t("טיסות בלבד: מזוודה וטרולי כלולים", "Flight only: suitcase & trolley included"),
      },
      {
        icon: "package",
        text: t(
          "חבילות נופש: מזוודה וטרולי כלולים",
          "Vacation packages: suitcase & trolley included",
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
    website: "https://www.arkia.co.il/",
    logo: "/suppliers/arkia.png",
    name: t("ארקיע", "Arkia"),
    code: "ARKIA",
    flightsOnly: c("6%", "6%", "low"),
    packages: c("10%", "10%", "high"),
    customCommission1: cc(
      "✈️ טיסות בלבד: בנגקוק / ניו יורק",
      "✈️ Bangkok / New York",
      "7%",
      "7%",
      "mid",
    ),
    baggage: [
      { icon: "bag", text: t('תיק גב עד 4 ק"ג — כלול', "Backpack up to 4 kg — included") },
      {
        icon: "flight",
        text: t(
          "טיסות בלבד: מזוודה וטרולי לא כלולים\nמזוודה הלוך ושוב: **100$ נטו**\nטרולי הלוך ושוב: **50$ נטו**",
          "Flights only: suitcase & trolley not included\nSuitcase round trip: **$100 net**\nTrolley round trip: **$50 net**",
        ),
      },
      {
        icon: "package",
        text: t(
          "חבילות נופש: מזוודה וטרולי לא כלולים\nמזוודה הלוך ושוב: **100$ נטו**\nטרולי הלוך ושוב: **50$ נטו**",
          "Vacation packages: suitcase & trolley not included\nSuitcase round trip: **$100 net**\nTrolley round trip: **$50 net**",
        ),
      },
      {
        icon: "tour",
        text: t(
          "טיולים מאורגנים: מזוודה וטרולי כלולים",
          "Organized tours: suitcase & trolley included",
        ),
      },
      {
        icon: "ok",
        text: t(
          "בנגקוק וניו יורק: מזוודה וטרולי כלולים",
          "Bangkok & New York: suitcase & trolley included",
        ),
      },
    ],
  },
  {
    id: "kishrei-teufa",
    website: "https://www.kishrey-teufa.co.il/",
    logo: "/suppliers/kishrei-teufa.png",
    name: t("קשרי תעופה", "Kishrei Teufa"),
    code: "KISHREI",
    flightsOnly: c("7%", "7%", "mid"),
    packages: c("10%", "10%", "high"),
    organizedTours: c("7–10%", "7–10%", "range"),
    customCommission1: cc("✈️ טיסות בלבד: דובאי", "✈️ Flight only — Dubai", "10%", "10%", "high"),
    customCommission2: cc(
      "🏖️ חבילות נופש: בטומי",
      "🏖️ Vacation packages — Batumi",
      "8%",
      "8%",
      "mid",
    ),
    baggage: [
      BACKPACK(),
      {
        icon: "flight",
        text: t("טיסות בלבד: מזוודה וטרולי כלולים", "Flight only: suitcase & trolley included"),
      },
      {
        icon: "package",
        text: t(
          "חבילות נופש: מזוודה וטרולי כלולים",
          "Vacation packages: suitcase & trolley included",
        ),
      },
      ARKIA_TROLLEY(60),
    ],
    notes: [
      {
        text: t(
          "טיולים מאורגנים: יש לוודא עמלה ספציפית לכל טיול",
          "Organized tours: confirm the specific commission for each trip",
        ),
        variant: "warning",
      },
    ],
  },
  {
    id: "ayala",
    website: "https://www.ayala.co.il/",
    logo: "/suppliers/ayala.png",
    name: t("איילה", "Ayala"),
    code: "AYALA",
    flightsOnly: c("5%", "5%", "low"),
    packages: c("7%", "7%", "mid"),
    baggage: [
      BACKPACK(),
      {
        icon: "flight",
        text: t("טיסות בלבד: מזוודה וטרולי כלולים", "Flight only: suitcase & trolley included"),
      },
      {
        icon: "package",
        text: t(
          "חבילות נופש: מזוודה וטרולי כלולים",
          "Vacation packages: suitcase & trolley included",
        ),
      },
      ARKIA_TROLLEY(60),
    ],
  },
  {
    id: "wtc",
    website: "https://wtc.co.il/",
    logo: "/suppliers/wtc.png",
    name: t("WTC", "WTC"),
    code: "WTC",
    flightsOnly: c("5%", "5%", "low"),
    packages: c("8%", "8%", "mid"),
    baggage: [
      BACKPACK(),
      {
        icon: "flight",
        text: t("טיסות בלבד: מזוודה וטרולי כלולים", "Flight only: suitcase & trolley included"),
      },
      {
        icon: "package",
        text: t(
          "חבילות נופש: מזוודה וטרולי כלולים",
          "Vacation packages: suitcase & trolley included",
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
    id: "mona-tours",
    website: "https://www.monatours.co.il/",
    logo: "/suppliers/mona-tours.png",
    name: t("מונה טורס", "Mona Tours"),
    code: "MONA",
    flightsOnly: c("5%", "5%", "low"),
    packages: c("10%", "10%", "high"),
    baggage: [
      BACKPACK(),
      {
        icon: "flight",
        text: t("טיסות בלבד: מזוודה וטרולי כלולים", "Flight only: suitcase & trolley included"),
      },
      {
        icon: "package",
        text: t(
          "חבילות נופש: מזוודה וטרולי כלולים",
          "Vacation packages: suitcase & trolley included",
        ),
      },
      ARKIA_TROLLEY(60),
    ],
  },
  {
    id: "rimon",
    website: "https://rimon-tours.co.il/",
    logo: "/suppliers/rimon.png",
    name: t("רימון", "Rimon"),
    code: "RIMON",
    customCommission1: cc(
      "🧳 טיולים מאורגנים עד $3,000 לאדם",
      "🧳 Organized tours up to $3,000 pp",
      "10%",
      "10%",
      "high",
    ),
    customCommission2: cc(
      "🧳 טיולים מאורגנים מעל $3,000 לאדם",
      "🧳 Organized tours over $3,000 pp",
      "משתנה",
      "Varies",
      "range",
    ),
    baggage: [
      BACKPACK(),
      {
        icon: "tour",
        text: t(
          "טיולים מאורגנים: מזוודה וטרולי כלולים",
          "Organized tours: suitcase & trolley included",
        ),
      },
    ],
    notes: [
      {
        text: t(
          "מעל $3,000 לאדם — לברר עמלה ספציפית לכל טיול",
          "Over $3,000 per person — confirm the specific commission per trip",
        ),
        variant: "warning",
      },
    ],
  },
  {
    id: "disenhause",
    website: "https://www.deasy.co.il/",
    logo: "/suppliers/disenhause.png",
    name: t("דיזנהאוז", "Diesenhaus"),
    code: "DEASY",
    flightsOnly: c("7%", "7%", "mid"),
    packages: c("7%", "7%", "mid"),
    baggage: [
      BACKPACK(),
      {
        icon: "flight",
        text: t("טיסות בלבד: מזוודה וטרולי כלולים", "Flight only: suitcase & trolley included"),
      },
      {
        icon: "package",
        text: t(
          "חבילות נופש: מזוודה וטרולי כלולים",
          "Vacation packages: suitcase & trolley included",
        ),
      },
      ARKIA_TROLLEY(60),
    ],
    notes: [
      {
        text: t("לבדוק תקופתית — תנאים עשויים להשתנות", "Check periodically — terms may change"),
        variant: "warning",
      },
    ],
  },
];

// ── Locale-resolved view types (what the client receives) ────────────────────
export type ViewCommissionValue = { value: string; level: CommLevel } | null;
export type ViewCustomCommission = { label: string; value: string; level: CommLevel };
export type ViewNote = { text: string; variant: "info" | "warning"; showTitle: boolean };
export type ViewBaggageRow = { icon: BaggageIcon; text: string };
export type ViewSupplier = {
  id: string;
  name: string;
  code: string;
  alias: string | null;
  website: string | null;
  logo: string | null;
  flightsOnly: ViewCommissionValue;
  packages: ViewCommissionValue;
  organizedTours: ViewCommissionValue;
  /** Special lines (customCommission1..n), resolved and compacted in order. */
  customCommissions: ViewCustomCommission[];
  baggage: ViewBaggageRow[];
  notes: ViewNote[];
  /** Lowercased he + en name + alias + code, for client-side filtering across locales. */
  search: string;
};

/** All suppliers, resolved to `locale`, in guide order. */
export function getCommissions(locale: string): ViewSupplier[] {
  const pick = (v: Localized) => localized(v, locale as Locale);
  const cv = (v?: CommissionValue): ViewCommissionValue =>
    v ? { value: pick(v.value), level: v.level } : null;
  return SUPPLIERS.map((s) => ({
    id: s.id,
    name: pick(s.name),
    code: s.code,
    alias: s.alias ? pick(s.alias) : null,
    website: s.website ?? null,
    logo: s.logo ?? null,
    flightsOnly: cv(s.flightsOnly),
    packages: cv(s.packages),
    organizedTours: cv(s.organizedTours),
    customCommissions: [s.customCommission1, s.customCommission2, s.customCommission3]
      .filter((cm): cm is CustomCommission => Boolean(cm))
      .map((cm) => ({ label: pick(cm.label), value: pick(cm.value), level: cm.level })),
    baggage: s.baggage.map((b) => ({ icon: b.icon, text: pick(b.text) })),
    notes: (s.notes ?? []).map((n) => ({
      text: pick(n.text),
      variant: n.variant,
      showTitle: n.showTitle ?? true,
    })),
    search:
      `${s.name.he ?? ""} ${s.name.en ?? ""} ${s.alias?.he ?? ""} ${s.alias?.en ?? ""} ${s.code}`
        .toLowerCase()
        .trim(),
  }));
}
