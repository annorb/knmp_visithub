import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  bookings,
  bookingItems,
  users,
  siteSettings,
} from "../drizzle/schema";
import {
  getDb,
  getDailyCapacity,
  getNearCapacityThreshold,
  getSiteSetting,
  updateSiteSetting,
  checkInBooking,
  undoCheckInBooking,
  getBookingByReference,
  createUser,
} from "./db";

const SYNTHETIC_EMAIL = `round7.test.${Date.now()}@knmp.example.com`;

async function resetSiteSettings() {
  const db = await getDb();
  if (!db) return;
  await db.delete(siteSettings);
}

describe("site settings (live db)", () => {
  it("defaults match the schema constants", async () => {
    const capacity = await getDailyCapacity();
    const threshold = await getNearCapacityThreshold();
    expect(capacity).toBe(500);
    expect(threshold).toBeCloseTo(0.75, 3);
  });

  it("persists an updated capacity and threshold", async () => {
    await updateSiteSetting("daily_capacity", "250", "Max daily visitors (test)");
    await updateSiteSetting("near_capacity_threshold", "0.8", "Near-capacity fraction (test)");
    expect(await getDailyCapacity()).toBe(250);
    expect(await getNearCapacityThreshold()).toBeCloseTo(0.8, 4);
    await resetSiteSettings();
  });

  it("falls back to defaults when the setting row is absent", async () => {
    await resetSiteSettings();
    expect(await getDailyCapacity()).toBe(500);
    expect(await getNearCapacityThreshold()).toBeCloseTo(0.75, 3);
  });

  it("reads a single site setting with fallback default", async () => {
    const value = await getSiteSetting("daily_capacity", "999");
    expect(value).toBeTypeOf("string");
  });
});

describe("gate check-in (live db)", () => {
  it("checks a booking in and undoes the check-in", async () => {
    const db = await getDb();
    if (!db) return;

    const reference = `R7-${Date.now()}`;
    const insertResult = await db.insert(bookings).values({
      reference,
      userId: 1,
      visitorName: "Round 7 Test",
      visitDate: new Date("2026-09-01T00:00:00.000Z"),
      totalPesewas: 1500,
      status: "confirmed",
    });
    const bookingId = insertResult[0].insertId;
    try {
      await checkInBooking(bookingId);
      let looked = await getBookingByReference(reference);
      expect(looked?.checkInAt).toBeInstanceOf(Date);

      await undoCheckInBooking(bookingId);
      looked = await getBookingByReference(reference);
      expect(looked?.checkInAt).toBeNull();
    } finally {
      await db.delete(bookingItems).where(eq(bookingItems.bookingId, bookingId));
      await db.delete(bookings).where(eq(bookings.id, bookingId));
    }
  });

  it("refuses check-in for a cancelled booking", async () => {
    const db = await getDb();
    if (!db) return;

    const cancelledRef = `R7C-${Date.now()}`;
    const insertResult = await db.insert(bookings).values({
      reference: cancelledRef,
      userId: 1,
      visitorName: "Round 7 Cancelled",
      visitDate: new Date("2026-09-02T00:00:00.000Z"),
      totalPesewas: 500,
      status: "cancelled",
    });
    const bookingId = insertResult[0].insertId;
    try {
      await expect(checkInBooking(bookingId)).rejects.toThrow();
      const looked = await getBookingByReference(cancelledRef);
      expect(looked?.checkInAt ?? null).toBeNull();
    } finally {
      await db.delete(bookingItems).where(eq(bookingItems.bookingId, bookingId));
      await db.delete(bookings).where(eq(bookings.id, bookingId));
    }
  });

  it("returns nothing for an unknown reference", async () => {
    const looked = await getBookingByReference("UNKNOWN-REFERENCE-XX");
    expect(looked).toBeFalsy();
  });
});

describe("admin user creation (live db)", () => {
  it("creates a user with a unique synthetic email", async () => {
    const created = await createUser({
      name: "Round 7 Test User",
      email: SYNTHETIC_EMAIL,
      role: "user",
    });
    expect(created).not.toBeNull();
    expect(created?.email).toBe(SYNTHETIC_EMAIL);
    const db = await getDb();
    if (db && created) {
      await db.delete(users).where(eq(users.id, created.id));
    }
  });

  it("rejects a duplicate email", async () => {
    const first = await createUser({
      name: "Round 7 Dup",
      email: SYNTHETIC_EMAIL,
      role: "user",
    });
    const db = await getDb();
    try {
      const second = await createUser({
        name: "Round 7 Dup 2",
        email: SYNTHETIC_EMAIL,
        role: "user",
      });
      expect(second).toBeNull();
    } finally {
      if (db && first) await db.delete(users).where(eq(users.id, first.id));
    }
  });
});
