"use client";

import { Fragment, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import type { ProductKind, ViewBlock, ViewCancelSupplier, EditableCancel } from "@/lib/cancellations";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FeeTable } from "./fee-table";
import { CopyScript } from "./copy-script";
import { CancellationEditDialog } from "./cancellation-edit-dialog";

/** Fallback logo shown until a supplier's own logo file is added. */
const PLACEHOLDER_LOGO = "/suppliers/placeholder-logo.svg";

const PRODUCT: Record<ProductKind, string> = {
  flight: "bg-brand/[0.13] text-brand",
  package: "bg-success/[0.12] text-success",
  organized: "bg-purple/[0.13] text-purple",
};

/** Shared style for the small section labels above each table / client copy. */
const SECTION_LABEL = "flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide";

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
        <div className="rounded-lg bg-muted/70 p-3 dark:bg-muted/30">
          <p className={`mb-2 ${SECTION_LABEL} text-destructive`}>{block.caption}</p>
          <FeeTable headers={block.headers} rows={block.rows} />
        </div>
      );
    case "copy":
      return (
        <div className="flex flex-col gap-2 rounded-lg bg-muted/70 p-3 dark:bg-muted/30">
          <CopyScript
            text={block.text}
            levels={block.levels}
            title={block.title}
            variant={block.variant}
          />
        </div>
      );
  }
}

export function CancelCard({
  supplier,
  defaultOpen,
  canEdit,
  editable,
}: {
  supplier: ViewCancelSupplier;
  defaultOpen?: boolean;
  canEdit?: boolean;
  editable?: EditableCancel | null;
}) {
  const tEdit = useTranslations("cancellations");
  const [editing, setEditing] = useState(false);
  const showEdit = Boolean(canEdit && editable);
  return (
    <Accordion
      defaultValue={defaultOpen ? ["cancel"] : undefined}
      className="overflow-hidden rounded-xl border border-border bg-surface">
      <AccordionItem value="cancel" className="relative border-none px-4">
        {showEdit && (
          <button
            type="button"
            aria-label={tEdit("edit.edit")}
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            className="absolute top-3.5 end-10 z-10 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-brand">
            <Pencil className="size-3.5" />
          </button>
        )}
        {editing && editable && (
          <CancellationEditDialog
            slug={supplier.id}
            name={supplier.name}
            blocks={editable.blocks}
            markup={editable.markup}
            onClose={() => setEditing(false)}
          />
        )}
        <AccordionTrigger className="items-center gap-2.5 py-3 pe-14 hover:no-underline">
          <span
            className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2"
            aria-hidden>
            <Image
              src={supplier.logo ?? PLACEHOLDER_LOGO}
              alt=""
              width={36}
              height={36}
              className="size-full object-contain"
            />
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
          {supplier.blocks.map((block, i) => (
            <Fragment key={i}>
              {i > 0 && (block.kind === "heading" || block.kind === "copy") && (
                <div className="h-px bg-border/60" />
              )}
              <Block block={block} />
            </Fragment>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
