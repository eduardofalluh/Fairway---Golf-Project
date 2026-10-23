import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRangeQuery } from '../src/lib/search-query';
import { missingRanges } from '../src/lib/useTeeTimeSearch';
import { searchPart } from '../src/lib/aggregator';
import { fetchChronogolfWindow, parseBatchResponse, parseTeetimesResponse } from '../src/lib/providers/chronogolf';
import { fetchTeeTimeCourseTeeTimes } from '../src/lib/providers/teetime';
import { filterTeeTimes, groupByCourse, mergeProviderStates, timeBuckets } from '../src/lib/results';
import { GET } from '../src/app/api/tee-times/route';
import { addDaysISO, todayISO } from '../src/lib/format';
import type { GolfCourse, SearchFilters, TeeTime } from '../src/lib/types';
import { dorvalClub, fakeChronogolf, row, stRoseClub } from './helpers';

const course: GolfCourse = { id: 'test', market: 'montreal', name: 'Test course', city: 'Laval', region: 'Laval', holes: [18], distanceKm: 10, lat: 45.6, lng: -73.7, source: 'chronogolf', online: true, access: 'public', bookingUrl: 'https://www.chronogolf.com/club/test' };
const today = '2099-07-01';
const date = '2099-07-10';
const params = (extra = '') => new URLSearchParams(`date=${date}&start=12:00&end=14:00&${extra}`);
const range = (startMin = 720, endMin = 840, part = 0, parts = 1) => ({ market: 'montreal' as const, date, startMin, endMin, part, parts });
const filters = (extra: Partial<SearchFilters> = {}): SearchFilters => ({
  players: 2, holes: 'any', regions: [], cartOnly: false, publicOnly: false, sort: 'closest-time', ...extra,
});
const ctx = { date, desiredTime: '13:00', windowMinutes: 60, today, nowMinutes: 0 };
const tee = (extra: Partial<TeeTime> = {}): TeeTime => ({
  id: 'a', courseId: 'test', date, time: '13:00', minutes: 780, price: 60.5, players: 4,
  holes: 18, cart: false, source: 'live', bookingUrl: course.bookingUrl, ...extra,
});

test('range queries default to one part and echo minutes', () => {
  const q = parseRangeQuery(params(), today);
  assert.deepEqual([q.market, q.startMin, q.endMin, q.part, q.parts], ['montreal', 720, 840, 0, 1]);
  assert.equal(parseRangeQuery(params('market=toronto&part=3&parts=4'), today).part, 3);
});

test('range queries reject bad calendars, past or far dates, times, spans and parts', () => {
  for (const suffix of ['date=2099-02-30', 'date=2099-06-30', 'date=2099-12-01', 'start=25:99', 'end=11:00', 'end=19:01', 'market=vancouver', 'part=4&parts=4', 'parts=9', 'part=1.5&parts=4']) {
    const p = params(); for (const [key, value] of new URLSearchParams(suffix)) p.set(key, value);
    assert.throws(() => parseRangeQuery(p, today), suffix);
  }
  const at = (start: string, end: string) => new URLSearchParams({ date, start, end });
  assert.equal(parseRangeQuery(at('13:00', '13:00'), today).endMin, 780);
  assert.equal(parseRangeQuery(at('08:00', '14:00'), today).startMin, 480);
});

test('only minutes not yet loaded are fetched again', () => {
  assert.deepEqual(missingRanges(720, 840, []), [[720, 840]]);
  assert.deepEqual(missingRanges(720, 840, [{ start: 720, end: 840 }]), []);
  assert.deepEqual(missingRanges(780, 900, [{ start: 720, end: 840 }]), [[841, 900]]);
  assert.deepEqual(missingRanges(660, 900, [{ start: 720, end: 840 }]), [[660, 719], [841, 900]]);
  assert.deepEqual(missingRanges(600, 960, [{ start: 600, end: 700 }, { start: 800, end: 960 }]), [[701, 799]]);
});

