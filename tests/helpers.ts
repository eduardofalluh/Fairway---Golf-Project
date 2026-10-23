import { resetChronogolfStateForTests } from '../src/lib/providers/chronogolf';

/** A Chronogolf club as the public `/search` directory endpoint returns it. */
export const stRoseClub = {
  uuid: 'club-st-rose',
  name: 'Golf Sainte-Rose',
  slug: 'golf-sainte-rose',
  holes: [18],
  city: 'Laval',
  country: 'Canada',
  location: { lat: 45.61, lon: -73.78 },
  online_booking_enabled: true,
};

export const dorvalClub = {
  uuid: 'club-dorval',
  name: 'Golf Dorval Lakeshore',
  slug: 'golf-dorval-test',
  holes: [18, 9],
  city: 'Dorval',
  country: 'Canada',
  location: { lat: 45.45, lon: -73.75 },
  online_booking_enabled: true,
};

export const CLUB_COURSES: Record<string, string[]> = {
  'golf-sainte-rose': ['course-st-rose'],
  'golf-dorval-test': ['course-dorval-a', 'course-dorval-b'],
};

export function row(courseUuid: string, date: string, start: string, price = 72, holes = 18) {
  return {
    start_time: start, date, max_player_size: 4,
    course: { uuid: courseUuid, holes },
    default_price: { green_fee: price, bookable_holes: holes },
  };
}

type Handler = (url: URL) => Response | undefined | Promise<Response | undefined>;

/**
 * Replace global fetch with a fake Chronogolf. Directory and club lookups are
 * answered automatically; `teetimes` decides tee-sheet pages. Every URL is
 * recorded so tests can assert how many upstream calls a search costs.
 */
export function fakeChronogolf(options: {
  clubs?: unknown[];
  teetimes?: (url: URL) => Response | Promise<Response>;
  /** Let `teetimes` answer every page itself; otherwise pages after the first are empty, like the real API. */
  paginate?: boolean;
  other?: Handler;
}) {
  resetChronogolfStateForTests();
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url.toString());
    if (url.pathname === '/marketplace/v2/search') {
      return Response.json(url.searchParams.get('page') === '1' ? options.clubs ?? [stRoseClub] : []);
    }
    const club = url.pathname.match(/^\/marketplace\/v2\/clubs\/(.+)$/);
    if (club) {
      const uuids = CLUB_COURSES[decodeURIComponent(club[1])] ?? [];
      return Response.json({ courses: uuids.map((uuid) => ({ uuid })) });
    }
    if (url.pathname === '/marketplace/v2/teetimes' && options.teetimes) {
      if (!options.paginate && url.searchParams.get('page') !== '1') return Response.json({ status: 'open', teetimes: [] });
      return options.teetimes(url);
    }
    const other = await options.other?.(url);
    if (other) return other;
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
  return {
    calls,
    sheetCalls: () => calls.filter((c) => c.includes('/teetimes?')),
    restore: () => {
      globalThis.fetch = original;
      resetChronogolfStateForTests();
    },
  };
}
