import {
  pgTable,
  pgEnum,
  serial,
  integer,
  bigint,
  varchar,
  char,
  numeric,
  text,
  real,
  boolean,
  jsonb,
  timestamp,
  date,
  uuid,
  uniqueIndex,
  index,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { Locale } from "../i18n/config";

/**
 * A translatable text value, keyed by locale. Partial so a string can carry
 * only the languages translated so far (the UI shows the active locale only,
 * with no cross-language fallback). Add a locale in i18n/config.ts and it
 * automatically becomes an allowed key here.
 */
export type Localized = Partial<Record<Locale, string>>;

/** Curated tags (a hotel may have several). */
export const hotelTag = pgEnum("hotel_tag", ["resort", "kosher", "aparthotel"]);

/** Board basis: breakfast / half board / full board. A hotel may offer several. */
export const boardCode = pgEnum("board_code", ["bb", "hb", "fb"]);

/** Amenity/location tags surfaced as badges on the cards. */
export const hotelFeature = pgEnum("hotel_feature", [
  "pool-in",
  "pool-out",
  "casino",
  "casino-near",
  "waterpark",
  "outside-center",
]);

/** A single airport-transfer option row in the "about the city" box. */
export type TransportOption = {
  icon?: string;
  mode?: Localized;
  detail?: Localized;
  /** Locale-neutral (e.g. "~5$"). */
  price?: string;
};

/** Editorial city info shown in the collapsible "about the city" box. */
export type DestinationInfo = {
  /** Gold warning banners shown above the hotel list (e.g. visa/insurance notes). */
  warnings?: Localized[];
  about?: Localized;
  attractions?: Localized;
  currencyNote?: Localized;
  airport?: { title?: Localized; note?: Localized };
  transport?: TransportOption[];
  landmarks?: Localized;
};

export const destinations = pgTable(
  "destinations",
  {
    id: serial("id").primaryKey(),
    iata: varchar("iata", { length: 3 }).notNull(),
    name: jsonb("name").$type<Localized>().notNull(),
    country: jsonb("country").$type<Localized>().notNull(),
    /** ISO 3166-1 alpha-2 country code; the flag emoji is derived from it. */
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    info: jsonb("info").$type<DestinationInfo>(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("destinations_iata_key").on(t.iata)],
);

/** A point of interest a hotel's distance is measured against (per destination). */
export const landmarks = pgTable(
  "landmarks",
  {
    id: serial("id").primaryKey(),
    destinationId: integer("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 40 }).notNull(),
    name: jsonb("name").$type<Localized>().notNull(),
  },
  (t) => [
    uniqueIndex("landmarks_dest_key").on(t.destinationId, t.key),
  ],
);

export const hotels = pgTable(
  "hotels",
  {
    id: serial("id").primaryKey(),
    destinationId: integer("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    stars: integer("stars"),
    /** Board options offered (breakfast / half / full). Empty for room-only. */
    boards: boardCode("boards").array().notNull().default([]),
    bookingScore: real("booking_score"),
    googleMapsUrl: text("google_maps_url"),
    bookingUrl: text("booking_url"),
    /** Source attribution for the room data (shown in the detail modal). */
    roomsNote: jsonb("rooms_note").$type<Localized>(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("hotels_destination_idx").on(t.destinationId)],
);

export const hotelFeatures = pgTable(
  "hotel_features",
  {
    id: serial("id").primaryKey(),
    hotelId: integer("hotel_id")
      .notNull()
      .references(() => hotels.id, { onDelete: "cascade" }),
    feature: hotelFeature("feature").notNull(),
  },
  (t) => [uniqueIndex("hotel_features_unique").on(t.hotelId, t.feature)],
);

export const hotelTags = pgTable(
  "hotel_tags",
  {
    id: serial("id").primaryKey(),
    hotelId: integer("hotel_id")
      .notNull()
      .references(() => hotels.id, { onDelete: "cascade" }),
    tag: hotelTag("tag").notNull(),
  },
  (t) => [uniqueIndex("hotel_tags_unique").on(t.hotelId, t.tag)],
);

export const hotelDistances = pgTable(
  "hotel_distances",
  {
    id: serial("id").primaryKey(),
    hotelId: integer("hotel_id")
      .notNull()
      .references(() => hotels.id, { onDelete: "cascade" }),
    landmarkId: integer("landmark_id")
      .notNull()
      .references(() => landmarks.id, { onDelete: "cascade" }),
    meters: integer("meters"),
    walkMinutes: integer("walk_minutes"),
    rideMinutes: integer("ride_minutes"),
  },
  (t) => [uniqueIndex("hotel_distances_unique").on(t.hotelId, t.landmarkId)],
);

/** Room types per hotel — sizes are partly populated, the rest filled manually. */
export const rooms = pgTable(
  "rooms",
  {
    id: serial("id").primaryKey(),
    hotelId: integer("hotel_id")
      .notNull()
      .references(() => hotels.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    icon: varchar("icon", { length: 16 }),
    sizeSqm: integer("size_sqm"),
    occupancy: jsonb("occupancy").$type<Localized>(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("rooms_hotel_idx").on(t.hotelId)],
);

// ── Relations ───────────────────────────────────────────────────────────────
export const destinationsRelations = relations(destinations, ({ many }) => ({
  hotels: many(hotels),
  landmarks: many(landmarks),
}));

export const landmarksRelations = relations(landmarks, ({ one, many }) => ({
  destination: one(destinations, {
    fields: [landmarks.destinationId],
    references: [destinations.id],
  }),
  distances: many(hotelDistances),
}));

export const hotelsRelations = relations(hotels, ({ one, many }) => ({
  destination: one(destinations, {
    fields: [hotels.destinationId],
    references: [destinations.id],
  }),
  features: many(hotelFeatures),
  tags: many(hotelTags),
  distances: many(hotelDistances),
  rooms: many(rooms),
}));

export const roomsRelations = relations(rooms, ({ one }) => ({
  hotel: one(hotels, {
    fields: [rooms.hotelId],
    references: [hotels.id],
  }),
}));

export const hotelFeaturesRelations = relations(hotelFeatures, ({ one }) => ({
  hotel: one(hotels, {
    fields: [hotelFeatures.hotelId],
    references: [hotels.id],
  }),
}));

export const hotelTagsRelations = relations(hotelTags, ({ one }) => ({
  hotel: one(hotels, {
    fields: [hotelTags.hotelId],
    references: [hotels.id],
  }),
}));

export const hotelDistancesRelations = relations(hotelDistances, ({ one }) => ({
  hotel: one(hotels, {
    fields: [hotelDistances.hotelId],
    references: [hotels.id],
  }),
  landmark: one(landmarks, {
    fields: [hotelDistances.landmarkId],
    references: [landmarks.id],
  }),
}));

export type Destination = typeof destinations.$inferSelect;
export type Hotel = typeof hotels.$inferSelect;
export type Landmark = typeof landmarks.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type HotelTagValue = (typeof hotelTag.enumValues)[number];
export type HotelFeatureValue = (typeof hotelFeature.enumValues)[number];
export type BoardCode = (typeof boardCode.enumValues)[number];

// ── Content: suppliers, airlines, transfers (guide pages) ────────────────────
// The guide pages read these tables DB-first with the in-code data arrays in
// lib/{commissions,cancellations,airlines,transfers,contacts}.ts as the seed
// source and no-DB fallback (same split as hotels ↔ data/seed.json).

/** Commission chip color: high green (10%+), mid blue, low orange, range gold, net red. */
export const commissionLevel = pgEnum("commission_level", [
  "high",
  "mid",
  "low",
  "range",
  "net",
]);

/** Which suppliers-page tab a supplier belongs to. */
export const supplierCategory = pgEnum("supplier_category", [
  "flights",
  "hotels",
  "car-rental",
]);

/** The three default commission rows, plus labeled extra lines. */
export const commissionKind = pgEnum("commission_kind", [
  "flights",
  "packages",
  "organized",
  "custom",
]);

/** Tone of the airline trolley note (gold = highlighted). */
export const noteTone = pgEnum("note_tone", ["muted", "gold"]);

/** Contact grouping section on the contact dialog (derived from type). */
export const contactSection = pgEnum("contact_section", [
  "general",
  "sales",
  "agents",
]);

/** Contact role, shown as a translated subtitle. */
export const contactType = pgEnum("contact_type", [
  "agent-support",
  "operation",
  "operation-manager",
  "sales-rep",
  "agent",
]);

/** Which glyph leads a supplier baggage row (and its color). */
export type BaggageIcon =
  | "bag"
  | "ok"
  | "warn"
  | "flight"
  | "package"
  | "tour"
  | "village";

/** Structured source for a category baggage row edited in-app. */
export type BaggageInclusion = {
  status: "included" | "not_included";
  /** Only for not_included — round-trip prices, free text incl. currency (e.g. "130$"). */
  suitcasePrice?: string;
  trolleyPrice?: string;
  priceKind?: "gross" | "net";
  /** @deprecated single-price rows saved before the suitcase/trolley split. */
  price?: string;
};

/**
 * A supplier baggage line; text may contain `**bold**` spans. Category rows
 * (flight/package/village/tour) edited in-app carry `inclusion`, the
 * structured source their text is generated from; note rows (ok/warn) are
 * free text. The backpack line is hardcoded in the card, so `bag` rows are
 * legacy and no longer rendered.
 */
export type BaggageRow = { icon: BaggageIcon; text: Localized; inclusion?: BaggageInclusion };

/** A commission-related note; `showTitle` defaults to true. */
export type SupplierNote = {
  text: Localized;
  variant: "info" | "warning";
  showTitle?: boolean;
};

/** Cancellation-guide product tag color: flight blue, package green, organized purple. */
export type ProductKind = "flight" | "package" | "organized";
export type CancelProduct = { kind: ProductKind; label: Localized };

/** Fee-row severity → row color on the cancellations page. */
export type FeeLevel = "low" | "net" | "gross" | "full";
export type FeeRow = { timeframe: Localized; fee: Localized; level: FeeLevel };

/** One rendered block of a cancellation card, in display order. */
export type CancelBlock =
  | { kind: "heading"; text: Localized }
  | { kind: "subheading"; text: Localized; tone: "accent" | "gold" }
  | {
      kind: "table";
      caption: Localized;
      headers?: [Localized, Localized];
      rows: FeeRow[];
    }
  | {
      kind: "copy";
      text: Localized;
      levels?: FeeLevel[];
      title?: Localized;
      variant?: "change";
    };

/** Transfer-inclusion pill chip; label/flag are resolved at seed time. */
export type PillVariant = "yes" | "no" | "warn";
export type TransferPill = {
  variant: PillVariant;
  flag?: string;
  label: Localized;
  tooltip?: Localized;
};

export const suppliers = pgTable(
  "suppliers",
  {
    id: serial("id").primaryKey(),
    /** Stable slug (logo file, contacts key, seed identity). */
    slug: varchar("slug", { length: 48 }).notNull(),
    name: jsonb("name").$type<Localized>().notNull(),
    /** Short Latin code chip shown next to the name. */
    code: varchar("code", { length: 24 }).notNull(),
    category: supplierCategory("category").notNull().default("flights"),
    alias: jsonb("alias").$type<Localized>(),
    website: text("website"),
    logo: text("logo"),
    baggage: jsonb("baggage").$type<BaggageRow[]>().notNull().default([]),
    notes: jsonb("notes").$type<SupplierNote[]>().notNull().default([]),
    /** Skeleton card on the hotels/car-rental tabs ("details soon"). */
    placeholder: boolean("placeholder").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("suppliers_slug_key").on(t.slug)],
);

export const supplierCommissions = pgTable(
  "supplier_commissions",
  {
    id: serial("id").primaryKey(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    kind: commissionKind("kind").notNull(),
    /** Only for kind='custom' — the line's own label. */
    label: jsonb("label").$type<Localized>(),
    /** Display value, e.g. "7.5%" / "7–10%" or a localized phrase. */
    value: jsonb("value").$type<Localized>().notNull(),
    level: commissionLevel("level").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("supplier_commissions_unique").on(t.supplierId, t.kind, t.sortOrder),
  ],
);

export const supplierCancellations = pgTable(
  "supplier_cancellations",
  {
    id: serial("id").primaryKey(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    /** Pre-sorted in display order (the UI renders as stored). */
    products: jsonb("products").$type<CancelProduct[]>().notNull().default([]),
    blocks: jsonb("blocks").$type<CancelBlock[]>().notNull().default([]),
    /** Cancellations-page order — independent of the suppliers-page order. */
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("supplier_cancellations_supplier_key").on(t.supplierId)],
);

export const airlines = pgTable(
  "airlines",
  {
    id: serial("id").primaryKey(),
    /** Stable slug, used for the logo file (public/airlines/{slug}.png) and contacts. */
    slug: varchar("slug", { length: 48 }).notNull(),
    /** IATA code(s) as displayed, e.g. "LY" or "XC / 4D". Null for the catch-all row. */
    iata: varchar("iata", { length: 16 }),
    /** Flag emoji (the ISO code for the SVG flag is derived at read time). */
    flag: varchar("flag", { length: 8 }),
    name: jsonb("name").$type<Localized>().notNull(),
    /** Raw checked-suitcase figure: "23", "20", "15/23", "23/30". */
    kg: varchar("kg", { length: 16 }).notNull(),
    /** Trolley allowance shown in the "Trolley" column. */
    note: jsonb("note").$type<Localized>(),
    noteTone: noteTone("note_tone"),
    /** Free-text note shown in the dedicated "Note" column. */
    info: jsonb("info").$type<Localized>(),
    website: text("website").notNull(),
    /** Subtly highlighted catch-all row ("all other airlines"). */
    highlight: boolean("highlight").notNull().default(false),
    /** Base-fare commission chip, e.g. "0%", "7%", "0%/5%". Null renders as "0%". */
    commission: varchar("commission", { length: 16 }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("airlines_slug_key").on(t.slug)],
);

/** A single contact entry for a supplier or an airline (exactly one FK set). */
export const contacts = pgTable(
  "contacts",
  {
    id: serial("id").primaryKey(),
    supplierId: integer("supplier_id").references(() => suppliers.id, {
      onDelete: "cascade",
    }),
    airlineId: integer("airline_id").references(() => airlines.id, {
      onDelete: "cascade",
    }),
    section: contactSection("section").notNull(),
    type: contactType("type").notNull(),
    /** Display title, usually a person name. */
    label: text("label").notNull().default(""),
    phone: varchar("phone", { length: 32 }).notNull().default(""),
    email: varchar("email", { length: 160 }).notNull().default(""),
    /** Hidden from the dialog without deleting when false. */
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("contacts_supplier_idx").on(t.supplierId),
    index("contacts_airline_idx").on(t.airlineId),
    check("contacts_owner_check", sql`num_nonnulls(supplier_id, airline_id) = 1`),
  ],
);

export const transferCountries = pgTable(
  "transfer_countries",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 48 }).notNull(),
    country: jsonb("country").$type<Localized>().notNull(),
    /** ISO 3166-1 alpha-2 code for the flag, or null for the catch-all "other". */
    code: varchar("code", { length: 2 }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("transfer_countries_slug_key").on(t.slug)],
);

export const transferCities = pgTable(
  "transfer_cities",
  {
    id: serial("id").primaryKey(),
    countryId: integer("country_id")
      .notNull()
      .references(() => transferCountries.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 64 }).notNull(),
    name: jsonb("name").$type<Localized>().notNull(),
    /** Extra search terms (IATA codes etc.); locale names are appended at read time. */
    search: text("search").notNull().default(""),
    pills: jsonb("pills").$type<TransferPill[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("transfer_cities_unique").on(t.countryId, t.slug)],
);

// ── Content relations ─────────────────────────────────────────────────────────
export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
  commissions: many(supplierCommissions),
  cancellation: one(supplierCancellations),
  contacts: many(contacts),
}));

export const supplierCommissionsRelations = relations(
  supplierCommissions,
  ({ one }) => ({
    supplier: one(suppliers, {
      fields: [supplierCommissions.supplierId],
      references: [suppliers.id],
    }),
  }),
);

export const supplierCancellationsRelations = relations(
  supplierCancellations,
  ({ one }) => ({
    supplier: one(suppliers, {
      fields: [supplierCancellations.supplierId],
      references: [suppliers.id],
    }),
  }),
);

export const airlinesRelations = relations(airlines, ({ many }) => ({
  contacts: many(contacts),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [contacts.supplierId],
    references: [suppliers.id],
  }),
  airline: one(airlines, {
    fields: [contacts.airlineId],
    references: [airlines.id],
  }),
}));

export const transferCountriesRelations = relations(
  transferCountries,
  ({ many }) => ({
    cities: many(transferCities),
  }),
);

export const transferCitiesRelations = relations(transferCities, ({ one }) => ({
  country: one(transferCountries, {
    fields: [transferCities.countryId],
    references: [transferCountries.id],
  }),
}));

export type SupplierRow = typeof suppliers.$inferSelect;
export type SupplierCommissionRow = typeof supplierCommissions.$inferSelect;
export type SupplierCancellationRow = typeof supplierCancellations.$inferSelect;
export type AirlineRow = typeof airlines.$inferSelect;
export type ContactRow = typeof contacts.$inferSelect;
export type TransferCountryRow = typeof transferCountries.$inferSelect;
export type TransferCityRow = typeof transferCities.$inferSelect;
export type CommissionKind = (typeof commissionKind.enumValues)[number];
export type CommLevel = (typeof commissionLevel.enumValues)[number];
export type SupplierCategory = (typeof supplierCategory.enumValues)[number];
export type ContactSectionValue = (typeof contactSection.enumValues)[number];
export type ContactTypeValue = (typeof contactType.enumValues)[number];

// ── Auth ──────────────────────────────────────────────────────────────────────

/** Access tiers. Permissions per role are mapped in code (lib/auth). */
export const userRole = pgEnum("user_role", ["admin", "editor", "agent"]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    /** Stored lower-cased; the unique index enforces case-insensitive uniqueness. */
    username: varchar("username", { length: 40 }).notNull(),
    /** Optional friendly name shown in the UI; falls back to `username`. */
    displayName: varchar("display_name", { length: 80 }),
    /** Cross-device theme preference ("light" | "dark" | "system"); null = unset. */
    themePref: varchar("theme_pref", { length: 7 }),
    /** Primary email (from a linked provider or set manually). Null when unknown. */
    email: varchar("email", { length: 255 }),
    /** When the user confirmed their email (via a `verify` token). Null = unverified. */
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    /** Public storage URL of the user's avatar image; null = show initials. */
    avatarUrl: text("avatar_url"),
    /**
     * scrypt digest, "scrypt:<salt>:<hash>". **Null** for OAuth-only users — they
     * have no password and sign in via a linked provider (see `accounts`).
     */
    passwordHash: text("password_hash"),
    /** Base32 TOTP secret. Present during setup; 2FA is active once `totpEnabledAt` is set. */
    totpSecret: text("totp_secret"),
    /** When 2FA was confirmed/activated; null = not enabled. */
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
    role: userRole("role").notNull().default("agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_username_key").on(t.username),
    // Postgres treats NULLs as distinct, so any number of email-less users is fine.
    uniqueIndex("users_email_key").on(t.email),
  ],
);

/**
 * Server-side sessions. `id` is the SHA-256 hash of the opaque token we put in
 * the cookie — so the raw token never touches the database (a DB leak can't be
 * replayed as a login). Deleting the row (or its user) revokes the session.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Bumped (throttled) on use, for the "last active" column. */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /** User-agent at sign-in, for the "active sessions" list. */
    userAgent: text("user_agent"),
    /** True between password and 2FA steps — such sessions do NOT authenticate yet. */
    mfaPending: boolean("mfa_pending").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/**
 * One-time backup codes for 2FA (used when an authenticator isn't available).
 * Only the hash is stored; `usedAt` marks a code spent.
 */
export const backupCodes = pgTable(
  "backup_codes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("backup_codes_user_idx").on(t.userId)],
);

/** External identity providers a user can link and sign in with. */
export const authProvider = pgEnum("auth_provider", ["google", "microsoft"]);

/**
 * OAuth identities linked to a user. `providerAccountId` is the provider's stable
 * subject id (OIDC `sub`), which maps an external login to our user. Written by
 * the auth backend; sign-in is invite-gated (see docs/auth-backend-contract.md).
 */
export const accounts = pgTable(
  "accounts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: authProvider("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("accounts_provider_account_key").on(t.provider, t.providerAccountId),
    uniqueIndex("accounts_user_provider_key").on(t.userId, t.provider),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  aiCredentials: many(userAiCredentials),
  savedQuotes: many(savedQuotes),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const aiProvider = pgEnum("ai_provider", ["anthropic"]);

/**
 * A user's own AI provider API key (BYO). Written/read by the Python backend, which
 * **encrypts it at rest** (AES-GCM; the encryption key lives only on the backend) —
 * we store just the ciphertext, its nonce, and the last 4 chars for display, never
 * the plaintext. Unlocks the AI quote assistant. See docs/ai-quote-assistant-contract.md.
 */
export const userAiCredentials = pgTable(
  "user_ai_credentials",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: aiProvider("provider").notNull(),
    ciphertext: text("ciphertext").notNull(), // base64(AES-GCM ciphertext)
    nonce: text("nonce").notNull(), // base64(96-bit GCM nonce)
    last4: varchar("last4", { length: 4 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_ai_credentials_user_provider_key").on(t.userId, t.provider)],
);

export const userAiCredentialsRelations = relations(userAiCredentials, ({ one }) => ({
  user: one(users, { fields: [userAiCredentials.userId], references: [users.id] }),
}));

/**
 * A quote the agent **explicitly saved** from the AI assistant chat (the chat
 * itself is ephemeral — nothing is written until the user clicks "Save"). We
 * persist these ourselves via Drizzle. `imageKey`/`imageMediaType` reference the
 * originating screenshot, uploaded to a **private** storage bucket on save and served
 * only through the backend's ownership-checked GET (client PII). Null when the
 * request carried no image. See docs/ai-quote-assistant-contract.md.
 */
export const savedQuotes = pgTable(
  "saved_quotes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Short label for the history list, derived from the originating request. */
    title: text("title").notNull(),
    /** The forwardable client quote (the WhatsApp message). */
    content: text("content").notNull(),
    /** The request that produced the quote — kept for reference / re-titling. */
    prompt: text("prompt").notNull().default(""),
    /** Future: storage object key of the original image; null until the backend lands. */
    imageKey: text("image_key"),
    imageMediaType: text("image_media_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("saved_quotes_user_created_idx").on(t.userId, t.createdAt)],
);

export const savedQuotesRelations = relations(savedQuotes, ({ one }) => ({
  user: one(users, { fields: [savedQuotes.userId], references: [users.id] }),
}));

/** Email tokens are single-use, for either email verification or password reset. */
export const emailTokenKind = pgEnum("email_token_kind", ["verify", "reset"]);

/**
 * Single-use email tokens (verification + password reset). Like sessions, only the
 * token *hash* is stored (`id` = sha256 of the raw base64url token) — the raw token
 * lives only in the emailed link. `used_at` marks it spent; `expires_at` bounds it
 * (verify ~24h, reset ~45min). See docs/password-reset-contract.md.
 */
export const emailTokens = pgTable(
  "email_tokens",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: emailTokenKind("kind").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_tokens_user_idx").on(t.userId)],
);

/**
 * Single-use registration invites. A code carries the role the new user gets.
 * "Active" means: not used, not revoked, and not past `expiresAt` (null = never).
 * `created_by`/`used_by` are set null if that user is later deleted (audit only).
 */
export const invitations = pgTable(
  "invitations",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 64 }).notNull(),
    role: userRole("role").notNull().default("agent"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Null = no expiry. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** Set when redeemed; null = unused. */
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedBy: integer("used_by").references(() => users.id, { onDelete: "set null" }),
    /** Set when an admin revokes it; null = not revoked. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("invitations_code_key").on(t.code)],
);

/**
 * Failed-login throttling, keyed by username. A rolling window counts recent
 * failures; once it trips, `locked_until` blocks attempts for a cooldown. A
 * successful login deletes the row.
 */
export const loginAttempts = pgTable("login_attempts", {
  key: varchar("key", { length: 60 }).primaryKey(),
  count: integer("count").notNull().default(0),
  windowStartsAt: timestamp("window_starts_at", { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

/**
 * WebAuthn passkeys (Phase 7). One row per registered credential; a user may
 * have several (phone, laptop…). Only the PUBLIC key is stored — the private
 * key never leaves the user's authenticator. `counter` is the signature
 * counter used to detect cloned authenticators. Passkey sign-in creates a
 * fully-authenticated session (no TOTP step — a passkey is itself
 * phishing-resistant MFA: possession + biometric/PIN).
 */
export const passkeys = pgTable(
  "passkeys",
  {
    /** WebAuthn credential id (base64url) — chosen by the authenticator. */
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** COSE public key, base64url-encoded. */
    publicKey: text("public_key").notNull(),
    counter: bigint("counter", { mode: "number" }).notNull().default(0),
    /** JSON array of WebAuthn transports (e.g. ["internal","hybrid"]). */
    transports: text("transports"),
    /** Friendly label derived from the registering device's user-agent. */
    deviceName: text("device_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [index("passkeys_user_idx").on(t.userId)],
);

/**
 * Advisory FX rates, refreshed daily by the Python backend's `/cron/fx` job
 * (docs/exchange-rate-contract.md). One current row per (base, quote) pair —
 * the backend upserts; Next only reads. `rate` = how many `quote` units one
 * `base` unit buys (base ILS, quote USD, rate ≈ 0.27 → ₪1 ≈ $0.27; the inverse
 * 1/rate gives ₪ per unit). Display/estimate-grade, not booking-grade.
 */
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    base: char("base", { length: 3 }).notNull(),
    quote: char("quote", { length: 3 }).notNull(),
    rate: numeric("rate", { precision: 18, scale: 8 }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.base, t.quote] })],
);

/**
 * Append-only audit trail of privileged/security actions (logins, role changes,
 * user/invite management, password changes…). `actor_user_id` is nulled if that
 * user is later deleted (the entry stays for history — put the name in `meta`).
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    actorUserId: integer("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Dotted action key, e.g. "login", "user.role", "invite.create". */
    action: varchar("action", { length: 40 }).notNull(),
    /** What the action targeted, e.g. "user" / "invite" (+ `targetId`). */
    targetType: varchar("target_type", { length: 20 }),
    targetId: integer("target_id"),
    /** Extra context (role, provider, username of a deleted actor, …). */
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_created_idx").on(t.createdAt),
    index("audit_log_actor_idx").on(t.actorUserId),
  ],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type UserRole = (typeof userRole.enumValues)[number];
export type Account = typeof accounts.$inferSelect;
export type AuthProviderName = (typeof authProvider.enumValues)[number];
export type AuditEntry = typeof auditLog.$inferSelect;
export type BackupCode = typeof backupCodes.$inferSelect;

/**
 * ── Dashboard (personal work homepage) ──────────────────────────────────────
 * Per-user data behind the login-gated `/dashboard`: task/follow-up items, a
 * single free-form calculator scratchpad, and a key/value settings store (bank
 * details for the one-tap WhatsApp copy). All rows are scoped to `user_id`.
 */

/** Kind of dashboard item; drives which section it renders in. */
export const dashboardTaskType = pgEnum("dashboard_task_type", [
  "task",
  "awaiting_supplier",
  "client_followup",
  "reminder",
]);

/** Lifecycle of a dashboard item. `done` auto-moves to `archived` after 7 days. */
export const dashboardTaskStatus = pgEnum("dashboard_task_status", [
  "open",
  "done",
  "archived",
]);

export const dashboardTasks = pgTable(
  "dashboard_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    clientName: text("client_name"),
    /** International format (e.g. "+9725…") for wa.me links. */
    clientPhone: text("client_phone"),
    type: dashboardTaskType("type").notNull(),
    /** For `awaiting_supplier` items. */
    supplierName: text("supplier_name"),
    /** Booking/order reference number for the item. */
    orderNumber: text("order_number"),
    dueDate: date("due_date"),
    notes: text("notes"),
    status: dashboardTaskStatus("status").notNull().default("open"),
    /** Manual position within a section (drag & drop); ties broken by createdAt. */
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("dashboard_tasks_user_status_idx").on(t.userId, t.status)],
);

/** One free-form scratchpad row per user (upserted on save). */
export const dashboardScratchpad = pgTable("dashboard_scratchpad", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Per-user key/value store (bank details today; future settings later). */
export const dashboardSettings = pgTable(
  "dashboard_settings",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

export type DashboardTask = typeof dashboardTasks.$inferSelect;
export type DashboardTaskType = (typeof dashboardTaskType.enumValues)[number];
export type DashboardTaskStatus = (typeof dashboardTaskStatus.enumValues)[number];
export type DashboardScratchpad = typeof dashboardScratchpad.$inferSelect;
export type DashboardSetting = typeof dashboardSettings.$inferSelect;
