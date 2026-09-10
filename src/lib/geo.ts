import { getMarket } from "./markets";
import type { MarketId, Region } from "./types";

/** Downtown Montréal reference point. */
export const DOWNTOWN = { lat: 45.5019, lng: -73.5674 };
export const DOWNTOWN_TORONTO = { lat: 43.6532, lng: -79.3832 };

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

export function distanceFromMarket(
  market: MarketId,
  lat: number,
  lng: number,
): number {
  const center = getMarket(market).center;
  return haversineKm(center.lat, center.lng, lat, lng);
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
const TORONTO_CORE_CITIES = ["toronto", "north york", "scarborough", "etobicoke", "east york", "york"];
const EAST_GTA_CITIES = ["ajax", "pickering", "whitby", "oshawa", "uxbridge", "brooklin", "clarington", "bowmanville"];
const WEST_GTA_CITIES = ["mississauga", "oakville", "burlington"];
const PEEL_HALTON_CITIES = ["brampton", "caledon", "caledon east", "milton", "halton hills", "georgetown"];
const NORTH_GTA_CITIES = ["markham", "richmond hill", "vaughan", "maple", "aurora", "newmarket", "stouffville", "whitchurch stouffville", "king city", "king", "woodbridge", "kleinburg"];
const HAMILTON_NIAGARA_CITIES = ["hamilton", "ancaster", "dundas", "stoney creek", "grimsby", "niagara", "niagara falls", "welland", "st catharines"];
const normalizedCity = (city: string) => city.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\bst\b/g, "saint").replace(/\bste\b/g, "sainte");

/**
 * Best-effort region classifier for the selected market. Uses city-name hints
 * first, then falls back to geography relative to that market center. Far-flung
 * courses are bucketed into the nearest directional region.
 */
export function classifyRegion(
  market: MarketId,
  city: string,
  lat: number,
  lng: number,
): Region {
  const c = normalizedCity(city || "");

  if (market === "toronto") {
    if (TORONTO_CORE_CITIES.some((x) => c === x || c.includes(x))) return "Toronto Core";
    if (NORTH_GTA_CITIES.some((x) => c === x || c.includes(x))) return "North GTA";
    if (EAST_GTA_CITIES.some((x) => c === x || c.includes(x))) return "East GTA";
    if (PEEL_HALTON_CITIES.some((x) => c === x || c.includes(x))) return "Peel/Halton";
    if (WEST_GTA_CITIES.some((x) => c === x || c.includes(x))) return "West GTA";
    if (HAMILTON_NIAGARA_CITIES.some((x) => c === x || c.includes(x))) return "Hamilton/Niagara";

    if (lng < -79.55 && lat < 43.8) return "Peel/Halton";
    if (lng < -79.65) return "West GTA";
    if (lng > -79.15) return "East GTA";
    if (lat > 43.78) return "North GTA";
    return "Toronto Core";
  }

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
