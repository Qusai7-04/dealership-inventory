# PROMPTS.md

Raw prompts used while building this project. These prompt-only entries are not complete chat transcripts. Add raw, unedited AI chat logs or public chat links before submission, as the assignment requires.

## Sessions

### Session: Initial planning and database design (2026-10-25)

# Car Dealership Inventory System — Initial Planning and Database Design

I want to start building this project properly before jumping into the actual application. This is my Incubyte Car Dealership Inventory System assignment, and I want the project structure, overall idea, and database design to be clear enough that I can explain the decisions line by line during an interview.

Start by carefully reading the existing repository, especially `AGENTS.md`, `README.md`, and `PROMPTS.md`. Also review the assignment requirements and the following reference material available in my local project workspace, if accessible:

- `Car Dealership Inventory System Phase Plan`
- `Car Dealership Inventory System Complete Idea and Database Design`
- `incubyte-project-ideas.md`
- `incubyte-database-schema.md`
- `Database Choice.md`
- The original Incubyte assignment PDF

These references explain the intended product, its scope, the database relationships, and the reasoning behind the selected features. Use them to understand the project before making changes. If a referenced file is unavailable in the current workspace, continue with the files that are available and the decisions recorded below rather than inventing its contents.

My objective here is to establish the project idea, make the design decisions explicit, and document a complete PostgreSQL database design. I do not want to start implementing the application yet.

## 1. Understand the application first

This is a shared car dealership catalogue and inventory management system.

The application allows authenticated users to browse available vehicle listings, search and filter vehicles, purchase a unit, save favourites, manage a cart, and receive relevant in-app notifications. Administrators manage vehicle listings, vehicle images, and stock.

This is not a car rental application, financing platform, payment gateway, or full e-commerce platform. The required purchase operation records a purchase and reduces dealership stock. It does not process actual payments.

Use the following product decisions consistently throughout the documentation:

- A `vehicles` record represents a stock line of interchangeable units for a specific make and model or variant, not one individually tracked physical car.
- Each vehicle has a current price and a quantity in stock.
- The current stock is shared across users. A purchase by one user affects the stock shown to everyone.
- The application has two roles: `user` and `admin`.
- A normal user can register, log in, browse, search, purchase directly, manage favourites and a cart, and access their own notifications.
- An admin can perform the normal user operations and additionally create, update, soft-delete, restock, and manage vehicle images.
- Public registration must never allow someone to assign themselves the admin role.
- Vehicle photographs belong in a separate table so a listing can have multiple ordered images.
- Keep the required direct-purchase functionality even though a cart is also included.

The assignment's exact API routes and the final permission interpretation must be documented for the later implementation. Its text describes some operations as protected while the frontend describes vehicle-management controls as admin-only. For this project, use the more restrictive, consistent policy: authenticated users may browse, search, purchase, and manage their own user-specific data; only admins may create, update, soft-delete, or restock vehicle listings and manage their images. Clearly identify this as the chosen interpretation, rather than claiming every permission was explicitly stated that way in the original brief.

## 2. Separate required functionality from additional features

The project documentation must make it easy to distinguish what Incubyte explicitly requires from the features I am choosing to add.

The required assignment functionality includes:

- User registration and login with token-based authentication.
- A persistent database.
- Protected vehicle listing, searching, adding, and updating operations, with the documented role policy applied consistently.
- Vehicle search by make, model, category, and price range.
- Vehicle deletion restricted to admins.
- Direct vehicle purchase, which decreases the quantity by one.
- Admin-only restocking.
- A React single-page frontend using HTML5, CSS3, and Tailwind CSS.
- A purchase button that is disabled when the quantity is zero.
- Automated tests, a comprehensive README, an honest AI-usage section, and a root-level `PROMPTS.md`.

The selected extensions are:

- Multiple vehicle images with an explicit display order.
- Favourites with an optional restock-notification preference.
- A reusable cart and atomic cart checkout.
- Purchase and stock-receipt history.
- Targeted, in-app stock notifications.

