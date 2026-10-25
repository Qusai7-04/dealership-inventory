# Creaseline Frontend Retrospective & Redesign Specification

**Date:** October 25, 2026  
**Document Status:** Complete & Approved for Implementation  
**Visual Reference Source:** `reference-docs/stitch_fold_tactile_dealership_showroom.zip` (`creaseline_home`, `fold_homepage_the_pinboard`, `fold_the_floor_full_inventory`, `fold_car_sheet_paper_fold_detail`, `fold_cart_tear_sheet_checkout`, `fold_mobile_showroom_bottom_nav`, `fold_admin_inventory_console`, `tactile_paper_dealership/DESIGN.md`, `printed_editorial_showroom/DESIGN.md`)

---

## 1. Executive Summary

A comprehensive visual, architectural, and functional audit of the current Creaseline frontend was conducted against the provided high-resolution Stitch screenshots and HTML blueprints.

The existing implementation suffered from severe visual degradation and critical functional failures:
1. **Visual Degradation:** The UI was collapsed into a generic, flat Tailwind card layout. It abandoned the tactile, physical editorial showroom aesthetic specified in `DESIGN.md`, omitting the physical paper folds, offset ink shadows (`3px/4px #16150F`), warm cream paper surfaces (`#F2EDE4`, `#E8E1D4`, `#DCD3C2`), lime accent tape (`#C6F24E`), electric blue badges (`#2F4BFF`), telemetry glass overlays, and typographic contrast (Space Grotesk + Instrument Serif + Space Mono).
2. **Out-of-Stock Blackout Defect:** Zero-stock vehicles rendered with blackened, obscured images or broken contrast overlays, treating sold-out cars like broken graphical assets rather than collectible, archived showroom specimens with rubber stamps.
3. **Functional Gaps & Disconnected State:** When unauthenticated, the homepage rendered an empty featured list; the admin console lacked physical intake modals and live stepper restocks; pagination was hardcoded or stripped; filter controls did not sync cleanly across paper sheets; and the cart lacked the tear-sheet voucher docket experience.

This retrospective details every visual divergence, functional bug, root cause, and the exact screen-by-screen recovery plan to deliver a 100% faithful reproduction of the Stitch references.

---

## 2. Major Visual Differences

| Dimension | Supplied Stitch Reference (`DESIGN.md` & Screenshots) | Current Frontend Implementation | Impact & Required Fix |
| :--- | :--- | :--- | :--- |
| **Aesthetic Concept** | Tactile, physical paper dealership & automotive editorial publication. Layered cards, angled tape, ledger grids, rubber stamps. | Generic modern web app / SaaS dashboard with plain rounded cards and thin borders. | Rebuild with paper elevation tokens, physical borders (`2px solid #16150F`), ink drop-shadows (`3px 3px 0 #16150F`), and subtle paper texture overlays. |
| **Color Palette** | Warm cream background (`#F2EDE4`), paper surface (`#E8E1D4`), recessed docket (`#DCD3C2`), deep ink (`#16150F`), electric cobalt (`#2F4BFF`), acid lime (`#C6F24E`), alert orange (`#FF6B35`), stamp red (`#E63946`). | Generic gray palette with sporadic hardcoded Tailwind slate/zinc and neon blue buttons. | Establish strict CSS root variables matching `tactile_paper_dealership/DESIGN.md` and enforce them across all components. |
| **Typography System** | **Headings:** Space Grotesk (bold, tight tracking).<br>**Editorial Accents:** Instrument Serif (italicized editorial subheadings).<br>**Body Copy:** Inter.<br>**Telemetry/Ledger:** Space Mono (uppercase tabular nums). | Space Grotesk imported but Instrument Serif missing from HTML font imports (falling back to standard serif), Space Mono underutilized. | Add Google Fonts links for Instrument Serif & Space Mono. Apply `font-serif italic` to editorial tags and `font-mono` to prices/VIN/telemetry. |
| **Card Anatomy** | Multi-part physical specimen sheets: top catalog tag (`LOT-094`), framed vehicle photo, telemetry box (`0-100 KM/H`, `TOP SPEED`), price tag with paper clip/notch, dual-action paper buttons (`Fold to Cart` & `Direct Buy`). | Flat white card with basic image thumbnail, standard text labels, and generic full-width button. | Re-architect `VehicleCard` to strictly mirror `fold_the_floor_full_inventory` and `creaseline_home`. |
| **Out-of-Stock Treatment** | Preserves full-color vehicle photo with subtle archive tint, angled crimson stamp (`SOLD OUT / ARCHIVED`), readable specifications, and locked waitlist button. | Image blacked out or covered with high-opacity dark overlay, destroying visual appeal. | Remove all blackout filters; render high-resolution car photo with angled `SOLD OUT` rubber stamp and informative disabled state. |
| **Header & Navigation** | Ticker tape with live automotive market telemetry, dark ink header bar with bold Space Grotesk brand typography (`CREASELINE™`), tabbed floor selectors, and active ink badges. | Minimalist generic navbar with plain links. | Rebuild `AppShell` header with live ticker tape, tactile logo badge, active pill navigation, and cart count pill. |
| **Mobile Layout** | Floating dock bottom navigation bar with tactile pill icons (`fold_mobile_showroom_bottom_nav`), responsive paper sheet stacking. | Default browser responsive collapse with generic hamburger menu or squished desktop elements. | Implement floating tactile bottom nav with active pill animations and mobile-first card rhythm. |

