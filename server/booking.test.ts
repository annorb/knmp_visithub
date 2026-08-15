import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  createAuditEvent,
  listAttractionFacets,
  listAuditEvents,
  searchAttractionsFiltered,
} from "./db";
import {
  createAuditEvent,
  createItineraryShare,
  getCategoryBreakdown,
  getCategoryById,
  getAttractionById,
  getBookingById,
  getMonthlyTrends,
  listAllUsers,
  listItineraryByCode,
} from "./db";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

// ---------------------------------------------------------------------------
// Fakes for the database layer so tests run without a live connection.
// ---------------------------------------------------------------------------
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();

  const categories = [
    {
      id: 1,
      name: "Adult (Ghanaian)",
      slug: "adult-ghanaian",
      pricePesewas: 2500,
      description: "Ages 13 and above",
      isActive: true,
      sortIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      name: "Child",
      slug: "child",
      pricePesewas: 500,
      description: "Under 12",
      isActive: true,
      sortIndex: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 3,
      name: "Student",
      slug: "student",
      pricePesewas: 1500,
      description: "Tertiary students with valid ID",
      isActive: true,
      sortIndex: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 4,
      name: "Foreigner Adult",
      slug: "foreigner-adult",
      pricePesewas: 10000,
      description: "Non-Ghanaian adults",
      isActive: true,
      sortIndex: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  let bookingCounter = 0;
  const bookings = new Map<number, { id: number; reference: string; userId: number }>();
  const bookingItems = new Map<number, unknown[]>();

  return {
    ...actual,
    getActiveCategoriesByIds: vi.fn(async (ids: number[]) =>
      categories.filter(c => ids.includes(c.id)),
    ),
    generateUniqueReference: vi.fn(async () => {
      bookingCounter += 1;
      return `KNMP-TEST${String(bookingCounter).padStart(4, "0")}`;
    }),
    createBooking: vi.fn(async (data: { reference: string; userId: number }) => {
      const id = bookingCounter + 100;
      bookings.set(id, { id, reference: data.reference, userId: data.userId });
      bookingItems.set(id, []);
      return id;
    }),
    createBookingItem: vi.fn(async (data: { bookingId: number }) => {
      const items = bookingItems.get(data.bookingId) ?? [];
      items.push(data);
      bookingItems.set(data.bookingId, items);
    }),
    getBookingById: vi.fn(async (id: number) => bookings.get(id)),
    getMyBookings: vi.fn(async (userId: number) =>
      [...bookings.values()].filter(b => b.userId === userId),
    ),
    cancelOwnBooking: vi.fn(async (id: number, userId: number) => {
      const b = bookings.get(id);
      if (b && b.userId === userId) b.reference = `${b.reference}:cancelled`;
    }),
    listActiveAttractions: vi.fn(async () => []),
    searchAttractions: vi.fn(async () => []),
    getAttractionBySlug: vi.fn(async () => undefined),
    getAttractionById: vi.fn(async () => undefined),
    listMyItinerary: vi.fn(async () => []),
    listItineraryByDate: vi.fn(async () => []),
    createItineraryItem: vi.fn(async () => 1),
    updateItineraryItem: vi.fn(async () => undefined),
    reorderItineraryItem: vi.fn(async () => undefined),
    deleteItineraryItem: vi.fn(async () => undefined),
    listAllAttractions: vi.fn(async () => []),
    createAttraction: vi.fn(async () => 1),
    updateAttraction: vi.fn(async () => undefined),
    deleteAttraction: vi.fn(async () => undefined),
    listAllCategories: vi.fn(async () => categories),
    createCategory: vi.fn(async () => 1),
    updateCategory: vi.fn(async () => undefined),
    deleteCategory: vi.fn(async () => undefined),
    listAllBookings: vi.fn(async () => [...bookings.values()]),
    getBookingItemsByBookingId: vi.fn(async (bookingId: number) => bookingItems.get(bookingId) ?? []),
    updateBookingStatus: vi.fn(async () => undefined),
    getBookingStats: vi.fn(async () => ({ total: 0, revenuePesewas: 0, upcoming: 0, cancelled: 0, totalVisitors: 0 })),
    listActiveCategories: vi.fn(async () => categories),
    getUpcomingMyBookings: vi.fn(async () => []),
    listActiveTourSlots: vi.fn(async () => []),
    createBookingSlot: vi.fn(async () => undefined),
    getCategoryBreakdown: vi.fn(async () => []),
    getMonthlyTrends: vi.fn(async () => []),
    listAllUsers: vi.fn(async () => []) as ReturnType<typeof vi.fn>,
    updateUserRole: vi.fn(async () => undefined),
    setUserActive: vi.fn(async () => undefined),
    createAuditEvent: vi.fn(async () => undefined) as ReturnType<typeof vi.fn>,
    listAuditEvents: vi.fn(async () => []),
    listAttractionFacets: vi.fn(async () => ({ categories: [], locations: [] })),
    searchAttractionsFiltered: vi.fn(async () => []) as ReturnType<typeof vi.fn>,
    createItineraryShare: vi.fn(async () => undefined),
    listItineraryByCode: vi.fn(async () => undefined) as ReturnType<typeof vi.fn>,
  };
});

