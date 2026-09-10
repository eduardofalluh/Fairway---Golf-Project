# Chronogolf, GGGolf and MinuteGolf integration status

Verified against provider-owned pages on September 10, 2026.

Chronogolf is both a live tee-time source and a provider-hosted account handoff.
Fairway searches public Chronogolf marketplace endpoints when available, and the
Chronogolf account card links to the official
[Chronogolf login page](https://www.chronogolf.com/login?returnUrl=https%3A%2F%2Fwww.chronogolf.com%2F).
The login destination was checked on September 10, 2026 and returned the
provider-owned CHRONOGOLF login page.

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
reservation. MinuteGolf has a central public login page. GGGolf member access is
club-specific, so golfers must enter through their club's portal. The booking
modal uses the tee time's real provider or course URL and clearly states that no
reservation exists until the provider confirms it.

Fairway does not collect provider passwords, copy provider cookies, verify
external account sessions, or report a reservation as booked. The provider
account buttons only open official pages; browser security prevents Fairway from
reading the resulting provider session.

After opening a provider login page, users can mark that provider as connected
inside Fairway. That state is local to the user's browser and only affects the
account card display: the sign-in button becomes a disabled connected button
until the user disconnects it on that device. It is not provider-authenticated
OAuth state.

The active `/api/autobook` route returns `501 Not Implemented`. It no longer
launches a browser or suggests that Fairway can complete a checkout. Tee-time
detail email is considered sent only after the email service reports delivery.
Production email requires `RESEND_API_KEY`; `BOOKING_FROM_EMAIL` should be a
sender verified in that Resend account. Without that configuration the route
returns `503` and the UI tells the golfer delivery failed.

## Verified provider behavior

- [MinuteGolf](https://www.minutegolf.ca/index.php?lang=en) advertises search,
  price comparison, and booking across Quebec clubs.
- [MinuteGolf's login page](https://www.minutegolf.ca/index.php?option=com_ggportal&req=user&lang=en)
  accepts the golfer's credentials on the provider's own domain.
- [GGGolf golfer help](https://www.gggolf.ca/aide-aux-golfeurs) instructs
  golfers to sign in on MinuteGolf or through the website of their golf club.
- [MinuteGolf's privacy policy](https://www.minutegolf.ca/index.php?Itemid=124&id=3&lang=en&option=com_content&view=article)
  says MinuteGolf and GGGolf use shared authentication and account-management
  infrastructure, and that an account may be recognized by some related
  services. That statement does not grant third-party access to Fairway.
- [GGGolf's PAR booking guide](https://secure.gggolf.ca/par/index.php?Itemid=174&id=52&lang=fr&option=com_content&view=article)
  shows that members log in through their club, choose a tee time, enter their
  group, and receive the real-time confirmation from GGGolf.
- [GGGolf's platform page](https://www.gggolf.ca/) describes third-party
  integrations and provides a contact/demo path, but the provider-owned public
  pages reviewed did not publish OAuth authorization endpoints, developer
  credentials, or reservation API documentation for independent consumer apps.

## What is required for account linking and one-click booking

Before the UI can truthfully show a connected account or book on a golfer's
behalf, GGGolf/MinuteGolf must provide and authorize:

1. A partner agreement covering availability, reservations, payments, support,
   cancellations, personal information, and permitted use.
2. A documented OAuth or equivalent delegated authorization flow with client
   credentials, redirect URLs, scopes, token refresh/revocation, and a sandbox.
3. Stable course and tee-time identifiers plus real-time availability and final
   price endpoints.
4. Reservation creation with idempotency keys, clear payment responsibility,
   and an authoritative booking confirmation identifier.
5. Cancellation/change endpoints and signed webhooks so local state stays in
   sync with the provider.
6. Rate limits, error contracts, test accounts, security review requirements,
   and production credentials.

Until those items exist, provider-hosted sign-in and checkout are the complete,
safe integration. A product or partnership contact with GGGolf should ask for
their third-party integration program and technical documentation.