---

## 3. Screen-by-Screen Visual & Functional Defect Analysis

### 3.1 Homepage (`creaseline_home` & `fold_homepage_the_pinboard`)
- **Reference Anatomy:**
  - Top live telemetry ticker: `LIVE FLOOR TELEMETRY: 27 VEHICLES ACTIVE • 4 RESERVED • ARCHIVE SYNC ONLINE`.
  - Hero section: Large editorial title `PRECISION SPECIMENS / FOLDED TO ORDER`, angled lime green paper label (`COLLECTION 2026`), and asymmetrical layout.
  - Quick Search Register card: Make/Model search, price range slider, category pills (`Sedan`, `SUV`, `Supercar`, `Vintage`).
  - Pinboard Section (`fold_homepage_the_pinboard`): Layered polaroid cards with lime tape (`#C6F24E`), pinned tags, handwritten notes, and mechanical blueprint sketches.
  - Floor Verification Ledger: Tabular ledger listing recent lot intakes with serial numbers, dyno checks, and availability stamps.
- **Current Deficiencies:**
  - Hero is a plain text block with centered generic buttons.
  - Logged-out users see an empty featured array because frontend queried user-specific recommendations rather than falling back to public showroom inventory.
  - No pinboard section, no telemetry ticker, no register search card, no floor verification ledger.

### 3.2 Catalogue / The Floor (`fold_the_floor_full_inventory`)
- **Reference Anatomy:**
  - Header statistics ribbon: `TOTAL ON FLOOR: 128 | AVAILABLE: 112 ACTIVE | RESERVED: 12 | SOLD OUT: 4`.
  - Filter Rail / Top Pill Bar: Category selector buttons (`ALL CLASSES`, `PERFORMANCE`, `EXECUTIVE`, `OFF-ROAD`, `ELECTRIC`), stock status filter (`ALL`, `IN STOCK ONLY`, `ARCHIVED / SOLD OUT`), and price range limiter.
  - 3-Column / 4-Column Asymmetric Specimen Grid.
  - Paper Sheet Pagination: `Sheet 01 of 04`, physical numbered tab buttons (`[01]`, `[02]`, `[03]`, `[NEXT SHEET →]`).
- **Current Deficiencies:**
  - Filter changes trigger full resets; category pills are unstyled native buttons.
  - Availability filter missing or non-functional.
  - Pagination lacks tactile sheet design.
  - Grid does not match the specimen sheet proportions.

### 3.3 Vehicle Detail / Paper Fold Car Sheet (`fold_car_sheet_paper_fold_detail`)
- **Reference Anatomy:**
  - Split 2-column folded paper layout:
    - Left column: Large hero vehicle photography, glass telemetry HUD (`0-100 IN 3.4S`, `TOP SPEED 315 KM/H`, `DYNO CERTIFIED`), 4-thumbnail gallery, technical blueprint callouts.
    - Right column: Official Motor Vehicle Invoice docket (`FORM CL-2026-X`), lot registration stamp, price calculation breakdown (Base MSRP, Delivery Prep, Import Surcharge, Total INR), allocation stepper, dual actions (`Fold into Cart`, `Direct Purchase`).
    - Bottom section: Perforated tear-off stock movement ledger showing intake dates, restock receipts, and audit verification.
- **Current Deficiencies:**
  - Current detail page is a single centered card with raw text fields.
  - No invoice docket styling, no telemetry HUD, no 4-thumbnail gallery, no stock movement ledger.
  - Direct purchase provides poor visual confirmation and error handling.

### 3.4 Cart & Tear-Sheet Checkout (`fold_cart_tear_sheet_checkout`)
- **Reference Anatomy:**
  - Perforated tear-sheet slip cards with `✂ TEAR OFF` border styling, lot numbers, and distinct item removals.
  - Live Docket Receipt sidebar: Subtotal, documentation fee, total in INR with Space Mono numbers, transactional UUID identifier.
  - 4-Stage Paper Fold preview illustration indicating physical delivery packaging.
  - Conflict warning banner on stock exhaustion with refreshed availability.
