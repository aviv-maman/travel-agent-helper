import type { Localized, PillVariant, TransferPill as Pill } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { localized, usingDatabase } from "@/lib/hotels";

/**
 * Airport-transfer inclusion guide. Transfers to/from the hotel are included in
 * **vacation packages only**; this table maps each destination to which
 * suppliers include them. Grouped by country (each with its flag); a country's
 * cities are listed as separate rows, since their inclusion rules can differ.
 * Curated editorial data: the array below is the seed source (`bun run seed`)
 * and the no-DB fallback; with `DATABASE_URL` configured the page reads the
 * `transfer_countries`/`transfer_cities` tables.
 */

export type { PillVariant } from "@/db/schema";
export type { TransferPill as Pill } from "@/db/schema";

export type CityRow = {
  id: string;
  /** DB row id — present only on the DB read path; the editor needs it. */
  dbId?: number;
  /** City (or equivalent group of cities) + IATA codes — no country prefix. */
  name: Localized;
  /** Cross-locale search blob (he + en + IATA codes), lowercased on resolve. */
  search: string;
  pills: Pill[];
};

export type CountryGroup = {
  id: string;
  country: Localized;
  /** ISO 3166-1 alpha-2 code for the flag, or null for the catch-all "other". */
  code: string | null;
  cities: CityRow[];
};

const t = (he: string, en: string): Localized => ({ he, en });

/** Supplier display names + their default flag. */
const SUP: Record<string, { name: Localized; flag: string }> = {
  israir: { name: t("ישראייר", "Israir"), flag: "" },
  flying: { name: t("שטיח מעופף", "Flying"), flag: "" },
  issta: { name: t("איסתא", "Issta"), flag: "" },
  kesher: { name: t("קשרי תעופה", "Kesher Teufa"), flag: "" },
  eshet: { name: t("אשת טורס", "Eshet Tours"), flag: "" },
  arkia: { name: t("ארקיע", "Arkia"), flag: "" },
  disenhause: { name: t("דיזנהאוז", "Disenhause"), flag: "" },
  mona: { name: t("מונה טורס", "Mona Tours"), flag: "" },
  ofir: { name: t("אופיר טורס", "Ofir Tours"), flag: "" },
  kavei: { name: t("קווי חופשה", "Kavei Hufsha"), flag: "" },
  ayala: { name: t("איילה", "Ayala"), flag: "" },
  wtc: { name: t("WTC", "WTC"), flag: "" },
};

/** Supplier pill; `tooltip` adds a localized hover note (keeps the label short). */
function p(variant: PillVariant, supId: string, tooltip?: Localized): Pill {
  const s = SUP[supId];
  return { variant, flag: s.flag, label: s.name, tooltip };
}

/** Generic (non-supplier) pill, e.g. "all suppliers". */
function g(variant: PillVariant, he: string, en: string): Pill {
  return { variant, label: t(he, en) };
}

/** Shorthand "✗ all suppliers" pill used by the not-included countries. */
const NONE: Pill = g("no", "כל הספקים", "All suppliers");

