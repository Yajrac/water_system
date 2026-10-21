import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFeedback } from '../src/validators/feedback.validator.js';
test('feedback accepts supported categories and trimmed bounded messages without account overrides',()=>{
  assert.deepEqual(validateFeedback({category:'Meter',message:'  Broken meter  '}),{category:'Meter',message:'Broken meter'});
  for(const body of [null,{category:'Other',message:' '},{category:'Unknown',message:'x'},
    {category:'Billing',message:'x'.repeat(1501)},{category:'Other',message:'x',customerId:'1'},
    {category:'Other',message:'x',reply:'admin response'}])
    assert.throws(()=>validateFeedback(body),error=>error.statusCode===400);
});
