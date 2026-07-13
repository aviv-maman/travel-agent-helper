"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Globe, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SupplierContact } from "@/components/commissions/supplier-contact";
import { emptyContact, type SupplierContact as SupplierContactRecord } from "@/lib/contacts";

/**
 * Row actions for an airline — a "Contact" icon button (opens the shared contact
 * dialog) and a "Website" icon link styled as a button (opens the airline site),
 * each with a tooltip. The contact dialog is controlled here so the button can
 * open it.
 */
export function AirlineActions({
  id,
  name,
  website,
  contact,
  canEditContact,
}: {
  id: string;
  name: string;
  website: string;
  contact?: SupplierContactRecord;
  canEditContact?: boolean;
}) {
  const t = useTranslations("baggage");
  const tc = useTranslations("commissions.contact");
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <div className="flex items-center justify-end gap-1.5">
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