test('browser filters drop estimates, past, full, off-window and over-budget slots', () => {
  const byId = new Map([[course.id, course]]);
  const rows = [
    tee(), tee({ id: 'b', price: 50.25 }), tee({ id: 'estimate', source: 'estimate' }),
    tee({ id: 'full', players: 1 }), tee({ id: 'late', minutes: 1000, time: '16:40' }),
    tee({ id: 'pricey', price: 141 }), tee({ id: 'wrong-day', date: '2099-07-11' }),
  ];
  const result = filterTeeTimes(rows, byId, filters({ sort: 'price-asc', maxPrice: 140 }), ctx);
  assert.deepEqual(result.map((x) => x.id), ['b', 'a']);
  const past = filterTeeTimes([tee()], byId, filters(), { ...ctx, today: date, nowMinutes: 800 });
  assert.deepEqual(past, []);
});

test('price, cart, holes, region, public and slice bounds are inclusive and exact', () => {
  const privateCourse = { ...course, id: 'private', access: 'private' as const, region: 'North Shore' as const };
  const byId = new Map([[course.id, course], [privateCourse.id, privateCourse]]);
  const rows = [
    tee({ id: 'cart', cart: true, price: 80 }), tee({ id: 'nine', holes: 9, price: 40 }),
    tee({ id: 'private', courseId: 'private' }), tee({ id: 'edge', minutes: 840, time: '14:00' }),
  ];
  const ids = (f: Partial<SearchFilters>) => filterTeeTimes(rows, byId, filters(f), ctx).map((r) => r.id).sort();
  assert.deepEqual(ids({ cartOnly: true }), ['cart']);
  assert.deepEqual(ids({ holes: 9 }), ['nine']);
  assert.deepEqual(ids({ minPrice: 80, maxPrice: 80 }), ['cart']);
  assert.deepEqual(ids({ publicOnly: true }), ['cart', 'edge', 'nine']);
  assert.deepEqual(ids({ regions: ['North Shore'] }), ['private']);
  assert.deepEqual(ids({ slice: [840, 854] }), ['edge']);
});

test('sorts by time, budget fit and distance from the golfer', () => {
  const near = { ...course, id: 'near', distanceKm: 5, lat: 45.5, lng: -73.6 };
  const far = { ...course, id: 'far', distanceKm: 20, lat: 46.2, lng: -74.5 };
  const byId = new Map([[near.id, near], [far.id, far]]);
  const rows = [tee({ id: 'far-early', courseId: 'far', price: 59, minutes: 770 }), tee({ id: 'near-late', courseId: 'near', price: 80, minutes: 800 })];
  const order = (f: Partial<SearchFilters>, extra = {}) => filterTeeTimes(rows, byId, filters(f), { ...ctx, ...extra }).map((r) => r.id);
  assert.deepEqual(order({ sort: 'closest-time' }), ['far-early', 'near-late']);
  assert.deepEqual(order({ sort: 'distance' }), ['near-late', 'far-early']);
  assert.deepEqual(order({ sort: 'distance' }, { userLoc: { lat: 46.2, lng: -74.5 } }), ['far-early', 'near-late']);
  assert.deepEqual(order({ sort: 'closest-price', targetPrice: 78 }), ['near-late', 'far-early']);
  assert.deepEqual(order({ sort: 'price-desc' }), ['near-late', 'far-early']);
});

