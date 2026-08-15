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

## Enhancement Round 5 (user request)
- [x] Email sending capability: server email helper using Resend transactional email API (RESEND_API_KEY secret, validated by email.test.ts)
- [x] Booking confirmation email: on successful booking creation, automatically email the PDF ticket to the visitor's registered email address (fire-and-forget, non-fatal)
- [x] Admin category breakdown CSV export endpoint (adminProcedure) + Export CSV button on Analytics page
- [x] Daily visitor-capacity forecast: backend daily visitor projection query (next 14 days, multi-day stays spread evenly, capacity constant 500)
- [x] Frontend: daily visitor-capacity forecast chart with capacity reference line on the analytics page
- [x] Tests (email helper with mocked fetch, CSV export, forecast query; RESEND key validation) + visual verification — 55 tests passing + checkpoint

## Enhancement Round 6 (user request)
- [x] Booking status-change email: when admin updates a booking status to confirmed/cancelled, email the visitor with the new status details (sendBookingStatusEmail, fire-and-forget, fallback to account email)
- [x] QR code on PDF tickets: embed a scannable QR code (KNMP-TICKET:<reference> payload) for gate check-in (qrcode package)
- [x] Public booking form capacity warning: bookings.capacityCheck procedure + warning banner in booking summary sidebar (near 75% threshold, over at 100% or party would exceed remaining)
- [x] Tests (status email flow, capacityCheck query) + visual verification + checkpoint — 68 tests passing

## Enhancement Round 7 (user request)
- [x] Check-ins tracking: bookings.checkInAt timestamp column + checkIn(id) + undoCheckIn (cancelled bookings blocked); gate router (lookupByReference/checkIn/undoCheckIn) with audit events
- [x] Visual check-in indicator on admin bookings page: Check-in column with Checked-in badge + gate shortcut button
- [x] Site settings: `site_settings` table (migration 0006) + settings.list/update adminProcedure + /admin/settings page
- [x] Capacity warning + forecast respect configured settings (fallback defaults 500/75%) — capacityCheck returns capacity + nearThreshold; forecast rows carry capacity
- [x] Gate check-in page (/admin/gate): scan QR (jsqr camera + manual reference input), auto check-in on valid scan, booking details + undo, sidebar link
- [x] Admin add-user button on Users page: dialog form (name, email) creates account matched to Manus OAuth email; users.create server procedure
- [x] Tests (server/round7.test.ts: settings round-trip, gate check-in/undo, cancelled-blocked, users.create duplicate rejection) + visual verification — 77 tests passing + checkpoint

## Documentation set (user request)
- [x] {i} — overview, architecture, features, schema, SDLC
- [x] {i} — software requirements specification (actors, functional/non-functional requirements, use cases, constraints)
- [x] {i} — test strategy, suite inventory, results, coverage narrative
- [x] {i} — debt register + remediation plan
- [x] {i} — visitor + admin usage guide with workflows
- [x] {i} — live deployment URL + GitHub export info

## GitHub export (user request)
- [x] Export KNMP VisitHub source to the user's GitHub account (full history pushed via SSH to annorb/knmp_visithub)

## Enhancement Round 8 (user request)
- [x] Park coordinates: added lat/lng columns to attractions (migration 0007) + seeded realistic coordinates around the park centroid (5.5510 N, -0.2108 W)
- [x] Public attractions.list returns lat/lng; admin attractions CRUD accepts coordinates
- [x] Explorer page: interactive Google Map view (MapView) with markers for all attractions, info windows, filter-aware marker highlighting, toggle between list and map view
- [x] Group/school package: added isGroup/groupMinQty/groupDiscountPercent to visitor_categories (migrations 0008 + 0009 discount columns on booking_items); computeGroupDiscount applies per-line group discount at minimum group size in calculateCost and booking creation
- [x] Booking form: group booking package hints on category cards (e.g. "20% group rate from 15 visitors") + discount lines in live cost summary; admin categories form manages group settings
- [x] Itinerary PDF export: exportPdf verified working; filename enhanced to KNMP-itinerary-YYYY-MM-DD.pdf
- [x] Tests for Round 8 (server/round8.test.ts: group discount calc, lat/lng bounds, exportPdf presence) + visual verification + checkpoint — 80 tests passing
