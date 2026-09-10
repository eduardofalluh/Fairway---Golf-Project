# Fairway verification — 2026-09-10

## Automated checks

- `npm test`: 19 passing tests covering search validation, date and time boundaries, capacity, holes, price and distance sorting, past inventory, estimates, provider URLs/capabilities, map slot consistency, region classification, and email failure handling.
- `npm run lint`: passed.
- `npm run build:next`: passed, including TypeScript.
- Sites `build-site.mjs` / vinext production build: passed.
- `git diff --check`: passed.

## Interactive browser checks

Checked the deployed app and the updated local app in the Codex browser:

- Live search returned provider inventory; party size, holes, preferred time, region, and maximum price narrowed results. Inventory counts change as providers update their sheets.
- A four-player, nine-hole Montréal Island search produced the matching available slot. Moving the time window produced the expected empty state.
- Price sorting worked in both directions; map view loaded course markers and zoom controls.
- Booking details preserved the selected round and searched party size, with an official provider link and an explicit statement that the round was not yet reserved. Escape closed the dialog.
- GGGolf club selection changed the official destination; MinuteGolf sign-in used its official site.
- Blocking the search endpoint produced a visible error with no stale booking buttons. Restoring the connection and retrying returned results.
- Video pause stopped playback.
- At a 390px mobile viewport, result cards initially overflowed horizontally. The fix was verified with equal document client and scroll widths (381px excluding the scrollbar).

## Bugs fixed during verification

Empty provider sheets no longer become estimated availability. Results from other dates and malformed times/round lengths are rejected. Map price, time and holes now describe the same slot. Prices preserve cents, region matching handles local city spellings, failed searches clear previous results, and obsolete result cards no longer linger through exit animations. Malformed email requests return 400 and delivery failures return 503 without claiming success.

## Scope limits

No real reservation, payment, account login or outgoing email was performed. Email failure tests mock delivery. Provider-hosted sign-in and booking handoff are available; linked accounts and automatic checkout require provider integration access. Live inventory currently comes from Chronogolf; GGGolf and MinuteGolf destinations do not imply live inventory integration. Browser checks covered the main flows, not every device or possible provider failure.
