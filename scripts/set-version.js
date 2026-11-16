import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';

const root = path.resolve(import.meta.dirname, '..');
const versionFiles = ['package.json', 'package-lock.json', 'js/app.js', 'index.html', 'sw.js'];

function replaceRequired(source, pattern, replacement, file) {
  if (!pattern.test(source)) throw new Error(`Version marker not found in ${file}.`);
  return source.replace(pattern, replacement);
}

// Prepare every change before writing any files.
export function versionUpdates(files, version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error('Use a release version such as 0.1.12.');
  }
  const updated = { ...files };
  const pkg = JSON.parse(files['package.json']);
  const lock = JSON.parse(files['package-lock.json']);
  pkg.version = version;
  lock.version = version;
  lock.packages[''].version = version;
  updated['package.json'] = JSON.stringify(pkg, null, 2) + '\n';
  updated['package-lock.json'] = JSON.stringify(lock, null, 2) + '\n';
  updated['js/app.js'] = replaceRequired(
    files['js/app.js'],
    /const APP_VERSION = ['"][^'"]+['"];/,
    () => `const APP_VERSION = '${version}';`,
    'js/app.js',
  );
  updated['index.html'] = replaceRequired(
    files['index.html'],
    /(<span\b[^>]*\bid="app-version"[^>]*>)[\s\S]*?(<\/span>)/,
    (_, start, end) => start + version + end,
    'index.html',
  );
  updated['sw.js'] = replaceRequired(
    files['sw.js'],
    /const CACHE = ['"]lt-words-v[^'"]+['"];/,
    () => `const CACHE = 'lt-words-v${version}';`,
    'sw.js',
  );
  for (const file of ['index.html', 'sw.js']) {
    updated[file] = replaceRequired(
      updated[file],
      /((?:["'])\/(?:js\/[^"'?]+\.js|styles\.css)\?v=)[^"']+/g,
      (_, prefix) => prefix + version,
      file,
    );
  }
  return updated;
}

async function main() {
  const check = process.argv[2] === '--check';
  const files = Object.fromEntries(
    await Promise.all(
      versionFiles.map(async (file) => [file, await readFile(path.join(root, file), 'utf8')]),
    ),
  );
  const version =
    check || !process.argv[2] ? JSON.parse(files['package.json']).version : process.argv[2];
  const updated = versionUpdates(files, version);
  const changes = [];
  for (const file of versionFiles) {
    const filepath = path.join(root, file);
    updated[file] = await format(updated[file], { ...(await resolveConfig(filepath)), filepath });
    if (updated[file] !== files[file]) changes.push(file);
  }
  if (check) {
    if (changes.length)
      throw new Error(
        `Version ${version} is out of sync: ${changes.join(', ')}. Run npm run version:set -- ${version}.`,
      );
    console.log(`Version ${version} is consistent.`);
    return;
  }
  for (const file of changes) await writeFile(path.join(root, file), updated[file]);
  console.log(`Version ${version} synchronized across ${versionFiles.length} files.`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
