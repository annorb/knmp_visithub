import { describe, expect, it, vi } from "vitest";

// NOTE: vi.mock factories are hoisted to the top of the file, so the mock
// data is produced by plain functions (never by outer-scope variables).
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    listAllEvents: async () => listAllTestEvents(),
    listPublishedEvents: async () => listAllTestEvents().filter(e => e.isPublished),
    listEventsMonth: async (year: number, month: number) =>
      listAllTestEvents().filter(
        e =>
          e.eventDate.getUTCFullYear() === year &&
          e.eventDate.getUTCMonth() + 1 === month,
      ),
    listUpcomingEvents: async () =>
      listAllTestEvents()
        .filter(e => e.isPublished && e.eventDate > new Date("2026-08-10T00:00:00Z"))
        .slice(0, 12),
    getEventById: async (id: number) =>
      listAllTestEvents().find(e => e.id === id) ?? null,
    countRegistrationsByEventId: async (eventId: number) =>
      listTestRegistrations().filter(r => r.eventId === eventId && !r.isCancelled).reduce(
        (sum, r) => sum + r.numberOfParticipants,
        0,
      ),
    createEventRegistration: async (data: Record<string, unknown>) => data,
    getRegistrationsByEventId: async (eventId: number) =>
      listTestRegistrations().filter(r => r.eventId === eventId),
    getMyRegistrations: async () => listTestRegistrations(),
    createEvent: async (data: Record<string, unknown>) => ({
      id: 99,
      ...data,
    }),
    createAuditEvent: async () => undefined,
    generateUniqueReference: async () => "EVT-998877",
    sendEventRegistrationEmail: async () => undefined,
  };
});

vi.mock("./email", () => ({
  sendEventRegistrationEmail: async () => undefined,
}));

function listAllTestEvents() {
  return [
    {
      id: 1,
      title: "Weekend Gardens & Library Walk",
      slug: "weekend-gardens-library-walk",
      description: "A relaxed guided stroll through the pool gardens.",
      eventType: "guided_tour",
      attractionId: 2,
      eventDate: new Date("2026-08-18T00:00:00Z"),
      startTime: "08:30",
      endTime: "09:30",
      meetingPoint: "Main gate",
      guideName: "Mr. Mensah",
      imageUrl: null,
      capacity: 20,
      feePesewas: 0,
      registrationDeadline: null,
      isPublished: true,
      sortIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      title: "Independence Day Special Program",
      slug: "independence-day-special-program",
      description: "Wreath-laying, live drumming, and readings.",
      eventType: "program",
      attractionId: null,
      eventDate: new Date("2026-08-27T00:00:00Z"),
      startTime: "09:00",
      endTime: "12:00",
      meetingPoint: null,
      guideName: null,
      imageUrl: null,
      capacity: 0,
      feePesewas: 0,
      registrationDeadline: null,
      isPublished: true,
      sortIndex: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 3,
      title: "Draft Future Heritage Tour",
      slug: "draft-future-heritage-tour",
      description: "Not yet published.",
      eventType: "guided_tour",
      attractionId: 1,
      eventDate: new Date("2026-09-05T00:00:00Z"),
      startTime: null,
      endTime: null,
      meetingPoint: null,
      guideName: null,
      imageUrl: null,
      capacity: 15,
      feePesewas: 1500,
      registrationDeadline: new Date("2026-09-04T00:00:00Z"),
      isPublished: false,
      sortIndex: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
}

function listTestRegistrations() {
  return [
    {
      id: 1,
      reference: "EVT-112233",
      eventId: 1,
      userId: 7,
      attendeeName: "Kwame Boateng",
      contactEmail: "kwame@example.com",
      numberOfParticipants: 3,
      isCancelled: false,
      createdAt: new Date(),
    },
  ];
}

/**
 * Round 9 regression tests (offline-safe mocks):
 * - public calendar lists published events and excludes drafts
 * - month query returns events falling in the requested month
 * - direct registration is allowed for guided tours with capacity checks
 * - direct registration is rejected for special programs
 */
const ctx: any = {
  user: {
    id: 7,
    openId: "o1",
    name: "Kwame Boateng",
    email: "kwame@example.com",
    role: "user",
    isActive: true,
  },
};

import { appRouter } from "./routers";

function createCaller() {
  return appRouter.createCaller(ctx as any);
}

describe("Round 9 — events calendar", () => {
  it("public upcoming list excludes draft events", async () => {
    const caller = createCaller();
    const upcoming = await caller.events.upcoming();
    const ids = upcoming.map((e: any) => e.id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).not.toContain(3);
  });

  it("public month query returns events in the requested month", async () => {
    const caller = createCaller();
    const month = await caller.events.listMonth({ year: 2026, month: 8 });
    expect(month.length).toBe(2);
    const empty = await caller.events.listMonth({ year: 2026, month: 12 });
    expect(empty.length).toBe(0);
  });

  it("visitor can register for a guided tour and receives a reference", async () => {
    const caller = createCaller();
    const result = await caller.events.register({
      eventId: 1,
      attendeeName: "Kwame Boateng",
      contactEmail: "kwame@example.com",
      numberOfParticipants: 3,
    });
    expect(result.reference).toBe("EVT-998877");
  });

  it("registration fails when the party exceeds remaining capacity", async () => {
    const caller = createCaller();
    await expect(
      caller.events.register({
        eventId: 1,
        attendeeName: "Kwame Boateng",
        numberOfParticipants: 30,
      }),
    ).rejects.toThrow(/Not enough places/);
  });

  it("direct registration is rejected for special programs", async () => {
    const caller = createCaller();
    await expect(
      caller.events.register({
        eventId: 2,
        attendeeName: "Kwame Boateng",
        numberOfParticipants: 2,
      }),
    ).rejects.toThrow(/only available for guided tours/i);
  });

  it("draft events are hidden from the public details endpoint", async () => {
    const caller = createCaller();
    await expect(caller.events.details({ id: 3 })).rejects.toThrow();
    const published = await caller.events.details({ id: 1 });
    expect(published.event.title).toBe("Weekend Gardens & Library Walk");
    expect(published.remainingPlaces).toBe(20 - 3);
  });

  it("my registrations lists the visitor's own registration", async () => {
    const caller = createCaller();
    const mine = await caller.events.myRegistrations();
    expect(mine.length).toBe(1);
    expect(mine[0].event?.id).toBe(1);
  });
});
