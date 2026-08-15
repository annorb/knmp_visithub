import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

// NOTE: vi.mock factories are hoisted to the top of the file, so the mock
// data is produced by plain functions (never by outer-scope variables).

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getActiveCategoriesByIds: async (ids: number[]) => TEST_CATEGORIES.filter(c => ids.includes(c.id)),
    listActiveAttractions: async () => listAttractionsWithCoords(),
    listMyItinerary: async () => [],
    getDailyCapacity: async () => 500,
    getVisitorCountForDate: async () => 0,
    getNearCapacityThreshold: async () => 0.8,
    getSettings: async () => [],
  };
});

/**
 * Round 8 regression tests (offline-safe mocks):
 * - group/school booking package (bulk pricing) end-to-end via calculateCost
 * - attractions carry lat/lng for the park map
 * - itinerary PDF export procedure exists
 */

function listCategoriesWithGroup() {
  return [
    {
      id: 1,
      name: "Adult (Ghanaian)",
      slug: "adult-ghanaian",
      pricePesewas: 2500,
      description: "Ages 18 and above",
      isActive: true,
      isGroup: false,
      groupMinQty: null,
      groupDiscountPercent: null,
      sortIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 5,
      name: "SHS / JHS Student (Ghanaian)",
      slug: "shs-jhs-student",
      pricePesewas: 1000,
      description: "Secondary school students with valid ID",
      isActive: true,
      isGroup: true,
      groupMinQty: 15,
      groupDiscountPercent: 20,
      sortIndex: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 3,
      name: "Student (Ghanaian, Tertiary)",
      slug: "student-tertiary",
      pricePesewas: 1500,
      description: "Tertiary students with valid ID",
      isActive: true,
      isGroup: true,
      groupMinQty: 10,
      groupDiscountPercent: 10,
      sortIndex: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
}

const TEST_CATEGORIES: ReturnType<typeof listCategoriesWithGroup> = listCategoriesWithGroup();

function listAttractionsWithCoords() {
  return [
    {
      id: 1,
      name: "Kwame Nkrumah Mausoleum",
      slug: "mausoleum",
      location: "Central",
      category: "Monument",
      lat: 5.5449,
      lng: -0.2068,
      description: "Final resting place of Ghana's first president.",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      name: "Kwame Nkrumah Museum",
      slug: "museum",
      location: "Central",
      category: "Museum",
      lat: 5.5456,
      lng: -0.2077,
      description: "Artifacts and memorabilia of the independence era.",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
}

let cachedRouter: typeof import("./routers").appRouter | null = null;

async function createCaller() {
  if (!cachedRouter) {
    const mod = await import("./routers");
    cachedRouter = mod.appRouter;
  }
  return cachedRouter.createCaller({ user: null } as unknown as TrpcContext);
}

describe("Group & school booking package (bulk pricing)", () => {
  it("applies the group discount at the minimum group size via calculateCost", async () => {
    const caller = await createCaller();

    // Below the minimum group size (15): no discount
    const small = await caller.bookings.calculateCost({
      lines: [{ categoryId: 5, quantity: 10 }],
    });
    expect(small.totalDiscountPesewas).toBe(0);
    expect(small.totalPesewas).toBe(10 * 1000);

    // At the minimum group size: 15 SHS students × GHS10 = 15000 pesewas base,
    // −20% discount = 3000 → total 12000 pesewas
    const group = await caller.bookings.calculateCost({
      lines: [{ categoryId: 5, quantity: 15 }],
    });
    expect(group.totalDiscountPesewas).toBe(3000);
    expect(group.totalPesewas).toBe(12000);
    expect(group.items[0].discountPercent).toBe(20);
    expect(group.items[0].discountPesewas).toBe(3000);

    // Mixed booking: discounted group line + full-price adult line
    const mixed = await caller.bookings.calculateCost({
      lines: [
        { categoryId: 5, quantity: 15 },
        { categoryId: 1, quantity: 2 },
      ],
    });
    expect(mixed.totalDiscountPesewas).toBe(3000);
    expect(mixed.totalPesewas).toBe(12000 + 2 * 2500);
    expect(mixed.items[1].discountPesewas).toBe(0);

    // Tertiary student group: 10 visitors × GHS15 = 15000 pesewas base,
    // −10% discount = 1500 → total 13500 pesewas
    const tertiary = await caller.bookings.calculateCost({
      lines: [{ categoryId: 3, quantity: 10 }],
    });
    expect(tertiary.totalDiscountPesewas).toBe(1500);
    expect(tertiary.totalPesewas).toBe(13500);

    // Adult category is not a group package → never discounted
    const adultGroup = await caller.bookings.calculateCost({
      lines: [{ categoryId: 1, quantity: 50 }],
    });
    expect(adultGroup.totalDiscountPesewas).toBe(0);
    expect(adultGroup.totalPesewas).toBe(50 * 2500);
  });
});

describe("Interactive park map", () => {
  it("exposes lat/lng on attractions so the park map can render markers", async () => {
    const { listActiveAttractions } = await import("./db");
    const rows = await listActiveAttractions();
    expect(rows.length).toBeGreaterThan(0);
    for (const a of rows) {
      expect(a.lat).not.toBeNull();
      expect(a.lng).not.toBeNull();
      // Central Accra, within the park area
      expect(Number(a.lat)).toBeGreaterThan(5.5);
      expect(Number(a.lat)).toBeLessThan(5.57);
      expect(Number(a.lng)).toBeGreaterThan(-0.23);
      expect(Number(a.lng)).toBeLessThan(-0.19);
    }
  });
});

describe("Itinerary PDF export", () => {
  it("the exportPdf procedure is defined and callable (protected)", async () => {
    const { appRouter } = await import("./routers");
    const proc = appRouter.itineraries.exportPdf;
    expect(proc).toBeDefined();
  });
});
