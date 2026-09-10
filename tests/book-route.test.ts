import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST } from '../src/app/api/book/route';
const request=(body:unknown)=>new Request('http://localhost/api/book',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('email endpoint rejects malformed data without sending',async()=>{
  for(const body of [null,[],{email:123},{email:'test@example.com',course:123},{email:'test@example.com',bookingUrl:'javascript:alert(1)'}]) {
    assert.equal((await POST(request(body))).status,400);
  }
});
test('email delivery failure returns honest failure and never claims reservation',async()=>{
  const originalFetch=globalThis.fetch; const originalKey=process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY='test-only-not-a-real-key';
  globalThis.fetch=async()=>{throw new Error('simulated provider outage');};
  try {
    const response=await POST(request({email:'test@example.com',course:'Test course'}));
    assert.equal(response.status,503); assert.equal((await response.json()).delivered,false);
  } finally {globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=originalKey;}
});
