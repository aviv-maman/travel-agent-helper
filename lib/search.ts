/**
 * Hebrew-aware fuzzy search, ported from the original guide's vanilla JS
 * (commissions-new.html lines 1321–1387). Normalizes diacritics + niqqud,
 * folds Hebrew final letters, and scores by exact/prefix/substring/subsequence.
 */

export function smartNormalize(str: string | null | undefined): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-֑ͯ-ׇ]/g, "") // strip diacritics + niqqud
    .replace(/ך/g, "כ") // ך→כ
    .replace(/ם/g, "מ") // ם→מ
    .replace(/ן/g, "נ") // ן→נ
    .replace(/ף/g, "פ") // ף→פ
    .replace(/ץ/g, "צ") // ץ→צ
    .replace(/[()'"׳״`.,\-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Do all chars of `q` appear in order within `text`? (typo tolerance) */
export function isSubsequence(q: string, text: string): boolean {
  let i = 0;
  for (let j = 0; j < text.length && i < q.length; j++) {
    if (text[j] === q[i]) i++;
  }
  return i === q.length;
}

/** Relevance score (higher = better) or -1 for no match. `haystack` pre-normalized. */
export function smartScore(query: string, haystack: string): number {
  const q = smartNormalize(query);
  if (!q) return 0;
  const h = haystack;
  if (h === q) return 1000; // exact
  if (h.indexOf(q) === 0) return 900; // prefix of whole string
  const tokens = h.split(" ");
  for (const tok of tokens) {
    if (tok === q) return 850; // exact token
    if (tok.indexOf(q) === 0) return 800; // token prefix
  }
  const idx = h.indexOf(q);
  if (idx > -1) return 600 - idx; // substring, earlier = better
  const qWords = q.split(" ");
  if (qWords.length > 1 && qWords.every((w) => h.indexOf(w) > -1)) return 400;
  if (isSubsequence(q.replace(/ /g, ""), h.replace(/ /g, ""))) return 200; // fuzzy
  return -1;
}

/**
 * Rank a list of items against a query. Each item contributes one or more
 * searchable strings (e.g. name + country + iata); the best field score wins.
 */
export function rankBySearch<T>(
  items: T[],
  query: string,
  getHaystacks: (_item: T) => string[],
): T[] {
  const q = smartNormalize(query);
  if (!q) return items;
  return items
    .map((item) => {
      const score = Math.max(
        -1,
        ...getHaystacks(item).map((h) => smartScore(query, smartNormalize(h))),
      );
      return { item, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}
