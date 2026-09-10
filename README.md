# Fairway — Montréal tee times

A golf comparison app for Montréal and nearby Canadian courses. Search by date,
time, players, round length, region and budget, compare green fees in CAD, and
continue to the course's booking provider.

## Current behavior

- Cinematic course video with a pause control, reduced-motion support, and a
  photo fallback; responsive search and course cards.
- Live Chronogolf availability is the default. Users can explicitly include
  generated estimates for discovery. Estimates are not available inventory or
  guaranteed prices, and cannot be booked within Fairway.
- Official MinuteGolf sign-in and club-specific GGGolf account access open on
  the provider's site. Fairway does not receive passwords, inspect those browser
  sessions, or claim the accounts are linked.
- Selecting a result opens a review panel. The provider confirms availability,
  the final price and the reservation. Fairway does not make reservations or
  payments; `/api/autobook` returns HTTP 501.
- Optional email is a selected-round reminder, never a booking confirmation.
  The UI only reports delivery if the email service accepts it.

See [PROVIDER_INTEGRATIONS.md](./PROVIDER_INTEGRATIONS.md) for verified provider
links and the access needed to implement account linking and direct booking.

## Development and validation

```bash
npm ci
npm run dev           # original Next.js development server
npm run dev:sites     # Cloudflare-compatible local development, port 5173
npm test              # search validation, availability, prices, booking safety
npm run lint
npm run build         # Sites/Cloudflare Worker build through vinext
npm start             # production preview
```

The original Next.js architecture and routes remain available:

```bash
npm run build:next
npm run start:next
```

Sites hosting uses `.openai/hosting.json`, `vite.config.mts`, and the build output
in `dist/`. Local `.env*` files are ignored and are never published as source.
Configure production secrets in the hosting environment.

## Data and configuration

`src/lib/providers/chronogolf.ts` reads public marketplace endpoints (unofficial,
not a supported partner integration). Calls have timeouts, the directory is
cached, and failures do not fabricate live availability. Canadian listings only;
demo/test accounts are excluded. Prices retain cents, unknown capacity is not
assumed available, and past tee times are excluded in the Montréal time zone.

Curated courses in `src/lib/courses.ts` include verified official booking portals.
Where a directory-only Chronogolf listing matches a curated course, the verified
portal takes precedence. Distance is approximate, measured from downtown.

Useful environment settings:

- `CHRONOGOLF_OFF=1`: disable live calls for offline development.
- `CHRONOGOLF_RADIUS_KM=100`: directory search radius.
- `RESEND_API_KEY`, `BOOKING_FROM_EMAIL`: optional email reminder delivery.

The retained natural-language search endpoint is not exposed in the refreshed
interface because it requires a separately configured AI service. No paid
provider, email or AI credentials are included in this deployment.

## Search API

`GET /api/tee-times?date=2026-09-12&time=13:00&window=60&players=2&holes=18&max=100&sort=price-asc&live=1`

Returns `{ results, meta }`. Set `live=0` to explicitly include estimates.
Invalid dates, times, player counts, region names, sorting and price ranges
return HTTP 400 before provider calls.

All prices and availability must be confirmed by the booking provider. Fairway
is independent of GGGolf, MinuteGolf and Chronogolf.
