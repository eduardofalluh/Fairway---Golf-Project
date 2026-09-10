import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST } from '../src/app/api/book/route';
import type { GolfCourse } from '../src/lib/types';

const request=(body:unknown)=>new Request('http://localhost/api/book',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

const course: GolfCourse = {
  id: 'club-st-rose',
  market: 'montreal',
  name: 'Golf Sainte-Rose',
  city: 'Laval',
  region: 'Laval',
  holes: [18],
  distanceKm: 16,
  lat: 45.61,
  lng: -73.78,
  source: 'chronogolf',
  chronogolfUuid: 'club-st-rose',
  chronogolfSlug: 'golf-sainte-rose',
  online: true,
  access: 'public',
  bookingUrl: 'https://www.chronogolf.com/club/golf-sainte-rose',
};

const livePayload = {
  email: 'test@example.com',
  course: 'Golf Sainte-Rose',
  city: 'Laval',
  date: '2099-07-10',
  time: '06:30',
  holes: 18,
  players: 2,
  price: 72,
  source: 'live',
  bookingUrl: 'https://www.chronogolf.com/club/golf-sainte-rose?date=2099-07-10&nb_holes=18',
  courseData: course,
};

test('email endpoint rejects malformed or non-live data without sending',async()=>{
  for(const body of [null,[],{email:123},{email:'test@example.com',course:123},{email:'test@example.com',bookingUrl:'javascript:alert(1)'},{email:'test@example.com',source:'estimate'}]) {
    assert.equal((await POST(request(body))).status,400);
  }
});

test('email delivery failure returns honest failure and never claims reservation',async()=>{
  const originalFetch=globalThis.fetch; const originalKey=process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY='test-only-not-a-real-key';
  globalThis.fetch=(async(input)=>{
    const url=String(input);
    if(url.includes('/marketplace/v2/clubs/golf-sainte-rose')) return Response.json({courses:[{uuid:'course-st-rose',holes:18}]});
    if(url.includes('/marketplace/v2/teetimes?')) return Response.json({status:'open',teetimes:[{start_time:'06:30',date:'2099-07-10',max_player_size:4,default_price:{green_fee:72,bookable_holes:18}}]});
    if(url.includes('api.resend.com')) throw new Error('simulated email outage');
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
  try {
    const response=await POST(request(livePayload));
    assert.equal(response.status,503); assert.equal((await response.json()).delivered,false);
  } finally {globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=originalKey;}
});

test('email endpoint stops when provider no longer has the selected slot',async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=(async(input)=>{
    const url=String(input);
    if(url.includes('/marketplace/v2/clubs/golf-sainte-rose')) return Response.json({courses:[{uuid:'course-st-rose',holes:18}]});
    if(url.includes('/marketplace/v2/teetimes?')) return Response.json({status:'open',teetimes:[]});
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
  try {
    const response=await POST(request(livePayload));
    assert.equal(response.status,409);
    const json=await response.json();
    assert.equal(json.delivered,false);
  } finally {globalThis.fetch=originalFetch;}
});
