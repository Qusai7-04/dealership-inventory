# Car Dealership Inventory System

The Incubyte full-stack kata for a shared, login-protected vehicle catalogue. The TypeScript/Express backend includes PostgreSQL health checks, migrations, authentication, authorization, and vehicle inventory APIs. The React/Tailwind frontend currently provides the application scaffold; inventory screens are not implemented yet.

## Product and assignment scope

A `vehicles` row is a stock line for interchangeable units of one make and model/variant, not a physical car identified by VIN. Its `quantity` is shared across every user. A purchase records a sale and reduces that quantity by one; it does not collect payment. Zero-stock active listings remain visible so the required Purchase button can be shown disabled. Soft-deleted listings are excluded from normal browsing.

| Source | Functionality |
|---|---|
| Incubyte requirements | Registration and login with token authentication; persistent database; protected vehicle listing, search, add and update; admin deletion and restock; direct one-unit purchase; React SPA using HTML5, CSS3 and Tailwind; disabled Purchase button at zero stock; TDD, tests, README, AI disclosure and `PROMPTS.md`. |
| Chosen extensions | Ordered vehicle images; favourites and opt-in restock alerts; reusable cart with atomic checkout; purchase and stock-receipt history; targeted in-app notifications. |

The cart supplements the required `POST /api/vehicles/:id/purchase` direct-purchase endpoint. It gathers one unit of each selected vehicle, without reserving stock, and buys them together only at checkout. There is no payment processing, rental booking, financing, supplier management, multi-branch stock, reservation, return/refund flow, or VIN-level tracking.

The brief describes vehicle operations as protected, explicitly limits deletion and restock to admins, and shows admin-only listing controls in the frontend. **Project interpretation:** authenticated `user` and `admin` roles may browse, search, purchase, and manage their own cart, favourites, and notifications; only `admin` may create, edit, soft-delete, or restock listings and manage images. Registration always creates a `user`; client input cannot assign `admin`. Every permission must be enforced by the server, as well as reflected in the UI.

| Method and exact required route | Access | Effect |
|---|---|---|
| `POST /api/auth/register` | Public | Register a normal user |
| `POST /api/auth/login` | Public | Return an authentication token |
| `POST /api/vehicles` | Admin | Create listing and opening-stock receipt when quantity is positive |
| `GET /api/vehicles` | Authenticated | List active listings, including zero stock |
| `GET /api/vehicles/search` | Authenticated | Filter active listings using the same query parameters |
| `PUT /api/vehicles/:id` | Admin | Edit catalogue details, never quantity directly |
| `DELETE /api/vehicles/:id` | Admin | Soft-delete listing |
| `POST /api/vehicles/:id/purchase` | Authenticated | Buy one unit immediately |
| `POST /api/vehicles/:id/restock` | Admin | Add positive stock and record receipt |

The selected backend stack is Node.js/TypeScript with Express and `pg`, **PostgreSQL** for persistence, and React with HTML5, CSS3, and Tailwind CSS for the planned SPA. The implementation should keep routes/controllers, business logic, and database access separate.

## Repository layout and commands

```text
backend/       Express application, PostgreSQL migrations, and backend tests
frontend/      Vite React application and Tailwind styles
docs/          Project and database design documentation
reference-docs Assignment source documents (kept local by `.gitignore`)
```

Run `npm install` once from the repository root. The root npm workspace then provides these commands:

| Command | Purpose |
|---|---|
| `npm test` | Run all backend unit and PostgreSQL integration tests |
| `npm run build` | Build the backend and frontend |
| `npm run build:backend` | Build only the backend |
| `npm run build:frontend` | Build only the frontend |
| `npm run migrate` | Build the backend and apply pending migrations |
| `npm run dev:backend` | Run the backend in watch mode on port 3000 by default |
| `npm run dev:frontend` | Run the frontend development server on port 5173 by default |
| `npm start` | Start the compiled backend |

