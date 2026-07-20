"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddHotelDialog } from "./add-hotel-dialog";

/** Editors' "Add hotel" button for the current destination (opens the dialog). */
export function AddHotelButton({ destIata, destName }: { destIata: string; destName: string }) {
  const t = useTranslations("hotels.add");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t("button")}
      </Button>
      {open && (
        <AddHotelDialog destIata={destIata} destName={destName} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
