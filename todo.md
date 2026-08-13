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
