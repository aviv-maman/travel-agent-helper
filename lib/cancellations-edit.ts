import type { CancelBlock, CancelMarkup, Fee, FeeLevel, Localized } from "@/db/schema";

/**
 * Pure helpers shared by the cancellation edit modal and its server action.
 *
 * The stored card is an ordered list of blocks (heading / subheading / net fee
 * table / client-copy script). For editing we flatten it into **sections** —
 * one net table each, tagged with its main category (heading) + sub-category
 * (subheading) — so the modal can navigate category → sub-category → rows. On
 * save we serialize the sections back to blocks AND regenerate each section's
 * client-copy block from the net rows + the supplier's markup rule.
 *
 * Fees are structured (`Fee`) so markup can be computed. Legacy/curated rows
 * store only the rendered `fee` string, so we parse it on demand; edited rows
 * persist `net` for exactness.
 */

export const DEFAULT_MARKUP: CancelMarkup = { points: 10, dollars: 95, euros: 100 };

export type EditRow = { timeframe: Localized; fee: Fee; level: FeeLevel };
export type EditSection = {
  heading: Localized | null;
  subheading: { text: Localized; tone: "accent" | "gold" } | null;
  caption: Localized;
  headers: [Localized, Localized] | null;
  /** Preserved from the section's existing copy block, so titles/variants keep. */
  copyVariant: "change" | null;
  copyTitle: Localized | null;
  /** Law-clause wording for a cancellation copy — inferred from the timeframes. */
  when: "flight" | "departure";
  rows: EditRow[];
};

const he = (v: Localized) => v.he ?? "";
const en = (v: Localized) => v.en ?? "";
const num = (n: number) => n.toLocaleString("en-US");

/** Render a structured fee to its display string, matching the seed's style. */
export function feeText(fee: Fee, locale: "he" | "en"): string {
  if (fee.kind === "percent") {
    if (fee.value >= 100) return locale === "he" ? "100% — ללא החזר" : "100% — no refund";
    return locale === "he" ? `${fee.value}% מהעלות` : `${fee.value}% of cost`;
  }
  if (fee.kind === "amount") {
    const sym = fee.currency === "usd" ? "$" : "€";
    const core = locale === "he" ? `${num(fee.value)}${sym}` : `${sym}${num(fee.value)}`;
    const suffix = fee.suffix ? ` ${locale === "he" ? he(fee.suffix) : en(fee.suffix)}` : "";
    return core + suffix;
  }
  return locale === "he" ? he(fee.label) : en(fee.label);
}

/** Both-locale display strings for a fee (what gets stored in `FeeRow.fee`). */
export function feeLocalized(fee: Fee): Localized {
  return { he: feeText(fee, "he"), en: feeText(fee, "en") };
}

/**
 * Best-effort parse of a rendered fee back into a structured `Fee`, so the
 * editor can pre-fill %/$ modes from curated data. Anything that isn't a clean
 * percentage or single-currency amount falls back to free text (still editable,
 * just not marked up).
 */
export function parseFee(value: Localized): Fee {
  const h = he(value).trim();
  const e = en(value).trim();
  const pct = h.match(/^(\d+(?:\.\d+)?)\s*%/) ?? e.match(/^(\d+(?:\.\d+)?)\s*%/);
  if (pct) return { kind: "percent", value: Math.round(Number(pct[1])) };

  // A single currency only — dual "100$ / 100€" (two symbols) stays free text.
  const symbols = (h.match(/[$€]/g) ?? []).length;
  if (symbols <= 1) {
    const cur: "usd" | "eur" | null = h.includes("€") || e.includes("€")
      ? "eur"
      : h.includes("$") || e.includes("$")
        ? "usd"
        : null;
    if (cur) {
      const sym = cur === "usd" ? "$" : "€";
      const grab = (s: string) => {
        const m = s.match(/([\d,]+)\s*\$|\$\s*([\d,]+)|([\d,]+)\s*€|€\s*([\d,]+)/);
        const digits = m ? (m[1] ?? m[2] ?? m[3] ?? m[4]) : null;
        return digits ? { value: Number(digits.replace(/,/g, "")), suffix: stripAmount(s, sym) } : null;
      };
      const gh = grab(h);
      const ge = grab(e);
      if (gh) {
        const suffix =
          gh.suffix || (ge?.suffix ?? "")
            ? { he: gh.suffix, en: ge?.suffix ?? gh.suffix }
            : undefined;
        return { kind: "amount", currency: cur, value: gh.value, suffix };
      }
    }
  }
  return { kind: "text", label: value };
}

/** Everything in `s` after the leading `<num><sym>` / `<sym><num>` amount. */
function stripAmount(s: string, sym: string): string {
  const esc = sym === "$" ? "\\$" : "€";
  return s
    .replace(new RegExp(`^[\\s]*(?:[\\d,]+\\s*${esc}|${esc}\\s*[\\d,]+)`), "")
    .trim();
}

