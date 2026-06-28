"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Phone } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type ContactExtra,
  type ContactGroup,
  type SupplierContact,
  cleanPhone,
  emptyContact,
  emptyGroup,
  getContact,
  hasAnyContact,
  setContact,
} from "@/lib/contacts";

type RowColor = "brand" | "success" | "warning" | "purple";
const ROW_CHIP: Record<RowColor, string> = {
  brand: "bg-brand/15 text-brand",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  purple: "bg-purple/15 text-purple",
};

/** A single read-only contact line with an optional tel:/mailto: link. */
function ContactRow({
  icon,
  color,
  label,
  value,
  href,
}: {
  icon: string;
  color: RowColor;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${ROW_CHIP[color]}`}
        aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-muted-foreground">{label}</div>
        <div className="font-bold break-words" dir="ltr">
          {href ? (
            <a href={href} className="text-brand hover:underline">
              {value}
            </a>
          ) : (
            value
          )}
        </div>
      </div>
      {href && <span className="text-muted-foreground">›</span>}
    </div>
  );
}

export function SupplierContact({
  supplierId,
  supplierName,
  size = "icon-sm",
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: {
  supplierId: string;
  supplierName: string;
  /** Trigger button size. Defaults to `icon-sm` (28px); `icon` is 32px. */
  size?: React.ComponentProps<typeof Button>["size"];
  /** Controlled open state. When provided, the component is fully controlled. */
  open?: boolean;
  onOpenChange?: (_open: boolean) => void;
  /** Hide the built-in trigger button (e.g. when opened from a menu). */
  hideTrigger?: boolean;
}) {
  const t = useTranslations("commissions.contact");
  const controlled = openProp !== undefined;
  const [openState, setOpenState] = useState(false);
  const open = controlled ? openProp : openState;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SupplierContact>(emptyContact);

  function handleOpenChange(o: boolean) {
    if (!controlled) setOpenState(o);
    onOpenChange?.(o);
    // Reset to the read-only view so reopening never lands in edit mode.
    if (!o) setEditing(false);
  }

  function startEdit() {
    setDraft(getContact(supplierId));
    setEditing(true);
  }

  function save() {
    // Drop a group if the user emptied it; keep only filled extras.
    const tidyGroup = (g: ContactGroup): ContactGroup => ({
      ...g,
      active: g.active && Boolean(g.name || g.phone || g.email),
    });
    const next: SupplierContact = {
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      sales: tidyGroup(draft.sales),
      agent: tidyGroup(draft.agent),
      extras: draft.extras.filter((e) => e.value.trim()),
    };
    setContact(supplierId, next);
    setEditing(false);
  }

  // ── group + extra editing helpers (operate on the draft) ──
  const setGroup = (which: "sales" | "agent", patch: Partial<ContactGroup>) =>
    setDraft((d) => ({ ...d, [which]: { ...d[which], ...patch } }));
  const setExtra = (i: number, patch: Partial<ContactExtra>) =>
    setDraft((d) => ({
      ...d,
      extras: d.extras.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    }));
  const addExtra = () =>
    setDraft((d) => ({ ...d, extras: [...d.extras, { type: "email", label: "", value: "" }] }));
  const removeExtra = (i: number) =>
    setDraft((d) => ({ ...d, extras: d.extras.filter((_, idx) => idx !== i) }));

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

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span aria-hidden>📞</span> {t("title", { name: supplierName })}
          </DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        {!editing ? (
          <ContactView supplierId={supplierId} t={t} />
        ) : (
          <ContactEdit
            draft={draft}
            setDraft={setDraft}
            setGroup={setGroup}
            setExtra={setExtra}
            addExtra={addExtra}
            removeExtra={removeExtra}
            t={t}
          />
        )}

        <DialogFooter>
          {!editing ? (
            <>
              <Button type="button" onClick={startEdit} className="flex-1">
                ✏️ {t("edit")}
              </Button>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                {t("close")}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" onClick={save} className="flex-1">
                💾 {t("save")}
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

type T = ReturnType<typeof useTranslations<"commissions.contact">>;

/** Read-only contact details. Reads the latest stored contact on render. */
function ContactView({ supplierId, t }: { supplierId: string; t: T }) {
  const contact = getContact(supplierId);
  if (!hasAnyContact(contact)) {
    return (
      <p className="rounded-lg bg-surface-2 px-3 py-6 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {contact.email && (
        <ContactRow
          icon="📧"
          color="brand"
          label={t("supplierEmail")}
          value={contact.email}
          href={`mailto:${contact.email}`}
        />
      )}
      {contact.phone && (
        <ContactRow
          icon="☎️"
          color="success"
          label={t("supplierPhone")}
          value={contact.phone}
          href={`tel:${cleanPhone(contact.phone)}`}
        />
      )}
      {contact.extras.map((ex, i) =>
        ex.value ? (
          <ContactRow
            key={i}
            icon={ex.type === "email" ? "📧" : "☎️"}
            color="brand"
            label={ex.label || (ex.type === "email" ? t("email") : t("phone"))}
            value={ex.value}
            href={ex.type === "email" ? `mailto:${ex.value}` : `tel:${cleanPhone(ex.value)}`}
          />
        ) : null,
      )}
      {contact.sales.active && (
        <ContactGroupView group={contact.sales} color="warning" tag={`📈 ${t("sales")}`} t={t} />
      )}
      {contact.agent.active && (
        <ContactGroupView group={contact.agent} color="purple" tag={`👤 ${t("agent")}`} t={t} />
      )}
    </div>
  );
}

function ContactGroupView({
  group,
  color,
  tag,
  t,
}: {
  group: ContactGroup;
  color: RowColor;
  tag: string;
  t: T;
}) {
  if (!group.name && !group.phone && !group.email) return null;
  const border = color === "warning" ? "border-warning/40" : "border-purple/40";
  return (
    <div className={`flex flex-col gap-2 rounded-xl border border-dashed ${border} p-2.5`}>
      <span className={`text-xs font-bold ${color === "warning" ? "text-warning" : "text-purple"}`}>
        {tag}
      </span>
      {group.name && (
        <ContactRow icon="🪪" color={color} label={t("name")} value={group.name} />
      )}
      {group.phone && (
        <ContactRow
          icon="📱"
          color={color}
          label={t("phone")}
          value={group.phone}
          href={`tel:${cleanPhone(group.phone)}`}
        />
      )}
      {group.email && (
        <ContactRow
          icon="✉️"
          color={color}
          label={t("email")}
          value={group.email}
          href={`mailto:${group.email}`}
        />
      )}
    </div>
  );
}

/** Editable form bound to the draft contact. */
function ContactEdit({
  draft,
  setDraft,
  setGroup,
  setExtra,
  addExtra,
  removeExtra,
  t,
}: {
  draft: SupplierContact;
  setDraft: React.Dispatch<React.SetStateAction<SupplierContact>>;
  setGroup: (_which: "sales" | "agent", _patch: Partial<ContactGroup>) => void;
  setExtra: (_i: number, _patch: Partial<ContactExtra>) => void;
  addExtra: () => void;
  removeExtra: (_i: number) => void;
  t: T;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field label={`📧 ${t("supplierEmail")}`}>
        <Input
          type="email"
          dir="ltr"
          value={draft.email}
          placeholder="info@example.com"
          onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
        />
      </Field>
      <Field label={`☎️ ${t("supplierPhone")}`}>
        <Input
          type="tel"
          dir="ltr"
          value={draft.phone}
          placeholder="03-1234567"
          onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
        />
      </Field>

      <GroupEdit
        which="sales"
        group={draft.sales}
        color="warning"
        tag={`📈 ${t("sales")}`}
        setGroup={setGroup}
        t={t}
      />
      <GroupEdit
        which="agent"
        group={draft.agent}
        color="purple"
        tag={`👤 ${t("agent")}`}
        setGroup={setGroup}
        t={t}
      />

      {draft.extras.map((ex, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border border-dashed border-brand/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-brand">➕ {t("extraChannel")}</span>
            <button
              type="button"
              onClick={() => removeExtra(i)}
              className="text-xs font-bold text-muted-foreground hover:text-destructive">
              🗑 {t("remove")}
            </button>
          </div>
          <div className="flex gap-1.5">
            {(["email", "phone"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setExtra(i, { type })}
                className={`flex-1 rounded-lg border py-2 text-xs font-bold ${
                  ex.type === type
                    ? "border-brand bg-brand/15 text-brand"
                    : "border-border text-muted-foreground"
                }`}>
                {type === "email" ? `📧 ${t("email")}` : `☎️ ${t("phone")}`}
              </button>
            ))}
          </div>
          <Field label={t("extraLabel")}>
            <Input
              type="text"
              value={ex.label}
              placeholder="support / ops"
              onChange={(e) => setExtra(i, { label: e.target.value })}
            />
          </Field>
          <Field label={t("extraValue")}>
            <Input
              type={ex.type === "email" ? "email" : "tel"}
              dir="ltr"
              value={ex.value}
              placeholder={ex.type === "email" ? "support@example.com" : "03-1234567"}
              onChange={(e) => setExtra(i, { value: e.target.value })}
            />
          </Field>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        {!draft.sales.active && (
          <AddButton onClick={() => setGroup("sales", { active: true })}>
            ➕ {t("sales")}
          </AddButton>
        )}
        {!draft.agent.active && (
          <AddButton onClick={() => setGroup("agent", { active: true })}>
            ➕ {t("agent")}
          </AddButton>
        )}
        <AddButton onClick={addExtra}>➕ {t("addExtra")}</AddButton>
      </div>
    </div>
  );
}

function GroupEdit({
  which,
  group,
  color,
  tag,
  setGroup,
  t,
}: {
  which: "sales" | "agent";
  group: ContactGroup;
  color: RowColor;
  tag: string;
  setGroup: (_which: "sales" | "agent", _patch: Partial<ContactGroup>) => void;
  t: T;
}) {
  if (!group.active) return null;
  const border = color === "warning" ? "border-warning/40" : "border-purple/40";
  const text = color === "warning" ? "text-warning" : "text-purple";
  return (
    <div className={`flex flex-col gap-2 rounded-xl border border-dashed ${border} p-3`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold ${text}`}>{tag}</span>
        <button
          type="button"
          onClick={() => setGroup(which, emptyGroup())}
          className="text-xs font-bold text-muted-foreground hover:text-destructive">
          🗑 {t("remove")}
        </button>
      </div>
      <Field label={t("name")}>
        <Input
          type="text"
          value={group.name}
          onChange={(e) => setGroup(which, { name: e.target.value })}
        />
      </Field>
      <Field label={t("phone")}>
        <Input
          type="tel"
          dir="ltr"
          value={group.phone}
          onChange={(e) => setGroup(which, { phone: e.target.value })}
        />
      </Field>
      <Field label={t("email")}>
        <Input
          type="email"
          dir="ltr"
          value={group.email}
          onChange={(e) => setGroup(which, { email: e.target.value })}
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
      className="flex-1 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:border-brand hover:text-brand">
      {children}
    </button>
  );
}
