"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  BadgeDollarSignIcon,
  Check,
  ContactIcon,
  Copy,
  HeadsetIcon,
  type LucideIcon,
  Mail,
  PencilIcon,
  Phone,
  ToolCaseIcon,
} from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CONTACT_TYPES,
  type ContactGroup,
  type ContactType,
  type SupplierContact as SupplierContactRecord,
  allContacts,
  cleanPhone,
  hasAnyContact,
  newContactGroup,
} from "@/lib/contacts";
import { saveContactsAction } from "@/app/actions/contacts";

type T = ReturnType<typeof useTranslations<"commissions.contact">>;

/** contact type → translation key for its grey subtitle. */
const TYPE_KEY = {
  "agent-support": "typeAgentSupport",
  operation: "typeOperation",
  "operation-manager": "typeOperationManager",
  "sales-rep": "typeSalesRep",
  agent: "typeAgent",
} as const;

/** Leading icon + color per contact type. */
const TYPE_ICON: Record<ContactType, { Icon: LucideIcon; className: string }> = {
  "agent-support": { Icon: HeadsetIcon, className: "text-success" },
  operation: { Icon: ToolCaseIcon, className: "text-warning" },
  "operation-manager": { Icon: ContactIcon, className: "text-purple" },
  "sales-rep": { Icon: BadgeDollarSignIcon, className: "text-gold" },
  agent: { Icon: ContactIcon, className: "text-brand" },
};

/** A boxed icon-only copy button that briefly confirms with a check. */
function CopyButton({ value }: { value: string }) {
  const t = useTranslations("commissions.contact");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (e.g. insecure context) — nothing else to do */
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={copy}
      aria-label={copied ? t("copied") : t("copy")}
      className={`shrink-0 ${copied ? "text-success" : "text-muted-foreground"}`}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </Button>
  );
}

/**
 * One channel on its own line: a plain icon-only action button (opens the mail
 * app / dialer), the value as ltr text, and the boxed copy button.
 */
function ChannelLine({ type, value }: { type: "email" | "phone"; value: string }) {
  const t = useTranslations("commissions.contact");
  const Icon = type === "email" ? Mail : Phone;
  const href = type === "email" ? `mailto:${value}` : `tel:${cleanPhone(value)}`;
  return (
    <div className="flex items-center gap-2 py-1.5">
      <Button
        variant="ghost"
        size="icon-sm"
        nativeButton={false}
        aria-label={type === "email" ? t("email") : t("phone")}
        className="shrink-0 text-muted-foreground"
        render={<a href={href} />}>
        <Icon className="size-4" />
      </Button>
      {/* The value itself is the link too, so clicking the email/number opens
          the mail app / dialer — not only the icon. */}
      <a
        href={href}
        dir="ltr"
        className="min-w-0 flex-1 text-sm font-bold break-all text-brand hover:underline">
        {value}
      </a>
      <CopyButton value={value} />
    </div>
  );
}

/**
 * A titled contact group, separated from the previous one by a top divider: a
 * header row with a bold title (and optional leading role icon) at the start and
 * a muted "type" label at the end, then its channel lines.
 */
function ContactBlock({
  title,
  type,
  icon: Icon,
  iconClass,
  children,
}: {
  title: string;
  type: string;
  icon?: LucideIcon;
  iconClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-1 border-t border-border pt-2 first:mt-0 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2 px-0.5">
        {Icon && <Icon className={`size-4 shrink-0 ${iconClass ?? ""}`} aria-hidden />}
        <span className="flex-1 text-sm font-bold" dir="auto">
          {title}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{type}</span>
      </div>
      {children}
    </div>
  );
}

