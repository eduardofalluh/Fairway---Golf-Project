import { MARKET_IDS, MARKET_REGIONS, REGIONS, type MarketId, type Region, type SearchQuery } from "./types";

const SORTS = ["price-desc", "price-asc", "closest-time", "closest-price", "distance"];

/** Validate requests before issuing any upstream provider calls. */
export function parseSearchQuery(params: URLSearchParams): SearchQuery {
  const date = params.get("date") ?? "";
  const desiredTime = params.get("time") ?? "";
  const market = params.get("market") ?? "montreal";
  if (!MARKET_IDS.includes(market as MarketId)) {
    throw new Error("Choose a valid golf market.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(`${date}T12:00:00Z`)) ||
      new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date)
    throw new Error("Choose a valid calendar date.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(desiredTime))
    throw new Error("Choose a valid time (HH:MM).");
  const number = (key: string, min: number, max: number, integer = false) => {
    const value = params.get(key);
    if (value == null || value === "") return undefined;
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n)))
      throw new Error(`Invalid ${key}: choose a value between ${min} and ${max}.`);
    return n;
  };
  const holes = params.get("holes") ?? "any";
  if (!["any", "9", "18"].includes(holes)) throw new Error("Choose 9 or 18 holes, or any.");
  const sort = params.get("sort") ?? "price-asc";
  if (!SORTS.includes(sort)) throw new Error("Choose a valid sort order.");
  const regions = params.get("regions")?.split(",").filter(Boolean);
  if (regions?.some((r) => !REGIONS.includes(r as Region))) throw new Error("Choose a valid golf region.");
  if (regions?.some((r) => !MARKET_REGIONS[market as MarketId].includes(r as Region))) {
    throw new Error("Choose a valid region for this market.");
  }
  const minPrice = number("min", 0, 1000);
  const maxPrice = number("max", 0, 1000);
  if (minPrice != null && maxPrice != null && minPrice > maxPrice)
    throw new Error("Minimum price must be below the maximum price.");
  return {
    date, desiredTime, market: market as MarketId,
    windowMinutes: number("window", 0, 180, true) ?? 60,
    players: number("players", 1, 4, true) ?? 2,
    holes: holes === "any" ? "any" : holes === "9" ? 9 : 18,
    targetPrice: number("target", 0, 1000), minPrice, maxPrice,
    maxDistanceKm: number("distance", 0, 500),
    regions: regions as Region[] | undefined,
    cartOnly: params.get("cart") === "1",
    liveOnly: true,
    publicOnly: params.get("public") === "1",
    sort: sort as SearchQuery["sort"],
  };
}
