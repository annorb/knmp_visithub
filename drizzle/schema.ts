import {
  bigint,
  boolean,
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
  location: varchar("location", { length: 200 }),
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