// ---------------------------------------------------------------------------
// Context factories
// ---------------------------------------------------------------------------
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createBaseContext(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    ...overrides,
  };
}

/** Public (unsigned) context for public-facing procedure tests. */
function createPublicContext(): TrpcContext {
  return createBaseContext();
}

let userSeq = 0;

function createAuthContext(role: "user" | "admin" = "user"): TrpcContext {
  userSeq += 1;
  const user: AuthenticatedUser = {
    id: userSeq,
    openId: `test-${role}-${userSeq}`,
    email: `test-${userSeq}@example.com`,
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return createBaseContext({ user });
}

function tomorrow(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("categories.list (public)", () => {
  it("returns active visitor categories without auth", async () => {
    const caller = appRouter.createCaller(createBaseContext());
    const cats = await caller.categories.list();
    expect(cats).toHaveLength(4);
    expect(cats.map(c => c.slug)).toContain("child");
  });
});

describe("bookings.calculateCost", () => {
  it("computes totals correctly from category prices and quantities", async () => {
    const caller = appRouter.createCaller(createBaseContext());
    const result = await caller.bookings.calculateCost({
      lines: [
        { categoryId: 1, quantity: 2 }, // 25.00 * 2 = 50.00
        { categoryId: 2, quantity: 3 }, // 5.00 * 3 = 15.00
        { categoryId: 4, quantity: 1 }, // 100.00 * 1 = 100.00
      ],
    });
    expect(result.totalPesewas).toBe(16500); // GHS 165.00
    expect(result.totalVisitors).toBe(6);
    expect(result.items).toHaveLength(3);
    expect(result.items[2]?.subtotalPesewas).toBe(10000);
  });

  it("rejects empty line items", async () => {
    const caller = appRouter.createCaller(createBaseContext());
    await expect(caller.bookings.calculateCost({ lines: [] })).rejects.toThrow(
      /at least one/i,
    );
  });

  it("rejects inactive or invalid categories", async () => {
    const caller = appRouter.createCaller(createBaseContext());
    await expect(
      caller.bookings.calculateCost({ lines: [{ categoryId: 99, quantity: 1 }] }),
    ).rejects.toThrow(/invalid or inactive/i);
  });
});

describe("bookings.create (protected)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(createBaseContext());
    await expect(
      caller.bookings.create({
        visitDate: tomorrow(),
        lines: [{ categoryId: 1, quantity: 2 }],
        visitorName: "Test",
      }),
    ).rejects.toThrow();
  });

  it("creates a booking with a unique auto-generated reference", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.bookings.create({
      visitDate: tomorrow(),
      lines: [
        { categoryId: 1, quantity: 2 },
        { categoryId: 2, quantity: 1 },
      ],
      visitorName: "Test Visitor",
      contactEmail: "test@example.com",
    });
    expect(result.reference).toMatch(/^KNMP-[A-Z0-9]+$/);
    expect(result.id).toBeGreaterThan(0);
  });

  it("rejects past visit dates", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 2);
    await expect(
      caller.bookings.create({
        visitDate: yesterday,
        lines: [{ categoryId: 1, quantity: 1 }],
      }),
    ).rejects.toThrow(/visit date/i);
  });
});