- **Current Deficiencies:**
  - Rendered as a plain HTML table without paper docket styling.
  - Missing idempotent request UUID tracking on frontend retry.
  - Conflict states replace or clear the cart instead of preserving user items and explaining inventory depletion.

### 3.5 Admin Inventory Console (`fold_admin_inventory_console`)
- **Reference Anatomy:**
  - Terminal header: `CONSOLE TERMINAL #AUTH-0904 // RESTRICTED ACCESS`.
  - 5 Key Metric Cards: Total Registered Units, Active Floor Count, Depleted Stock Items, Low Stock Warnings, Fleet Valuation.
  - Action Bar: `+ New Chassis Intake` button, real-time filter by class and stock status, search by VIN/Make.
  - Inventory Register Table: High-density editorial table with vehicle thumbnail, lot number, category badge, live units stepper (`[-] [05] [+]`), price in INR, status stamp (`LIVE`, `LOW`, `DEPLETED`), and actions (`Restock`, `Edit`, `Archive`).
  - Live Audit Ledger Stream: Real-time event log of stock changes and restocks.
- **Current Deficiencies:**
  - Standard Bootstrap-style table without live stock steppers or telemetry metrics.
  - No physical intake modal; opening stock history not visible.
  - Deletion lacks clear confirmation modal with soft-delete distinction.

### 3.6 Mobile Experience (`fold_mobile_showroom_bottom_nav`)
- **Reference Anatomy:**
  - Fixed floating bottom navigation capsule with 4 primary icons (`Showroom`, `The Floor`, `Cart (Count)`, `Console`).
  - Tactile touch-friendly tap targets with active pill highlight.
  - Full-width mobile specimen cards with clear swipeable action zones.
- **Current Deficiencies:**
  - Standard responsive collapse hiding vital actions behind generic icons.
  - Mobile bottom navigation missing entirely.

---

## 4. Functionality & Interactive Elements Inventory

| Screen | Control / Element | Current Behavior | Target Working Behavior |
| :--- | :--- | :--- | :--- |
| **All** | Header Navigation | Static links, no active indicator | Highlight active page with dark ink pill; display live cart item count pill. |
| **All** | Mobile Bottom Nav | Missing | Render floating tactile bottom navigation capsule (`fold_mobile_showroom_bottom_nav`) on mobile viewports. |
| **Home** | Register Search Card | Missing | Connect Search input, category pills, and price slider directly to catalogue route with query params. |
| **Home** | Featured Showcase | Empty when logged out | Fetch public inventory (`/api/vehicles?limit=6`) so guests and users alike see rich specimen cards. |
| **Catalogue** | Category Filter Tabs | Only partially filtered | Single-click filters by category (`Sedan`, `SUV`, `Hatchback`, etc.) syncing with URL and API query. |
| **Catalogue** | Availability Filter | Missing | Radio/pill toggle: `All`, `In Stock Only`, `Sold Out / Archived`. |
| **Catalogue** | Vehicle Card 'Fold to Cart' | Basic button | Trigger backend cart addition, update header badge, show paper fold micro-animation. If out of stock, disabled with lock. |
| **Catalogue** | Favourite Heart Action | Inconsistent state | Persist to backend `/api/favourites`, toggle red tactile heart stamp. |
| **Detail** | Allocation Stepper | Missing | Visual allocation indicator respecting 1-unit distinct vehicle rule. |
| **Detail** | Stock History Ledger | Missing | Display actual receipt records from vehicle history endpoint. |
| **Cart** | Perforated Item Removal | Standard button | Smooth tear-off animation, call DELETE `/api/cart/:vehicleId`, recalculate live docket subtotal. |
| **Cart** | Tear-Sheet Checkout | Generic button | Generate client UUID, submit idempotent purchase, show order tear-sheet receipt modal/page. |
| **Admin** | Quick Restock Stepper | Missing | In-table `[-] [qty] [+]` triggering instant `/api/admin/vehicles/:id/restock` with receipt logging. |
| **Admin** | New Chassis Intake | Basic raw form | Tactile drawer/modal with full vehicle specification, category dropdown, price, and initial stock receipt. |
| **Admin** | Soft Delete Vehicle | Raw window.confirm | Styled archival modal confirming soft-deletion without destroying purchase records. |

---

## 5. Root Cause Analysis

