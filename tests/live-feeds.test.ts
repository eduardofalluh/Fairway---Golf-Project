import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDirectory, searchPart } from '../src/lib/aggregator';
import { deepBookingUrl } from '../src/lib/booking-links';
import { addDaysISO, todayISO } from '../src/lib/format';
import { hasLiveFeed } from '../src/lib/live-feed';
import { fetchJonasWindow, parseJonasSheet } from '../src/lib/providers/jonas';
import { fetchTeeItUpWindow, parseTeeItUpSheets } from '../src/lib/providers/teeitup';
import { coursesToCheck } from '../src/lib/results';
import { POST as verify } from '../src/app/api/verify/route';
import type { GolfCourse } from '../src/lib/types';
import { fakeChronogolf, stRoseClub } from './helpers';

const date = '2099-07-10';
const SLOT_DATE = addDaysISO(todayISO(), 1);

const base: GolfCourse = {
  id: 'test', market: 'toronto', name: 'Test', city: 'Uxbridge', region: 'East GTA', holes: [18], distanceKm: 40,
  lat: 44, lng: -79, source: 'extra', online: false, access: 'public', bookingUrl: 'https://example.com/book',
};
const jonasCourse: GolfCourse = {
  ...base, id: 'extra-test-glen', name: 'Test Glen', source: 'jonas', online: true,
  jonas: { host: 'testglen.clubhouseonline-e3.net', courseId: 1245 },
  bookingUrl: 'https://testglen.clubhouseonline-e3.net/PublicTeeTimes/TeeSheet.aspx',
};
const teeItUpCourse: GolfCourse = {
  ...base, id: 'extra-test-sticks', name: 'Test Sticks', source: 'teeitup', online: true,
  teeItUpAlias: 'test-sticks', bookingUrl: 'https://test-sticks.book.teeitup.golf/',
};

/** A Jonas ClubHouse Online slot shaped like the live API's. */
const jonasSlot = (teeTime: string, extra: Record<string, unknown> = {}) => ({
  teeSheetTimeId: 100 + Number(teeTime.slice(0, 2)), teeTime, availPlayers: 2, isBookable: true, availableToPublic: true,
  bookingTimeTypeTxt: 'Available', playerCost: 85, cartCost: 0,
  // `dateOfAvailability` is when booking opened, not the play date.
  teeSheetBank: { numberOfHoles: 18, teeSheetKey: { courseId: 1245, dateOfAvailability: '2099-06-10T07:00:00' } },
  ...extra,
});
const jonasSheet = (slots: Array<ReturnType<typeof jonasSlot>>) => ({ retCode: 0, data: { availability: [], teeSheet: slots } });
// Jonas serves its JSON as text/html.
const jonasResponse = (slots: Array<ReturnType<typeof jonasSlot>>) =>
  new Response(JSON.stringify(jonasSheet(slots)), { status: 200, headers: { 'content-type': 'text/html' } });

const rate = (holes: number, walking: number | null, cart: number | null, allowedPlayers = [1, 2, 3, 4]) =>
  ({ name: `${holes} Holes`, holes, allowedPlayers, greenFeeWalking: walking, greenFeeCart: cart });
const kennaSlot = (teetime: string, rates: Array<ReturnType<typeof rate>>, extra: { bookedPlayers?: number } = {}) =>
  ({ teetime, maxPlayers: 4, bookedPlayers: 0, rates, ...extra });