describe("bookings.mineById (owner only)", () => {
  it("returns undefined for bookings belonging to another user", async () => {
    const adminCaller = appRouter.createCaller(createAuthContext("admin"));
    const result = await adminCaller.bookings.create({
      visitDate: tomorrow(),
      lines: [{ categoryId: 3, quantity: 1 }],
    });
    const otherCaller = appRouter.createCaller(createAuthContext("user"));
    const lookup = await otherCaller.bookings.mineById({ id: result.id });
    expect(lookup).toBeUndefined();
  });

  it("returns the booking with line items for the owner", async () => {
    const ownerCaller = appRouter.createCaller(createAuthContext("admin"));
    const result = await ownerCaller.bookings.create({
      visitDate: tomorrow(),
      lines: [{ categoryId: 3, quantity: 2 }],
    });
    const lookup = await ownerCaller.bookings.mineById({ id: result.id });
    expect(lookup).not.toBeUndefined();
    expect(lookup?.booking.reference).toBe(result.reference);
    expect(lookup?.items).toHaveLength(1);
    expect(lookup?.items[0]?.quantity).toBe(2);
  });
});

describe("bookings.cancel (owner only)", () => {
  it("only cancels the caller's own booking", async () => {
    const db = await import("./db");
    const ownerCaller = appRouter.createCaller(createAuthContext("admin"));
    const created = await ownerCaller.bookings.create({
      visitDate: tomorrow(),
      lines: [{ categoryId: 1, quantity: 1 }],
    });
    const otherCaller = appRouter.createCaller(createAuthContext("user"));
    await otherCaller.bookings.cancel({ id: created.id });
    // cancelOwnBooking should not have mutated another user's booking marker
    const after = await ownerCaller.bookings.mineById({ id: created.id });
    expect((after?.booking as { reference: string }).reference).not.toContain("cancelled");
    expect(db.cancelOwnBooking).toHaveBeenCalled();
  });
});

describe("admin procedure gating", () => {
  it("rejects non-admin users from admin endpoints", async () => {
    const userCaller = appRouter.createCaller(createAuthContext("user"));
    await expect(userCaller.attractions.listAll()).rejects.toThrow();
    await expect(userCaller.categories.listAll()).rejects.toThrow();
    await expect(userCaller.bookings.listAll()).rejects.toThrow();
    await expect(userCaller.bookings.stats()).rejects.toThrow();
  });

  it("allows admins", async () => {
    const adminCaller = appRouter.createCaller(createAuthContext("admin"));
    const stats = await adminCaller.bookings.stats();
    expect(stats).toHaveProperty("total");
  });
});

describe("itineraries protection", () => {
  it("rejects unauthenticated itinerary access", async () => {
    const caller = appRouter.createCaller(createBaseContext());
    await expect(caller.itineraries.list()).rejects.toThrow();
  });

  it("lists itinerary items for authenticated users", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const items = await caller.itineraries.list();
    expect(Array.isArray(items)).toBe(true);
  });
});

