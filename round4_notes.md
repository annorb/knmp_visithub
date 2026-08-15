# Round 4 implementation notes (knmp_visithub)

## Goal
1. Itinerary PDF export + shareable link.
2. Audit log: attractions CRUD, categories CRUD, booking status changes.
3. Analytics date-range picker (from/to) for breakdown, trends, KPIs.

## Current routers.ts structure (server/routers.ts)
- Line 51: `import { buildTicketPdfBuffer, type TicketData } from "./ticketPdf";`
- Attraction router starts line 76; facets at ~91; admin endpoints at ~100:
  - listAll ~100; create ~102 (.mutation(async ({ input }) => { const slug = slugify(input.name); return createAttraction({ ...input, slug }); }));
  - update ~118 (mutation async input — no ctx! uses ({ input }) only); remove ~139 (no ctx).
- categories router line 148: create ~162 (no ctx), update ~178 (no ctx), remove ~193 (no ctx).
- bookings router line 193; admin setStatus ~350: `.mutation(async ({ input }) => { await updateBookingStatus(input.id, input.status); return { success: true } as const; })`
- analytics router line 450: categoryBreakdown adminProcedure.query(() => getCategoryBreakdown()), monthlyTrends input { months } default 6.
- itineraries router line 457: list / byDate / create / update / reorder / remove; remove ends ~521. AppRouter export line 525.
- Users router ~361 already writes audit events (role_change, account_(de)activated) via createAuditEvent({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? null, action, targetUserId, targetName, detail }).
- audit router ~397: audit.list = adminProcedure.query(() => listAuditEvents()).

## ticketPdf.ts
- buildTicketPdfBuffer(data: TicketData, labelMap) → Buffer; ticket endpoint returns { base64, filename }. Reuse PDFDocument from "pdfkit" for itinerary PDF (create server/itineraryPdf.ts similar to ticketPdf.ts).
- ticket router: `ticket: protectedProcedure` endpoint around line 415-449 (builds labelMap via allSlots, getAttractionById for each slot).

