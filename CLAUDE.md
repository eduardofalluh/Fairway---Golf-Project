@AGENTS.md

# Fairway — working agreement

Fairway is a one-stop search for golf tee times around Montréal and Toronto: pick a
day and the hour you want to tee off, see every open slot nearby, then continue to
the course's own booking page. Next.js 16 (App Router) · React 19 · TypeScript ·
Tailwind v4 · Framer Motion · Lenis · Leaflet. Deployed on Netlify from `main`.

## Commands

```bash
npm run dev     # http://localhost:3000
npm test        # node:test via tsx — must stay green
npm run lint    # must report 0 problems
npm run build   # the exact build Netlify runs
```

Run all three (`test`, `lint`, `build`) before every commit.

## Where things live

- `src/lib/providers/` — server-only provider clients (Chronogolf JSON, TeeTime HTML). Never import them from client components.
- `src/lib/aggregator.ts` — directory merge, `searchPart` (one slice of a search), deep booking links.
- `src/lib/results.ts` — pure, browser-safe filtering, sorting, grouping, timeline buckets.
- `src/lib/useTeeTimeSearch.ts` — client fetching in 4 parallel parts with a per-day range cache.
- `src/lib/search-query.ts` / `search-state.ts` — server validation / URL state.
- `src/lib/i18n.tsx` — every user-facing string, English and French.
- `src/components/search|results|ui/` — search bar and sheets, result views, shared Sheet.
- `src/app/api/` — `tee-times`, `courses`, `verify`, `book`. Tests in `tests/` (`helpers.ts` fakes Chronogolf and records every call).

## Product rules (non-negotiable)

1. **Live only.** Show a tee time only if a provider's live sheet lists it. Never estimate, cache-forward stale slots as "live", or invent prices.
2. **Fairway never books.** It re-checks the slot (`/api/verify`) and hands off to the provider with date and holes pre-filled. Copy says "Continue on {provider}", never "Book" for the final step, and never implies a reservation exists.
3. **Sign-in is a reminder, not a session.** Fairway cannot see provider logins. Marks are the golfer's own note, stored with a timestamp, shown as "Marked signed in · when", and expire after 14 days.
4. **Never handle provider credentials or cards.** No stored passwords, no automated checkout, no headless booking.
5. **Respect provider defenses.** If a provider rate-limits (429) or blocks (403), surface it honestly and fall back to booking links. Do not rotate user agents, runtimes, IPs or TLS fingerprints, solve CAPTCHAs, or otherwise work around a block. The durable fix is a partner API.

## Provider budget (Chronogolf)

Chronogolf returns 429 with `Retry-After: 60` after roughly two dozen requests a minute per IP, and currently 403s requests from Netlify's servers (the UI falls back to booking links; local dev works).

- Ask only for the searched minutes (`start_time`/`end_time`), batch up to 40 course ids per request, and stop paging on a short page.
- Never add searches on page load beyond the default, refetch on sort/filter, or poll. Sorting and filtering happen in the browser.
- Keep the 90 s data/CDN cache for complete answers only; never cache throttled or failed ones.
- Any change to search must state its upstream call count; prove it with `fakeChronogolf(...).sheetCalls()` in a test.

## Code standards

- Read the surrounding code first and match its naming, structure and comment density. Comments explain *why*, not what.
- Pure logic goes in `src/lib` with tests; components stay presentational. Prefer small components over one large file.
- Validate every external input at the boundary (`parseRangeQuery`, `readSlotRequest`). Look courses up server-side; never trust course data or URLs from the browser.
- Secrets only via environment variables (Netlify UI / `.env.local`, which is git-ignored). Never log personal data such as emails; log provider failures with status only.
- Test fixtures use made-up data and `example.com` addresses — no real people.
- Add dependencies only with a reason, pin them, and keep `npm audit --omit=dev` clean of high/critical issues.

## UI standards

- **Mobile first, no horizontal scroll at any width (320 px → desktop).** Every list or layout grid needs an explicit `grid-cols-1` before its breakpoint columns, and grid/flex children that truncate text need `min-w-0`. Without that, one long course name widens the whole page on phones.
- Touch targets at least 44 px; visible focus states; labels on every control; announce result counts with `aria-live`.
- Use the theme tokens in `globals.css` (`cream` is the dark text colour, `base` the page background). Never use `text-base` — it also sets the colour to the background token; use `text-[1rem]`.
- Motion: Framer Motion on transform/opacity, short and purposeful. `MotionConfig reducedMotion="user"` handles reduced motion. Scroll programmatically with `scrollToId`; dialogs use `useDialog` (scroll lock, Escape, focus trap).
- Every new string goes into both `en` and `fr` in `i18n.tsx`. French uses 24-hour times ("13 h 00").
- Before calling UI work done, check 320, 375, 390, 768 and 1024 px in both states: live results, and provider down. To simulate provider down, override `window.fetch` in the console so `/api/tee-times` returns `{"teeTimes":[],"providers":{"chronogolf":{"status":"unavailable"}}, ...}`, then search again.

## Deploying

- Netlify builds `main` with `npm run build`. `netlify.toml` must declare `@netlify/plugin-nextjs` (pinned); without it the deploy has no server and every route 404s.
- After each deploy, confirm the server function exists:
  `netlify api getDeploy --data '{"deploy_id":"<id>"}'` → `available_functions` contains `___netlify-server-handler`.
- If production breaks, roll back first, then fix: `netlify api restoreSiteDeploy --data '{"site_id":"bdb529fc-630c-4d88-a958-319ada05e64f","deploy_id":"<last good>"}'`.
- Preview a branch without touching production: build from a clean checkout (no `.env.local`) with `netlify deploy --build --alias <name>`.

## Git

- One branch per change; fast-forward `main` only after tests, lint, build and a browser check pass. Never force-push `main` or rewrite published history.
- Atomic commits whose message says why the change was needed.
- Never commit secrets, `.env*`, build output or generated previews.