/** Curated transfer data, in guide order — the DB seed source and no-DB fallback. */
export const COUNTRIES: CountryGroup[] = [
  {
    id: "bulgaria",
    country: t("בולגריה", "Bulgaria"),
    code: "BG",
    cities: [
      {
        id: "burgas",
        name: t("בורגס (BOJ)", "Burgas (BOJ)"),
        search: "בורגס burgas boj",
        pills: [g("yes", "כל הספקים", "all suppliers")],
      },
      {
        id: "varna",
        name: t("וורנה (VAR)", "Varna (VAR)"),
        search: "וורנה varna var",
        pills: [g("yes", "כל הספקים", "all suppliers")],
      },
      {
        id: "sofia",
        name: t("סופיה (SOF)", "Sofia (SOF)"),
        search: "סופיה sofia sof",
        pills: [p("warn", "ofir"), p("no", "kavei"), p("no", "mona"), p("no", "israir")],
      },
    ],
  },
  {
    id: "greece",
    country: t("יוון", "Greece"),
    code: "GR",
    cities: [
      {
        id: "crete",
        name: t("כרתים (HER)", "Crete (HER)"),
        search: "כרתים crete her",
        pills: [g("yes", "כל הספקים", "all suppliers")],
      },
      {
        id: "rhodes",
        name: t("רודוס (RHO)", "Rhodes (RHO)"),
        search: "רודוס rhodes rho",
        pills: [g("yes", "כל הספקים", "all suppliers")],
      },
      {
        id: "kos",
        name: t("קוס (KGS)", "Kos (KGS)"),
        search: "קוס kos kgs",
        pills: [g("yes", "כל הספקים", "all suppliers")],
      },
      {
        id: "corfu",
        name: t("קורפו (CFU)", "Corfu (CFU)"),
        search: "קורפו corfu cfu",
        pills: [p("no", "kavei"), g("yes", "כל שאר הספקים", "All other suppliers")],
      },
      {
        id: "mykonos",
        name: t("מיקונוס (JMK)", "Mykonos (JMK)"),
        search: "מיקונוס mykonos jmk",
        pills: [
          p("yes", "wtc"),
          p("no", "kesher"),
          p("no", "arkia"),
          p("no", "kavei"),
          g("warn", "שאר הספקים", "Other suppliers"),
        ],
      },
      {
        id: "santorini",
        name: t("סנטוריני (JTR)", "Santorini (JTR)"),
        search: "סנטוריני santorini jtr",
        pills: [
          p("yes", "wtc", t("העברה פרטית בחינם", "Free private transfer")),
          p("yes", "issta"),
          p("no", "eshet"),
          p("no", "kesher"),
          g("warn", "שאר הספקים", "Other suppliers"),
        ],
      },
      {
        id: "chania",
        name: t("חאניה (CHQ)", "Chania (CHQ)"),
        search: "חאניה chania chq כרתים crete",
        pills: [g("no", "כל הספקים", "All suppliers")],
      },
      {
        id: "khalkidhiki",
        name: t("חלקידיקי (HLK/SKG)", "Khalkidhiki (HLK/SKG)"),
        search: "חלקידיקי khalkidhiki halkidiki halkidhiki hlk סלוניקי thessaloniki skg",
        pills: [NONE],
      },
      {
        id: "athens",
        name: t("אתונה (ATH)", "Athens (ATH)"),
        search: "אתונה athens ath",
        pills: [NONE],
      },
      {
        id: "thessaloniki",
        name: t("סלוניקי (SKG)", "Thessaloniki (SKG)"),
        search: "סלוניקי thessaloniki skg",
        pills: [NONE],
      },
    ],
  },
  {
    id: "cyprus",
    country: t("קפריסין", "Cyprus"),
    code: "CY",
    cities: [
      {
        id: "turkish-cyprus",
        name: t("צפון קפריסין (הצד הטורקי) (ECN/GEC)", "Northern Cyprus (Turkish side) (ECN/GEC)"),
        search: "צפון קפריסין הטורקית northern turkish cyprus ecn gec",
        pills: [g("yes", "כל הספקים", "all suppliers")],
      },
      {
        id: "limassol",
        name: t("לימסול (QLI/LCA)", "Limassol (QLI/LCA)"),
        search: "לימסול limassol qli lca",
        pills: [
          p("yes", "flying"),
          p("yes", "issta"),
          p("no", "ayala"),
          g("no", "כל שאר הספקים", "All other suppliers"),
        ],
      },
      {
        id: "larnaca",
        name: t("לרנקה (LCA)", "Larnaca (LCA)"),
        search: "לרנקה larnaca lca",
        pills: [
          p("yes", "flying"),
          p("yes", "issta"),
          p("no", "ayala"),
          g("no", "כל שאר הספקים", "All other suppliers"),
        ],
      },
      {
        id: "ayia-napa",
        name: t("איה נאפה (AYA/LCA)", "Ayia Napa (AYA/LCA)"),
        search: "איה נאפה ayia napa aya lca",
        pills: [
          p("yes", "flying"),
          p("yes", "issta"),
          p("no", "ayala"),
          g("no", "כל שאר הספקים", "All other suppliers"),
        ],
      },
      {
        id: "paphos",
        name: t("פאפוס (PFO)", "Paphos (PFO)"),
        search: "פאפוס paphos pfo",
        pills: [
          p("yes", "flying"),
          p("yes", "issta"),
          p("no", "ayala"),
          g("no", "כל שאר הספקים", "All other suppliers"),
        ],
      },
      {
        id: "protaras",
        name: t("פרוטאראס (PRT)", "Protaras (PRT)"),
        search: "פרוטאראס protaras prt",
        pills: [
          p("yes", "flying"),
          p("yes", "issta"),
          p("yes", "ayala"),
          g("no", "כל שאר הספקים", "All other suppliers"),
        ],
      },
    ],
  },
  {
    id: "azerbaijan",
    country: t("אזרבייג'ן", "Azerbaijan"),
    code: "AZ",
    cities: [
      {
        id: "baku",
        name: t("באקו (BAK)", "Baku (BAK)"),
        search: "באקו baku bak",
        pills: [
          p("yes", "israir"),
          p("yes", "flying"),
          p("yes", "issta"),
          p("no", "kesher"),
          p("no", "eshet"),
        ],
      },
    ],
  },
  {
    id: "uae",
    country: t("איחוד האמירויות", "UAE"),
    code: "AE",
    cities: [
      {
        id: "dubai",
        name: t("דובאי (DXB)", "Dubai (DXB)"),
        search: "דובאי dubai dxb אמירויות emirates uae",
        pills: [
          p("yes", "israir"),
          p("yes", "flying"),
          p("yes", "kesher"),
          p("yes", "issta"),
          p("yes", "arkia"),
          p("no", "kavei"),
          p("no", "mona"),
          p("no", "eshet"),
        ],
      },
      {
        id: "abu-dhabi",
        name: t("אבו דאבי (AUH)", "Abu Dhabi (AUH)"),
        search: "אבו דאבי abu dhabi auh אמירויות emirates uae",
        pills: [NONE],
      },
    ],
  },
  {
    id: "georgia",
    country: t("גאורגיה", "Georgia"),
    code: "GE",
    cities: [
      {
        id: "batumi",
        name: t("בטומי (BUS)", "Batumi (BUS)"),
        search: "בטומי batumi bus",
        pills: [
          p("yes", "israir"),
          p("yes", "flying"),
          p("yes", "kesher"),
          p("yes", "issta"),
          p("yes", "arkia"),
          p("yes", "disenhause"),
          p("no", "mona"),
          p("no", "ofir"),
        ],
      },
      {
        id: "tbilisi",
        name: t("טביליסי (TBS)", "Tbilisi (TBS)"),
        search: "טביליסי tbilisi tbs",
        pills: [
          p("yes", "israir"),
          p("yes", "flying"),
          p("yes", "kesher"),
          p("yes", "issta"),
          p("yes", "arkia"),
          p("yes", "disenhause"),
          p("no", "mona"),
          p("no", "ofir"),
        ],
      },
    ],
  },
  {
    id: "montenegro",
    country: t("מונטנגרו", "Montenegro"),
    code: "ME",
    cities: [
      {
        id: "tivat",
        name: t("טיבאט (TIV)", "Tivat (TIV)"),
        search: "מונטנגרו montenegro tiv טיבאט tivat",
        pills: [
          p("yes", "israir"),
          p("yes", "flying"),
          p("no", "issta"),
          p("no", "kesher"),
          p("no", "arkia"),
          p("no", "eshet"),
        ],
      },
    ],
  },
  {
    id: "albania",
    country: t("אלבניה", "Albania"),
    code: "AL",
    cities: [
      {
        id: "tirana",
        name: t("טיראנה (TIA)", "Tirana (TIA)"),
        search: "טיראנה tirana tia",
        pills: [
          p("no", "kesher"),
          p("no", "flying"),
          p("no", "eshet"),
          p("no", "issta"),
          p("no", "israir"),
        ],
      },
    ],
  },
  {
    id: "serbia",
    country: t("סרביה", "Serbia"),
    code: "RS",
    cities: [
      {
        id: "belgrade",
        name: t("בלגרד (BEG)", "Belgrade (BEG)"),
        search: "בלגרד belgrade beg",
        pills: [p("no", "mona"), p("no", "arkia"), g("warn", "שאר הספקים", "Other suppliers")],
      },
    ],
  },
  {
    id: "italy",
    country: t("איטליה", "Italy"),
    code: "IT",
    cities: [
      {
        id: "rome",
        name: t("רומא (FCO)", "Rome (FCO)"),
        search: "רומא rome fco",
        pills: [NONE],
      },
      {
        id: "milan",
        name: t("מילאנו (MIL)", "Milan (MIL)"),
        search: "מילאנו milan mil",
        pills: [NONE],
      },
    ],
  },
  {
    id: "czech",
    country: t("צ'כיה", "Czech"),
    code: "CZ",
    cities: [
      {
        id: "prague",
        name: t("פראג (PRG)", "Prague (PRG)"),
        search: "פראג prague prg",
        pills: [NONE],
      },
    ],
  },
  {
    id: "hungary",
    country: t("הונגריה", "Hungary"),
    code: "HU",
    cities: [
      {
        id: "budapest",
        name: t("בודפשט (BUD)", "Budapest (BUD)"),
        search: "בודפשט budapest bud",
        pills: [NONE],
      },
    ],
  },
  {
    id: "romania",
    country: t("רומניה", "Romania"),
    code: "RO",
    cities: [
      {
        id: "bucharest",
        name: t("בוקרשט (BUH)", "Bucharest (BUH)"),
        search: "בוקרשט bucharest buh",
        pills: [NONE],
      },
    ],
  },
  {
    id: "poland",
    country: t("פולין", "Poland"),
    code: "PL",
    cities: [
      {
        id: "warsaw",
        name: t("וורשה (WAW)", "Warsaw (WAW)"),
        search: "וורשה warsaw waw",
        pills: [NONE],
      },
      {
        id: "krakow",
        name: t("קרקוב (KRK)", "Krakow (KRK)"),
        search: "קרקוב krakow krk",
        pills: [NONE],
      },
    ],
  },
  {
    id: "lithuania",
    country: t("ליטא", "Lithuania"),
    code: "LT",
    cities: [
      {
        id: "vilnius",
        name: t("וילנה (VNO)", "Vilnius (VNO)"),
        search: "וילנה vilnius vno ליטא lithuania",
        pills: [NONE],
      },
    ],
  },
  {
    id: "netherlands",
    country: t("הולנד", "Netherlands"),
    code: "NL",
    cities: [
      {
        id: "amsterdam",
        name: t("אמסטרדם (AMS)", "Amsterdam (AMS)"),
        search: "אמסטרדם amsterdam ams",
        pills: [NONE],
      },
    ],
  },
  {
    id: "uk",
    country: t("אנגליה", "United Kingdom"),
    code: "GB",
    cities: [
      {
        id: "london",
        name: t("לונדון (LON)", "London (LON)"),
        search: "לונדון london lon אנגליה england uk",
        pills: [NONE],
      },
    ],
  },
  {
    id: "germany",
    country: t("גרמניה", "Germany"),
    code: "DE",
    cities: [
      {
        id: "berlin",
        name: t("ברלין (BER)", "Berlin (BER)"),
        search: "ברלין berlin ber",
        pills: [NONE],
      },
    ],
  },
  {
    id: "france",
    country: t("צרפת", "France"),
    code: "FR",
    cities: [
      {
        id: "paris",
        name: t("פריז (CDG)", "Paris (CDG)"),
        search: "פריז paris cdg",
        pills: [NONE],
      },
    ],
  },
  {
    id: "spain",
    country: t("ספרד", "Spain"),
    code: "ES",
    cities: [
      {
        id: "madrid",
        name: t("מדריד (MAD)", "Madrid (MAD)"),
        search: "מדריד madrid mad",
        pills: [NONE],
      },
      {
        id: "barcelona",
        name: t("ברצלונה (BCN)", "Barcelona (BCN)"),
        search: "ברצלונה barcelona bcn",
        pills: [NONE],
      },
    ],
  },
  {
    id: "portugal",
    country: t("פורטוגל", "Portugal"),
    code: "PT",
    cities: [
      {
        id: "lisbon",
        name: t("ליסבון (LIS)", "Lisbon (LIS)"),
        search: "ליסבון lisbon lis",
        pills: [NONE],
      },
    ],
  },
  {
    id: "other",
    country: t("כל יעד אחר", "Any other destination"),
    code: null,
    cities: [
      {
        id: "other",
        name: t("כל יעד אחר שאינו מופיע מעלה", "Any other destination not listed above"),
        search: "אחר other",
        pills: [g("no", "כל הספקים", "All suppliers")],
      },
    ],
  },
];

