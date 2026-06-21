"use client";

import { useTranslations } from "next-intl";
import type { FeeLevel, ProductKind, ViewBlock, ViewCancelSupplier } from "@/lib/cancellations";
import type { CommColor } from "@/lib/commissions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CopyScript } from "./copy-script";

/** The Consumer Protection Law banner — shown once at the top of each card. */
function ConsumerLawBox() {
  const t = useTranslations("cancellations");
  return (
    <div className="rounded-lg border border-purple/25 bg-purple/[0.07] px-3.5 py-2.5 text-sm leading-relaxed text-purple">
      {t.rich("law", {
        strong: (chunks) => <strong className="font-bold text-purple/90">{chunks}</strong>,
        u: (chunks) => <u>{chunks}</u>,
      })}
    </div>
  );
}

const CHIP: Record<CommColor, string> = {
  brand: "bg-brand/15 text-brand",
  success: "bg-success/15 text-success",
  gold: "bg-gold/15 text-gold",
  warning: "bg-warning/15 text-warning",
  purple: "bg-purple/15 text-purple",
  destructive: "bg-destructive/15 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

const PRODUCT: Record<ProductKind, string> = {
  flight: "bg-brand/[0.13] text-brand",
  package: "bg-success/[0.12] text-success",
  organized: "bg-purple/[0.13] text-purple",
};

const FEE: Record<FeeLevel, string> = {
  low: "text-brand",
  net: "text-gold",
  gross: "text-warning",
  full: "text-destructive",
};

function Block({ block }: { block: ViewBlock }) {
  switch (block.kind) {
    case "heading":
      return <h4 className="text-base font-extrabold text-foreground">{block.text}</h4>;
    case "subheading":
      return (
        <p className={`text-sm font-bold ${block.tone === "gold" ? "text-gold" : "text-brand"}`}>
          {block.text}
        </p>
      );
    case "table":
      return (
        <div className="rounded-xl border border-warning/30 bg-warning/6 p-3.5">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-foreground">
            {block.caption}
          </p>
          <table className="w-full border-collapse">
            {block.headers && (
              <thead>
                <tr>
                  <th className="border-b border-border px-2 py-1.5 text-start text-xs font-bold text-muted-foreground">
                    {block.headers[0]}
                  </th>
                  <th className="border-b border-border px-2 py-1.5 text-start text-xs font-bold text-muted-foreground">
                    {block.headers[1]}
                  </th>
                </tr>
              </thead>
            )}
            <tbody>
              {block.rows.map((r, i) => (
                <tr key={i} className="border-b border-border/50 last:border-b-0">
                  <td className="px-2 py-1.5 align-middle text-sm text-foreground">
                    {r.timeframe}
                  </td>
                  <td className={`px-2 py-1.5 align-middle text-sm font-bold ${FEE[r.level]}`}>
                    {r.fee}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "copy":
      return (
        <div className="flex flex-col gap-2.5 rounded-xl border border-destructive/30 bg-destructive/6 p-3.5">
          {block.heading && (
            <h4 className="text-base font-extrabold text-foreground">{block.heading}</h4>
          )}
          <CopyScript text={block.text} />
        </div>
      );
  }
}

export function CancelCard({
  supplier,
  defaultOpen,
}: {
  supplier: ViewCancelSupplier;
  defaultOpen?: boolean;
}) {
  return (
    <Accordion
      defaultValue={defaultOpen ? ["cancel"] : undefined}
      className="overflow-hidden rounded-xl border border-border bg-surface">
      <AccordionItem value="cancel" className="border-none px-4">
        <AccordionTrigger className="items-center gap-2.5 py-3 hover:no-underline">
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-lg ${CHIP[supplier.color]}`}
            aria-hidden>
            {supplier.emoji}
          </span>
          <div className="min-w-0 flex-1 text-start">
            <div className="flex items-baseline gap-2">
              <h3 className="text-base font-bold text-foreground">{supplier.name}</h3>
              <span className="text-[0.7rem] font-normal text-muted-foreground">
                {supplier.code}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {supplier.products.map((p, i) => (
                <span
                  key={i}
                  className={`rounded-xl px-2 py-0.5 text-[0.7rem] font-semibold ${PRODUCT[p.kind]}`}>
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="flex flex-col gap-4 border-t border-border pt-4 pb-4">
          <ConsumerLawBox />
          {supplier.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
