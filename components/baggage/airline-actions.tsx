"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Globe, MoreHorizontal, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SupplierContact } from "@/components/commissions/supplier-contact";

/**
 * Row actions for an airline — an ellipsis menu with "Contact" (opens the shared
 * contact dialog) and "Website" (opens the airline site). The contact dialog is
 * controlled here so a menu item can open it.
 */
export function AirlineActions({
  id,
  name,
  website,
}: {
  id: string;
  name: string;
  website: string;
}) {
  const t = useTranslations("baggage");
  const tc = useTranslations("commissions.contact");
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("colActions")}
              className="text-muted-foreground"
            />
          }>
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => setContactOpen(true)}>
            <Phone className="size-4" />
            {tc("button")}
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<a href={website} target="_blank" rel="noopener noreferrer" />}>
            <Globe className="size-4" />
            {t("website")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SupplierContact
        supplierId={id}
        supplierName={name}
        open={contactOpen}
        onOpenChange={setContactOpen}
        hideTrigger
      />
    </>
  );
}
