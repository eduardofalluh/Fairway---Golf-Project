import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectMapTeeTimes } from '../src/lib/map-results';
import { classifyRegion } from '../src/lib/geo';
import { formatPrice } from '../src/lib/format';
import type { TeeTimeResult } from '../src/lib/types';

test('map time, round and price come from the same selected slot', () => {
  const early = { id:'early',courseId:'one',deltaMinutes:60,time:'12:00',price:30,holes:9,bookingUrl:'https://example.com/9',source:'live' } as TeeTimeResult;
  const nearest = { ...early,id:'nearest',deltaMinutes:0,time:'13:00',price:70,holes:18,bookingUrl:'https://example.com/18' };
  assert.deepEqual(selectMapTeeTimes([early,nearest]),[nearest]);
  assert.deepEqual(selectMapTeeTimes([nearest,early]),[nearest]);
});
test('region filters recognize river geography and local city spellings', () => {
  assert.equal(classifyRegion('montreal','Boucherville',45.62,-73.48),'South Shore');
  assert.equal(classifyRegion('montreal','St-Basile-le-Grand',45.53,-73.28),'South Shore');
  assert.equal(classifyRegion('montreal','Mirabel',45.65,-74.1),'North Shore');
  assert.equal(classifyRegion('montreal','Lavaltrie',45.88,-73.28),'North Shore');
  assert.equal(classifyRegion('montreal','Laval',45.6,-73.72),'Laval');
  assert.equal(classifyRegion('montreal','Île-Bizard',45.5,-73.9),'Montreal Island');
  assert.equal(classifyRegion('toronto','Scarborough',43.77,-79.3),'Toronto Core');
  assert.equal(classifyRegion('toronto','Pickering',43.88,-79.08),'East GTA');
  assert.equal(classifyRegion('toronto','Brampton',43.73,-79.65),'Peel/Halton');
  assert.equal(classifyRegion('toronto','Maple',43.89,-79.52),'North GTA');
});
test('prices display cents consistently',()=>{
  assert.equal(formatPrice(28.7),'$28.70');
  assert.equal(formatPrice(28),'$28');
});
