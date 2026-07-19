import type { Localized } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { withPercentTokens } from "@/lib/airline-figures";
import { localized, usingDatabase } from "@/lib/hotels";

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
  /** Base-fare commission chip, e.g. "0%", "7%", "0%/5%". Defaults to "0%". */
  commission?: string;
  /** Uploaded logo URL (bucket); when absent the static file is used. */
  logoUrl?: string;
  /** True for airlines added in-app (deletable; seed rows are not). */
  custom?: boolean;
};

const t = (he: string, en: string): Localized => ({ he, en });
const TROLLEY10 = t('10 ק"ג', "10 kg");
const TROLLEY8 = t('8 ק"ג', "8 kg");
const TROLLEY7 = t('7 ק"ג', "7 kg");
const DEPENDS = t("תלוי בכרטיס", "Depends on ticket");
const TICKET_WEIGHT = t(
  'המשקל המדויק מופיע על הכרטיס עצמו (23 או 30 ק"ג)',
  "The exact weight is printed on the ticket itself (23 or 30 kg)",
);
const TICKET_WEIGHT_15_23 = t(
  'המשקל המדויק מופיע על הכרטיס עצמו (15 או 23 ק"ג)',
  "The exact weight is printed on the ticket itself (15 or 23 kg)",
);

/** Curated airline data, in guide order — the DB seed source and no-DB fallback. */
export const AIRLINES: Airline[] = [
  {
    id: "israir",
    iata: "6H",
    flag: "🇮🇱",
    name: t("ישראייר", "Israir"),
    kg: "23",
    note: TROLLEY10,
    website: "https://www.israir.co.il/",
    commission: "7%",
  },
  {
    id: "el-al",
    iata: "LY",
    flag: "🇮🇱",
    name: t("אל על", "El Al"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.elal.com/",
    commission: "3%/5%",
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
    name: t("סוויס אינטרנשיונל אייר ליינס", "Swiss International Air Lines"),
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
    id: "ita",
    iata: "AZ",
    flag: "🇮🇹",
    name: t("איי־טי־היי איירווייז ITA", "ITA Airways"),
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
    id: "tap",
    iata: "TP",
    flag: "🇵🇹",
    name: t("טאפ אייר פורטוגל", "TAP Air Portugal"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.flytap.com/en-us",
  },
  {
    id: "sas",
    iata: "SK",
    flag: "🇸🇪",
    name: t("סקנדינביאן איירליינס", "Scandinavian Airlines"),
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
    flag: "🇮🇹",
    name: t("נאוס", "Neos"),
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
    commission: "0%/5%",
  },
  {
    id: "delta",
    iata: "DL",
    flag: "🇺🇸",
    name: t("דלתא איירליינס", "Delta Air Lines"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.delta.com/",
    commission: "0%/5%",
  },
  {
    id: "american",
    iata: "AA",
    flag: "🇺🇸",
    name: t("אמריקן איירליינס", "American Airlines"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.aa.com/",
    commission: "0%/5%",
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
    name: t("קיי־אל־אם KLM", "KLM"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.klm.com/",
  },
  {
    id: "british",
    iata: "BA",
    flag: "🇬🇧",
    name: t("בריטיש איירווייז", "British Airways"),
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
    commission: "7%",
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
    name: t("סייפרוס איירווייז", "Cyprus Airways"),
    kg: "23",
    note: TROLLEY10,
    website: "https://www.cyprusairways.com/",
  },
  {
    id: "georgian",
    iata: "A9",
    flag: "🇬🇪",
    name: t("ג'ורג'יאן איירווייז", "Georgian Airways"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.georgian-airways.com/en",
    commission: "1%",
  },
  {
    id: "tarom",
    iata: "RO",
    flag: "🇷🇴",
    name: t("טארום", "TAROM"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.tarom.ro/en/",
    commission: "0%/5%",
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
    name: t("איתיחאד איירווייז", "Etihad Airways"),
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
    commission: "7%",
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
    id: "bluebird",
    iata: "BZ",
    flag: "🇬🇷",
    name: t("בלו בירד איירווייז", "Bluebird Airways"),
    kg: "20",
    note: TROLLEY8,
    website: "https://www.bluebirdair.com/",
  },
  {
    id: "tus",
    iata: "U8",
    flag: "🇨🇾",
    name: t("טוס איירווייז", "TUS Airways"),
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
  {
    id: "uzbekistan-airways",
    iata: "HY",
    flag: "🇺🇿",
    name: t("אוזבקיסטן איירווייז", "Uzbekistan Airways"),
    kg: "23",
    note: TROLLEY10,
    website: "https://www.uzairways.com/en/",
  },
  {
    id: "qanot-sharq",
    iata: "HH",
    flag: "🇺🇿",
    name: t("קנוט שרק", "Qanot Sharq"),
    kg: "23",
    note: TROLLEY8,
    website: "https://qanotsharq.com/en/",
  },
  {
    id: "air-europa",
    iata: "UX",
    flag: "🇪🇸",
    name: t("אייר אירופה", "Air Europa"),
    kg: "23",
    note: TROLLEY10,
    website: "https://www.aireuropa.com/",
  },
  {
    id: "air-canada",
    iata: "AC",
    flag: "🇨🇦",
    name: t("אייר קנדה", "Air Canada"),
    kg: "23",
    note: TROLLEY10,
    website: "https://www.aircanada.com/",
    commission: "0%/1%",
  },
  {
    id: "anima-wings",
    iata: "A2",
    flag: "🇷🇴",
    name: t("אנימה ווינגס", "Anima Wings"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.animawings.com/en/",
  },
  {
    id: "hisky",
    iata: "H4",
    flag: "🇷🇴",
    name: t("הייסקיי יורופ", "HiSky Europe"),
    kg: "23",
    note: TROLLEY10,
    website: "https://www.hisky.aero/en/",
  },
  {
    id: "air-baltic",
    iata: "BT",
    flag: "🇱🇻",
    name: t("אייר בלטיק", "airBaltic"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.airbaltic.com/",
  },
  {
    id: "condor",
    iata: "DE",
    flag: "🇩🇪",
    name: t("קונדור", "Condor"),
    kg: "20",
    note: TROLLEY8,
    website: "https://www.condor.com/",
  },
  {
    id: "cathay-pacific",
    iata: "CX",
    flag: "🇭🇰",
    name: t("קתאי פסיפיק", "Cathay Pacific"),
    kg: "23",
    note: TROLLEY7,
    website: "https://www.cathaypacific.com/",
  },
  {
    id: "croatia-airlines",
    iata: "OU",
    flag: "🇭🇷",
    name: t("קרואטיה איירליינס", "Croatia Airlines"),
    kg: "23",
    note: TROLLEY8,
    website: "https://www.croatiaairlines.com/",
  },
];

/**
 * Convert a regional-indicator flag emoji (🇬🇪) to its ISO-3166 alpha-2 code
 * ("ge"), so we can render a real SVG flag via <CountryFlag>. Windows / Edge
 * don't ship flag glyphs, so the emoji alone would show as "GE" text there.
 */
export function flagToCode(flag?: string): string | null {
  if (!flag) return null;
  const cps = [...flag].map((ch) => ch.codePointAt(0) ?? 0);
  if (cps.length !== 2 || cps.some((cp) => cp < 0x1f1e6 || cp > 0x1f1ff)) return null;
  return cps.map((cp) => String.fromCharCode(cp - 0x1f1e6 + 97)).join("");
}

/** Inverse of {@link flagToCode}: a 2-letter country code → its flag emoji, or
 *  null when it isn't two ASCII letters. Used when adding an airline (the form
 *  takes a code like "IL"; the column stores the emoji the reader expects). */
export function codeToFlag(code: string): string | null {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return null;
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
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
  /** Logo URL: the uploaded bucket URL, else the static `/airlines/{id}.png`. */
  logo: string;
  /** True for app-added airlines (full edit + delete allowed). */
  custom: boolean;
  highlight: boolean;
  /** Base-fare commission chip text, e.g. "0%", "7%", "0%/5%". */
  commission: string;
  /** "zero" → red chip (0% / no commission), "some" → blue chip. */
  commissionTier: "zero" | "some";
  /** Numeric commission used for sorting (largest figure in the range). */
  commissionSort: number;
  /** Bare figures for the inline row editor (units are presentation only). */
  kgRaw: string;
  /** Trolley figure without the unit when the note is a plain weight, else the note text. */
  trolleyRaw: string;
  commissionRaw: string;
  /** Lowercased he + en + iata, for client-side filtering across both locales. */
  search: string;
};

/** Largest number found in a figure like "23", "15/23" or "23/30". */
function maxNum(s: string): number {
  const nums = s.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  return nums.length ? Math.max(...nums) : 0;
}

/** Airlines from Neon when configured, otherwise the in-code array. */
async function loadAirlines(): Promise<Airline[]> {
  if (!usingDatabase()) return AIRLINES;
  const { db } = await import("@/db");
  const rows = await db.query.airlines.findMany({
    orderBy: (t, { asc }) => [asc(t.sortOrder)],
  });
  return rows.map((r) => ({
    id: r.slug,
    iata: r.iata ?? undefined,
    flag: r.flag ?? undefined,
    name: r.name,
    kg: r.kg,
    note: r.note ?? undefined,
    noteTone: r.noteTone ?? undefined,
    info: r.info ?? undefined,
    website: r.website,
    highlight: r.highlight || undefined,
    commission: r.commission ?? undefined,
    logoUrl: r.logoUrl ?? undefined,
    custom: r.custom || undefined,
  }));
}

/** All airlines, resolved to `locale`, in guide order. */
export async function getAirlines(locale: string): Promise<ViewAirline[]> {
  const lc = locale as Locale;
  const pick = (v: Localized) => localized(v, lc);
  const unit = lc === "he" ? 'ק"ג' : "kg";
  const airlines = await loadAirlines();
  return airlines.map((a) => {
    const note = a.note ? pick(a.note) : null;
    // Stored bare going forward ("0/5"); "%" per token is display-only.
    // Idempotent for legacy rows stored with the sign ("0%/5%").
    const commission = withPercentTokens(a.commission ?? "0");
    const commissionSort = maxNum(commission);
    // The trolley note is editable as a number when it's a plain weight
    // ('10 ק"ג' / "10 kg"); other notes ("depends on ticket") edit as text.
    const trolleyFigure = note?.match(/^([\d./]+)\s*(?:ק["״']?ג|kg)$/i)?.[1] ?? null;
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
      logo: a.logoUrl ?? `/airlines/${a.id}.png`,
      custom: Boolean(a.custom),
      highlight: Boolean(a.highlight),
      commission,
      commissionTier: commissionSort === 0 ? "zero" : "some",
      commissionSort,
      kgRaw: a.kg,
      trolleyRaw: trolleyFigure ?? note ?? "",
      commissionRaw: commission.replace(/%/g, ""),
      search: `${a.iata ?? ""} ${a.name.he ?? ""} ${a.name.en ?? ""}`.toLowerCase(),
    };
  });
}
