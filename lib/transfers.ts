import type { Localized } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { localized } from "@/lib/hotels";

/**
 * Airport-transfer inclusion guide. Transfers to/from the hotel are included in
 * **vacation packages only**; this table maps each destination to which
 * suppliers include them. Curated editorial data (like the commissions guide),
 * resolved to the active locale on the server.
 */

export type PillVariant = "yes" | "no" | "warn";

export type Pill = {
  variant: PillVariant;
  /** Optional leading flag/glyph (🇮🇱 for Israeli suppliers, 🌐 for WTC). */
  flag?: string;
  label: Localized;
};

export type DestCard = {
  id: string;
  name: Localized;
  /** Cross-locale search blob (he + en + IATA codes), lowercased on resolve. */
  search: string;
  pills: Pill[];
};

export type TransferGroup = {
  id: "all" | "bySupplier" | "none";
  title: Localized;
  cards: DestCard[];
};

const t = (he: string, en: string): Localized => ({ he, en });

/** Supplier display names + their default flag. */
const SUP: Record<string, { name: Localized; flag: string }> = {
  israir: { name: t("ישראייר", "Israir"), flag: "🇮🇱" },
  flying: { name: t("שטיח מעופף", "Flying"), flag: "🇮🇱" },
  issta: { name: t("איסתא", "Issta"), flag: "🇮🇱" },
  kesher: { name: t("קשרי תעופה", "Kesher Teufa"), flag: "🇮🇱" },
  eshet: { name: t("אשת טורס", "Eshet Tours"), flag: "🇮🇱" },
  arkia: { name: t("ארקיע", "Arkia"), flag: "🇮🇱" },
  disenhause: { name: t("דיזנהאוז", "Disenhause"), flag: "🇮🇱" },
  mona: { name: t("מונה טורס", "Mona Tours"), flag: "🇮🇱" },
  ofir: { name: t("אופיר טורס", "Ofir Tours"), flag: "🇮🇱" },
  kavei: { name: t("קוי חופשה", "Kavei Hufsha"), flag: "🇮🇱" },
  ayala: { name: t("איילה", "Ayala"), flag: "🇮🇱" },
  wtc: { name: t("WTC", "WTC"), flag: "🌐" },
};

/** Supplier pill; `suffix` appends a localized note like "— not included". */
function p(variant: PillVariant, supId: string, suffix?: Localized): Pill {
  const s = SUP[supId];
  const label = suffix ? t(`${s.name.he} ${suffix.he}`, `${s.name.en} ${suffix.en}`) : s.name;
  return { variant, flag: s.flag, label };
}

/** Generic (non-supplier) pill, e.g. "all suppliers". */
function g(variant: PillVariant, he: string, en: string): Pill {
  return { variant, label: t(he, en) };
}

