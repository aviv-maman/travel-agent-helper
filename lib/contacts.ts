/**
 * Per-supplier (and per-airline) contact details for the suppliers/airlines
 * tabs. Every contact is a single typed record: a `label` (display name), a
 * `type` (its role — shown translated), an optional phone/email, and an
 * `active` flag so a contact can be hidden from the dialog without deleting it.
 * Records are grouped into `general` / `sales` / `agents` by type.
 *
 * Stored in the shared `contacts` table, keyed by supplier slug (or
 * `air:{slug}` for airlines) — one team-wide phonebook, edited in-app by
 * editors (see `app/actions/contacts.ts`). `DEFAULT_CONTACTS` below is the
 * one-time DB bootstrap (`bun run seed`) and the no-DB fallback.
 */
import { usingDatabase } from "@/lib/hotels";

export type ContactType =
  "agent-support" | "operation" | "operation-manager" | "sales-rep" | "agent";

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
export const DEFAULT_CONTACTS: Record<string, SupplierContact> = {
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

  // ── Hotels tab — B2B bedbanks ──────────────────────────────────────────────
  goglobal: {
    name: "GoGlobal",
    general: [c("agent-support", "שירות", "03-6126191", "fit@goglobal.travel")],
  },
  "tbo-holidays": {
    name: "TBO Holidays",
    general: [c("agent-support", "שירות", "03-7201918", "office.il@tbo.com")],
  },
  "instant-travel": {
    name: "Instant Travel",
    // No phone line — support is via the system chat.
    general: [c("agent-support", "שירות", "", "customer.service@innstanttravel.com")],
  },
  ratehawk: {
    name: "RateHawk",
    general: [c("agent-support", "שירות", "", "support@ratehawk.com")],
    sales: [
      c("sales-rep", "Inna Zhivotovsky Gadasi", "050-3020570", "inna.zhivotovskygadasi@ratehawk.com"),
    ],
  },

  // ── Car-rental tab ─────────────────────────────────────────────────────────
  "auto-europe": {
    name: "Auto Europe",
    general: [c("agent-support", "שירות", "03-5244244", "office@autoeurope.co.il")],
    agents: [
      c("agent", "Leonid", "", "leonid@autoeurope.co.il"),
      c("agent", "Dotan", "", "dotan@autoeurope.co.il"),
    ],
  },
};

/** All contacts of a record, flattened in general → sales → agents order. */
export function allContacts(contact: SupplierContact): ContactGroup[] {
  return [...(contact.general ?? []), ...(contact.sales ?? []), ...(contact.agents ?? [])];
}

/**
 * Every contact record keyed by supplier slug / `air:{slug}` — from Neon when
 * configured, otherwise the curated defaults. Server-side only (the pages fetch
 * this and pass each record down to the contact dialog).
 */
export async function getContactsMap(): Promise<Record<string, SupplierContact>> {
  if (!usingDatabase()) return DEFAULT_CONTACTS;
  const { db } = await import("@/db");
  const rows = await db.query.contacts.findMany({
    with: { supplier: true, airline: true },
    orderBy: (t, { asc }) => [asc(t.sortOrder)],
  });
  const map: Record<string, SupplierContact> = {};
  for (const r of rows) {
    const key = r.supplier ? r.supplier.slug : r.airline ? `air:${r.airline.slug}` : null;
    if (!key) continue;
    const record = (map[key] ??= emptyContact());
    record[r.section]!.push({
      active: r.active,
      label: r.label,
      type: r.type,
      ...(r.phone ? { phone: r.phone } : {}),
      ...(r.email ? { email: r.email } : {}),
    });
  }
  return map;
}

/** Strip a phone number down to digits and a leading "+" for tel: links. */
export function cleanPhone(p: string): string {
  return (p || "").replace(/[^0-9+]/g, "");
}

/** Whether a contact has any active, reachable entry worth showing in the view. */
export function hasAnyContact(contact: SupplierContact): boolean {
  return allContacts(contact).some((g) => g.active && (g.phone || g.email));
}