describe("bookings.create multi-day & slots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a multi-day booking and persists the end date", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const start = tomorrow();
    const end = new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000);
    const result = await caller.bookings.create({
      visitDate: start,
      visitEndDate: end,
      lines: [{ categoryId: 1, quantity: 2 }],
    });
    expect(result.id).toBeGreaterThan(0);
    const db = await import("./db");
    expect(db.createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ visitEndDate: end }),
    );
  });

  it("rejects an end date earlier than the start date", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const start = tomorrow();
    const end = new Date(start.getTime() - 2 * 24 * 60 * 60 * 1000);
    await expect(
      caller.bookings.create({
        visitDate: start,
        visitEndDate: end,
        lines: [{ categoryId: 1, quantity: 1 }],
      }),
    ).rejects.toThrow(/end date/i);
  });

  it("rejects bookings spanning more than 30 days", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const start = tomorrow();
    const end = new Date(start.getTime() + 60 * 24 * 60 * 60 * 1000);
    await expect(
      caller.bookings.create({
        visitDate: start,
        visitEndDate: end,
        lines: [{ categoryId: 1, quantity: 1 }],
      }),
    ).rejects.toThrow(/30 days/i);
  });

  it("attaches selected tour slots to the booking", async () => {
    const db = await import("./db");
    vi.mocked(db.listActiveTourSlots).mockResolvedValue([
      {
        id: 7,
        attractionId: 2,
        name: "Museum",
        startTime: "10:00",
        endTime: "10:45",
        label: "Morning",
        maxCapacity: 25,
        bookedCount: 0,
        isActive: true,
        createdAt: new Date(),
      },
    ]);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.bookings.create({
      visitDate: tomorrow(),
      lines: [{ categoryId: 1, quantity: 1 }],
      slotIds: [7],
    });
    // attractionName comes from getAttractionById; the fake returns undefined for
    // unknown ids, so assert the slot and attraction linkage instead.
    expect(db.createBookingSlot).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: result.id, slotId: 7, attractionId: 2 }),
    );
  });

  it("rejects unavailable tour slots", async () => {
    const db = await import("./db");
    vi.mocked(db.listActiveTourSlots).mockResolvedValue([]);
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.bookings.create({
        visitDate: tomorrow(),
        lines: [{ categoryId: 1, quantity: 1 }],
        slotIds: [7],
      }),
    ).rejects.toThrow(/no longer available/i);
  });
});

describe("analytics gating", () => {
  it("blocks non-admin users from analytics endpoints", async () => {
    const caller = appRouter.createCaller(createAuthContext("user"));
    await expect(caller.analytics.categoryBreakdown()).rejects.toThrow();
    await expect(caller.analytics.monthlyTrends({ months: 6 })).rejects.toThrow();
  });

  it("allows admins to read analytics", async () => {
    const caller = appRouter.createCaller(createAuthContext("admin"));
    const breakdown = await caller.analytics.categoryBreakdown();
    expect(Array.isArray(breakdown)).toBe(true);
  });
});

describe("admin users management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks non-admin users from user management endpoints", async () => {
    const caller = appRouter.createCaller(createAuthContext("user"));
    await expect(caller.users.listAll()).rejects.toThrow();
    await expect(
      caller.users.setActivation({ userId: 1, isActive: false }),
    ).rejects.toThrow();
  });

  it("lets admins list registered users", async () => {
    const caller = appRouter.createCaller(createAuthContext("admin"));
    const list = await caller.users.listAll();
    expect(Array.isArray(list)).toBe(true);
  });

  it("prevents an admin from demoting themselves", async () => {
    // Self-demotion is checked in the database layer when userId === actor id.
    const db = await import("./db");
    vi.mocked(db.updateUserRole).mockImplementationOnce(async (userId, role, selfId) => {
      if (userId === selfId && role !== "admin") {
        throw new Error("You cannot remove your own administrator role");
      }
      return undefined;
    });
    const selfCtx = createAuthContext("admin");
    const selfAdminCaller = appRouter.createCaller(selfCtx);
    await expect(
      selfAdminCaller.users.updateRole({ userId: selfCtx.user!.id, role: "user" }),
    ).rejects.toThrow(/own administrator role/i);
  });

  it("allows admins to activate and deactivate accounts", async () => {
    const caller = appRouter.createCaller(createAuthContext("admin"));
    await caller.users.setActivation({ userId: 7, isActive: false });
    const db = await import("./db");
    expect(db.setUserActive).toHaveBeenCalledWith(7, false);
    await caller.users.setActivation({ userId: 7, isActive: true });
    expect(db.setUserActive).toHaveBeenCalledWith(7, true);
  });
});

describe("attraction facets and filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes category and location facets publicly", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const f = await caller.attractions.facets();
    expect(f).toHaveProperty("categories");
    expect(f).toHaveProperty("locations");
  });

  it("applies combined search, category and location filters", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await caller.attractions.searchFiltered({
      query: "mauso",
      category: "Monument",
      location: "Central grounds",
    });
    const db = await import("./db");
    expect(db.searchAttractionsFiltered).toHaveBeenCalledWith({
      query: "mauso",
      category: "Monument",
      location: "Central grounds",
    });
  });
});

