/**
 * Per-supplier (and per-airline) contact details for the suppliers/airlines
 * tabs. Every contact is a single typed record: a `label` (display name), a
 * `type` (its role — shown translated), an optional phone/email, and an
 * `active` flag so a contact can be hidden from the dialog without deleting it.
 * Records are grouped into `general` / `sales` / `agents` by type. Stored in
 * localStorage keyed by supplier/airline id; the shape maps cleanly to a future
 * `supplier_contacts` + `contacts` DB schema.
 */

export type ContactType =
  | "agent-support"
  | "operation"
  | "operation-manager"
  | "sales-rep"
  | "agent";

/** Every selectable contact type, in menu order. */
export const CONTACT_TYPES: ContactType[] = [
  "agent-support",
  "operation",
  "operation-manager",
  "sales-rep",
  "agent",
];

export type ContactGroup = {
  active: boolean;
  /** White display title (usually a person name, e.g. "ליאור דהן"). */
  label: string;
  /** Role — resolved to a localized grey subtitle in the UI. */
  type: ContactType;
  phone?: string;
  email?: string;
};

export type SupplierContact = {
  /** Supplier/airline name (DB-ready; falls back to the caller's name prop). */
  name: string;
  /** agent-support / operation / operation-manager contacts. */
  general?: ContactGroup[];
  /** sales-rep contacts. */
  sales?: ContactGroup[];
  /** agent contacts. */
  agents?: ContactGroup[];
};

const STORAGE_KEY = "commContacts_v2";

/** Which section array a contact lives in, derived from its type. */
export function sectionForType(type: ContactType): "general" | "sales" | "agents" {
  if (type === "sales-rep") return "sales";
  if (type === "agent") return "agents";
  return "general";
}

export function newContactGroup(type: ContactType): ContactGroup {
  return { active: true, label: "", type, phone: "", email: "" };
}

export function emptyContact(): SupplierContact {
  return { name: "", general: [], sales: [], agents: [] };
}

/** Compact builder for the seed below. */
const c = (type: ContactType, label: string, phone = "", email = ""): ContactGroup => ({
  active: true,
  label,
  type,
  phone,
  email,
});

/**
 * Curated per-supplier contacts, keyed by the supplier ids in `lib/commissions`.
 * These seed the contact dialog so agents see real numbers/emails out of the box;
 * once a user edits and saves a supplier, their stored copy fully overrides the
 * default here (see `getContact`).
 */
const DEFAULT_CONTACTS: Record<string, SupplierContact> = {
  israir: {
    name: "ישראייר",
    general: [
      c("agent-support", "שירות", "03-7954000", "israir_agents@israir.co.il"),
      c("agent-support", "טלפון נוסף", "03-7954003"),
    ],
  },
  "kavei-hufsha": {
    name: "קווי חופשה",
    general: [
      c("agent-support", "שירות", "03-6211000", "support@kavei.co.il"),
      c("operation", "תפעול", "", "ops@kavei.co.il"),
      c("operation-manager", "רויטל", "", "revital.av@kavei.co.il"),
    ],
    agents: [c("agent", "אלדו", "054-6230867", "Aldo.h@kavei.co.il")],
  },
  flying: {
    name: "שטיח מעופף",
    general: [c("agent-support", "שירות", "03-5151600", "sherut@flying.co.il")],
    sales: [c("sales-rep", "ליאור דהן", "054-3247602", "liord@flying.co.il")],
    agents: [c("agent", "אנה לנקוב", "054-5914972", "Annalen@flying.co.il")],
  },
  "flying-sp": {
    name: "שטיח מעופף",
    general: [c("agent-support", "שירות", "03-5151600", "sherut@flying.co.il")],
    sales: [c("sales-rep", "ליאור דהן", "054-3247602", "liord@flying.co.il")],
    agents: [c("agent", "אנה לנקוב", "054-5914972", "Annalen@flying.co.il")],
  },
  "kishrei-teufa": {
    name: "קשרי תעופה",
    general: [c("agent-support", "שירות", "03-5205020")],
    sales: [c("sales-rep", "משה אליש", "054-2494400")],
    agents: [c("agent", "דיאנה", "054-2494484", "diana.or@aviation-links.co.il")],
  },
  "eshet-tours": {
    name: "אשת טורס",
    general: [c("agent-support", "שירות", "03-7771025", "sitonaut@eshet-tours.co.il")],
    sales: [c("sales-rep", "דודו", "052-4294620", "dudu.k@eshet-tours.co.il")],
    agents: [
      c("agent", "אביגיל מיכאלי", "", "avigailm@eshet-tours.co.il"),
      c("agent", "שרון בזל", "", "sharonb@eshet-tours.co.il"),
    ],
  },
  arkia: {
    name: "ארקיע",
    general: [
      c("agent-support", "שירות", "03-6903713", "clickagent@arkia.co.il"),
      c("agent-support", "תמיכת סוכנים", "", "Agentsupport@arkia.co.il"),
    ],
    agents: [c("agent", "נופר", "050-2600481")],
  },
  "mona-tours": {
    name: "מונה טורס",
    general: [c("agent-support", "שירות", "03-5141866")],
    agents: [
      c("agent", "ודה ביחובסקי", "", "vedab@mona.co.il"),
      c("agent", "סופה פרומיסלובסקי", "", "sofa@mona.co.il"),
      c("agent", "אילנה ברסקי", "", "ilana@mona.co.il"),
      c("agent", "טל מושקוביץ", "", "talm@mona.co.il"),
    ],
  },
  issta: {
    name: "איסתא",
    general: [c("agent-support", "שירות", "03-7777377", "charter-issta@issta.co.il")],
    agents: [
      c("agent", "תום אבני", "054-2120206", "tomavni@issta.co.il"),
      c("agent", "אתי בר דוד", "", "etiba@issta.co.il"),
      c("agent", "זוהר שפיני", "052-7807468", "Zoharshpinei@issta.co.il"),
    ],
  },
  wtc: {
    name: "WTC",
    general: [c("agent-support", "שירות", "03-5656333")],
    agents: [c("agent", "עינת", "", "einat@wtc.co.il")],
  },
  ayala: {
    name: "איילה",
    general: [c("agent-support", "שירות", "03-9436017")],
    agents: [c("agent", "אסף", "", "assaf@ayalagroup.co.il")],
  },
};

/** Read every stored contact, keyed by supplier id. Safe on the server. */
function readAll(): Record<string, SupplierContact> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** All contacts of a record, flattened in general → sales → agents order. */
export function allContacts(contact: SupplierContact): ContactGroup[] {
  return [...(contact.general ?? []), ...(contact.sales ?? []), ...(contact.agents ?? [])];
}

export function getContact(id: string): SupplierContact {
  // Stored (user-edited) contact wins outright; otherwise fall back to the seed.
  const base = readAll()[id] ?? DEFAULT_CONTACTS[id] ?? emptyContact();
  return {
    name: base.name ?? "",
    general: base.general ?? [],
    sales: base.sales ?? [],
    agents: base.agents ?? [],
  };
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

/** Whether a contact has any active, reachable entry worth showing in the view. */
export function hasAnyContact(contact: SupplierContact): boolean {
  return allContacts(contact).some((g) => g.active && (g.phone || g.email));
}
