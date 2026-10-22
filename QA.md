# Fairway verification — 2026-10-22

## Root cause of empty results

Chronogolf's `/marketplace/v2/teetimes` returns HTTP 429 (`Retry-After: 60`)
after roughly two dozen requests a minute. The previous search sent 50+ courses
× up to 4 pages per search, so a second search came back empty and the error was
swallowed. Measured locally: first search 69 slots / 9 courses in 6.2 s, repeat
search 0 slots in 0.1 s with 20/20 probed calls rejected.

## After the change

- One ±1 hr Montréal search: 17 tee-sheet calls (324 slots), plus 3 one-off
  club lookups on a cold start.
- Shifting 13:00 → 14:00 fetched only 14:01–15:00 (4 parts); returning to
  13:00 made 0 calls and rendered instantly.
- A throttled search showed partial results with a banner and stopped further
  provider calls; the booking sheet fell back to "Open Chronogolf anyway".
- Verified booking: Golf l'Émeraude 1:00 PM re-checked live and linked to
  `chronogolf.com/club/golf-l-emeraude?date=2026-10-23&nb_holes=18`.

## Automated checks

- `npm test`: 39 passing (range validation, missing-range math, filters and
  sorting, batching, 429 back-off, partial pages, CDN cache headers, verify and
  email routes with server-side course lookup).
- `npm run lint`, `tsc --noEmit`, `npm run build`: passed (Next.js 16.4.2).
- `npm audit --omit=dev`: 0 vulnerabilities.

## Browser checks (local)

Desktop and 375 px mobile: hero search, quick dates, nav search summary,
filters drawer / bottom sheet, timeline, course cards, by-time list, map,
booking sheet (dialog on desktop, draggable sheet on mobile), French copy.

## Not checked

The deployed Netlify site (blocked by the browser policy used for testing),
Netlify CDN caching behaviour, real email delivery, and Toronto/TeeTime live
data in this session.
