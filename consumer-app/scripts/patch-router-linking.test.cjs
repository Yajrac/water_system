const test = require('node:test');
const assert = require('node:assert/strict');
const { patchRouter, guard } = require('./patch-router-linking.cjs');

test('initial link queues before mount, flushes once, and ignores late work after unmount', () => {
  const writes = [], effects = [];
  const react = { default: {
    useRef: value => ({ current: value }),
    useCallback: callback => callback,
    useEffect: effect => effects.push(effect),
  } };
  const handle = new Function('react_1', 'setLastUnhandledLink', guard + '\nreturn handleUnhandledLink;')(react, value => writes.push(value));
  handle('/bills');
  assert.deepEqual(writes, []);
  const cleanup = effects[0]();
  assert.deepEqual(writes, ['/bills']);
  handle('/payments');
  assert.deepEqual(writes, ['/bills', '/payments']);
  cleanup();
  handle('/late');
  assert.deepEqual(writes, ['/bills', '/payments']);
});

test('patch is repeatable and refuses unknown router versions or changed source', () => {
  const source = '    const [lastUnhandledLink, setLastUnhandledLink] = react_1.default.useState();\n    }, setLastUnhandledLink);';
  const patched = patchRouter(source, '57.0.28');
  assert.match(patched, /handleUnhandledLink\);/);
  assert.equal(patchRouter(patched, '57.0.28'), patched);
  assert.throws(() => patchRouter(source, '58.0.0'), /Review/);
  assert.throws(() => patchRouter('changed', '57.0.28'), /source changed/);
});
