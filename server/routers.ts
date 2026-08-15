import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { DEFAULT_DAILY_CAPACITY, DEFAULT_NEAR_CAPACITY_THRESHOLD } from "../drizzle/schema";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  cancelOwnBooking,
  createAttraction,
  createBooking,
  createBookingItem,
  createBookingSlot,
  createCategory,
  checkInBooking,
  undoCheckInBooking,
  listSiteSettings,
  updateSiteSetting,
  SETTING_DAILY_CAPACITY,
  SETTING_NEAR_CAPACITY_THRESHOLD,
  getBookingByReference,
  createUser,
  createItineraryItem,
  deleteAttraction,
  deleteCategory,
  deleteItineraryItem,
  generateUniqueReference,
  getActiveCategoriesByIds,
  getAttractionById,
  getAttractionBySlug,
  getBookingById,
  getBookingItemsByBookingId,
  getBookingSlotsByBookingId,
  getBookingStats,
  getCategoryBreakdown,
  getCategoryBreakdownCsv,
  getDailyVisitorForecast,
  getVisitorCountForDate,
  getDailyCapacity,
  getNearCapacityThreshold,
  getMonthlyTrends,
  getMyBookings,
  getUpcomingMyBookings,
  listActiveAttractions,
  listActiveCategories,
  listAllAttractions,
  listAllBookings,
  listAllCategories,
  listActiveTourSlots,
  listAllUsers,
  listItineraryByDate,
  setUserActive,
  updateUserRole,
  listMyItinerary,
  reorderItineraryItem,
  createAuditEvent,
  createItineraryShare,
  listItineraryByCode,
  getCategoryById,
  listAttractionFacets,
  listAuditEvents,
  searchAttractions,
  searchAttractionsFiltered,
  updateAttraction,
  updateBookingStatus,
  updateCategory,
  updateItineraryItem,
} from "./db";
import { buildTicketPdfBuffer, type TicketData } from "./ticketPdf";
import { sendBookingConfirmationEmail, sendBookingStatusEmail } from "./email";
import { buildItineraryPdfBuffer, isoDate, type ItineraryPdfData, type ItineraryRow } from "./itineraryPdf";
import { nanoid } from "nanoid";
import type { InsertAttraction, InsertVisitorCategory } from "../drizzle/schema";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const dateOnly = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  attractions: router({
    list: publicProcedure.query(() => listActiveAttractions()),
    search: publicProcedure
      .input(z.object({ query: z.string().min(1).max(200) }))
      .query(({ input }) => searchAttractions(input.query)),
    /** Filtered browsing: combined search + category + location facets. */
    searchFiltered: publicProcedure
      .input(
        z.object({
          query: z.string().max(200).optional(),
          category: z.string().max(100).optional(),
          location: z.string().max(200).optional(),
        }),
      )
      .query(({ input }) => searchAttractionsFiltered(input)),
    facets: publicProcedure.query(() => listAttractionFacets()),
    bySlug: publicProcedure
      .input(z.object({ slug: z.string().max(200) }))
      .query(async ({ input }) => {
        const a = await getAttractionBySlug(input.slug);
        if (!a) return undefined;
        return a;
      }),

    // Admin endpoints
    listAll: adminProcedure.query(() => listAllAttractions()),
    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1).max(200),
          description: z.string().min(1),
          imageUrl: z.string().max(2000).optional().nullable(),
          openingHours: z.string().max(200).optional().nullable(),
          location: z.string().max(200).optional().nullable(),
          averageVisitDurationMin: z.number().int().min(5).max(720).default(30),
          sortIndex: z.number().int().default(0),
          isActive: z.boolean().default(true),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const slug = slugify(input.name);
        const created = await createAttraction({ ...input, slug });
        await createAuditEvent({
          actorId: ctx.user.id,
          actorName: ctx.user.name ?? ctx.user.email ?? null,
          action: "attraction_created",
          targetUserId: null,
          targetName: input.name,
          detail: `Attraction created: ${input.name}${input.location ? ` (${input.location})` : ""}`,
        });
        return created;
      }),
    update: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().min(1).max(200).optional(),
          description: z.string().min(1).optional(),
          imageUrl: z.string().max(2000).nullable().optional(),
          openingHours: z.string().max(200).nullable().optional(),
          location: z.string().max(200).nullable().optional(),
          averageVisitDurationMin: z.number().int().min(5).max(720).optional(),
          sortIndex: z.number().int().optional(),
          isActive: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const payload: Partial<InsertAttraction> = { ...data };
        if (data.name) payload.slug = slugify(data.name);
        const before = await getAttractionById(id);
        await updateAttraction(id, payload);
        await createAuditEvent({
          actorId: ctx.user.id,
          actorName: ctx.user.name ?? ctx.user.email ?? null,
          action: "attraction_updated",
          targetUserId: null,
          targetName: before?.name ?? input.name ?? null,
          detail: `Attraction updated${before ? `: ${before.name}` : ""}`,
        });
        return { success: true } as const;
      }),
    remove: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const before = await getAttractionById(input.id);
        await deleteAttraction(input.id);
        await createAuditEvent({
          actorId: ctx.user.id,
          actorName: ctx.user.name ?? ctx.user.email ?? null,
          action: "attraction_removed",
          targetUserId: null,
          targetName: before?.name ?? null,
          detail: `Attraction removed${before ? `: ${before.name}` : ""}`,
        });
        return { success: true } as const;
      }),
  }),

  categories: router({
    list: publicProcedure.query(() => listActiveCategories()),

    // Admin endpoints
    listAll: adminProcedure.query(() => listAllCategories()),
    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          description: z.string().max(500).optional().nullable(),
          pricePesewas: z.number().int().min(0).max(100_000_00),
          sortIndex: z.number().int().default(0),
          isActive: z.boolean().default(true),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const slug = slugify(input.name);
        const created = await createCategory({ ...input, slug });
        await createAuditEvent({
          actorId: ctx.user.id,
          actorName: ctx.user.name ?? ctx.user.email ?? null,
          action: "category_created",
          targetUserId: null,
          targetName: input.name,
          detail: `Visitor category created: ${input.name} at GHS ${(input.pricePesewas / 100).toFixed(2)}`,
        });
        return created;
      }),
    update: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().min(1).max(100).optional(),
          description: z.string().max(500).nullable().optional(),
          pricePesewas: z.number().int().min(0).max(100_000_00).optional(),
          sortIndex: z.number().int().optional(),
          isActive: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const payload: Partial<InsertVisitorCategory> = { ...data };
        if (data.name) payload.slug = slugify(data.name);
        const before = await getCategoryById(id);
        await updateCategory(id, payload);
        await createAuditEvent({
          actorId: ctx.user.id,
          actorName: ctx.user.name ?? ctx.user.email ?? null,
          action: "category_updated",
          targetUserId: null,
          targetName: before?.name ?? input.name ?? null,
          detail: `Visitor category updated${before ? `: ${before.name}` : ""}`,
        });
        return { success: true } as const;
      }),
    remove: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const before = await getCategoryById(input.id);
        await deleteCategory(input.id);
        await createAuditEvent({
          actorId: ctx.user.id,
          actorName: ctx.user.name ?? ctx.user.email ?? null,
          action: "category_removed",
          targetUserId: null,
          targetName: before?.name ?? null,
          detail: `Visitor category removed${before ? `: ${before.name}` : ""}`,
        });
        return { success: true } as const;
      }),
  }),

  bookings: router({
    /** Projected park occupancy for a single date, for the public capacity warning. */
    capacityCheck: publicProcedure
      .input(z.object({ date: z.date() }))
      .query(async ({ input }) => {
        const date = dateOnly(input.date);
        const now = dateOnly(new Date());
        if (date < now) return null;
        const [projectedVisitors, capacity, nearThreshold] = await Promise.all([
          getVisitorCountForDate(date),
          getDailyCapacity(),
          getNearCapacityThreshold(),
        ]);
        const utilization = capacity > 0 ? projectedVisitors / capacity : 0;
        return {
          date,
          projectedVisitors,
          capacity,
          nearThreshold,
          isOver: utilization >= 1,
          /** Warning threshold: the date is at/above the configured near-capacity threshold. */
          isNear: utilization >= nearThreshold,
          utilization,
        } as const;
      }),

    calculateCost: publicProcedure
      .input(
        z.object({
          lines: z.array(
            z.object({ categoryId: z.number().int().positive(), quantity: z.number().int().min(1).max(100) }),
          ),
        }),
      )
      .mutation(async ({ input }) => {
        if (input.lines.length === 0) {
          throw new Error("At least one visitor category with quantity is required");
        }
        const ids = input.lines.map(l => l.categoryId);
        const categories = await getActiveCategoriesByIds(ids);
        if (categories.length !== new Set(ids).size) {
          throw new Error("One or more selected visitor categories are invalid or inactive");
        }
        const catMap = new Map(categories.map(c => [c.id, c]));
        const items = input.lines.map(line => {
          const cat = catMap.get(line.categoryId)!;
          const subtotal = cat.pricePesewas * line.quantity;
          return { categoryId: cat.id, categoryName: cat.name, unitPricePesewas: cat.pricePesewas, quantity: line.quantity, subtotalPesewas: subtotal };
        });
        const totalPesewas = items.reduce((sum, i) => sum + i.subtotalPesewas, 0);
        const totalVisitors = items.reduce((sum, i) => sum + i.quantity, 0);
        return { items, totalPesewas, totalVisitors };
      }),

    create: publicProcedure
      .input(
        z.object({
          visitDate: z.date(),
          visitEndDate: z.date().optional(),
          lines: z.array(
            z.object({ categoryId: z.number().int().positive(), quantity: z.number().int().min(1).max(100) }),
          ),
          slotIds: z.array(z.number().int().positive()).max(20).optional(),
          visitorName: z.string().max(200).optional(),
          contactEmail: z.string().email().max(320).optional(),
          contactPhone: z.string().max(64).optional(),
          notes: z.string().max(2000).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new Error("You must be signed in to make a booking");
        if (input.lines.length === 0) {
          throw new Error("At least one visitor category with quantity is required");
        }
        const now = new Date();
        const visit = input.visitDate;
        if (dateOnly(visit) < dateOnly(now)) {
          throw new Error("The visit date must be today or later");
        }
        const endDate = input.visitEndDate ? dateOnly(input.visitEndDate) : undefined;
        if (endDate && endDate < dateOnly(visit)) {
          throw new Error("The end date must not be earlier than the start date");
        }
        if (endDate && endDate.getTime() - dateOnly(visit).getTime() > 30 * 24 * 60 * 60 * 1000) {
          throw new Error("A single booking may not span more than 30 days");
        }
        const ids = input.lines.map(l => l.categoryId);
        const categories = await getActiveCategoriesByIds(ids);
        if (categories.length !== new Set(ids).size) {
          throw new Error("One or more selected visitor categories are invalid or inactive");
        }
        const catMap = new Map(categories.map(c => [c.id, c]));
        const items = input.lines.map(line => {
          const cat = catMap.get(line.categoryId)!;
          return { categoryId: cat.id, categoryName: cat.name, unitPricePesewas: cat.pricePesewas, quantity: line.quantity, subtotalPesewas: cat.pricePesewas * line.quantity };
        });
        const totalPesewas = items.reduce((sum, i) => sum + i.subtotalPesewas, 0);
        const reference = await generateUniqueReference();
        const bookingId = await createBooking({
          userId: ctx.user.id,
          reference,
          visitDate: dateOnly(input.visitDate),
          visitEndDate: endDate ?? null,
          visitorName: input.visitorName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          totalPesewas,
          status: "confirmed",
          notes: input.notes,
        });
        for (const item of items) {
          await createBookingItem({ bookingId, ...item });
        }
        if (input.slotIds && input.slotIds.length > 0) {
          const allSlots = await listActiveTourSlots();
          const slotMap = new Map(allSlots.map(s => [s.id, s]));
          for (const slotId of input.slotIds) {
            const slot = slotMap.get(slotId);
            if (!slot) throw new Error(`Tour slot ${slotId} is no longer available`);
            const attraction = await getAttractionById(slot.attractionId);
            await createBookingSlot({
              bookingId,
              slotId,
              attractionId: slot.attractionId,
              attractionName: attraction?.name,
              visitDate: dateOnly(input.visitDate),
            });
          }
        }
        // Fire-and-forget confirmation email with the PDF ticket attached;
        // failure never blocks a completed booking.
        void (async () => {
          try {
            const emailTarget = input.contactEmail ?? ctx.user?.email ?? null;
            if (!emailTarget) return;
            const [items, slots, allSlots] = await Promise.all([
              getBookingItemsByBookingId(bookingId),
              getBookingSlotsByBookingId(bookingId),
              listActiveTourSlots(),
            ]);
            const labelMap = new Map(allSlots.map(s => [`${s.attractionId}-${s.startTime}`, s.label ?? ""]));
            const ticketData: TicketData = {
              reference,
              visitorName: input.visitorName ?? null,
              contactEmail: emailTarget,
              contactPhone: input.contactPhone ?? null,
              visitDate: dateOnly(input.visitDate),
              visitEndDate: endDate ?? null,
              totalPesewas,
              totalVisitors: items.reduce((sum, i) => sum + i.quantity, 0),
              status: "confirmed",
              items,
              slots: slots.map(s => ({
                attractionId: s.attractionId,
                attractionName: s.attractionName,
                startTime: allSlots.find(a => a.id === s.slotId)?.startTime ?? "",
                endTime: allSlots.find(a => a.id === s.slotId)?.endTime ?? "",
                label: allSlots.find(a => a.id === s.slotId)?.label,
                visitDate: s.visitDate,
              })),
            };
            const emailResult = await sendBookingConfirmationEmail({
              to: emailTarget,
              recipientName: ctx.user?.name ?? null,
              booking: {
                reference,
                visitDate: dateOnly(input.visitDate),
                visitEndDate: endDate ?? null,
                totalPesewas,
                totalVisitors: items.reduce((sum, i) => sum + i.quantity, 0),
              },
              ticketData,
              slotLabels: labelMap,
              siteBaseUrl: "https://knmp-visithub.manus.space",
            });
            if (!emailResult.sent && emailResult.reason) {
              console.warn(`[Email] Confirmation not sent for ${reference}: ${emailResult.reason}`);
            }
          } catch (error) {
            // Email failure is non-fatal; the booking and PDF download still stand.
            console.warn(`[Email] Confirmation step failed for ${reference}:`, error);
          }
        })();
        return { id: bookingId, reference };
      }),

    myBookings: protectedProcedure.query(({ ctx }) => getMyBookings(ctx.user.id)),
    myUpcomingBookings: protectedProcedure.query(({ ctx }) => getUpcomingMyBookings(ctx.user.id)),
    myBookingsDetail: protectedProcedure.query(async ({ ctx }) => {
      const list = await getMyBookings(ctx.user.id);
      const details = await Promise.all(
        list.map(async booking => {
          const items = await getBookingItemsByBookingId(booking.id);
          return { booking, items };
        }),
      );
      return details;
    }),

    detail: publicProcedure
      .input(z.object({ reference: z.string().min(5).max(32) }))
      .query(async ({ input }) => {
        const booking = await getBookingById(Number(input.reference.split("-")[1]) || 0);
        return booking ?? undefined;
      }),

    /** Look up a booking with its line items by booking id (owner only). */
    mineById: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const booking = await getBookingById(input.id);
        if (!booking) return undefined;
        if (booking.userId !== ctx.user.id) return undefined;
        const items = await getBookingItemsByBookingId(booking.id);
        const slots = await getBookingSlotsByBookingId(booking.id);
        return { booking, items, slots };
      }),

    cancel: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await cancelOwnBooking(input.id, ctx.user.id);
        return { success: true } as const;
      }),

    // Admin endpoints
    listAll: adminProcedure.query(() => listAllBookings()),
    byId: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const booking = await getBookingById(input.id);
        if (!booking) return undefined;
        const items = await getBookingItemsByBookingId(booking.id);
        const slots = await getBookingSlotsByBookingId(booking.id);
        return { booking, items, slots };
      }),
    setStatus: adminProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["pending", "confirmed", "cancelled"]) }))
      .mutation(async ({ ctx, input }) => {
        const before = await getBookingById(input.id);
        await updateBookingStatus(input.id, input.status);
        await createAuditEvent({
          actorId: ctx.user.id,
          actorName: ctx.user.name ?? ctx.user.email ?? null,
          action: "booking_status_changed",
          targetUserId: before?.userId ?? null,
          targetName: before?.visitorName ?? before?.reference ?? null,
          detail: `Booking ${before?.reference ?? input.id} status changed from ${before?.status ?? "?"} to ${input.status}`,
        });

        // Notify the visitor by email when the booking is confirmed or cancelled.
        // Kept fire-and-forget and non-fatal: the status update and audit trail
        // always stand regardless of whether the email reaches the provider.
        if (before && (input.status === "confirmed" || input.status === "cancelled") && before.status !== input.status) {
          // Resolve the visitor's email: contact email on the booking first,
          // then the account email of the user who made the booking.
          const items = await getBookingItemsByBookingId(before.id);
          const accountUser = before.userId
            ? (await listAllUsers()).find(u => u.id === before.userId)
            : undefined;
          const contactEmail = before.contactEmail || accountUser?.email;
          const totalVisitors = items.reduce((sum, i) => sum + i.quantity, 0);
          void (async () => {
            try {
              const emailResult = await sendBookingStatusEmail({
                to: contactEmail ?? "",
                recipientName: before.visitorName ?? accountUser?.name ?? null,
                booking: {
                  reference: before.reference,
                  visitDate: before.visitDate,
                  visitEndDate: before.visitEndDate ?? null,
                  totalPesewas: before.totalPesewas,
                  totalVisitors,
                },
                previousStatus: before.status,
                newStatus: input.status,
                siteBaseUrl: "https://knmp-visithub.manus.space",
              });
              if (!emailResult.sent && emailResult.reason) {
                console.warn(`[Email] Status notification not sent for ${before.reference}: ${emailResult.reason}`);
              }
            } catch (error) {
              console.warn(`[Email] Status notification step failed for ${before.reference}:`, error);
            }
          })();
        }
        return { success: true } as const;
      }),
    stats: adminProcedure.query(() => getBookingStats()),
  }),

  /** Admin user management: view users, change roles, activate/deactivate. */
  users: router({
    listAll: adminProcedure.query(() => listAllUsers()),
    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1).max(200),
          email: z.string().email().max(320),
          role: z.enum(["user", "admin"]).default("user"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const created = await createUser({ name: input.name, email: input.email, role: input.role });
        if (!created) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A user with that email address already exists",
          });
        }
        await createAuditEvent({
          actorId: ctx.user.id,
          actorName: ctx.user.name ?? ctx.user.email ?? null,
          action: "user_created",
          targetUserId: created.id,
          targetName: created.name ?? created.email ?? null,
          detail: `Account created${input.role !== "user" ? ` with role ${input.role}` : ""} by administrator`,
        });
        return { success: true, user: created } as const;
      }),
    updateRole: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), role: z.enum(["user", "admin"]) }))
      .mutation(async ({ ctx, input }) => {
        await updateUserRole(input.userId, input.role, ctx.user.id);
        const target = (await listAllUsers()).find(u => u.id === input.userId);
        await createAuditEvent({
          actorId: ctx.user.id,
          actorName: ctx.user.name ?? ctx.user.email ?? null,
          action: "role_change",
          targetUserId: input.userId,
          targetName: target?.name ?? target?.email ?? null,
          detail: `Role changed to ${input.role}.`,
        });
        return { success: true } as const;
      }),
    setActivation: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await setUserActive(input.userId, input.isActive);
        const target = (await listAllUsers()).find(u => u.id === input.userId);
        await createAuditEvent({
          actorId: ctx.user.id,
          actorName: ctx.user.name ?? ctx.user.email ?? null,
          action: input.isActive ? "account_reactivated" : "account_deactivated",
          targetUserId: input.userId,
          targetName: target?.name ?? target?.email ?? null,
          detail: input.isActive
            ? "Account reactivated by administrator."
            : "Account deactivated by administrator.",
        });
        return { success: true } as const;
      }),
  }),

  /** Admin audit trail of sensitive actions. */
  audit: router({
    list: adminProcedure.query(() => listAuditEvents()),
  }),

  /** Site-wide settings: daily capacity and warning thresholds. */
  settings: router({
    list: adminProcedure.query(async () => {
      const [rows, capacity, nearThreshold] = await Promise.all([
        listSiteSettings(),
        getDailyCapacity(),
        getNearCapacityThreshold(),
      ]);
      return { settings: rows, capacity, nearThreshold };
    }),
    update: adminProcedure
      .input(
        z.object({
          capacity: z.number().int().min(10).max(100_000).optional(),
          nearThreshold: z.number().min(0.1).max(0.99).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (input.capacity !== undefined) {
          await updateSiteSetting(
            SETTING_DAILY_CAPACITY,
            String(input.capacity),
            "Reference daily visitor capacity used for the forecast chart and booking-form warnings",
          );
        }
        if (input.nearThreshold !== undefined) {
          await updateSiteSetting(
            SETTING_NEAR_CAPACITY_THRESHOLD,
            String(input.nearThreshold),
            "Fraction of capacity that triggers the near-capacity warning on the booking form (0–1)",
          );
        }
        await createAuditEvent({
          actorId: ctx.user.id,
          actorName: ctx.user.name ?? ctx.user.email ?? null,
          action: "settings_changed",
          targetUserId: null,
          targetName: null,
          detail: `Site settings updated: ${JSON.stringify(input)}`,
        });
        const [, capacity, nearThreshold] = await Promise.all([
          null,
          getDailyCapacity(),
          getNearCapacityThreshold(),
        ]);
        return { success: true, capacity, nearThreshold } as const;
      }),
  }),

  /**
   * Gate check-in: staff mark a visitor's party as checked in (or undo it).
   * Looked up by booking reference so a scanned QR code resolves directly.
   */
  gate: router({
    lookupByReference: adminProcedure
      .input(z.object({ reference: z.string().min(4).max(32) }))
      .query(async ({ input }) => {
        const raw = await getBookingByReference(input.reference.toUpperCase());
        if (!raw) return { booking: null, items: [] };
        const { items, ...booking } = raw;
        return { booking, items };
      }),
    checkIn: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const booking = await getBookingById(input.id);
        if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
        if (booking.status === "cancelled") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cancelled bookings cannot be checked in" });
        }
        const checkInAt = await checkInBooking(input.id);
        await createAuditEvent({
          actorId: ctx.user.id,
          actorName: ctx.user.name ?? ctx.user.email ?? null,
          action: "booking_checked_in",
          targetUserId: booking.userId ?? null,
          targetName: booking.visitorName ?? booking.reference ?? null,
          detail: `Visitor party for ${booking.reference} checked in at the gate`,
        });
        return { success: true, checkInAt } as const;
      }),
    undoCheckIn: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const booking = await getBookingById(input.id);
        if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
        await undoCheckInBooking(input.id);
        await createAuditEvent({
          actorId: ctx.user.id,
          actorName: ctx.user.name ?? ctx.user.email ?? null,
          action: "booking_checkin_undone",
          targetUserId: booking.userId ?? null,
          targetName: booking.visitorName ?? booking.reference ?? null,
          detail: `Gate check-in for ${booking.reference} was undone`,
        });
        return { success: true } as const;
      }),
  }),

  /** Public guided-tour time slots per attraction. */
  tours: router({
    list: publicProcedure.query(() => listActiveTourSlots()),
  }),

  /** PDF entry ticket for a booking (owner or admin access). */
  ticket: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await getBookingById(input.id);
      if (!booking) throw new Error("Booking not found");
      if (booking.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new Error("You can only download tickets for your own bookings");
      }
      const [items, slots, allSlots] = await Promise.all([
        getBookingItemsByBookingId(booking.id),
        getBookingSlotsByBookingId(booking.id),
        listActiveTourSlots(),
      ]);
      const labelMap = new Map(allSlots.map(s => [`${s.attractionId}-${s.startTime}`, s.label ?? ""]));
      const data: TicketData = {
        reference: booking.reference,
        visitorName: booking.visitorName,
        contactEmail: booking.contactEmail,
        contactPhone: booking.contactPhone,
        visitDate: booking.visitDate,
        visitEndDate: booking.visitEndDate,
        totalPesewas: booking.totalPesewas,
        totalVisitors: items.reduce((sum, i) => sum + i.quantity, 0),
        status: booking.status,
        items,
        slots: slots.map(s => ({
          attractionId: s.attractionId,
          attractionName: s.attractionName,
          startTime: allSlots.find(a => a.id === s.slotId)?.startTime ?? "",
          endTime: allSlots.find(a => a.id === s.slotId)?.endTime ?? "",
          label: allSlots.find(a => a.id === s.slotId)?.label,
          visitDate: s.visitDate,
        })),
      };
      const buffer = await buildTicketPdfBuffer(data, labelMap);
      return {
        base64: buffer.toString("base64"),
        filename: `KNMP-ticket-${booking.reference}.pdf`,
      };
    }),

  /** Admin analytics: category breakdown and monthly revenue trends. */
  analytics: router({
    categoryBreakdown: adminProcedure
      .input(
        z
          .object({
            from: z.date().optional(),
            to: z.date().optional(),
          })
          .optional(),
      )
      .query(({ input }) => getCategoryBreakdown(input)),
    categoryBreakdownCsv: adminProcedure
      .input(
        z
          .object({
            from: z.date().optional(),
            to: z.date().optional(),
          })
          .optional(),
      )
      .query(({ input }) => getCategoryBreakdownCsv(input)),
    monthlyTrends: adminProcedure
      .input(
        z
          .object({
            months: z.number().int().min(1).max(24).default(6),
            from: z.date().optional(),
            to: z.date().optional(),
          })
          .optional(),
      )
      .query(({ input }) => getMonthlyTrends(input?.months ?? 6, input)),
    stats: adminProcedure
      .input(
        z
          .object({
            from: z.date().optional(),
            to: z.date().optional(),
          })
          .optional(),
      )
      .query(({ input }) => getBookingStats(input)),
    dailyForecast: adminProcedure
      .input(
        z
          .object({
            days: z.number().int().min(1).max(90).default(14),
          })
          .optional(),
      )
      .query(({ input }) => getDailyVisitorForecast(input?.days ?? 14)),
  }),

  itineraries: router({
    list: protectedProcedure.query(({ ctx }) => listMyItinerary(ctx.user.id)),
    byDate: protectedProcedure
      .input(z.object({ visitDate: z.date() }))
      .query(async ({ ctx, input }) => listItineraryByDate(ctx.user.id, dateOnly(input.visitDate))),
    create: protectedProcedure
      .input(
        z.object({
          visitDate: z.date(),
          title: z.string().min(1).max(200),
          description: z.string().max(2000).optional().nullable(),
          timeSlot: z.string().max(50).optional().nullable(),
          attractionId: z.number().int().positive().optional().nullable(),
          attractionName: z.string().max(200).optional().nullable(),
          bookingId: z.number().int().positive().optional().nullable(),
          sortIndex: z.number().int().default(0),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const attractionId = input.attractionId ?? null;
        if (attractionId) {
          const a = await getAttractionById(attractionId);
          if (!a) throw new Error("Selected attraction not found");
          return createItineraryItem({
            ...input,
            userId: ctx.user.id,
            bookingId: input.bookingId ?? null,
            attractionId: a.id,
            attractionName: a.name,
          });
        }
        return createItineraryItem({
          ...input,
          userId: ctx.user.id,
          bookingId: input.bookingId ?? null,
        });
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          title: z.string().min(1).max(200).optional(),
          description: z.string().max(2000).nullable().optional(),
          timeSlot: z.string().max(50).nullable().optional(),
          attractionId: z.number().int().positive().nullable().optional(),
          attractionName: z.string().max(200).nullable().optional(),
          sortIndex: z.number().int().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateItineraryItem(id, ctx.user.id, data);
        return { success: true } as const;
      }),
    reorder: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), sortIndex: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await reorderItineraryItem(input.id, ctx.user.id, input.sortIndex);
        return { success: true } as const;
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await deleteItineraryItem(input.id, ctx.user.id);
        return { success: true } as const;
      }),
    /** Render the owner's itinerary as a printable PDF document. */
    exportPdf: protectedProcedure.mutation(async ({ ctx }) => {
      const items = await listMyItinerary(ctx.user.id);
      const data: ItineraryPdfData = {
        ownerName: ctx.user.name ?? ctx.user.email ?? null,
        days: buildItineraryDays(items),
        totalItems: items.length,
      };
      const buffer = await buildItineraryPdfBuffer(data);
      return {
        base64: buffer.toString("base64"),
        filename: "KNMP-itinerary.pdf",
      };
    }),
    /** Create (or refresh) a shareable link code for the owner's itinerary. */
    share: protectedProcedure.mutation(async ({ ctx }) => {
      const code = nanoid(10);
      await createItineraryShare(ctx.user.id, code);
      return { shareCode: code };
    }),
    /** Public read-only view of a shared itinerary (no auth required). */
    byShareCode: publicProcedure
      .input(z.object({ shareCode: z.string().min(1).max(32) }))
      .query(async ({ input }) => {
        const result = await listItineraryByCode(input.shareCode);
        if (!result) return undefined;
        return { days: buildItineraryDays(result.items), totalItems: result.items.length };
      }),
  }),
});

/**
 * Group flat itinerary items into days keyed by ISO date, ascending.
 * Shared between the owner export PDF and the public share view.
 */
function buildItineraryDays(items: ItineraryRow[]) {
  const byDate = new Map<string, ItineraryRow[]>();
  for (const item of items) {
    const key = isoDate(item.visitDate);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(item);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, rows]) => ({
      dateLabel: new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      rows,
    }));
}

export type AppRouter = typeof appRouter;
