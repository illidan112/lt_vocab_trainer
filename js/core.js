export const STORAGE_KEY = 'lt-words-progress-v1';
export const SCHEMA_VERSION = 1;

export function localDay(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(day, days) {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + days, 12));
}

export function emptyProgress() { return { version: SCHEMA_VERSION, position: 0, words: {} }; }

export function readProgress(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const value = JSON.parse(raw);
    if (value.version !== SCHEMA_VERSION || !Number.isInteger(value.position) || value.position < 0 || !value.words || typeof value.words !== 'object' || Array.isArray(value.words)) throw Error('invalid');
    for (const [id, item] of Object.entries(value.words)) {
      if (!id || !item || !['learning', 'learned'].includes(item.status) || !/^\d{4}-\d\d-\d\d$/.test(item.nextReviewDate) || !Number.isInteger(item.repetitions) || item.repetitions < 0) throw Error('invalid');
    }
    return value;
  } catch { throw new Error('Не удалось прочитать сохранённый прогресс. Он не был перезаписан. Восстановите данные из резервной копии или очистите данные сайта.'); }
}

export function writeProgress(storage, progress) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(progress)); }
  catch { throw new Error('Не удалось сохранить прогресс. Проверьте свободное место и разрешения браузера.'); }
}

export function addWord(progress, id, today) {
  if (progress.words[id]) return progress;
  return { ...progress, words: { ...progress.words, [id]: { status: 'learning', addedAt: today, lastReviewedAt: null, nextReviewDate: today, repetitions: 0 } } };
}

export function dueIds(progress, today, allowedIds) {
  return Object.entries(progress.words)
    .filter(([id, p]) => allowedIds.has(id) && p.status === 'learning' && p.nextReviewDate <= today)
    .sort((a, b) => a[1].nextReviewDate.localeCompare(b[1].nextReviewDate))
    .map(([id]) => id);
}

export function reviewWord(progress, id, choice, today) {
  const item = progress.words[id];
  if (!item || item.status !== 'learning') return progress;
  if (choice === 'again') return progress;
  if (![1, 3, 7, 'learned'].includes(choice)) throw new Error('Неизвестная оценка');
  const updated = { ...item, status: choice === 'learned' ? 'learned' : 'learning', lastReviewedAt: today, nextReviewDate: choice === 'learned' ? today : addDays(today, choice), repetitions: item.repetitions + 1 };
  return { ...progress, words: { ...progress.words, [id]: updated } };
}

export function moveToEnd(queue, id) { return [...queue.filter(x => x !== id), id]; }

export function importProgress(input, allowedIds) {
  if (!input || input.app !== 'lt-words' || !input.progress) throw new Error('Файл не является резервной копией приложения.');
  const temporary = { getItem: () => JSON.stringify(input.progress) };
  const result = readProgress(temporary);
  if (Object.keys(result.words).some(id => !allowedIds.has(id))) throw new Error('В файле есть слова, которых нет в текущем словаре.');
  return result;
}