The frontend development server proxies `/api` and `/health` to `http://localhost:3000`. It communicates with PostgreSQL only through the backend HTTP API.

## Database overview

The eleven-table design and column-by-column data dictionary are in [Database design](docs/database-design.md).

| Table | Purpose | Key relationships |
|---|---|---|
| `users` | Credentials, role, account flags | Parent of purchases, receipts, favourites, carts, notifications |
| `vehicle_categories` | Normalised body styles | One category classifies many vehicles |
| `vehicles` | Catalogue and current shared quantity | One vehicle has images, receipts, cart links, favourites, sale items, notifications |
| `vehicle_images` | Ordered image references and alt text | Many per vehicle |
| `stock_receipts` | Opening and restock additions | Many per vehicle and actor |
| `favourites` | Saved vehicles and alert preference | User–vehicle many-to-many bridge |
| `carts` | One reusable cart per user | Zero or one per user |
| `cart_items` | One selected unit per vehicle | Cart–vehicle many-to-many bridge |
| `purchases` | Completed direct sale or checkout header | Many per user; each has one or more items |
| `purchase_items` | Immutable sold-unit label and price | Purchase–vehicle historical bridge |
| `notifications` | In-app messages for explicit recipients | Many per user; optionally linked to a vehicle |

### Entity relationships

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
        text email
        text password_hash
        text role
        boolean is_verified
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }
    vehicle_categories {
        int id PK
        text name
    }
    vehicles {
        uuid id PK
        text make
        text model
        int category_id FK
        numeric price
        int quantity
        int low_stock_threshold
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }
    vehicle_images {
        uuid id PK
        uuid vehicle_id FK
        text url
        text alt_text
        int display_order
        timestamptz created_at
    }
    stock_receipts {
        uuid id PK
        uuid vehicle_id FK
        uuid actor_id FK
        text kind
        int quantity_added
        uuid request_id
        int resulting_quantity
        timestamptz created_at
    }
    favourites {
        uuid user_id PK,FK
        uuid vehicle_id PK,FK
        boolean notify_on_restock
        timestamptz created_at
    }
    carts {
        uuid id PK
        uuid user_id FK
        timestamptz created_at
        timestamptz updated_at
    }
    cart_items {
        uuid cart_id PK,FK
        uuid vehicle_id PK,FK
        timestamptz added_at
    }
    purchases {
        uuid id PK
        uuid user_id FK
        text source
        uuid request_id
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
    notifications {
        uuid id PK
        uuid recipient_id FK
        uuid vehicle_id FK
        text type
        text event_key
        text message
        timestamptz created_at
        timestamptz read_at
    }
```

The three bridge tables are `favourites` (saved user–vehicle links), `cart_items` (selected cart–vehicle links), and `purchase_items` (historical purchase–vehicle links). `users` to `carts` is at most one cart per user. A completed purchase must have at least one item; application transaction logic enforces that cross-row invariant. The optional vehicle end of `notifications` means a notification may have no related vehicle.

## Integrity and workflows

PostgreSQL will enforce primary/foreign keys; case-insensitive unique email and category names; one active `(make, model)` stock line; nonblank labels; nonnegative prices, stock, and thresholds; positive receipts; unique image positions; unique favourite/cart pairs; one cart per user; and unique request/event keys. The identity rule may need to include year or trim if those become separate stock lines. Indexes serve active category/price search, vehicle sales history, ordered images, and recipient inbox lookup. [Database design](docs/database-design.md#indexes-and-constraints) lists every planned index and its reason.

Physical deletion is restricted for users, vehicles, categories, purchases, receipts, and sale items where it would destroy history. Vehicle deletion sets `deleted_at`; old purchase snapshots remain readable. Cart, favourite, and image data are removed only through explicit user/admin actions in this version. Images are URL/reference rows, not raw binary columns; the lowest `display_order` is the cover.

| Workflow | Transaction rule |
|---|---|
| Create listing | Admin creates vehicle at quantity zero; if opening quantity is positive, insert one `opening` receipt and set quantity in the same transaction. |
| Direct purchase | Reuse an earlier result for the same user/request key; otherwise lock an active vehicle with stock, record header and one label/price snapshot, decrement one, create threshold alerts, and commit together. |
| Restock | Admin supplies a positive increment and request key; lock vehicle, update quantity, insert `restock` receipt, create eligible back-in-stock alerts, and commit together. |
| Cart checkout | Lock cart and vehicle rows in stable order; recheck active status, stock, and user-confirmed current prices. On conflict return refreshed cart without any sale. Otherwise make one header and one item per vehicle, decrement all, remove bought cart items, create alerts, and commit together. |
| Notifications | Crossing from above threshold to positive low stock or from positive stock to zero alerts admins. Zero-to-positive restock alerts only favourites with `notify_on_restock = true`. Every row has one recipient and stable event key; recipients can read/mark only their own rows. |

Cart additions and favourites never change stock. Cart checkout is all-or-nothing so users never receive an unintended partial purchase. The reconciliation rule for each vehicle is `current quantity = SUM(opening/restock quantity_added) - COUNT(completed purchase_items)`. Cross-table totals and stock changes require one transaction and application checks; a `CHECK` constraint alone cannot enforce them. `purchases.total_price` must equal the sum of its item price snapshots before commit. Retried successful requests return the original result rather than repeating stock changes.

## PostgreSQL setup (Docker Compose)

The development environment uses Docker Compose to run PostgreSQL 17 in an isolated container on host port **5433** (mapped to container port 5432) to avoid conflicts with any local host PostgreSQL instance.

1. **Configure local environment:**
   Copy `.env.example` to `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```
   Set your local development password in `.env`. Never commit `.env` or real credentials to Git.

2. **Start the database:**
   ```powershell
   npm run db:up
   # or: docker compose up -d
   ```

3. **Check container health:**
   ```powershell
   docker compose ps
   # STATUS should report: Up ... (healthy)
   ```

4. **Apply database migrations:**
   ```powershell
   npm run migrate
   ```
   The migration runner executes pending scripts in `backend/migrations/` inside transactions and tracks them in `schema_migrations`.

5. **Verify database relations:**
   ```powershell
   docker compose exec db psql -U dealership_app -d dealership_inventory -c "\dt"
   ```
   Confirms `schema_migrations`, `users`, `vehicle_categories`, and `vehicles` exist.

6. **Safe cleanup (stop database):**
   ```powershell
   npm run db:down
   # or: docker compose down
   ```
   This stops and removes the container and network while preserving the persistent named volume (`postgres_data`). Do **not** use `-v` during normal cleanup.

## Backend foundation

Run `npm run dev:backend` for backend development or `npm run build:backend` and `npm start` for the compiled server. The default port is 3000; set the `PORT` environment variable to change it. Keep `.env` at the repository root; workspace commands load it from there.
- `GET /health` returns `{"status":"ok"}` (liveness check, does not require PostgreSQL).
- `GET /health/db` checks live database connectivity via `SELECT 1;` and returns `{"status":"ok","database":"connected"}` or `503` if unreachable.
- Set `TEST_DATABASE_URL` to a dedicated database whose name ends in `_test`, then run `npm test`. Integration tests fail fast instead of falling back to the development database.
- Run `npm run migrate` to apply pending PostgreSQL schema migrations.

## Authentication API

Set `JWT_SECRET` to a random value of at least 32 characters and optionally set `JWT_EXPIRES_IN_SECONDS` (default `3600`). The server refuses to start without a valid secret. Integration tests require `TEST_DATABASE_URL` and accept only a database name ending in `_test`.

Register a normal user. Extra privilege fields are ignored and the server always assigns `role: "user"`:

```http
POST /api/auth/register
Content-Type: application/json

{"fullName":"Ada Lovelace","email":"ada@example.com","password":"StrongPass123!"}
```

```json
{"user":{"id":"<uuid>","fullName":"Ada Lovelace","email":"ada@example.com","role":"user","isVerified":false,"isActive":true}}
```

Log in with the same email and password:

```http
POST /api/auth/login
Content-Type: application/json

{"email":"ada@example.com","password":"StrongPass123!"}
```

The response contains `token` and the same safe user fields. Send the token on protected requests as `Authorization: Bearer <token>`. For example, `GET /api/auth/me` returns the current active user. Authentication reloads the user and role from PostgreSQL, so deactivation and role changes take effect without waiting for an old token to expire. Admin routes can reuse `authenticate` followed by `requireRole('admin')`.

Run the full unit and live PostgreSQL integration suite in PowerShell:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://dealership_app:<password>@localhost:5433/dealership_inventory_test'
npm test
```

## Vehicle inventory API

Authenticated catalogue reads exclude soft-deleted vehicles:

| Method and route | Access | Purpose |
|---|---|---|
| `GET /api/vehicles` | Authenticated | Paginated vehicle list |
| `GET /api/vehicles/search` | Authenticated | Alias for the filtered vehicle list |
| `GET /api/vehicles/:id` | Authenticated | Active vehicle details |
| `POST /api/vehicles` | Admin | Create a stock line and opening receipt |
| `PUT /api/vehicles/:id` | Admin | Edit catalogue fields without changing quantity |
| `DELETE /api/vehicles/:id` | Admin | Soft-delete a stock line |
| `POST /api/vehicles/:id/restock` | Admin | Atomically add stock and record an idempotent receipt |

List query parameters are `page` (default 1), `limit` (default 20, maximum 100), `search` (make or model), `categoryId`, `minPrice`, `maxPrice`, `available`, `sort` (`make`, `model`, `price`, `quantity`, or `createdAt`), and `direction` (`asc` or `desc`). Responses contain `vehicles` and `{page, limit, total, totalPages}` pagination metadata.

An admin creates a vehicle using a bearer token:

```http
POST /api/vehicles
Authorization: Bearer <token>
Content-Type: application/json

{"make":"Toyota","model":"Corolla","categoryId":1,"price":25000,"quantity":4,"lowStockThreshold":3}
```

`make`, `model`, `categoryId`, and `price` are required. `quantity` defaults to zero and `lowStockThreshold` defaults to three. Price accepts zero or a positive JSON number with at most two decimal places. Quantities and thresholds must be non-negative integers. Updates accept only `make`, `model`, `categoryId`, `price`, and `lowStockThreshold`; stock cannot be edited through the general update route.

Restocking requires a positive integer and a UUID request key. Reusing the same key for the same admin, vehicle, and quantity returns the existing result without adding stock twice:

```http
POST /api/vehicles/<vehicle-id>/restock
Authorization: Bearer <token>
Content-Type: application/json

{"quantity":5,"requestId":"<uuid>"}
```

Migrations `002_create_stock_receipts.sql` and `003_add_stock_receipt_result_quantity.sql` record opening inventory, restocks, and the quantity returned by an idempotent replay. Stock changes and their receipt records commit together, while PostgreSQL atomic updates prevent concurrent restocks from overwriting each other.

## My AI Usage

Codex was used to review the assignment and database design, draft and revise TypeScript/SQL implementation, write Vitest and Supertest tests, run PostgreSQL integration checks, diagnose failures, and document the verified behavior. The original feature commits combined tests and implementation; the later remediation commits record truthful test-first red and green steps without rewriting that history. The project owner still needs to add their personal reflection before submission.

[PROMPTS.md](PROMPTS.md) preserves exact user prompts recovered from accessible Codex history. It does not yet contain the raw, unedited AI response logs or public chat links required by the Kata; the project owner must add those original records. Every AI-assisted commit uses the `Co-authored-by:` trailer.
