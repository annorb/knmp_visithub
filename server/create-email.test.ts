import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
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
