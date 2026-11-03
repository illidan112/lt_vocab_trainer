"""Run UI smoke checks in an installed Chromium browser with an isolated profile."""
import functools
import http.server
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]
APP_VERSION = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
BROWSER = next((Path(path) for path in (
    os.environ.get('BROWSER', ''),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
) if path and Path(path).is_file()), None)
if BROWSER is None:
    raise SystemExit('Set BROWSER to the path of a Chromium browser.')

PAGE = b'''<!doctype html><meta charset="utf-8"><body>
<pre id="result">RUNNING</pre><iframe id="app" src="/"></iframe>
<script type="module">
import { STORAGE_KEY } from '/js/core.js';
const expectedVersion = __APP_VERSION__;
const frame = document.getElementById('app');
const result = document.getElementById('result');
const assert = (condition, message) => { if (!condition) throw Error(message); };
const pause = () => new Promise(resolve => setTimeout(resolve, 50));
const ready = async (selector = '[data-action="add"]') => {
  for (let i = 0; i < 100; i++) {
    if (frame.contentDocument.querySelector(selector)) return;
    await pause();
  }
  throw Error('App did not render');
};
const reload = async selector => {
  await new Promise(resolve => {
    frame.onload = resolve;
    frame.contentWindow.location.reload();
  });
  await ready(selector);
};
const state = () => JSON.parse(localStorage.getItem(STORAGE_KEY));
const click = action => frame.contentDocument.querySelector(`[data-action="${action}"]`).click();
const counter = () => frame.contentDocument.querySelector('.navigation span').textContent;
const checkCard = (word, headingSelector = '.card h1', hasTranslation = true) => {
  const doc = frame.contentDocument;
  const heading = doc.querySelector(headingSelector);
  assert(heading?.textContent === (word.displayWord || word.word), 'Word heading changed');
  const forms = doc.querySelector('.word-forms');
  const values = Object.values(word.forms || {});
  if (!values.length) {
    assert(forms?.textContent === word.grammarNote, 'Grammar note not displayed for empty forms');
    assert(forms.getAttribute('lang') !== 'lt', 'Grammar note is incorrectly marked as Lithuanian');
  } else {
    assert(forms?.textContent === values.join(', '), 'Not all forms are displayed');
  }
  assert(heading.nextElementSibling === forms, 'Forms must follow displayWord');
  const style = frame.contentWindow.getComputedStyle(forms);
  assert(style.display !== 'none' && style.visibility === 'visible', 'Forms are hidden');
  assert(parseFloat(style.fontSize) < parseFloat(frame.contentWindow.getComputedStyle(heading).fontSize), 'Forms font is not smaller');
  assert(style.whiteSpace === (values.length ? 'nowrap' : 'normal'), 'Forms or grammar note have incorrect wrapping');
  assert(forms.getBoundingClientRect().height > 0, 'Forms line has no height');
  assert(forms.getBoundingClientRect().top >= heading.getBoundingClientRect().bottom - 1, 'Forms overlap the heading');
  const partOfSpeech = doc.querySelector('.word-part-of-speech');
  if (word.partOfSpeech) {
    assert(partOfSpeech?.textContent === word.partOfSpeech, 'Part of speech not displayed');
    assert(forms.nextElementSibling === partOfSpeech, 'Part of speech must follow forms');
    const partOfSpeechStyle = frame.contentWindow.getComputedStyle(partOfSpeech);
    assert(partOfSpeechStyle.fontSize === style.fontSize && partOfSpeechStyle.color === style.color, 'Part of speech must use forms styling');
    assert(partOfSpeech.getBoundingClientRect().height > 0, 'Part of speech line has no height');
    assert(partOfSpeech.getBoundingClientRect().top >= forms.getBoundingClientRect().bottom - 1, 'Part of speech overlaps forms');
  }
  if (hasTranslation) {
    const translation = doc.querySelector('.translation');
    const previousLine = partOfSpeech || forms;
    assert(previousLine.nextElementSibling === translation, 'Translation must follow word details');
    assert(translation.getBoundingClientRect().top >= previousLine.getBoundingClientRect().bottom - 1, 'Translation overlaps word details');
  }
};
(async () => {
  await ready();
  assert(frame.contentDocument.getElementById('app-version').textContent === expectedVersion, 'Wrong version');
  const words = await (await fetch('/data/words.json')).json();
  assert(Object.keys(words[0].forms || {}).length > 0, 'First fixture needs forms');
  checkCard(words[0]);
  frame.contentDocument.getElementById('theme-toggle').click();
  assert(frame.contentDocument.documentElement.dataset.theme === 'dark', 'Dark theme failed');
  checkCard(words[0]);
  click('translate');
  click('add');
  assert(state().words[words[0].id], 'First word not saved');
  assert(state().position === 1 && counter().startsWith('2 '), 'Study did not advance');
  assert(frame.contentDocument.querySelector('.example-translation').textContent.trim() === '', 'Translation not reset');
  click('next');
  assert(state().position === 2 && Object.keys(state().words).length === 1, 'Next changed study progress');
  click('previous');
  assert(state().position === 1, 'Previous failed');
  frame.contentDocument.querySelector('[data-view="review"]').click();
  assert(!frame.contentDocument.querySelector('.word-forms'), 'Forms reveal the answer too early');
  click('reveal');
  checkCard(words[0], '.answer h2', false);
  frame.contentDocument.querySelector('[data-view="new"]').click();
  await reload();
  assert(counter().startsWith('2 '), 'Position not restored');
  assert(frame.contentDocument.documentElement.dataset.theme === 'dark', 'Theme not restored');
  checkCard(words[1]);
  const raktasIndex = words.findIndex(word => word.id === 'raktas');
  assert(raktasIndex >= 0, 'Raktas fixture missing');
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state(), position: raktasIndex }));
  await reload();
  checkCard(words[raktasIndex]);
  const emptyFormsIndex = words.findIndex(word => !Object.keys(word.forms || {}).length);
  assert(emptyFormsIndex >= 0, 'Empty forms fixture missing');
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state(), position: emptyFormsIndex }));
  await reload();
  checkCard(words[emptyFormsIndex]);
  const progressBeforeCatalog = localStorage.getItem(STORAGE_KEY);
  const checkCatalog = () => {
    const doc = frame.contentDocument;
    const rows = [...doc.querySelectorAll('.catalog-word')];
    assert(rows.length === words.length, 'Catalog must show the entire dictionary');
    rows.forEach((row, index) => {
      const word = words[index];
      assert(row.dataset.id === word.id, 'Catalog entry has an incorrect id');
      assert(row.querySelector('strong').textContent === (word.displayWord || word.word), 'Catalog displayWord is missing');
      assert(row.querySelector('small').textContent === word.partOfSpeech, 'Catalog partOfSpeech is missing');
      assert(row.querySelector('.catalog-translation').textContent === word.translation, 'Catalog translation is missing');
    });
    assert(doc.querySelector('[data-view="all"]').getAttribute('aria-current') === 'page', 'Catalog tab is not active');
  };
  frame.contentDocument.querySelector('[data-view="all"]').click();
  checkCatalog();
  assert(localStorage.getItem(STORAGE_KEY) === progressBeforeCatalog, 'Opening catalog changed progress');
  const searchCatalog = query => {
    const input = frame.contentDocument.getElementById('all-search');
    input.focus();
    input.value = query;
    input.dispatchEvent(new frame.contentWindow.Event('input', { bubbles: true }));
    assert(frame.contentDocument.activeElement === input, 'Typing in search lost focus');
    assert(frame.contentDocument.getElementById('all-search') === input, 'Search replaced its input while typing');
    return [...frame.contentDocument.querySelectorAll('.catalog-word')];
  };
  assert(frame.contentDocument.querySelector('.section-title').nextElementSibling.id === 'all-search', 'Search must follow catalog heading');
  let searchRows = searchCatalog('ap');
  assert(searchRows.length > 0 && searchRows.length < words.length, 'Search did not filter the catalog');
  assert(searchRows.some(row => row.dataset.id === 'apsirengti'), 'Search missed a matching word prefix');
  assert(searchRows.every(row => words.find(word => word.id === row.dataset.id).word.startsWith('ap')), 'Search matched a substring instead of a prefix');
  const prefixIds = searchRows.map(row => row.dataset.id).join('|');
  assert(searchCatalog('AP').map(row => row.dataset.id).join('|') === prefixIds, 'Search is case-sensitive');
  const translatedPrefix = String.fromCodePoint(0x434, 0x43e, 0x43c);
  searchRows = searchCatalog(translatedPrefix.toUpperCase());
  assert(searchRows.some(row => row.dataset.id === 'namas'), 'Search missed a translation prefix');
  assert(searchRows.every(row => words.find(word => word.id === row.dataset.id).translation.toLowerCase().startsWith(translatedPrefix)), 'Translation search matched outside the prefix');
  searchRows = searchCatalog(words[0].displayWord.slice(0, 2).normalize('NFD').toUpperCase());
  assert(searchRows.some(row => row.dataset.id === words[0].id), 'Search missed a displayWord prefix with stress marks');
  const queryBeforeCard = frame.contentDocument.getElementById('all-search').value;
  searchRows.find(row => row.dataset.id === words[0].id).click();
  checkCard(words[0]);
  click('back-to-all');
  assert(frame.contentDocument.getElementById('all-search').value === queryBeforeCard, 'Returning from card lost the search query');
  assert(frame.contentDocument.querySelectorAll('.catalog-word').length === searchRows.length, 'Returning from card lost the filter');
  assert(searchCatalog('zzzz-no-such-word').length === 0 && frame.contentDocument.querySelector('.catalog-empty'), 'Empty search result is not shown');
  assert(searchCatalog('<img src=x onerror=alert(1)>').length === 0 && !frame.contentDocument.querySelector('.catalog-list img'), 'Search query was interpreted as HTML');
  searchCatalog('');
  checkCatalog();
  assert(localStorage.getItem(STORAGE_KEY) === progressBeforeCatalog, 'Searching changed progress');
  for (const width of [320, 760]) {
    frame.style.width = width + 'px';
    await pause();
    const doc = frame.contentDocument;
    assert(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth, 'Catalog overflows the viewport at ' + width + ': ' + doc.documentElement.scrollWidth + ' > ' + doc.documentElement.clientWidth);
    const tabs = [...doc.querySelectorAll('[data-view]')];
    assert(tabs.length === 4 && tabs.every(tab => tab.getBoundingClientRect().right <= doc.documentElement.clientWidth), 'Tabs do not fit at ' + width);
  }
  const catalogWord = words.find(word => word.id === 'stotis_verb');
  assert(catalogWord && !state().words[catalogWord.id], 'Catalog fixture must be a separate, unstudied homonym');
  frame.contentWindow.scrollTo(0, 600);
  const catalogScroll = frame.contentWindow.scrollY;
  frame.contentDocument.querySelector(`.catalog-word[data-id="${catalogWord.id}"]`).click();
  checkCard(catalogWord);
  assert(frame.contentDocument.querySelector('[data-view="all"]').classList.contains('active'), 'Opening a card left the catalog tab');
  assert(localStorage.getItem(STORAGE_KEY) === progressBeforeCatalog, 'Opening catalog card changed progress');
  click('translate');
  assert(frame.contentDocument.querySelector('.example-translation').textContent === catalogWord.exampleTranslation, 'Catalog example translation failed');
  click('add');
  assert(state().words[catalogWord.id] && !state().words.stotis, 'Catalog study action added the wrong homonym');
  assert(state().position === emptyFormsIndex, 'Catalog study action moved the new-word position');
  assert(frame.contentDocument.querySelector('[data-action="add"]').disabled, 'Added catalog word can be added again');
  checkCard(catalogWord);
  click('back-to-all');
  checkCatalog();
  assert(Math.abs(frame.contentWindow.scrollY - catalogScroll) <= 1, 'Catalog scroll position was not restored');
  assert(frame.contentDocument.activeElement.dataset.id === catalogWord.id, 'Catalog keyboard focus was not restored');
  frame.contentDocument.querySelector('.catalog-word').click();
  checkCard(words[0]);
  assert(frame.contentDocument.querySelector('[data-action="add"]').disabled, 'Catalog ignores already studied words');
  frame.contentDocument.querySelector('[data-view="new"]').click();
  checkCard(words[emptyFormsIndex]);
  frame.contentWindow.location.hash = 'all';
  await reload('.catalog-word');
  checkCatalog();
  frame.contentWindow.location.hash = '';
  await reload();
  checkCard(words[emptyFormsIndex]);
  const last = state();
  last.position = words.length - 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(last));
  await reload();
  click('add');
  assert(state().position === words.length - 1 && state().words[words.at(-1).id], 'Last card failed');
  assert(frame.contentDocument.querySelector('[data-action="next"]').disabled, 'Next enabled on last card');
  const registration = await navigator.serviceWorker.ready;
  for (let i = 0; i < 100 && !frame.contentWindow.navigator.serviceWorker.controller; i++) await pause();
  assert(registration.active && frame.contentWindow.navigator.serviceWorker.controller, 'Service worker did not take control');
  const cache = await caches.open('lt-words-v' + expectedVersion);
  for (const path of ['/index.html', '/js/app.js?v=' + expectedVersion, '/styles.css?v=' + expectedVersion]) {
    assert(await cache.match(path), 'Current offline asset missing: ' + path);
  }
  await reload();
  assert(counter().startsWith(String(words.length) + ' '), 'Controlled reload failed');
  checkCard(words.at(-1));
  assert(frame.contentDocument.getElementById('app-version').textContent === expectedVersion, 'Controlled reload uses an old version');
  const savedProgress = localStorage.getItem(STORAGE_KEY);
  const oldDictionary = words.slice(0, Math.min(300, words.length - 1));
  await cache.put('/data/words.json', new Response(JSON.stringify(oldDictionary), { headers: { 'Content-Type': 'application/json' } }));
  await reload();
  assert(counter().startsWith(String(words.length) + ' ') && counter().endsWith(' ' + words.length), 'Old cached dictionary limits the card count');
  assert(localStorage.getItem(STORAGE_KEY) === savedProgress, 'Dictionary refresh changed study progress');
  assert((await (await cache.match('/data/words.json')).json()).length === words.length, 'Offline dictionary was not refreshed');
  await fetch('/__dictionary-offline', { method: 'POST' });
  try {
    await reload();
    assert(counter().startsWith(String(words.length) + ' ') && counter().endsWith(' ' + words.length), 'Updated dictionary is unavailable offline');
    checkCard(words.at(-1));
    frame.contentDocument.querySelector('[data-view="all"]').click();
    checkCatalog();
    assert(searchCatalog('ap').length > 0, 'Catalog search is unavailable offline');
    searchCatalog('');
    frame.contentDocument.querySelector('.catalog-word').click();
    checkCard(words[0]);
    frame.contentDocument.querySelector('[data-view="new"]').click();
    assert(localStorage.getItem(STORAGE_KEY) === savedProgress, 'Offline reload changed study progress');
  } finally {
    await fetch('/__dictionary-online', { method: 'POST' });
  }
  result.textContent = 'PASS: version ' + expectedVersion + ', ' + words.length + ' words, forms layout in light/dark themes and review, full catalog, live prefix search by word/displayWord/translation, search focus and filter persistence, empty results and clearing, responsive tabs, catalog cards and study actions, catalog scroll/focus restoration, catalog direct link and offline search, raktas, empty forms, navigation, progress persistence, theme persistence, last card, current offline assets, service worker reload, stale dictionary refresh, dictionary fallback when server is unavailable';
})().catch(error => { result.textContent = 'FAIL: ' + error.stack; })
  .then(() => fetch('/__result', { method: 'POST', body: result.textContent }));
</script>'''.replace(b'__APP_VERSION__', json.dumps(APP_VERSION).encode('utf-8'))


