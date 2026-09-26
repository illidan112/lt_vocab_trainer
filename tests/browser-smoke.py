"""Run UI smoke checks in an installed Chromium browser with an isolated profile."""
import functools
import http.server
import os
from pathlib import Path
import subprocess
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]
BROWSER = next((Path(path) for path in (
    os.environ.get('BROWSER', ''),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
) if path and Path(path).is_file()), None)
if BROWSER is None:
    raise SystemExit('Set BROWSER to the path of a Chromium browser.')

PAGE = b'''<!doctype html><meta charset="utf-8"><body>
<pre id="result">RUNNING</pre><iframe id="app" src="/"></iframe>
<script>
const frame = document.getElementById('app');
const result = document.getElementById('result');
const assert = (condition, message) => { if (!condition) throw Error(message); };
const pause = () => new Promise(resolve => setTimeout(resolve, 50));
const ready = async () => {
  for (let i = 0; i < 100; i++) {
    if (frame.contentDocument.querySelector('[data-action="add"]')) return;
    await pause();
  }
  throw Error('App did not render');
};
const reload = async () => {
  await new Promise(resolve => {
    frame.onload = resolve;
    frame.contentWindow.location.reload();
  });
  await ready();
};
const state = () => JSON.parse(localStorage.getItem('lt-words-progress-v1'));
const click = action => frame.contentDocument.querySelector(`[data-action="${action}"]`).click();
const counter = () => frame.contentDocument.querySelector('.navigation span').textContent;
(async () => {
  await ready();
  assert(frame.contentDocument.getElementById('app-version').textContent === '0.1.5', 'Wrong version');
  const words = await (await fetch('/data/words.json')).json();
  click('translate');
  click('add');
  assert(state().words[words[0].id], 'First word not saved');
  assert(state().position === 1 && counter().startsWith('2 '), 'Study did not advance');
  assert(frame.contentDocument.querySelector('.example-translation').textContent.trim() === '', 'Translation not reset');
  click('next');
  assert(state().position === 2 && Object.keys(state().words).length === 1, 'Next changed study progress');
  click('previous');
  assert(state().position === 1, 'Previous failed');
  await reload();
  assert(counter().startsWith('2 '), 'Position not restored');
  const last = state();
  last.position = words.length - 1;
  localStorage.setItem('lt-words-progress-v1', JSON.stringify(last));
  await reload();
  click('add');
  assert(state().position === words.length - 1 && state().words[words.at(-1).id], 'Last card failed');
  assert(frame.contentDocument.querySelector('[data-action="next"]').disabled, 'Next enabled on last card');
  const registration = await navigator.serviceWorker.ready;
  for (let i = 0; i < 100 && !frame.contentWindow.navigator.serviceWorker.controller; i++) await pause();
  await reload();
  assert(counter().startsWith(String(words.length) + ' '), 'Controlled reload failed');
  result.textContent = 'PASS: study advances, next only browses, previous works, position persists, last card stays, version is 0.1.5, service worker reload works';
})().catch(error => { result.textContent = 'FAIL: ' + error.stack; })
  .then(() => fetch('/__result', { method: 'POST', body: result.textContent }));
</script>'''


finished = threading.Event()
summary = ''


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        global summary
        if self.path != '/__result':
            self.send_error(404)
            return
        summary = self.rfile.read(int(self.headers['Content-Length'])).decode('utf-8')
        self.send_response(204)
        self.end_headers()
        finished.set()

    def do_GET(self):
        if self.path == '/__smoke':
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
