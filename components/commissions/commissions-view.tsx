import { useTranslations } from "next-intl";
import type { ViewSupplier } from "@/lib/commissions";
import { CommissionCard } from "./commission-card";

const LEGEND: { dot: string; key: "high" | "mid" | "low" | "net" }[] = [
  { dot: "bg-success", key: "high" },
  { dot: "bg-brand", key: "mid" },
  { dot: "bg-warning", key: "low" },
  { dot: "bg-muted-foreground", key: "net" },
];

export function CommissionsView({ suppliers }: { suppliers: ViewSupplier[] }) {
  const t = useTranslations("commissions");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {LEGEND.map(({ dot, key }) => (
          <span key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`size-2.5 rounded-full ${dot}`} aria-hidden />
            {t(`legend.${key}`)}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-3.5">
        {suppliers.map((s) => (
          <CommissionCard key={s.id} supplier={s} />
        ))}
      </div>
    </div>
  );
}
