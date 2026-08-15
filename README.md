# KNMP VisitHub

A web-based booking and visit-planning system for the **Kwame Nkrumah Memorial Park (KNMP)**, Accra, Ghana.

> https://github.com/annorb/knmp_visithub

KNMP VisitHub allows visitors to explore the park's attractions, view entrance fees by visitor category, book visits (including multi-day stays and guided-tour time slots), receive PDF tickets with scannable QR codes, and build personal visit itineraries. Administrators get a full management suite: attractions and pricing management, booking and status control, gate check-in via QR scanning, user and role management, audit logging, configurable site settings, and analytics with capacity forecasting.

## Features

### Visitors
- **Attractions Explorer** — browse, search, and filter attractions by category and location, with live facet counts
- **Booking system** — single or multi-day bookings, visitor category quantities (Adult, Child, Student, Foreigner, etc.), live cost calculation, and a unique `KNMP-XXXXXX` booking reference
- **Guided-tour time slots** — per-attraction guided-tour slot selection at booking time
- **PDF tickets** — auto-generated entry tickets with QR codes, automatically emailed on successful booking
- **Capacity warnings** — real-time warning banner when a selected date is forecast to exceed the daily capacity limit
- **My Bookings** — view booking history, download tickets, and cancel bookings
- **Itinerary builder** — plan activities per visit date, reorder, add notes, export to PDF, or share via a public link

### Administrators
- **Dashboard** — KPIs, recent activity, and quick navigation
- **Attractions & categories management** — full CRUD for attractions, visitor categories, and fees
- **Bookings management** — view all bookings, confirm/cancel with automatic visitor email notifications, and check-in status tracking
- **Gate check-in page** (`/admin/gate`) — scan QR codes from the camera (or enter the reference manually) to check visitors in, with audit logging
- **Analytics** — visitor-category breakdown, monthly revenue trends, daily capacity forecast chart, CSV export, and custom date-range filtering
- **User management** — list users, change roles (admin/user), activate or deactivate accounts, and create new accounts
- **Audit log** — tracks role changes, account state changes, attractions/category edits, and booking status updates
- **Settings** — configure the daily capacity limit and capacity warning threshold

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui, wouter |
| Backend | Express 4, tRPC 11, superjson |
| Database | MySQL/TiDB, Drizzle ORM |
| Auth | Manus OAuth (Google/social sign-in) |
| Email | Resend transactional API |
| Tickets & QR | pdfkit (PDF generation), `qrcode` + `jsqr` (QR embedding and scanning) |
| Testing | Vitest (77 passing unit/integration tests) |

## Project Structure

```
client/            React frontend (pages, components, shadcn/ui)
server/            Express + tRPC server, DB helpers, email, PDF generation, tests
drizzle/           Database schema and migrations
shared/            Shared constants and types
knmp_docs/         Project documentation (SRS, Testing Report, User Manual, etc.)
```

Key files:

- `drizzle/schema.ts` — database schema (users, attractions, visitor_categories, bookings, booking_items, booking_slots, itinerary, audit_events, site_settings, ...)
- `server/db.ts` — query helpers reused across tRPC procedures
- `server/routers.ts` — all public and admin tRPC procedures
- `server/email.ts` — Resend email helper (booking confirmation, status-change notifications)
- `server/ticketPdf.ts` / `server/itineraryPdf.ts` — PDF generators
- `client/src/pages/` — public pages (`Home`, `Explorer`, `Book`, `MyBookings`, `Itinerary`) and admin pages (`admin/`)

## Getting Started

### Prerequisites

- Node.js 22+ and pnpm
- A MySQL-compatible database (MySQL 8+ or TiDB)
- Accounts for Manus OAuth and Resend

### Setup

```bash
git clone https://github.com/annorb/knmp_visithub.git
cd knmp_visithub
pnpm install
```

### Environment variables

Copy `.env.example` (or create `.env`) with:

```
DATABASE_URL=mysql://<user>:<password>@<host>:<port>/<db>
JWT_SECRET=<a-random-secret>
VITE_APP_ID=<manus-oauth-app-id>
VITE_OAUTH_PORTAL_URL=<manus-oauth-portal-url>
OAUTH_SERVER_URL=<manus-oauth-server-url>
OWNER_OPEN_ID=<owner-open-id>
OWNER_NAME=<owner-name>
RESEND_API_KEY=<resend-api-key>
```

When running from the Manus platform these values are injected automatically; when running standalone, create a Manus OAuth application and a Resend account to obtain them.

### Run locally

```bash
pnpm drizzle-kit generate   # (only if schema changed)
pnpm dev                    # starts the dev server on port 3000
pnpm test                   # run the 77 vitest tests
```

Seed realistic park content (8 attractions, 8 visitor categories) with the provided seed scripts, e.g. `node seed.mjs` / `node seed-slots.mjs`.

## Deployment

The project is designed for the Manus webdev platform (Autoscale hosting), where environment variables, database, OAuth, and analytics are managed automatically. It can also be self-hosted on any Node.js host with a MySQL database:

```bash
pnpm build
NODE_ENV=production node dist/server/index.js
```

## Documentation

A complete documentation set accompanies the project (PDF format, rendered from Markdown sources):

- **SRS.pdf** — software requirements specification (actors, functional/non-functional requirements, use cases)
- **Project_Documentation.pdf** — overview, architecture, features, schema, SDLC
- **Testing_Report.pdf** — test strategy, suite inventory, results
- **Technical_Debt_Plan.pdf** — debt register and remediation plan (48-hour development period)
- **User_Manual.pdf** — visitor and administrator usage guide

## Development History

The project was built iteratively over seven enhancement rounds on top of the initial booking system:

1. **v1** — attractions explorer, category fees, unique booking references, itinerary builder, admin dashboard
2. Multi-day bookings, guided-tour slots, PDF tickets, admin analytics
3. User management (roles, activation)
4. Explorer filter facets, audit log (user actions)
5. Itinerary PDF export and share links, extended audit trail, analytics date ranges
6. Email confirmation with PDF ticket, CSV export, capacity forecast chart
7. Status-change emails, QR code tickets, capacity warnings
8. Gate QR check-in page, configurable capacity settings, admin add-user button

## License

Private project — all rights reserved to the author (annorb).
