import {
  pgTable,
  pgEnum,
  serial,
  integer,
  varchar,
  text,
  real,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { Locale } from "../i18n/config";

/**
 * A translatable text value, keyed by locale. Partial so a string can carry
 * only the languages translated so far (the UI shows the active locale only,
 * with no cross-language fallback). Add a locale in i18n/config.ts and it
 * automatically becomes an allowed key here.
 */
export type Localized = Partial<Record<Locale, string>>;

/** Our own hotel quality rating (not the official star rating). */
export const hotelTier = pgEnum("hotel_tier", ["premium", "good"]);

/** Curated tags, independent of quality (a hotel may have several). */
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
    tier: hotelTier("tier").notNull(),
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
export type HotelTier = (typeof hotelTier.enumValues)[number];
export type HotelTagValue = (typeof hotelTag.enumValues)[number];
export type HotelFeatureValue = (typeof hotelFeature.enumValues)[number];
export type BoardCode = (typeof boardCode.enumValues)[number];

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
    /**
     * scrypt digest, "scrypt:<salt>:<hash>". **Null** for OAuth-only users — they
     * have no password and sign in via a linked provider (see `accounts`).
     */
    passwordHash: text("password_hash"),
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
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
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
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

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

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type UserRole = (typeof userRole.enumValues)[number];
export type Account = typeof accounts.$inferSelect;
export type AuthProviderName = (typeof authProvider.enumValues)[number];
