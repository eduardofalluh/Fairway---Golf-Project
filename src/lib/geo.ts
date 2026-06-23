import type { Region } from "./types";

/** Downtown Montréal reference point. */
export const DOWNTOWN = { lat: 45.5019, lng: -73.5674 };

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function distanceFromDowntown(lat: number, lng: number): number {
  return haversineKm(DOWNTOWN.lat, DOWNTOWN.lng, lat, lng);
}

const ISLAND_CITIES = [
  "montréal",
  "montreal",
  "dorval",
  "anjou",
  "lasalle",
  "lachine",
  "pierrefonds",
  "verdun",
  "saint-laurent",
  "st-laurent",
  "côte-saint-luc",
  "kirkland",
  "pointe-claire",
  "île-bizard",
  "ile-bizard",
  "sainte-geneviève",
  "roxboro",
  "senneville",
];

/**
 * Best-effort region classifier for the Greater Montréal area. Uses city-name
 * hints first, then falls back to geography relative to downtown. Far-flung
 * courses are bucketed into the nearest directional region.
 */
export function classifyRegion(
  city: string,
  lat: number,
  lng: number,
): Region {
  const c = (city || "").toLowerCase().trim();

  if (c.includes("laval")) return "Laval";
  if (ISLAND_CITIES.some((x) => c.includes(x))) return "Montreal Island";

  // Geography fallback.
  if (lng < -73.85) return "Off-Island West";
  if (lng > -73.4) return "Off-Island East";
  if (lat > 45.6) return "North Shore";
  if (lat < 45.5) return "South Shore";
  // ambiguous middle band — split by longitude
  return lng < -73.6 ? "North Shore" : "South Shore";
}