finished = threading.Event()
summary = ''
dictionary_available = True


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        global summary, dictionary_available
        if self.path in ('/__dictionary-offline', '/__dictionary-online'):
            dictionary_available = self.path == '/__dictionary-online'
            self.send_response(204)
            self.end_headers()
            return
        if self.path != '/__result':
            self.send_error(404)
            return
        summary = self.rfile.read(int(self.headers['Content-Length'])).decode('utf-8')
        self.send_response(204)
        self.end_headers()
        finished.set()

    def do_GET(self):
        if self.path == '/data/words.json' and not dictionary_available:
            self.send_error(503, 'Dictionary unavailable for offline fallback check')
        elif self.path == '/__smoke':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(PAGE)
        else:
            super().do_GET()

    def log_message(self, *args):
        pass


server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with tempfile.TemporaryDirectory(prefix='lt-words-smoke-') as profile:
        browser = subprocess.Popen([
            str(BROWSER), '--headless', '--disable-gpu', '--no-first-run',
            '--no-default-browser-check', f'--user-data-dir={profile}',
            '--remote-debugging-port=0', '--disable-background-networking',
            f'http://127.0.0.1:{server.server_port}/__smoke',
        ], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        try:
            completed = finished.wait(45)
        finally:
            browser.terminate()
            _, errors = browser.communicate(timeout=10)
        if not completed:
            raise SystemExit('Browser test timed out.\n' + errors.decode('utf-8', errors='replace'))
        print(summary)
        if not summary.startswith('PASS:'):
            raise SystemExit(1)
finally:
    server.shutdown()
    server.server_close()
