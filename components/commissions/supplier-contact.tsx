"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Briefcase, Check, Copy, Mail, Phone, User } from "lucide-react";
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
  localizeName,
  setContact,
} from "@/lib/contacts";

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
 * app / dialer), the value as ltr text, an optional muted label (extra channels
 * like "Operation"), and the boxed copy button.
 */
function ChannelLine({
  type,
  value,
  label,
}: {
  type: "email" | "phone";
  value: string;
  label?: string;
}) {
  const t = useTranslations("commissions.contact");
  const Icon = type === "email" ? Mail : Phone;
  const href = type === "email" ? `mailto:${value}` : `tel:${cleanPhone(value)}`;
  return (
    <div className="flex items-center gap-2 py-1.5">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={type === "email" ? t("email") : t("phone")}
        className="shrink-0 text-muted-foreground"
        render={<a href={href} />}>
        <Icon className="size-4" />
      </Button>
      <span className="min-w-0 flex-1 text-sm font-bold break-all text-brand" dir="ltr">
        {value}
      </span>
      {label && <span className="shrink-0 text-xs text-muted-foreground">{label}</span>}
      <CopyButton value={value} />
    </div>
  );
}

/**
 * A sales rep or agent, separated by a top divider: a header row with the
 * person's name (bold) plus a role icon at the start and a muted role label at
 * the end, then their channel lines.
 */
function PersonBlock({ group, role, t }: { group: ContactGroup; role: "sales" | "agent"; t: T }) {
  const locale = useLocale();
  if (!group.name && !group.phone && !group.email) return null;
  const RoleIcon = role === "sales" ? Briefcase : User;
  const roleLabel = role === "sales" ? t("sales") : t("agent");
  return (
    <div className="mt-1 border-t border-border pt-2">
      <div className="flex items-center gap-2 px-0.5">
        <RoleIcon
          className={`size-4 shrink-0 ${role === "sales" ? "text-gold" : "text-brand"}`}
          aria-hidden
        />
        <span className="flex-1 text-sm font-bold" dir="auto">
          {localizeName(group.name, locale) || roleLabel}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{roleLabel}</span>
      </div>
      {group.phone && <ChannelLine type="phone" value={group.phone} />}
      {group.email && <ChannelLine type="email" value={group.email} />}
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
    // Drop a group if the user emptied it; keep only filled agents/extras.
    const tidyGroup = (g: ContactGroup): ContactGroup => ({
      ...g,
      active: g.active && Boolean(g.name || g.phone || g.email),
    });
    const next: SupplierContact = {
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      sales: tidyGroup(draft.sales),
      agents: draft.agents.filter((a) => a.name.trim() || a.phone.trim() || a.email.trim()),
      extras: draft.extras.filter((e) => e.value.trim()),
    };
    setContact(supplierId, next);
    setEditing(false);
  }

  // ── group + extra editing helpers (operate on the draft) ──
  const setSales = (patch: Partial<ContactGroup>) =>
    setDraft((d) => ({ ...d, sales: { ...d.sales, ...patch } }));
  const addAgent = () =>
    setDraft((d) => ({ ...d, agents: [...d.agents, emptyGroup()] }));
  const setAgent = (i: number, patch: Partial<ContactGroup>) =>
    setDraft((d) => ({
      ...d,
      agents: d.agents.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
    }));
  const removeAgent = (i: number) =>
    setDraft((d) => ({ ...d, agents: d.agents.filter((_, idx) => idx !== i) }));
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
            setSales={setSales}
            addAgent={addAgent}
            setAgent={setAgent}
            removeAgent={removeAgent}
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
  const agents = contact.agents.filter((a) => a.name || a.phone || a.email);
  const hasSupplier = Boolean(contact.email || contact.phone || contact.extras.some((e) => e.value));
  return (
    <div className="flex flex-col">
      {hasSupplier && (
        <div>
          <div className="px-0.5 text-xs text-muted-foreground">{t("supplier")}</div>
          {contact.email && <ChannelLine type="email" value={contact.email} />}
          {contact.phone && <ChannelLine type="phone" value={contact.phone} />}
          {contact.extras.map((ex, i) =>
            ex.value ? (
              <ChannelLine key={i} type={ex.type} value={ex.value} label={ex.label} />
            ) : null,
          )}
        </div>
      )}
      {contact.sales.active && <PersonBlock group={contact.sales} role="sales" t={t} />}
      {agents.map((agent, i) => (
        <PersonBlock key={i} group={agent} role="agent" t={t} />
      ))}
    </div>
  );
}

/** Editable form bound to the draft contact. */
function ContactEdit({
  draft,
  setDraft,
  setSales,
  addAgent,
  setAgent,
  removeAgent,
  setExtra,
  addExtra,
  removeExtra,
  t,
}: {
  draft: SupplierContact;
  setDraft: React.Dispatch<React.SetStateAction<SupplierContact>>;
  setSales: (_patch: Partial<ContactGroup>) => void;
  addAgent: () => void;
  setAgent: (_i: number, _patch: Partial<ContactGroup>) => void;
  removeAgent: (_i: number) => void;
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

      {draft.sales.active && (
        <GroupEdit
          group={draft.sales}
          color="warning"
          tag={`📈 ${t("sales")}`}
          onChange={setSales}
          onRemove={() => setSales(emptyGroup())}
          t={t}
        />
      )}
      {draft.agents.map((agent, i) => (
        <GroupEdit
          key={i}
          group={agent}
          color="purple"
          tag={`👤 ${t("agent")}${draft.agents.length > 1 ? ` ${i + 1}` : ""}`}
          onChange={(patch) => setAgent(i, patch)}
          onRemove={() => removeAgent(i)}
          t={t}
        />
      ))}

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
          <AddButton onClick={() => setSales({ active: true })}>
            ➕ {t("sales")}
          </AddButton>
        )}
        <AddButton onClick={addAgent}>➕ {t("agent")}</AddButton>
        <AddButton onClick={addExtra}>➕ {t("addExtra")}</AddButton>
      </div>
    </div>
  );
}

function GroupEdit({
  group,
  color,
  tag,
  onChange,
  onRemove,
  t,
}: {
  group: ContactGroup;
  color: "warning" | "purple";
  tag: string;
  onChange: (_patch: Partial<ContactGroup>) => void;
  onRemove: () => void;
  t: T;
}) {
  const border = color === "warning" ? "border-warning/40" : "border-purple/40";
  const text = color === "warning" ? "text-warning" : "text-purple";
  return (
    <div className={`flex flex-col gap-2 rounded-xl border border-dashed ${border} p-3`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold ${text}`}>{tag}</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-bold text-muted-foreground hover:text-destructive">
          🗑 {t("remove")}
        </button>
      </div>
      <Field label={t("name")}>
        <Input type="text" value={group.name} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <Field label={t("phone")}>
        <Input
          type="tel"
          dir="ltr"
          value={group.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
        />
      </Field>
      <Field label={t("email")}>
        <Input
          type="email"
          dir="ltr"
          value={group.email}
          onChange={(e) => onChange({ email: e.target.value })}
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