describe("admin audit trail", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const db = await import("./db");
    vi.mocked(db.updateUserRole).mockImplementation(async () => undefined);
  });

  it("writes an audit event when a role is changed", async () => {
    const caller = appRouter.createCaller(createAuthContext("admin"));
    vi.mocked(listAllUsers).mockResolvedValueOnce([
      { id: 88, name: "Target Person", email: "target@example.com" } as never,
    ]);
    await caller.users.updateRole({ userId: 88, role: "admin" });
    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "role_change",
        targetUserId: 88,
        detail: expect.stringContaining("admin"),
      }),
    );
  });

  it("writes an audit event when an account is deactivated or reactivated", async () => {
    const caller = appRouter.createCaller(createAuthContext("admin"));
    vi.mocked(listAllUsers).mockResolvedValueOnce([
      { id: 99, name: "Other Person", email: "other@example.com" } as never,
    ]);
    await caller.users.setActivation({ userId: 99, isActive: false });
    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "account_deactivated", targetUserId: 99 }),
    );

    vi.mocked(listAllUsers).mockResolvedValueOnce([
      { id: 99, name: "Other Person", email: "other@example.com" } as never,
    ]);
    await caller.users.setActivation({ userId: 99, isActive: true });
    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "account_reactivated", targetUserId: 99 }),
    );
  });

  it("blocks non-admins from reading the audit log", async () => {
    const caller = appRouter.createCaller(createAuthContext("user"));
    await expect(caller.audit.list()).rejects.toThrow();
  });

  it("lets admins list audit events", async () => {
    const caller = appRouter.createCaller(createAuthContext("admin"));
    const list = await caller.audit.list();
    expect(Array.isArray(list)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Round 4: itinerary export & share, extended audit trail, analytics ranges
// ---------------------------------------------------------------------------
describe("itineraries.exportPdf & share (protected)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires authentication to export or share the itinerary", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.itineraries.exportPdf()).rejects.toThrow();
    await expect(caller.itineraries.share()).rejects.toThrow();
  });

  it("lets signed-in visitors export their itinerary as a PDF buffer", async () => {
    const caller = appRouter.createCaller(createAuthContext("user"));
    const result = await caller.itineraries.exportPdf();
    expect(result.base64).toBeTruthy();
    expect(result.filename).toBe("KNMP-itinerary.pdf");
    const decoded = Buffer.from(result.base64, "base64").toString("utf8");
    expect(decoded.slice(0, 4)).toBe("%PDF");
  });

  it("generates a shareable link code for the owner's itinerary", async () => {
    const caller = appRouter.createCaller(createAuthContext("user"));
    const result = await caller.itineraries.share();
    expect(result.shareCode).toMatch(/^[A-Za-z0-9_-]{10}$/);
    expect(createItineraryShare).toHaveBeenCalled();
  });
});

describe("itineraries.byShareCode (public)", () => {
  it("is readable without authentication", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    vi.mocked(listItineraryByCode as () => unknown).mockResolvedValueOnce({
      userId: 7,
      items: [],
    } as never);
    const result = await caller.itineraries.byShareCode({ shareCode: "abc123" });
    expect(result).toEqual({ days: [], totalItems: 0 });
  });

  it("returns undefined for an invalid share code", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    vi.mocked(listItineraryByCode as () => unknown).mockResolvedValueOnce(undefined);
    const result = await caller.itineraries.byShareCode({ shareCode: "nope" });
    expect(result).toBeUndefined();
  });
});

