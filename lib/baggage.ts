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
  /** Stable slug, used for the logo file (public/airlines/{id}.png) and contacts. */
  id: string;
  /** IATA code(s), e.g. "IS" or "XC / 4D". Absent for the catch-all row. */
  iata?: string;
  flag?: string;
  name: Localized;
  /** Raw weight figure: "23", "20", "15/23", "23/30". */
  kg: string;
  /** Trolley allowance shown in the "Trolley" column. */
  note?: Localized;
  noteTone?: "muted" | "gold";
  /** Free-text note shown in the dedicated "Note" column. */
  info?: Localized;
  /** Airline website. */
  website: string;
  /** Subtly highlighted catch-all row ("all other airlines"). */
  highlight?: boolean;
};

const t = (he: string, en: string): Localized => ({ he, en });
const TROLLEY10 = t('10 ק"ג', "10 kg");
const TROLLEY8 = t('8 ק"ג', "8 kg");
const DEPENDS = t("תלוי בכרטיס", "Depends on ticket");
const TICKET_WEIGHT = t(
  'המשקל המדויק מופיע על הכרטיס עצמו (23 או 30 ק"ג)',
  "The exact weight is printed on the ticket itself (23 or 30 kg)",
);
const TICKET_WEIGHT_15_23 = t(
  'המשקל המדויק מופיע על הכרטיס עצמו (15 או 23 ק"ג)',
  "The exact weight is printed on the ticket itself (15 or 23 kg)",
);