Do not introduce payment processing, rental bookings, reservations, financing, suppliers, multiple dealership branches, returns, refunds, or physical VIN-level inventory tracking. These are outside the current scope.

The README should explain why the cart is an extension rather than a replacement for the required direct-purchase API.

## 3. Finalise the PostgreSQL database design

Use **PostgreSQL** as the database for this project. Do not switch to SQLite, MongoDB, or an in-memory database.

The database design should use understandable SQL concepts that I can explain, including primary keys, foreign keys, composite keys, unique constraints, check constraints, joins, indexes, and transactions.

Use the following eleven tables as the intended baseline. Review the references and make only justified, clearly documented corrections if needed.

### A. `users`

Purpose: Stores authentication identities and application roles.

Include the appropriate fields for:

- UUID primary key.
- Full name.
- Email address.
- Secure password hash.
- Role (`user` or `admin`).
- Account verification and active-state flags, where appropriate.
- Creation and update timestamps.

Email uniqueness must be case-insensitive. Passwords must never be stored in plaintext. Explain why the role defaults to `user` and why registration cannot set an admin role.

### B. `vehicle_categories`

Purpose: Provides a normalised lookup for vehicle body-style categories such as Sedan, SUV, Hatchback, Coupe, Pickup, and Van.

Include an identity primary key and unique category name. Explain why storing a category reference in `vehicles` is preferable to allowing inconsistent free-text values.

### C. `vehicles`

Purpose: Stores vehicle catalogue details and the current quantity available for the dealership.

Include:

- UUID primary key.
- Make and model or variant label.
- Foreign key to `vehicle_categories`.
- Current price.
- Current stock quantity.
- Low-stock threshold.
- Creation and update timestamps.
- Nullable `deleted_at` for soft deletion.
- Any other field justified by the references.

Use suitable types such as `numeric(12,2)` for money, integer quantities, and `timestamptz` for timestamps.

Add appropriate checks so prices and quantities cannot be negative, and the low-stock threshold cannot be negative. Require nonblank make and model values.

Do not add a unique VIN constraint because a row represents a stock line that may contain multiple units. Do not persist a separate availability status if it can safely be derived from the quantity and soft-deletion state.

If uniqueness is enforced for active `(make, model)` combinations, explain that this defines the current vehicle identity rule and may need extending if the project later distinguishes years or variants more precisely.

### D. `vehicle_images`

Purpose: Stores multiple photographs for each vehicle listing.

Include a UUID primary key, vehicle foreign key, image URL or reference, accessible alternative text, display order, and creation timestamp.

Enforce nonnegative display order and uniqueness of display positions within a vehicle. Explain why image references are stored rather than raw image binaries and how the application selects the cover image.

### E. `stock_receipts`

Purpose: Records the addition of stock, including initial stock when a vehicle is created and subsequent admin restocks.

Include a UUID primary key, vehicle foreign key, actor/user foreign key, receipt type, positive quantity added, request/idempotency identifier where appropriate, and creation timestamp.

Distinguish opening stock from a later restock. Explain how recording these events makes stock history auditable and how a retry of the same restock request must not increase stock twice.

### F. `favourites`

Purpose: Stores users' saved vehicles and their optional restock-notification preferences.

Use a composite primary key involving `user_id` and `vehicle_id`, plus the notification preference and creation timestamp.

Explain why this is a many-to-many relationship and why a user must not be able to create duplicate favourites. An out-of-stock vehicle may still be favourited.

### G. `carts`

Purpose: Stores the reusable cart belonging to a user.

Include a UUID primary key, user foreign key, and creation/update timestamps. Add a unique constraint on `user_id` so each user has one reusable cart.

### H. `cart_items`

Purpose: Stores the vehicles selected in a cart.

Use the cart and vehicle foreign keys as an appropriate composite primary key and include an added timestamp.