/** Apply the supplier's markup to a net fee → the client-copy fee. */
export function markupFee(fee: Fee, m: CancelMarkup): Fee {
  if (fee.kind === "percent") {
    return fee.value >= 100 ? fee : { kind: "percent", value: fee.value + m.points };
  }
  if (fee.kind === "amount") {
    return { ...fee, value: fee.value + (fee.currency === "eur" ? m.euros : m.dollars) };
  }
  return fee;
}

// ── Block ↔ section transforms ───────────────────────────────────────────────

/** Flatten a stored card into editable sections (one per net table). */
export function blocksToSections(blocks: CancelBlock[]): EditSection[] {
  const sections: EditSection[] = [];
  let heading: Localized | null = null;
  let subheading: { text: Localized; tone: "accent" | "gold" } | null = null;
  blocks.forEach((b, i) => {
    if (b.kind === "heading") {
      heading = b.text;
      subheading = null;
    } else if (b.kind === "subheading") {
      subheading = { text: b.text, tone: b.tone };
    } else if (b.kind === "table") {
      const next = blocks[i + 1];
      const copy = next && next.kind === "copy" ? next : null;
      const timeframes = b.rows.map((r) => `${he(r.timeframe)} ${en(r.timeframe)}`).join(" ");
      sections.push({
        heading,
        subheading,
        caption: b.caption,
        headers: b.headers ?? null,
        copyVariant: copy?.variant ?? null,
        copyTitle: copy?.title ?? null,
        when: /טיסה|flight/i.test(timeframes) ? "flight" : "departure",
        rows: b.rows.map((r) => ({
          timeframe: r.timeframe,
          fee: r.net ?? parseFee(r.fee),
          level: r.level,
        })),
      });
    }
  });
  return sections;
}

/** Serialize sections back to blocks, regenerating each copy from the markup. */
export function sectionsToBlocks(sections: EditSection[], markup: CancelMarkup): CancelBlock[] {
  const blocks: CancelBlock[] = [];
  let lastHeadingKey: string | null = null;
  for (const s of sections) {
    const headingKey = s.heading ? JSON.stringify(s.heading) : null;
    if (headingKey !== lastHeadingKey) {
      if (s.heading) blocks.push({ kind: "heading", text: s.heading });
      lastHeadingKey = headingKey;
    }
    if (s.subheading) {
      blocks.push({ kind: "subheading", text: s.subheading.text, tone: s.subheading.tone });
    }
    blocks.push({
      kind: "table",
      caption: s.caption,
      headers: s.headers ?? undefined,
      rows: s.rows.map((r) => ({
        timeframe: r.timeframe,
        fee: feeLocalized(r.fee),
        level: r.level,
        net: r.fee,
      })),
    });
    blocks.push(deriveCopyBlock(s, markup));
  }
  return blocks;
}

/** One client-copy line for a marked-up cancellation fee. */
function cancelCopyFee(fee: Fee, locale: "he" | "en"): string {
  if (fee.kind === "percent") {
    if (fee.value >= 100) {
      return locale === "he" ? "100% מהעלות, ללא כל החזר" : "100% of the cost, no refund";
    }
    return locale === "he" ? `${fee.value}% מהעלות לנוסע` : `${fee.value}% of the cost per traveler`;
  }
  if (fee.kind === "amount") {
    const base = feeText(fee, locale);
    return locale === "he" ? `${base} לנוסע` : `${base} per traveler`;
  }
  return feeText(fee, locale);
}

/** Build the derived `copy` block for a section (law preamble + marked tiers). */
function deriveCopyBlock(s: EditSection, m: CancelMarkup): CancelBlock {
  const isChange = s.copyVariant === "change";
  const tier = (locale: "he" | "en") =>
    s.rows
      .map((r) => {
        const marked = markupFee(r.fee, m);
        const time = locale === "he" ? he(r.timeframe) : en(r.timeframe);
        const fee = isChange ? feeText(marked, locale) : cancelCopyFee(marked, locale);
        return `${time} — ${fee}.`;
      })
      .join("\n\n");

  const lead = (locale: "he" | "en") => {
    if (isChange) {
      return locale === "he"
        ? "דמי שינוי לנוסע (כולל מרווח הסוכן):"
        : "Change fee per traveler (incl. agency margin):";
    }
    const w = s.when === "flight" ? (locale === "he" ? "לפני הטיסה" : "before the flight") : locale === "he" ? "לפני היציאה" : "before departure";
    return locale === "he"
      ? `עד 14 ימים קלנדריים מיום ההזמנה, בתנאי שיש לפחות 7 ימי עסקים ${w} — 100 ₪ לנוסע או 5% ממחיר העסקה (הנמוך מביניהם) — בהתאם לחוק הגנת הצרכן.`
      : `Up to 14 calendar days from booking, provided there are at least 7 business days ${w} — ₪100 per traveler or 5% of the transaction price (whichever is lower) — per the Consumer Protection Law.`;
  };

  return {
    kind: "copy",
    text: { he: `${lead("he")}\n\n${tier("he")}`, en: `${lead("en")}\n\n${tier("en")}` },
    levels: s.rows.map((r) => r.level),
    ...(s.copyTitle ? { title: s.copyTitle } : {}),
    ...(isChange ? { variant: "change" as const } : {}),
  };
}