1. **Premature Convergence on Generic Templates:** Early implementation rushed to satisfy basic functional checks by writing standard Tailwind UI components (`bg-white rounded-lg shadow border p-4`), completely bypassing the custom CSS variables and physical design guidelines in `tactile_paper_dealership/DESIGN.md`.
2. **Failure to Inspect Reference HTML Assets:** The `code.html` files in each screen folder contained exact flex/grid proportions, border classes, and typographic hierarchies. These were neglected in favor of ad-hoc JSX.
3. **Flawed Out-of-Stock Logic:** A naive CSS condition was introduced (`if (stock === 0) className += " brightness-0 opacity-80"`) that literally rendered vehicle images as pitch-black rectangles, rather than following the editorial convention of displaying the vehicle with a crimson `SOLD OUT` stamp.
4. **Logged-Out State Neglect:** Components assumed authenticated contexts for data fetching, causing public homepage visits to fail silently or display zero items.
5. **Missing Design Tokens:** Tokens for paper colors (`#F2EDE4`, `#E8E1D4`, `#DCD3C2`), ink borders, and hard offset shadows (`box-shadow: 3px 3px 0 #16150F`) were not declared in `index.css` or Tailwind config.

---

## 6. Corrective Principles & Visual Design System

1. **Tactile Paper Surfaces:** All primary surfaces use `#F2EDE4` (canvas), `#E8E1D4` (paper sheet), and `#DCD3C2` (recessed docket). Borders are crisp `2px solid #16150F`.
2. **Offset Ink Elevation:** Elevation is achieved through hard ink drop-shadows (`3px 3px 0 #16150F` or `4px 4px 0 #16150F`), never soft blurry ambient shadows. On button `:active` or card press, translateY is applied (`translate-x-[2px] translate-y-[2px] shadow-none`).
3. **Preserved Out-of-Stock Imagery:** Zero-stock cars must display high-definition vehicle photography with a crisp, angled crimson rubber stamp (`transform -rotate-6 border-2 border-[#E63946] text-[#E63946] font-mono font-bold tracking-widest px-3 py-1`). Action buttons change to disabled waitlist locks.
4. **Editorial Typography & Hierarchy:**
   - Primary Headings & Navigation: `Space Grotesk`, bold, tracking-tight.
   - Editorial Labels & Accents: `Instrument Serif`, italic.
   - Telemetry, VIN, Numbers, Prices: `Space Mono`, tabular nums, uppercase.
   - Body & Descriptions: `Inter`, regular/medium.
5. **No Black Boxes or Dead Image Rectangles:** High-quality cached vehicle images take top priority. If an image is missing, render an SVG automotive silhouette on a warm cream blueprint grid.
6. **Strict API Synchronization:** Authoritative stock quantities, prices in INR format (`₹XX,XX,XXX`), and transaction idempotency are strictly preserved.

---

## 7. Phased Implementation & Screen Recovery Plan

- [x] **Phase 1: Diagnosis & Retrospective**
  - Save `docs/frontend-retrospective.md`.
- [ ] **Phase 2: Design Token & Typographic Foundation**
  - Update `frontend/index.html` with Google Fonts (`Space Grotesk`, `Instrument Serif`, `Inter`, `Space Mono`).
  - Configure `frontend/src/index.css` with exact design tokens, tactile paper classes, hard drop shadows, and rubber stamps.
- [ ] **Phase 3: Core Primitives & Specimen Vehicle Cards**
  - Build `Badge`, `Stamp`, `PaperButton`, `TelemetryHUD`, and `VehicleCard` with full out-of-stock color preservation.
  - Implement SVG fallback component for missing vehicle assets.
- [ ] **Phase 4: Screen Rebuilding in Deliberate Order**
  - **4.1 Homepage:** Rebuild with editorial hero, telemetry ticker, register search card, pinboard gallery, and floor ledger.
  - **4.2 The Floor (Catalogue):** Header stats ribbon, class filter pills, availability switch, price filter, specimen grid, sheet pagination.
  - **4.3 Paper-Fold Car Sheet (Detail):** 2-column folded sheet, telemetry overlay, invoice breakdown, allocation stepper, stock ledger.
  - **4.4 Cart & Tear-Sheet Checkout:** Perforated slip cards, live docket receipt, idempotent UUID checkout, conflict handling.
  - **4.5 Admin Inventory Console:** Terminal bar, 5 metric cards, register table with live restock steppers, new chassis intake drawer, audit stream.
  - **4.6 Auth, Favourites, Notifications, & Purchases:** Re-skin into tactile editorial sheets.
  - **4.7 Mobile Navigation:** Implement floating bottom pill dock (`fold_mobile_showroom_bottom_nav`).
- [ ] **Phase 5: Verification & Quality Assurance**
  - Run full frontend test suite (`npm run test:frontend`).
  - Run full backend test suite (`npm run test:backend`).
  - Run production build (`npm run build`).
  - Visual fidelity audit against Stitch references.
  - Update `PROMPTS.md` and deliver final report.
