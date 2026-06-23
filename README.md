# ⛳ Fairway — Montréal tee-time aggregator

One search across every public golf course in the Greater Montréal area. Tell it
when you want to play, how flexible you are, and what you'll pay — it lines up
every open slot in the region and sorts it your way.

> Chronogolf only shows the courses that pay to be on it. Fairway is built to
> centralize **all** of them.

## Features

- **Time-window search** — pick a target time + a flexibility of up to ±3 hours
  (e.g. "1:00 PM ±1 hr" → scans 12:00–2:00 PM).
- **Price control** — set a target budget *and* a hard ceiling.
- **Sorting** — price high→low (default), low→high, closest-to-budget,
  closest-to-time, or nearest-to-you.
- **Filters** — players (1–4), 9/18 holes, region, all on one screen.
- **24 real courses** across Montréal Island, Laval, North Shore, South Shore,
  and off-island east/west.
- **Sleek animated UI** — Lenis smooth scroll, Framer Motion entrance &
  scroll-reveal animations, animated hero with parallax.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** (theme-driven design tokens)
- **Framer Motion** (animations / scroll parallax) + **Lenis** (smooth scroll)

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start   # production
```

## How the data layer works

```
src/lib/
  types.ts                # domain types
  geo.ts                  # haversine distance + region classifier
  courses.ts              # curated NON-Chronogolf courses (extras)
  aggregator.ts           # directory + merge live/estimate + filter + sort
  format.ts               # display helpers
  providers/
    chronogolf.ts         # LIVE Chronogolf directory + tee times
    seed.ts               # estimated tee times (fallback), priced off real fees
src/app/api/tee-times/route.ts   # GET search endpoint
```

The course **directory is fully live**: it's pulled from Chronogolf's public
marketplace search and refreshed every 6h. Curated non-Chronogolf courses
(`courses.ts`) are merged in so the app covers courses Chronogolf doesn't list.

For each course on a given date, the aggregator fetches **real live
availability** from Chronogolf and uses it when the tee sheet is open; otherwise
it falls back to **estimated** times (clearly labelled `Est.` in the UI),
priced off that course's real Chronogolf green fee. Every row links to the real
booking page.

### The Chronogolf integration (real, no API key)

Chronogolf has **no public self-serve developer API** — their Partner API (V2)
requires a signed B2B agreement with Lightspeed. So we read the same public
JSON endpoints their own booking widget calls (discovered by inspecting the
widget's network traffic):

| Purpose | Endpoint |
| --- | --- |
| Course directory | `GET /marketplace/v2/search?location[lat]=..&location[lon]=..&location[distance]=..&published=true&page=N` |
| Tee times | `GET /marketplace/v2/teetimes?start_date=YYYY-MM-DD&course_ids=<uuid>&holes=<n>&start_time=HH:MM&page=N` |

Base host: `https://www.chronogolf.com`. Courses are identified by **UUID**.
The teetimes response is `{ status: "open" | "closed", teetimes: [...] }` — a
course's sheet is only `"open"` inside its booking window (often closed
overnight), in which case we show estimates.

**This is unofficial.** Endpoints can change without notice, may be
rate-limited or anti-bot'd, and using them may run against Chronogolf's terms.
All calls fail soft (7s timeout, cached, graceful fallback) so a Chronogolf
outage never breaks search. For production at scale, pursue the official
[Partner API](https://partner-api.docs.chronogolf.com/).

Env knobs:

```bash
CHRONOGOLF_OFF=1            # disable all live calls (offline dev)
CHRONOGOLF_RADIUS_KM=75     # directory search radius around downtown
```

Adapters for other platforms (TeeOn, ForeUp) can be added the same way under
`providers/` and merged in `aggregator.ts`.

## Booking & email confirmations

Clicking **Book** on any result opens a confirmation modal (designed via
21st.dev's Magic MCP) summarising the tee time. The golfer enters their **email
(required)** plus **name & phone (optional)** — saved to `localStorage` so it's
asked only once — and confirms. That POSTs to `/api/book`, which emails a
confirmation with the tee-time details and a link to finish on the course's own
booking page.

> Fairway is a search + notify layer — it can't complete a real reservation/
> payment on the course's behalf (that needs each platform's authenticated
> booking + payment APIs). The confirmation captures the golfer's pick and hands
> off to the real booking page.

Email sending uses [Resend](https://resend.com). Without a key the request still
succeeds and is logged server-side, and the UI says delivery isn't configured —
so set these to send for real:

```bash
RESEND_API_KEY=re_xxx                       # required to actually send
BOOKING_FROM_EMAIL="Fairway <book@yourdomain.com>"   # a Resend-verified sender
```

The hero background is a cinematic image generated with the **Higgsfield** CLI
(`public/hero.jpg`).

## API

```
GET /api/tee-times?date=2026-06-25&time=13:00&window=60&players=2
                   &max=140&target=70&sort=price-desc
                   &holes=18&regions=Laval,North%20Shore
```

Returns `{ results: TeeTimeResult[], meta: {...} }`.

---

*Data is indicative — always confirm price and availability on the course's own
booking page (every result links straight to it). Not affiliated with
Chronogolf.*
