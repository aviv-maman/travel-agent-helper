"use client";

import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import type { HotelFeatureValue, HotelTier, HotelTagValue, BoardCode } from "@/db/schema";
import type { SortMode, GroupBy } from "@/lib/hotels";

type Update = {
  dest?: string | null;
  quality?: HotelTier[];
  tags?: HotelTagValue[];
  boards?: BoardCode[];
  features?: HotelFeatureValue[];
  minBooking?: number | null;
  sort?: SortMode;
  groupBy?: GroupBy;
  page?: number;
  perPage?: number;
};

/**
 * Reads the hotel filter/sort/group/pagination state from the URL and writes it
 * back via a soft navigation, so the Server Component re-queries the data. Any
 * change other than `page` itself resets back to page 1.
 */
export function useHotelParams() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const list = (key: string) =>
    (sp.get(key) ?? "").split(",").filter(Boolean);

  const dest = sp.get("dest");
  const quality = list("quality") as HotelTier[];
  const tags = list("tags") as HotelTagValue[];
  const boards = list("boards") as BoardCode[];
  const features = list("features") as HotelFeatureValue[];
  const minBookingRaw = sp.get("minBooking");
  const minBooking = minBookingRaw ? Number(minBookingRaw) : null;
  const sort = (sp.get("sort") ?? "default") as SortMode;
  const groupBy = (sp.get("groupBy") ?? "quality") as GroupBy;
  const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
  const perPage = Math.max(1, Number(sp.get("perPage") ?? "0") || 0);

  function update(next: Update) {
    const p = new URLSearchParams(sp.toString());
    const setList = (key: string, v?: string[]) => {
      if (v && v.length) p.set(key, v.join(","));
      else p.delete(key);
    };
    const setVal = (key: string, v: string | null | undefined, omitIf?: string) => {
      if (v && v !== omitIf) p.set(key, v);
      else p.delete(key);
    };

    if ("dest" in next) setVal("dest", next.dest);
    if ("quality" in next) setList("quality", next.quality);
    if ("tags" in next) setList("tags", next.tags);
    if ("boards" in next) setList("boards", next.boards);
    if ("features" in next) setList("features", next.features);
    if ("minBooking" in next)
      setVal("minBooking", next.minBooking ? String(next.minBooking) : null);
    if ("sort" in next) setVal("sort", next.sort, "default");
    if ("groupBy" in next) setVal("groupBy", next.groupBy, "quality");
    if ("perPage" in next)
      setVal("perPage", next.perPage ? String(next.perPage) : null);

    // Page is explicit; any other change resets to page 1.
    if ("page" in next) setVal("page", next.page && next.page > 1 ? String(next.page) : null);
    else p.delete("page");

    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return {
    dest,
    quality,
    tags,
    boards,
    features,
    minBooking,
    sort,
    groupBy,
    page,
    perPage,
    update,
  };
}
