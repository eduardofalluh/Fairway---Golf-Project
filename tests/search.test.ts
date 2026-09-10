import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSearchQuery } from '../src/lib/search-query';
import { applySearch, search } from '../src/lib/aggregator';
import { parseTeetimesResponse } from '../src/lib/providers/chronogolf';
import { fetchTeeTimeCourseTeeTimes } from '../src/lib/providers/teetime';
import { generateEstimatedTeeTimes } from '../src/lib/providers/seed';
import type { GolfCourse, TeeTime } from '../src/lib/types';

const params = (extra = '') => new URLSearchParams(`date=2099-07-10&time=13:00&${extra}`);
const course: GolfCourse = { id: 'test', market: 'montreal', name: 'Test course', city: 'Laval', region: 'Laval', holes: [18], distanceKm: 10, lat: 45.6, lng: -73.7, source: 'chronogolf', online: true, access: 'public', bookingUrl: 'https://www.chronogolf.com/club/test' };

test('search defaults to real availability and lowest price', () => {
  const q = parseSearchQuery(params());
  assert.equal(q.liveOnly, true); assert.equal(q.sort, 'price-asc');
  assert.equal(q.market, 'montreal');
  assert.equal(parseSearchQuery(params('live=0')).liveOnly, false);
});
test('accepts Toronto market and rejects cross-market regions', () => {
  const toronto = parseSearchQuery(params('market=toronto&regions=North+GTA,East+GTA'));
  assert.equal(toronto.market, 'toronto');
  assert.deepEqual(toronto.regions, ['North GTA', 'East GTA']);
  assert.throws(() => parseSearchQuery(params('market=toronto&regions=Laval')));
  assert.throws(() => parseSearchQuery(params('market=vancouver')));
});
test('rejects invalid calendars, times, budgets and player counts', () => {
  for (const suffix of ['date=2026-02-30', 'time=25:99', 'players=NaN', 'players=5', 'players=1.5', 'window=-1', 'max=Infinity', 'min=100&max=50', 'regions=Unknown', 'holes=27', 'sort=anything']) {
    const p = params(); for (const [key,value] of new URLSearchParams(suffix)) p.set(key,value);
    assert.throws(() => parseSearchQuery(p), suffix);
  }
});
test('accepts inclusive numeric filter bounds', () => {
  const low = parseSearchQuery(params('window=0&players=1&min=0&max=0&target=0&distance=0'));
  assert.deepEqual(
    [low.windowMinutes, low.players, low.minPrice, low.maxPrice, low.targetPrice, low.maxDistanceKm],
    [0, 1, 0, 0, 0, 0],
  );
  const high = parseSearchQuery(params('window=180&players=4&min=1000&max=1000&target=1000&distance=500'));
  assert.deepEqual(
    [high.windowMinutes, high.players, high.minPrice, high.maxPrice, high.targetPrice, high.maxDistanceKm],
    [180, 4, 1000, 1000, 1000, 500],
  );
});
test('preserves cents and rejects unavailable or mismatched live inventory', () => {
  const good = { start_time: '13:00', date: '2099-07-10', max_player_size: 2, default_price: { green_fee: 55.75, bookable_holes: 18 } };
  const rows = parseTeetimesResponse(course, '2099-07-10', { status: 'open', teetimes: [
    good,
    {...good, max_player_size: 0},
    {...good, max_player_size: undefined},
    {...good, date: '2099-07-11'},
    {...good, start_time: '25:99'},
    {...good, default_price: { green_fee: 0, bookable_holes: 18 }},
    {...good, default_price: { green_fee: Number.POSITIVE_INFINITY, bookable_holes: 18 }},
    {...good, default_price: { green_fee: 40, bookable_holes: 12 }},
  ] });
  assert.equal(rows.length, 1); assert.equal(rows[0].price, 55.75);
});
test('filters estimates, capacity, time and sorts comparable prices', () => {
  const base: TeeTime = { id:'a',courseId:'test',date:'2099-07-10',time:'13:00',minutes:780,price:60.5,players:4,holes:18,cart:false,source:'live',bookingUrl:course.bookingUrl };
  const rows = [base,{...base,id:'b',price:50.25},{...base,id:'estimate',source:'estimate' as const},{...base,id:'full',players:1},{...base,id:'late',minutes:1000}];
  const result=applySearch(rows,new Map([[course.id,course]]),parseSearchQuery(params()));
  assert.deepEqual(result.map(x=>x.id),['b','a']);
});
test('supports explicit distance and closest-price ordering after filters', () => {
  const near = { ...course, id: 'near', distanceKm: 5 };
  const far = { ...course, id: 'far', distanceKm: 20 };
  const row = (id: string, courseId: string, price: number): TeeTime => ({
    id, courseId, date: '2099-07-10', time: '13:00', minutes: 780,
    price, players: 4, holes: 18, cart: false, source: 'live', bookingUrl: course.bookingUrl,
  });
  const byId = new Map([[near.id, near], [far.id, far]]);
  const rows = [row('far-price', far.id, 59), row('near-price', near.id, 80)];
  const base = parseSearchQuery(params('live=0&max=80'));
  assert.deepEqual(applySearch(rows, byId, { ...base, sort: 'distance' }).map(r => r.id), ['near-price', 'far-price']);
  assert.deepEqual(applySearch(rows, byId, { ...base, sort: 'closest-price', targetPrice: 60 }).map(r => r.id), ['far-price', 'near-price']);
});
test('never returns inventory from a different date than the request', () => {
  const row: TeeTime = { id:'wrong-day',courseId:'test',date:'2099-07-11',time:'13:00',minutes:780,price:50,players:4,holes:18,cart:false,source:'live',bookingUrl:course.bookingUrl };
  const result = applySearch([row], new Map([[course.id, course]]), parseSearchQuery(params()));
  assert.deepEqual(result, []);
});
test('price, cart, holes and time bounds are inclusive', () => {
  const base: TeeTime = { id:'boundary',courseId:'test',date:'2099-07-10',time:'14:00',minutes:840,price:50,players:2,holes:18,cart:true,source:'live',bookingUrl:course.bookingUrl };
  const query = parseSearchQuery(params('window=60&players=2&holes=18&min=50&max=50&cart=1'));
  assert.deepEqual(applySearch([base], new Map([[course.id, course]]), query).map((r) => r.id), ['boundary']);
});
test('estimated schedules are deterministic and keep course round constraints', () => {
  const nineOnly = { ...course, id: 'nine', holes: [9] };
  const first = generateEstimatedTeeTimes(nineOnly, '2099-07-10');
  const second = generateEstimatedTeeTimes(nineOnly, '2099-07-10');
  assert.deepEqual(second, first);
  assert.ok(first.length > 0);
  assert.ok(first.every((row) => row.date === '2099-07-10' && row.holes === 9 && row.source === 'estimate'));
});
test('an explicitly open but empty provider sheet does not become invented availability', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.includes('/marketplace/v2/search?')) {
      return Response.json([{
        uuid: 'mock-club', name: 'Mock Club', slug: 'mock-club', holes: [18],
        city: 'Laval', province: 'QC', country: 'Canada',
        weekday_price: 60, weekend_price: 70,
        location: { lat: 45.6, lon: -73.7 }, online_booking_enabled: true,
      }]);
    }
    if (url.includes('/marketplace/v2/clubs/mock-club')) {
      return Response.json({ courses: [{ uuid: 'mock-course', holes: 18 }] });
    }
    if (url.includes('/marketplace/v2/teetimes?')) {
      return Response.json({ status: 'open', teetimes: [] });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
  try {
    const response = await search(parseSearchQuery(params('live=0&players=1&window=180&max=1000')));
    assert.equal(response.results.filter((row) => row.courseId === 'mock-club').length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test('TeeTime search results preserve provider date handoff', () => {
  const teetimeCourse: GolfCourse = {
    ...course,
    id: 'extra-kirby-links-golf-course',
    market: 'toronto',
    name: 'Kirby Links Golf Course',
    city: 'Maple',
    region: 'North GTA',
    source: 'teetime',
    teeTimeSlug: 'kirby-links-golf-course',
    bookingUrl: 'https://tee-time.com/clubs/kirby-links-golf-course',
  };
  const row: TeeTime = {
    id: 'kirby-1300',
    courseId: teetimeCourse.id,
    date: '2099-07-10',
    time: '13:00',
    minutes: 780,
    price: 35,
    players: 4,
    holes: 18,
    cart: false,
    source: 'live',
    bookingUrl: 'https://tee-time.com/clubs/kirby-links-golf-course?date=2099-07-10',
  };
  const result = applySearch([row], new Map([[teetimeCourse.id, teetimeCourse]]), parseSearchQuery(params('market=toronto&live=1')));
  assert.equal(result[0]?.bookingUrl, 'https://tee-time.com/clubs/kirby-links-golf-course?date=2099-07-10');
});

test('TeeTime pages parse into live GTA tee times', async () => {
  const originalFetch = globalThis.fetch;
  const torontoCourse: GolfCourse = {
    id: 'extra-pickering-glen-golf-club',
    market: 'toronto',
    name: 'Pickering Glen Golf Club',
    city: 'Pickering',
    region: 'East GTA',
    holes: [18],
    distanceKm: 36,
    lat: 43.921,
    lng: -79.1859,
    source: 'teetime',
    teeTimeSlug: 'pickering-glen-golf-club',
    online: true,
    access: 'public',
    bookingUrl: 'https://tee-time.com/clubs/pickering-glen-golf-club',
  };
  const payload = {
    props: {
      organization: {
        availabilities: {
          '1304': {
            holes: '18',
            priceFrom: 80,
            group_size: '2',
            teeTimes: [
              { id: 123, course: 'Pickering', date: '2099-07-10 00:00:00', time: 1304, holes: 18, cart_mandatory: false, price: 80, group_size: 2 },
            ],
          },
        },
      },
    },
  };
  globalThis.fetch = (async () => new Response(
    `<div id="app" data-page="${JSON.stringify(payload).replaceAll('"', '&quot;')}"></div>`,
    { status: 200, headers: { 'content-type': 'text/html' } },
  )) as typeof fetch;
  try {
    const rows = await fetchTeeTimeCourseTeeTimes(torontoCourse, '2099-07-10');
    assert.equal(rows?.length, 1);
    assert.equal(rows?.[0].source, 'live');
    assert.equal(rows?.[0].time, '13:04');
    assert.equal(rows?.[0].price, 80);
    assert.equal(rows?.[0].players, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test('past tee times cannot appear as bookable inventory', () => {
  const row: TeeTime = { id:'past',courseId:'test',date:'2020-01-01',time:'13:00',minutes:780,price:50,players:4,holes:18,cart:false,source:'live',bookingUrl:course.bookingUrl };
  assert.deepEqual(applySearch([row],new Map([[course.id,course]]),{...parseSearchQuery(params()),date:'2020-01-01'}),[]);
});
