import type { GolfCourse, ProviderId, ProviderState, TeeTime } from "../types";
import { fetchChronogolfWindow } from "./chronogolf";
import { fetchJonasWindow } from "./jonas";
import { fetchTeeItUpWindow } from "./teeitup";
import { fetchTeeTimeWindow } from "./teetime";

/** Live rows inside [startMin, endMin] for a provider's courses, and how it answered. */
export type WindowFetcher = (
  courses: GolfCourse[],
  date: string,
  startMin: number,
  endMin: number,
  options?: { fresh?: boolean },
) => Promise<{ rows: TeeTime[]; state: ProviderState }>;

/**
 * Every booking system Fairway reads live, keyed by `GolfCourse.source`.
 * Adding one takes a module with a fetcher like these, its `ProviderId`, a
 * case in `hasLiveFeed`, and its name in `i18n.tsx`.
 */
export const LIVE_FEEDS: Record<ProviderId, WindowFetcher> = {
  chronogolf: fetchChronogolfWindow,
  teetime: fetchTeeTimeWindow,
  jonas: fetchJonasWindow,
  teeitup: fetchTeeItUpWindow,
};

export const LIVE_PROVIDER_IDS = Object.keys(LIVE_FEEDS) as ProviderId[];
