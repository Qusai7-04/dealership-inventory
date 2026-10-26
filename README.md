# Creaseline — Tactile Automotive Dealership Inventory & Specimen Ledger

[![Incubyte Kata](https://img.shields.io/badge/Incubyte-Full--Stack%20Assessment-blue.svg)](https://incubyte.co)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%2F%20Vite%206%20%2F%20Tailwind%204-61DAFB.svg)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%2022%20%2F%20Express%204-339933.svg)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2017%20%2F%20Neon-336791.svg)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Container-Docker%20Compose-2496ED.svg)](https://www.docker.com)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205.8-3178C6.svg)](https://www.typescriptlang.org)

**Creaseline** is an enterprise-grade, tactile digital dealership inventory system and automotive specimen archive. Built as a complete solution for the Incubyte Full-Stack Software Engineer assessment, Creaseline balances architectural rigor with a distinctive print-editorial design language. It pairs an Express/TypeScript REST API and a normalized PostgreSQL database with a responsive React 19 single-page application styled in Tailwind CSS.

- **Live Deployed Demonstration:** [https://creaseline-frontend.vercel.app/](https://creaseline-frontend.vercel.app/)
- **GitHub Repository:** [https://github.com/Qusai7-04/dealership-inventory](https://github.com/Qusai7-04/dealership-inventory)
- **Primary Local Startup:** `docker compose up --build` (starts PostgreSQL 17, Backend API, and Frontend SPA in one command)

---

## The Problem It Solves

Automotive dealership inventory systems present unique data integrity and concurrency challenges that generic e-commerce applications routinely fail to handle:

1. **The Shared Stock-Line Race Condition:** Dealerships frequently stock multiple identical units of a specific make, model, and trim (a "stock line") rather than individual, VIN-tracked unique vehicles. When multiple buyers attempt to acquire the final remaining units simultaneously, naive inventory systems suffer from race conditions, dirty reads, and overselling.
2. **Phantom Modifiers & Unaudited Adjustments:** Direct SQL mutations or arbitrary edits to stock counts leave zero traceability regarding who increased or decreased inventory, why counts shifted, or whether stock numbers match physical warehouse receipts.
3. **Cart Lock-in vs. Instant Acquisition:** Traditional e-commerce carts either prematurely lock stock before checkout (causing artificial cart starvation) or fail to validate stock at transaction time (producing post-checkout order cancellations).
4. **Idempotency Failures Under Network Flakiness:** In high-concurrency or flaky mobile network scenarios, users repeatedly hit "Purchase" or "Checkout", triggering duplicate orders, phantom double-billing, and depleted inventory.

### How Creaseline Solves This

- **Row-Level Lock Transactions (`SELECT ... FOR UPDATE`):** Direct purchases and cart checkouts acquire deterministic row-level locks on target stock lines in ascending UUID order, entirely preventing deadlocks and race conditions.
- **Indelible Double-Entry Stock Receipts:** Stock counts cannot be arbitrarily edited through general vehicle updates. Inventory additions require an explicit restock operation that records an immutable row in `stock_receipts` capturing the actor identity, request UUID, quantity added, and resulting balance.
- **Strict Reconciliation Invariant:** The database guarantees that for every vehicle:
  $$\text{Current Quantity} = \sum(\text{Opening/Restock Quantity Added}) - \text{Count}(\text{Completed Purchase Items})$$
- **Idempotency by Design:** All stock-mutating endpoints (`/purchase`, `/checkout`, `/restock`) require client-supplied UUID `requestId` keys. Replayed requests return identical historical responses without re-executing inventory decrements or billing.
- **Server-Enforced Role-Based Access Control:** Dual-persona authorization strictly separates standard shoppers (`user`) from dealership staff (`admin`). Administrative privileges cannot be granted through client input or registration.

---

## Screenshot Gallery (Visual Tour)

All screenshots below are captured directly from the live, fully populated Creaseline application running against its PostgreSQL 17 database.

| Screen | Visual Preview | Description & User Flow |
|---|---|---|
| **01. Storefront Homepage** | ![Storefront Homepage](docs/screenshots/01-homepage-hero.png) | **The Editorial Specimen Floor:** High-impact tactile hero featuring real-time showroom counters (Models Catalogued, Physical Units, Low Stock Triggers), rapid search motor register, and authenticated terminal access gate. |
| **02. Authentication Terminal** | ![Authentication Terminal](docs/screenshots/02-auth-terminal.png) | **Dual-Persona Access Terminal:** Clean tabbed login interface allowing users to authenticate into either the standard **Customer Portal** or the protected **Admin Console**. Role checks reload live from PostgreSQL. |
| **03. Customer Registration** | ![Customer Registration](docs/screenshots/03-registration-portal.png) | **Shopper Registration Portal:** Public onboarding form creating standard `user` accounts with cryptographic bcrypt hashing. Server strictly prevents unauthorized administrative role self-assignment. |
| **04. Showroom Catalogue Floor** | ![Showroom Catalogue Floor](docs/screenshots/04-catalogue-showroom-floor.png) | **The Floor (Live Inventory Register):** Full inventory grid showing real-time stock badges, studio WebP imagery, lot numbers, 3-point telemetry (BHP, 0-100 km/h, drive layout), and disabled Purchase buttons for depleted units. |
| **05. Search & Multi-Filters** | ![Search & Multi-Filters](docs/screenshots/05-search-and-filters.png) | **Dynamic Filter Panel in Action:** Instant search query (`Honda`) combined with body style selectors (Convertible, Coupe, Sedan, Hatchback, SUV) and stock-level filters, dynamically updating active pagination counters. |
| **06. Vehicle Specification Detail** | ![Vehicle Specification Detail](docs/screenshots/06-vehicle-specification-detail.png) | **Chassis Specimen Detail:** High-resolution Figure 01.A front-3/4 studio render, certified dyno telemetry, powertrain blueprints, live remaining stock meter, and one-click direct acquisition escrow actions. |
| **07. Cart & Requisition Docket** | ![Cart & Requisition Docket](docs/screenshots/07-cart-and-checkout-docket.png) | **Official Motor Voucher (Form CL-2026):** Active requisition docket listing gathered chassis lines, live floor stock balance, tear-sheet removal actions, authoritative server subtotal, and idempotent checkout execution. |
| **08. Admin Dealership Ledger** | ![Admin Dealership Ledger](docs/screenshots/08-admin-inventory-ledger.png) | **Master Inventory Console (`/admin`):** Executive overview showing total units (177 balance), active listings, floor-ready lines, urgent restock triggers, cached WebP asset audits, inline editing, restock modals, and chassis intakes. |
| **09. Stock Receipt Audit Trail** | ![Stock Receipt Audit Trail](docs/screenshots/09-admin-stock-receipt-history.png) | **Verifiable Stock History Modal:** Indelible audit trail for individual chassis lines showing the timestamped log of stock receipts, actor identities, quantity increments, and resulting physical balances. |

---

## Application Workflow & User Journeys

```mermaid
flowchart TD
    subgraph Customer Journey
        A[Visit Homepage / Storefront] --> B[Sign In / Register]
        B --> C[Browse The Floor Catalogue]
        C --> D[Search, Filter & Sort Vehicles]
        D --> E{Acquisition Flow}
        E -->|Direct Single Unit| F[POST /api/vehicles/:id/purchase]
        E -->|Multi-Chassis Order| G[Add to Requisition Cart]
        G --> H[Open Cart / Official Voucher]
        H --> I[POST /api/cart/checkout]
        F --> J[Atomic Stock Decrement & Immutable Purchase Record]
        I --> J
        C --> K[Toggle Favourite & Opt-in Restock Alert]
        K --> L[Receive In-App Notification on Restock]
    end

    subgraph Administrator Journey
        M[Admin Sign In / Role Verification] --> N[Dealership Ledger Master Console]
        N --> O[Review Floor Metrics & Urgent Low Stock]
        N --> P[New Chassis Intake: POST /api/vehicles]
        N --> Q[Record Restock Receipt: POST /api/vehicles/:id/restock]
        N --> R[Inspect Indelible Stock History]
        N --> S[Soft-Delete Archive Listing: DELETE /api/vehicles/:id]
        Q --> T[Trigger Automatic Back-in-Stock Alerts for Favourited Shoppers]
    end
```

### 1. Customer Discovery & Acquisition Workflow
1. **Browse Catalogue:** The user browses active showroom models on `/vehicles`. Live stock meters indicate whether a vehicle is in stock, running low, or completely depleted. Zero-stock listings remain visible with disabled purchase triggers.
2. **Inspect Specimen:** Clicking a vehicle opens `/vehicles/:id`, rendering the front-three-quarter studio render, technical powertrain blueprints, factory dyno telemetry, and retail invoice figures.
3. **Direct Acquisition:** Clicking "Purchase Now (Direct Acquisition)" sends `POST /api/vehicles/:id/purchase` with a unique client `requestId`. The backend acquires a row lock, confirms quantity $> 0$, decrements stock by 1, and inserts an immutable purchase header and item price snapshot.
4. **Requisition Cart & Checkout:** Alternatively, users gather multiple stock lines in their cart (`POST /api/cart/items`). Upon reviewing the Official Motor Voucher (`/cart`), clicking "Confirm Purchase" executes an atomic multi-item transaction locking all selected vehicles in deterministic order and purchasing the full docket in one step.
5. **Watchlist & Restock Notifications:** Shoppers can save models to `/favourites` and toggle `notifyOnRestock`. When an administrator subsequently restocks that depleted model, the system automatically dispatches a targeted in-app notification to the shopper's inbox (`/notifications`).

### 2. Dealership Administrator Workflow
1. **Console Authentication:** Administrators authenticate via the dedicated Admin Console tab on `/sign-in`.
2. **Floor Valuation & Telemetry:** On `/admin`, the master console displays live portfolio metrics: total active listings, floor-ready lines, urgent low-stock triggers ($\le 3$ units), depleted tear-sheets, and aggregate physical units on the floor.
3. **Chassis Intake:** Clicking "+ New Chassis Intake" allows the administrator to catalogue a new vehicle make, model, category, showroom price, and opening inventory. When opening stock $> 0$, an opening receipt is written atomically to `stock_receipts`.
4. **Verifiable Restocking:** Clicking "Restock" prompts for the addition quantity and generates a verifiable receipt. If a depleted model is restocked, eligible shoppers receive instant back-in-stock notifications.
5. **Audit Verification:** Clicking "History" reveals the tamper-evident chronological ledger of every stock modification for that chassis, identifying the staff member who authorized the change.
6. **Safe Soft-Deletion:** Discontinuing a model archives the listing (`deleted_at`), removing it from active shopper browsing while preserving all historical sales records, invoices, and receipts.

---

## Core Feature Matrix (Verified Implementation)

Every feature listed below is verified against active source code and covered by automated test suites.

| Functional Area | Implemented Capabilities | Source Verification |
|---|---|---|
| **Authentication & RBAC** | • Dual persona: `user` (shopper) and `admin` (dealership staff)<br>• Public registration strictly enforces `role = 'user'`<br>• BCrypt password hashing (work factor 10–12)<br>• Cryptographic JWT signing with live database user validation on every request<br>• Account deactivation and role changes take effect immediately without token expiry | [`backend/src/controllers/auth.controller.ts`](backend/src/controllers/auth.controller.ts)<br>[`backend/src/middleware/auth.ts`](backend/src/middleware/auth.ts)<br>[`frontend/src/features/auth/AuthProvider.tsx`](frontend/src/features/auth/AuthProvider.tsx) |
| **Stock-Line Architecture** | • Vehicles represent interchangeable stock lines, not unique VIN cars<br>• Shared inventory quantity across all concurrent users<br>• Zero-stock models remain catalogued with disabled "Purchase" buttons<br>• Soft-delete via `deleted_at` timestamp preserves historical integrity | [`backend/src/services/vehicle.service.ts`](backend/src/services/vehicle.service.ts)<br>[`frontend/src/components/VehicleCard.tsx`](frontend/src/components/VehicleCard.tsx) |
| **Indelible Stock Receipts** | • Quantity cannot be edited directly via vehicle update endpoints<br>• Opening inventory recorded as an `opening` receipt<br>• Restocks recorded as a `restock` receipt with actor identity and resulting balance<br>• Invariant enforced: $\text{Quantity} = \sum(\text{Receipts}) - \sum(\text{Purchases})$ | [`backend/src/services/stock-receipt.service.ts`](backend/src/services/stock-receipt.service.ts)<br>[`backend/migrations/002_create_stock_receipts.sql`](backend/migrations/002_create_stock_receipts.sql) |
| **Catalogue & Search** | • Case-insensitive substring search across `make` and `model`<br>• Multi-category filtering (`Sedan`, `SUV`, `Hatchback`, `Coupe`, `Convertible`, `MPV`, `Truck`)<br>• Price ceiling and price floor bounds (`minPrice`, `maxPrice`)<br>• Availability status filters (`all`, `in_stock`, `sold_out`)<br>• Server-side sorting (`make`, `model`, `price`, `quantity`, `createdAt`) in `asc`/`desc`<br>• Full pagination with page, limit, total, and totalPages | [`backend/src/services/vehicle.service.ts`](backend/src/services/vehicle.service.ts)<br>[`frontend/src/pages/CataloguePage.tsx`](frontend/src/pages/CataloguePage.tsx) |
| **Direct One-Unit Purchase** | • Direct purchase via `POST /api/vehicles/:id/purchase`<br>• Row-level lock (`SELECT ... FOR UPDATE`) prevents concurrent overselling<br>• Atomic stock decrement by 1 with boundary check ($quantity > 0$)<br>• Creation of immutable `purchases` header and `purchase_items` price snapshot | [`backend/src/services/purchase.service.ts`](backend/src/services/purchase.service.ts) |
| **Multi-Item Requisition Cart** | • One reusable cart per shopper (`/api/cart`)<br>• Gather up to 1 unit per vehicle model without locking stock prematurely<br>• Dynamic price calculation and out-of-stock warning flags<br>• All-or-nothing atomic checkout (`POST /api/cart/checkout`)<br>• Deadlock-free locking in ascending UUID order<br>• Automatic cart clearance upon successful checkout | [`backend/src/services/cart.service.ts`](backend/src/services/cart.service.ts)<br>[`frontend/src/pages/CartPage.tsx`](frontend/src/pages/CartPage.tsx) |
| **Idempotency & Replay Protection** | • Client-generated UUID `requestId` on all mutating routes<br>• Exact retries safely replay identical completed purchase records<br>• Conflicting payloads using an existing key return `HTTP 409 Conflict`<br>• Strictly prevents double billing and duplicate stock deductions | [`backend/src/services/purchase.service.ts`](backend/src/services/purchase.service.ts)<br>[`backend/src/services/stock-receipt.service.ts`](backend/src/services/stock-receipt.service.ts) |
| **Favourites & Restock Alerts** | • Personal shopper watchlist (`/favourites`)<br>• Opt-in restock alert preference (`notify_on_restock`)<br>• Automated notification generation during transactional restock<br>• Notifications inbox (`/notifications`) with unread counters and read receipts | [`backend/src/services/favourite.service.ts`](backend/src/services/favourite.service.ts)<br>[`backend/src/services/notification.service.ts`](backend/src/services/notification.service.ts) |
| **Admin Master Console** | • Exclusive `/admin` operational terminal<br>• Real-time floor balance and valuation metrics<br>• Chassis intake dialog for adding new stock lines<br>• Verifiable restock modal with actor attribution<br>• Indelible stock history modal inspection<br>• Safe listing archival (soft delete) | [`backend/src/controllers/admin.controller.ts`](backend/src/controllers/admin.controller.ts)<br>[`frontend/src/pages/AdminPage.tsx`](frontend/src/pages/AdminPage.tsx) |
| **Studio Image Pipeline** | • 30 pre-cached, Git-tracked WebP front-three-quarter studio renders<br>• Served statically from frontend CDN and backend static origin with zero API quota drain<br>• Graceful SVG blueprint fallback for uncached models<br>• Automated verification audit script (`npm run db:audit-images`) | [`backend/src/services/car-image.service.ts`](backend/src/services/car-image.service.ts)<br>[`frontend/src/components/VehicleImage.tsx`](frontend/src/components/VehicleImage.tsx) |

---

## Technology Stack

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                            │
│  React 19  │  Vite 6  │  TypeScript 5.8  │  Tailwind CSS 4  │  Router 7 │
│  Tactile Print-Editorial Design  │  SVG Blueprint Fallback Pipeline     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ JSON over HTTPS (Proxy / Bearer JWT)
┌────────────────────────────────────▼────────────────────────────────────┐
│                            API ROUTING LAYER                            │
│  Express 4.21  │  TypeScript 5.8  │  Zod Schema Validation  │  BCrypt   │
│  Controllers, Business Services, and Idempotency Enforcement            │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Parameterized Queries (node-postgres)
┌────────────────────────────────────▼────────────────────────────────────┐
│                            PERSISTENCE LAYER                            │
│  PostgreSQL 17 (Docker)  │  Neon Serverless PostgreSQL (Cloud / SSL)    │
│  11 Normalized Tables  │  ACID Transactions  │  Row Locks FOR UPDATE    │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Frontend:**
  - **Framework:** React 19 SPA with TypeScript 5.8
  - **Bundler & Dev Server:** Vite 6 with Hot Module Replacement (HMR)
  - **Styling & Tokens:** Tailwind CSS 4 with custom editorial print design system (unbleached paper backgrounds, tactile borders, dynamic status badges, mono typography)
  - **Routing:** React Router v7 with protected route wrappers and role-based guards
  - **Icons & Telemetry:** Material Symbols and bespoke automotive blueprint SVGs
- **Backend:**
  - **Runtime & Server:** Node.js 22 LTS with Express 4.21
  - **Language:** TypeScript 5.8 compiled via `tsc` / executed in development via `tsx`
  - **Validation & Security:** Zod request parsing, `bcryptjs` password hashing, `jsonwebtoken` bearer token authentication, Helmet HTTP header protection, CORS origin whitelisting
  - **Database Driver:** `pg` (node-postgres) with connection pooling and explicit transaction management (`BEGIN` / `COMMIT` / `ROLLBACK`)
- **Persistence & Schema Management:**
  - **Local Development:** PostgreSQL 17 Alpine via Docker Compose
  - **Cloud Hosting:** Neon Serverless PostgreSQL with connection pooling (PgBouncer)
  - **Migrations:** Pure, reproducible SQL migrations tracked in `schema_migrations`
- **Testing & Quality Assurance:**
  - **Backend:** Vitest and Supertest testing all API routes, row-locking transactions, and live PostgreSQL integration suites (19 test files, 126 tests)
  - **Frontend:** Vitest with React Testing Library and jsdom simulating user workflows, auth state, and catalogue filters (9 test files, 36 tests)
  - **Linting & Type Safety:** Strict TypeScript compilation with zero implicit any

---

## Repository Layout & Workspace Structure

Creaseline is organized as a clean npm workspace monorepo:

```text
dealership-inventory/
├── backend/                      # Express API, PostgreSQL migrations, and backend tests
│   ├── data/                     # Seed datasets (vehicles.seed.json, demo.seed.json)
│   ├── migrations/               # Sequential, reproducible pure SQL migrations (001–006)
│   ├── public/images/vehicles/   # 30 pre-cached WebP front-3/4 studio renders
│   ├── src/
│   │   ├── controllers/          # HTTP request handlers (auth, vehicles, cart, etc.)
│   │   ├── middleware/           # Auth verification, role guards, error handling
│   │   ├── scripts/              # Seeders, admin provisioning, image audit tools
│   │   ├── services/             # Core business rules, transactions, stock mechanics
│   │   ├── db.ts                 # PostgreSQL connection pool configuration
│   │   ├── index.ts              # Express application entrypoint
│   │   └── migrate.ts            # Transactional migration runner
│   └── tests/                    # Unit, Supertest, and PostgreSQL integration suites
├── frontend/                     # React 19 / Vite single-page application
│   ├── public/images/vehicles/   # Static WebP vehicle assets mirrored for CDN delivery
│   ├── src/
│   │   ├── api/                  # Typed API client, endpoints, and URL resolvers
│   │   ├── components/           # Reusable UI (AppShell, AdminShell, VehicleCard, etc.)
│   │   ├── features/auth/        # Auth context, provider, and route protection
│   │   ├── pages/                # Views (HomePage, CataloguePage, Detail, Cart, Admin)
│   │   └── index.css             # Tailwind 4 design system tokens and tactile styles
│   └── tests/                    # Vitest and Testing Library test specs
├── docs/                         # Technical architecture documentation
│   ├── screenshots/              # 9 genuine application screenshots
│   ├── database-design.md        # Comprehensive 11-table schema data dictionary
│   └── frontend-retrospective.md # Design system and UX audit documentation
├── docker-compose.yml            # Multi-container orchestration (DB, API, Frontend)
├── Dockerfile.backend            # Multi-stage Node 22 Alpine build for API
├── Dockerfile.frontend           # Multi-stage Node 22 Alpine build for Vite SPA
├── render.yaml                   # Production Render Blueprint configuration
├── PROMPTS.md                    # Verbatim AI interaction log (Kata requirement)
└── package.json                  # Root workspace configuration and npm scripts
```

---

## Quickstart: One-Command Local Startup (Docker Compose)

The entire Creaseline stack (PostgreSQL 17, Express/TypeScript API, and React 19/Vite Frontend) runs locally with a single command using Docker Desktop.

### Prerequisites
- **Docker Desktop** installed and running (with WSL 2 backend on Windows).
- Node.js 20+ (for local test running).

### Startup Instructions

1. **Clone repository and configure local environment:**
   ```powershell
   git clone https://github.com/Qusai7-04/dealership-inventory.git
   cd "dealership-inventory"
   Copy-Item .env.example .env
   ```
   *(The default `.env.example` comes pre-configured for Docker Compose local networking).*

2. **Launch all services:**
   ```powershell
   docker compose up --build
   ```

3. **What happens automatically:**
   - Starts **PostgreSQL 17** container on host port `5433` (mapped from container `5432`).
   - Waits for PostgreSQL to pass internal health check (`pg_isready`).
   - Starts **Backend API** container on port `3000`, runs `npm run migrate` automatically, and seeds the 35-vehicle catalogue on first launch.
   - Waits for Backend `/health` to return HTTP 200.
   - Starts **Frontend Vite SPA** container on port `5173`.

4. **Access the application in your browser:**
   - **Frontend Application:** `http://localhost:5173`
   - **Backend API Health:** `http://localhost:3000/health`
   - **Database Health:** `http://localhost:3000/health/db`

5. **Stop containers safely (strictly preserves database volume):**
   ```powershell
   docker compose down
   ```
   *(Never pass `-v` unless you intentionally want to delete persistent database data).*

---

## Native Local Development (PowerShell / npm)

If you prefer running services directly on your host machine without Docker Compose:

### 1. Start Local PostgreSQL
Ensure a local PostgreSQL instance is running on port `5433` (or start via `npm run db:up`).

### 2. Configure Local Environment (`.env`)
Ensure `.env` in the repository root has your credentials:
```env
PORT=3000
DATABASE_URL=postgresql://dealership_app:local_dev_password_123@localhost:5433/dealership_inventory
TEST_DATABASE_URL=postgresql://dealership_app:local_dev_password_123@localhost:5433/dealership_inventory_test
JWT_SECRET=super-secret-development-jwt-token-key-minimum-32-chars-long
JWT_EXPIRES_IN_SECONDS=3600
CORS_ORIGIN=http://localhost:5173
```

### 3. Initialize Database & Seed Inventory
```powershell
# Install root and workspace dependencies
npm install

# Run database schema migrations
npm run migrate

# Seed 35 showroom vehicles and initial opening stock receipts
npm run db:seed:vehicles

# Optional: Provision an administrator account locally
npm run db:create-admin -- admin@creaseline.local LocalAdminPass123! "Creaseline Admin"
```

### 4. Start Development Servers
```powershell
# Run backend (port 3000) and frontend (port 5173) concurrently:
npm run dev

# Or run them in separate terminals:
npm run dev:backend
npm run dev:frontend
```

---

## Testing & Verification Commands

All unit, integration, and build checks are executable from the root workspace:

| Target | Command | Description |
|---|---|---|
| **Backend Tests** | `npm run test:backend` | Runs all 126 backend unit and Supertest API tests (19 test suites) |
| **Frontend Tests** | `npm run test:frontend` | Runs all 36 frontend Vitest and Testing Library component tests (9 test suites) |
| **All Tests** | `npm test` | Runs backend test suite |
| **Production Build** | `npm run build` | Compiles both backend TypeScript (`dist`) and frontend Vite bundle (`dist`) |
| **Image Audit** | `npm run db:audit-images` | Verifies database image references against physical assets on disk |
| **Git Diff Check** | `git diff --check` | Confirms clean formatting with zero whitespace errors |

---

## Database Architecture & Data Dictionary

Creaseline utilizes an 11-table relational schema designed for third normal form, auditability, and relational integrity. Full column definitions and constraints are documented in [Database Design Document](docs/database-design.md).

```mermaid
erDiagram
    users ||--o{ stock_receipts : records
    users ||--o{ favourites : saves
    users ||--o| carts : owns
    users ||--o{ purchases : makes
    users ||--o{ notifications : receives
    vehicle_categories ||--o{ vehicles : classifies
    vehicles ||--o{ vehicle_images : displays
    vehicles ||--o{ stock_receipts : receives
    vehicles ||--o{ favourites : saved_in
    vehicles ||--o{ cart_items : selected_in
    vehicles ||--o{ purchase_items : sold_as
    vehicles |o--o{ notifications : concerns
    carts ||--o{ cart_items : contains
    purchases ||--|{ purchase_items : contains

    users {
        uuid id PK
        text full_name
        text email UK
        text password_hash
        text role
        boolean is_active
        timestamptz created_at
    }
    vehicles {
        uuid id PK
        text make
        text model
        int category_id FK
        numeric price
        int quantity
        int low_stock_threshold
        timestamptz deleted_at
    }
    stock_receipts {
        uuid id PK
        uuid vehicle_id FK
        uuid actor_id FK
        text kind
        int quantity_added
        uuid request_id UK
        int resulting_quantity
        timestamptz created_at
    }
    purchases {
        uuid id PK
        uuid user_id FK
        text source
        uuid request_id UK
        numeric total_price
        timestamptz purchased_at
    }
    purchase_items {
        uuid id PK
        uuid purchase_id FK
        uuid vehicle_id FK
        text vehicle_label
        numeric unit_price
    }
    favourites {
        uuid user_id PK,FK
        uuid vehicle_id PK,FK
        boolean notify_on_restock
    }
    carts {
        uuid id PK
        uuid user_id FK,UK
    }
    cart_items {
        uuid cart_id PK,FK
        uuid vehicle_id PK,FK
    }
    notifications {
        uuid id PK
        uuid recipient_id FK
        uuid vehicle_id FK
        text type
        text message
        timestamptz read_at
    }
```

---

## REST API Reference

All protected endpoints require an `Authorization: Bearer <token>` header containing a valid JWT.

### Authentication Endpoints
- `POST /api/auth/register` — Public. Registers a standard shopper (`role: "user"`).
- `POST /api/auth/login` — Public. Returns signed JWT bearer token and user profile.
- `GET /api/auth/me` — Authenticated. Returns current validated user profile from database.

### Vehicle Catalogue Endpoints
- `GET /api/vehicles` — Authenticated. Paginated vehicle list supporting `page`, `limit`, `search`, `categoryId`, `minPrice`, `maxPrice`, `available`, `sort`, and `direction`.
- `GET /api/vehicles/search` — Authenticated. Alias for vehicle listing with filters.
- `GET /api/vehicles/:id` — Authenticated. Detailed vehicle record with images and category.
- `POST /api/vehicles` — **Admin Only**. Creates a stock line. If quantity $> 0$, records an opening receipt in `stock_receipts`.
- `PUT /api/vehicles/:id` — **Admin Only**. Updates make, model, category, price, or threshold. *Cannot modify stock quantity*.
- `DELETE /api/vehicles/:id` — **Admin Only**. Soft-deletes a listing (`deleted_at`), removing it from the floor.
- `POST /api/vehicles/:id/restock` — **Admin Only**. Atomically adds stock and writes an idempotent receipt.
- `POST /api/vehicles/:id/generate-image` — **Admin Only**. Generates front-3/4 render for a newly catalogued vehicle.
- `GET /api/vehicles/:id/stock-receipts` — **Admin Only**. Retrieves chronological stock audit trail.
- `GET /api/admin/inventory-summary` — **Admin Only**. Returns aggregate floor counts, stock metrics, and valuations.
- `GET /api/vehicle-categories` — Authenticated. Returns active category classification list.

### Direct Purchase & Cart Requisition Endpoints
- `POST /api/vehicles/:id/purchase` — Authenticated. Idempotent direct purchase of one unit. Requires `{"requestId": "<uuid>"}`.
- `GET /api/cart` — Authenticated. Retrieves active cart, gathered items, item count, and server subtotal.
- `POST /api/cart/items` — Authenticated. Adds one unit of vehicle to cart.
- `DELETE /api/cart/items/:vehicleId` — Authenticated. Removes vehicle from cart.
- `DELETE /api/cart` — Authenticated. Clears all items from cart.
- `POST /api/cart/checkout` — Authenticated. Atomically purchases all confirmed cart items. Requires `{"requestId": "<uuid>", "items": [...]}`.
- `GET /api/purchases` — Authenticated. Retrieves historical purchase records and immutable line item vouchers.

### Favourites & Notifications Endpoints
- `GET /api/favourites` — Authenticated. Lists saved vehicles with stock and restock alert preferences.
- `PUT /api/favourites/:vehicleId` — Authenticated. Saves vehicle to watchlist.
- `DELETE /api/favourites/:vehicleId` — Authenticated. Removes vehicle from watchlist.
- `PATCH /api/favourites/:vehicleId/notification-preference` — Authenticated. Updates `notifyOnRestock` boolean.
- `GET /api/notifications` — Authenticated. Paginated in-app notifications with unread counter.
- `PATCH /api/notifications/:id/read` — Authenticated. Marks notification as read with timestamp.

---

## Production Deployment Guides

Creaseline is ready to deploy across major cloud platforms. Detailed guides are provided for both Render Blueprint and Free Vercel Hobby + Neon PostgreSQL.

### Option A: Render Blueprint (`render.yaml`)
The repository includes a ready-to-use Render Blueprint file ([render.yaml](render.yaml)) orchestrating the Web Service, Static Site, and Managed PostgreSQL instance.

1. Connect the repository in the [Render Dashboard](https://dashboard.render.com).
2. Select **Blueprint** and connect `dealership-inventory`.
3. Render provisions the PostgreSQL database, Express API service (`creaseline-api`), and static frontend (`creaseline`).
4. Apply migrations on production:
   ```bash
   DATABASE_URL="<production-connection-string>" npm run migrate
   ```

### Option B: Free Vercel Hobby & Neon Free PostgreSQL
For personal portfolio demonstration, Creaseline runs free of hosting costs using two linked Vercel projects and Neon Serverless PostgreSQL.

1. **Database:** Create a free project on [Neon](https://console.neon.tech). Obtain both the **Pooled connection string** (for serverless runtime) and **Direct connection string** (for migrations).
2. **Apply Migrations to Neon:**
   ```powershell
   $env:MIGRATION_DATABASE_URL = "postgresql://[user]:[password]@ep-xxxx.neon.tech/neondb?sslmode=require"
   npm run migrate --workspace backend
   ```
3. **Seed Initial Catalogue:**
   ```powershell
   $env:DATABASE_URL = "postgresql://[user]:[password]@ep-xxxx-pooler.neon.tech/neondb?sslmode=require"
   npm run db:seed:vehicles --workspace backend
   ```
4. **Backend Vercel Project:** Link repo to Vercel with root directory `backend`, framework preset `Other`, and environment variables `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, and `NODE_ENV=production`.
5. **Frontend Vercel Project:** Link repo to Vercel with root directory `frontend`, framework preset `Vite`, and environment variable `VITE_API_BASE_URL` pointing to your deployed backend origin.

---

## Licensing, Legal, and Asset Caveats

### 1. Vehicle Dataset Licensing (Commercial Release Blocker)
- **Source Dataset:** `Car Data India` from Kaggle (`namanarora21/car-data-india-market-usage-and-body-type-insights`).
- **Legal Status:** The source dataset is synthetic market data. Kaggle dataset terms and open database redistribution rights for this specific compilation have not been commercially certified.
- **Release Status: UNRESOLVED RELEASE BLOCKER FOR COMMERCIAL USE.**
  - **Permitted Use:** Private testing, educational kata demonstration, evaluation, and portfolio staging deployments.
  - **Commercial Use: STRICTLY BLOCKED.** Before launching Creaseline as a commercial offering or public service, replace this dataset with a commercially licensed vehicle inventory feed or authorized Dealer Management System (DMS) export.
- **Replacement Strategy:** Update `backend/data/vehicles.seed.json` with authorized dealer inventory conforming to the `VehicleSeedItem` TypeScript interface, then re-seed on a fresh database.

### 2. Vehicle Imagery Licensing & Disclaimer
- **Image Provider:** Studio renders from [carimage.dev](https://carimage.dev).
- **Licence Terms:** `carimage.dev` Free Evaluation tier allows non-commercial and evaluation usage only. Commercial usage requires a paid commercial license tier.
- **Accuracy Disclaimer:** The images served by Creaseline are synthetic studio renders and illustrations. They **do not represent actual, photographed, or manufacturer-certified vehicles** in inventory.
- **User Interface Notice:** The frontend renders these assets as illustrative renders and provides neutral fallbacks for listings without renders. They are never represented to consumers as certified OEM photographs.

---

## My AI Usage

In compliance with the Incubyte Full-Stack Software Engineer Assessment requirements, this section transparently discloses the AI tooling utilized during the development, testing, and documentation of Creaseline:

1. **AI Assistants Employed:**
   - **Codex (OpenAI):** Primary code generation, test drafting (TDD red-green cycles), and initial schema scaffolding.
   - **Gemini (Google DeepMind):** Architectural review, PostgreSQL row-locking transaction optimization, Vercel/Neon deployment troubleshooting, comprehensive documentation structuring, and genuine browser automation for screenshot verification.
2. **Specific Roles & Responsibilities:**
   - **Architecture & Schema Design:** Validated third normal form schema and designed the double-entry `stock_receipts` ledger to prevent inventory race conditions and unrecorded modifications.
   - **Test-Driven Development (TDD):** Drafted failing tests for direct purchase row-locking, multi-item cart checkout deadlock prevention, idempotent request replays, and role-based access control before implementing service logic.
   - **Image Caching & Delivery Pipeline:** Engineered the local static WebP asset caching system to eliminate external API credit exhaustion in production while providing an architectural SVG blueprint fallback.
   - **Documentation & Visual Evidence:** Captured authentic screenshots from the running local application across all core workflows (Catalogue, Search/Filter, Vehicle Detail, Cart Voucher, Admin Console, and Stock History Modal) and compiled this comprehensive project manual.
3. **Commit History & Trailer Integrity:**
   - All AI-assisted commits include the standard co-author trailer: `Co-authored-by: Codex <noreply@openai.com>` (or relevant assistant identifier).
   - All user prompts have been preserved verbatim in [PROMPTS.md](PROMPTS.md) across all development sessions.
