import { and, desc, eq, gt, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  attractions,
  bookings,
  bookingItems,
  itineraryItems,
  users,
  visitorCategories,
  type InsertAttraction,
  type InsertBooking,
  type InsertBookingItem,
  type InsertItineraryItem,
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

export async function getBookingStats() {
  const db = await getDb();
  if (!db) return { total: 0, revenuePesewas: 0, upcoming: 0, cancelled: 0, totalVisitors: 0 };
  const statsRows = await db
    .select({
      total: sql<number>`count(*)`,
      revenuePesewas: sql<number>`coalesce(sum(${bookings.totalPesewas}), 0)`,
      upcoming: sql<number>`sum(case when ${bookings.status} != 'cancelled' and ${bookings.visitDate} > now() then 1 else 0 end)`,
      cancelled: sql<number>`sum(case when ${bookings.status} = 'cancelled' then 1 else 0 end)`,
      totalVisitors: sql<number>`coalesce(sum(${bookingItems.quantity}), 0)`,
    })
    .from(bookings)
    .leftJoin(bookingItems, eq(bookings.id, bookingItems.bookingId));
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