test('course groups keep ranked order with chronological slots; buckets count the window', () => {
  const other = { ...course, id: 'other' };
  const byId = new Map([[course.id, course], [other.id, other]]);
  const rows = [tee({ id: 'x2', minutes: 790, time: '13:10', price: 30 }), tee({ id: 'o1', courseId: 'other', price: 20 }), tee({ id: 'x1', minutes: 730, time: '12:10', price: 40 })];
  const sorted = filterTeeTimes(rows, byId, filters({ sort: 'price-asc' }), ctx);
  const groups = groupByCourse(sorted);
  assert.deepEqual(groups.map((g) => g.course.id), ['other', 'test']);
  assert.deepEqual(groups[1].slots.map((s) => s.id), ['x1', 'x2']);
  assert.deepEqual([groups[1].minPrice, groups[1].maxPrice], [30, 40]);
  const buckets = timeBuckets(sorted, 720, 840);
  assert.equal(buckets.length, 9);
  assert.equal(buckets.reduce((n, b) => n + b.count, 0), 3);
  assert.equal(buckets[0].count, 1);
});

test('provider states merge to the worst honest summary', () => {
  assert.deepEqual(mergeProviderStates([{ status: 'ok' }, { status: 'ok' }]), { status: 'ok' });
  assert.equal(mergeProviderStates([{ status: 'ok' }, { status: 'throttled', retryAfterSec: 20 }])?.status, 'partial');
  assert.deepEqual(mergeProviderStates([{ status: 'throttled', retryAfterSec: 9 }, { status: 'throttled', retryAfterSec: 20 }]), { status: 'throttled', retryAfterSec: 20 });
  assert.equal(mergeProviderStates([]), null);
});

test('batched pages map each row back to its club by course uuid', () => {
  const dorval = { ...course, id: 'dorval' };
  const byUuid = new Map([['course-dorval-a', dorval], ['course-dorval-b', dorval], ['course-st-rose', course]]);
  const rows = parseBatchResponse(byUuid, date, { status: 'open', teetimes: [
    row('course-dorval-b', date, '12:10'), row('course-st-rose', date, '12:20', 55), row('unknown', date, '12:30'),
  ] });
  assert.deepEqual(rows.map((r) => [r.courseId, r.time, r.price]), [['dorval', '12:10', 72], ['test', '12:20', 55]]);
});

test('a search asks only for the time window and batches clubs into shared requests', async () => {
  const pages: Record<string, unknown[]> = {
    '1': Array.from({ length: 24 }, (_, i) => row(i % 2 ? 'course-dorval-a' : 'course-st-rose', date, `12:${String(i * 2).padStart(2, '0')}`)),
    '2': [row('course-dorval-b', date, '13:50')],
  };
  const fake = fakeChronogolf({
    clubs: [stRoseClub, dorvalClub],
    paginate: true,
    teetimes: (url) => Response.json({ status: 'open', teetimes: pages[url.searchParams.get('page')!] ?? [] }),
  });
  try {
    const result = await searchPart(range());
    const sheets = fake.sheetCalls().map((c) => new URL(c));
    assert.equal(sheets.length, 2, 'one batch, two pages, then stop on the short page');
    assert.equal(sheets[0].searchParams.get('start_time'), '12:00');
    assert.equal(sheets[0].searchParams.get('end_time'), '14:00');
    assert.deepEqual(sheets[0].searchParams.get('course_ids')!.split(',').sort(), ['course-dorval-a', 'course-dorval-b', 'course-st-rose']);
    assert.equal(result.providers.chronogolf?.status, 'ok');
    assert.equal(result.teeTimes.length, 25);
    assert.ok(result.teeTimes.every((t) => t.bookingUrl.includes(`date=${date}`)));
  } finally {
    fake.restore();
  }
});

test('parts split the market so their union covers every live course once', async () => {
  const fake = fakeChronogolf({
    clubs: [stRoseClub, dorvalClub],
    teetimes: (url) => Response.json({ status: 'open', teetimes: url.searchParams.get('course_ids')!.split(',').map((id) => row(id, date, '13:00')) }),
  });
  try {
    const parts = await Promise.all([0, 1].map((part) => searchPart(range(750, 810, part, 2))));
    const clubsPerPart = parts.map((p) => [...new Set(p.teeTimes.map((t) => t.courseId))]);
    assert.deepEqual(clubsPerPart.flat().sort(), ['club-dorval', 'club-st-rose']);
    assert.ok(parts.every((p) => p.checkedCourses === 1));
  } finally {
    fake.restore();
  }
});

