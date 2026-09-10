import type { MarketId } from "./types";

export interface MarketConfig {
  id: MarketId;
  label: string;
  shortLabel: string;
  areaLabel: string;
  center: { lat: number; lng: number };
  defaultRadiusKm: number;
}

export const MARKETS: Record<MarketId, MarketConfig> = {
  montreal: {
    id: "montreal",
    label: "Montréal",
    shortLabel: "MTL",
    areaLabel: "Greater Montréal",
    center: { lat: 45.5019, lng: -73.5674 },
    defaultRadiusKm: 100,
  },
  toronto: {
    id: "toronto",
    label: "Toronto",
    shortLabel: "YYZ",
    areaLabel: "Toronto + GTA",
    center: { lat: 43.6532, lng: -79.3832 },
    defaultRadiusKm: 100,
  },
};

export function getMarket(id: MarketId | undefined): MarketConfig {
  return MARKETS[id ?? "montreal"];
}
