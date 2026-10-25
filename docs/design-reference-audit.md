# Creaseline: Design Reference Audit & Interaction Synthesis

This document audits the external design references, inspiration sources, and uploaded HTML prototypes specified in the Creaseline design prompt, detailing the exact aesthetic and interaction ideas adopted into Creaseline's unified React application.

---

## 1. External Design References Audit

### 1.1 Trionn & Lenis Showcases (`trionn.com`, `lenis.dev/showcase`)
- **Key Techniques:**
  - Micro-friction smooth scroll feel and sticky section transitions.
  - Staggered typography reveals on scroll (`translate-y` from clipped overflow masks).
  - High-contrast tactile typography on dark graphite accents.
- **Application in Creaseline:**
  - Applied to the Homepage Hero and Editorial Specimen sections.
  - Heading titles reveal smoothly on scroll with `cubic-bezier(0.16, 1, 0.3, 1)`.
  - Native CSS scroll snap / sticky positioning used with fallback for reduced motion.

### 1.2 Inspora Design Patterns (`inspora.design`)
- **Key Techniques:**
  - `paper-fold-animation`: 3D perspective fold transition (`rotateX`, `translate3d`, paper-crease shadow) simulating physical origami / tactile folding into a target slot.
  - `playful-bottom-nav`: Floating capsule navigation bar with an expanding active pill indicator and smooth text reveal.
  - `flying-dropdown-menu`: Floating menu that gracefully deploys with slight elevation, subtle scale, and crisp tactile border shadow.
- **Application in Creaseline:**
  - **Paper-Fold Cart Add:** Triggered strictly upon a confirmed HTTP 200 response from `POST /api/cart`. The vehicle card thumbnail triggers a 3D perspective fold effect into the cart icon, with clear status feedback.
  - **Mobile Bottom Navigation:** Floating capsule on mobile viewports (< 768px) with quick-access tabs (`Storefront`, `The Floor`, `Saved`, `Cart`, `Account`) featuring smooth active-pill indicator transitions.
  - **Account & Category Dropdowns:** Accessible flyout menu with Esc key dismiss, outside click detection, and smooth entrance.

### 1.3 Automotive Storytelling: Spyker & Forge Automotive
- **Key Techniques (Spyker & Forge):**
  - **Spyker Cars:** Dramatic automotive craftsmanship, large hero silhouette presentation, technical engineering specification callouts (powertrain, transmission, power-to-weight, curb weight), and cinematic typography.
  - **Forge Automotive:** Clean editorial grid, generous whitespace, pristine high-resolution car photography with neutral background staging, prominent price tags, and direct condition indicators.
- **Application in Creaseline:**
  - **Vehicle Detail View:** Art-directed specimen presentation with technical spec pill strips (Engine, Transmission, Mileage, Fuel, Power).
  - **Showroom Floor Cards:** Large, crisp automotive cards with front 3/4 vehicle photography (or pristine technical wireframe SVG silhouettes when unavailable), clear stock status badges (`In Stock`, `Low Stock (N left)`, `Out of Stock`), and authoritative INR price typography.

### 1.4 Interactive Footers: `footer.design/sites/dirt` & `footer.design/styles/animated`
- **Key Techniques:**
  - Massive typographic brandmark dominating the viewport footer.
  - Dynamic scroll-progress clip-path reveal / gradient fill across the brand letters.
  - Architectural grid layout for operational links, verified business hours, floor status, and smooth back-to-top trigger.
- **Application in Creaseline:**
  - Interactive Creaseline footer component with oversized `CREASELINE` typography filled proportionally to viewport scroll depth.
  - Real internal application routes (Catalog, Favourites, Cart, Sign-in, Admin), verified dealership timing disclosures, live inventory counter, and smooth back-to-top button.

### 1.5 CodeMyUI: Expanding Columns & Bay-Window Slider
- **Key Techniques:**
  - Expanding card rail on hover/focus where the active card expands width or scale while adjacent cards subtly dim or yield space.
- **Application in Creaseline:**
  - Featured Showcase on the Homepage: Horizontal vehicle rail with tactile paper cards, expanding focus states, and direct navigation links to `/vehicles/:id`.

---

## 2. Uploaded HTML Prototypes Analysis

### 2.1 "Creaseline: The Wind Tunnel" (`reference-docs/Creaseline_ the wind tunnel.html`)
- **Synthesized Elements:**
  - Hero typographic layout: Bold condensed uppercase headlines ("FIND A CAR. BUY IT IN ONE CLICK.") with masked entrance.
  - Live Inventory Summary Ribbon: Stat strip displaying active models, vehicles in stock, total floor valuation, and low stock count.
  - Marquee accent strip: Editorial ticker reminding shoppers of live, immediate delivery and verified stock.
  - Scroll-driven wordmark fill in the footer (`--f` scroll fraction clip-path).
- **Exclusions:**
  - Excluded the heavy 760vh WebGL tunnel loop from blocking the main storefront, ensuring fast, battery-efficient rendering with accessible fallbacks.

### 2.2 "Creaseline: The Pop-Up Lot" (`reference-docs/Creaseline_ the pop-up lot.html`)
- **Synthesized Elements:**
  - Tactile Paper Palette: Warm Paper (`#F2EDE4`), Card Paper (`#FEF9F0`), Ink (`#16150F`), Muted Charcoal (`#524F44`), Electric Blue (`#2F4BFF`), Lime Accent (`#C6F24E`), Safety Orange (`#FF6B35`).
  - Tactile offset shadows (`3px 3px 0 #16150F`) on interactive buttons and specimen cards.
  - Status badges with distinct color treatments (`ok`: Lime, `lo`: Orange, `so`: Dashed ink/neutral).
  - Side Cart Drawer: Flyout cart drawer with itemized line items, server-confirmed totals, and transactional checkout trigger.
- **Exclusions:**
  - Excluded the client-only `sell()`, fake random ledger mutations, hardcoded inventory array, and fake `hold to explode` gimmick. All inventory changes must be backed by real PostgreSQL transactional API calls.

---

## 3. Measurable Checklist for Implementation
- [x] **Image Pipeline Resilience:** Verified 30 WebP images, catalog resolve alias matching, binary header validation, atomic file saving, and SVG blueprint fallback.
- [ ] **Separate Customer vs Admin Sign-In:** Differentiated buyer portal vs admin console card; server-role rejection ("This account does not have administrator access") if non-admin attempts admin sign-in.
- [ ] **Independent Admin Experience:** Dedicated `AdminShell` with compact sidebar, inventory metrics, vehicle creation (including zero-stock intake), restock modal with ledger receipts, and "Generate Image" action.
- [ ] **Customer Experience:** Compact header (60–68px), animated paper-fold cart add, popping red favourite heart, side cart drawer, responsive catalog filters, and live purchase history.
- [ ] **Interactive Footer:** Oversized wordmark with scroll-progress fill, verified navigation, and back-to-top control.
- [ ] **Accessibility & Performance:** `prefers-reduced-motion` compliance, keyboard focus rings, no layout shift, zero floating-point arithmetic for INR currency.