test('a 429 marks Chronogolf as throttled and stops further calls until it clears', async () => {
  const fake = fakeChronogolf({
    teetimes: () => new Response('slow down', { status: 429, headers: { 'Retry-After': '30' } }),
  });
  try {
    const first = await searchPart(range());
    assert.deepEqual(first.providers.chronogolf, { status: 'throttled', retryAfterSec: 30 });
    assert.deepEqual(first.teeTimes, []);
    const before = fake.sheetCalls().length;
    const second = await searchPart(range(840, 960));
    assert.equal(second.providers.chronogolf?.status, 'throttled');
    assert.equal(fake.sheetCalls().length, before, 'no upstream call while blocked');
  } finally {
    fake.restore();
  }
});

test('a throttled later page keeps the rows already read and reports partial', async () => {
  const fake = fakeChronogolf({
    paginate: true,
    teetimes: (url) => url.searchParams.get('page') === '1'
      ? Response.json({ status: 'open', teetimes: Array.from({ length: 24 }, () => row('course-st-rose', date, '12:30')) })
      : new Response('slow down', { status: 429, headers: { 'Retry-After': '60' } }),
  });
  try {
    const result = await fetchChronogolfWindow(
      [{ ...course, id: 'club-st-rose', chronogolfSlug: 'golf-sainte-rose' }], date, 720, 840,
    );
    assert.equal(result.state.status, 'partial');
    assert.equal(result.rows.length, 1, 'duplicate slots collapse to one row');
  } finally {
    fake.restore();
  }
});

test('an open but empty sheet or an outage never invents availability', async () => {
  for (const teetimes of [() => Response.json({ status: 'open', teetimes: [] }), () => new Response('down', { status: 503 })]) {
    const fake = fakeChronogolf({ teetimes });
    try {
      const result = await searchPart(range());
      assert.deepEqual(result.teeTimes, []);
    } finally {
      fake.restore();
    }
  }
});

test('complete answers are CDN-cacheable; throttled ones never are', async () => {
  const tomorrow = addDaysISO(todayISO(), 1);
  const url = `http://localhost/api/tee-times?market=montreal&date=${tomorrow}&start=12:00&end=14:00&part=0&parts=1`;
  let fake = fakeChronogolf({ teetimes: () => Response.json({ status: 'open', teetimes: [row('course-st-rose', tomorrow, '13:00')] }) });
  try {
    const ok = await GET(new Request(url, { headers: { 'x-forwarded-for': '10.0.0.1' } }));
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get('Netlify-CDN-Cache-Control') ?? '', /s-maxage=90/);
    // Netlify drops query strings from its cache key unless told, which would
    // serve one day's or one market's tee times for another.
    assert.equal(ok.headers.get('Netlify-Vary'), 'query=market|date|start|end|part|parts');
    assert.equal((await ok.json()).teeTimes.length, 1);
  } finally {
    fake.restore();
  }
  fake = fakeChronogolf({ teetimes: () => new Response('slow down', { status: 429 }) });
  try {
    const throttled = await GET(new Request(url, { headers: { 'x-forwarded-for': '10.0.0.2' } }));
    assert.equal(throttled.headers.get('Cache-Control'), 'no-store');
    assert.equal(throttled.headers.get('Netlify-CDN-Cache-Control'), null);
  } finally {
    fake.restore();
  }
  assert.equal((await GET(new Request('http://localhost/api/tee-times?date=nope&start=13:00&end=14:00'))).status, 400);
});

