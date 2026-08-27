# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

FlightGuard (flightGuard) — a Vue 3 + TypeScript SPA that lets a user look up flight status (via Taiwan's TDX FIDS API) and check eligibility for flight-delay insurance claims, with a live map showing aircraft position (via OpenSky Network). Deployed as a static site to GitHub Pages.

Code comments and identifiers throughout the codebase are written in Traditional Chinese (繁體中文). Match this convention when adding comments.

## Commands

```sh
npm run dev          # start Vite dev server (port 5173)
npm run build         # type-check (vue-tsc --build) + production build
npm run build-only    # production build without type-check
npm run type-check    # vue-tsc --build only
npm run preview       # preview the production build locally
```

There is no test suite and no lint script configured in this repo — do not assume `npm test` or `npm run lint` exist.

Requires a `.env` file with `VITE_TDX_CLIENT_ID` and `VITE_TDX_CLIENT_SECRET` (TDX OAuth2 client credentials) for local dev; these are injected as GitHub Actions secrets during CI build/deploy (`.github/workflows/deploy.yml`, deploys `dist/` to GitHub Pages on push to `master`).

## Architecture

### Two external APIs, two different trust/auth models

- **TDX (Transport Data eXchange)** — `src/api/tdx/*`. Taiwan's official transport open-data platform; provides airport list, airline list, and FIDS (Flight Information Display System) flight status. Requires OAuth2 client-credentials auth.
  - `src/api/tdx/auth.ts` — fetches/caches the access token. Uses an `inFlightRequest` promise lock so concurrent startup calls (airports + airlines + FIDS all fire on load) share a single token request instead of racing.
  - `src/api/http.ts` — shared Axios instance; request interceptor awaits `fetchToken()` and attaches `Authorization: Bearer`; response interceptor maps HTTP errors (401/429/etc.) to Chinese user-facing messages and clears the token cache on 401.
  - `src/api/tdx/fids.ts` — flight status queries. Contains `resolveTripStatus()`, which overrides TDX's own `TripStatus` field using a priority order: cancellation keywords in Remark > schedule-vs-actual time diff >= 1 min (forces Delayed) > Remark keyword match > fallback to raw TDX status. This exists because TDX's status field lags behind the actual schedule/remark data.
- **OpenSky Network** — `src/api/openSky/stateVector.ts`. Public, unauthenticated (no token), used only for live aircraft position/velocity. Rate-limited (429s are expected and handled by returning `[]` rather than throwing).

### Flight number → ICAO callsign bridge

`useFlightTracking.ts` must convert a TDX flight number (e.g. `BR301`, IATA airline code) into an OpenSky callsign (e.g. `EVA301`, ICAO code) to correlate the two APIs. It looks up the ICAO code from the cached `tdxBaseData` store first, and falls back to a hardcoded `FALLBACK_AIRLINE_ICAO_MAP` for common Taiwan/regional airlines when the store hasn't loaded or lacks the ICAO field.

### Foreign-airport query semantics get inverted

TDX FIDS only serves flight boards for Taiwanese airports. `useAirportSearch.ts` maintains a `DOMESTIC_AIRPORT_IATA_LIST` whitelist; when the user selects a non-domestic airport, `getEffectiveQueryAirportCode()` silently substitutes `TPE` (Taoyuan) as the actual query target, and `getEffectiveDirection()` flips Arrival/Departure (since "departures from Tokyo" = "arrivals at Taoyuan"). The result set is then filtered client-side to flights matching the originally-selected foreign airport as counterpart. `useFidsData.search()` is the caller that orchestrates this — read it alongside `useAirportSearch.ts` if touching query logic.

### State/caching strategy

- **`stores/tdxBaseData.ts`** (Pinia) — loads the *entire* airport and airline lists once on app init (`initialize()`), then all searching (`searchAirports`/`searchAirlines`) is client-side `Array.filter`. This avoids repeated TDX calls for what is otherwise a search-as-you-type UX. IATA-code lookups (`getAirportByIATA`/`getAirlineByIATA`) also read from this cache.
- **`stores/flightCache.ts`** (Pinia) — a one-shot handoff cache: when the user clicks a flight card in `SearchView`, the already-fetched `FidsFlight` object is stashed here keyed by a route id (`"flightNumber-YYYYMMDD"`), so `FlightDetailView` can consume it on mount instead of re-querying TDX (avoids 429s from clicking around). Falls through to a real API call if the route id doesn't match (e.g., user pasted the URL directly).
- **`composables/useEntitySearch.ts`** — generic debounced-search-input behavior (focus → recommended list, typing → debounced filter, blur → delayed close) shared by `useAirportSearch.ts` and `useAirlineSearch.ts` via a generic `T`. New "pick an entity from a searchable list" UI should reuse this rather than reimplementing debounce/focus logic.

### Insurance eligibility is a pure function

`utils/insuranceRule.ts` (`checkInsuranceEligibility`) is deliberately side-effect-free: takes `TripStatus` + schedule/actual ISO timestamps, returns an `InsuranceEligibility` verdict. `composables/useInsuranceCheck.ts` is the thin reactive wrapper that picks the correct pair of timestamps based on `FlightDirection` (departure vs arrival) and feeds them in. The delay threshold (`DEFAULT_DELAY_THRESHOLD_MINUTES`) is currently set to 60 for testing — check with the user before assuming this is the production business rule (real 不便險 policies typically use 4-hour thresholds, which is still reflected in some display strings).

### Routing

Hash-based routing (`createWebHashHistory`) is required because the site is served from a GitHub Pages subpath (`/flightGuard/`) with no server-side rewrite support — a normal history mode would 404 on refresh of `/flight/:id`. `src/router/index.ts` has two routes: `/search` (main search+list+map view) and `/flight/:id` (detail view, `id` is `flightNumber-date` encoded).

### Path alias

`@/*` maps to `src/*` (configured in both `vite.config.ts` and `tsconfig.app.json`) — always import via `@/...`, not relative `../../` paths.