## db.ts helpers (need to add)
- itinerary db helpers exist: listMyItinerary, listItineraryByDate, createItineraryItem, updateItineraryItem, reorderItineraryItem, deleteItineraryItem. Need itineraryItems import; shareCode field to add to itinerary_items schema: add `shareCode` varchar(30) nullable unique to itinerary_items, and itineraryGroups? No — simpler: share table OR add shareCode per day-group. Simplest: add column `shareCode` to itinerary_items? Better: a separate `itinerary_shares` table with (ownerId, shareCode, createdAt) or just add to itinerary_items as a per-item code is messy. DECISION: add `itinerary_groups`? Keep simple: add itinerary_shares (id, ownerId, shareCode unique, createdAt). Share endpoint: itineraries.share (protected, creates code), itineraries.byShareCode (public, input {code}, returns owner's itinerary items). PDF uses listMyItinerary.
- analytics: extend getCategoryBreakdown & getMonthlyTrends to accept { from?, to? } date params (UTC) and pass to bookings query where visitDate between; getBookingStats same. Update db.ts helpers.
- Audit: db.createAuditEvent exists. Routers: attractions.create/update/remove, categories.create/update/remove, bookings.setStatus → each writes audit event: action strings "attraction_created"/"attraction_updated"/"attraction_removed", "category_created"/"category_updated"/"category_removed", "booking_status_changed". NOTE attractions/categories updates currently lack ctx (use ({ input }) only) → add ctx to pull actor info.
- For update detail, fetch current name via getAttractionById/getCategoryById for targetName.

## Frontend
- Itinerary.tsx: add Export PDF button (calls itineraries.exportPdf → returns base64+filename, download blob) and Share Link button (itineraries.share → code; copy to clipboard with toast; link = /share/itinerary/{code}).
- New public page /share/itinerary/:code — read-only itinerary view (title/date/timeSlot per day), VisitorLayout, uses itineraries.byShareCode.
- AdminAnalytics.tsx: add start/end date inputs (react-day-picker date range), pass {from,to} into categoryBreakdown & monthlyTrends queries + KPIs (stats already include totals; maybe filter stats too — stats router uses getBookingStats; add date range to stats too).

## Tests (server/booking.test.ts)
- Add mock helpers to fake db: createItineraryShare? Actually router calls listMyItinerary + byShareCode helper `getItineraryByShareCode`. Add mocks: createItineraryShare, getItineraryByShareCode, buildItineraryPdfBuffer (or reuse). Add tests: share link public, export protected, audit events on attraction/category/status changes (mock updateUserRole pattern; admin context; expect.objectContaining actions), analytics date range input passes through.
- 32 tests currently passing.
- Existing audit tests in "admin audit trail" describe: beforeEach resets mocks.

## Misc
- nanoid available (package.json has nanoid ^5). Use nanoid(10) for shareCode.
- Itinerary items grouped by visitDate client-side (Array.from map); share view mirrors.
- Latest checkpoint: 1d4e11a5. Prev delivered: afc5e68a, b67118cb.
- Dev server: port 3000. Type-check: pnpm check. Tests: pnpm test.

## STATUS UPDATE (backend DONE)
- DB: itinerary_shares table created (migration 0005 applied). Schema has it.
- db.ts: getBookingStats(range), getCategoryBreakdown(range), getMonthlyTrends(months, range), createItineraryShare, getItineraryShareOwner, listItineraryByCode added. Imports fixed (lt, itineraryShares).
- itineraryPdf.ts created: buildItineraryPdfBuffer(ItineraryPdfData {ownerName, days:[{dateLabel, rows: ItineraryRow[]}], totalItems}), isoDate exported.
- routers.ts: imports added (createItineraryShare, listItineraryByCode, getCategoryById, nanoid, itineraryPdf types). Attractions create/update/remove + categories create/update/remove + bookings.setStatus now write audit events with ctx (audits: attraction_created/updated/removed, category_created/updated/removed, booking_status_changed). analytics.categoryBreakdown/monthlyTrends/stats accept optional {from, to} dates (visitDate range; stats filters visitDate, trends uses createdAt + visitDate). itineraries.exportPdf (protected, returns base64+filename), itineraries.share (protected, nanoid(10) code), itineraries.byShareCode (public). buildItineraryDays helper at bottom of routers.ts (ItineraryRow[] -> days). pnpm check clean.
- NEXT (frontend):
  1. Itinerary.tsx: add "Export PDF" (trpc.itineraries.exportPdf.useMutation → blob download) + "Share Link" (trpc.itineraries.share.useMutation → copy url ${origin}/share/itinerary/${code} via navigator.clipboard, toast). Check Itinerary.tsx grouping code for reuse of day grouping (client uses same map-by-date pattern).
  2. New page client/src/pages/ItineraryShare.tsx: VisitorLayout, trpc.itineraries.byShareCode({shareCode}) from wouter params, render days (Card per day, timeSlot + title + attractionName + description), empty/invalid state. Register /share/itinerary/:code in App.tsx (public route).
  3. AdminAnalytics.tsx: add date-range inputs (start/end date, <input type=date> simplest or shadcn Calendar popover), useMemo stable {from,to} object, pass to categoryBreakdown/monthlyTrends/stats queries; KPIs now use stats({from,to}).
- Then: tests (booking.test.ts: mocks createItineraryShare, listItineraryByCode, itineraryPdf helpers; tests export protected, byShareCode public, audit events for attraction/category/status via createAuthContext("admin") with distinct target ids like 88/99 — avoid id collision with ctx user seq; analytics date range passthrough), pnpm test, screenshots /itinerary + /admin/analytics + /share/itinerary/testcode, mark todo, checkpoint (prev 1d4e11a5), deliver.
- AdminAnalytics KPIs currently come from bookings.stats via trpc; check how AdminAnalytics.tsx consumes stats before adding from/to input to that query.

## ROUND 4 STATUS UPDATE (frontend DONE, verified)
- All round 4 frontend work complete: Itinerary.tsx has Export PDF + Share link buttons (tested working in screenshot); ItineraryShare.tsx created with /share/itinerary/:code route in App.tsx (invalid-code empty state verified in screenshot); AdminAnalytics.tsx has From/To date pickers + Apply/Clear wired to stats, categoryBreakdown, monthlyTrends queries (verified in screenshot).
- Tests: 44 passed, 0 failed (round 4 added ~12 tests: export/share protected & public, audit events attraction/category/status, analytics range passthrough). Mocks added: createItineraryShare, listItineraryByCode in shared fake db; getCategoryById mock via vi.fn + db import patch.
- Screenshots verified: /itinerary, /admin/analytics, /share/itinerary/abc123, /, /explore — all render correctly.
- Next: mark round 4 todo items [x], webdev_save_checkpoint, deliver result.
- Latest checkpoint: 1d4e11a5 (round 3).
