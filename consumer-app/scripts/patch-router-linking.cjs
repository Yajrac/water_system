// SDK 57 Android initial-link race: https://github.com/expo/expo/issues/49378
// Keep this patch until the SDK 57 fix is included in our installed router.
const fs = require('node:fs');
const path = require('node:path');

const marker = '// PWSS: defer initial-link state until navigation commits.';
const guard = `${marker}
    const initialLink = react_1.default.useRef({ phase: 'pending', pending: false, value: undefined });
    const handleUnhandledLink = react_1.default.useCallback((value) => {
        const link = initialLink.current;
        if (link.phase === 'mounted') setLastUnhandledLink(value);
        else if (link.phase === 'pending') { link.pending = true; link.value = value; }
    }, []);
    react_1.default.useEffect(() => {
        const link = initialLink.current;
        link.phase = 'mounted';
        if (link.pending) { link.pending = false; setLastUnhandledLink(link.value); }
        return () => { link.phase = 'ended'; link.pending = false; };
    }, []);`;

function patchRouter(source, version) {
  if (!version.startsWith('57.')) throw new Error('Review the initial-link patch for Expo Router ' + version);
  if (source.includes(marker)) return source;
  const state = '    const [lastUnhandledLink, setLastUnhandledLink] = react_1.default.useState();';
  const callback = '    }, setLastUnhandledLink);';
  if (source.split(state).length !== 2 || source.split(callback).length !== 2)
    throw new Error('Expo Router linking source changed. Review the patch before building.');
  return source.replace(state, state + '\n    ' + guard).replace(callback, '    }, handleUnhandledLink);');
}

if (require.main === module) {
  const root = path.dirname(require.resolve('expo-router/package.json'));
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const file = path.join(root, 'build/fork/NavigationContainer.js');
  const source = fs.readFileSync(file, 'utf8');
  const patched = patchRouter(source, version);
  if (source !== patched) fs.writeFileSync(file, patched);
  console.log('Expo Router initial-link mount guard ready (' + version + ').');
}

module.exports = { patchRouter, guard };
