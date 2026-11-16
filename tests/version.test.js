import test from 'node:test';
import assert from 'node:assert/strict';
import { versionUpdates } from '../scripts/set-version.js';

function fixture() {
  return {
    'package.json': JSON.stringify({ version: '0.1.11', scripts: { test: 'node --test' } }),
    'package-lock.json': JSON.stringify({
      version: '0.1.11',
      packages: { '': { version: '0.1.11' }, 'node_modules/prettier': { version: '3.10.1' } },
    }),
    'js/app.js': "const APP_VERSION = '0.1.11';\nconst message = 'Unchanged';\n",
    'index.html':
      '<span id="app-version">0.1.11</span><link href="/styles.css?v=0.1.11"><script src="/js/theme.js?v=0.1.3"></script><script src="/js/app.js?v=0.1.11"></script>',
    'sw.js':
      "const CACHE = 'lt-words-v0.1.11';\nconst CORE = ['/styles.css?v=0.1.11', '/js/app.js?v=0.1.11', '/js/theme.js?v=0.1.3', '/js/core.js', '/data/words.json'];\n",
  };
}

test('version update synchronizes manifests, UI, assets, and offline cache', () => {
  const source = fixture();
  const snapshot = { ...source };
  const next = versionUpdates(source, '0.2.0');
  assert.deepEqual(source, snapshot);
  assert.equal(JSON.parse(next['package.json']).version, '0.2.0');
  assert.equal(JSON.parse(next['package.json']).scripts.test, 'node --test');
  const lock = JSON.parse(next['package-lock.json']);
  assert.equal(lock.version, '0.2.0');
  assert.equal(lock.packages[''].version, '0.2.0');
  assert.equal(lock.packages['node_modules/prettier'].version, '3.10.1');
  assert.match(next['js/app.js'], /APP_VERSION = '0\.2\.0'/);
  assert.match(next['js/app.js'], /const message = 'Unchanged'/);
  assert.match(next['index.html'], /id="app-version">0\.2\.0<\/span>/);
  for (const file of ['index.html', 'sw.js']) {
    for (const asset of ['/styles.css', '/js/app.js', '/js/theme.js']) {
      assert.ok(next[file].includes(`${asset}?v=0.2.0`));
    }
    assert.ok(!next[file].includes('0.1.11') && !next[file].includes('0.1.3'));
  }
  assert.match(next['sw.js'], /CACHE = 'lt-words-v0\.2\.0'/);
  assert.ok(next['sw.js'].includes("'/js/core.js'"));
  assert.ok(next['sw.js'].includes("'/data/words.json'"));
  assert.deepEqual(versionUpdates(next, '0.2.0'), next);
});

test('invalid versions and missing markers fail before changing inputs', () => {
  const source = fixture();
  const snapshot = { ...source };
  for (const version of ['next', '1.2', '01.2.3', '-1.2.3', '1.2.3/other']) {
    assert.throws(() => versionUpdates(source, version), /release version/);
  }
  assert.deepEqual(source, snapshot);
  for (const file of ['js/app.js', 'index.html', 'sw.js']) {
    const broken = { ...source, [file]: 'missing markers' };
    assert.throws(() => versionUpdates(broken, '0.2.0'), /Version marker not found/);
    assert.equal(broken[file], 'missing markers');
  }
});
