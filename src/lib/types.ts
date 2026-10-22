// Core domain types for the tee-time aggregator.

export type MarketId = "montreal" | "toronto";

export const MARKET_IDS: MarketId[] = ["montreal", "toronto"];

export type Region =
  | "Montreal Island"
  | "Laval"
  | "North Shore"
  | "South Shore"
  | "Off-Island West"
  | "Off-Island East"
  | "Toronto Core"
  | "North GTA"
  | "East GTA"
  | "West GTA"
  | "Peel/Halton"
  | "Hamilton/Niagara";

export const REGIONS: Region[] = [
  "Montreal Island",
  "Laval",
  "North Shore",
  "South Shore",
  "Off-Island West",
  "Off-Island East",
  "Toronto Core",
  "North GTA",
  "East GTA",
  "West GTA",
  "Peel/Halton",
  "Hamilton/Niagara",
];

export const MARKET_REGIONS: Record<MarketId, Region[]> = {
  montreal: [
    "Montreal Island",
    "Laval",
    "North Shore",
    "South Shore",
    "Off-Island West",
    "Off-Island East",
  ],
  toronto: [
    "Toronto Core",
    "North GTA",
    "East GTA",
    "West GTA",
    "Peel/Halton",
    "Hamilton/Niagara",
  ],
};

export interface GolfCourse {
  /** Stable id — Chronogolf course UUID, or a slug for curated extras. */
  id: string;
  /** Search market this course belongs to. */
  market: MarketId;
  name: string;
  city: string;
  region: Region;
  /** Hole configurations offered, e.g. [9, 18]. */
  holes: number[];
  /** Driving-ish distance from this market's downtown reference, km (haversine). */
  distanceKm: number;
  lat: number;
  lng: number;
  /** Where this course's data comes from. */
  source: "chronogolf" | "teetime" | "extra";
  /** Chronogolf identifiers (present when source === "chronogolf"). */
  chronogolfUuid?: string;
  chronogolfSlug?: string;
  /** TeeTime slug (present when source === "teetime"). */
  teeTimeSlug?: string;
  /** Real base prices from Chronogolf when available (CAD per player). */
  weekdayPrice?: number | null;
  weekendPrice?: number | null;
  /** Whether online booking is enabled (Chronogolf). */
  online: boolean;
  /** Public access classification (best-effort). */
  access: "public" | "semi-private" | "private";
  bookingUrl: string;
  photo?: string;
  blurb?: string;
}

export interface TeeTime {
  id: string;
  courseId: string;
  /** ISO date (YYYY-MM-DD), local Montréal time */
  date: string;
  /** "HH:MM" 24h local time */
  time: string;
  /** minutes since local midnight — precomputed for fast filtering */
  minutes: number;
  /** price per player in CAD */
  price: number;
  /** available spots / max players */
  players: number;
  holes: number;
  cart: boolean;
  /** "live" = provider-confirmed availability. */
  source: "live" | "estimate";
  bookingUrl: string;
}

export interface TeeTimeResult extends TeeTime {
  course: GolfCourse;
  /** absolute minutes away from the user's desired time */
  deltaMinutes: number;
}

export type SortKey =
  | "closest-time"
  | "price-asc"
  | "price-desc"
  | "closest-price"
  | "distance";

export const SORT_KEYS: SortKey[] = [
  "closest-time",
  "price-asc",
  "price-desc",
  "closest-price",
  "distance",
];

/**
 * What the server fetches from providers. Everything else is a client-side
 * filter, so identical windows share one cached upstream fetch.
 */
export interface WindowQuery {
  market: MarketId;
  date: string; // YYYY-MM-DD
  desiredTime: string; // HH:MM
  windowMinutes: number;
}

/** Filters applied in the browser to an already-fetched window. */
export interface SearchFilters {
  players: number;
  holes: 9 | 18 | "any";
  targetPrice?: number;
  minPrice?: number;
  maxPrice?: number;
  regions: Region[];
  maxDistanceKm?: number;
  cartOnly: boolean;
  publicOnly: boolean;
  sort: SortKey;
  /** Optional [start, end] minutes slice picked on the timeline. */
  slice?: [number, number];
}

export type ProviderId = "chronogolf" | "teetime";

/**
 * ok = every sheet answered; partial = some sheets answered; throttled = the
 * provider asked us to slow down; unavailable = no sheet could be read.
 */
export type ProviderStatus = "ok" | "partial" | "throttled" | "unavailable";

export interface ProviderState {
  status: ProviderStatus;
  retryAfterSec?: number;
  /** Why a feed failed (e.g. "http 403", "timeout"), for diagnosing hosts. */
  detail?: string;
}

export interface TeeTimePartResponse {
  market: MarketId;
  date: string;
  startMin: number;
  endMin: number;
  part: number;
  parts: number;
  checkedCourses: number;
  teeTimes: TeeTime[];
  providers: Partial<Record<ProviderId, ProviderState>>;
}
