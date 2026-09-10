export type BookingProviderId =
  | "chronogolf"
  | "teetime"
  | "golfthe6ix"
  | "golfnow"
  | "ezlinks"
  | "teeitup"
  | "linkline"
  | "jonas"
  | "clublink"
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
  teetime: {
    id: "teetime",
    name: "TeeTime",
    accountAccess: "central",
    connectedAccount: false,
    directBooking: false,
    contextualHandoff: true,
  },
  golfthe6ix: {
    id: "golfthe6ix",
    name: "Golf the 6ix",
    accountAccess: "central",
    connectedAccount: false,
    directBooking: false,
    contextualHandoff: false,
  },
  golfnow: {
    id: "golfnow",
    name: "GolfNow",
    accountAccess: "central",
    connectedAccount: false,
    directBooking: false,
    contextualHandoff: false,
  },
  ezlinks: {
    id: "ezlinks",
    name: "EZLinks",
    accountAccess: "central",
    connectedAccount: false,
    directBooking: false,
    contextualHandoff: false,
  },
  teeitup: {
    id: "teeitup",
    name: "TeeItUp",
    accountAccess: "central",
    connectedAccount: false,
    directBooking: false,
    contextualHandoff: false,
  },
  linkline: {
    id: "linkline",
    name: "LinkLine",
    accountAccess: "unknown",
    connectedAccount: false,
    directBooking: false,
    contextualHandoff: false,
  },
  jonas: {
    id: "jonas",
    name: "Jonas",
    accountAccess: "unknown",
    connectedAccount: false,
    directBooking: false,
    contextualHandoff: false,
  },
  clublink: {
    id: "clublink",
    name: "ClubLink",
    accountAccess: "central",
    connectedAccount: false,
    directBooking: false,
    contextualHandoff: false,
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
    id: "teetime" as const,
    name: "TeeTime",
    href: "https://tee-time.com/login",
    action: "Sign in on TeeTime",
    description:
      "Toronto live tee times can come from TeeTime clubs. Sign in there before you finish booking.",
  },
  {
    id: "golfthe6ix" as const,
    name: "Golf the 6ix",
    href: "https://app.golfthe6ix.com/",
    action: "Open Golf the 6ix",
    description:
      "City of Toronto courses use Golf the 6ix for provider-hosted booking.",
  },
  {
    id: "golfnow" as const,
    name: "GolfNow",
    href: "https://www.golfnow.com/login",
    action: "Sign in on GolfNow",
    description:
      "GolfNow is useful for Toronto-area provider handoffs where clubs use its booking network.",
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
    if (hostname === "tee-time.com" || hostname.endsWith(".tee-time.com")) {
      return BOOKING_PROVIDERS.teetime;
    }
    if (hostname === "app.golfthe6ix.com" || hostname.endsWith(".golfthe6ix.com")) {
      return BOOKING_PROVIDERS.golfthe6ix;
    }
    if (hostname === "golfnow.com" || hostname.endsWith(".golfnow.com")) {
      return BOOKING_PROVIDERS.golfnow;
    }
    if (hostname === "ezlinksgolf.com" || hostname.endsWith(".ezlinksgolf.com")) {
      return BOOKING_PROVIDERS.ezlinks;
    }
    if (hostname === "teeitup.golf" || hostname.endsWith(".teeitup.golf")) {
      return BOOKING_PROVIDERS.teeitup;
    }
    if (hostname === "linklineonline.ca" || hostname.endsWith(".linklineonline.ca")) {
      return BOOKING_PROVIDERS.linkline;
    }
    if (hostname.includes("clubhouseonline")) {
      return BOOKING_PROVIDERS.jonas;
    }
    if (hostname === "clublink.ca" || hostname.endsWith(".clublink.ca")) {
      return BOOKING_PROVIDERS.clublink;
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
