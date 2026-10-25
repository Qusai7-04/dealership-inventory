# Creaseline frontend

The frontend is a React 19, TypeScript, Vite, Tailwind CSS 4 single-page application. It follows the supplied Creaseline/FOLD reference pack while using Creaseline branding and only real backend data.

## Routes and access

- Public: `/`, `/sign-in`, `/register`.
- Authenticated: `/vehicles`, `/vehicles/:id`, `/cart`, `/favourites`, `/notifications`, `/purchases`.
- Admin only: `/admin` for aggregate inventory, create/edit, restock, soft deletion, and stock-receipt history.

The session token is kept in `sessionStorage`, attached by one typed API client, and cleared on `401`. Role checks improve navigation but never replace server authorization. Checkout totals use server decimal strings, and a genuine network retry keeps its original request UUID. A `409` refreshes the cart for review.

Vehicle cards use persisted ordered images and descriptive alt text. `/images/vehicles/*` is proxied to the backend in development. Missing or failed images use the neutral local `/images/vehicle-placeholder.svg`; the UI never substitutes a different model. The source lookup year and synthetic technical fields are not displayed.

## Commands

From the repository root:

```powershell
npm run dev                 # backend + frontend
npm run test:frontend
npm run build:frontend
```

`VITE_API_BASE_URL` is optional and blank for the normal local proxy workflow. It is the only supported browser-visible environment setting; never place database, JWT, or image-provider credentials in `VITE_*` variables.

The frontend intentionally omits image-reference editing because no browser-facing image-management workflow was required for the seeded catalogue. Image generation remains a server-side maintenance script, and the provider key never reaches the browser.
