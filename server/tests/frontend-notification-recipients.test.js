import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('recipient suggestions identify customers and reject edited or arbitrary targets', async () => {
  const source = await readFile(new URL('../../js/broadcast/broadcast.js', import.meta.url), 'utf8');
  const nodes = new Map();
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', addEventListener() {},
      setCustomValidity(message) { this.validity = message; },
    });
    return nodes.get(id);
  };
  const context = vm.createContext({
    document: { getElementById: get },
    AdminAuth: { ready: { then() {} } },
  });
  vm.runInContext(source, context);
  const label = vm.runInContext(`customerChoiceLabel({id:12,name:'Juan Cruz',
    account:'ACC-12',submitterNumber:'SUB-44',username:'juan44'})`, context);
  for (const field of ['Juan Cruz', 'ACC-12', 'SUB-44', 'juan44']) assert.ok(label.includes(field));
  context.label = label;
  vm.runInContext(`noticeCustomers=[{id:12}]; audienceSelect.value='customer';
    customerChoices.set(label,'12'); customerSearch.value=label; selectCustomerChoice()`, context);
  assert.equal(get('noticeTarget').value, '12');
  assert.equal(get('recipientCount').textContent, '1 customers selected');
  vm.runInContext(`customerSearch.value='Juan'; selectCustomerChoice()`, context);
  assert.equal(get('noticeTarget').value, '');
  assert.ok(get('noticeCustomerSearch').validity);
  assert.equal(get('recipientCount').textContent, '0 customers selected');
});