One row represents the intention to buy one unit of a selected vehicle. Do not introduce a quantity column or stored price snapshot for this design.

The cart must not reserve stock. Adding, removing, or favouriting a vehicle must not change stock.

### I. `purchases`

Purpose: Stores one completed direct purchase or one successful cart checkout.

Include a UUID primary key, purchasing user foreign key, source (`direct` or `cart`), idempotency/request identifier, total price, and purchase timestamp.

Add suitable constraints to make successful retries safe for the same user and request identifier.

Explain the difference between a purchase header and its individual purchased items.

### J. `purchase_items`

Purpose: Stores the individual vehicle units included in a completed purchase.

Include a UUID primary key, purchase foreign key, vehicle foreign key, snapshot of the vehicle label, and unit price captured when the purchase commits.

Apply a unique constraint on `(purchase_id, vehicle_id)` because the chosen cart supports at most one unit of each vehicle per purchase.

Explain why the historical item must preserve the purchase-time label and price instead of reading the current values from `vehicles` later. Make the purchase total consistent with its item snapshots and document how this invariant is validated.

### K. `notifications`

Purpose: Stores in-app messages for explicit recipients.

Include a UUID primary key, recipient/user foreign key, optional related vehicle foreign key if appropriate, notification type, stable event or idempotency identifier, message snapshot, creation timestamp, and nullable read timestamp.

Support the stock events defined below. Enforce suitable uniqueness so retrying an operation does not generate duplicate notifications for the same recipient and event.

Notifications are records shown in the application. They do not themselves send email or push messages.

## 4. Document the dependencies and relationships

For every table, explain:

1. What the table stores and why it exists.
2. Its primary key and any composite key.
3. Each foreign key, including which table it references.
4. Important unique and check constraints.
5. Its relationship cardinality with the related tables.
6. What would happen if a referenced row were deleted.
7. Which application operations create or modify its records.

At a minimum, document these relationships:

- `vehicle_categories` to `vehicles`: one category can classify many vehicles.
- `users` to `purchases`: one user can make many purchases.
- `purchases` to `purchase_items`: one completed purchase contains one or more purchase items.
- `vehicles` to `purchase_items`: one vehicle stock line can appear in many historical purchases.
- `users` to `stock_receipts`: one user can perform many stock receipts.
- `vehicles` to `stock_receipts`: one vehicle can have many stock receipts.
- `vehicles` to `vehicle_images`: one vehicle can have many images.
- `users` and `vehicles` through `favourites`: many-to-many.
- `users` to `carts`: one user has at most one cart.
- `carts` to `cart_items`: one cart contains zero or many items.
- `vehicles` to `cart_items`: one vehicle may appear in many different carts.
- `users` to `notifications`: one recipient can receive many notifications.
- `vehicles` to `notifications`: one vehicle may be associated with many notifications, where applicable.

Clearly identify all many-to-many bridge tables and explain why they are needed.

Use foreign-key deletion policies that protect purchase and stock history. In particular, prefer soft-deleting vehicle catalogue entries and restrict physical deletion where historical purchase or stock-receipt references exist. Explain the policy rather than applying cascading deletion everywhere.

## 5. Define the inventory and transaction rules

The database design is not complete unless the behaviour of the main operations is clear.

### Direct purchase

The required purchase endpoint purchases one unit of the selected vehicle immediately.

Document that the operation must:

1. Check whether the same user's request has already succeeded.
2. Start a database transaction.
3. Lock or atomically update the relevant vehicle row.
4. Verify that the vehicle is active and has stock greater than zero.
5. Record a purchase and a purchase-item snapshot.
6. Decrease quantity by one.
7. Create applicable stock notifications.
8. Commit everything together.

A failed purchase must not leave behind a partial purchase record or decrement stock incorrectly.

### Restocking

Document that restocking:

