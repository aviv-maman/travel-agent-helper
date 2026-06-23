/**
 * Per-supplier contact details for the suppliers tab. Mirrors the contact
 * feature from the original single-page commissions guide: each supplier keeps
 * an email + phone, optional "sales rep" and "agent" groups, and any number of
 * extra email/phone channels. Stored in localStorage, keyed by supplier id.
 */

export type ContactGroup = { active: boolean; name: string; phone: string; email: string };
export type ContactExtra = { type: "email" | "phone"; label: string; value: string };
export type SupplierContact = {
  email: string;
  phone: string;
  sales: ContactGroup;
  agent: ContactGroup;
  extras: ContactExtra[];
};

const STORAGE_KEY = "commContacts_v1";

export function emptyGroup(): ContactGroup {
  return { active: false, name: "", phone: "", email: "" };
}

export function emptyContact(): SupplierContact {
  return { email: "", phone: "", sales: emptyGroup(), agent: emptyGroup(), extras: [] };
}

/** Read every stored contact, keyed by supplier id. Safe on the server. */
function readAll(): Record<string, SupplierContact> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function getContact(id: string): SupplierContact {
  return { ...emptyContact(), ...readAll()[id] };
}

export function setContact(id: string, contact: SupplierContact): void {
  if (typeof window === "undefined") return;
  const all = readAll();
  all[id] = contact;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* storage full or unavailable — nothing else we can do */
  }
}

/** Strip a phone number down to digits and a leading "+" for tel: links. */
export function cleanPhone(p: string): string {
  return (p || "").replace(/[^0-9+]/g, "");
}

/** Whether a contact has anything worth showing in the view. */
export function hasAnyContact(c: SupplierContact): boolean {
  return Boolean(
    c.email ||
      c.phone ||
      c.extras.some((e) => e.value) ||
      (c.sales.active && (c.sales.name || c.sales.phone || c.sales.email)) ||
      (c.agent.active && (c.agent.name || c.agent.phone || c.agent.email)),
  );
}