function withFetch(handler: (url: URL, init?: RequestInit) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test('every live source is recognised only when it can actually be read', () => {
  assert.equal(hasLiveFeed(jonasCourse), true);
  assert.equal(hasLiveFeed(teeItUpCourse), true);
  assert.equal(hasLiveFeed({ ...jonasCourse, online: false }), false);
  assert.equal(hasLiveFeed({ ...jonasCourse, jonas: undefined }), false);
  assert.equal(hasLiveFeed({ ...base, source: 'chronogolf', online: true }), false);
  assert.equal(hasLiveFeed({ ...base, online: true }), false);
});

test('Jonas sheets keep only bookable public slots with a price, room and a round length', () => {
  const rows = parseJonasSheet(jonasSheet([
    jonasSlot('07:00:00', { isBookable: false, availPlayers: 0, bookingTimeTypeTxt: 'Blocked' }),
    jonasSlot('13:30:00', { availableToPublic: false }),
    jonasSlot('14:20:00', { availPlayers: 1 }),
    jonasSlot('15:00:00', { availPlayers: 0 }),
    jonasSlot('15:10:00', { playerCost: 0 }),
    jonasSlot('15:20:00', { teeSheetBank: { numberOfHoles: 12 } }),
    jonasSlot('25:00:00'),
    jonasSlot('16:40:00', { availPlayers: 6, playerCost: 72.5 }),
  ]), jonasCourse, date);
  assert.deepEqual(rows?.map((r) => [r.time, r.minutes, r.players, r.price, r.holes, r.date]), [
    ['14:20', 860, 1, 85, 18, date],
    ['16:40', 1000, 4, 72.5, 18, date],
  ]);
  assert.equal(rows?.every((r) => r.source === 'live' && r.bookingUrl === jonasCourse.bookingUrl), true);
  assert.equal(parseJonasSheet({ retCode: 1, data: { teeSheet: [] } }, jonasCourse, date), null);
  assert.equal(parseJonasSheet({}, jonasCourse, date), null);
});

test('a Jonas window asks each club once for the day and reports failures honestly', async () => {
  const fake = withFetch((url) => (url.hostname === 'testglen.clubhouseonline-e3.net'
    ? jonasResponse([jonasSlot('09:00:00'), jonasSlot('14:20:00')])
    : new Response('', { status: 403 })));
  try {
    const ok = await fetchJonasWindow([jonasCourse], date, 840, 900);
    assert.deepEqual(ok.rows.map((r) => r.time), ['14:20']);
    assert.deepEqual(ok.state, { status: 'ok' });
    assert.equal(fake.calls[0].url.pathname, '/api/v1/teetimes/GetAvailableTeeTimes/20990710/1245/0/null/0');

    const blocked = { ...jonasCourse, id: 'other', jonas: { host: 'blocked.clubhouseonline-e3.net', courseId: 9 } };
    const partial = await fetchJonasWindow([jonasCourse, blocked], date, 0, 1439);
    assert.equal(partial.state.status, 'partial');
    assert.equal(partial.state.detail, 'http 403');
    assert.deepEqual((await fetchJonasWindow([blocked], date, 0, 1439)).state, { status: 'unavailable', detail: 'http 403' });
  } finally {
    fake.restore();
  }
});

test('TeeItUp UTC tee times become local times on the searched day only', () => {
  const rows = parseTeeItUpSheets([{
    courseId: 'north',
    teetimes: [
      // 13:00 in Toronto during daylight time (UTC-4).
      kennaSlot('2099-07-10T17:00:00.000Z', [rate(18, 6500, 8500), rate(9, null, 4250)]),
      // 22:00 local is still the 10th even though it's the 11th in UTC.
      kennaSlot('2099-07-11T02:00:00.000Z', [rate(18, 5000, null, [2, 4])], { bookedPlayers: 1 }),
      // 23:00 on the 9th locally: another day.
      kennaSlot('2099-07-10T03:00:00.000Z', [rate(18, 5000, null)]),
      kennaSlot('2099-07-10T18:00:00.000Z', [rate(18, 5000, null)], { bookedPlayers: 4 }),
      kennaSlot('2099-07-10T19:00:00.000Z', [rate(18, null, null)]),
      kennaSlot('not a date', [rate(18, 5000, null)]),
    ],
  }], teeItUpCourse, date);
  assert.deepEqual(rows.map((r) => [r.time, r.holes, r.price, r.cart, r.players]), [
    ['13:00', 18, 65, false, 4],
    ['13:00', 9, 42.5, true, 4],
    ['22:00', 18, 50, false, 3],
  ]);
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length);
  // Winter is UTC-5.
  assert.equal(parseTeeItUpSheets([{ teetimes: [kennaSlot('2099-01-15T17:00:00.000Z', [rate(18, 5000, null)])] }], teeItUpCourse, '2099-01-15')[0].time, '12:00');
});