1. Is restricted to admins.
2. Requires a positive quantity.
3. Updates the vehicle stock and inserts a stock receipt in one transaction.
4. Is safe against duplicate requests using an idempotency mechanism.
5. Produces the relevant stock notifications when the stock crosses the defined thresholds.

### Opening inventory

When a new vehicle is created with an opening quantity, record the opening stock through `stock_receipts` so the inventory history has a clear starting point.

Quantity must not be changed by ordinary vehicle-edit operations. Changes to inventory must go through the designated opening-stock, purchase, and restock workflows.

### Cart behaviour

Document these rules without ambiguity:

- Adding to the cart does not reserve or reduce stock.
- A vehicle with zero stock cannot be newly added to the cart.
- A vehicle that becomes unavailable after being added may remain visible in the cart until the user removes it.
- The cart displays current vehicle price and stock information; it does not keep a historical price snapshot.
- The user must confirm the latest prices before checkout.
- Checkout rechecks availability and confirmed prices.
- If any item is unavailable or its price has changed, the entire checkout fails without purchasing any item. Return an appropriate conflict response and the refreshed cart so the user can correct it.
- On success, checkout records one purchase header, creates one purchase-item snapshot per selected vehicle, decrements the appropriate stock quantities, creates applicable notifications, and removes the successfully purchased cart items.
- All checkout changes happen in a single PostgreSQL transaction.
- Lock vehicle rows in a stable order to reduce deadlock risk.
- Repeating a successful checkout request with the same idempotency key must not create another purchase or decrement stock again.

Explain why cart checkout is all-or-nothing rather than partially completing an order.

### Stock reconciliation

Document the reconciliation principle for every vehicle:

`Current quantity = total opening/restock receipts - total completed purchase-item quantities`

In this design each purchase item represents one unit. Cart items and favourites do not participate in this calculation.

Explain that transaction boundaries and application logic must keep the live quantity consistent with purchase and stock-receipt history.

### Notification targeting

Define the initial rules as follows:

- Low-stock notification: when stock crosses from above the configured threshold to a positive quantity at or below the threshold, notify admins.
- Out-of-stock notification: when stock crosses from a positive quantity to zero, notify admins.
- Back-in-stock notification: when restocking changes stock from zero to positive, notify users who have explicitly enabled restock notifications for that vehicle in their favourites.

Avoid duplicate notifications when a request is retried. Users must only be able to read or mark their own notifications as read.

## 6. Define useful indexes and constraints

Include a data dictionary and an index/constraint table with the reason for every important choice.

Consider:

- Case-insensitive unique email.
- Case-insensitive unique category names.
- A partial unique index for active vehicle identity where that rule is used.
- Vehicle category and price filtering.
- Vehicle image ordering.
- One opening-stock receipt per vehicle.
- Idempotent restocks.
- Unique favourite pairs.
- One cart per user.
- Unique cart-item pairs.
- Idempotent purchases per user request.
- Unique purchase-item vehicle pairs.
- Purchase-item lookup by vehicle for stock history.
- Notification inbox retrieval ordered by recipient and time.
- Notification deduplication by recipient, type, and event key.

Do not add arbitrary indexes just to make the design look more advanced. Relate each index to an actual query, uniqueness rule, or integrity requirement.

Clearly distinguish constraints PostgreSQL can enforce directly from business rules that require a transaction and application logic.

## 7. Create a complete ER diagram

Create a Mermaid `erDiagram` showing all eleven tables and all of their important relationships.

The ER diagram must:

- Use the exact table names selected for the database design.
- Show the primary keys, foreign keys, and important fields.
- Show the correct cardinality of one-to-one, one-to-many, and many-to-many relationships.
- Represent the composite keys on `favourites` and `cart_items`.
- Include all eleven tables.
- Match the written data dictionary and foreign-key descriptions.
- Render correctly in GitHub Markdown.

Place the diagram directly in `README.md`, not just in a separate file or an external image link.

Also include a short plain-text relationship summary or table for readers who need to understand the connections quickly.

