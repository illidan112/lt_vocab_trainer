import { STORAGE_KEY, emptyProgress, localDay, addDays, readProgress, writeProgress, addWord, dueIds, reviewWord, moveToEnd, importProgress } from './core.js';

const $ = (selector) => document.querySelector(selector);
const APP_VERSION = '0.1.7';
$('#app-version').textContent = APP_VERSION;
const content = $('#content');
const notice = $('#notice');
const allowedViews = new Set(['new', 'review', 'mine']);
const params = new URLSearchParams(location.search);
const demo = params.get('demo') === '1';
const demoOffset = Math.max(0, Math.min(60, Number(params.get('day') || 0) || 0));
const storage = demo ? { getItem: () => sessionStorage.getItem(STORAGE_KEY + '-demo'), setItem: (_, value) => sessionStorage.setItem(STORAGE_KEY + '-demo', value) } : localStorage;
const today = () => demo ? addDays(localDay(), demoOffset) : localDay();
let words = [];
let progress = emptyProgress();
let view = 'new';
let queue = [];
let revealed = false;
let exampleVisible = false;
let lastRemoved = null;
let voices = [];
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const byId = id => words.find(word => word.id === id);
const allowedIds = () => new Set(words.map(word => word.id));
const due = () => dueIds(progress, today(), allowedIds());
const symbol = word => word.image ? `<img src="${escape(word.image)}" alt="${escape(word.translation)}" width="110" height="110">` : escape(word.symbol || '📝');
const formsLine = word => {
  const forms = Object.values(word.forms || {});
  return forms.length ? `<p class="word-forms muted" lang="lt">${escape(forms.join(', '))}</p>` : '';
};

