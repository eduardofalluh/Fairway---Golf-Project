# Provider integration status

Verified against provider-owned pages on September 10, 2026.

Fairway currently supports Montréal and Toronto/GTA discovery through a mix of
live public provider data and official booking handoffs. No provider reviewed for
this app publishes public OAuth credentials or a third-party reservation API that
would let Fairway truthfully complete payment and booking inside the app.

## Live availability sources

Chronogolf is both a live tee-time source and a provider-hosted account handoff.
Fairway searches public Chronogolf marketplace endpoints when available, and the
Chronogolf account card links to the official
[Chronogolf login page](https://www.chronogolf.com/login?returnUrl=https%3A%2F%2Fwww.chronogolf.com%2F).
The login destination was checked on September 10, 2026 and returned the
provider-owned Chronogolf login page.

TeeTime is a Toronto/GTA live source for selected Ontario clubs. Fairway reads
server-rendered public club pages such as
[Pickering Glen](https://tee-time.com/clubs/pickering-glen-golf-club),
[Kirby Links](https://tee-time.com/clubs/kirby-links-golf-course),
[Lionhead](https://tee-time.com/clubs/lionhead-golf-club-conference-centre), and
[Royal Ontario](https://tee-time.com/clubs/royal-ontario-golf-club) when their
availability data is present. The account card links to
[TeeTime login](https://tee-time.com/login).

If a live provider is unreachable or a tee sheet is outside its booking window,
Fairway returns clearly labeled estimates when the user has not selected
live-only. Estimates are planning placeholders, not provider-confirmed slots.

## Toronto/GTA handoff providers

- City of Toronto municipal courses use [Golf the 6ix](https://app.golfthe6ix.com/).
  Fairway includes Don Valley, Tam O'Shanter, Scarlett Woods, Humber Valley, and
  Dentonia Park as official handoffs.
- Mississauga courses use EZLinks booking handoffs, including
  [BraeBen](https://braeben.ezlinksgolf.com/) and
  [Lakeview](https://lakeviewgc.ezlinksgolf.com/).
- Angus Glen opens through its TeeItUp booking experience at
  [angus-glen.book.teeitup.golf](https://angus-glen.book.teeitup.golf/).
- Glen Abbey uses the ClubLink booking site at
  [glenabbey.clublink.ca](https://glenabbey.clublink.ca/daily-fee-golf/book/).
- Jonas/ClubhouseOnline handoffs are included for courses such as
  [Watson's Glen](https://watsonsglengc.clubhouseonline-e3.net/PublicTeeTimes/TeeSheet.aspx)
  and [Copper Creek](https://coppercreekgc.clubhouseonline-e3.net/PublicTeeTimes/TeeSheet.aspx).
- GolfNow is included as a central Toronto-area provider account handoff at
  [GolfNow login](https://www.golfnow.com/login). Fairway does not currently
  ingest GolfNow search results because the public pages do not provide a stable,
  app-friendly feed.

## Montréal handoff providers

MinuteGolf has a central public login page. GGGolf member access is
club-specific, so golfers must enter through their club's portal. The booking
modal uses the tee time's real provider or course URL and clearly states that no
reservation exists until the provider confirms it.

The GGGolf account selector links directly to the public golfer login forms for
[Club de Golf La Madeleine](https://secure.gggolf.ca/madeleine/index.php?lang=fr&option=com_ggpublic&req=user),
[Le Parcours du Cerf](https://secure.gggolf.ca/cerf/index.php?option=com_ggpublic&req=user&lang=fr),
[Golf de l'Île de Montréal](https://secure.gggolf.ca/iledemontreal/index.php?option=com_ggpublic&req=user&lang=fr),
and [Golf Atlantide](https://secure.gggolf.ca/atlantide/index.php?option=com_ggpublic&req=user&lang=fr).
Each destination was opened in a browser and verified to display email/password
fields. A club must be selected before sign-in becomes available; golfer help is
a separate link. These are login destinations, distinct from tee-sheet URLs.

GGGolf is not limited to the four clubs currently shown in Fairway. The Fairway
selector intentionally lists only local club portals that are currently present
in the app's course data and verified to open a public golfer login form.

## What Fairway supports now

Fairway can send a golfer to an official provider page to sign in and finish a
reservation. Fairway does not collect provider passwords, copy provider cookies,
verify external account sessions, or report a reservation as booked. The provider
account buttons only open official pages; browser security prevents Fairway from
reading the resulting provider session.

After opening a provider login page, users can mark that provider as connected
inside Fairway. That state is local to the user's browser: the sign-in button
becomes a disabled connected button until the user disconnects it on that device.
It is not provider-authenticated OAuth state.

When a provider is marked connected, matching tee-time cards change from a
review/check action to a direct `Book with {Provider}` handoff. Central-provider
connections apply provider-wide. GGGolf connections are scoped to the selected
club portal, so connecting one GGGolf club only unlocks matching tee-sheet links
for that club.

The active `/api/autobook` route returns `501 Not Implemented`. It does not
launch a browser or suggest that Fairway can complete a checkout. Tee-time detail
email is considered sent only after the email service reports delivery.
Production email requires `RESEND_API_KEY`; `BOOKING_FROM_EMAIL` should be a
sender verified in that Resend account. Without that configuration the route
returns `503` and the UI tells the golfer delivery failed.

## What is required for account linking and one-click booking

Before the UI can truthfully show a provider-authenticated account or book on a
golfer's behalf, each provider must provide and authorize:

1. A partner agreement covering availability, reservations, payments, support,
   cancellations, personal information, and permitted use.
2. A documented OAuth or equivalent delegated authorization flow with client
   credentials, redirect URLs, scopes, token refresh/revocation, and a sandbox.
3. Stable course and tee-time identifiers plus real-time availability and final
   price endpoints.
4. Reservation creation with idempotency keys, clear payment responsibility, and
   an authoritative booking confirmation identifier.
5. Cancellation/change endpoints and signed webhooks so local state stays in
   sync with the provider.
6. Rate limits, error contracts, test accounts, security review requirements,
   and production credentials.

Until those items exist, provider-hosted sign-in and checkout are the complete,
safe integration.
