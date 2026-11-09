import test from 'node:test';
import assert from 'node:assert/strict';
process.env.DB_HOST ||= '127.0.0.1';
process.env.DB_NAME ||= 'water_system_test';
process.env.DB_USER ||= 'test';
const { requireInstalledConsumer } = await import('../src/services/consumer-access.service.js');

test('only the latest Installed application unlocks consumer financial and feedback access', async () => {
  for (const status of ['Pending','Approved','Rejected','Cancelled',null]) {
    const database = {execute: async (sql,values) => {
      assert.deepEqual(values,['7']);
      assert.match(sql,/MAX\(id\)/);
      return [[status ? {status} : undefined]];
    }};
    await assert.rejects(requireInstalledConsumer('7',database),{statusCode:403});
  }
  await requireInstalledConsumer('7',{execute:async()=>[[{status:'Installed'}]]});
});
