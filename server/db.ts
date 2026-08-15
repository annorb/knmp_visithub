import { and, desc, eq, gt, gte, like, lt, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  attractions,
  auditEvents,
  bookings,
  bookingItems,
  itineraryItems,
  itineraryShares,
  tourSlots,
  bookingSlots,
  users,
  visitorCategories,
  type InsertAttraction,
  type InsertAuditEvent,
  type InsertBooking,
  type InsertBookingItem,
  type InsertBookingSlot,
  type InsertItineraryItem,
  type InsertTourSlot,
  type InsertUser,
  type InsertVisitorCategory,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ---------------------------------------------------------------------------
// Admin user management
// ---------------------------------------------------------------------------
export async function listAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(users.createdAt).limit(500);
}

export async function updateUserRole(userId: number, role: "user" | "admin", selfId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Prevent self-demotion to keep at least one admin able to manage the platform
  if (userId === selfId && role !== "admin") {
    throw new Error("You cannot remove your own administrator role");
  }
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function setUserActive(userId: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ isActive }).where(eq(users.id, userId));
}

// ---------------------------------------------------------------------------
// Attractions
// ---------------------------------------------------------------------------
export async function listActiveAttractions() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(attractions)
    .where(eq(attractions.isActive, true))
    .orderBy(attractions.sortIndex, attractions.id);
}

export async function searchAttractions(query: string) {
  const db = await getDb();
  if (!db) return [];
  const pattern = `%${query.trim()}%`;
  return db
    .select()
    .from(attractions)
    .where(
      and(
        eq(attractions.isActive, true),
        sql`(${attractions.name} LIKE ${pattern} OR ${attractions.description} LIKE ${pattern})`,
      ),
    )
    .orderBy(attractions.sortIndex, attractions.id);
}

export async function searchAttractionsFiltered(input: {
  query?: string;
  category?: string;
  location?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(attractions.isActive, true)];
  if (input.query?.trim()) {
    const pattern = `%${input.query.trim()}%`;
    conditions.push(
      sql`(${attractions.name} LIKE ${pattern} OR ${attractions.description} LIKE ${pattern})`,
    );
  }
  if (input.category) {
    conditions.push(eq(attractions.category, input.category));
  }
  if (input.location) {
    conditions.push(eq(attractions.location, input.location));
  }
  return db
    .select()
    .from(attractions)
    .where(and(...conditions))
    .orderBy(attractions.sortIndex, attractions.id);
}

/** Distinct facet values (category, location) among active attractions with counts. */
export async function listAttractionFacets() {
  const db = await getDb();
  if (!db) return { categories: [], locations: [] };
  const rows = await db
    .select({ category: attractions.category, location: attractions.location })
    .from(attractions)
    .where(eq(attractions.isActive, true));
  const categoryCounts = new Map<string, number>();
  const locationCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.category) categoryCounts.set(r.category, (categoryCounts.get(r.category) ?? 0) + 1);
    if (r.location) locationCounts.set(r.location, (locationCounts.get(r.location) ?? 0) + 1);
  }
  const sort = (m: Map<string, number>) =>
    Array.from(m.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));
  return { categories: sort(categoryCounts), locations: sort(locationCounts) };
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------
export async function createAuditEvent(event: InsertAuditEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(auditEvents).values(event);
}

export async function listAuditEvents() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(300);
}

export async function getAttractionBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(attractions)
    .where(and(eq(attractions.slug, slug), eq(attractions.isActive, true)))
    .limit(1);
  return rows.length > 0 ? rows[0] : undefined;
}

export async function listAllAttractions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(attractions).orderBy(attractions.sortIndex, attractions.id);
}

export async function getAttractionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(attractions).where(eq(attractions.id, id)).limit(1);
  return rows.length > 0 ? rows[0] : undefined;
}

export async function createAttraction(data: InsertAttraction) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(attractions).values(data);
  return result[0].insertId;
}

export async function updateAttraction(id: number, data: Partial<InsertAttraction>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(attractions).set(data).where(eq(attractions.id, id));
}

export async function deleteAttraction(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(attractions).where(eq(attractions.id, id));
}

// ---------------------------------------------------------------------------
// Visitor categories
// ---------------------------------------------------------------------------
export async function listActiveCategories() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(visitorCategories)
    .where(eq(visitorCategories.isActive, true))
    .orderBy(visitorCategories.sortIndex, visitorCategories.id);
}

export async function listAllCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(visitorCategories).orderBy(visitorCategories.sortIndex, visitorCategories.id);
}

export async function getCategoryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(visitorCategories)
    .where(eq(visitorCategories.id, id))
    .limit(1);
  return rows.length > 0 ? rows[0] : undefined;
}

export async function getActiveCategoriesByIds(ids: number[]) {
  const db = await getDb();
  if (!db || ids.length === 0) return [];
  return db
    .select()
    .from(visitorCategories)
    .where(and(eq(visitorCategories.isActive, true), sql`${visitorCategories.id} IN (${sql.join(ids.map((i) => sql.raw(String(i))), sql`, `)})`));
}