describe("extended audit trail (attractions, categories, bookings)", () => {
  let actorId = 0;
  beforeEach(() => {
    vi.clearAllMocks();
    actorId += 1000;
  });

  function adminCtx(): TrpcContext {
    return createBaseContext({
      user: {
        id: actorId,
        openId: `admin-${actorId}`,
        email: `admin-${actorId}@example.com`,
        name: "Admin",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } as AuthenticatedUser,
    });
  }

  it("writes audit events when an attraction is created, updated and removed", async () => {
    const caller = appRouter.createCaller(adminCtx());
    vi.mocked(getAttractionById as () => unknown)
      .mockResolvedValueOnce({ id: 1, name: "Mausoleum" } as never)
      .mockResolvedValueOnce({ id: 1, name: "Mausoleum" } as never);
    await caller.attractions.create({
      name: "New Pavilion",
      description: "desc",
      isActive: true,
      sortIndex: 0,
    });
    await caller.attractions.update({ id: 1, name: "Mausoleum (Updated)" });
    await caller.attractions.remove({ id: 1 });
    const actions = vi.mocked(createAuditEvent as () => unknown).mock.calls.map(
      c => (c[0] as { action: string }).action,
    );
    expect(actions).toEqual(["attraction_created", "attraction_updated", "attraction_removed"]);
  });

  it("writes audit events when a visitor category is created, updated and removed", async () => {
    const caller = appRouter.createCaller(adminCtx());
    const getCategoryByIdMock = vi.fn(getCategoryById);
    const db = await import("./db");
    vi.mocked(db).getCategoryById = getCategoryByIdMock as never;
    getCategoryByIdMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 5, name: "Senior" } as never)
      .mockResolvedValueOnce({ id: 5, name: "Senior" } as never);
    await caller.categories.create({
      name: "Senior",
      pricePesewas: 800,
      isActive: true,
      sortIndex: 0,
    });
    await caller.categories.update({ id: 5, name: "Senior Citizen" });
    await caller.categories.remove({ id: 5 });
    const actions = vi.mocked(createAuditEvent as () => unknown).mock.calls.map(
      c => (c[0] as { action: string }).action,
    );
    expect(actions).toEqual(["category_created", "category_updated", "category_removed"]);
  });

  it("writes an audit event when a booking status changes", async () => {
    const caller = appRouter.createCaller(adminCtx());
    vi.mocked(getBookingById as () => unknown).mockResolvedValueOnce({
      id: 21,
      userId: 88,
      reference: "KNMP-ABC123",
      visitorName: "Ama",
      status: "pending",
    } as never);
    await caller.bookings.setStatus({ id: 21, status: "confirmed" });
    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "booking_status_changed",
        targetUserId: 88,
        detail: expect.stringContaining("confirmed"),
      }),
    );
  });

  it("blocks non-admins from writing attraction, category and booking audit entries", async () => {
    const caller = appRouter.createCaller(createAuthContext("user"));
    await expect(
      caller.attractions.create({ name: "x", description: "x", isActive: true, sortIndex: 0 }),
    ).rejects.toThrow();
    await expect(caller.bookings.setStatus({ id: 1, status: "confirmed" })).rejects.toThrow();
    expect(vi.mocked(createAuditEvent as () => unknown).mock.calls.length).toBe(0);
  });
});

describe("analytics date-range parameters", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes the visit-date range to the category breakdown", async () => {
    const caller = appRouter.createCaller(createAuthContext("admin"));
    const from = new Date(Date.UTC(2026, 5, 1));
    const to = new Date(Date.UTC(2026, 6, 1));
    await caller.analytics.categoryBreakdown({ from, to });
    expect(getCategoryBreakdown).toHaveBeenCalledWith({ from, to });
  });

  it("passes the range through to monthly trends alongside the month window", async () => {
    const caller = appRouter.createCaller(createAuthContext("admin"));
    const from = new Date(Date.UTC(2026, 0, 1));
    await caller.analytics.monthlyTrends({ months: 3, from });
    expect(getMonthlyTrends).toHaveBeenCalledWith(3, { months: 3, from });
  });

  it("defaults to full history when no range is supplied", async () => {
    const caller = appRouter.createCaller(createAuthContext("admin"));
    await caller.analytics.categoryBreakdown();
    expect(getCategoryBreakdown).toHaveBeenCalledWith(undefined);
    await caller.analytics.monthlyTrends();
    expect(getMonthlyTrends).toHaveBeenCalledWith(6, undefined);
  });
});