test('preserves cents and rejects unavailable or mismatched live inventory', () => {
  const good = { start_time: '13:00', date: date, max_player_size: 2, default_price: { green_fee: 55.75, bookable_holes: 18 } };
  const rows = parseTeetimesResponse(course, date, { status: 'open', teetimes: [
    good,
    {...good, max_player_size: 0},
    {...good, max_player_size: undefined},
    {...good, date: '2099-07-11'},
    {...good, date: undefined},
    {...good, start_time: '25:99'},
    {...good, default_price: { green_fee: 0, bookable_holes: 18 }},
    {...good, default_price: { green_fee: Number.POSITIVE_INFINITY, bookable_holes: 18 }},
    {...good, default_price: { green_fee: 40, bookable_holes: 12 }},
  ] });
  assert.equal(rows.length, 1); assert.equal(rows[0].price, 55.75);
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
    const rows = await fetchTeeTimeCourseTeeTimes(torontoCourse, date);
    assert.equal(rows?.length, 1);
    assert.equal(rows?.[0].source, 'live');
    assert.equal(rows?.[0].time, '13:04');
    assert.equal(rows?.[0].price, 80);
    assert.equal(rows?.[0].players, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test('Chronogolf parser rejects blocked, member-only or vague rows before they become tee-time cards', () => {
  const base = { start_time: '06:30', date: date, max_player_size: 4, default_price: { green_fee: 48, bookable_holes: 18 } };
  const rows = parseTeetimesResponse(course, date, { status: 'open', teetimes: [
    { ...base, frozen: true },
    { ...base, disabled: true },
    { ...base, available: false },
    { ...base, bookable: false },
    { ...base, format: 'league' },
    { ...base, default_price: { green_fee: 48, bookable_holes: 18, affiliation_type: 'Membre' } },
    { ...base, default_price: { green_fee: 48, bookable_holes: 18, affiliation_type: 'Member guest' } },
    { ...base, default_price: { green_fee: 48 } },
  ] });
  assert.deepEqual(rows, []);
});

test('Chronogolf parser can require the returned course uuid to match the searched course', () => {
  const base = { start_time: '09:10', date: date, max_player_size: 4, course: { uuid: 'course-a', holes: 18 }, default_price: { green_fee: 88, bookable_holes: 18 } };
  const rows = parseTeetimesResponse(course, date, { status: 'open', teetimes: [
    { ...base, course: { uuid: 'other-course', holes: 18 } },
    { ...base, course: undefined },
    base,
  ] }, new Set(['course-a']));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].time, '09:10');
});

test('TeeTime pages require exact row-level date, price, capacity and holes', async () => {
  const originalFetch = globalThis.fetch;
  const torontoCourse: GolfCourse = {
    id: 'extra-test-teetime-club',
    market: 'toronto',
    name: 'Test TeeTime Club',
    city: 'Toronto',
    region: 'Toronto Core',
    holes: [18],
    distanceKm: 10,
    lat: 43.7,
    lng: -79.4,
    source: 'teetime',
    teeTimeSlug: 'test-teetime-club',
    online: true,
    access: 'public',
    bookingUrl: 'https://tee-time.com/clubs/test-teetime-club',
  };
  const payload = {
    props: {
      organization: {
        availabilities: {
          '0630': {
            holes: '18',
            priceFrom: 48,
            group_size: '4',
            teeTimes: [
              { id: 'no-date', time: 630, holes: 18, price: 48, group_size: 4 },
              { id: 'wrong-date', date: '2099-07-11 00:00:00', time: 630, holes: 18, price: 48, group_size: 4 },
              { id: 'bucket-price-only', date: '2099-07-10 00:00:00', time: 630, holes: 18, group_size: 4 },
              { id: 'bucket-size-only', date: '2099-07-10 00:00:00', time: 630, holes: 18, price: 48 },
              { id: 'bucket-holes-only', date: '2099-07-10 00:00:00', time: 630, price: 48, group_size: 4 },
              { id: 'exact', date: '2099-07-10 00:00:00', time: 650, holes: 18, price: 92, group_size: 3 },
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
    const rows = await fetchTeeTimeCourseTeeTimes(torontoCourse, date);
    assert.equal(rows?.length, 1);
    assert.equal(rows?.[0].id.includes('exact'), true);
    assert.equal(rows?.[0].price, 92);
    assert.equal(rows?.[0].players, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Chronogolf's own demo listings never appear as courses", async () => {
  const fake = fakeChronogolf({
    clubs: [stRoseClub, { ...stRoseClub, uuid: 'club-chronogolf', name: 'Club Chronogolf', slug: 'club-chronogolf', city: 'Rom' }],
  });
  try {
    const { getChronogolfCourses } = await import('../src/lib/providers/chronogolf');
    const names = (await getChronogolfCourses('montreal')).map((c) => c.name);
    assert.deepEqual(names, ['Golf Sainte-Rose']);
  } finally {
    fake.restore();
  }
});

test('fallback links keep the date and round; the widget only exists for Chronogolf clubs', async () => {
  const { chronogolfWidgetUrl, deepBookingUrl } = await import('../src/lib/booking-links');
  const club = { ...course, chronogolfSlug: 'golf-l-emeraude' };
  assert.equal(deepBookingUrl(club, '2099-07-10', 9), 'https://www.chronogolf.com/club/golf-l-emeraude?date=2099-07-10&nb_holes=9');
  assert.equal(chronogolfWidgetUrl(club), 'https://www.chronogolf.com/club/golf-l-emeraude/widget?medium=widget&source=club');
  assert.equal(chronogolfWidgetUrl({ ...club, source: 'extra' }), null);
  assert.equal(chronogolfWidgetUrl({ ...club, chronogolfSlug: '../x?y' }), 'https://www.chronogolf.com/club/..%2Fx%3Fy/widget?medium=widget&source=club');
});

test('the results heading never claims zero tee times when providers did not answer', async () => {
  const { resultsHeadline } = await import('../src/lib/results');
  const base = { status: 'done' as const, error: null, visible: 0, providers: {} };
  assert.equal(resultsHeadline({ ...base, providers: { chronogolf: { status: 'ok' } } }), 'count');
  assert.equal(resultsHeadline({ ...base, providers: { chronogolf: { status: 'unavailable', detail: 'http 403' } } }), 'blocked');
  assert.equal(resultsHeadline({ ...base, providers: { chronogolf: { status: 'partial' } } }), 'blocked');
  assert.equal(resultsHeadline({ ...base, providers: { chronogolf: { status: 'throttled', retryAfterSec: 30 } } }), 'paused');
  assert.equal(resultsHeadline({ ...base, error: 'busy' }), 'paused');
  assert.equal(resultsHeadline({ ...base, status: 'error', error: 'service' }), 'error');
  assert.equal(resultsHeadline({ ...base, status: 'loading', providers: { chronogolf: { status: 'unavailable' } } }), 'count');
  assert.equal(resultsHeadline({ ...base, visible: 4, providers: { chronogolf: { status: 'unavailable' }, teetime: { status: 'ok' } } }), 'count');
  // Rows that exist but can't be shown (stale or filtered) never turn a blocked search into "0 tee times".
  assert.equal(resultsHeadline({ ...base, visible: 0, providers: { chronogolf: { status: 'unavailable' }, teetime: { status: 'ok' } } }), 'blocked');
});


test('two courses at one club listing the same minute are both kept', async () => {
  const fake = fakeChronogolf({
    clubs: [dorvalClub],
    teetimes: () => Response.json({ status: 'open', teetimes: [row('course-dorval-a', date, '08:00', 60), row('course-dorval-b', date, '08:00', 75)] }),
  });
  try {
    const result = await searchPart(range(450, 510));
    assert.deepEqual(result.teeTimes.map((t) => t.price).sort(), [60, 75]);
    assert.equal(new Set(result.teeTimes.map((t) => t.id)).size, 2);
  } finally {
    fake.restore();
  }
});

test('a sheet with more pages than the cap is reported partial, never complete', async () => {
  const fake = fakeChronogolf({
    paginate: true,
    teetimes: (url) => Response.json({ status: 'open', teetimes: Array.from({ length: 24 }, (_, i) => row('course-st-rose', date, `0${6 + (Number(url.searchParams.get('page')) % 3)}:${String(i).padStart(2, '0')}`)) }),
  });
  try {
    const result = await searchPart(range(360, 600));
    assert.equal(result.providers.chronogolf?.status, 'partial');
    assert.match(result.providers.chronogolf?.detail ?? '', /more than \d+ pages/);
  } finally {
    fake.restore();
  }
});

test('a failed later page is never counted as a complete answer', async () => {
  const fake = fakeChronogolf({
    paginate: true,
    teetimes: (url) => url.searchParams.get('page') === '1'
      ? Response.json({ status: 'open', teetimes: Array.from({ length: 24 }, (_, i) => row('course-st-rose', date, `12:${String(i).padStart(2, '0')}`)) })
      : new Response('blocked', { status: 403 }),
  });
  try {
    const result = await searchPart(range(720, 840));
    assert.equal(result.providers.chronogolf?.status, 'partial');
    assert.equal(result.teeTimes.length, 24);
  } finally {
    fake.restore();
  }
});

test('a failed or truncated course directory is reported, never treated as complete', async () => {
  // Directory blocked outright: no Chronogolf courses, but the part must still say so.
  let fake = fakeChronogolf({ teetimes: () => Response.json({ status: 'open', teetimes: [] }) });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
    String(input).includes('/marketplace/v2/search') ? new Response('blocked', { status: 403 }) : realFetch(input, init)) as typeof fetch;
  try {
    const blocked = await searchPart(range());
    assert.equal(blocked.providers.chronogolf?.status, 'unavailable');
    assert.deepEqual(blocked.teeTimes, []);
  } finally {
    globalThis.fetch = realFetch;
    fake.restore();
  }
  // Directory cut short: page 1 full, page 2 fails. Not cached, reported partial.
  const fullPage = Array.from({ length: 25 }, (_, i) => ({ ...stRoseClub, uuid: `club-${i}`, name: `Club Number ${i}`, slug: `club-${i}` }));
  fake = fakeChronogolf({ clubs: fullPage });
  const fakeFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/marketplace/v2/search') && url.includes('page=2')) return new Response('down', { status: 503 });
    return fakeFetch(input, init);
  }) as typeof fetch;
  try {
    const { getChronogolfDirectory } = await import('../src/lib/providers/chronogolf');
    const first = await getChronogolfDirectory('montreal');
    assert.equal(first.state.status, 'partial');
    assert.equal(first.courses.length, 25);
    // Page 2 now answers (empty, i.e. the end): the partial list must not have been cached.
    globalThis.fetch = fakeFetch;
    const again = await getChronogolfDirectory('montreal');
    assert.equal(again.state.status, 'ok', 'the partial list was not cached as complete');
  } finally {
    fake.restore();
  }
});

test('/api/courses caches each market under its own CDN key', async () => {
  const { GET: courses } = await import('../src/app/api/courses/route');
  const fake = fakeChronogolf({});
  try {
    const res = await courses(new Request('http://localhost/api/courses?market=toronto'));
    assert.equal((await res.json()).market, 'toronto');
    assert.match(res.headers.get('Netlify-CDN-Cache-Control') ?? '', /durable/);
    assert.equal(res.headers.get('Netlify-Vary'), 'query=market');
  } finally {
    fake.restore();
  }
});

test('/api/courses only lets the CDN keep a fully read directory', async () => {
  const { GET: courses } = await import('../src/app/api/courses/route');
  const fake = fakeChronogolf({});
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
    String(input).includes('/marketplace/v2/search') ? new Response('blocked', { status: 403 }) : realFetch(input, init)) as typeof fetch;
  try {
    const res = await courses(new Request('http://localhost/api/courses?market=montreal'));
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
  } finally {
    globalThis.fetch = realFetch;
    fake.restore();
  }
});