// ── Locale-resolved view types ───────────────────────────────────────────────
export type ViewPill = {
  variant: PillVariant;
  flag: string | null;
  label: string;
  tooltip: string | null;
};
export type ViewCityRow = {
  id: string;
  /** DB row id (null on the no-DB fallback — editing is disabled there). */
  dbId: number | null;
  name: string;
  /** Lowercased he + en + codes, for client-side filtering across both locales. */
  search: string;
  pills: ViewPill[];
  /** Both-locale pills, so the editor dialog can reconstruct its state. */
  rawPills: Pill[];
};
export type ViewCountryGroup = {
  id: string;
  country: string;
  code: string | null;
  cities: ViewCityRow[];
};

/** Transfer groups from Neon when configured, otherwise the in-code array. */
async function loadCountries(): Promise<CountryGroup[]> {
  if (!usingDatabase()) return COUNTRIES;
  const { db } = await import("@/db");
  const rows = await db.query.transferCountries.findMany({
    with: { cities: { orderBy: (t, { asc }) => [asc(t.sortOrder)] } },
    orderBy: (t, { asc }) => [asc(t.sortOrder)],
  });
  return rows.map((c) => ({
    id: c.slug,
    country: c.country,
    code: c.code,
    cities: c.cities.map((city) => ({
      id: city.slug,
      dbId: city.id,
      name: city.name,
      search: city.search,
      pills: city.pills,
    })),
  }));
}

