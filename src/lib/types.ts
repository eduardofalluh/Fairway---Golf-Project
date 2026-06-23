// Core domain types for the tee-time aggregator.

export type Region =
  | "Montreal Island"
  | "Laval"
  | "North Shore"
  | "South Shore"
  | "Off-Island West"
  | "Off-Island East";

export const REGIONS: Region[] = [
  "Montreal Island",
  "Laval",
  "North Shore",
  "South Shore",
  "Off-Island West",
  "Off-Island East",
];

export interface GolfCourse {
  /** Stable id — Chronogolf course UUID, or a slug for curated extras. */
  id: string;
  name: string;
  city: string;
  region: Region;
  /** Hole configurations offered, e.g. [9, 18]. */
  holes: number[];
  /** Driving-ish distance from downtown Montréal, km (haversine). */
  distanceKm: number;
  lat: number;
  lng: number;
  /** Where this course's data comes from. */
  source: "chronogolf" | "extra";
  /** Chronogolf identifiers (present when source === "chronogolf"). */
  chronogolfUuid?: string;
  chronogolfSlug?: string;
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
  /** "live" = real Chronogolf availability; "estimate" = generated fallback */
  source: "live" | "estimate";
  bookingUrl: string;
}

export interface TeeTimeResult extends TeeTime {
  course: GolfCourse;
  /** absolute minutes away from the user's desired time */
  deltaMinutes: number;
}

export interface SearchQuery {
  date: string; // YYYY-MM-DD
  desiredTime: string; // HH:MM
  windowMinutes: number;
  players: number;
  holes?: 9 | 18 | "any";
  targetPrice?: number;
  maxPrice?: number;
  minPrice?: number;
  regions?: Region[];
  maxDistanceKm?: number;
  cartOnly?: boolean;
  liveOnly?: boolean;
  publicOnly?: boolean;
  sort?: "price-desc" | "price-asc" | "closest-time" | "closest-price" | "distance";
}