If you create a separate detailed design document, link it from the README. The README must still contain the actual ER diagram and a concise explanation of the core schema.

Before finishing, cross-check the Mermaid diagram against every table definition and foreign key. Do not leave missing tables, outdated relationships, mismatched names, or implied relationships that are absent from the schema.

## 8. Update `AGENTS.md`

Expand the existing agent instructions so future coding work follows the project decisions.

Include:

- Read the assignment, README, and relevant design documents before making changes.
- Keep changes small, focused, and easy to review.
- Follow test-driven development: failing test first, minimum implementation, then refactoring.
- Preserve clear, descriptive commit history and make small commits at meaningful checkpoints.
- Use PostgreSQL for persistence and ensure all database work is reproducible.
- Use parameterised SQL or the established data-access approach; never concatenate user input into SQL.
- Keep route/controller responsibilities separate from business logic and database access.
- Enforce authentication and role checks on the server, not just by hiding frontend controls.
- Preserve stock consistency through transactions and idempotent operations.
- Never store plaintext passwords, secrets, or committed local credentials.
- Update documentation and tests whenever a design decision or behaviour changes.
- Do not add dependencies or unrelated features without a clear reason.
- Do not implement application functionality before it is requested and sufficiently designed.

Keep the file concise enough to be a useful set of working rules. Do not turn it into a duplicate of the entire README.

## 9. Update `README.md`

Replace the temporary scaffold README with a useful initial project document. It must include:

1. Project title and purpose.
2. A clear explanation of the dealership inventory model.
3. User roles and permissions.
4. Required assignment features versus the selected extensions.
5. The intended technology stack, explicitly including PostgreSQL.
6. Key product decisions and out-of-scope functionality.
7. The ER diagram and relationship summary.
8. A table-by-table database overview.
9. Key constraints, indexes, deletion rules, and transaction decisions.
10. Example workflows for creating stock, direct purchase, restocking, cart checkout, and stock notifications.
11. PostgreSQL prerequisites and step-by-step database setup.
12. The intended environment configuration, using placeholders for secrets and never real credentials.
13. A clear distinction between documentation/design completed now and implementation that will be added later.
14. A section titled `My AI Usage`.

The setup documentation should be genuinely executable where possible. Include the prerequisites, example commands for creating a database and database user, where to configure the database connection, how a future schema or migration script will be applied, and how to verify the result using PostgreSQL.

However, do not pretend an application, migration tool, schema file, backend, frontend, or test suite already exists if it does not. This work is planning and design only. Provide a useful step-by-step PostgreSQL setup guide, then clearly state which application-specific commands will be added when the implementation exists.

For the `My AI Usage` section, describe the intended record-keeping policy honestly and leave room for me to add my own reflection. Do not fabricate personal experiences, claim manual verification that did not happen, or invent completed features.

## 10. Update `PROMPTS.md`

This file is important for the assignment.

Append the full text of this prompt under a clearly labelled entry in the Sessions section. Preserve the raw text I supplied, including the instructions and headings; do not replace it with a short AI-generated summary.

Do not erase or rewrite any existing prompt history.

Do not insert a fabricated conversation, response, transcript, or public chat URL. Keep the prompt record separate from any future raw response or conversation log I decide to preserve.

Ensure all Markdown fences are properly closed and the file remains readable.

## 11. Quality checks before finishing

This is a planning and database-design task, so do not implement the backend, React components, authentication routes, or working application features.

Do not install application dependencies merely to write documentation. Do not add unrequested infrastructure or create dummy implementation files.

Before completing the work:

- Compare the documentation with the original assignment requirements.
- Ensure all eleven tables are consistently named and documented.
- Check the foreign keys, cardinalities, primary keys, unique constraints, and stock rules for consistency.
- Ensure the ER diagram agrees with the table overview and the data dictionary.
- Make sure the README contains the Mermaid diagram and practical PostgreSQL setup instructions.
- Ensure `AGENTS.md` contains useful future development rules.
- Ensure `PROMPTS.md` preserves the supplied prompt verbatim and existing entries.
- Inspect the final diff and make sure unrelated files and content were not changed.
- Report what was created or modified, any assumptions made, any unresolved decisions, and which checks you actually performed.

