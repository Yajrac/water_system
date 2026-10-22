const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(
  fs.readFileSync(require.resolve('../src/features/session/api.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
function client(fetch) {
  const context = vm.createContext({ exports: {}, process: { env: {} }, fetch,
    AbortController, setTimeout, clearTimeout, Error, TypeError });
  vm.runInContext(source, context);
  return context.exports.consumerRequest;
}
test('network and timeout errors display friendly text without technical fetch details', async () => {
  await assert.rejects(client(async () => { throw new TypeError('Failed to fetch'); })('/auth/login', {}),
    /Unable to connect\. Check your internet connection/);
  await assert.rejects(client(async () => { const e = new Error(); e.name = 'AbortError'; throw e; })('/auth/login', {}),
    /Connecting is taking longer/);
});
test('server failures hide technical details but credential validation remains useful', async () => {
  const request = status => client(async () => ({ status, ok: false,
    json: async () => ({ success: false, message: status === 401 ? 'Invalid username or password.' : 'API endpoint not found.' }) }));
  await assert.rejects(request(500)('/auth/login', {}), /temporarily unavailable/);
  await assert.rejects(request(404)('/auth/login', {}), /currently unavailable/);
  await assert.rejects(request(401)('/auth/login', {}), /Invalid username or password/);
});
