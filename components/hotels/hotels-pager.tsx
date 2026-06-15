"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHotelParams } from "./use-hotel-params";

const PER_PAGE_OPTIONS = [12, 24, 48];

export function HotelsPager({
  total,
  page,
  perPage,
  totalPages,
}: {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}) {
  const t = useTranslations("hotels");
  const { update } = useHotelParams();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
      <span className="text-xs text-muted-foreground">
        {t("pager.count", { total })}
      </span>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            {t("pager.perPage")}
          </span>
          <Select
            value={String(perPage)}
            onValueChange={(v) => update({ perPage: Number(v) })}
          >
            <SelectTrigger size="sm" className="h-8 w-18 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PER_PAGE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="outline"
              disabled={page <= 1}
              aria-label={t("pager.prev")}
              onClick={() => update({ page: page - 1 })}
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>
            <span className="px-1 text-xs whitespace-nowrap text-muted-foreground">
              {t("pager.page", { page, total: totalPages })}
            </span>
            <Button
              size="icon-sm"
              variant="outline"
              disabled={page >= totalPages}
              aria-label={t("pager.next")}
              onClick={() => update({ page: page + 1 })}
            >
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
