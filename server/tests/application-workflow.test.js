import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('installation step accepts Pending without approval and requires approval for Approved',async()=>{
  const source=await readFile(new URL('../../js/customers/customer-steps.js',import.meta.url),'utf8');
  const begin=source.indexOf('function customerStepError(');
  const end=source.indexOf('\ncustomerForm.addEventListener',begin);
  const fields={serviceStatus:{value:'Pending'},dateApplied:{value:'2026-01-01'}};
  const context=vm.createContext({customerForm:{elements:fields},
    CustomerValidation:{dates:[],amounts:[],quantities:[]}});
  vm.runInContext(source.slice(begin,end),context);
  assert.equal(context.customerStepError({name:'dateApproved',value:''}),'');
  fields.serviceStatus.value='Approved';
  assert.match(context.customerStepError({name:'dateApproved',value:''}),/approval date/);
});
