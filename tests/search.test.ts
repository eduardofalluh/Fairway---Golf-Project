import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSearchQuery } from '../src/lib/search-query';
import { applySearch } from '../src/lib/aggregator';
import { parseTeetimesResponse } from '../src/lib/providers/chronogolf';
import type { GolfCourse, TeeTime } from '../src/lib/types';

const params = (extra = '') => new URLSearchParams(`date=2099-07-10&time=13:00&${extra}`);
const course: GolfCourse = { id: 'test', name: 'Test course', city: 'Laval', region: 'Laval', holes: [18], distanceKm: 10, lat: 45.6, lng: -73.7, source: 'chronogolf', online: true, access: 'public', bookingUrl: 'https://www.chronogolf.com/club/test' };

test('search defaults to real availability and lowest price', () => {
  const q = parseSearchQuery(params());
  assert.equal(q.liveOnly, true); assert.equal(q.sort, 'price-asc');
  assert.equal(parseSearchQuery(params('live=0')).liveOnly, false);
});
test('rejects invalid calendars, times, budgets and player counts', () => {
  for (const suffix of ['date=2026-02-30', 'time=25:99', 'players=NaN', 'players=5', 'players=1.5', 'window=-1', 'max=Infinity', 'min=100&max=50', 'regions=Unknown', 'holes=27', 'sort=anything']) {
    const p = params(); for (const [key,value] of new URLSearchParams(suffix)) p.set(key,value);
    assert.throws(() => parseSearchQuery(p), suffix);
  }
});
test('preserves cents and rejects unavailable or mismatched live inventory', () => {
  const good = { start_time: '13:00', date: '2099-07-10', max_player_size: 2, default_price: { green_fee: 55.75, bookable_holes: 18 } };
  const rows = parseTeetimesResponse(course, '2099-07-10', { status: 'open', teetimes: [good, {...good, max_player_size: 0}, {...good, max_player_size: undefined}, {...good, date: '2099-07-11'}] });
  assert.equal(rows.length, 1); assert.equal(rows[0].price, 55.75);
});
test('filters estimates, capacity, time and sorts comparable prices', () => {
  const base: TeeTime = { id:'a',courseId:'test',date:'2099-07-10',time:'13:00',minutes:780,price:60.5,players:4,holes:18,cart:false,source:'live',bookingUrl:course.bookingUrl };
  const rows = [base,{...base,id:'b',price:50.25},{...base,id:'estimate',source:'estimate' as const},{...base,id:'full',players:1},{...base,id:'late',minutes:1000}];
  const result=applySearch(rows,new Map([[course.id,course]]),parseSearchQuery(params()));
  assert.deepEqual(result.map(x=>x.id),['b','a']);
});
test('past tee times cannot appear as bookable inventory', () => {
  const row: TeeTime = { id:'past',courseId:'test',date:'2020-01-01',time:'13:00',minutes:780,price:50,players:4,holes:18,cart:false,source:'live',bookingUrl:course.bookingUrl };
  assert.deepEqual(applySearch([row],new Map([[course.id,course]]),{...parseSearchQuery(params()),date:'2020-01-01'}),[]);
});