export async function createCategory(data: InsertVisitorCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(visitorCategories).values(data);
  return result[0].insertId;
}

export async function updateCategory(id: number, data: Partial<InsertVisitorCategory>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(visitorCategories).set(data).where(eq(visitorCategories.id, id));
}

export async function deleteCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(visitorCategories).where(eq(visitorCategories.id, id));
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------
/**
 * Generate a unique booking reference of the form KNMP-XXXXXX.
 * Retries on collision (very unlikely given 36^6 ≈ 2.1 billion combinations).
 */
const REF_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ambiguous chars removed

export async function generateUniqueReference(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  for (let attempt = 0; attempt < 10; attempt++) {
    const rand = new Uint32Array(6);
    crypto.getRandomValues(rand);
    const code = Array.from(rand, (n) => REF_CHARS[n % REF_CHARS.length]).join("");
    const reference = `KNMP-${code}`;
    const rows = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.reference, reference))
      .limit(1);
    if (rows.length === 0) return reference;
  }
  throw new Error("Failed to generate unique booking reference");
}

export async function createBooking(data: InsertBooking) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(bookings).values(data);
  return result[0].insertId;
}

export async function createBookingItem(data: InsertBookingItem) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(bookingItems).values(data);
}

export async function getBookingById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return rows.length > 0 ? rows[0] : undefined;
}

export async function getBookingByReference(reference: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.reference, reference))
    .limit(1);
  return rows.length > 0 ? rows[0] : undefined;
}

export async function getBookingItemsByBookingId(bookingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookingItems).where(eq(bookingItems.bookingId, bookingId));
}

export async function getMyBookings(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(bookings)
    .where(eq(bookings.userId, userId))
    .orderBy(desc(bookings.visitDate), desc(bookings.createdAt));
}

export async function getUpcomingMyBookings(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.userId, userId),
        gt(bookings.visitDate, new Date()),
      ),
    )
    .orderBy(bookings.visitDate);
}

export async function updateBookingStatus(
  id: number,
  status: "pending" | "confirmed" | "cancelled",
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(bookings).set({ status }).where(eq(bookings.id, id));
}

export async function cancelOwnBooking(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(and(eq(bookings.id, id), eq(bookings.userId, userId)));
}

export async function listAllBookings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookings).orderBy(desc(bookings.createdAt));
}

export async function getBookingStats(range?: { from?: Date; to?: Date }) {
  const db = await getDb();
  if (!db) return { total: 0, revenuePesewas: 0, upcoming: 0, cancelled: 0, totalVisitors: 0 };
  const rangeFilter =
    range?.from || range?.to
      ? and(
          range?.from ? gte(bookings.visitDate, range.from) : undefined,
          range?.to ? lt(bookings.visitDate, range.to) : undefined,
        )
      : undefined;
  const statsRows = await db
    .select({
      total: sql<number>`count(*)`,
      revenuePesewas: sql<number>`coalesce(sum(${bookings.totalPesewas}), 0)`,
      upcoming: sql<number>`sum(case when ${bookings.status} != 'cancelled' and ${bookings.visitDate} > now() then 1 else 0 end)`,
      cancelled: sql<number>`sum(case when ${bookings.status} = 'cancelled' then 1 else 0 end)`,
      totalVisitors: sql<number>`coalesce(sum(${bookingItems.quantity}), 0)`,
    })
    .from(bookings)
    .leftJoin(bookingItems, eq(bookings.id, bookingItems.bookingId))
    .where(rangeFilter);
  return (statsRows[0] ?? { total: 0, revenuePesewas: 0, upcoming: 0, cancelled: 0, totalVisitors: 0 }) as {
    total: number;
    revenuePesewas: number;
    upcoming: number;
    cancelled: number;
    totalVisitors: number;
  };
}

// ---------------------------------------------------------------------------
// Itineraries
// ---------------------------------------------------------------------------
export async function listMyItinerary(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.userId, userId))
    .orderBy(itineraryItems.visitDate, itineraryItems.sortIndex, itineraryItems.id);
}

export async function listItineraryByDate(userId: number, visitDate: Date) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(itineraryItems)
    .where(
      and(eq(itineraryItems.userId, userId), eq(itineraryItems.visitDate, visitDate)),
    )
    .orderBy(itineraryItems.sortIndex, itineraryItems.id);
}

export async function createItineraryItem(data: InsertItineraryItem) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(itineraryItems).values(data);
  return result[0].insertId;
}

export async function updateItineraryItem(
  id: number,
  userId: number,
  data: Partial<InsertItineraryItem>,
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .update(itineraryItems)
    .set(data)
    .where(and(eq(itineraryItems.id, id), eq(itineraryItems.userId, userId)));
}

export async function deleteItineraryItem(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .delete(itineraryItems)
    .where(and(eq(itineraryItems.id, id), eq(itineraryItems.userId, userId)));
}

