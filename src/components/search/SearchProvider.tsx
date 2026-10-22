"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { localNowMinutes, parseTimeToMinutes, todayISO } from "@/lib/format";
import { filterTeeTimes, groupByCourse, timeBuckets, type CourseGroup, type TimeBucket } from "@/lib/results";
import { DEFAULT_FILTERS, readSearchFromUrl, searchToUrl } from "@/lib/search-state";
import { useDirectory } from "@/lib/useDirectory";
import { useTeeTimeSearch, type SearchSnapshot } from "@/lib/useTeeTimeSearch";
import type { GolfCourse, SearchFilters, TeeTimeResult, WindowQuery } from "@/lib/types";

export type ResultView = "course" | "time" | "map";
export type UserLocation = { lat: number; lng: number } | null;

interface SearchContextValue {
  /** False until the browser has read the URL; avoids a stale server date. */
  ready: boolean;
  query: WindowQuery;
  draft: WindowQuery;
  setDraft: (patch: Partial<WindowQuery>) => void;
  submit: (patch?: Partial<WindowQuery>) => void;
  filters: SearchFilters;
  setFilters: (patch: Partial<SearchFilters>) => void;
  resetFilters: () => void;
  search: SearchSnapshot & { retry: () => void };
  directory: GolfCourse[];
  results: TeeTimeResult[];
  /** Live slots in the searched window before any filter. */
  windowTotal: number;
  groups: CourseGroup[];
  buckets: TimeBucket[];
  window: { startMin: number; endMin: number };
  view: ResultView;
  setView: (view: ResultView) => void;
  userLoc: UserLocation;
  locate: () => void;
  geo: { busy: boolean; error: "unavailable" | "denied" | null };
  booking: TeeTimeResult | null;
  openBooking: (result: TeeTimeResult) => void;
  closeBooking: () => void;
  filtersOpen: boolean;
  setFiltersOpen: (open: boolean) => void;
  emailEnabled: boolean;
}

const SearchContext = createContext<SearchContextValue | null>(null);

/**
 * The page is prerendered, so "today" is unknown until the browser runs. Start
 * from a date-less placeholder and fill it from the URL (or defaults) on mount.
 */
const PLACEHOLDER_QUERY: WindowQuery = { market: "montreal", date: "", desiredTime: "13:00", windowMinutes: 60 };

const sameWindow = (a: WindowQuery, b: WindowQuery) =>
  a.market === b.market && a.date === b.date && a.desiredTime === b.desiredTime && a.windowMinutes === b.windowMinutes;

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) throw new Error("useSearch must be used inside SearchProvider");
  return context;
}

export function SearchProvider({ children, emailEnabled }: { children: ReactNode; emailEnabled: boolean }) {
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState<WindowQuery>(PLACEHOLDER_QUERY);
  const [draft, setDraftState] = useState<WindowQuery>(PLACEHOLDER_QUERY);
  const [filters, setFiltersState] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<ResultView>("course");
  const [userLoc, setUserLoc] = useState<UserLocation>(null);
  const [geo, setGeo] = useState<SearchContextValue["geo"]>({ busy: false, error: null });
  const [booking, setBooking] = useState<TeeTimeResult | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Read the shareable search once the browser is in charge.
  useEffect(() => {
    const fromUrl = readSearchFromUrl(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(fromUrl.query);
    setDraftState(fromUrl.query);
    setFiltersState(fromUrl.filters);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const next = `${window.location.pathname}${searchToUrl(query, filters)}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }, [ready, query, filters]);

  const search = useTeeTimeSearch(ready ? query : null);
  const directory = useDirectory(query.market);

  const byId = useMemo(() => {
    const map = new Map<string, GolfCourse>(directory.map((c) => [c.id, c]));
    return map;
  }, [directory]);

  const window_ = useMemo(() => {
    const desired = parseTimeToMinutes(query.desiredTime);
    return {
      startMin: Math.max(0, desired - query.windowMinutes),
      endMin: Math.min(23 * 60 + 59, desired + query.windowMinutes),
    };
  }, [query.desiredTime, query.windowMinutes]);

  const context = useMemo(
    () => ({
      date: query.date,
      desiredTime: query.desiredTime,
      windowMinutes: query.windowMinutes,
      today: todayISO(),
      nowMinutes: localNowMinutes(),
      userLoc,
    }),
    [query, userLoc],
  );

  const sliceFree = useMemo(() => ({ ...filters, slice: undefined }), [filters]);
  const unsliced = useMemo(
    () => filterTeeTimes(search.teeTimes, byId, sliceFree, context),
    [search.teeTimes, byId, sliceFree, context],
  );
  const results = useMemo(
    () => (filters.slice ? unsliced.filter((r) => r.minutes >= filters.slice![0] && r.minutes <= filters.slice![1]) : unsliced),
    [unsliced, filters.slice],
  );
  const groups = useMemo(() => groupByCourse(results), [results]);
  const windowTotal = useMemo(
    () => search.teeTimes.filter((t) => t.date === query.date && t.minutes >= window_.startMin && t.minutes <= window_.endMin).length,
    [search.teeTimes, query.date, window_],
  );
  // The timeline always shows the whole window so a picked slice can be undone.
  const buckets = useMemo(() => timeBuckets(unsliced, window_.startMin, window_.endMin), [unsliced, window_]);

  const setDraft = useCallback((patch: Partial<WindowQuery>) => {
    setDraftState((d) => ({ ...d, ...patch }));
  }, []);

  const submit = useCallback(
    (patch?: Partial<WindowQuery>) => {
      const next = { ...draft, ...patch };
      setDraftState(next);
      setQuery((q) => (sameWindow(q, next) ? q : next));
      const marketChanged = next.market !== query.market;
      setFiltersState((f) => ({ ...f, slice: undefined, regions: marketChanged ? [] : f.regions }));
    },
    [draft, query.market],
  );

  const setFilters = useCallback((patch: Partial<SearchFilters>) => {
    setFiltersState((f) => ({ ...f, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState((f) => ({ ...DEFAULT_FILTERS, players: f.players, sort: f.sort }));
  }, []);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeo({ busy: false, error: "unavailable" });
      return;
    }
    setGeo({ busy: true, error: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeo({ busy: false, error: null });
        setFiltersState((f) => ({ ...f, sort: "distance" }));
      },
      () => setGeo({ busy: false, error: "denied" }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  const openBooking = useCallback(
    (result: TeeTimeResult) => setBooking({ ...result, players: filters.players }),
    [filters.players],
  );
  const closeBooking = useCallback(() => setBooking(null), []);

  const value: SearchContextValue = {
    ready,
    query,
    draft,
    setDraft,
    submit,
    filters,
    setFilters,
    resetFilters,
    search,
    directory,
    results,
    windowTotal,
    groups,
    buckets,
    window: window_,
    view,
    setView,
    userLoc,
    locate,
    geo,
    booking,
    openBooking,
    closeBooking,
    filtersOpen,
    setFiltersOpen,
    emailEnabled,
  };

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}