const GROUPS: TransferGroup[] = [
  {
    id: "all",
    title: t("✅ כלול — כל הספקים", "✅ Included — all suppliers"),
    cards: [
      {
        id: "bulgaria-coast",
        name: t(
          "בולגריה | Bulgaria — בורגס (BOJ) · וורנה (VAR)",
          "Bulgaria — Burgas (BOJ) · Varna (VAR)",
        ),
        search: "בורגס burgas boj וורנה varna var בולגריה bulgaria",
        pills: [g("yes", "כל הספקים", "all suppliers")],
      },
      {
        id: "greece-islands",
        name: t(
          "יוון | Greece — כרתים (HER) · רודוס (RHO) · קוס (KGS)",
          "Greece — Crete (HER) · Rhodes (RHO) · Kos (KGS)",
        ),
        search: "כרתים crete her רודוס rhodes rho קוס kos kgs יוון greece",
        pills: [g("yes", "כל הספקים", "all suppliers")],
      },
      {
        id: "turkish-cyprus",
        name: t(
          "קפריסין | Cyprus — קפריסין הטורקית (ECN/GEC)",
          "Cyprus — Turkish Cyprus (ECN/GEC)",
        ),
        search: "קפריסין הטורקית turkish cyprus ecn gec קפריסין cyprus",
        pills: [g("yes", "כל הספקים", "all suppliers")],
      },
    ],
  },
  {
    id: "bySupplier",
    title: t("⚡ יעדים לפי ספק", "⚡ Destinations by supplier"),
    cards: [
      {
        id: "corfu",
        name: t("יוון | Greece — קורפו (CFU)", "Greece — Corfu (CFU)"),
        search: "קורפו corfu cfu יוון greece",
        pills: [p("no", "kavei"), g("yes", "כל שאר הספקים", "All other suppliers")],
      },
      {
        id: "baku",
        name: t("אזרבייג'ן | Azerbaijan — באקו (BAK)", "Azerbaijan — Baku (BAK)"),
        search: "באקו baku bak אזרבייג'ן azerbaijan",
        pills: [
          p("yes", "israir"),
          p("yes", "flying"),
          p("yes", "issta"),
          p("no", "kesher"),
          p("no", "eshet"),
        ],
      },
      {
        id: "dubai",
        name: t("איחוד האמירויות | UAE — דובאי (DXB)", "UAE — Dubai (DXB)"),
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
        id: "batumi",
        name: t("גאורגיה | Georgia — בטומי (BUS)", "Georgia — Batumi (BUS)"),
        search: "בטומי batumi bus גאורגיה georgia",
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
        name: t("גאורגיה | Georgia — טביליסי (TBS)", "Georgia — Tbilisi (TBS)"),
        search: "טביליסי tbilisi tbs גאורגיה georgia",
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
        id: "mykonos",
        name: t("יוון | Greece — מיקונוס (JMK)", "Greece — Mykonos (JMK)"),
        search: "מיקונוס mykonos jmk יוון greece",
        pills: [
          p("yes", "wtc"),
          p("no", "kesher"),
          p("no", "arkia"),
          p("no", "kavei"),
          g("warn", "שאר הספקים — לאמת", "Other suppliers — verify"),
        ],
      },
      {
        id: "santorini",
        name: t("יוון | Greece — סנטוריני (JTR)", "Greece — Santorini (JTR)"),
        search: "סנטוריני santorini jtr יוון greece",
        pills: [
          p("yes", "wtc", t("— העברה פרטית בחינם", "— free private transfer")),
          p("yes", "issta"),
          p("no", "eshet"),
          p("no", "kesher"),
          g("warn", "שאר הספקים — לאמת", "Other suppliers — verify"),
        ],
      },
      {
        id: "greek-cyprus",
        name: t(
          "קפריסין | Cyprus — קפריסין היוונית — לימסול (LCA) · לרנקה (LCA) · איה נאפה · פאפוס (PFO) · פרוטאראס",
          "Cyprus — Greek Cyprus — Limassol (LCA) · Larnaca (LCA) · Ayia Napa · Paphos (PFO) · Protaras",
        ),
        search:
          "קפריסין cyprus lca pfo לימסול limassol לרנקה larnaca פאפוס paphos פרוטאראס protaras איה נאפה ayia napa",
        pills: [
          p("yes", "flying"),
          p("yes", "issta"),
          p("no", "ayala", t("— לא כלול", "— not included")),
          g("no", "כל שאר הספקים", "All other suppliers"),
        ],
      },
      {
        id: "tivat",
        name: t("מונטנגרו | Montenegro — טיבאט (TIV)", "Montenegro — Tivat (TIV)"),
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
      {
        id: "tirana",
        name: t("אלבניה | Albania — טיראנה (TIA)", "Albania — Tirana (TIA)"),
        search: "טיראנה tirana tia אלבניה albania",
        pills: [
          p("no", "kesher"),
          p("no", "flying"),
          p("no", "eshet"),
          p("no", "issta"),
          p("no", "israir"),
        ],
      },
      {
        id: "belgrade",
        name: t("סרביה | Serbia — בלגרד (BEG)", "Serbia — Belgrade (BEG)"),
        search: "בלגרד belgrade beg סרביה serbia",
        pills: [
          p("no", "mona"),
          p("no", "arkia"),
          g("warn", "שאר הספקים — לאמת", "Other suppliers — verify"),
        ],
      },
      {
        id: "sofia",
        name: t("בולגריה | Bulgaria — סופיה (SOF)", "Bulgaria — Sofia (SOF)"),
        search: "סופיה sofia sof בולגריה bulgaria",
        pills: [
          p("warn", "ofir", t("— כולל, לוודא", "— included, verify")),
          p("no", "kavei"),
          p("no", "mona"),
          p("no", "israir"),
        ],
      },
    ],
  },
  {
    id: "none",
    title: t("❌ לא כלול — כל הספקים", "❌ Not included — all suppliers"),
    cards: [
      {
        id: "chania",
        name: t("יוון | Greece — חאניה (CHQ)", "Greece — Chania (CHQ)"),
        search: "חאניה chania chq כרתים crete יוון greece",
        pills: [
          g("no", "לא כלול — אין העברות בשום ספק", "Not included — no transfers with any supplier"),
        ],
      },
      {
        id: "athens-thess",
        name: t(
          "יוון | Greece — אתונה (ATH) · סלוניקי (SKG)",
          "Greece — Athens (ATH) · Thessaloniki (SKG)",
        ),
        search: "אתונה athens ath סלוניקי thessaloniki skg יוון greece",
        pills: [g("no", "כל הספקים", "All suppliers")],
      },
      {
        id: "western-europe-1",
        name: t(
          "אמסטרדם (AMS) · לונדון (LON) · ברלין (BER) · פריז (CDG)",
          "Amsterdam (AMS) · London (LON) · Berlin (BER) · Paris (CDG)",
        ),
        search:
          "אמסטרדם amsterdam ams הולנד netherlands לונדון london lon אנגליה england uk ברלין berlin ber גרמניה germany פריז paris cdg צרפת france",
        pills: [g("no", "כל הספקים", "All suppliers")],
      },
      {
        id: "western-europe-2",
        name: t(
          "ספרד | Spain — מדריד (MAD) · ברצלונה (BCN) · פורטוגל | Portugal — ליסבון (LIS)",
          "Spain — Madrid (MAD) · Barcelona (BCN) · Portugal — Lisbon (LIS)",
        ),
        search:
          "מדריד madrid mad ברצלונה barcelona bcn ספרד spain ליסבון lisbon lis פורטוגל portugal",
        pills: [g("no", "כל הספקים", "All suppliers")],
      },
      {
        id: "eastern-europe",
        name: t(
          "איטליה | Italy — רומא (FCO) · מילאנו (MIL) · צ'כיה | Czech — פראג (PRG) · הונגריה | Hungary — בודפשט (BUD) · רומניה | Romania — בוקרשט (BUH) · פולין | Poland — וורשה (WAW) · קרקוב (KRK)",
          "Italy — Rome (FCO) · Milan (MIL) · Czech — Prague (PRG) · Hungary — Budapest (BUD) · Romania — Bucharest (BUH) · Poland — Warsaw (WAW) · Krakow (KRK)",
        ),
        search:
          "רומא rome fco מילאנו milan mil איטליה italy פראג prague prg צ'כיה czech בודפשט budapest bud הונגריה hungary בוקרשט bucharest buh רומניה romania וורשה warsaw waw קרקוב krakow krk פולין poland",
        pills: [g("no", "כל הספקים", "All suppliers")],
      },
      {
        id: "other",
        name: t("🌍 כל יעד אחר שאינו מופיע מעלה", "🌍 Any other destination not listed above"),
        search: "אחר other",
        pills: [g("no", "כל הספקים — לא כלול", "All suppliers — not included")],
      },
    ],
  },
];

// ── Locale-resolved view types ───────────────────────────────────────────────
export type ViewPill = { variant: PillVariant; flag: string | null; label: string };
export type ViewDestCard = {
  id: string;
  name: string;
  /** Lowercased he + en + codes, for client-side filtering across both locales. */
  search: string;
  pills: ViewPill[];
};
export type ViewTransferGroup = {
  id: "all" | "bySupplier" | "none";
  title: string;
  cards: ViewDestCard[];
};

/** All transfer groups, resolved to `locale`. */
export function getTransfers(locale: string): ViewTransferGroup[] {
  const pick = (v: Localized) => localized(v, locale as Locale);
  return GROUPS.map((grp) => ({
    id: grp.id,
    title: pick(grp.title),
    cards: grp.cards.map((c) => ({
      id: c.id,
      name: pick(c.name),
      search: `${c.search} ${c.name.he ?? ""} ${c.name.en ?? ""}`.toLowerCase(),
      pills: c.pills.map((pl) => ({
        variant: pl.variant,
        flag: pl.flag ?? null,
        label: pick(pl.label),
      })),
    })),
  }));
}