function message(text) { notice.textContent = text; notice.hidden = false; }
function clearMessage() { notice.hidden = true; notice.textContent = ''; }
function save(next) {
  try { writeProgress(storage, next); progress = next; clearMessage(); return true; }
  catch (error) { message(error.message); return false; }
}
function chooseView(next) {
  view = next;
  if (view === 'review') { queue = due(); revealed = false; }
  exampleVisible = false;
  clearMessage();
  render();
}
function updateNav() {
  $('#due-tab').textContent = due().length;
  document.querySelectorAll('[data-view]').forEach(tab => { tab.classList.toggle('active', tab.dataset.view === view); tab.setAttribute('aria-current', tab.dataset.view === view ? 'page' : 'false'); });
}
function renderNew() {
  if (!words.length) { content.innerHTML = '<div class="panel empty"><h2>Словарь пуст</h2></div>'; return; }
  const position = Math.min(progress.position, words.length - 1);
  const word = words[position];
  const added = progress.words[word.id];
  content.innerHTML = `<p class="eyebrow">Новые слова</p><article class="panel card"><div class="illustration" aria-hidden="true">${symbol(word)}</div><h1 lang="lt">${escape(word.displayWord || word.word)}</h1>${formsLine(word)}<p class="translation">${escape(word.translation)}</p><p class="example" lang="lt">${escape(word.example)}</p><p class="example-translation">${exampleVisible ? escape(word.exampleTranslation) : ' '}</p><div class="actions"><button class="secondary" data-action="translate">${exampleVisible ? 'Скрыть перевод' : 'Перевод примера'}</button><button class="secondary" data-action="speak" data-id="${escape(word.id)}">🔊 Слушать</button><button class="primary" data-action="add" ${added ? 'disabled' : ''}>${added ? 'Уже добавлено' : 'Изучать'}</button></div></article><div class="navigation"><button data-action="previous" ${position === 0 ? 'disabled' : ''}>← Назад</button><span>${position + 1} из ${words.length}</span><button data-action="next" ${position === words.length - 1 ? 'disabled' : ''}>Далее →</button></div>`;
}
function renderReview() {
  if (!queue.length) {
    content.innerHTML = `<div class="panel empty"><h2>На сегодня всё</h2><p>Сейчас нет слов для повторения. Можно посмотреть новые карточки.</p><button class="primary" data-action="open-new">Новые слова</button></div>`;
    return;
  }
  const word = byId(queue[0]);
  if (!word) { queue.shift(); renderReview(); return; }
  content.innerHTML = `<p class="eyebrow">Повторение · осталось ${queue.length}</p><article class="panel card"><div class="illustration" aria-hidden="true">${symbol(word)}</div><p class="review-prompt">Вспомните слово по-литовски</p><p class="review-face">${escape(word.translation)}</p>${revealed ? `<div class="answer"><h2 lang="lt">${escape(word.displayWord || word.word)}</h2>${formsLine(word)}<p class="example" lang="lt">${escape(word.example)}</p><p class="example-translation">${escape(word.exampleTranslation)}</p><button class="secondary" data-action="speak" data-id="${escape(word.id)}">🔊 Слушать</button><div class="choices"><button data-action="rate" data-choice="again">Не помню · сегодня</button><button data-action="rate" data-choice="1">Трудно · 1 день</button><button data-action="rate" data-choice="3">Нормально · 3 дня</button><button data-action="rate" data-choice="7">Легко · 7 дней</button><button data-action="rate" data-choice="learned">Выучено</button></div></div>` : `<div class="actions"><button class="primary" data-action="reveal">Показать ответ</button></div>`}</article><p class="hint">Можно перейти в другой раздел и продолжить позже.</p>`;
}
function renderMine() {
  const entries = Object.entries(progress.words).filter(([id]) => byId(id)).sort((a, b) => (a[1].status === b[1].status ? a[1].nextReviewDate.localeCompare(b[1].nextReviewDate) : a[1].status === 'learning' ? -1 : 1));
  const studying = entries.filter(([, item]) => item.status === 'learning').length;
  content.innerHTML = `<h1 class="section-title">Мои слова</h1><div class="stats"><div class="stat"><strong>${words.length}</strong><span>всего в словаре</span></div><div class="stat"><strong>${studying}</strong><span>изучается</span></div><div class="stat"><strong>${entries.length - studying}</strong><span>выучено</span></div><div class="stat"><strong>${due().length}</strong><span>повторить сегодня</span></div></div>${entries.length ? `<div class="word-list">${entries.map(([id, item]) => { const word = byId(id); return `<div class="word-row"><div><strong lang="lt">${escape(word.displayWord || word.word)} — ${escape(word.translation)}</strong><small>${item.status === 'learned' ? 'Выучено' : `Повторить: ${escape(item.nextReviewDate)}`} · повторений: ${item.repetitions}</small></div><div class="row-actions">${item.status === 'learned' ? `<button data-action="restore" data-id="${escape(id)}">Вернуть</button>` : ''}<button class="remove" data-action="remove" data-id="${escape(id)}">Убрать</button></div></div>`; }).join('')}</div>` : `<div class="panel empty"><h2>Здесь пока пусто</h2><p>Добавьте слова из каталога, чтобы начать изучение.</p><button class="primary" data-action="open-new">Новые слова</button></div>`}`;
}
function render() { updateNav(); if (view === 'new') renderNew(); else if (view === 'review') renderReview(); else renderMine(); }

async function speak(word) {
  if (word.audio) {
    try { const audio = new Audio(word.audio); await audio.play(); return; }
    catch { message('Аудиофайл не воспроизвёлся. Попробуем литовский голос устройства.'); }
  }
  if (!('speechSynthesis' in window)) { message('Озвучка не поддерживается этим браузером.'); return; }
  voices = speechSynthesis.getVoices();
  const voice = voices.find(v => v.lang.toLowerCase().startsWith('lt'));
  if (!voice) { message('Литовский голос не найден на устройстве. Можно добавить готовые аудиофайлы в будущей версии.'); return; }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word.word);
  utterance.lang = 'lt-LT'; utterance.voice = voice; utterance.rate = 0.85;
  utterance.onerror = () => message('Не удалось воспроизвести литовский голос.');
  speechSynthesis.speak(utterance);
}

