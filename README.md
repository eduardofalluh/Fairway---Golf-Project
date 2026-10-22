# Fairway — Montréal and Toronto tee times

A golf comparison app for Montréal, Toronto, and nearby Canadian courses. Search
by market, date, time, players, round length, region, and budget, compare green
fees in CAD, and continue to the course's booking provider.

## Current behavior

- Search-first hero: pick Montréal or Toronto, a date, the hour you want to tee
  off, how flexible you are, and the party size. Quick picks cover today,
  tomorrow and the coming weekend. The search lives in the URL, so it can be
  shared and the back button works.
- Results arrive in four parallel parts and render as each lands. View them by
  course (time chips per course, best match highlighted), by time, or on a map.
  A timeline shows open slots per quarter hour; tap a bar to focus on it.
- Sorting, price, holes, regions, public-only, cart and party size filter the
  loaded slots in the browser, so they never trigger new provider calls.
- Only provider-confirmed Chronogolf/TeeTime availability is shown. When a
  provider throttles or fails, the page says so, keeps what it could read,
  counts down the provider's `Retry-After`, and retries once.
- Picking a time opens a booking sheet that re-checks that exact slot with the
  provider, then links to the provider's page with the date and round length
  filled in. Fairway never holds, books or pays for a slot.
- Optional email (Resend) sends the details of a re-verified slot; it is hidden
  when `RESEND_API_KEY` isn't configured and is never a booking confirmation.
- English and French (Québec, 24-hour times); motion respects reduced-motion.

See [PROVIDER_INTEGRATIONS.md](./PROVIDER_INTEGRATIONS.md) for verified provider
links and the access needed to implement account linking and direct booking.

## Development and validation

```bash
npm ci
npm run dev           # Next.js development server
npm test              # search, caching, rate-limit and booking-safety tests
npm run lint
npm run build         # production build (what Netlify runs)
npm start             # serve the production build
```

Netlify hosting uses `netlify.toml`, builds with `npm run build`, and publishes
the `.next` output through Netlify's managed Next.js runtime. Configure
production secrets in Netlify instead of committing local `.env*` files.

## Staying inside provider rate limits

Chronogolf answers bursts with HTTP 429 and `Retry-After: 60`; roughly two dozen
tee-sheet requests a minute trip it. Fairway therefore:

- asks only for the searched time range (`start_time`/`end_time`) and batches up
  to 40 course ids per request, so a ±1 hr Montréal search costs about 15 calls;
- caches complete answers for 90 s in Next's data cache and Netlify's CDN, so
  identical searches from anyone are free;
- remembers which minutes of a day the browser already loaded (3 min), so moving
  the time window only fetches the new part and going back is instant;
- stops calling a provider for as long as it asked after a 429.

## Data and configuration

`src/lib/providers/chronogolf.ts` reads public marketplace endpoints around the
selected market (unofficial, not a supported partner integration). Calls have
timeouts, the directory is cached per market, and failures do not fabricate live
availability. Canadian listings only; demo/test accounts are excluded. Prices
retain cents, unknown capacity is not assumed available, and past tee times are
excluded in the Eastern time zone.

`src/lib/providers/teetime.ts` reads public TeeTime club pages for selected GTA
clubs whose server-rendered page contains availability data. Failures return no
rows instead of presenting fake live inventory.

Curated courses in `src/lib/courses.ts` include verified official booking portals
for Montréal and Toronto/GTA. Where a directory-only live-provider listing
matches a curated course, the verified portal takes precedence. Distance is
approximate, measured from the selected market center.

Useful environment settings:

- `CHRONOGOLF_OFF=1`: disable live Chronogolf calls for offline development.
- `TEETIME_OFF=1`: disable live TeeTime calls for offline development.
- `CHRONOGOLF_RADIUS_KM=100`: fallback directory search radius.
- `CHRONOGOLF_MONTREAL_RADIUS_KM=100`: Montréal-specific directory radius.
- `CHRONOGOLF_TORONTO_RADIUS_KM=100`: Toronto-specific directory radius.
- `RESEND_API_KEY`, `BOOKING_FROM_EMAIL`: optional email reminder delivery.

No paid provider or email credentials are included in this deployment.

## API

```text
GET  /api/courses?market=montreal
GET  /api/tee-times?market=montreal&date=2026-10-23&start=12:00&end=14:00&part=0&parts=4
POST /api/verify  {market, courseId, date, time, holes, players, price}
POST /api/book    {email, market, courseId, date, time, holes, players, price}
```

`/api/tee-times` returns `{ teeTimes, providers, checkedCourses, … }` for one
part of the market's live courses; ranges are capped at 6 hours and dates at 60
days ahead. `/api/verify` and `/api/book` look the course up server-side and
re-check the slot fresh before returning the official deep link. Invalid input
returns HTTP 400 before any provider call.

All prices and availability must be confirmed by the booking provider. Fairway is
independent of every listed provider.
