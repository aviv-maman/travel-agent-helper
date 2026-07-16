import { describe, expect, test } from "bun:test";
import { buildQuoteTitle, extractFencedBlock, forwardableMessage } from "./quote-title";

/** A realistic reply: internal profit/cost calculations, then the client block. */
const QUOTE_WITH_CALCULATIONS = `חישוב פנימי (לא ללקוח):
עלות ספק: 1,000$ · מחיר מכירה: 1,240$ · רווח: 240$

\`\`\`
חבילת נופש לכרתים 🇬🇷🌿
💳 מחיר סופי לחבילה: **1,240$** ל-2 נוסעים
\`\`\`
רוצה שאשנה משהו בהצעה?`;

const HEBREW_WHATSAPP_QUOTE = `\`\`\`
חבילת נופש לכרתים 🇬🇷🌿

הטיסות שלכם (בלו בירד):
🛫 הלוך - 27/07 | המראה: 09:25, נחיתה: 11:15 (טיסה BZ758)
🛬 חזור - 31/07 | המראה: 12:00, נחיתה: 14:00 (טיסה BZ759)

💳 מחיר סופי לחבילה (טיסה + מלון):
**620$** לנוסע (כ-2,300 ₪)*
סך הכל ל-2 נוסעים: **1,240$** (כ-4,600 ₪)*

המחיר נכון לרגע זה ועשוי להשתנות עד לביצוע ההזמנה. ✨
\`\`\`
רוצה שאשנה משהו בהצעה?`;

describe("extractFencedBlock", () => {
  test("returns the inner text of the first fenced block", () => {
    const block = extractFencedBlock(HEBREW_WHATSAPP_QUOTE);
    expect(block).toStartWith("חבילת נופש לכרתים");
    expect(block).not.toContain("```");
    expect(block).not.toContain("רוצה שאשנה");
  });

  test("returns null when there is no fenced block", () => {
    expect(extractFencedBlock("plain quote text")).toBeNull();
  });
});

describe("forwardableMessage", () => {
  test("returns only the client block, dropping the internal calculations", () => {
    const msg = forwardableMessage(QUOTE_WITH_CALCULATIONS);
    expect(msg).toStartWith("חבילת נופש לכרתים");
    expect(msg).toContain("מחיר סופי");
    expect(msg).not.toContain("חישוב פנימי"); // "internal calculation" header
    expect(msg).not.toContain("עלות ספק"); // supplier cost
    expect(msg).not.toContain("רווח"); // profit
    expect(msg).not.toContain("רוצה שאשנה"); // the trailing chatter after the block
    expect(msg).not.toContain("```");
  });

  test("falls back to the whole reply when there is no fenced block", () => {
    expect(forwardableMessage("just a plain reply")).toBe("just a plain reply");
  });
});

describe("buildQuoteTitle", () => {
  test("titles a Hebrew WhatsApp quote from the block's first line", () => {
    // The saved-quote-19 scenario: the last user turn was just "כן".
    const title = buildQuoteTitle("כן", HEBREW_WHATSAPP_QUOTE);
    expect(title).toStartWith("חבילת נופש לכרתים");
    expect(title).toContain("27.7");
    expect(title).toContain("2 נוסעים");
    expect(title).not.toBe("כן");
  });

  test("strips ALL emojis from the title (flags scramble RTL; the rest are noise)", () => {
    const title = buildQuoteTitle("כן", HEBREW_WHATSAPP_QUOTE);
    expect(title).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u); // no 🇬🇷 regional indicators
    expect(title).not.toContain("🌿");
    expect(title).toStartWith("חבילת נופש לכרתים");
  });

  test("appends the hotel name at the end when the block names one", () => {
    const packageQuote = `\`\`\`
טיסה + מלון לבודפשט 🏰✨

🏨 המלון שלכם:
Leonardo City Tower — 4★
📅 צ'ק-אין: 27/07 | צ'ק-אאוט: 31/07 (4 לילות)

💳 מחיר סופי לחבילה: **620$** לנוסע ל-2 נוסעים
\`\`\``;
    const title = buildQuoteTitle("כן", packageQuote);
    expect(title).toEndWith("Leonardo City Tower");
    expect(title).toStartWith("טיסה + מלון לבודפשט");
    expect(title).not.toContain("★");
    expect(title).not.toContain("🏰");
  });

  test("does not duplicate a hotel already named in the title line", () => {
    const quote = `\`\`\`
הצעה למלון Leonardo City Tower

🏨 המלון שלכם:
Leonardo City Tower — 4★
\`\`\``;
    const title = buildQuoteTitle("כן", quote);
    expect(title.match(/Leonardo City Tower/g)).toHaveLength(1);
  });

  test("keeps the legacy English extraction for non-fenced quotes (hotel last)", () => {
    const content = "Hotel: Sheraton — Batumi\nCheck-in 10.7.26, 5 nights\nTotal for 2 adults: $980";
    expect(buildQuoteTitle("quote for Batumi please", content)).toBe("10.7 - Batumi - 2 people - Sheraton");
  });

  test("never uses a bare confirmation as the title", () => {
    expect(buildQuoteTitle("yes", "A weekend deal in Paris, wonderful hotel included")).toBe(
      "A weekend deal in Paris, wonderful hotel included",
    );
    expect(buildQuoteTitle("תודה רבה!", "הצעה לסופ״ש בפריז")).toBe("הצעה לסופ״ש בפריז");
  });

  test("falls back to the prompt when it is meaningful", () => {
    expect(buildQuoteTitle("Weekend in Paris for the Cohen family", "")).toBe(
      "Weekend in Paris for the Cohen family",
    );
  });

  test("returns the default when nothing is usable", () => {
    expect(buildQuoteTitle("ok", "")).toBe("Saved quote");
  });
});