Do not commit or push anything automatically. I will review the changes and make the Git commit myself.

The final result should be a clear, practical project foundation that I can explain in an interview and that future implementation can follow without having to reinterpret the product or database design.

### Session: Final documentation cleanup and pre-commit review (2026-10-25)

# Final Documentation Cleanup and Pre-Commit Review

Work in the existing repository: `Qusai7-04/dealership-inventory`.

First, inspect the current working tree and read `AGENTS.md`, `README.md`, `PROMPTS.md`, and the database design document. Read the original Incubyte assignment instructions available in the workspace as well.

## 1. Rewrite AGENTS.md using Ponytail principles

Use the upstream repository as the reference:

https://github.com/DietrichGebert/ponytail/blob/main/AGENTS.md

Adapt its “lazy senior developer” approach to this project. Do not merely keep the existing generic checklist, and do not copy unrelated project-specific rules blindly.

The instructions should emphasise:
- Understand the request and trace the affected code or documentation before making changes.
- Prefer the smallest complete solution; reuse existing patterns and avoid unnecessary abstractions, dependencies, files, and features.
- Be efficient without being careless about security, validation, data integrity, accessibility, or meaningful tests.
- Follow TDD for implementation work.
- Preserve PostgreSQL, the agreed inventory model, server-side authorization, transaction safety, and idempotency requirements.
- Keep documentation and commit history accurate.
- End task reports with what was skipped or not checked and any material risks.

Keep `AGENTS.md` compact, practical, and recognisably aligned with Ponytail's style. Do not install plugins, dependencies, or other tooling just to edit this file.

## 2. Audit README.md

Keep README as the current project guide, not an execution diary. Retain the useful project overview, required features versus extensions, role policy, PostgreSQL design summary, ER diagram, setup preparation, and `My AI Usage` section.

Verify every relative link against the actual repository files. Fix broken paths instead of leaving links to files that do not exist. Keep detailed database explanations in the database design document and link to it.

Remove any use of the prohibited internal milestone terminology from project documentation, including headings and link labels. Do not rename or duplicate files unnecessarily just to fix a link.

Do not claim PostgreSQL is installed, the application is running, migrations exist, or tests passed unless that has actually been verified. The current work is documentation and design; do not implement application features.

Keep the `My AI Usage` section truthful. It may state that Codex assisted with planning and database documentation, but leave personal reflection for me to complete.

## 3. Audit the database design

Cross-check the database design document against the README and the agreed eleven-table model:

`users`, `vehicle_categories`, `vehicles`, `vehicle_images`, `stock_receipts`, `favourites`, `carts`, `cart_items`, `purchases`, `purchase_items`, and `notifications`.

Verify that the ER diagram, table descriptions, foreign keys, cardinalities, constraints, inventory rules, and transaction workflows agree. Do not add tables or features without a clear requirement. Record any unresolved design issue rather than silently guessing.

Keep PostgreSQL installation and database creation instructions distinct from the future application schema and migration steps.

## 4. Audit PROMPTS.md

Preserve all existing entries. Append this entire prompt verbatim under a clearly labelled session entry, using the current date.

Do not summarise or rewrite the prompt. Do not invent a conversation transcript or public chat URL. Keep the file consistent with the assignment's requirement to preserve raw AI chat logs or public chat links; do not claim that prompt-only records are a complete transcript.

## 5. Verify the changes

Inspect the repository's actual file paths and current Git status before editing. Modify only the files necessary for this cleanup.