test('a TeeItUp window names the course alias and asks for all its facilities at once', async () => {
  const fake = withFetch((url) => {
    if (url.pathname === '/facilities') return Response.json([{ id: 11, name: 'North' }, { id: 12, name: 'South' }]);
    if (url.pathname === '/v2/tee-times') return Response.json([{ courseId: 'south', teetimes: [kennaSlot('2099-07-10T17:00:00.000Z', [rate(18, 6500, null)])] }]);
    return new Response('', { status: 404 });
  });
  try {
    const { rows, state } = await fetchTeeItUpWindow([teeItUpCourse], date, 720, 840);
    assert.deepEqual(state, { status: 'ok' });
    assert.deepEqual(rows.map((r) => [r.time, r.price]), [['13:00', 65]]);
    assert.equal(fake.calls.length, 2);
    for (const call of fake.calls) assert.equal((call.init?.headers as Record<string, string>)['x-be-alias'], 'test-sticks');
    assert.equal(fake.calls[1].url.searchParams.get('facilityIds'), '11,12');
    assert.equal(fake.calls[1].url.searchParams.get('date'), date);
  } finally {
    fake.restore();
  }
  const down = withFetch(() => new Response('', { status: 429 }));
  try {
    assert.equal((await fetchTeeItUpWindow([teeItUpCourse], date, 0, 1439)).state.status, 'unavailable');
  } finally {
    down.restore();
  }
  assert.equal(deepBookingUrl(teeItUpCourse, date, 18), `https://test-sticks.book.teeitup.golf/?date=${date}`);
});

test('a Toronto search part merges Jonas and TeeItUp rows with their own provider states', async () => {
  const fake = fakeChronogolf({
    clubs: [],
    other: (url) => {
      if (url.hostname.endsWith('.clubhouseonline-e3.net')) return jonasResponse([jonasSlot('14:20:00')]);
      if (url.pathname === '/facilities') return Response.json([{ id: 11 }]);
      if (url.pathname === '/v2/tee-times') return Response.json([{ courseId: 'c', teetimes: [kennaSlot(`${date}T18:10:00.000Z`, [rate(18, 7000, null)])] }]);
      return new Response('', { status: 404 });
    },
  });
  try {
    const part = await searchPart({ market: 'toronto', date, startMin: 780, endMin: 900, part: 0, parts: 1 });
    assert.equal(part.providers.jonas?.status, 'ok');
    assert.equal(part.providers.teeitup?.status, 'ok');
    const jonasRows = part.teeTimes.filter((r) => r.id.includes('-jonas-'));
    const teeItUpRows = part.teeTimes.filter((r) => r.id.includes('-teeitup-'));
    assert.deepEqual(new Set(jonasRows.map((r) => r.courseId)), new Set(['extra-watsons-glen', 'extra-copper-creek']));
    assert.equal(teeItUpRows.length, 2);
    assert.equal(teeItUpRows[0].time, '14:10');
    assert.match(teeItUpRows[0].bookingUrl, new RegExp(`\\.book\\.teeitup\\.golf/\\?date=${date}$`));
    // One sheet call per Jonas club, and a facility list plus one sheet call per TeeItUp course.
    assert.equal(fake.calls.filter((c) => c.includes('clubhouseonline-e3.net')).length, 2);
    assert.equal(fake.calls.filter((c) => c.includes('kenna.io')).length, 4);
  } finally {
    fake.restore();
  }
});

test('verify re-checks a Jonas slot fresh against the club tee sheet', async () => {
  const fake = fakeChronogolf({
    clubs: [],
    other: (url) => (url.hostname === 'watsonsglengc.clubhouseonline-e3.net' ? jonasResponse([jonasSlot('14:20:00')]) : undefined),
  });
  try {
    const request = (body: unknown, ip: string) => new Request('http://localhost/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    });
    const slot = { market: 'toronto', courseId: 'extra-watsons-glen', date: SLOT_DATE, time: '14:20', holes: 18, players: 2, price: 85 };
    const ok = await verify(request(slot, '10.4.0.1'));
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).bookingUrl, 'https://watsonsglengc.clubhouseonline-e3.net/PublicTeeTimes/TeeSheet.aspx');
    assert.ok(fake.calls.some((c) => c.includes(`/GetAvailableTeeTimes/${SLOT_DATE.replaceAll('-', '')}/1245/`)));
    const changed = await verify(request({ ...slot, price: 90 }, '10.4.0.2'));
    assert.equal((await changed.json()).reason, 'changed');
  } finally {
    fake.restore();
  }
});

