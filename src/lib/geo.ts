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

const SOUTH_SHORE_CITIES = ["boucherville", "longueuil", "brossard", "saint lambert", "candiac", "kahnawake", "saint basile le grand", "mont saint hilaire", "beloeil", "saint bruno", "sainte julie", "varennes", "vercheres", "la prairie", "saint jean sur richelieu"];
const NORTH_SHORE_CITIES = ["mirabel", "saint janvier", "terrebonne", "lorraine", "blainville", "rosemere", "boisbriand", "bois des filion", "sainte therese", "saint eustache", "deux montagnes", "saint jerome", "sainte sophie", "mascouche", "repentigny", "l assomption", "lavaltrie"];
const normalizedCity = (city: string) => city.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\bst\b/g, "saint").replace(/\bste\b/g, "sainte");

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
  const c = normalizedCity(city || "");

  if (c === "laval" || c === "laval sur le lac" || c === "sainte dorothee" || c === "chomedey") return "Laval";
  if (ISLAND_CITIES.some((x) => c.includes(normalizedCity(x)))) return "Montreal Island";
  if (SOUTH_SHORE_CITIES.some((x) => c === x || c.startsWith(`${x} `))) return "South Shore";
  if (NORTH_SHORE_CITIES.some((x) => c === x || c.startsWith(`${x} `))) return "North Shore";

  // Geography fallback.
  if (lng < -73.85) return "Off-Island West";
  if (lng > -73.4) return "Off-Island East";
  if (lat > 45.6) return "North Shore";
  if (lat < 45.5) return "South Shore";
  // ambiguous middle band — split by longitude
  return lng < -73.6 ? "North Shore" : "South Shore";
}
