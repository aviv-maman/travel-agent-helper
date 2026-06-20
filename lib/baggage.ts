import type { Localized } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { localized } from "@/lib/hotels";

/**
 * Checked-baggage allowance per airline. Backpack (≤4 kg) and trolley (8 kg, or
 * 10 kg on a couple of carriers) are universal — see the intro note in the UI;
 * this table covers the checked suitcase. Curated editorial data, resolved to
 * the active locale on the server.
 */

/** Suitcase weight tier → badge color: 23 kg (and ranges) green, 20 kg blue. */
export type WeightTier = "kg23" | "kg20";

export type Airline = {
  /** IATA code(s), e.g. "IS" or "XC / 4D". Absent for the catch-all row. */
  iata?: string;
  flag?: string;
  name: Localized;
  /** Raw weight figure: "23", "20", "15–23", "23–30". */
  kg: string;
  note?: Localized;
  noteTone?: "muted" | "gold";
  /** Subtly highlighted catch-all row ("all other airlines"). */
  highlight?: boolean;
};

const t = (he: string, en: string): Localized => ({ he, en });
const TROLLEY10 = t('טרולי 10 ק"ג', "Trolley 10 kg");
const DEPENDS = t("תלוי בכרטיס", "Depends on ticket");

const AIRLINES: Airline[] = [
  { iata: "IS", flag: "🇮🇱", name: t("ישראייר", "Israir"), kg: "23", note: TROLLEY10 },
  { iata: "LY", flag: "🇮🇱", name: t("אל על", "El Al"), kg: "23" },
  { iata: "A3", flag: "🇬🇷", name: t("אג'יאן", "Aegean (A3)"), kg: "23" },
  { iata: "OS", flag: "🇦🇹", name: t("אוסטריאן איירליינס", "Austrian Airlines"), kg: "23" },
  { iata: "LX", flag: "🇨🇭", name: t("סוויס", "Swiss"), kg: "23" },
  { iata: "LH", flag: "🇩🇪", name: t("לופטהנזה", "Lufthansa"), kg: "23" },
  { iata: "EW", flag: "🇩🇪", name: t("יורוווינגס", "Eurowings"), kg: "23" },
  { iata: "SN", flag: "🇧🇪", name: t("בראסלס איירליינס", "Brussels Airlines"), kg: "23" },
  { iata: "QS", flag: "🇨🇿", name: t("סמארטווינגס", "Smartwings"), kg: "23" },
  { iata: "AZ", flag: "🇮🇹", name: t("ITA איירווייס", "ITA Airways"), kg: "23" },
  { iata: "IB", flag: "🇪🇸", name: t("איבריה", "Iberia"), kg: "23" },
  { iata: "LA", flag: "🇧🇷", name: t("לאטאם", "LATAM"), kg: "23" },
  { iata: "TP", flag: "🇵🇹", name: t("TAP פורטוגל", "TAP Portugal"), kg: "23" },
  { iata: "SK", flag: "🇸🇪", name: t("SAS סקנדינביאן", "SAS Scandinavian"), kg: "23" },
  { iata: "KE", flag: "🇰🇷", name: t("קוריאן אייר", "Korean Air"), kg: "23" },
  { iata: "HU", flag: "🇨🇳", name: t("היינאן איירליינס", "Hainan Airlines"), kg: "23" },
  { iata: "ET", flag: "🇪🇹", name: t("אתיופיאן איירליינס", "Ethiopian Airlines"), kg: "23" },
  { iata: "NO", flag: "🇬🇷", name: t("ניאוס", "Neos"), kg: "23" },
  { iata: "UA", flag: "🇺🇸", name: t("יונייטד איירליינס", "United Airlines"), kg: "23" },
  { iata: "DL", flag: "🇺🇸", name: t("דלתא", "Delta"), kg: "23" },
  { iata: "AA", flag: "🇺🇸", name: t("אמריקן איירליינס", "American Airlines"), kg: "23" },
  { iata: "AF", flag: "🇫🇷", name: t("אייר פראנס", "Air France"), kg: "23" },
  { iata: "HM", flag: "🇸🇨", name: t("אייר סיישל", "Air Seychelles"), kg: "23" },
  { iata: "KL", flag: "🇳🇱", name: t("KLM", "KLM"), kg: "23" },
  { iata: "BA", flag: "🇬🇧", name: t("בריטיש איירווייס", "British Airways"), kg: "23" },
  { iata: "VS", flag: "🇬🇧", name: t("וירג'ין אטלנטיק", "Virgin Atlantic"), kg: "23" },
  { iata: "FB", flag: "🇧🇬", name: t("בולגריה אייר", "Bulgaria Air"), kg: "23" },
  { iata: "LO", flag: "🇵🇱", name: t("LOT פולית", "LOT Polish"), kg: "23" },
  {
    iata: "GQ",
    flag: "🇬🇷",
    name: t("סקיי אקספרס", "Sky Express"),
    kg: "15–23",
    note: DEPENDS,
    noteTone: "gold",
  },
  {
    iata: "CY",
    flag: "🇨🇾",
    name: t("סייפרוס איירווייס", "Cyprus Airways"),
    kg: "23",
    note: TROLLEY10,
  },
  { iata: "A9", flag: "🇬🇪", name: t("ג'ורג'יאן איירווייס", "Georgian Airways"), kg: "23" },
  { iata: "RO", flag: "🇷🇴", name: t("טארום", "TAROM"), kg: "23" },
  {
    iata: "EK",
    flag: "🇦🇪",
    name: t("אמירייטס", "Emirates"),
    kg: "23–30",
    note: DEPENDS,
    noteTone: "gold",
  },
  { iata: "FZ", flag: "🇦🇪", name: t("פלאי דובאי", "Fly Dubai"), kg: "23" },
  {
    iata: "EY",
    flag: "🇦🇪",
    name: t("אתיחאד", "Etihad"),
    kg: "23–30",
    note: DEPENDS,
    noteTone: "gold",
  },
  { iata: "IZ", flag: "🇮🇱", name: t("ארקיע", "Arkia"), kg: "20" },
  { iata: "3E", flag: "🇬🇷", name: t("אלקטרה אייר", "Electra Air (3E)"), kg: "20" },
  {
    iata: "XC / 4D",
    flag: "🇬🇷",
    name: t("קורנדון איירליינס", "Corendon Airlines (4D)"),
    kg: "20",
  },
  { iata: "BZ", flag: "🇬🇷", name: t("בלו בירד", "Blue Bird"), kg: "20" },
  { iata: "U8", flag: "🇨🇾", name: t("TUS איירווייס", "TUS Airways"), kg: "20" },
  {
    name: t("כל שאר חברות התעופה", "All other airlines"),
    kg: "20",
    note: t("סטנדרט", "Standard"),
    highlight: true,
  },
];

// ── Locale-resolved view types ───────────────────────────────────────────────
export type ViewAirline = {
  iata: string | null;
  flag: string | null;
  name: string;
  weight: string;
  tier: WeightTier;
  note: string | null;
  noteTone: "muted" | "gold";
  highlight: boolean;
  /** Lowercased he + en + iata, for client-side filtering across both locales. */
  search: string;
};

/** All airlines, resolved to `locale`, in guide order. */
export function getBaggage(locale: string): ViewAirline[] {
  const lc = locale as Locale;
  const pick = (v: Localized) => localized(v, lc);
  const unit = lc === "he" ? 'ק"ג' : "kg";
  return AIRLINES.map((a) => ({
    iata: a.iata ?? null,
    flag: a.flag ?? null,
    name: pick(a.name),
    weight: `${a.kg} ${unit}`,
    tier: a.kg === "20" ? "kg20" : "kg23",
    note: a.note ? pick(a.note) : null,
    noteTone: a.noteTone ?? "muted",
    highlight: Boolean(a.highlight),
    search: `${a.iata ?? ""} ${a.name.he ?? ""} ${a.name.en ?? ""}`.toLowerCase(),
  }));
}
