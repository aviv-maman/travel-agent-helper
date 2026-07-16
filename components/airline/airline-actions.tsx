"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Globe, Pencil, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SupplierContact } from "@/components/commissions/supplier-contact";
import { emptyContact, type SupplierContact as SupplierContactRecord } from "@/lib/contacts";

/** Where this row stands in the table's single-row inline edit. */
export type RowEditState = "idle" | "editing" | "saving" | "locked";

/**
 * Row actions for an airline — a "Contact" icon button (opens the shared contact
 * dialog) and a "Website" icon link styled as a button (opens the airline site),
 * each with a tooltip. The contact dialog is controlled here so the button can
 * open it. Editors also get a pencil that flips the row's suitcase/trolley/
 * commission cells into inline inputs (no dialog), swapping to ✓/✗ while active.
 */
export function AirlineActions({
  id,
  name,
  website,
  contact,
  canEditContact,
  rowEditState,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}: {
  id: string;
  name: string;
  website: string;
  contact?: SupplierContactRecord;
  canEditContact?: boolean;
  /** Null hides the pencil (viewer can't edit content). */
  rowEditState?: RowEditState | null;
  onStartEdit?: () => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
}) {
  const t = useTranslations("baggage");
  const tc = useTranslations("commissions.contact");
  const [contactOpen, setContactOpen] = useState(false);
  const editing = rowEditState === "editing" || rowEditState === "saving";

  return (
    <>
      <TooltipProvider>
        <div className="flex items-center justify-end gap-1.5">
          {rowEditState != null &&
            (editing ? (
              <>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={t("saveRow")}
                        disabled={rowEditState === "saving"}
                        onClick={onSaveEdit}
                      />
                    }>
                    {rowEditState === "saving" ? (
                      <Spinner className="size-4" />
                    ) : (
                      <Check className="size-4 text-success" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent>{t("saveRow")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={t("cancelEdit")}
                        disabled={rowEditState === "saving"}
                        onClick={onCancelEdit}
                      />
                    }>
                    <X className="size-4 text-destructive" />
                  </TooltipTrigger>
                  <TooltipContent>{t("cancelEdit")}</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={t("editRow")}
                      disabled={rowEditState === "locked"}
                      onClick={onStartEdit}
                    />
                  }>
                  <Pencil className="size-4" />
                </TooltipTrigger>
                <TooltipContent>{t("editRow")}</TooltipContent>
              </Tooltip>
            ))}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={tc("button")}
                  onClick={() => setContactOpen(true)}
                />
              }>
              <Phone className="size-4" />
            </TooltipTrigger>
            <TooltipContent>{tc("button")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  nativeButton={false}
                  aria-label={t("website")}
                  render={<a href={website} target="_blank" rel="noopener noreferrer" />}
                />
              }>
              <Globe className="size-4" />
            </TooltipTrigger>
            <TooltipContent>{t("website")}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      <SupplierContact
        supplierId={id}
        supplierName={name}
        contact={contact ?? emptyContact()}
        canEdit={canEditContact}
        open={contactOpen}
        onOpenChange={setContactOpen}
        hideTrigger
      />
    </>
  );
}
