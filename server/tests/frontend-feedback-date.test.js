import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('feedback dates use Philippine calendar days across midnight and month boundaries',async()=>{
  const source=await readFile(new URL('../../js/feedback/feedback.js',import.meta.url),'utf8');
  const start=source.indexOf('function feedbackRelativeDate(');
  const end=source.indexOf('function refreshFeedbackDates',start);
  const context=vm.createContext({});
  vm.runInContext(source.slice(start,end),context);
  const format=(value,now)=>context.feedbackRelativeDate(value,new Date(now));
  assert.equal(format('2026-11-02 00:01','2026-11-01T16:05:00Z'),'Today');
  assert.equal(format('2026-11-01 23:59','2026-11-01T16:05:00Z'),'Yesterday');
  assert.equal(format('2026-10-30 14:54','2026-11-01T16:05:00Z'),'3 days ago');
  assert.equal(format('2026-11-02 12:00','2026-11-01T15:59:00Z'),'2026-11-02 12:00');
  assert.equal(format('', '2026-11-01T16:05:00Z'),'');
});