export function SupplierContact({
  supplierId,
  supplierName,
  contact,
  canEdit = false,
  size = "icon-sm",
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: {
  supplierId: string;
  supplierName: string;
  /** The shared contact record for this supplier/airline (fetched server-side). */
  contact: SupplierContactRecord;
  /** Server-computed `can("content:edit")` — cosmetic; the action re-checks. */
  canEdit?: boolean;
  /** Trigger button size. Defaults to `icon-sm` (28px); `icon` is 32px. */
  size?: React.ComponentProps<typeof Button>["size"];
  /** Controlled open state. When provided, the component is fully controlled. */
  open?: boolean;
  onOpenChange?: (_open: boolean) => void;
  /** Hide the built-in trigger button (e.g. when opened from a menu). */
  hideTrigger?: boolean;
}) {
  const t = useTranslations("commissions.contact");
  const router = useRouter();
  const controlled = openProp !== undefined;
  const [openState, setOpenState] = useState(false);
  const open = controlled ? openProp : openState;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ContactGroup[]>([]);

  function handleOpenChange(o: boolean) {
    if (!controlled) setOpenState(o);
    onOpenChange?.(o);
    // Reset to the read-only view so reopening never lands in edit mode.
    if (!o) setEditing(false);
  }

  function startEdit() {
    setDraft(allContacts(contact));
    setEditing(true);
  }

  async function save() {
    // A contact needs a label and at least one channel; the action routes each
    // into its section by type and replaces this supplier's rows wholesale.
    const next = draft
      .map((g) => ({
        active: g.active,
        label: g.label.trim(),
        type: g.type,
        phone: (g.phone ?? "").trim(),
        email: (g.email ?? "").trim(),
      }))
      .filter((g) => g.label && (g.phone || g.email));
    setSaving(true);
    const result = await saveContactsAction(supplierId, next);
    setSaving(false);
    if ("error" in result) {
      toast.error(t("saveError"));
      return;
    }
    toast.success(t("saved"));
    setEditing(false);
    router.refresh();
  }

  const updateContact = (i: number, patch: Partial<ContactGroup>) =>
    setDraft((d) => d.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  const addContact = () => setDraft((d) => [...d, newContactGroup("agent-support")]);
  const removeContact = (i: number) => setDraft((d) => d.filter((_, idx) => idx !== i));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <TooltipProvider>
          <Tooltip>
            <DialogTrigger
              render={
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size={size}
                      aria-label={t("button")}
                      className="text-muted-foreground"
                    />
                  }
                />
              }>
              <Phone className="size-4" />
            </DialogTrigger>
            <TooltipContent>{t("button")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Flex column with the body as the ONLY scroll area, so the header and
          the Save/Cancel footer stay visible however long the contact list gets. */}
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ContactIcon className="size-5 text-brand" aria-hidden /> {t("title")}
          </DialogTitle>
          <DialogDescription>{supplierName}</DialogDescription>
        </DialogHeader>

        {/* Full-bleed scroll area (-mx-4 vs the dialog's p-4) so the scrollbar
            hugs the dialog edge; a top divider separates it from the header. */}
        <div className="-mx-4 min-h-0 flex-1 overflow-y-auto border-t border-border px-4 pt-3">
          {!editing ? (
            <ContactView contact={contact} t={t} />
          ) : (
            <ContactEdit
              contacts={draft}
              updateContact={updateContact}
              addContact={addContact}
              removeContact={removeContact}
              t={t}
            />
          )}
        </div>

        <DialogFooter className="flex-row justify-end">
          {!editing ? (
            <>
              {canEdit && (
                <Button type="button" onClick={startEdit}>
                  <PencilIcon className="size-4" /> {t("edit")}
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                {t("close")}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" onClick={save} disabled={saving}>
                {t("save")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                {t("cancel")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Read-only contact details. */
function ContactView({ contact, t }: { contact: SupplierContactRecord; t: T }) {
  if (!hasAnyContact(contact)) {
    return (
      <p className="rounded-lg bg-surface-2 px-3 py-6 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }
  const visible = allContacts(contact).filter((g) => g.active && (g.phone || g.email));
  return (
    <div className="flex flex-col">
      {visible.map((g, i) => {
        const ic = TYPE_ICON[g.type];
        const typeText = t(TYPE_KEY[g.type]);
        // Show the grey type whenever there's a label (even if it matches the
        // type); only fall back to the type-as-title when no label was given.
        return (
          <ContactBlock
            key={i}
            title={g.label || typeText}
            type={g.label ? typeText : ""}
            icon={ic.Icon}
            iconClass={ic.className}>
            {g.phone && <ChannelLine type="phone" value={g.phone} />}
            {g.email && <ChannelLine type="email" value={g.email} />}
          </ContactBlock>
        );
      })}
    </div>
  );
}

/** Editable form: a flat list of contacts (the name comes from the supplier row). */
function ContactEdit({
  contacts,
  updateContact,
  addContact,
  removeContact,
  t,
}: {
  contacts: ContactGroup[];
  updateContact: (_i: number, _patch: Partial<ContactGroup>) => void;
  addContact: () => void;
  removeContact: (_i: number) => void;
  t: T;
}) {
  return (
    <div className="flex flex-col gap-3">
      {contacts.map((g, i) => (
        <ContactEditRow
          key={i}
          group={g}
          onChange={(patch) => updateContact(i, patch)}
          onRemove={() => removeContact(i)}
          t={t}
        />
      ))}
      <AddButton onClick={addContact}>➕ {t("addContact")}</AddButton>
    </div>
  );
}

/** One editable contact: active toggle, type, label, email, phone. */
function ContactEditRow({
  group,
  onChange,
  onRemove,
  t,
}: {
  group: ContactGroup;
  onChange: (_patch: Partial<ContactGroup>) => void;
  onRemove: () => void;
  t: T;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border border-dashed p-3 ${
        group.active ? "border-border" : "border-border/60 opacity-70"
      }`}>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <input
            type="checkbox"
            checked={group.active}
            onChange={(e) => onChange({ active: e.target.checked })}
            className="size-4 accent-brand"
          />
          {t("active")}
        </label>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <button
                type="button"
                className="text-xs font-bold text-muted-foreground hover:text-destructive"
              />
            }>
            🗑 {t("remove")}
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>{t("removeConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("removeConfirmBody")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={onRemove}>
                {t("remove")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <Field label={t("type")}>
        <select
          value={group.type}
          onChange={(e) => onChange({ type: e.target.value as ContactType })}
          className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring dark:bg-input/30">
          {CONTACT_TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {t(TYPE_KEY[ty])}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("label")}>
        <Input value={group.label} onChange={(e) => onChange({ label: e.target.value })} />
      </Field>
      <Field label={`📧 ${t("email")}`}>
        <Input
          type="email"
          dir="ltr"
          value={group.email ?? ""}
          placeholder="name@example.com"
          onChange={(e) => onChange({ email: e.target.value })}
        />
      </Field>
      <Field label={`☎️ ${t("phone")}`}>
        <Input
          type="tel"
          dir="ltr"
          value={group.phone ?? ""}
          placeholder="03-1234567"
          onChange={(e) => onChange({ phone: e.target.value })}
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:border-brand hover:text-brand">
      {children}
    </button>
  );
}