export async function reorderItineraryItem(id: number, userId: number, sortIndex: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .update(itineraryItems)
    .set({ sortIndex })
    .where(and(eq(itineraryItems.id, id), eq(itineraryItems.userId, userId)));
}

// ---------------------------------------------------------------------------
// Tour slots
// ---------------------------------------------------------------------------
export async function listActiveTourSlots() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: tourSlots.id,
      attractionId: tourSlots.attractionId,
      attractionName: attractions.name,
      startTime: tourSlots.startTime,
      endTime: tourSlots.endTime,
      label: tourSlots.label,
      maxCapacity: tourSlots.maxCapacity,
      bookedCount: tourSlots.bookedCount,
      isActive: tourSlots.isActive,
      createdAt: tourSlots.createdAt,
    })
    .from(tourSlots)
    .innerJoin(attractions, eq(tourSlots.attractionId, attractions.id))
    .where(eq(tourSlots.isActive, true))
    .orderBy(tourSlots.attractionId, tourSlots.startTime);
  return rows.map(row => ({
    ...row,
    attractionName: row.attractionName,
  }));
}

export async function getTourSlotsByAttraction(attractionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(tourSlots)
    .where(and(eq(tourSlots.attractionId, attractionId), eq(tourSlots.isActive, true)))
    .orderBy(tourSlots.startTime);
}

export async function createTourSlot(data: InsertTourSlot) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(tourSlots).values(data);
  return result[0].insertId;
}

export async function deleteTourSlot(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(tourSlots).where(eq(tourSlots.id, id));
}

export async function createBookingSlot(data: InsertBookingSlot) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(bookingSlots).values(data);
}

export async function getBookingSlotsByBookingId(bookingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookingSlots).where(eq(bookingSlots.bookingId, bookingId));
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
/** Visitor-category breakdown: non-cancelled bookings, optionally scoped to a visit-date range. */
export async function getCategoryBreakdown(range?: { from?: Date; to?: Date }) {
  const db = await getDb();
  if (!db) return [];
  const rangeFilter =
    range?.from || range?.to
      ? and(
          sql<boolean>`${bookings.status} != 'cancelled'`,
          range?.from ? gte(bookings.visitDate, range.from) : undefined,
          range?.to ? lt(bookings.visitDate, range.to) : undefined,
        )
      : (sql<boolean>`${bookings.status} != 'cancelled'`);
  return db
    .select({
      categoryId: bookingItems.categoryId,
      categoryName: bookingItems.categoryName,
      visitors: sql<number>`coalesce(sum(${bookingItems.quantity}), 0)`,
      revenuePesewas: sql<number>`coalesce(sum(${bookingItems.subtotalPesewas}), 0)`,
    })
    .from(bookingItems)
    .innerJoin(bookings, eq(bookingItems.bookingId, bookings.id))
    .where(rangeFilter)
    .groupBy(bookingItems.categoryId, bookingItems.categoryName)
    .orderBy(sql`4 DESC`);
}

/** Monthly revenue & booking trends, optionally scoped to a visit-date range. */
export async function getMonthlyTrends(months = 6, range?: { from?: Date; to?: Date }) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      month: sql<string>`date_format(${bookings.createdAt}, '%Y-%m')`,
      bookings: sql<number>`count(*)`,
      revenuePesewas: sql<number>`coalesce(sum(${bookings.totalPesewas}), 0)`,
      visitors: sql<number>`coalesce(sum(${bookingItems.quantity}), 0)`,
    })
    .from(bookings)
    .leftJoin(bookingItems, eq(bookings.id, bookingItems.bookingId))
    .where(
      and(
        sql<boolean>`${bookings.status} != 'cancelled'`,
        gt(bookings.createdAt, sql`date_sub(now(), interval ${months} month)`),
        range?.from ? gte(bookings.visitDate, range.from) : undefined,
        range?.to ? lt(bookings.visitDate, range.to) : undefined,
      ),
    )
    .groupBy(sql`date_format(${bookings.createdAt}, '%Y-%m')`)
    .orderBy(sql`1 ASC`);
  return rows;
}

// ---------------------------------------------------------------------------
// Itinerary share links
// ---------------------------------------------------------------------------
export async function createItineraryShare(userId: number, shareCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(itineraryShares).where(eq(itineraryShares.userId, userId));
  await db.insert(itineraryShares).values({ userId, shareCode });
}

export async function getItineraryShareOwner(shareCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select({ userId: itineraryShares.userId })
    .from(itineraryShares)
    .where(eq(itineraryShares.shareCode, shareCode))
    .limit(1);
  return rows[0]?.userId;
}

export async function listItineraryByCode(shareCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const owner = await getItineraryShareOwner(shareCode);
  if (!owner) return undefined;
  const items = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.userId, owner))
    .orderBy(itineraryItems.visitDate, itineraryItems.sortIndex, itineraryItems.id);
  return { userId: owner, items };
}