document.querySelectorAll('[data-view]').forEach(tab => tab.addEventListener('click', () => chooseView(tab.dataset.view)));
content.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]'); if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === 'open-new') return chooseView('new');
  if (action === 'translate') { exampleVisible = !exampleVisible; return render(); }
  if (action === 'speak') return speak(byId(button.dataset.id));
  if (action === 'reveal') { revealed = true; return render(); }
  if (action === 'previous' || action === 'next') {
    const position = Math.min(words.length - 1, Math.max(0, progress.position + (action === 'next' ? 1 : -1)));
    if (save({ ...progress, position })) { exampleVisible = false; render(); } return;
  }
  if (action === 'add') {
    const next = addWord(progress, words[progress.position].id, today());
    const position = Math.min(progress.position + 1, words.length - 1);
    if (save({ ...next, position })) { exampleVisible = false; render(); }
    return;
  }
  if (action === 'rate') {
    const id = queue[0]; const choice = button.dataset.choice;
    if (choice === 'again') queue = moveToEnd(queue, id);
    else if (save(reviewWord(progress, id, choice === 'learned' ? 'learned' : Number(choice), today()))) queue.shift();
    revealed = false; render(); return;
  }
  if (action === 'remove') {
    const id = button.dataset.id; const previous = progress.words[id];
    const updated = { ...progress, words: { ...progress.words } }; delete updated.words[id];
    if (save(updated)) { lastRemoved = { id, previous }; render(); message('Слово убрано. Нажмите «Отменить», чтобы восстановить.'); const undo = document.createElement('button'); undo.textContent = 'Отменить'; undo.className = 'secondary'; undo.style.marginLeft = '10px'; undo.onclick = () => { if (lastRemoved && save({ ...progress, words: { ...progress.words, [lastRemoved.id]: lastRemoved.previous } })) { lastRemoved = null; render(); } }; notice.append(undo); }
    return;
  }
  if (action === 'restore') {
    const id = button.dataset.id; const item = progress.words[id];
    if (save({ ...progress, words: { ...progress.words, [id]: { ...item, status: 'learning', nextReviewDate: today() } } })) render();
  }
});

$('#backup').onclick = () => $('#backup-dialog').showModal();
$('#export').onclick = () => {
  const blob = new Blob([JSON.stringify({ app: 'lt-words', exportedAt: new Date().toISOString(), progress }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `lt-words-backup-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('#import').onchange = async event => {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error('Файл слишком большой для резервной копии.');
    const imported = importProgress(JSON.parse(await file.text()), allowedIds());
    if (!confirm('Заменить текущий прогресс данными из файла?')) return;
    if (save(imported)) { $('#backup-dialog').close(); queue = []; render(); message('Прогресс восстановлен.'); }
  } catch (error) { message(error instanceof SyntaxError ? 'Неверный формат JSON-файла.' : error.message); $('#backup-dialog').close(); }
  finally { event.target.value = ''; }
};

async function registerOffline() {
  if (!('serviceWorker' in navigator)) { $('#offline-label').textContent = 'Офлайн-режим недоступен.'; return; }
  // An activated worker cannot replace JavaScript already running in this page.
  const wasControlled = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (wasControlled && !reloading) { reloading = true; location.reload(); }
  });
  try {
    await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    const ready = await navigator.serviceWorker.ready;
    $('#offline-label').textContent = 'Приложение доступно офлайн после первой загрузки.';
    ready.update().catch(() => {});
  } catch { $('#offline-label').textContent = 'Офлайн-режим пока недоступен.'; }
}

async function start() {
  try {
    const response = await fetch('/data/words.json', { cache: 'no-store' }); if (!response.ok) throw Error('Словарь не загрузился. Проверьте подключение и обновите страницу.');
    words = await response.json();
    if (!Array.isArray(words) || !words.length || words.some(word => !word.id || !word.word || !word.translation || !word.example)) throw Error('Файл словаря повреждён.');
    if (demo) { const label = document.createElement('p'); label.className = 'hint'; label.textContent = `Режим проверки · дата ${today()} · отдельный временный прогресс`; content.before(label); }
    progress = readProgress(storage);
    if (progress.position >= words.length) progress.position = 0;
    view = allowedViews.has(location.hash.slice(1)) ? location.hash.slice(1) : 'new';
    if (view === 'review') queue = due();
    render(); registerOffline();
  } catch (error) { content.innerHTML = `<div class="panel empty"><h2>Не удалось открыть приложение</h2><p>${escape(error.message)}</p></div>`; message(error.message); }
}
start();
