export type BookingProviderId =
  | "chronogolf"
  | "minutegolf"
  | "gggolf"
  | "course";

export interface BookingProviderConfig {
  id: BookingProviderId;
  name: string;
  /** Whether a golfer can start a provider-hosted sign-in from Fairway. */
  accountAccess: "central" | "club-specific" | "unknown";
  /** No provider currently exposes a public OAuth flow for this app. */
  connectedAccount: false;
  /** No provider currently exposes a public reservation API for this app. */
  directBooking: false;
  /** Whether the result URL carries search context such as date and holes. */
  contextualHandoff: boolean;
}

export const BOOKING_PROVIDERS: Record<
  BookingProviderId,
  BookingProviderConfig
> = {
  chronogolf: {
    id: "chronogolf",
    name: "Chronogolf",
    accountAccess: "central",
    connectedAccount: false,
    directBooking: false,
    contextualHandoff: true,
  },
  minutegolf: {
    id: "minutegolf",
    name: "MinuteGolf",
    accountAccess: "central",
    connectedAccount: false,
    directBooking: false,
    contextualHandoff: false,
  },
  gggolf: {
    id: "gggolf",
    name: "GGGolf",
    accountAccess: "club-specific",
    connectedAccount: false,
    directBooking: false,
    contextualHandoff: false,
  },
  course: {
    id: "course",
    name: "the course",
    accountAccess: "unknown",
    connectedAccount: false,
    directBooking: false,
    contextualHandoff: false,
  },
};

export const PROVIDER_ACCOUNT_LINKS = [
  {
    id: "chronogolf" as const,
    name: "Chronogolf",
    href: "https://www.chronogolf.com/login?returnUrl=https%3A%2F%2Fwww.chronogolf.com%2F",
    action: "Sign in on Chronogolf",
    description:
      "Live tee times come from Chronogolf when its course sheet is open. Sign in there before you finish booking.",
  },
  {
    id: "minutegolf" as const,
    name: "MinuteGolf",
    href: "https://www.minutegolf.ca/index.php?option=com_ggportal&req=user&lang=en",
    action: "Sign in on MinuteGolf",
    description:
      "Use MinuteGolf's own secure page. Your password stays with MinuteGolf.",
  },
  {
    id: "gggolf" as const,
    name: "GGGolf",
    href: "https://www.gggolf.ca/aide-aux-golfeurs",
    action: "Sign in on GGGolf",
    description:
      "Choose a verified local club portal. Your password stays with GGGolf.",
  },
] as const;

export const GGGOLF_CLUB_PORTALS = [
  {
    name: "Club de Golf La Madeleine",
    href: "https://secure.gggolf.ca/madeleine/index.php?lang=fr&option=com_ggpublic&req=user",
  },
  {
    name: "Le Parcours du Cerf",
    href: "https://secure.gggolf.ca/cerf/index.php?option=com_ggpublic&req=user&lang=fr",
  },
  {
    name: "Golf de l'Île de Montréal",
    href: "https://secure.gggolf.ca/iledemontreal/index.php?option=com_ggpublic&req=user&lang=fr",
  },
  {
    name: "Golf Atlantide",
    href: "https://secure.gggolf.ca/atlantide/index.php?option=com_ggpublic&req=user&lang=fr",
  },
] as const;

export function getBookingProvider(bookingUrl: string): BookingProviderConfig {
  try {
    const hostname = new URL(bookingUrl).hostname.toLowerCase();
    if (hostname === "minutegolf.ca" || hostname.endsWith(".minutegolf.ca")) {
      return BOOKING_PROVIDERS.minutegolf;
    }
    if (hostname === "gggolf.ca" || hostname.endsWith(".gggolf.ca")) {
      return BOOKING_PROVIDERS.gggolf;
    }
    if (hostname === "chronogolf.com" || hostname.endsWith(".chronogolf.com")) {
      return BOOKING_PROVIDERS.chronogolf;
    }
  } catch {
    // The URL is rendered as an unavailable handoff by `safeBookingUrl` below.
  }
  return BOOKING_PROVIDERS.course;
}

export function safeBookingUrl(bookingUrl: string): string | null {
  try {
    const url = new URL(bookingUrl);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
