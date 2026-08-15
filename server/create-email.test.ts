import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getVisitorCountForDate: vi.fn(async () => 120),
    getActiveCategoriesByIds: vi.fn(async () => [
      {
        id: 1,
        name: "Adults",
        description: null,
        pricePesewas: 2000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
    generateUniqueReference: vi.fn(async () => "KNMP-000001"),
    createBooking: vi.fn(async () => 1),
    createBookingItem: vi.fn(async () => 2),
    listActiveTourSlots: vi.fn(async () => []),
    getBookingItemsByBookingId: vi.fn(async (_bookingId: number) => [
      {
        id: 2,
        bookingId: _bookingId,
        categoryId: 1,
        categoryName: "Adults",
        unitPricePesewas: 2000,
        quantity: 2,
        subtotalPesewas: 4000,
      },
    ]),
    getBookingSlotsByBookingId: vi.fn(async () => []),
    getBookingById: vi.fn(async () => ({
      id: 7,
      reference: "KNMP-STATUS1",
      userId: 1,
      visitDate: tomorrow(),
      visitEndDate: null,
      visitorName: "Status Visitor",
      contactEmail: "status@example.com",
      contactPhone: null,
      totalPesewas: 2000,
      status: "pending",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    updateBookingStatus: vi.fn(async () => undefined),
    createAuditEvent: vi.fn(async () => undefined),
    listAllUsers: vi.fn(async () => [
      {
        id: 1,
        openId: "test-email-user",
        email: "tester@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: "user",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
    ]),
  };
});

vi.mock("./email", async importOriginal => {
  const actual = await importOriginal<typeof import("./email")>();
  return {
    ...actual,
    sendBookingConfirmationEmail: vi.fn(async () => ({
      sent: true,
      reason: "",
      messageId: "msg_test",
    })),
    sendBookingStatusEmail: vi.fn(async () => ({
      sent: true,
      reason: "",
      messageId: "msg_status_test",
    })),
  };
});

import {
  createBooking,
  createBookingItem,
  generateUniqueReference,
  getBookingItemsByBookingId,
  getBookingSlotsByBookingId,
  listActiveTourSlots,
  getActiveCategoriesByIds,
} from "./db";
import { sendBookingConfirmationEmail } from "./email";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-email-user",
      email: "tester@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as AuthenticatedUser,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

function tomorrow(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("bookings.create confirmation email", () => {
  it("triggers the confirmation email helper after a successful booking", async () => {
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.bookings.create({
      visitDate: tomorrow(),
      lines: [{ categoryId: 1, quantity: 2 }],
      contactEmail: "visitor@example.com",
    });

    expect(result.reference).toBe("KNMP-000001");

    // Give the fire-and-forget email task a tick to run.
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(sendBookingConfirmationEmail).toHaveBeenCalledTimes(1);
    const args = vi.mocked(sendBookingConfirmationEmail).mock.calls[0][0];
    expect(args.to).toBe("visitor@example.com");
    expect(args.booking.reference).toBe("KNMP-000001");
    expect(args.ticketData.totalVisitors).toBe(2);
    expect(args.ticketData.items).toHaveLength(1);
    expect(args.ticketData.reference).toBe("KNMP-000001");
  });

  it("falls back to the account email when no contact email is supplied", async () => {
    const caller = appRouter.createCaller(createAuthContext());

    await caller.bookings.create({
      visitDate: tomorrow(),
      lines: [{ categoryId: 1, quantity: 1 }],
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const args = vi.mocked(sendBookingConfirmationEmail).mock.calls[0][0];
    expect(args.to).toBe("tester@example.com");
  });

  it("does not attempt to send when no email address is available", async () => {
    const caller = appRouter.createCaller(
      createAuthContext(),
      // signed-out context (create checks ctx.user presence)
    );
    // Reuse the same context shape but without an email-capable user: pass a
    // user without email on the input side by clearing contactEmail — the
    // helper target resolves to ctx.user.email, so drop it entirely.
    const signedOutContext: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    };
    const anonCaller = appRouter.createCaller(signedOutContext);

    await expect(
      anonCaller.bookings.create({
        visitDate: tomorrow(),
        lines: [{ categoryId: 1, quantity: 1 }],
        contactEmail: undefined,
      }),
    ).rejects.toThrow();

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(sendBookingConfirmationEmail).not.toHaveBeenCalled();
  });

  it("still completes the booking when the email provider is down", async () => {
    vi.mocked(sendBookingConfirmationEmail).mockResolvedValueOnce({
      sent: false,
      reason: "Email provider error (500): provider outage",
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.bookings.create({
      visitDate: tomorrow(),
      lines: [{ categoryId: 1, quantity: 1 }],
      contactEmail: "visitor@example.com",
    });

    expect(result.reference).toBe("KNMP-000001");
    expect(vi.mocked(createBooking)).toHaveBeenCalled();
    expect(vi.mocked(createBookingItem)).toHaveBeenCalled();
    expect(vi.mocked(generateUniqueReference)).toHaveBeenCalled();
    expect(vi.mocked(getBookingItemsByBookingId)).toHaveBeenCalled();
    expect(vi.mocked(listActiveTourSlots)).toHaveBeenCalled();
  });
});

import {
  getVisitorCountForDate,
  getBookingById,
  updateBookingStatus,
  createAuditEvent,
  listAllUsers,
  getBookingItemsByBookingId as getItemsForStatus,
} from "./db";
import { sendBookingStatusEmail } from "./email";

describe("bookings.setStatus confirmation/cancellation email", () => {
  beforeEach(() => {
    vi.mocked(getBookingById).mockReset();
    vi.mocked(listAllUsers).mockReset();
    vi.mocked(getItemsForStatus).mockReset();
    vi.mocked(updateBookingStatus).mockReset();
    vi.mocked(createAuditEvent).mockReset();
    vi.mocked(getActiveCategoriesByIds).mockReset();
    vi.mocked(getVisitorCountForDate).mockReset();
    vi.mocked(sendBookingStatusEmail).mockReset();
    // Default booking returned by getBookingById.
    vi.mocked(getBookingById).mockResolvedValue({
      id: 7,
      reference: "KNMP-STATUS1",
      userId: 1,
      visitDate: tomorrow(),
      visitEndDate: null,
      visitorName: "Status Visitor",
      contactEmail: "status@example.com",
      contactPhone: null,
      totalPesewas: 2000,
      status: "pending",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // Default user list — mockReset would clear the module-level default.
    vi.mocked(listAllUsers).mockResolvedValue([
      {
        id: 1,
        openId: "test-email-user",
        email: "tester@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: "user",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
    ]);
    vi.mocked(getBookingItemsByBookingId).mockResolvedValue([
      {
        id: 8,
        bookingId: 7,
        categoryId: 1,
        categoryName: "Adults",
        unitPricePesewas: 2000,
        quantity: 2,
        subtotalPesewas: 4000,
      },
    ]);
    vi.mocked(getVisitorCountForDate).mockResolvedValue(120);
  });

  it("emails the visitor when the booking is confirmed", async () => {
    const caller = appRouter.createCaller(adminContext());

    await caller.bookings.setStatus({ id: 7, status: "confirmed" });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(sendBookingStatusEmail).toHaveBeenCalledTimes(1);
    const args = vi.mocked(sendBookingStatusEmail).mock.calls[0][0];
    expect(args.to).toBe("status@example.com");
    expect(args.booking.reference).toBe("KNMP-STATUS1");
    expect(args.previousStatus).toBe("pending");
    expect(args.newStatus).toBe("confirmed");
    expect(args.booking.totalVisitors).toBe(2);
    expect(updateBookingStatus).toHaveBeenCalledWith(7, "confirmed");
    expect(createAuditEvent).toHaveBeenCalled();
  });

  it("emails the visitor when the booking is cancelled", async () => {
    const caller = appRouter.createCaller(adminContext());

    await caller.bookings.setStatus({ id: 7, status: "cancelled" });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(sendBookingStatusEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendBookingStatusEmail).mock.calls[0][0].newStatus).toBe("cancelled");
  });

  it("does not email when the status stays the same", async () => {
    const caller = appRouter.createCaller(adminContext());

    await caller.bookings.setStatus({ id: 7, status: "pending" });

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(sendBookingStatusEmail).not.toHaveBeenCalled();
  });

  it("falls back to the account email when the booking has no contact email", async () => {
    vi.mocked(getBookingById).mockResolvedValue({
      id: 7,
      reference: "KNMP-STATUS1",
      userId: 1,
      visitDate: tomorrow(),
      visitEndDate: null,
      visitorName: "Status Visitor",
      contactEmail: null,
      contactPhone: null,
      totalPesewas: 2000,
      status: "pending",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = appRouter.createCaller(adminContext());
    await caller.bookings.setStatus({ id: 7, status: "confirmed" });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(sendBookingStatusEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendBookingStatusEmail).mock.calls[0][0].to).toBe("tester@example.com");
  });

  it("never blocks the status update when the email provider fails", async () => {
    vi.mocked(sendBookingStatusEmail).mockRejectedValueOnce(new Error("provider down"));

    const caller = appRouter.createCaller(adminContext());
    const result = await caller.bookings.setStatus({ id: 7, status: "confirmed" });

    expect(result.success).toBe(true);
    expect(updateBookingStatus).toHaveBeenCalledWith(7, "confirmed");
  });
});

describe("bookings.capacityCheck public capacity query", () => {
  it("returns the projection for the selected date", async () => {
    vi.mocked(getVisitorCountForDate).mockResolvedValueOnce(120);
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    });

    const result = await caller.bookings.capacityCheck({ date: tomorrow() });

    expect(result?.projectedVisitors).toBe(120);
    expect(result?.capacity).toBe(500);
    expect(result?.isOver).toBe(false);
    expect(result?.isNear).toBe(false);
    expect(getVisitorCountForDate).toHaveBeenCalledTimes(1);
  });

  it("flags dates already at or above capacity", async () => {
    vi.mocked(getVisitorCountForDate).mockResolvedValueOnce(520);
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    });

    const result = await caller.bookings.capacityCheck({ date: tomorrow() });

    expect(result?.isOver).toBe(true);
    expect(result?.isNear).toBe(true);
  });

  it("flags dates above the 75% near-capacity threshold", async () => {
    vi.mocked(getVisitorCountForDate).mockResolvedValueOnce(400);
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    });

    const result = await caller.bookings.capacityCheck({ date: tomorrow() });

    expect(result?.isOver).toBe(false);
    expect(result?.isNear).toBe(true);
  });

  it("returns null for past dates", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    });

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const result = await caller.bookings.capacityCheck({ date: yesterday });

    expect(result).toBeNull();
    expect(getVisitorCountForDate).not.toHaveBeenCalled();
  });
});

function adminContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "admin-status-user",
      email: "admin@example.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as AuthenticatedUser,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}
