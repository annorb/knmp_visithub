import {
  bigint,
  boolean,
  date,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow (Manus OAuth).
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** When false the user is blocked from using authenticated features until reactivated. */
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Attractions within the Kwame Nkrumah Memorial Park.
 */
export const attractions = mysqlTable("attractions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  description: text("description").notNull(),
  imageUrl: text("imageUrl"),
  openingHours: varchar("openingHours", { length: 200 }),
  /** Free location label for filtering, e.g. "Central grounds", "Main gallery building" */
  location: varchar("location", { length: 200 }),
  /** Free category label for filtering, e.g. "Monument", "Museum", "Gardens" */
  category: varchar("category", { length: 100 }),
  /** Park-map latitude (WGS84), e.g. 5.5510 for the KNMP centroid area. */
  lat: decimal("lat", { precision: 10, scale: 7 }),
  /** Park-map longitude (WGS84), e.g. -0.2108 for the KNMP centroid area. */
  lng: decimal("lng", { precision: 10, scale: 7 }),
  averageVisitDurationMin: int("averageVisitDurationMin").default(30),
  sortIndex: int("sortIndex").default(0),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Attraction = typeof attractions.$inferSelect;
export type InsertAttraction = typeof attractions.$inferInsert;

/**
 * Visitor categories with per-category entrance fees (in GHS).
 * Examples: Adult, Child, Student, Foreigner (Non-Ghanaian Adult).
 */
export const visitorCategories = mysqlTable("visitor_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  /** Entrance fee in Ghana Cedis (GHS), stored as integer pesewas to avoid float issues. */
  pricePesewas: int("pricePesewas").notNull(),
  /** Short human description, e.g. "Ages 13 and above" */
  description: text("description"),
  /** Whether this category participates in the group/school booking package. */
  isGroup: boolean("isGroup").default(false).notNull(),
  /** Minimum party size for the group package to apply, e.g. 15 students. */
  groupMinQty: int("groupMinQty").default(15),
  /** Group package discount in percent (0-100), e.g. 20 for 20% off. */
  groupDiscountPercent: int("groupDiscountPercent").default(15),
  isActive: boolean("isActive").default(true).notNull(),
  sortIndex: int("sortIndex").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VisitorCategory = typeof visitorCategories.$inferSelect;
export type InsertVisitorCategory = typeof visitorCategories.$inferInsert;

/**
 * Bookings created by visitors for a specific visit date.
 */
export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique auto-generated reference, e.g. KNMP-X7B2Q4 */
  reference: varchar("reference", { length: 32 }).notNull().unique(),
  userId: int("userId").notNull(),
  visitDate: timestamp("visitDate").notNull(),
  /** End date for multi-day bookings (same as visitDate for single-day visits). */
  visitEndDate: timestamp("visitEndDate"),
  visitorName: varchar("visitorName", { length: 200 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 64 }),
  totalPesewas: int("totalPesewas").notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "cancelled"]).default("pending").notNull(),
  notes: text("notes"),
  /** When set, the visitor party has been checked in at the gate. */
  checkInAt: timestamp("checkInAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

/**
 * Per-category line items within a booking (category + quantity).
 */
export const bookingItems = mysqlTable("booking_items", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull(),
  categoryId: int("categoryId").notNull(),
  categoryName: varchar("categoryName", { length: 100 }).notNull(),
  /** Unit price in pesewas at the time of booking (snapshot). */
  unitPricePesewas: int("unitPricePesewas").notNull(),
  quantity: int("quantity").notNull(),
  subtotalPesewas: int("subtotalPesewas").notNull(),
  /** Group/school package discount applied to this line, in pesewas (0 when none). */
  discountPesewas: int("discountPesewas").default(0).notNull(),
  /** Discount percent applied (0-100, 0 when none). */
  discountPercent: int("discountPercent").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Guided-tour time slots offered per attraction on a given day.
 */
export const tourSlots = mysqlTable("tour_slots", {
  id: int("id").autoincrement().primaryKey(),
  attractionId: int("attractionId").notNull(),
  /** e.g. "09:00", "11:30", "14:00" */
  startTime: varchar("startTime", { length: 5 }).notNull(),
  /** e.g. "09:45", "12:15", "14:45" */
  endTime: varchar("endTime", { length: 5 }).notNull(),
  label: varchar("label", { length: 100 }),
  /** Maximum group size for the slot. */
  maxCapacity: int("maxCapacity").default(25),
  /** Bookings already attached to this slot today. */
  bookedCount: int("bookedCount").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TourSlot = typeof tourSlots.$inferSelect;
export type InsertTourSlot = typeof tourSlots.$inferInsert;

/**
 * Which tour slot(s) a booking's visitors are booked into, per attraction.
 */
export const bookingSlots = mysqlTable("booking_slots", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull(),
  slotId: int("slotId").notNull(),
  attractionId: int("attractionId").notNull(),
  attractionName: varchar("attractionName", { length: 200 }),
  /** The day within a multi-day booking this slot applies to (local date). */
  visitDate: timestamp("visitDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BookingSlot = typeof bookingSlots.$inferSelect;
export type InsertBookingSlot = typeof bookingSlots.$inferInsert;

export type BookingItem = typeof bookingItems.$inferSelect;
export type InsertBookingItem = typeof bookingItems.$inferInsert;

/**
 * Personal itinerary items belonging to a user, tied to a visit date
 * (optionally linked to a booking).
 */
export const itineraryItems = mysqlTable("itinerary_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  bookingId: int("bookingId"),
  /** The visit date this itinerary belongs to (local date at midnight UTC). */
  visitDate: timestamp("visitDate").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  /** Free-text time of day, e.g. "09:30" or "Morning" */
  timeSlot: varchar("timeSlot", { length: 50 }),
  /** Optional attraction this item relates to */
  attractionId: int("attractionId"),
  attractionName: varchar("attractionName", { length: 200 }),
  sortIndex: int("sortIndex").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ItineraryItem = typeof itineraryItems.$inferSelect;
export type InsertItineraryItem = typeof itineraryItems.$inferInsert;

/**
 * Audit trail for administrative actions (role changes, activations, etc.).
 */
export const auditEvents = mysqlTable("audit_events", {
  id: int("id").autoincrement().primaryKey(),
  /** The admin who performed the action. */
  actorId: int("actorId").notNull(),
  actorName: varchar("actorName", { length: 200 }),
  /** e.g. "role_change", "account_deactivated", "account_reactivated" */
  action: varchar("action", { length: 64 }).notNull(),
  targetUserId: int("targetUserId"),
  targetName: varchar("targetName", { length: 200 }),
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditEvent = typeof auditEvents.$inferSelect;
export type InsertAuditEvent = typeof auditEvents.$inferInsert;

/**
 * Shareable links for a visitor's personal itinerary.
 * A single code unlocks the owner's whole itinerary for a read-only view.
 */
export const itineraryShares = mysqlTable("itinerary_shares", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Unique short code exposed in shareable URLs. */
  shareCode: varchar("shareCode", { length: 32 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ItineraryShare = typeof itineraryShares.$inferSelect;
export type InsertItineraryShare = typeof itineraryShares.$inferInsert;

/**
 * Site-wide settings stored as key/value rows (capacity limits, thresholds).
 */
/**
 * Published park events: special programs and guided tours that visitors can
 * browse on the public events calendar and book directly.
 */
export const events = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  description: text("description").notNull(),
  /** "program" for special programs, "guided_tour" for guided tours bookable by visitors. */
  eventType: varchar("eventType", { length: 20 }).notNull().default("program"),
  /** The attraction this event is tied to (nullable for park-wide programs). */
  attractionId: int("attractionId"),
  /** Event date at 00:00 UTC (day-level scheduling). */
  eventDate: date("eventDate").notNull(),
  /** Start time e.g. "09:30". */
  startTime: varchar("startTime", { length: 5 }),
  /** End time e.g. "11:00". */
  endTime: varchar("endTime", { length: 5 }),
  /** Meeting point label, e.g. "Main entrance". */
  meetingPoint: varchar("meetingPoint", { length: 200 }),
  /** Guide name or lead staff, e.g. "Mr. O. Mensah". */
  guideName: varchar("guideName", { length: 100 }),
  /** Optional attraction image or event poster URL. */
  imageUrl: text("imageUrl"),
  /** Max participants allowed (0 = unlimited). */
  capacity: int("capacity").default(0).notNull(),
  /** Participant fee in pesewas (0 = free). */
  feePesewas: int("feePesewas").default(0).notNull(),
  /** Last day visitors may register; null means until capacity is reached. */
  registrationDeadline: date("registrationDeadline"),
  isPublished: boolean("isPublished").default(false).notNull(),
  sortIndex: int("sortIndex").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ParkEvent = typeof events.$inferSelect;
export type InsertParkEvent = typeof events.$inferInsert;

/**
 * Visitor registrations for published events (direct guided-tour bookings).
 */
export const eventRegistrations = mysqlTable("event_registrations", {
  id: int("id").autoincrement().primaryKey(),
  reference: varchar("reference", { length: 20 }).notNull().unique(),
  eventId: int("eventId").notNull(),
  userId: int("userId").notNull(),
  attendeeName: varchar("attendeeName", { length: 200 }).notNull(),
  contactEmail: varchar("contactEmail", { length: 200 }),
  numberOfParticipants: int("numberOfParticipants").default(1).notNull(),
  isCancelled: boolean("isCancelled").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EventRegistration = typeof eventRegistrations.$inferSelect;
export type InsertEventRegistration = typeof eventRegistrations.$inferInsert;

export const siteSettings = mysqlTable("site_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  value: text("value"),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertSiteSetting = typeof siteSettings.$inferInsert;

/** Default daily visitor capacity used when no setting row exists. */
export const DEFAULT_DAILY_CAPACITY = 500;
/** Default near-capacity warning threshold (fraction) used when no setting exists. */
export const DEFAULT_NEAR_CAPACITY_THRESHOLD = 0.75;
