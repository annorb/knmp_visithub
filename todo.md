# KNMP VisitHub — Project TODO

## Database & Backend
- [x] Define DB schema: users (role), attractions, visitor_categories (fees), bookings, booking_items, itinerary_items
- [x] Apply migrations to database
- [x] Admin-gating middleware (adminProcedure)
- [x] Attractions CRUD procedures (public list/search/details, admin CRUD)
- [x] Visitor categories & fees procedures (public list, admin CRUD)
- [x] Booking creation with unique auto-generated reference (e.g. KNMP-XXXXXX)
- [x] Booking cost calculation based on category quantities
- [x] My Bookings query + cancel (owner-only)
- [x] Itinerary CRUD (owner-only)
- [x] Admin stats/dashboard procedures

## Frontend — Visitor
- [x] Design system: elegant palette, Google Fonts, global theme in index.css
- [x] Public layout with top navigation (Explore, Book, My Bookings, Itinerary, Sign In)
- [x] Landing/Home page introducing the park with featured attractions
- [x] Attractions Explorer: browse + search + detail pages (name, description, images, opening hours, fees)
- [x] Booking flow: select visit date, choose categories + quantities, live cost summary, confirm, success with unique reference
- [x] My Bookings page (authenticated only) with cancel support
- [x] Personal Itinerary Builder: add activities/attractions tied to a visit date, reorder/edit/delete
- [x] Manus OAuth login/logout wired throughout

## Frontend — Admin
- [x] Admin dashboard shell (DashboardLayout)
- [x] Admin: manage attractions (add/edit/delete with images)
- [x] Admin: manage visitor categories and fees
- [x] Admin: view/manage all bookings
- [x] Admin: basic stats overview

## Content & Quality
- [x] Seed realistic KNMP content (attractions, categories: adult/child/student/foreigner, fees)
- [x] Upload attraction images to static asset storage
- [x] Vitest tests (15 passing) for booking reference uniqueness, cost calc, auth gating
- [x] Visual verification via screenshots, responsive check
- [x] Checkpoint and deliver

## Enhancement Round 1 (user request)
- [x] DB schema: multi-day bookings (visitEndDate on booking), tour_slots + booking_slots tables
- [x] Backend: date-range booking creation and validation, slot attachment, analytics endpoints, PDF endpoint
- [x] PDF ticket generation on successful booking + download endpoint (server-side pdfkit), embedded reference + category breakdown + total + slots
- [x] Frontend booking flow: date range picker (multi-day checkbox + end date), guided-tour slot selection grid
- [x] PDF ticket download UI on booking confirmation and My Bookings
- [x] Admin analytics page: KPIs, visitor-category breakdown, monthly revenue trend chart; nav entry + route
- [x] Tests (22 passing incl. multi-day validation & slots) + visual verification + checkpoint

## Enhancement Round 2 (user request — actor specification gaps)
- [x] DB schema: isActive flag on users table + migration applied
- [x] Backend: admin users list / role update / activate-deactivate procedures (adminProcedure, self-demotion protection)
- [x] Auth gating: blocked (inactive) users cannot use protected endpoints (ForbiddenError in authenticateRequest)
- [x] Admin page: Users management (table, role change, activate/deactivate) + nav entry + route
- [x] Tests (26 passing incl. user management) + visual verification + checkpoint

## Enhancement Round 3 (user request)
- [x] DB: audit_events table (actor, action, target, detail, timestamp) + migration applied
- [x] DB: category field on attractions seeded (Monument/Museum/Library/Gardens/Viewpoint/Shop & Dining, locations assigned)
- [x] Backend: audit writing on role change / activate-deactivate; admin audit list procedure
- [x] Backend: attractions filter (search + category + location) + facets procedures
- [x] Frontend: Explorer filter facets (category pills, location pills) + search combined, active-filter badges
- [x] Frontend: admin Audit Log page + nav entry + route
- [x] Tests (32 passing incl. facets, filtered search, audit writes, gating) + visual verification + checkpoint

## Enhancement Round 4 (user request)
- [x] Backend: itinerary PDF generation (server/itineraryPdf.ts) + exportPdf endpoint (owner-only)
- [x] Backend: shareable itinerary link (itinerary_shares table, public byShareCode endpoint) — /share/itinerary/:code
- [x] Backend: audit writes for attractions CRUD, visitor categories CRUD, booking status updates (attraction_* / category_* / booking_status_changed)
- [x] Backend: analytics endpoints accept optional date range (from/to) parameters
- [x] Frontend: Itinerary page export-to-PDF and copy-share-link actions
- [x] Frontend: admin Analytics date-range picker (start/end dates) applied to breakdown + trends + KPIs
- [x] Tests (44 passing incl. export/share, extended audit trail, analytics range) + visual verification + checkpoint

## Bugfix Round (user report)
- [x] Fix /admin analytics query failure: monthly trends SQL breaks when a visitDate range (from/to) is passed; review range semantics across stats, breakdown, trends and AdminAnalytics UI
- [x] Root cause: TiDB prepared-statement path rejects SELECT-list aliases in ORDER BY; changed to positional ordering (sql`1 ASC`, sql`4 DESC`) in getMonthlyTrends and getCategoryBreakdown
- [x] Add live-db regression tests for getMonthlyTrends / getCategoryBreakdown / getBookingStats with date ranges (47 tests passing)
