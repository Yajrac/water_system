import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('recipient checklist preserves selections through search and filters paid customers',async()=>{
 const nodes=new Map();
 const node=()=>({value:'',elements:{type:{value:'Announcement',addEventListener(){}}},addEventListener(){},replaceChildren(){},append(){}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
 const context=vm.createContext({document:{getElementById:get,createElement:node},AdminAuth:{ready:{then(){}}}});
 vm.runInContext(await readFile(new URL('../../js/broadcast/broadcast.js',import.meta.url),'utf8'),context);
 vm.runInContext(`noticeCustomers=[{id:1,name:'Juan Cruz',account:'A1',balance:'20',due:'2026-11-01'},
 {id:2,name:'Ana Reyes',account:'A2',balance:'0'},{id:3,name:'Pedro Cruz',account:'A3',balance:'5'}];
 audienceSelect.value='customer';selectedCustomerIds.add('1');selectedCustomerIds.add('2');`,context);
 assert.equal(vm.runInContext('selectedRecipients().length',context),2);
 assert.equal(vm.runInContext("matchingCustomers(noticeCustomers,'CRUZ JUAN').length",context),1);
 vm.runInContext("customerSearch.value='Pedro'",context);
 assert.equal(vm.runInContext('selectedRecipients().length',context),2);
 vm.runInContext("noticeForm.elements.type.value='Due date'",context);
 assert.equal(vm.runInContext('selectedRecipients().length',context),1);
 vm.runInContext("audienceSelect.value='all'",context);
 assert.equal(vm.runInContext('selectedRecipients().length',context),2);
});
