import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  cancelOwnBooking,
  createAttraction,
  createBooking,
  createBookingItem,
  createCategory,
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
  getBookingStats,
  getMyBookings,
  getUpcomingMyBookings,
  listActiveAttractions,
  listActiveCategories,
  listAllAttractions,
  listAllBookings,
  listAllCategories,
  listItineraryByDate,
  listMyItinerary,
  reorderItineraryItem,
  searchAttractions,
  updateAttraction,
  updateBookingStatus,
  updateCategory,
  updateItineraryItem,
} from "./db";
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
      .mutation(async ({ input }) => {
        const slug = slugify(input.name);
        return createAttraction({ ...input, slug });
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
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const payload: Partial<InsertAttraction> = { ...data };
        if (data.name) payload.slug = slugify(data.name);
        await updateAttraction(id, payload);
        return { success: true } as const;
      }),
    remove: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteAttraction(input.id);
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
      .mutation(async ({ input }) => {
        const slug = slugify(input.name);
        return createCategory({ ...input, slug });
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
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const payload: Partial<InsertVisitorCategory> = { ...data };
        if (data.name) payload.slug = slugify(data.name);
        await updateCategory(id, payload);
        return { success: true } as const;
      }),
    remove: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteCategory(input.id);
        return { success: true } as const;
      }),
  }),

  bookings: router({
    /** Server-side cost calculation for a set of {categoryId, quantity} pairs. */
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
          lines: z.array(
            z.object({ categoryId: z.number().int().positive(), quantity: z.number().int().min(1).max(100) }),
          ),
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
        return { booking, items };
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
        return { booking, items };
      }),
    setStatus: adminProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["pending", "confirmed", "cancelled"]) }))
      .mutation(async ({ input }) => {
        await updateBookingStatus(input.id, input.status);
        return { success: true } as const;
      }),
    stats: adminProcedure.query(() => getBookingStats()),
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
  }),
});

export type AppRouter = typeof appRouter;
