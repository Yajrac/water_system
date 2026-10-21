import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNotice } from '../src/validators/notification.validator.js';

const notice = { type:'Announcement',audience:'all',status:'Published',message:' Maintenance tomorrow. ' };
test('notification validation trims messages and requires supported targeting and delivery', () => {
  assert.equal(validateNotice(notice).message,'Maintenance tomorrow.');
  for (const changed of [ { message:'' },{ message:'a'.repeat(2001) },{ status:'Sent' },
    { audience:'unknown' },{ type:'fake' },{ audience:'customer',target:'0' },
    { audience:'barangay',target:'1 OR 1=1' } ]) {
    assert.throws(()=>validateNotice({...notice,...changed}), error=>error.statusCode===400);
  }
  assert.equal(validateNotice({...notice,audience:'customer',target:'12',status:'Draft'}).target,'12');
});