Then:
- Check internal Markdown links and headings.
- Compare the ER diagram against the written schema.
- Check for accidental duplicated README sections or duplicated prompt entries.
- Run appropriate documentation checks if existing tooling supports them; do not install a new dependency just for this.
- Inspect the final diff and report exactly what changed and which checks actually ran.

Do not commit, push, install PostgreSQL, or implement the backend/frontend. I will review and commit the changes manually.

At the end, provide a concise summary of the changes, the checks performed, anything skipped or not checked, and any remaining risks.

### Session: PostgreSQL connection and initial schema migrations (2026-10-25)

I am working on my Incubyte Car Dealership Inventory System project in my local Windows environment. The GitHub repository is https://github.com/Qusai7-04/dealership-inventory.
I want you to guide me through the next steps carefully, verify everything before making changes, and help me complete the PostgreSQL setup and connect it to my existing backend. Work step by step and do not skip ahead.

Current project status:
The project uses Node.js, TypeScript, Express, PostgreSQL, and the pg package.
The backend foundation is already implemented.
GET /health works.
npm scripts for development, build, start, and test are configured.
A Vitest/Supertest health test exists.
Previously, npm test, npm run build, and the health endpoint check passed.
The changes have already been committed and pushed to GitHub. The latest Git status previously showed main...origin/main with a clean working tree.
Database migrations, authentication, inventory routes, and the frontend have not yet been implemented.

My PostgreSQL installation status:
PostgreSQL 18 is installed on Windows.
The Windows service postgresql-x64-18 is running.
The executable exists at C:\Program Files\PostgreSQL\18\bin\psql.exe.
However, psql --version initially failed because the executable was not on PATH.
I have been instructed to add C:\Program Files\PostgreSQL\18\bin to my user PATH, open a new PowerShell window, and verify the installation.
I still need to confirm that psql --version works and that I can connect to the local PostgreSQL server using psql -U postgres -h localhost -p 5432.

Your task:
Step 1: Verify my environment
Step 2: Inspect the existing repository
Step 3: Plan the database connection
Step 4: Implement and test the connection
Step 5: Create the initial database migrations
Step 6: Verify everything
Step 7: Git commits and GitHub pushes
Step 8: Update project documentation

### Session: Dockerized PostgreSQL development environment (2026-10-25)

Continue my Incubyte Car Dealership Inventory System project in `C:\PROJECTS\Dealership Inventory`.

GitHub repository: https://github.com/Qusai7-04/dealership-inventory

Docker Desktop is installed and working. The project uses Node.js, TypeScript, Express, PostgreSQL, `pg`, Vitest and Supertest.

The existing backend includes a PostgreSQL connection pool, health endpoints, a migration runner and an initial SQL migration for `users`, `vehicle_categories` and `vehicles`.

Two existing local commits must be preserved:
- `444fe48` — `feat: implement postgresql connection pool and health checks`
- `d3524da` — `feat: add initial database migrations and migration runner`

Task: Add Docker Compose and verify the real database workflow.
1. Add a minimal Docker Compose configuration for PostgreSQL using host port 5433 mapped to container port 5432.
2. Keep credentials out of committed files.
3. Explain exact commands to start, check health, and stop safely.
4. Configure backend to connect to Compose database and verify health check succeeds.
5. Run migration runner against containerized database. Verify tables exist and idempotent second run.
6. Run unit and integration tests, build, and diff check.
7. Update README with Docker Compose setup and safe cleanup instructions.

### Session: Authentication and authorization implementation (2026-10-25)

Implemented PostgreSQL-backed registration and login, bcrypt password hashing, signed and expiring JWT bearer tokens, active-user authentication, current database-backed role authorization, request validation, safe error responses, and startup configuration validation. Added focused unit and live PostgreSQL integration coverage for registration, login, duplicate normalized emails, privilege-field injection, invalid credentials, token failures, deactivation, and role changes. Updated environment and API documentation. The completed checks were 34 passing tests across 7 files, a successful TypeScript build, `git diff --check`, and an npm audit reporting zero vulnerabilities.