/** Supplier options for the transfer-inclusion editor (DB only; [] otherwise). */
export async function getTransferSupplierOptions(): Promise<
  { slug: string; name: Localized; code: string }[]
> {
  if (!usingDatabase()) return [];
  const { db } = await import("@/db");
  const rows = await db.query.suppliers.findMany({
    columns: { slug: true, name: true, code: true },
    orderBy: (t, { asc }) => [asc(t.sortOrder)],
  });
  return rows;
}

/** All transfer countries, resolved to `locale`. */
export async function getTransfers(locale: string): Promise<ViewCountryGroup[]> {
  const pick = (v: Localized) => localized(v, locale as Locale);
  const countries = await loadCountries();
  return countries.map((c) => ({
    id: c.id,
    country: pick(c.country),
    code: c.code,
    cities: c.cities.map((city) => ({
      id: city.id,
      dbId: city.dbId ?? null,
      name: pick(city.name),
      search:
        `${city.search} ${city.name.he ?? ""} ${city.name.en ?? ""} ${c.country.he} ${c.country.en}`.toLowerCase(),
      rawPills: city.pills,
      pills: city.pills.map((pl) => ({
        variant: pl.variant,
        flag: pl.flag ?? null,
        label: pick(pl.label),
        tooltip: pl.tooltip ? pick(pl.tooltip) : null,
      })),
    })),
  }));
}