const AIRLINES: Airline[] = [
  {
    id: "israir",
    iata: "6H",
    flag: "🇮🇱",
    name: t("ישראייר", "Israir"),
    kg: "23",
    note: TROLLEY10,
    website: "https://www.israir.co.il/",
  },
  {
    id: "el-al",
    iata: "LY",
    flag: "🇮🇱",
    name: t("אל על", "El Al"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.elal.com/",
  },
  {
    id: "aegean",
    iata: "A3",
    flag: "🇬🇷",
    name: t("אג'יאן איירליינס", "Aegean Airlines"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.aegeanair.com/",
  },
  {
    id: "austrian",
    iata: "OS",
    flag: "🇦🇹",
    name: t("אוסטריאן איירליינס", "Austrian Airlines"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.austrian.com/",
  },
  {
    id: "swiss",
    iata: "LX",
    flag: "🇨🇭",
    name: t("סוויס", "Swiss"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.swiss.com/",
  },
  {
    id: "lufthansa",
    iata: "LH",
    flag: "🇩🇪",
    name: t("לופטהנזה", "Lufthansa"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.lufthansa.com/",
  },
  {
    id: "eurowings",
    iata: "EW",
    flag: "🇩🇪",
    name: t("יורוווינגס", "Eurowings"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.eurowings.com/",
  },
  {
    id: "brussels",
    iata: "SN",
    flag: "🇧🇪",
    name: t("בראסלס איירליינס", "Brussels Airlines"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.brusselsairlines.com/",
  },
  {
    id: "smartwings",
    iata: "QS",
    flag: "🇨🇿",
    name: t("סמארטווינגס", "Smartwings"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.smartwings.com/en/",
  },
  {
    id: "ita-airways",
    iata: "AZ",
    flag: "🇮🇹",
    name: t("ITA איירווייס", "ITA Airways"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.ita-airways.com/",
  },
  {
    id: "iberia",
    iata: "IB",
    flag: "🇪🇸",
    name: t("איבריה", "Iberia"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.iberia.com/",
  },
  {
    id: "latam",
    iata: "LA",
    flag: "🇧🇷",
    name: t("לאטאם", "LATAM"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.latamairlines.com/us/en",
  },
  {
    id: "tap-portugal",
    iata: "TP",
    flag: "🇵🇹",
    name: t("TAP פורטוגל", "TAP Portugal"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.flytap.com/en-us",
  },
  {
    id: "sas",
    iata: "SK",
    flag: "🇸🇪",
    name: t("SAS סקנדינביאן", "SAS Scandinavian"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.flysas.com/en",
  },
  {
    id: "korean-air",
    iata: "KE",
    flag: "🇰🇷",
    name: t("קוריאן אייר", "Korean Air"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.koreanair.com/",
  },
  {
    id: "hainan",
    iata: "HU",
    flag: "🇨🇳",
    name: t("היינאן איירליינס", "Hainan Airlines"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.hainanairlines.com/",
  },
  {
    id: "ethiopian",
    iata: "ET",
    flag: "🇪🇹",
    name: t("אתיופיאן איירליינס", "Ethiopian Airlines"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.ethiopianairlines.com/",
  },
  {
    id: "neos",
    iata: "NO",
    flag: "🇬🇷",
    name: t("ניאוס", "Neos"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.neosair.com/us/en",
  },
  {
    id: "united",
    iata: "UA",
    flag: "🇺🇸",
    name: t("יונייטד איירליינס", "United Airlines"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.united.com/",
  },
  {
    id: "delta",
    iata: "DL",
    flag: "🇺🇸",
    name: t("דלתא", "Delta"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.delta.com/",
  },
  {
    id: "american",
    iata: "AA",
    flag: "🇺🇸",
    name: t("אמריקן איירליינס", "American Airlines"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.aa.com/",
  },
  {
    id: "air-france",
    iata: "AF",
    flag: "🇫🇷",
    name: t("אייר פראנס", "Air France"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.airfrance.com/",
  },
  {
    id: "air-seychelles",
    iata: "HM",
    flag: "🇸🇨",
    name: t("אייר סיישל", "Air Seychelles"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.airseychelles.com/",
  },
  {
    id: "klm",
    iata: "KL",
    flag: "🇳🇱",
    name: t("KLM", "KLM"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.klm.com/",
  },
  {
    id: "british-airways",
    iata: "BA",
    flag: "🇬🇧",
    name: t("בריטיש איירווייס", "British Airways"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.britishairways.com/",
  },
  {
    id: "virgin-atlantic",
    iata: "VS",
    flag: "🇬🇧",
    name: t("וירג'ין אטלנטיק", "Virgin Atlantic"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.virginatlantic.com/",
  },
  {
    id: "bulgaria-air",
    iata: "FB",
    flag: "🇧🇬",
    name: t("בולגריה אייר", "Bulgaria Air"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.air.bg/en",
  },
  {
    id: "lot",
    iata: "LO",
    flag: "🇵🇱",
    name: t("לוט פוליש איירליינס", "LOT Polish Airlines"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.lot.com/",
  },
  {
    id: "sky-express",
    iata: "GQ",
    flag: "🇬🇷",
    name: t("סקיי אקספרס", "Sky Express"),
    kg: "15/23",
    note: DEPENDS,
    noteTone: "gold",
    info: TICKET_WEIGHT_15_23,
    website: "https://www.skyexpress.gr/en",
  },
  {
    id: "cyprus-airways",
    iata: "CY",
    flag: "🇨🇾",
    name: t("סייפרוס איירווייס", "Cyprus Airways"),
    kg: "23",
    note: TROLLEY10,
    website: "https://www.cyprusairways.com/",
  },
  {
    id: "georgian",
    iata: "A9",
    flag: "🇬🇪",
    name: t("ג'ורג'יאן איירווייס", "Georgian Airways"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.georgian-airways.com/en",
  },
  {
    id: "tarom",
    iata: "RO",
    flag: "🇷🇴",
    name: t("טארום", "TAROM"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.tarom.ro/en/",
  },
  {
    id: "emirates",
    iata: "EK",
    flag: "🇦🇪",
    name: t("אמירייטס", "Emirates"),
    kg: "23/30",
    note: DEPENDS,
    noteTone: "gold",
    info: TICKET_WEIGHT,
    website: "https://www.emirates.com/",
  },
  {
    id: "fly-dubai",
    iata: "FZ",
    flag: "🇦🇪",
    name: t("פלאי דובאי", "Fly Dubai"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.flydubai.com/",
  },
  {
    id: "etihad",
    iata: "EY",
    flag: "🇦🇪",
    name: t("אתיחאד", "Etihad"),
    kg: "23/30",
    note: DEPENDS,
    noteTone: "gold",
    info: TICKET_WEIGHT,
    website: "https://www.etihad.com/",
  },
  {
    id: "arkia",
    iata: "IZ",
    flag: "🇮🇱",
    name: t("ארקיע", "Arkia"),
    kg: "20",
    note: TROLLEY8,
    website: "https://www.arkia.co.il/",
  },
  {
    id: "electra",
    iata: "3E",
    flag: "🇬🇷",
    name: t("אלקטרה איירווייז", "Electra Airways"),
    kg: "20",
    note: TROLLEY8,
    website: "https://www.electra-airways.com/",
  },
  {
    id: "corendon",
    iata: "XC / 4D",
    flag: "🇲🇹",
    name: t("קורנדון איירליינס", "Corendon Airlines"),
    kg: "20",
    note: TROLLEY8,
    website: "https://www.corendonairlines.com/",
  },
  {
    id: "blue-bird",
    iata: "BZ",
    flag: "🇬🇷",
    name: t("בלו בירד", "Blue Bird"),
    kg: "20",
    note: TROLLEY8,
    website: "https://www.bluebirdair.com/",
  },
  {
    id: "tus",
    iata: "U8",
    flag: "🇨🇾",
    name: t("TUS איירווייס", "TUS Airways"),
    kg: "20",
    note: TROLLEY8,
    website: "https://www.tusairways.com/",
  },
  {
    id: "azerbaijan-airlines",
    iata: "J2",
    flag: "🇦🇿",
    name: t("אזרבייג'ן איירליינס", "Azerbaijan Airlines"),
    kg: "23",
    note: TROLLEY10,
    website: "https://www.azal.az/en/",
  },
];

/**
 * Convert a regional-indicator flag emoji (🇬🇪) to its ISO-3166 alpha-2 code
 * ("ge"), so we can render a real SVG flag via <CountryFlag>. Windows / Edge
 * don't ship flag glyphs, so the emoji alone would show as "GE" text there.
 */
function flagToCode(flag?: string): string | null {
  if (!flag) return null;
  const cps = [...flag].map((ch) => ch.codePointAt(0) ?? 0);
  if (cps.length !== 2 || cps.some((cp) => cp < 0x1f1e6 || cp > 0x1f1ff)) return null;
  return cps.map((cp) => String.fromCharCode(cp - 0x1f1e6 + 97)).join("");
}

// ── Locale-resolved view types ───────────────────────────────────────────────
export type ViewAirline = {
  /** Stable id for per-airline contact details (shared contacts store). */
  id: string;
  iata: string | null;
  /** ISO-3166 alpha-2 country code for the SVG flag, or null. */
  code: string | null;
  name: string;
  weight: string;
  /** Numeric weight used for sorting (the larger figure in a range). */
  weightSort: number;
  tier: WeightTier;
  note: string | null;
  noteTone: "muted" | "gold";
  /** Numeric trolley weight used for sorting (NaN-safe; 0 when not a number). */
  trolleySort: number;
  info: string | null;
  /** Airline website. */
  website: string;
  /** Logo path under /public; falls back to the placeholder if the file is missing. */
  logo: string;
  highlight: boolean;
  /** Lowercased he + en + iata, for client-side filtering across both locales. */
  search: string;
};

/** Largest number found in a figure like "23", "15/23" or "23/30". */
function maxNum(s: string): number {
  const nums = s.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  return nums.length ? Math.max(...nums) : 0;
}

/** All airlines, resolved to `locale`, in guide order. */
export function getBaggage(locale: string): ViewAirline[] {
  const lc = locale as Locale;
  const pick = (v: Localized) => localized(v, lc);
  const unit = lc === "he" ? 'ק"ג' : "kg";
  return AIRLINES.map((a) => {
    const note = a.note ? pick(a.note) : null;
    return {
      id: `air:${a.id}`,
      iata: a.iata ?? null,
      code: flagToCode(a.flag),
      name: pick(a.name),
      weight: `${a.kg} ${unit}`,
      weightSort: maxNum(a.kg),
      tier: a.kg === "20" ? "kg20" : "kg23",
      note,
      noteTone: a.noteTone ?? "muted",
      trolleySort: note ? maxNum(note) : 0,
      info: a.info ? pick(a.info) : null,
      website: a.website,
      logo: `/airlines/${a.id}.png`,
      highlight: Boolean(a.highlight),
      search: `${a.iata ?? ""} ${a.name.he ?? ""} ${a.name.en ?? ""}`.toLowerCase(),
    };
  });
}