test('the directory lists bookable courses only: no private clubs, simulators, closed or retired listings', async () => {
  const listing = (uuid: string, name: string, slug: string, online = false) =>
    ({ ...stRoseClub, uuid, name, slug, online_booking_enabled: online });
  const fake = fakeChronogolf({
    clubs: [
      stRoseClub,
      listing('cg-triangle-1', "Golf Triangle d'Or", 'golf-triangle-d-or'),
      listing('cg-triangle-2', "Club de Golf Triangle d'Or", 'club-de-golf-triangle-d-or'),
      listing('cg-meadowbrook', 'Golf Meadowbrook', 'golf-meadowbrook'),
      listing('cg-kanawaki', 'Kanawaki Golf Club', 'kanawaki-golf-club'),
      listing('cg-candiac', 'Golf Candiac', 'golf-candiac', true),
      listing('cg-birdie', 'Golf intérieur Le Birdie', 'golf-interieur-le-birdie', true),
      listing('cg-westview', 'Westview Golf Club DO NOT USE', 'westview-golf-club', true),
    ],
  });
  try {
    const directory = await getDirectory('montreal');
    const names = directory.map((c) => c.name);
    assert.ok(names.includes('Golf Sainte-Rose'));
    for (const gone of ['Kanawaki Golf Club', 'Golf Candiac', 'Golf intérieur Le Birdie', 'Westview Golf Club DO NOT USE']) {
      assert.ok(!names.includes(gone), gone);
    }
    // Chronogolf's two listings of one GGGolf club become one course with its GGGolf tee sheet.
    const triangle = directory.filter((c) => /triangle/i.test(c.name));
    assert.equal(triangle.length, 1);
    assert.equal(triangle[0].id, 'cg-triangle-1');
    assert.match(triangle[0].bookingUrl, /^https:\/\/secure\.gggolf\.ca\/triangledor\/.*req=teetimes/);
    assert.equal(directory.find((c) => c.name === 'Golf Meadowbrook')?.phone, '514 488-6612');
    assert.ok(names.includes('Club de Golf Le Versant'));
    assert.equal(directory.some((c) => c.access === 'private'), false);
  } finally {
    fake.restore();
  }
});

test('courses to check: link-only ones always, live ones only when their provider failed and showed nothing', () => {
  const live = { ...base, id: 'live', source: 'chronogolf' as const, chronogolfSlug: 'live', online: true };
  const shown = { ...live, id: 'shown', chronogolfSlug: 'shown' };
  const phone = { ...base, id: 'phone', bookingUrl: '', phone: '450 555-0100' };
  const far = { ...base, id: 'far', distanceKm: 90 };
  const otherRegion = { ...base, id: 'west', region: 'West GTA' as const };
  const semi = { ...base, id: 'semi', access: 'semi-private' as const };
  const nowhere = { ...base, id: 'nowhere', bookingUrl: 'http://insecure.example.com' };
  const directory = [live, shown, phone, far, otherRegion, semi, nowhere, { ...base, id: 'link' }];
  const filters = { regions: [], publicOnly: false };
  const ids = (providers: Parameters<typeof coursesToCheck>[1], extra = {}) =>
    coursesToCheck(directory, providers, new Set(['shown']), { ...filters, ...extra }).map((c) => c.id);

  assert.deepEqual(ids({ chronogolf: { status: 'ok' } }), ['phone', 'west', 'semi', 'link', 'far']);
  assert.deepEqual(ids({ chronogolf: { status: 'unavailable' } }), ['live', 'phone', 'west', 'semi', 'link', 'far']);
  assert.deepEqual(ids({}, { regions: ['East GTA'], maxDistanceKm: 50, publicOnly: true }), ['phone', 'link']);
});
