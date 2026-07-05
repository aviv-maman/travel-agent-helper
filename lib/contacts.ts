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
  /** Any number of agents / contact people — each rendered as its own block. */
  agents: ContactGroup[];
  extras: ContactExtra[];
};

const STORAGE_KEY = "commContacts_v1";

export function emptyGroup(): ContactGroup {
  return { active: false, name: "", phone: "", email: "" };
}

export function emptyContact(): SupplierContact {
  return { email: "", phone: "", sales: emptyGroup(), agents: [], extras: [] };
}

/** A pre-filled (active) contact group, used to seed the defaults below. */
function grp(name: string, phone = "", email = ""): ContactGroup {
  return { active: true, name, phone, email };
}

/**
 * Curated per-supplier contacts, keyed by the supplier ids in `lib/commissions`.
 * These seed the contact dialog so agents see real numbers/emails out of the box;
 * once a user edits and saves a supplier, their stored copy fully overrides the
 * default here (see `getContact`).
 */
const DEFAULT_CONTACTS: Record<string, SupplierContact> = {
  israir: {
    ...emptyContact(),
    email: "israir_agents@israir.co.il",
    phone: "03-7954000",
    extras: [{ type: "phone", label: "טלפון נוסף", value: "03-7954003" }],
  },
  "kavei-hufsha": {
    ...emptyContact(),
    email: "support@kavei.co.il",
    phone: "03-6211000",
    agents: [grp("Aldo", "054-6230867", "Aldo.h@kavei.co.il")],
    extras: [
      { type: "email", label: "Operation", value: "ops@kavei.co.il" },
      { type: "email", label: "Operation Manager", value: "revital.av@kavei.co.il" },
    ],
  },
  flying: {
    ...emptyContact(),
    email: "sherut@flying.co.il",
    phone: "03-5151600",
    sales: grp("Lior Dahan", "054-3247602", "liord@flying.co.il"),
    agents: [grp("Anna Lenkov", "054-5914972", "Annalen@flying.co.il")],
  },
  "flying-sp": {
    ...emptyContact(),
    email: "sherut@flying.co.il",
    phone: "03-5151600",
    sales: grp("Lior Dahan", "054-3247602", "liord@flying.co.il"),
    agents: [grp("Anna Lenkov", "054-5914972", "Annalen@flying.co.il")],
  },
  "kishrei-teufa": {
    ...emptyContact(),
    phone: "03-5205020",
    sales: grp("Moshe Elish", "054-2494400"),
    agents: [grp("Diana", "054-2494484", "diana.or@aviation-links.co.il")],
  },
  "eshet-tours": {
    ...emptyContact(),
    email: "sitonaut@eshet-tours.co.il",
    phone: "03-7771025",
    sales: grp("Dudu", "052-4294620", "dudu.k@eshet-tours.co.il"),
    agents: [
      grp("Avigail Mihaeli", "", "avigailm@eshet-tours.co.il"),
      grp("Sharon Bazel", "", "sharonb@eshet-tours.co.il"),
    ],
  },
  arkia: {
    ...emptyContact(),
    email: "clickagent@arkia.co.il",
    phone: "03-6903713",
    agents: [grp("Nofar", "050-2600481")],
    extras: [{ type: "email", label: "Agent support", value: "Agentsupport@arkia.co.il" }],
  },
  "mona-tours": {
    ...emptyContact(),
    phone: "03-5141866",
    agents: [
      grp("Veda Bykhovsky", "", "vedab@mona.co.il"),
      grp("Sofa Promislovsky", "", "sofa@mona.co.il"),
      grp("Ilana Barsky", "", "ilana@mona.co.il"),
      grp("Tal Moshkovitz", "", "talm@mona.co.il"),
    ],
  },
  issta: {
    ...emptyContact(),
    email: "charter-issta@issta.co.il",
    phone: "03-7777377",
    agents: [
      grp("Tom Avni", "054-2120206", "tomavni@issta.co.il"),
      grp("Eti Bar David", "", "etiba@issta.co.il"),
      grp("Zohar Shpinei", "052-7807468", "Zoharshpinei@issta.co.il"),
    ],
  },
  wtc: {
    ...emptyContact(),
    phone: "03-5656333",
    agents: [grp("Einat", "", "einat@wtc.co.il")],
  },
  ayala: {
    ...emptyContact(),
    phone: "03-9436017",
    agents: [grp("Assaf", "", "assaf@ayalagroup.co.il")],
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

export function getContact(id: string): SupplierContact {
  // Stored (user-edited) contact wins outright; otherwise fall back to the seed.
  const stored = readAll()[id] as (Partial<SupplierContact> & { agent?: ContactGroup }) | undefined;
  const merged = { ...emptyContact(), ...DEFAULT_CONTACTS[id], ...stored } as SupplierContact & {
    agent?: ContactGroup;
  };
  // Migrate the legacy single `agent` field (pre-`agents[]`) into the array.
  if (stored && !Array.isArray(stored.agents) && merged.agent) {
    const a = merged.agent;
    merged.agents = a.name || a.phone || a.email ? [{ ...a, active: true }] : [];
  }
  delete merged.agent;
  return merged;
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
      c.agents.some((a) => a.name || a.phone || a.email),
  );
}
