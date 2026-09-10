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
    action: "Find my club login",
    description:
      "GGGolf member access is provided through each club, so start with your club's portal.",
  },
] as const;

export const GGGOLF_CLUB_PORTALS = [
  {
    name: "Le Parcours du Cerf",
    href: "https://secure.gggolf.ca/cerf/index.php?lang=fr&option=com_ggpublic&req=teetimes",
  },
  {
    name: "Golf de l'Île de Montréal",
    href: "https://secure.gggolf.ca/iledemontreal/index.php?Itemid=123&lang=fr&option=com_ggpublic",
  },
  {
    name: "Golf Atlantide",
    href: "https://secure.gggolf.ca/atlantide/index.php?lang=fr&option=com_ggpublic&req=teetimes",
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
