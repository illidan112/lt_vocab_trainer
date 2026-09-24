import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
let count = 0; const problems = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else { count++; if (fs.statSync(file).size > 25 * 1024 * 1024) problems.push(`${file}: больше 25 MiB`); }
  }
}
walk(root);
if (count > 20000) problems.push(`Слишком много файлов: ${count}`);
const words = JSON.parse(fs.readFileSync(path.join(root, 'data/words.json'), 'utf8'));
const seen = new Set();
for (const word of words) {
  if (seen.has(word.id)) problems.push(`Дублируется id ${word.id}`); seen.add(word.id);
  for (const field of ['image', 'audio']) if (word[field] && !fs.existsSync(path.join(root, word[field].replace(/^\//, '')))) problems.push(`Отсутствует ${field}: ${word[field]}`);
}
console.log(`${words.length} слов, ${count} файлов. ${problems.length ? problems.join('; ') : 'Проверка пройдена.'}`);
if (problems.length) process.exitCode = 1;
